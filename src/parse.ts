// 빠른 입력 해석기 — 리마인더 앱과 같은 규칙 방식.
// 화면은 parseInput 결과만 쓴다. 나중에 이 함수 하나를 AI 호출로 바꿔도 화면은 그대로다.
import {addDays, mondayOf, parse, weekday, ymd, type Rule} from './schedule';

export type Parsed = {title: string; date?: string; time?: string; rule?: Rule};

const WD: Record<string, number> = {일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6};

export function parseInput(text: string, base: string): Parsed {
  let t = ` ${text.trim()} `;
  let date: string | undefined, time: string | undefined, rule: Rule | undefined;
  const cut = (found: string) => { t = t.replace(found, ' '); };

  // 반복 — 업무 표준과 같은 규칙(takeRule): 매일 · 매주 금요일 · 매월 25일/말일 · 매월 셋째 주 수요일 · 분기 첫 달 10일 · 매년 3월 31일
  const r = takeRule(t);
  rule = r.rule; t = r.rest;
  let m: RegExpMatchArray | null;

  // 날짜: 오늘·내일·모레 / (다음 주) 월요일 / 10월 18일 / 18일
  if (!rule) {
    const rel: [RegExp, number][] = [[/\s오늘/, 0], [/\s내일/, 1], [/\s모레/, 2]];
    for (const [re, n] of rel) if (re.test(t)) { date = addDays(base, n); t = t.replace(re, ' '); break; }
    if (!date && (m = t.match(/\s(다음\s*주\s*)?([일월화수목금토])요일/))) {
      const target = WD[m[2]];
      date = m[1]
        ? addDays(mondayOf(base), 7 + (target + 6) % 7) // 다음 주 그 요일
        : addDays(base, (target - weekday(base) + 7) % 7); // 오늘부터 가장 가까운 그 요일
      cut(m[0]);
    }
    if (!date && (m = t.match(/\s(\d{1,2})월\s*(\d{1,2})일/))) {
      const y = parse(base).getFullYear();
      let d = ymd(new Date(y, Number(m[1]) - 1, Number(m[2])));
      if (d < base) d = ymd(new Date(y + 1, Number(m[1]) - 1, Number(m[2])));
      date = d; cut(m[0]);
    }
    if (!date && (m = t.match(/\s(\d{1,2})일/))) {
      const b = parse(base);
      let d = ymd(new Date(b.getFullYear(), b.getMonth(), Number(m[1])));
      if (d < base) d = ymd(new Date(b.getFullYear(), b.getMonth() + 1, Number(m[1])));
      date = d; cut(m[0]);
    }
  }

  // 시간: 오후 3시 / 3시 30분 / 15:00
  if ((m = t.match(/\s(오전|오후)?\s*(\d{1,2})시\s*(?:(\d{1,2})분|반)?/))) {
    let h = Number(m[2]);
    if (m[1] === '오후' && h < 12) h += 12;
    if (!m[1] && h >= 1 && h <= 6) h += 12; // '3시'는 근무시간 기준 오후
    const min = m[0].includes('반') ? 30 : Number(m[3] ?? 0);
    time = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    cut(m[0]);
  } else if ((m = t.match(/\s(\d{1,2}):(\d{2})/))) {
    time = `${m[1].padStart(2, '0')}:${m[2]}`;
    cut(m[0]);
  }

  const title = t.replace(/\s+/g, ' ').trim()
    .replace(/^(까지|에|부터)\s*/, '')
    .replace(/\s*(까지|에)$/, '')
    .trim();
  return {title, date, time, rule};
}

const NTH: Record<string, number> = {첫째: 1, 첫: 1, 둘째: 2, 셋째: 3, 넷째: 4, 마지막: -1};
const QM: Record<string, number> = {첫: 0, 시작: 0, 중간: 1, 가운데: 1, 마지막: 2, 끝: 2};

/**
 * 반복업무 한 줄 — '매월 25일 지출결의 마감', '매년 3월 31일 연간 집행계획 재확인', '분기 첫 달 10일 집행률 보고', '매월 셋째 주 수요일 PC 보안 점검', '매일 근태 확인'.
 * 주기를 못 알아들으면 rule 없이 돌려준다(화면이 '주기를 적어 주세요'라고 알린다).
 */
/** 글에서 반복 주기를 찾아 떼어 낸다. 빠른 입력·업무 표준이 함께 쓴다. */
export function takeRule(text: string): {rule?: Rule; rest: string} {
  let t = ` ${text.trim()} `, rule: Rule | undefined, m: RegExpMatchArray | null;
  const cut = (x: string) => { t = t.replace(x, ' '); };
  const day = (x: string) => (/말일|마지막\s*날/.test(x) ? 'last' as const : Number(x.replace(/\D/g, '')));
  if ((m = t.match(/\s매년\s*(\d{1,2})월\s*(\d{1,2})일/)) && Number(m[1]) >= 1 && Number(m[1]) <= 12 && Number(m[2]) >= 1 && Number(m[2]) <= 31) { rule = {kind: 'yearly', month: Number(m[1]), day: Number(m[2])}; cut(m[0]); }
  else if ((m = t.match(/\s분기\s*(첫|시작|중간|가운데|마지막|끝)\s*(?:달|월)\s*(\d{1,2}일|말일)/))) { rule = {kind: 'quarterly', month: QM[m[1]], day: day(m[2])}; cut(m[0]); }
  else if ((m = t.match(/\s매(?:월|달)\s*(첫째|첫|둘째|셋째|넷째|마지막)\s*주?\s*([일월화수목금토])요일?/))) { rule = {kind: 'monthlyWeekday', nth: NTH[m[1]], weekday: WD[m[2]]}; cut(m[0]); }
  else if ((m = t.match(/\s매(?:월|달)\s*(\d{1,2}일|말일|마지막\s*날)/))) { rule = {kind: 'monthly', day: day(m[1])}; cut(m[0]); }
  else if ((m = t.match(/\s매주\s*([일월화수목금토])요일?/))) { rule = {kind: 'weekly', weekday: WD[m[1]]}; cut(m[0]); }
  else if ((m = t.match(/\s매일/))) { rule = {kind: 'daily'}; cut(m[0]); }
  return {rule, rest: t};
}

export function parseDuty(text: string): {title: string; rule?: Rule} {
  const {rule, rest} = takeRule(text);
  return {title: rest.replace(/\s+/g, ' ').trim().replace(/^(에|마다)\s*/, ''), rule};
}
