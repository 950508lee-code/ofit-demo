import {useState} from 'react';
import {dateLabel, ruleLabel, monthDay} from '../schedule';
import {
  addComment, addItem, addPost, commentsOf, createGroup, deleteGroup, eventById, eventsOf, groupById, joinByCode, leaveGroup,
  myGroups, nameOf, postsOf, progressOf, seriesById, stopSeries, today, toggleItem, type State,
} from '../store';
import {ago, type Ctx} from './common';

/** 진행 막대 — 무채색 한 줄. */
function Bar({done, all}: {done: number; all: number}) {
  return <span className="bar" aria-label={`${all}개 중 ${done}개 완료`}><i style={{width: all ? `${(done / all) * 100}%` : 0}} /></span>;
}

/** 그룹 — 목록, 만들기, 코드로 참여, 그룹 안(일정·공지·멤버). */
export function Groups({s, setS, open, setOpen, toast, gid, setGid, onCompose}: Ctx & {
  gid: string | null; setGid: (id: string | null) => void; onCompose: (groupId: string) => void;
}) {
  const [mode, setMode] = useState<'none' | 'create' | 'join'>('none');
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const g = groupById(s, gid ?? undefined);

  if (!g || !g.members.includes(s.me)) {
    const groups = myGroups(s);
    const submit = () => {
      const v = text.trim();
      if (!v) return;
      if (mode === 'create') {
        const r = createGroup(s, v);
        setS(r.s); setGid(r.id); setMode('none'); setText('');
        toast(`그룹을 만들었습니다. 초대코드는 ${r.s.groups.find(x => x.id === r.id)!.code}입니다`);
      } else {
        const r = joinByCode(s, v);
        if (!r) { setErr('그런 초대코드가 없습니다'); return; }
        setS(r.s); setGid(r.id); setMode('none'); setText(''); toast('그룹에 들어왔습니다');
      }
    };
    return (
      <section className="list">
        <div className="lh">
          <h2>그룹</h2>
          <button className="textbtn" onClick={() => { setMode('join'); setText(''); setErr(''); }}>코드로 참여</button>
          <button className="ghost strong" onClick={() => { setMode('create'); setText(''); setErr(''); }}>그룹 만들기</button>
        </div>
        <p className="lh-desc">부서·기관을 넘어 함께 하는 일입니다. 할 일을 나눠 맡고 함께 체크합니다. 다른 부서에 일을 보내고 회신만 받을 때는 일정 등록에서 '부서'를 고르세요.</p>
        {mode !== 'none' && (
          <div className="inline-form">
            <input className="search" autoFocus value={text} placeholder={mode === 'create' ? '그룹 이름  예) 연말 고객 안내 캠페인' : '초대코드 6자리'}
              inputMode={mode === 'join' ? 'numeric' : undefined} maxLength={mode === 'join' ? 6 : 40}
              onChange={e => { setText(e.target.value); setErr(''); }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit(); }} aria-label={mode === 'create' ? '그룹 이름' : '초대코드'} />
            <button className="ghost strong" disabled={!text.trim()} onClick={submit}>{mode === 'create' ? '만들기' : '참여하기'}</button>
            <button className="textbtn" onClick={() => setMode('none')}>취소</button>
            {err && <p className="err">{err}</p>}
          </div>
        )}
        {groups.length === 0 && mode === 'none' && (
          <p className="none">아직 그룹이 없습니다. 그룹을 만들고 초대코드를 보내면 함께할 사람이 들어옵니다.</p>
        )}
        {groups.length > 0 && <div className="card">
        {groups.map(x => {
          const ev = eventsOf(s, x.id);
          const openEv = ev.filter(e => { const p = progressOf(e); return p.done < p.all || p.all === 0; });
          return (
            <button key={x.id} className="row" onClick={() => { setGid(x.id); setOpen(null); }}>
              <span className="t">{x.name}<small>멤버 {x.members.length} · 진행 중 일정 {openEv.length}</small></span>
              <span className="st">{openEv[0] ? `다음 ${monthDay(openEv[0].due)}` : ''}</span>
            </button>
          );
        })}
        </div>}
      </section>
    );
  }

  return <GroupDetail s={s} setS={setS} open={open} setOpen={setOpen} toast={toast} gid={g.id} onBack={() => { setGid(null); setOpen(null); }} onCompose={onCompose} />;
}

