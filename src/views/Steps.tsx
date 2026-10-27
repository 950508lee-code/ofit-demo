import {useState} from 'react';
import {EditFrame} from './EditFrame';
import type {Duty, Step, StepChange} from '../model';
import {canEditCommon, deptName, josa, editCommonSteps, meOf, nameOf, stepIdOf, stepsOf, waysOf, wayStale, type State} from '../store';

const md = (iso: string) => `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일`;
const hm = (iso: string) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const sig = (st: Step) => `${st.warn ? '!' : ''}${st.text}`;

/** 판 하나 — 처음 등록 자료(첫 편집의 '전') 또는 편집마다 남은 '후'. */
type Ver = {key: string; steps: Step[]; at?: string; by?: string; restored?: string; ch?: StepChange};
const versionsOf = (hist: StepChange[]): Ver[] =>
  hist.length ? [{key: 'first', steps: hist[0].before}, ...hist.map(c => ({key: c.at, steps: c.after, at: c.at, by: c.by, restored: c.restored, ch: c}))] : [];

/**
 * 처리방법 한 묶음 — 조직이 함께 쓰는 하나의 문서(2026-10-26 사용자 판정, docs/COEDIT.md).
 * 누구나 '편집' → 저장하면 바로 모두에게(승인 없음, 일정은 그대로) · 편집마다 판이 남고 '변경 기록'에서 판을 열어 지금과 비교하고 복원한다(복원도 새 판).
 * 직원이 함께 쓰는 내용이라 공식 기준처럼 보이지 않게 한다 — 공식 판단의 근거는 '관련 근거'로 따로(DutyDoc·할 일 상세).
 * 예전에 쓴 부서 운영 방식은 지우지 않고 읽기로만 보인다(새로 쓰지 않음, 자동으로 합치지 않음).
 * check 를 주면 할 일 상세 판처럼 단계에 체크칸을 달고, 편집 단추·출처 줄은 두지 않는다(같은 원본에서 지금 할 일에 필요한 것만).
 */
