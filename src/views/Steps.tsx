import {useState} from 'react';
import type {Duty, Step} from '../model';
import {
  canEditCommon, canEditWay, deptName, editCommonSteps, meOf, nameOf, saveDeptWays, stepIdOf, stepsOf, waysOf, wayStale, type State,
} from '../store';

const md = (iso: string) => `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일`;

/**
 * 처리 순서 한 묶음 — 공통 처리 순서(조직 기준) + 그 아래 우리 부서 운영 방식(다른 단계에만 한 줄).
 * 둘이 다를 때 무엇을 따를지는 정하지 않고 차이만 보인다(2026-10-26 사용자 판정).
 * 고치기: 담당자는 '우리 부서 방식'(바로 반영, 공통은 그대로) · 관리자는 '공통 순서 고치기'(변경 이력이 남는다).
 * check 를 주면 할 일 상세 판처럼 공통 단계에 체크칸을 단다.
 */
export function StepsBlock({s, setS, toast, duty, check, spot}: {
  s: State; setS: (s: State) => void; toast: (m: string) => void; duty: Duty;
  check?: {checks: boolean[]; done: boolean; onToggle: (i: number) => void}; spot?: boolean;
}) {
  const [mode, setMode] = useState<'' | 'way' | 'common' | 'hist'>('');
  const steps = stepsOf(s, duty);
  const dep = meOf(s)?.deptId;
  const ways = waysOf(s, dep, duty.id);
  const hist = s.stepHistory[duty.id] ?? [];
  const last = hist[hist.length - 1];
  const dname = deptName(s, dep);
  const mayWay = canEditWay(s, duty), mayCommon = canEditCommon(s, duty);
  // 공통에서 단계가 빠졌는가(글만 바뀐 것과 구분해 보인다). 부서 방식과 이력은 지우지 않는다
  const gone = (k: string) => k !== '_end' && !steps.some((st, i) => stepIdOf(duty, st, i) === k);
  const wayLine = (k: string) => {
    const w = ways[k];
    if (!w) return null;
    return (
      <p className={`way${wayStale(s, duty, k, w) ? ' stale' : ''}`}>
        <span className="wk">{dname} 운영 방식</span>
        {w.text.split('\n').map((t, i) => <span key={i} className="wt">{t}</span>)}
        {wayStale(s, duty, k, w) && <span className="wx">확인 필요 <small>{gone(k) ? `연결된 공통 단계가 없어짐 · 원래 단계 ${w.base}` : `공통 단계가 바뀜 · 쓸 때 ${w.base}`}</small></span>}
      </p>
    );
  };

  if (mode === 'way') return <WayEditor s={s} duty={duty} onCancel={() => setMode('')}
    onSave={t => { setS(saveDeptWays(s, duty.id, t)); setMode(''); toast(`저장했습니다. ${dname}에만 반영되고 공통 순서는 그대로입니다`); }} />;
  if (mode === 'common') return <StepsEditor steps={steps} onCancel={() => setMode('')}
    onSave={st => { setS(editCommonSteps(s, duty.id, st)); setMode(''); toast('공통 순서를 고쳤습니다. 바뀐 기록에 남습니다'); }} />;

  // 공통 순서도 우리 부서 방식도 없으면 한 줄로(빈 머리줄을 늘어놓지 않는다)
  if (!steps.length && !Object.keys(ways).length) return (
    <div className="stepsb sb-empty">
      <p className="plain">공통 처리 순서가 없습니다</p>
      <span className="sb-acts">
        {mayWay && <button className="textbtn" onClick={() => setMode('way')}>우리 부서 방식</button>}
        {mayCommon && <button className="textbtn" onClick={() => setMode('common')}>공통 순서 쓰기</button>}
      </span>
    </div>
  );

  let n = 0;
  return (
    <div className="stepsb">
      {steps.length === 0 && <p className="plain">공통 처리 순서가 없습니다</p>}
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
      {/* 공통에 없는 단계에 붙어 있던 운영 방식(공통에서 단계가 빠짐)도 지우지 않고 보인다 */}
      {Object.keys(ways).filter(k => k !== '_end' && !steps.some((st, i) => stepIdOf(duty, st, i) === k)).map(k => <div key={k}>{wayLine(k)}</div>)}
      {wayLine('_end')}
      <div className="sb-h sb-foot">
        <span className="sb-src">
          공통 처리 순서 · {last ? `${md(last.at)} ${nameOf(s, last.by)} 고침` : '기존 등록 자료'}
          {hist.length > 0 && <button className="textbtn" aria-expanded={mode === 'hist'} onClick={() => setMode(m => (m === 'hist' ? '' : 'hist'))}>바뀐 기록 {hist.length}</button>}
        </span>
        <span className="sb-acts">
          {mayWay && <button className="textbtn" onClick={() => setMode('way')}>우리 부서 방식</button>}
          {mayCommon && <button className="textbtn" onClick={() => setMode('common')}>공통 순서 고치기</button>}
        </span>
      </div>
      {mode === 'hist' && <History s={s} list={hist} />}
    </div>
  );
}