function GroupDetail({s, setS, open, setOpen, toast, gid, onBack, onCompose}: Ctx & {gid: string; onBack: () => void; onCompose: (groupId: string) => void}) {
  const g = groupById(s, gid)!;
  const [post, setPost] = useState('');
  const isAdmin = g.admins.includes(s.me);
  // 반복 일정은 묶음마다 다가오는 회차 하나만(없으면 마지막 회차)
  const events = (() => {
    const day = today(), all = eventsOf(s, gid);
    return all.filter(e => {
      if (!e.seriesId) return true;
      const same = all.filter(x => x.seriesId === e.seriesId).sort((a, b) => a.due.localeCompare(b.due));
      return (same.find(x => x.due >= day) ?? same[same.length - 1]).id === e.id;
    });
  })();
  const posts = postsOf(s, gid);
  const copy = async () => {
    try { await navigator.clipboard.writeText(g.code); toast(`초대코드 ${g.code}를 복사했습니다`); }
    catch { toast(`초대코드는 ${g.code}입니다`); }
  };

  return (
    <section className="list">
      <div className="flow-back"><button className="textbtn" onClick={onBack}>그룹 목록</button></div>
      <div className="lh g-h">
        <div>
          <h2>{g.name}</h2>
          <p className="sub">멤버 {g.members.length} · 초대코드 <b>{g.code}</b> <button className="textbtn" onClick={copy}>복사</button></p>
        </div>
        <button className="ghost strong" onClick={() => onCompose(gid)}>일정 만들기</button>
      </div>

      <div className="card">
      <h3 className="dept">일정</h3>
      {events.length === 0 && <p className="none">아직 일정이 없습니다. 일정을 만들고 체크리스트 항목마다 담당자를 정하세요.</p>}
      {events.map(e => {
        const p = progressOf(e);
        const sel = open?.kind === 'gevent' && open.id === e.id;
        return (
          <button key={e.id} className={`row${sel ? ' sel' : ''}`} onClick={() => setOpen({kind: 'gevent', id: e.id})}>
            <span className="t">{e.title}<small>{seriesById(s, e.seriesId) ? `반복 · ${ruleLabel(seriesById(s, e.seriesId)!.rule)} · 이번 ` : ''}{dateLabel(e.due)}까지 · {nameOf(s, e.by)}</small></span>
            <span className="st prog"><Bar done={p.done} all={p.all} />{p.done}/{p.all}</span>
          </button>
        );
      })}
      </div>

      <div className="card">
      <h3 className="dept">공지</h3>
      <div className="inline-form">
        <input className="search" value={post} placeholder="그룹 멤버 모두에게 알릴 말" onChange={e => setPost(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && post.trim()) { setS(addPost(s, gid, post.trim())); setPost(''); } }} aria-label="공지" />
        <button className="ghost strong" disabled={!post.trim()} onClick={() => { setS(addPost(s, gid, post.trim())); setPost(''); toast('공지를 올렸습니다'); }}>올리기</button>
      </div>
      {posts.slice(0, 3).map(x => (
        <div key={x.id} className="post"><span className="hd">{nameOf(s, x.by)} · {ago(x.at)}</span><p>{x.text}</p></div>
      ))}
      </div>

      <div className="card">
      <h3 className="dept">멤버 {g.members.length}</h3>
      <ul className="members">
        {g.members.map(m => (
          <li key={m}>{nameOf(s, m)}{m === s.me && <small>나</small>}{g.admins.includes(m) && <small>관리자</small>}</li>
        ))}
      </ul>
      </div>

      <div className="sec-end">
        {isAdmin
          ? <button className="textbtn" onClick={() => { if (confirm(`'${g.name}' 그룹을 해체할까요? 일정과 공지가 모두 지워집니다.`)) { setS(deleteGroup(s, gid)); onBack(); toast('그룹을 해체했습니다'); } }}>그룹 해체</button>
          : <button className="textbtn" onClick={() => { if (confirm(`'${g.name}' 그룹에서 나갈까요?`)) { setS(leaveGroup(s, gid)); onBack(); toast('그룹에서 나왔습니다'); } }}>그룹 나가기</button>}
      </div>
    </section>
  );
}

