import {useEffect, useState, type ReactNode} from 'react';
import type {Duty, OrgId, Unit} from './model';
import {cycleOf} from './schedule';
import {dutiesOfUnit, sameDeptHolders, unitsOfOrg, type State} from './store';

export const dutiesOf = (s: State, u: Unit) => dutiesOfUnit(s, u.id);

/** '매일 2 · 매월 3 · 분기 1' — 반복업무가 어떤 주기로 몇 개인지. */
export const cycleSummary = (ds: Duty[]) => {
  const n: Record<string, number> = {};
  for (const d of ds) n[cycleOf(d.rule)] = (n[cycleOf(d.rule)] ?? 0) + 1;
  return ['매일', '매주', '매월', '분기', '매년'].filter(k => n[k]).map(k => `${k} ${n[k]}`).join(' · ');
};

export function Modal({title, onCancel, children, closing}: {title: string; onCancel: () => void; children: ReactNode; closing?: boolean}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onCancel]);
  return (
    <div className={`scrim${closing ? ' out' : ''}`} onClick={onCancel}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

/**
 * 업무 고르기 — 조직의 단위업무가 직렬별로 한 화면에 쭉 뜨고, 여러 개 고른다.
 * 가입할 때와 '업무 추가'가 같은 화면을 쓴다.
 */
export function UnitPicker({s, org, title, lead, doneLabel, onDone, back, inline, onCreate, manage}: {
  s: State; org: OrgId; title: string; lead: string; doneLabel: string;
  onDone: (ids: string[]) => void; back?: {label: string; onClick: () => void}; inline?: boolean; onCreate?: () => void;
  manage?: boolean; // 업무 바꾸기: 맡은 업무가 체크된 채 시작하고 빼기도 된다. onDone 에는 최종 목록
}) {
  const [q, setQ] = useState('');
  const held = s.me ? (s.holds[s.me] ?? []) : [];
  const [picked, setPicked] = useState<string[]>(manage ? held : []);
  const adds = picked.filter(x => !held.includes(x)), drops = manage ? held.filter(x => !picked.includes(x)) : [];
  const toggle = (id: string) => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));
  const k = q.trim();
  const units = unitsOfOrg(s, org)
    .filter(u => !k || u.name.includes(k) || u.series.includes(k) || dutiesOf(s, u).some(d => d.title.includes(k)));
  const seriesList = [...new Set(units.map(u => u.series))];

  return (
    <div className={inline ? 'flow inline' : 'flow'}>
      {back && <button className="textbtn close" onClick={back.onClick}>{back.label}</button>}
      {inline ? <h2>{title}</h2> : <h1>{title}</h1>}
      <p className="lead">{lead}</p>
      <input className="search" placeholder="업무 이름으로 찾기" value={q} onChange={e => setQ(e.target.value)} aria-label="업무 찾기" />
      {units.length === 0 && <p className="none">찾는 업무가 없습니다</p>}
      {seriesList.map(x => (
        <div key={x} className="group">
          <h3 className="dept">{x}</h3>
          {units.filter(u => u.series === x).map(u => {
            const mine = !manage && held.includes(u.id);
            const dropping = drops.includes(u.id);
            const others = s.me ? sameDeptHolders(s, u.id) : [];
            return (
              <label key={u.id} className={`choice check${mine ? ' off' : ''}`}>
                <input type="checkbox" disabled={mine} checked={mine || picked.includes(u.id)} onChange={() => toggle(u.id)} />
                <span className="ct">
                  <b>{u.name}</b>
                  <small>반복업무 {dutiesOf(s, u).length}개 · {cycleSummary(dutiesOf(s, u))}</small>
                  {mine && <em>맡고 있음</em>}
                  {manage && held.includes(u.id) && !dropping && <em>맡고 있음</em>}
                  {dropping && <em className="drop">빼면 어제까지만 내 업무로 남습니다. 다음 사람이 이어받아야 하면 인수인계를 쓰세요</em>}
                  {!mine && others.length > 0 && <em>같은 부서 {others.map(p => p.name).join(', ')} 님도 맡고 있음</em>}
                </span>
              </label>
            );
          })}
        </div>
      ))}
      {onCreate && (
        <button className="textbtn more-link" onClick={onCreate}>찾는 업무가 없나요? 업무 만들기</button>
      )}
      <div className="flow-foot">
        {manage ? (
          <button className="primary wide" disabled={!adds.length && !drops.length} onClick={() => onDone(picked)}>
            {adds.length || drops.length ? [adds.length && `${adds.length}개 새로 맡기`, drops.length && `${drops.length}개 빼기`].filter(Boolean).join(' · ') : '바꿀 업무를 고르세요'}
          </button>
        ) : (
          <button className="primary wide" disabled={picked.length === 0} onClick={() => onDone(picked)}>
            {picked.length > 0 ? `${picked.length}개 ${doneLabel}` : '업무를 고르세요'}
          </button>
        )}
      </div>
    </div>
  );
}
