// 날짜와 반복 규칙. 날짜는 모두 'yyyy-mm-dd' 문자열로 다룬다(시간대 문제 없음).

// 리마인더 앱과 같은 규칙: 매일은 휴일이면 건너뛰고, 나머지는 휴일이면 앞 근무일로 당긴다.
// exact = 휴일·주말도 그대로(건너뛰기·당기기 안 함). every = n일·n주·n개월마다(기준일 anchor부터 셈).
export type RuleBase = {every?: number; anchor?: string; exact?: boolean};
export type Rule = RuleBase & (
  | {kind: 'daily'}
  | {kind: 'weekly'; weekday: number; days?: number[]} // days 가 있으면 여러 요일(매주 월·수·금)
  | {kind: 'monthly'; day: number | 'last'}
  | {kind: 'monthlyWeekday'; nth: number; weekday: number} // nth -1 = 마지막 주
  | {kind: 'quarterly'; month: number; day: number | 'last'} // month 0 시작월 · 1 중간월 · 2 마지막월
  | {kind: 'yearly'; month: number; day: number}); // month 1~12

// 시연용 공휴일 표 (2026 하반기)
export const HOLIDAYS: Record<string, string> = {
  '2026-08-15': '광복절',
  '2026-08-17': '대체공휴일',
  '2026-09-24': '추석',
  '2026-09-25': '추석',
  '2026-09-26': '추석',
  '2026-10-03': '개천절',
  '2026-10-05': '대체공휴일',
  '2026-10-09': '한글날',
  '2026-12-25': '성탄절',
  '2027-01-01': '신정',
  '2027-02-06': '설날',
  '2027-02-07': '설날',
  '2027-02-08': '설날',
  '2027-02-09': '대체공휴일',
};

const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (s: string, n: number) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
};
export const weekday = (s: string) => parse(s).getDay();
export const mondayOf = (s: string) => addDays(s, -((weekday(s) + 6) % 7));

export const isBusiness = (s: string) => {
  const w = weekday(s);
  return w !== 0 && w !== 6 && !HOLIDAYS[s];
};

const prevBusiness = (s: string) => {
  let d = s;
  while (!isBusiness(d)) d = addDays(d, -1);
  return d;
};

const lastDay = (y: number, m: number) => new Date(y, m, 0).getDate(); // m: 1~12

/** 그 달에서 규칙이 가리키는 원래 날짜(휴일 조정 전). 해당 없으면 null. */
function rawInMonth(rule: Rule, y: number, m: number): string | null {
  const key = (d: number) => `${y}-${pad(m)}-${pad(d)}`;
  const dayOf = (day: number | 'last') => (day === 'last' ? lastDay(y, m) : Math.min(day, lastDay(y, m)));
  if (rule.kind === 'monthly') return key(dayOf(rule.day));
  if (rule.kind === 'yearly') return m === rule.month ? key(dayOf(rule.day)) : null;
  if (rule.kind === 'quarterly') return (m - 1) % 3 === rule.month ? key(dayOf(rule.day)) : null;
  if (rule.kind === 'monthlyWeekday') {
    const days = Array.from({length: lastDay(y, m)}, (_, i) => i + 1).filter(d => weekday(key(d)) === rule.weekday);
    const d = rule.nth === -1 ? days[days.length - 1] : days[rule.nth - 1];
    return d ? key(d) : null;
  }
  return null;
}

export function occurrences(rule: Rule, from: string, to: string): string[] {
  const out = new Set<string>();
  const n = Math.max(1, rule.every ?? 1);
  const shift = (d: string) => (rule.exact ? d : prevBusiness(d));
  const anchor = rule.anchor ?? from;
  const dayDiff = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 864e5);
  if (rule.kind === 'daily') {
    for (let d = from; d <= to; d = addDays(d, 1)) {
      if (n > 1 && (((dayDiff(anchor, d) % n) + n) % n) !== 0) continue;
      if (rule.exact || isBusiness(d)) out.add(d);
    }
  } else if (rule.kind === 'weekly') {
    const days = rule.days?.length ? rule.days : [rule.weekday];
    for (let d = from; d <= addDays(to, 7); d = addDays(d, 1)) {
      if (!days.includes(weekday(d))) continue;
      if (n > 1 && ((((dayDiff(mondayOf(anchor), mondayOf(d)) / 7) % n) + n) % n) !== 0) continue;
      const a = shift(d);
      if (a >= from && a <= to) out.add(a);
    }
  } else {
    const f = parse(from), t = parse(to), am = parse(anchor).getFullYear() * 12 + parse(anchor).getMonth();
    // 앞뒤 한 달씩 여유: 다음 달 1일이 휴일이면 이번 달로 당겨지는 경우
    for (let i = f.getFullYear() * 12 + f.getMonth() - 1; i <= t.getFullYear() * 12 + t.getMonth() + 1; i++) {
      if (n > 1 && (rule.kind === 'monthly' || rule.kind === 'monthlyWeekday') && ((((i - am) % n) + n) % n) !== 0) continue;
      const raw = rawInMonth(rule, Math.floor(i / 12), (i % 12) + 1);
      if (!raw) continue;
      const a = shift(raw);
      if (a >= from && a <= to) out.add(a);
    }
  }
  return [...out].sort();
}

const WD = ['일', '월', '화', '수', '목', '금', '토'];
export const weekdayKo = (s: string) => WD[weekday(s)];
export const dateLabel = (s: string) => {
  const d = parse(s);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${weekdayKo(s)})`;
};
/** '10월 15일' — 요일 없이 짧게. */
export const monthDay = (s: string) => { const d = parse(s); return `${d.getMonth() + 1}월 ${d.getDate()}일`; };
export const shortDate = (s: string) => {
  const d = parse(s);
  return `${d.getFullYear() % 100}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
};

const NTH = ['', '첫째', '둘째', '셋째', '넷째', '다섯째'];
const QM = ['시작월', '중간월', '마지막월'];
/** 휴일 조정은 기본이라 적지 않고, 끈 경우(exact)만 덧붙인다. */
export function ruleLabel(rule: Rule): string {
  const day = (d: number | 'last') => (d === 'last' ? '말일' : `${d}일`);
  const n = rule.every ?? 1;
  const wds = (xs: number[]) => xs.slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map(x => WD[x]).join('·');
  let t: string;
  switch (rule.kind) {
    case 'daily': t = n > 1 ? `${n}일마다` : '매일'; break;
    case 'weekly': {
      const w = `${wds(rule.days?.length ? rule.days : [rule.weekday])}요일`;
      t = n === 2 ? `격주 ${w}` : n > 2 ? `${n}주마다 ${w}` : `매주 ${w}`; break;
    }
    case 'monthly': t = `${n > 1 ? `${n}개월마다` : '매월'} ${day(rule.day)}`; break;
    case 'monthlyWeekday': t = `${n > 1 ? `${n}개월마다` : '매월'} ${rule.nth === -1 ? '마지막' : NTH[rule.nth]} 주 ${WD[rule.weekday]}요일`; break;
    case 'quarterly': t = `분기 ${QM[rule.month]} ${day(rule.day)}`; break;
    case 'yearly': t = `매년 ${rule.month}월 ${rule.day}일`; break;
  }
  return rule.exact ? `${t} · 휴일에도` : t;
}

/** 묶어 보여 줄 때 쓰는 주기 이름. */
export const cycleOf = (rule: Rule) =>
  rule.kind === 'daily' ? '매일' : rule.kind === 'weekly' ? '매주' : rule.kind === 'quarterly' ? '분기' : rule.kind === 'yearly' ? '매년' : '매월';
