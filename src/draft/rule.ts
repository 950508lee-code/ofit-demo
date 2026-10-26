// AI 없이 만드는 초안 — 오핏에 평상시 쌓인 것(반복업무 일정·요청·완료 기록)에서 바로 뽑는다.
import {addDays, occurrences, ruleLabel} from '../schedule';
import {deptName, dutiesOfUnit, nameOf, recipientsOf, stepsOf, type State} from '../store';
import type {DraftItem} from './types';

let n = 0;
const item = (x: Omit<DraftItem, 'id' | 'check' | 'pick'>): DraftItem => ({...x, id: `r${++n}`, check: 'ok', pick: 'keep'});

export function ruleDraft(s: State, from: string, unitIds: string[], today: string): DraftItem[] {
  const out: DraftItem[] = [];
  const year = addDays(today, 365);
  for (const uid of unitIds) {
    for (const d of dutiesOfUnit(s, uid)) {
      const next = occurrences(d.rule, today, year)[0];
      out.push(item({kind: 'schedule', unitId: uid, text: d.title, when: `${ruleLabel(d.rule)}${next ? ` · 다음 ${next.slice(5).replace('-', '/')}` : ''}`, src: {type: 'ofit', label: '업무 기준표'}}));
      const st = stepsOf(s, d);
      for (const w of st.filter(x => x.warn)) out.push(item({kind: 'caution', unitId: uid, text: w.text, src: {type: 'ofit', label: `처리 순서 · ${d.title}`}}));
      if (st.some(x => !x.warn)) out.push(item({kind: 'step', unitId: uid, text: `${d.title}: ${st.filter(x => !x.warn).map((x, i) => `${i + 1}. ${x.text}`).join(' / ')}`, src: {type: 'ofit', label: '처리 순서'}}));
    }
    // 이 업무로 주고받은 요청 → 협의할 사람·부서, 끝나지 않은 요청 → 진행 중인 현안
    const asks = s.dispatches.filter(x => x.unitId === uid && (x.from === from || recipientsOf(s, x).some(p => p.id === from)));
    const who = new Map<string, number>();
    for (const x of asks) {
      const key = x.from === from ? x.toDepts.map(id => deptName(s, id)).join(', ') : `${nameOf(s, x.from)} (${deptName(s, x.fromDept)})`;
      who.set(key, (who.get(key) ?? 0) + 1);
      const mine = x.from !== from && !x.done[from];
      if (mine && x.due >= today) out.push(item({kind: 'issue', unitId: uid, text: `받은 요청: ${x.title}`, when: `기한 ${x.due.slice(5).replace('-', '/')}`, src: {type: 'ofit', label: `요청 · ${nameOf(s, x.from)}`}}));
    }
    for (const [k, c] of who) out.push(item({kind: 'contact', unitId: uid, text: k, src: {type: 'ofit', label: `요청 ${c}건`}}));
    // 최근 석 달 완료 메모 — 다음 사람에게 쓸모 있는 한 줄
    const ids = new Set(dutiesOfUnit(s, uid).map(d => d.id));
    for (const r of s.records.filter(r => ids.has(r.dutyId) && r.by === from && r.note.trim() && r.date >= addDays(today, -90)))
      out.push(item({kind: 'past', unitId: uid, text: r.note.trim(), when: r.date.slice(5).replace('-', '/'), src: {type: 'ofit', label: `완료 기록 ${r.date.slice(5).replace('-', '/')} ${nameOf(s, r.by)}`}}));
  }
  // 전임자의 할 일(업무에 묶이지 않은 것) — 반복이면 시기별 할 일, 앞으로 날짜가 있으면 진행 중인 현안
  for (const t of s.tasks.filter(t => t.owner === from)) {
    if (t.rule) out.push(item({kind: 'schedule', text: t.title, when: ruleLabel(t.rule), src: {type: 'ofit', label: '내 할 일(반복)'}}));
    else if (t.date && t.date >= today && !t.done.includes(t.date)) out.push(item({kind: 'issue', text: t.title, when: t.date.slice(5).replace('-', '/'), src: {type: 'ofit', label: '내 할 일'}}));
  }
  return out;
}
