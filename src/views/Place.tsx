import {addDays, cycleOf, monthDay, occurrences, ruleLabel, ymd} from '../schedule';
import {
  cancelHandover, deptName, deptOf, deptPath, doneForMe, dutiesOfUnit, holdsOf, meOf, myDispatches, nameOf, nextDateOf, pendingOf,
  addRef, linkRef, otherRefs, recordsOfUnit, refUse, refsOfUnit, sentDispatches, stepsOf, today, unitById, unlinkRef, type State,
} from '../store';
import {itemsInRange, type Row} from '../days';
import type {Duty} from '../model';
import {RowButton, type Ctx} from './common';
import {Cells} from './shapes';
import {UnitStandard} from './Standard';
import {placeColor} from './placeColor';
import {useState, type CSSProperties} from 'react';


const CYCLES = ['매일', '매주', '매월', '분기', '매년'] as const;

/**
 * 업무 자리 화면 = 저절로 쌓이는 인수인계서.
 * 위에서부터(기존 시안의 업무 페이지 순서, 2026-10-26 사용자 판정): 개요 → 처리 순서 → 반복업무(박자·리듬별) → 참고자료
 * → 이 자리로 온 요청 → 업무 표준 → 지난 기록 → 거쳐 간 사람.
 */
export function UnitPlace({s, setS, open, setOpen, toast, id, onBack, onGive}: Ctx & {id: string; onBack: () => void; onGive: () => void}) {
  const u = unitById(s, id);
  if (!u) return null;
  const me = meOf(s)!;
  const duties = dutiesOfUnit(s, id);
  const ahead = itemsInRange(s, today(), addDays(today(), 120));
  const mine = holdsOf(s, s.me).includes(id);
  const pending = pendingOf(s, id);
  const next = mine ? nextDateOf(s, id) : undefined;
  const asks = myDispatches(s).filter(d => d.unitId === id);
  // 지난 기록은 한 줄이라도 남긴 것만 — 다음 사람에게 쓸모 있는 것
  const noted = recordsOfUnit(s, id).filter(r => r.note.trim());
  const recs = noted.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  // 같은 부서에서 이 자리에 앉았던 사람: 지금 맡은 사람(맡은 날부터) + 넘겨주고 떠난 사람(넘긴 날까지)
  const now = s.people.filter(p => p.deptId === me.deptId && holdsOf(s, p.id).includes(id))
    .map(p => ({pid: p.id, until: '', text: s.since[`${p.id}:${id}`] ? `${s.since[`${p.id}:${id}`].slice(0, 7).replace('-', '.')}부터 지금` : '지금'}));
  const left = s.handovers.filter(h => h.state === 'accepted' && h.unitIds.includes(id) && s.people.find(p => p.id === h.from)?.deptId === me.deptId)
    .map(h => ({pid: h.from, until: h.date, text: `${h.date.slice(0, 7).replace('-', '.')}까지`}));

  return (
    <section className="list place" style={{'--pc': placeColor(s, {kind: 'unit', id})} as CSSProperties}>
      <div className="flow-back"><button className="textbtn" onClick={onBack}>돌아가기</button></div>
      <div className="place-h">
        <div>
          <p className="over">업무 · {u.series}</p>
          <h2><span className="swatch" aria-hidden="true" />{u.name}</h2>
          <p className="sub">{deptName(s, me.deptId)} · 반복업무 {duties.length}개{next ? ` · 다음 ${monthDay(next)}` : ''}</p>
          <Cells n={duties.filter(d => stepsOf(s, d).length).length} of={duties.length} label="처리 순서 적은 일" />
        </div>
        {mine && (pending
          ? <button className="ghost" onClick={() => { setS(cancelHandover(s, pending.id)); toast('인수인계를 취소했습니다'); }}>{nameOf(s, pending.to)} 님에게 인수인계 중 · 취소</button>
          : <button className="ghost strong" onClick={onGive}>인수인계 하기</button>)}
      </div>

      <HowTo s={s} duties={duties} />

      <YearBeat duties={duties} />

      {CYCLES.filter(c => duties.some(d => cycleOf(d.rule) === c)).map(c => (
        <div key={c} className="day">
          <h3 className="dept">{c} <span>{duties.filter(d => cycleOf(d.rule) === c).length}</span></h3>
          {duties.filter(d => cycleOf(d.rule) === c).map(d => {
            const st = stepsOf(s, d).length;
            const when = [c === '매일' ? '' : ruleLabel(d.rule), st ? `순서 ${st}단계` : ''].filter(Boolean).join(' · ');
            const nx = mine && c !== '매일' ? nextOf(ahead, d.id) : undefined;
            const r: Row = {kind: c === '매일' ? 'daily' : 'duty', id: d.id, date: nx ?? '', title: d.title, done: false, when};
            return mine && nx
              ? <RowButton key={d.id} s={s} r={r} open={open} setOpen={setOpen} right={monthDay(nx)} />
              : <div key={d.id} className="row static"><span className="dot" /><span className="t">{d.title}{when && <span className="meta"><span className="when">{when}</span></span>}</span></div>;
          })}
        </div>
      ))}

      <Refs s={s} setS={setS} toast={toast} unitId={id} mine={mine} />

      {asks.length > 0 && (
        <div className="day">
          <h3 className="dept">{u.name} 담당이라 받은 요청 <span>{asks.length}</span></h3>
          {asks.map(d => (
            <RowButton key={d.id} s={s} open={open} setOpen={setOpen} right={doneForMe(s, d) ? '완료' : `${monthDay(d.due)}까지`}
              r={{kind: 'drecv', id: d.id, date: d.due, title: d.title, done: !!doneForMe(s, d), place: deptName(s, d.fromDept), at: {kind: 'dept', id: d.fromDept}}} />
          ))}
        </div>
      )}

      <UnitStandard s={s} setS={setS} toast={toast} unitId={id} />

      <div className="day">
        <h3 className="dept">지난 기록 <span>{noted.length}</span></h3>
        {recs.length === 0 && <p className="none">아직 남긴 기록이 없습니다. 완료할 때 한 줄 남기면 여기에 쌓입니다</p>}
        {recs.map(r => (
          <div key={r.dutyId + r.date + r.by} className="rec">
            <span className="rd">{r.date.slice(2).replace(/-/g, '.')} · {nameOf(s, r.by)}</span>
            <span className="rt">{s.duties.find(d => d.id === r.dutyId)?.title}</span>
            {r.note && <span className="rn">{r.note}</span>}
          </div>
        ))}
      </div>

      <div className="day">
        <h3 className="dept">이 자리에 있었던 사람</h3>
        {now.length + left.length > 0 && (
          <div className="tenure" role="list">
            {[...left.slice().sort((a, b) => a.until.localeCompare(b.until)), ...now].map((x, i) => (
              <div key={x.pid + i} className={`seg${'until' in x && x.until ? '' : ' now'}`} role="listitem">
                <b>{nameOf(s, x.pid)}</b>
                <i aria-hidden="true" />
                <span>{x.text}</span>
              </div>
            ))}
          </div>
        )}
        {now.length + left.length === 0 && <p className="none">{deptName(s, me.deptId)}에서 이 업무를 맡은 사람이 없습니다</p>}
      </div>

    </section>
  );
}