export function StepsBlock({s, setS, toast, duty, check, spot, head, onHistory}: {
  s: State; setS: (s: State) => void; toast: (m: string, undo?: State) => void; duty: Duty;
  check?: {checks: boolean[]; done: boolean; onToggle: (i: number) => void}; spot?: boolean;
  head?: string; // 주면 묶음 제목을 그리고 '편집'을 제목 옆에 둔다(편집은 내용 옆에)
  onHistory?: () => void; // 주면 '변경 기록'을 그 자리에서 펼치지 않고 별도 화면으로(비교·복원은 문서 한가운데서 하지 않는다, docs/IA.md)
}) {
  const [mode, setMode] = useState<'' | 'edit' | 'hist'>('');
  const steps = stepsOf(s, duty);
  const dep = meOf(s)?.deptId;
  const ways = waysOf(s, dep, duty.id);
  const hist = s.stepHistory[duty.id] ?? [];
  const last = hist[hist.length - 1];
  const dname = deptName(s, dep);
  const may = canEditCommon(s, duty) && !check;
  const gone = (k: string) => k !== '_end' && !steps.some((st, i) => stepIdOf(duty, st, i) === k);
  const wayLine = (k: string) => {
    const w = ways[k];
    if (!w) return null;
    return (
      <p className="way old">
        <span className="wk">{dname} 운영 방식 · 이전 기록</span>
        {w.text.split('\n').map((t, i) => <span key={i} className="wt">{t}</span>)}
        {wayStale(s, duty, k, w) && <span className="wx"><small>{gone(k) ? `연결된 단계가 없어짐 · 쓸 때 단계 ${w.base}` : `쓸 때 단계 · ${w.base}`}</small></span>}
      </p>
    );
  };

  if (mode === 'edit') return <StepsEditor title={`${duty.title} · 처리방법`} steps={steps} onCancel={() => setMode('')}
    onSave={st => {
      const cut = steps.length - st.length;
      if (cut > 0 && !confirm(`${cut}개 줄을 삭제합니다. 저장할까요?\n삭제한 내용은 변경 기록의 이전 판에 남습니다.`)) return;
      const n = editCommonSteps(s, duty.id, st);
      setMode('');
      if (n !== s) { setS(n); toast('저장했습니다. 모두에게 바로 보입니다', s); }
    }} />;

  const acts = may ? <span className="sb-acts"><button className="textbtn" onClick={() => setMode('edit')}>편집</button></span> : null;
  // 공동 편집한 내용이 공단의 공식 기준처럼 보이지 않게(2026-10-26 사용자): 문서에서 처리방법 바로 아래 한 줄
  const kind = head && !check ? <p className="kind sb-kind">직원이 함께 쓰는 처리방법입니다. {duty.basis ? '공식 기준은 아래 관련 근거를 따릅니다' : '공식 기준이 아닙니다'}</p> : null;

  if (!steps.length && !Object.keys(ways).length) return (
    <div className={`stepsb sb-empty${head ? ' headed' : ''}`}>
      {head && <div className="sec-h"><h3 className="dept">{head}</h3>{acts}</div>}
      <p className="plain">{check ? '적힌 처리방법이 없습니다' : may ? '적힌 처리방법이 없습니다. 이 일을 할 때의 순서를 적어 두면 다음 사람도 봅니다' : '적힌 처리방법이 없습니다'}</p>
      {!head && acts}
      {!check && hist.length > 0 && <Foot s={s} hist={hist} last={last} mode={mode} setMode={setMode} onHistory={onHistory} />}
      {mode === 'hist' && <History s={s} setS={setS} toast={toast} duty={duty} hist={hist} steps={steps} may={may} />}
    </div>
  );

  let n = 0;
  return (
    <div className="stepsb">
      {head && <div className="sec-h"><h3 className="dept">{head}</h3>{acts}</div>}
      {kind}
      {steps.length === 0 && <p className="plain">적힌 처리방법이 없습니다</p>}
      {steps.length > 0 && (
        <ol className={check ? 'checks sb-list' : 'sb-list'}>
          {steps.map((st, i) => {
            const k = stepIdOf(duty, st, i);
            if (st.warn) return <li key={k} className="warn" data-spot={spot ? `step:${duty.id}:${i}` : undefined}><span className="wl">주의</span><span>{st.text}</span></li>;
            const no = ++n;
            return (
              <li key={k} data-spot={spot ? `step:${duty.id}:${i}` : undefined}>
                {check ? (
                  <label>
                    <input type="checkbox" checked={check.checks[i] ?? false} disabled={check.done} onChange={() => check.onToggle(i)} />
                    <span><span className="tt">{st.text}</span>{st.form && <small>서식 · {st.form}</small>}</span>
                  </label>
                ) : (
                  <><span className="n">{no}</span><span>{st.text}{st.form && <small>서식 · {st.form}</small>}</span></>
                )}
                {wayLine(k)}
              </li>
            );
          })}
        </ol>
      )}
      {/* 지금 처리방법에 없는 단계에 붙어 있던 이전 부서 기록도 지우지 않고 보인다 */}
      {Object.keys(ways).filter(k => k !== '_end' && gone(k)).map(k => <div key={k}>{wayLine(k)}</div>)}
      {wayLine('_end')}
      {!check && <Foot s={s} hist={hist} last={last} mode={mode} setMode={setMode} acts={head ? null : acts} onHistory={onHistory} />}
      {mode === 'hist' && <History s={s} setS={setS} toast={toast} duty={duty} hist={hist} steps={steps} may={may} />}
    </div>
  );
}

