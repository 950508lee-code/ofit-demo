import {addDays, cycleOf, monthDay, ruleLabel} from '../schedule';
import {
  isOurHandover, deptName, deptOf, deptPath, doneForMe, dutiesOfUnit, holdsOf, meOf, myDispatches, nameOf,
  addRef, linkRef, otherRefs, recordsOfUnit, refUse, refsOfUnit, sentDispatches, stepsOf, today, unlinkRef, type State,
} from '../store';
import {itemsInRange, type Row} from '../days';
import type {Duty} from '../model';
import {RowButton, type Ctx} from './common';
import {DutyAddForm, pendingDuties} from './Standard';
import {placeColor} from './placeColor';
import {useState, type CSSProperties} from 'react';


const CYCLES = ['매일', '매주', '매월', '분기', '매년'] as const;

/**
 * 업무 하나를 이루는 조각들. 같은 데이터를 두 화면이 나눠 쓴다(2026-10-26 사용자 판정: 화면은 분리, 데이터는 통합).
 * 내 업무(Work.tsx): 반복업무 줄 · 달마다 몰리는 때 · 받은 요청 · 지난 기록 · 업무 표준(반복업무 더하기)
 * 업무지식(Know.tsx): 업무 안내 · 처리 순서 · 참고자료 · 업무 표준 · 지난 기록으로 가는 줄 · 거쳐 간 사람
 */

/** 반복업무 줄 — 주기별로 묶고, 다음에 올 날을 오른쪽에. 누르면 오른쪽 판(처리 순서·완료). */
export function DutyRows({s, open, setOpen, unitId}: Pick<Ctx, 's' | 'open' | 'setOpen'> & {unitId: string}) {
  const duties = dutiesOfUnit(s, unitId);
  const ahead = itemsInRange(s, today(), addDays(today(), 120));
  return <>
    {CYCLES.filter(c => duties.some(d => cycleOf(d.rule) === c)).map(c => (
      <div key={c} className="day">
        <h3 className="dept">{c} <span>{duties.filter(d => cycleOf(d.rule) === c).length}</span></h3>
        {duties.filter(d => cycleOf(d.rule) === c).map(d => {
          const st = stepsOf(s, d).length;
          const when = [c === '매일' ? '' : ruleLabel(d.rule), st ? `순서 ${st}단계` : ''].filter(Boolean).join(' · ');
          const nx = c !== '매일' ? nextOf(ahead, d.id) : undefined;
          const r: Row = {kind: c === '매일' ? 'daily' : 'duty', id: d.id, date: nx ?? today(), title: d.title, done: false, when};
          return <div key={d.id}><RowButton s={s} r={r} open={open} setOpen={setOpen} right={nx ? monthDay(nx) : c === '매일' ? '매일' : ''} /></div>;
        })}
      </div>
    ))}
  </>;
}

/** '매주 금요일' → '금요일'. 주기 칸에 이미 '매주'가 있으니 줄에는 나머지만(한 화면에 같은 정보는 한 번). */
const ruleDetail = (rule: Duty['rule']) => {
  const c = cycleOf(rule), t = ruleLabel(rule);
  return t.startsWith(c) ? t.slice(c.length).trim() : t;
};

/**
 * 업무지식 반복업무 목록(C안, 2026-10-26 사용자 판정) — 왼쪽 칸에 주기를 묶음 첫 줄에만, 줄은 이름(굵게) · 주기 상세(회색).
 * 날짜·다음 일정은 두지 않는다(맡은 사람·안 맡은 사람 모두 같은 문서, 날짜는 오늘·달력·내 업무에서). 주기 묶음 순서는 고정.
 * 승인을 기다리는 반복업무도 그 묶음에 '검토 중'으로. 줄을 누르면 그 반복업무 문서(처리방법의 원본)로 간다.
 */