/** 부서 자리 화면 — 이 부서와 주고받은 요청. */
export function DeptPlace({s, open, setOpen, id, onBack}: Ctx & {id: string; onBack: () => void}) {
  const d = deptOf(s, id);
  if (!d) return null;
  const got = myDispatches(s).filter(x => x.fromDept === id);
  const sent = sentDispatches(s).filter(x => x.toDepts.includes(id));
  return (
    <section className="list place" style={{'--pc': placeColor(s, {kind: 'dept', id})} as CSSProperties}>
      <div className="flow-back"><button className="textbtn" onClick={onBack}>돌아가기</button></div>
      <div className="place-h">
        <div>
          <p className="over">부서</p>
          <h2><span className="swatch" aria-hidden="true" />{d.name}</h2>
          <p className="sub">{deptPath(s, id)}</p>
        </div>
      </div>
      <div className="day">
        <h3 className="dept">여기서 받은 요청 <span>{got.length}</span></h3>
        {got.length === 0 && <p className="none">받은 요청이 없습니다</p>}
        {got.map(x => {
          const unit = x.unitId ? s.units.find(u => u.id === x.unitId) : undefined;
          return (
            <RowButton key={x.id} s={s} open={open} setOpen={setOpen} right={doneForMe(s, x) ? '완료' : `${monthDay(x.due)}까지`}
              r={{kind: 'drecv', id: x.id, date: x.due, title: x.title, done: !!doneForMe(s, x), place: unit?.name, at: unit ? {kind: 'unit', id: unit.id} : undefined, when: unit ? '담당에게 온 요청' : '부서 전체에게 온 요청'}} />
          );
        })}
      </div>
      <div className="day">
        <h3 className="dept">여기로 보낸 요청 <span>{sent.length}</span></h3>
        {sent.length === 0 && <p className="none">보낸 요청이 없습니다</p>}
        {sent.map(x => (
          <RowButton key={x.id} s={s} open={open} setOpen={setOpen} right={`${monthDay(x.due)}까지`}
            r={{kind: 'drecv', id: x.id, date: x.due, title: x.title, done: false, when: '내가 보냄'}} />
        ))}
      </div>
    </section>
  );
}