/** 문서 아래 한 줄 — 마지막 편집(관리 정보는 본문과 떨어뜨린다) · 변경 기록. */
function Foot({s, hist, last, mode, setMode, acts, onHistory}: {s: State; hist: StepChange[]; last?: StepChange; mode: string; setMode: (m: '' | 'hist') => void; acts?: React.ReactNode; onHistory?: () => void}) {
  return (
    <div className="sb-h sb-foot">
      <span className="sb-src">
        {last ? `마지막 편집 ${md(last.at)} · ${nameOf(s, last.by)}` : '처음 등록 자료'}
        {hist.length > 0 && (onHistory
          ? <button className="textbtn" onClick={onHistory}>변경 기록 {hist.length}</button>
          : <button className="textbtn" aria-expanded={mode === 'hist'} onClick={() => setMode(mode === 'hist' ? '' : 'hist')}>변경 기록 {hist.length}</button>)}
      </span>
      {acts}
    </div>
  );
}

/**
 * 변경 기록 — 판 목록(새것부터) → 판을 열면 그 판의 내용과 지금과의 차이(글자로 표시, 색만으로 구분하지 않음) → 그 화면에서만 '이 판으로 복원'.
 * 복원은 지우기가 아니라 새 편집 하나(복원한 것도 기록에 남고, 알림 띄움의 '되돌리기'와 다시 복원으로 되돌릴 수 있다).
 */
export function History({s, setS, toast, duty, hist, steps, may}: {
  s: State; setS: (s: State) => void; toast: (m: string, undo?: State) => void; duty: Duty; hist: StepChange[]; steps: Step[]; may: boolean;
}) {
  const vers = versionsOf(hist);
  const [sel, setSel] = useState<string | null>(null);
  const name = (v: Ver) => (v.key === 'first' ? '처음 등록 자료' : `${md(v.at!)} ${hm(v.at!)} · ${nameOf(s, v.by)}`);
  const restoredName = (key: string) => { const v = vers.find(x => x.key === key); return v ? (v.key === 'first' ? '처음 등록 자료' : `${md(v.at!)} ${hm(v.at!)} 판`) : '이전 판'; };
  const now = steps.map(sig);
  const cur = vers.find(v => v.key === sel);

  if (cur) {
    const was = cur.steps.map(sig);
    const later = steps.filter(st => !was.includes(sig(st)));
    const same = was.length === now.length && was.every((x, i) => x === now[i]);
    let n = 0;
    return (
      <div className="sb-ver">
        <p className="sb-ver-h"><b>{name(cur)}</b>{cur.key === vers[vers.length - 1].key && <span className="dtag">지금 판</span>}</p>
        <ol className="sb-list">
          {cur.steps.map((st, i) => (
            <li key={i} className={st.warn ? 'warn' : ''}>
              {st.warn ? <span className="wl">주의</span> : <span className="n">{++n}</span>}
              <span>{st.text}{!now.includes(sig(st)) && <span className="dtag">지금은 없음</span>}</span>
            </li>
          ))}
          {cur.steps.length === 0 && <li><span>적힌 처리방법이 없었습니다</span></li>}
        </ol>
        {!same && later.length > 0 && (
          <div className="sb-later">
            <p>이 판 뒤에 새로 쓴 것</p>
            <ul>{later.map((st, i) => <li key={i}>{st.warn ? '주의 · ' : ''}{st.text}</li>)}</ul>
          </div>
        )}
        {same && cur.key !== vers[vers.length - 1].key && <p className="none">지금 내용과 같습니다</p>}
        <div className="er-act">
          <button className="textbtn" onClick={() => setSel(null)}>변경 기록 목록</button>
          {may && !same && (
            <button className="ghost" onClick={() => {
              if (!confirm(`${name(cur)} 판으로 복원할까요?\n지금 내용은 변경 기록에 남습니다.`)) return;
              setS(editCommonSteps(s, duty.id, cur.steps, cur.key));
              setSel(null);
              toast('복원했습니다. 변경 기록에 남았습니다', s);
            }}>이 판으로 복원</button>
          )}
        </div>
      </div>
    );
  }

  return (
    <ul className="sb-hist">
      {vers.slice().reverse().map((v, i) => {
        const c = v.ch;
        const was = c ? c.before.map(sig) : [], aft = c ? c.after.map(sig) : [];
        const add = aft.filter(x => !was.includes(x)).length, cut = was.filter(x => !aft.includes(x)).length;
        return (
          <li key={v.key}>
            <span className="hv">
              <b>{name(v)}</b>
              {i === 0 && <span className="dtag">지금 판</span>}
              <small>{v.key === 'first' ? '편집하기 전 내용' : v.restored ? `복원 · ${restoredName(v.restored)}${josa(restoredName(v.restored), '으로', '로')}` : [add && `새로 쓴 줄 ${add}`, cut && `삭제한 줄 ${cut}`].filter(Boolean).join(' · ') || '순서만 바꿈'}</small>
            </span>
            <button className="textbtn" onClick={() => setSel(v.key)}>보기</button>
          </li>
        );
      })}
    </ul>
  );
}