export function DutyIndex({s, setS, toast, unitId, onPick}: Pick<Ctx, 's' | 'setS' | 'toast'> & {unitId: string; onPick: (dutyId: string) => void}) {
  const duties = dutiesOfUnit(s, unitId);
  const pend = pendingDuties(s, unitId);
  const [adding, setAdding] = useState(false);
  type Item = {key: string; title: string; rule: Duty['rule']; id?: string};
  const items: Item[] = [...duties.map(d => ({key: d.id, title: d.title, rule: d.rule, id: d.id})), ...pend.map(d => ({key: d.key, title: d.title, rule: d.rule}))];
  return (
    <div className="day dix" data-spot="duties">
      <div className="sec-h">
        <h3 className="dept">반복업무 <span>{duties.length}</span></h3>
        {!adding && <button className="textbtn" onClick={() => setAdding(true)}>+ 추가</button>}
      </div>
      {adding && <DutyAddForm s={s} setS={setS} toast={toast} unitId={unitId} onClose={() => setAdding(false)} />}
      {items.length === 0 && !adding && <p className="none">반복업무가 없습니다</p>}
      {CYCLES.map(c => {
        const g = items.filter(x => cycleOf(x.rule) === c);
        if (!g.length) return null;
        return (
          <div key={c} className="dix-g" role="group" aria-label={c}>
            <span className="dix-c" aria-hidden="true">{c}</span>
            <div className="dix-rows">
              {g.map(x => x.id ? (
                <button key={x.key} className="dix-r" onClick={() => onPick(x.id!)}>
                  <span className="dix-n">{x.title}</span>
                  {ruleDetail(x.rule) && <span className="dix-d">{ruleDetail(x.rule)}</span>}
                </button>
              ) : (
                <div key={x.key} className="dix-r wait">
                  <span className="dix-n">{x.title}</span>
                  <span className="dix-d">{[ruleDetail(x.rule), '검토 중'].filter(Boolean).join(' · ')}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 업무 문서(색인)의 반복업무 순서 — 주기 묶음 고정 순서. 반복업무 문서의 '이전 · 다음'도 이 순서를 따른다. */
export const dutiesInIndexOrder = (s: State, unitId: string) =>
  CYCLES.flatMap(c => dutiesOfUnit(s, unitId).filter(d => cycleOf(d.rule) === c));

/** 내 업무에서 펼친 업무의 반복업무 머리 — 제목 옆 '+ 추가'와 검토 중인 것. 줄은 DutyRows(다음 날짜가 있는 실행 목록). */
export function DutyHead({s, setS, toast, unitId}: Pick<Ctx, 's' | 'setS' | 'toast'> & {unitId: string}) {
  const [adding, setAdding] = useState(false);
  const pend = pendingDuties(s, unitId);
  return (
    <div className="day dhd">
      <div className="sec-h">
        <h3 className="dept">반복업무 <span>{dutiesOfUnit(s, unitId).length}</span></h3>
        {!adding && <button className="textbtn" onClick={() => setAdding(true)}>+ 추가</button>}
      </div>
      {adding && <DutyAddForm s={s} setS={setS} toast={toast} unitId={unitId} onClose={() => setAdding(false)} />}
      {pend.map(d => <p key={d.key} className="dix-wait"><b>{d.title}</b> {ruleLabel(d.rule)} · 검토 중</p>)}
    </div>
  );
}

/** 이 업무 담당이라 받은 요청. 없으면 칸을 두지 않는다. */
export function Asks({s, open, setOpen, unitId}: Pick<Ctx, 's' | 'open' | 'setOpen'> & {unitId: string}) {
  const asks = myDispatches(s).filter(d => d.unitId === unitId);
  if (!asks.length) return null;
  return (
    <div className="day">
      <h3 className="dept">받은 요청 <span>{asks.length}</span></h3>
      {asks.map(d => (
        <RowButton key={d.id} s={s} open={open} setOpen={setOpen} right={doneForMe(s, d) ? '완료' : `${monthDay(d.due)}까지`}
          r={{kind: 'drecv', id: d.id, date: d.due, title: d.title, done: !!doneForMe(s, d), place: deptName(s, d.fromDept), at: {kind: 'dept', id: d.fromDept}}} />
      ))}
    </div>
  );
}

/** 지난 기록 — 같은 부서에서 이 업무를 끝내며 한 줄이라도 남긴 것(다음 사람에게 쓸모 있는 것). */
export const notedOf = (s: State, unitId: string) =>
  recordsOfUnit(s, unitId).filter(r => r.note.trim()).sort((a, b) => b.date.localeCompare(a.date));

export function Records({s, unitId, limit = 8, head = true}: {s: State; unitId: string; limit?: number; head?: boolean}) {
  const noted = notedOf(s, unitId);
  return (
    <div className="day recs">
      {head && <h3 className="dept">지난 기록 <span>{noted.length}</span></h3>}
      {noted.length === 0 && <p className="none">남긴 기록이 없습니다</p>}
      {noted.slice(0, limit).map(r => (
        <div key={r.dutyId + r.date + r.by} className="rec">
          <span className="rd">{r.date.slice(2).replace(/-/g, '.')} · {nameOf(s, r.by)}{!r.deptId && ' · 부서 확인 안 됨'}</span>
          <span className="rt">{s.duties.find(d => d.id === r.dutyId)?.title}</span>
          {r.note && <span className="rn">{r.note}</span>}
        </div>
      ))}
    </div>
  );
}

/** 이 자리에 있었던 사람 — 같은 부서에서: 지금 맡은 사람(맡은 날부터) + 넘겨주고 떠난 사람(넘긴 날까지). */
export function Tenure({s, unitId, head = true}: {s: State; unitId: string; head?: boolean}) {
  const me = meOf(s)!;
  const now = s.people.filter(p => p.deptId === me.deptId && holdsOf(s, p.id).includes(unitId))
    .map(p => ({pid: p.id, until: '', text: s.since[`${p.id}:${unitId}`] ? `${s.since[`${p.id}:${unitId}`].slice(0, 7).replace('-', '.')}부터 지금` : '지금'}));
  // 넘기고 떠난 사람: 그 인수인계가 우리 부서 자리에서 일어났으면(떠난 사람이 지금 어느 부서인지는 보지 않는다)
  const left = s.handovers.filter(h => h.state === 'accepted' && h.unitIds.includes(unitId) && isOurHandover(s, h))
    .map(h => ({pid: h.from, until: h.date, text: `${h.date.slice(0, 7).replace('-', '.')}까지`}));
  return (
    <div className={head ? 'day' : ''}>
      {head && <h3 className="dept">이 자리에 있었던 사람</h3>}
      {now.length + left.length > 0 && (
        <div className="tenure" role="list">
          {[...left.slice().sort((a, b) => a.until.localeCompare(b.until)), ...now].map((x, i) => (
            <div key={x.pid + i} className={`seg${x.until ? '' : ' now'}`} role="listitem">
              <b>{nameOf(s, x.pid)}</b>
              <i aria-hidden="true" />
              <span>{x.text}</span>
            </div>
          ))}
        </div>
      )}
      {now.length + left.length === 0 && <p className="none">{deptName(s, me.deptId)}에서 이 업무를 맡은 사람이 없습니다</p>}
    </div>
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
 * 참고자료 — 지침·서식·시스템 주소. 파일은 올리지 않고 어디 있는지(공유 폴더 경로·문서번호)만 적는다.
 * 읽는 상태: 제목 옆 '+ 추가'와 '편집'(자료가 있을 때)만, 줄에는 단추 없음.
 * '+ 추가': 그 자리 짧은 칸(폰에서도 전체 화면으로 바꾸지 않는다). 새로 적거나, 조직에 이미 등록된 자료를 고른다.
 * '편집': 줄마다 '삭제'가 나오고 [취소] [저장]으로 끝낸다 — 삭제는 편집 상태 안에서만(2026-10-26 사용자 확정).
 */
export function Refs({s, setS, toast, unitId, mine, note}: Pick<Ctx, 's' | 'setS' | 'toast'> & {unitId: string; mine: boolean; note?: string}) {
  const list = refsOfUnit(s, unitId), others = otherRefs(s, unitId);
  const [mode, setMode] = useState<'' | 'add' | 'edit'>('');
  const [src, setSrc] = useState<'new' | 'pick'>('new');
  const [kind, setKind] = useState<'link' | 'file'>('file');
  const [title, setTitle] = useState(''), [where, setWhere] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [gone, setGone] = useState<string[]>([]);
  const close = () => { setMode(''); setSrc('new'); setTitle(''); setWhere(''); setPicked([]); setGone([]); };
  const okNew = !!title.trim() && !!where.trim();
  const ok = src === 'new' ? okNew : picked.length > 0;
  const saveAdd = () => {
    let n = s;
    if (src === 'new') n = addRef(n, unitId, {kind, title: title.trim(), where: where.trim()});
    else for (const id of picked) n = linkRef(n, unitId, id);
    setS(n); toast('저장했습니다'); close();
  };
  const saveEdit = () => {
    let n = s;
    for (const id of gone) n = unlinkRef(n, unitId, id);
    setS(n); toast(gone.length ? '저장했습니다. 이 업무에서만 빠졌습니다' : '저장했습니다', gone.length ? s : undefined); close();
  };
  return (
    <div className="day refs">
      <div className="sec-h">
        <h3 className="dept">참고자료 <span>{list.length}</span></h3>
        {mine && !mode && (
          <span className="ref-acts">
            <button className="textbtn" onClick={() => setMode('add')}>+ 추가</button>
            {list.length > 0 && <button className="textbtn" onClick={() => setMode('edit')}>편집</button>}
          </span>
        )}
      </div>
      {note && list.length > 0 && <p className="kind">{note}</p>}
      {list.length === 0 && mode !== 'add' && <p className="none">붙은 자료가 없습니다</p>}
      {list.filter(r => !gone.includes(r.id)).map(r => (
        <div key={r.id} className="ref">
          <span className="rk">{r.kind === 'link' ? '링크' : '파일'}</span>
          <span className="rb">
            {r.kind === 'link' ? <a href={r.where} target="_blank" rel="noreferrer">{r.title}</a> : <b>{r.title}</b>}
            <small><span>{r.where}</span>{refUse(s, r.id) > 1 && <span>업무 {refUse(s, r.id)}개에서 사용</span>}</small>
          </span>
          {mode === 'edit' && <button className="textbtn" onClick={() => setGone(g => [...g, r.id])} aria-label={`${r.title} 삭제`}>삭제</button>}
        </div>
      ))}
      {mode === 'edit' && (
        <div className="er-act">
          {gone.length > 0 && <span className="er-foot">{gone.length}개 삭제 · 다른 업무에 붙은 자료는 그대로입니다</span>}
          <button className="ghost" onClick={close}>취소</button>
          <button className="primary sm" onClick={saveEdit}>저장</button>
        </div>
      )}
      {mode === 'add' && (
        <div className="editor">
          {others.length > 0 && (
            <div className="seg2" role="radiogroup" aria-label="자료">
              <button role="radio" aria-checked={src === 'new'} className={src === 'new' ? 'on' : ''} onClick={() => setSrc('new')}>새로 적기</button>
              <button role="radio" aria-checked={src === 'pick'} className={src === 'pick' ? 'on' : ''} onClick={() => setSrc('pick')}>등록된 자료 {others.length}</button>
            </div>
          )}
          {src === 'pick' ? others.map(r => (
            <label key={r.id} className="ref pick">
              <input type="checkbox" checked={picked.includes(r.id)} onChange={() => setPicked(p => (p.includes(r.id) ? p.filter(x => x !== r.id) : [...p, r.id]))} />
              <span className="rk">{r.kind === 'link' ? '링크' : '파일'}</span>
              <span className="rb"><b>{r.title}</b><small>{r.where}</small></span>
            </label>
          )) : <>
            <div className="seg2" role="radiogroup" aria-label="종류">
              <button role="radio" aria-checked={kind === 'file'} className={kind === 'file' ? 'on' : ''} onClick={() => setKind('file')}>파일</button>
              <button role="radio" aria-checked={kind === 'link'} className={kind === 'link' ? 'on' : ''} onClick={() => setKind('link')}>링크</button>
            </div>
            <label className="fld"><span>이름</span><input value={title} onChange={e => setTitle(e.target.value)} placeholder={kind === 'file' ? '예) 예산집행 지침' : '예) 회계 시스템'} /></label>
            <label className="fld"><span>{kind === 'file' ? '있는 곳' : '주소'}</span><input value={where} onChange={e => setWhere(e.target.value)} placeholder={kind === 'file' ? '예) 공유폴더 > 경영지원 > 지침' : '예) https://…'} /></label>
          </>}
          <div className="er-act">
            <button className="ghost" onClick={close}>취소</button>
            <button className="primary sm" disabled={!ok} onClick={saveAdd}>저장</button>
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