/**
 * 처리 순서 — 반복업무마다 적힌 순서를 한곳에서 읽는다(주의 줄 포함). 고치기는 그 반복업무를 눌러 연 오른쪽 판에서 한다.
 * 순서가 없는 반복업무는 이름만 한 줄로 모은다.
 */
function HowTo({s, duties}: {s: State; duties: Duty[]}) {
  const has = duties.filter(d => stepsOf(s, d).length), none = duties.filter(d => !stepsOf(s, d).length);
  return (
    <div className="day howto">
      <h3 className="dept">처리 순서</h3>
      {has.length === 0 && <p className="none">적힌 순서가 없습니다</p>}
      {has.map(d => {
        let n = 0;
        return (
          <div key={d.id} className="ht">
            <h4>{d.title} <span>{ruleLabel(d.rule)}</span></h4>
            <ol>
              {stepsOf(s, d).map((st, i) => st.warn
                ? <li key={i} className="warn"><span className="wl">주의</span><span>{st.text}</span></li>
                : <li key={i}><span className="n">{++n}</span><span>{st.text}{st.form && <small>서식 · {st.form}</small>}</span></li>)}
            </ol>
            {d.basis && <p className="basis">근거 · {d.basis}</p>}
          </div>
        );
      })}
      {has.length > 0 && none.length > 0 && <p className="ht-none"><b>순서 없음</b>{none.map(d => d.title).join(', ')}</p>}
    </div>
  );
}

/**
 * 참고자료 — 지침·서식·시스템 주소. 파일은 올리지 않고 어디 있는지(공유 폴더 경로·문서번호)만 적는다.
 * 맡은 사람만 더하고 뗀다. 우리 조직에 이미 등록된 자료는 골라서 붙인다(같은 자료를 여러 업무가 쓴다).
 */
