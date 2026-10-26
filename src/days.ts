// 날짜별 할 일 계산. 홈(주간 한 줄 달력·고른 날 목록), 달력, 알림 요약이 모두 이 파일을 쓴다.
import {addDays, isBusiness, occurrences, ruleLabel, weekday} from './schedule';
import {deptName, doneForMe, groupById, inWindow, myDispatches, myDuties, myDutiesEver, myItems, myTasks, myUnits, myWindow, seriesById, today, unitById, type State} from './store';

/**
 * 한 줄 = 무엇(title) · 어느 자리의 일(place) · 언제 오는가(when).
 * 자리는 업무·부서·그룹 이름. 없으면 내 일. 언제는 반복이면 리듬(매월 15일), 아니면 받은 사정.
 * gitem = 내가 담당인 그룹 항목(ref 는 그룹 일정 id). drecv = 다른 부서에서 받은 일정.
 */
export type Row = {kind: 'duty' | 'task' | 'daily' | 'gitem' | 'drecv'; id: string; date: string; title: string; done: boolean; time?: string; count?: {done: number; all: number}; place?: string; at?: {kind: 'unit' | 'dept' | 'group'; id: string}; when?: string; ref?: string};

const byTimeThenTitle = (a: Row, b: Row) => (a.time ?? '').localeCompare(b.time ?? '') || a.title.localeCompare(b.title);

/** 기간 안의 날짜별 할 일(매일 하는 일은 빼고). */
export function itemsInRange(s: State, from: string, to: string): Map<string, Row[]> {
  const out = new Map<string, Row[]>();
  const put = (r: Row) => out.set(r.date, [...(out.get(r.date) ?? []), r]);
  const mine = myUnits(s);
  for (const d of myDutiesEver(s)) {
    if (d.rule.kind === 'daily') continue;
    const w = myWindow(s, d);
    for (const date of occurrences(d.rule, from, to)) {
      if (!inWindow(w, date)) continue; // 맡기 전·뺀 뒤 회차는 내 할 일이 아니다
      put({kind: 'duty', id: d.id, date, title: d.title, done: s.records.some(r => r.dutyId === d.id && r.date === date && r.by === s.me),
        ...(() => { const u = mine.find(x => d.unitIds.includes(x.id)) ?? unitById(s, d.unitIds[0]); return {place: u?.name, at: u ? {kind: 'unit' as const, id: u.id} : undefined}; })(),
        when: ruleLabel(d.rule)});
    }
  }
  for (const t of myTasks(s)) {
    const dates = t.rule ? occurrences(t.rule, from, to).filter(x => !t.date || x >= t.date) : [t.date!].filter(x => x >= from && x <= to);
    for (const date of dates) put({kind: 'task', id: t.id, date, title: t.title, done: t.done.includes(date), time: t.time, when: t.rule ? ruleLabel(t.rule) : undefined});
  }
  for (const {e, i} of myItems(s)) {
    if (e.due < from || e.due > to) continue;
    put({kind: 'gitem', id: i.id, ref: e.id, date: e.due, title: i.text, done: !!i.doneBy, place: groupById(s, e.groupId)?.name, at: {kind: 'group', id: e.groupId}, when: `${seriesById(s, e.seriesId) ? `${ruleLabel(seriesById(s, e.seriesId)!.rule)} · ` : ''}${e.title} 항목`});
  }
  for (const d of myDispatches(s)) {
    if (d.due < from || d.due > to) continue;
    const unit = d.unitId ? s.units.find(u => u.id === d.unitId)?.name : '';
    const sr = seriesById(s, d.seriesId);
    put({kind: 'drecv', id: d.id, date: d.due, title: d.title, done: !!doneForMe(s, d), place: deptName(s, d.fromDept), at: {kind: 'dept', id: d.fromDept}, when: `${sr ? `${ruleLabel(sr.rule)} · ` : ''}${unit ? `${unit} 담당에게 온 요청` : '부서 전체에게 온 요청'}`});
  }
  for (const [k, v] of out) out.set(k, v.sort(byTimeThenTitle));
  return out;
}

/** 매일 하는 일 한 줄(근무일만). 없으면 null. */
export function dailyRow(s: State, date: string): Row | null {
  // 맡기 전 날에는 들어가지 않는다
  const daily = myDutiesEver(s).filter(d => d.rule.kind === 'daily' && inWindow(myWindow(s, d), date));
  if (!daily.length || !isBusiness(date)) return null;
  const left = daily.filter(d => !s.records.some(r => r.dutyId === d.id && r.date === date && r.by === s.me)).length;
  return {kind: 'daily', id: 'daily', date, title: '매일 하는 일', done: left === 0, count: {done: daily.length - left, all: daily.length},
    when: !left ? '모두 마침' : left === daily.length ? `${left}개 남음` : `${daily.length}개 중 ${left}개 남음`};
}
export const dailyCount = (s: State) => myDuties(s).filter(d => d.rule.kind === 'daily').length;

/** 고른 날의 목록: 매일 하는 일 → 그날 할 일. */
export function rowsOn(s: State, date: string): Row[] {
  const d = dailyRow(s, date);
  const all = [...(d ? [d] : []), ...(itemsInRange(s, date, date).get(date) ?? [])];
  // 완료한 일은 아래로(남은 일 순서는 그대로)
  return [...all.filter(r => !r.done), ...all.filter(r => r.done)];
}

/** 지난 두 주 동안 못 한 일(매일 하는 일 제외). */
export function overdue(s: State, day = today()): Row[] {
  const from = addDays(day, -14), to = addDays(day, -1);
  // 뺐거나 넘긴 업무의 못 한 회차는 더 이상 내 몫이 아니라 '기한 지난 일'로 조르지 않는다(달력 기록에는 남는다)
  const ended = (r: Row) => r.kind === 'duty' && !!myWindow(s, s.duties.find(d => d.id === r.id)!).to;
  return [...itemsInRange(s, from, to).values()].flat().filter(r => !r.done && !ended(r)).sort((a, b) => a.date.localeCompare(b.date));
}

/** 메뉴 숫자: 오늘 남은 일 + 기한 지난 일. */
export const leftToday = (s: State, day = today()) =>
  rowsOn(s, day).filter(r => !r.done).length + overdue(s, day).length;

/** 알림에 쓸 오늘 요약. */
export function summarize(s: State, day = today()) {
  const rows = rowsOn(s, day);
  const todo = rows.filter(r => r.kind !== 'daily' && !r.done);
  const dr = rows.find(r => r.kind === 'daily' && !r.done);
  const daily = dr ? Number(/(\d+)개 남음/.exec(dr.when ?? '')?.[1] ?? 0) : 0;
  const late = overdue(s, day).length;
  const timed = todo.filter(r => r.time).map(r => ({id: r.id, title: r.title, time: r.time!}));
  const title = todo.length ? `오늘 할 일 ${todo.length}건` : daily ? `매일 하는 일 ${daily}개` : late ? `기한 지난 일 ${late}건` : '오늘은 할 일이 없습니다';
  const body = [
    todo.length ? `${todo[0].title}${todo.length > 1 ? ` 외 ${todo.length - 1}건` : ''}` : '',
    todo.length && daily ? `매일 하는 일 ${daily}개` : '',
    late && (todo.length || daily) ? `기한 지난 일 ${late}건` : '',
  ].filter(Boolean).join(' · ');
  return {todo, late, daily, timed, title, body, any: todo.length + late + daily > 0};
}

/** 일요일로 시작하는 주의 첫날. */
export const sundayOf = (d: string) => addDays(d, -weekday(d));