/** 우리 부서 운영 방식 쓰기 — 공통 단계마다 '우리 부서는'(비우면 공통대로) + 끝에 더 하는 일. */
function WayEditor({s, duty, onSave, onCancel}: {s: State; duty: Duty; onSave: (t: Record<string, string>) => void; onCancel: () => void}) {
  const steps = stepsOf(s, duty);
  const ways = waysOf(s, meOf(s)?.deptId, duty.id);
  const [t, setT] = useState<Record<string, string>>(Object.fromEntries(Object.entries(ways).map(([k, w]) => [k, w.text])));
  const set = (k: string, v: string) => setT(x => ({...x, [k]: v}));
  let n = 0;
  return (
    <div className="editor wayed">
      <p className="eh">{deptName(s, meOf(s)?.deptId)}에서 공통과 다르게 하는 단계만 적으세요. 비워 두면 공통 순서대로입니다. 공통 순서는 바뀌지 않습니다.</p>
      {steps.map((st, i) => {
        if (st.warn) return null;
        const k = stepIdOf(duty, st, i);
        return (
          <label key={k} className="wr">
            <span className="wc"><span className="n">{++n}</span>{st.text}</span>
            <input value={t[k] ?? ''} onChange={e => set(k, e.target.value)} placeholder="우리 부서는" aria-label={`${n}번째 단계, 우리 부서는`} />
          </label>
        );
      })}
      {Object.entries(ways).filter(([k]) => k !== '_end' && !steps.some((st, i) => stepIdOf(duty, st, i) === k)).map(([k, w]) => (
        <label key={k} className="wr">
          <span className="wc">연결된 공통 단계가 없어진 것 · 원래 단계 {w.base}</span>
          <input value={t[k] ?? ''} onChange={e => set(k, e.target.value)} placeholder="비우면 지웁니다" />
        </label>
      ))}
      <label className="wr">
        <span className="wc">{steps.length ? '공통 순서 끝에 우리 부서가 더 하는 일' : '우리 부서 처리 순서(한 줄에 한 단계)'}</span>
        <textarea rows={3} value={t._end ?? ''} onChange={e => set('_end', e.target.value)} />
      </label>
      <div className="er-act">
        <button className="ghost" onClick={onCancel}>취소</button>
        <button className="ghost strong" onClick={() => onSave(t)}>저장</button>
      </div>
    </div>
  );
}

/** 공통 처리 순서가 바뀐 기록 — 누가 · 언제 · 뺀 것 · 새로 쓴 것. */
function History({s, list}: {s: State; list: {by: string; at: string; before: Step[]; after: Step[]}[]}) {
  return (
    <ul className="sb-hist">
      {list.slice().reverse().map((c, i) => {
        const was = c.before.map(x => x.text), now = c.after.map(x => x.text);
        const gone = was.filter(x => !now.includes(x)), added = now.filter(x => !was.includes(x));
        return (
          <li key={i}>
            <b>{md(c.at)} {nameOf(s, c.by)}</b>
            {gone.map((x, j) => <span key={'g' + j}>뺀 것 · {x}</span>)}
            {added.map((x, j) => <span key={'a' + j}>새로 쓴 것 · {x}</span>)}
            {!gone.length && !added.length && <span>순서만 바꿈</span>}
          </li>
        );
      })}
    </ul>
  );
}

// 공통 처리 순서 편집(관리자). 작성 기준은 입력칸 밖에 늘 보인다(칸 안 안내는 입력하면 사라져서 쓰지 않는다, docs/WRITING.md).
// 주의는 관련 단계 바로 아래에 끼워 넣는다. 단계 수와 주의 개수는 제한하지 않는다. 단계 id는 그대로 넘겨 부서 운영 방식이 붙어 있게 한다.
function StepsEditor({steps, onSave, onCancel}: {steps: Step[]; onSave: (s: Step[]) => void; onCancel: () => void}) {
  const [list, setList] = useState<Step[]>(steps.length ? steps : [{text: ''}]);
  const set = (i: number, text: string) => setList(l => l.map((x, j) => (j === i ? {...x, text} : x)));
  const warnAfter = (i: number) => setList(l => [...l.slice(0, i + 1), {text: '', warn: true}, ...l.slice(i + 1)]);
  let n = 0;
  return (
    <div className="editor">
      <p className="eh">공통 처리 순서는 조직 전체의 기준입니다. 고치면 바뀐 기록에 남습니다.</p>
      <p className="eh">한 단계에 한 가지 작업을 적으세요. 사용하는 시스템과 수행할 행동을 구체적으로 적으면 좋습니다.</p>
      {list.some(x => x.warn) && <p className="eh">주의: 실수하기 쉬운 상황이나 예외사항을 적으세요.</p>}
      {list.map((st, i) => {
        const no = st.warn ? 0 : ++n;
        return (
          <div key={i} className={`er${st.warn ? ' w' : ''}`}>
            <span className="n">{st.warn ? '주의' : no}</span>
            <input value={st.text} onChange={e => set(i, e.target.value)} aria-label={st.warn ? '주의' : `${no}번째 순서`} />
            {!st.warn && <button className="textbtn" onClick={() => warnAfter(i)}>주의 넣기</button>}
            <button className="textbtn" onClick={() => setList(l => l.filter((_, j) => j !== i))}>빼기</button>
          </div>
        );
      })}
      <button className="textbtn add" onClick={() => setList(l => [...l, {text: ''}])}>순서 더하기</button>
      <div className="er-act">
        <button className="ghost" onClick={onCancel}>취소</button>
        <button className="ghost strong" onClick={() => onSave(list.filter(x => x.text.trim()))}>저장</button>
      </div>
    </div>
  );
}