function Refs({s, setS, toast, unitId, mine}: Pick<Ctx, 's' | 'setS' | 'toast'> & {unitId: string; mine: boolean}) {
  const list = refsOfUnit(s, unitId), others = otherRefs(s, unitId);
  const [mode, setMode] = useState<'' | 'new' | 'pick'>('');
  const [kind, setKind] = useState<'link' | 'file'>('file');
  const [title, setTitle] = useState(''), [where, setWhere] = useState('');
  const close = () => { setMode(''); setTitle(''); setWhere(''); };
  const ok = title.trim() && where.trim();
  return (
    <div className="day refs">
      <div className="sec-h">
        <h3 className="dept">참고자료 <span>{list.length}</span></h3>
        {mine && !mode && (
          <span className="ref-acts">
            {others.length > 0 && <button className="textbtn" onClick={() => setMode('pick')}>등록된 자료에서 고르기</button>}
            <button className="textbtn" onClick={() => setMode('new')}>자료 더하기</button>
          </span>
        )}
      </div>
      {list.length === 0 && !mode && <p className="none">붙은 자료가 없습니다</p>}
      {list.map(r => (
        <div key={r.id} className="ref">
          <span className="rk">{r.kind === 'link' ? '링크' : '파일'}</span>
          <span className="rb">
            {r.kind === 'link' ? <a href={r.where} target="_blank" rel="noreferrer">{r.title}</a> : <b>{r.title}</b>}
            <small><span>{r.where}</span>{refUse(s, r.id) > 1 && <span>업무 {refUse(s, r.id)}개에서 사용</span>}</small>
          </span>
          {mine && <button className="textbtn" onClick={() => { setS(unlinkRef(s, unitId, r.id)); toast('이 업무에서 뗐습니다'); }}>떼기</button>}
        </div>
      ))}
      {mode === 'pick' && (
        <div className="editor">
          {others.map(r => (
            <button key={r.id} className="ref pick" onClick={() => { setS(linkRef(s, unitId, r.id)); toast('붙였습니다'); }}>
              <span className="rk">{r.kind === 'link' ? '링크' : '파일'}</span>
              <span className="rb"><b>{r.title}</b><small>{r.where}</small></span>
            </button>
          ))}
          <div className="er-act"><button className="ghost" onClick={close}>닫기</button></div>
        </div>
      )}
      {mode === 'new' && (
        <div className="editor">
          <div className="seg2" role="radiogroup" aria-label="종류">
            <button role="radio" aria-checked={kind === 'file'} className={kind === 'file' ? 'on' : ''} onClick={() => setKind('file')}>파일</button>
            <button role="radio" aria-checked={kind === 'link'} className={kind === 'link' ? 'on' : ''} onClick={() => setKind('link')}>링크</button>
          </div>
          <label className="fld"><span>이름</span><input value={title} onChange={e => setTitle(e.target.value)} placeholder={kind === 'file' ? '예) 예산집행 지침' : '예) 회계 시스템'} /></label>
          <label className="fld"><span>{kind === 'file' ? '있는 곳' : '주소'}</span><input value={where} onChange={e => setWhere(e.target.value)} placeholder={kind === 'file' ? '예) 공유폴더 > 경영지원 > 지침' : '예) https://…'} /></label>
          <div className="er-act">
            <button className="ghost" onClick={close}>취소</button>
            <button className="primary" disabled={!ok} onClick={() => { setS(addRef(s, unitId, {kind, title: title.trim(), where: where.trim()})); toast('붙였습니다'); close(); }}>붙이기</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** 이 반복업무가 내게 다음에 오는 날(오늘부터 넉 달 안, 아직 안 한 회차). */
function nextOf(m: Map<string, Row[]>, dutyId: string) {
  return [...m.keys()].sort().find(date => m.get(date)!.some(r => r.kind === 'duty' && r.id === dutyId && !r.done));
}

/**
 * 달마다 몰리는 때 — 1~12월 칸, 반복업무가 몰리는 달일수록 진하게(매일·매주는 모든 달 비슷해 뺀다).
 * 글자로 '매월 15일, 분기 시작월 말일…'을 읽지 않아도 바쁜 달이 보인다.
 */
function YearBeat({duties}: {duties: Duty[]}) {
  const y = new Date().getFullYear(), cur = new Date().getMonth();
  const counts = Array.from({length: 12}, (_, m) => {
    const from = ymd(new Date(y, m, 1)), to = ymd(new Date(y, m + 1, 0));
    // 매일·매주는 어느 달이나 비슷해 박자를 흐리므로 뺀다(매월·분기·매년만)
    return duties.filter(d => d.rule.kind !== 'daily' && d.rule.kind !== 'weekly').reduce((n, d) => n + occurrences(d.rule, from, to).length, 0);
  });
  const max = Math.max(...counts);
  if (!max) return null;
  const busy = counts.map((n, m) => (n === max ? m + 1 : 0)).filter(Boolean);
  return (
    <div className="beat">
      <div className="beat-h"><h3 className="dept">달마다 몰리는 때</h3><span>{busy.length === 12 ? '달마다 고름' : `${busy.join('·')}월에 몰림`}</span></div>
      <div className="beat-row" role="img" aria-label={counts.map((n, m) => `${m + 1}월 ${n}건`).join(', ')}>
        {counts.map((n, m) => (
          <div key={m} className={`bm${m === cur ? ' cur' : ''}`}>
            <i style={{opacity: n ? .18 + .82 * (n / max) : 1}} className={n ? '' : 'zero'} />
            <small>{m + 1}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