// 처리방법 편집(누구나). 작성 기준은 입력칸 밖에 늘 보인다(칸 안 안내는 입력하면 사라져서 쓰지 않는다, docs/WRITING.md).
// 주의는 관련 단계 바로 아래에 끼워 넣는다. 단계 수와 주의 개수는 제한하지 않는다. 단계 id는 그대로 넘겨 남아 있는 이전 부서 기록이 붙어 있게 한다.
function StepsEditor({title, steps, onSave, onCancel}: {title: string; steps: Step[]; onSave: (s: Step[]) => void; onCancel: () => void}) {
  const [list, setList] = useState<Step[]>(steps.length ? steps : [{text: ''}]);
  // '주의 추가'는 단계마다 늘 두지 않고 지금 고른(쓰고 있는) 단계에만(2026-10-26 사용자 판정: 주의는 필요한 단계에서만)
  const [cur, setCur] = useState(-1);
  const set = (i: number, text: string) => setList(l => l.map((x, j) => (j === i ? {...x, text} : x)));
  const warnAfter = (i: number) => setList(l => [...l.slice(0, i + 1), {text: '', warn: true}, ...l.slice(i + 1)]);
  let n = 0;
  return (
    <EditFrame title={title} onCancel={onCancel} onSave={() => onSave(list.filter(x => x.text.trim()))}>
      <p className="eh">저장하면 바로 모두에게 보입니다. 일정은 바뀌지 않고, 이전 판은 변경 기록에 남습니다.</p>
      <p className="eh">한 단계에 한 가지 작업을 적으세요. 사용하는 시스템과 수행할 행동을 구체적으로 적으면 좋습니다.</p>
      {list.some(x => x.warn) && <p className="eh">주의: 실수하기 쉬운 상황이나 예외사항을 적으세요.</p>}
      {list.map((st, i) => {
        const no = st.warn ? 0 : ++n;
        return (
          <div key={i} className={`er${st.warn ? ' w' : ''}${cur === i ? ' cur' : ''}`} onFocus={() => setCur(i)}>
            <span className="n">{st.warn ? '주의' : no}</span>
            <input value={st.text} onChange={e => set(i, e.target.value)} aria-label={st.warn ? '주의' : `${no}번째 단계`} />
            {!st.warn && cur === i && <button className="textbtn" onClick={() => { warnAfter(i); setCur(i + 1); }}>주의 추가</button>}
            <button className="textbtn" onClick={() => { setList(l => l.filter((_, j) => j !== i)); setCur(-1); }} aria-label={`${st.warn ? '주의' : `${no}번째 단계`} 삭제`}>삭제</button>
          </div>
        );
      })}
      <button className="textbtn add" onClick={() => { setList(l => [...l, {text: ''}]); setCur(list.length); }}>+ 단계 추가</button>
    </EditFrame>
  );
}