/** 그룹 일정 카드 — 체크리스트(담당·완료), 항목 더하기, 댓글. */
export function GroupEventCard({s, setS, onClose, id}: {s: State; setS: (s: State) => void; onClose: () => void; id: string}) {
  const e = eventById(s, id);
  const [itemText, setItemText] = useState('');
  const [owner, setOwner] = useState('');
  const [comment, setComment] = useState('');
  if (!e) return null;
  const g = groupById(s, e.groupId)!;
  const p = progressOf(e);
  const comments = commentsOf(s, e.id);
  const canCheck = (o?: string) => !o || o === s.me || e.by === s.me;

  return (
    <aside className="detail" aria-label={e.title}>
      <div className="dh">
        <div>
          <p className="over">{g.name}</p>
          <h2>{e.title}</h2>
          <p className="when">{dateLabel(e.due)}까지 · {p.done}/{p.all} 완료</p>
          {seriesById(s, e.seriesId) && <p className="series">반복 · {ruleLabel(seriesById(s, e.seriesId)!.rule)}{seriesById(s, e.seriesId)!.stopped ? ' · 멈춤' : ' · 이번 회차'}
            {e.by === s.me && !seriesById(s, e.seriesId)!.stopped && <button className="textbtn" onClick={() => setS(stopSeries(s, e.seriesId!))}>반복 멈추기</button>}</p>}
          <Bar done={p.done} all={p.all} />
        </div>
        <button className="textbtn x" onClick={onClose}>닫기</button>
      </div>

      <section>
        <h4>체크리스트</h4>
        <ul className="checks gchecks">
          {e.items.map(i => (
            <li key={i.id}>
              <label className={canCheck(i.owner) ? '' : 'locked'}>
                <input type="checkbox" checked={!!i.doneBy} disabled={!canCheck(i.owner)} onChange={() => setS(toggleItem(s, e.id, i.id))} />
                <span><span className="tt">{i.text}</span>
                  <small>
                    {i.owner ? `담당 ${nameOf(s, i.owner)}` : '담당 없음 · 누구나'}
                    {i.doneBy && ` · ${nameOf(s, i.doneBy)} ${i.doneOn?.slice(5).replace('-', '.')} 완료`}
                  </small>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <div className="additem">
          <input value={itemText} placeholder="항목 더하기" onChange={x => setItemText(x.target.value)} aria-label="항목" />
          <select value={owner} onChange={x => setOwner(x.target.value)} aria-label="담당">
            <option value="">누구나</option>
            {g.members.map(m => <option key={m} value={m}>{nameOf(s, m)}</option>)}
          </select>
          <button className="ghost" disabled={!itemText.trim()} onClick={() => { setS(addItem(s, e.id, itemText.trim(), owner || undefined)); setItemText(''); }}>더하기</button>
        </div>
      </section>

      <section>
        <h4>댓글 {comments.length || ''}</h4>
        <ul className="hist">
          {comments.map(c => (
            <li key={c.id}><span className="hd">{nameOf(s, c.by)} · {ago(c.at)}</span><span>{c.text}</span></li>
          ))}
        </ul>
        <div className="additem">
          <input value={comment} placeholder="댓글 남기기  예) 자료 첨부했습니다" onChange={x => setComment(x.target.value)}
            onKeyDown={x => { if (x.key === 'Enter' && !x.nativeEvent.isComposing && comment.trim()) { setS(addComment(s, e.id, comment.trim())); setComment(''); } }} aria-label="댓글" />
          <button className="ghost" disabled={!comment.trim()} onClick={() => { setS(addComment(s, e.id, comment.trim())); setComment(''); }}>남기기</button>
        </div>
      </section>
    </aside>
  );
}
