// 업무 기준표 파일 읽기·쓰기. 어느 조직이든 이 표 하나만 올리면 오핏을 쓸 수 있다.
//   열: 직렬, 단위업무, 반복업무, 주기
//   주기는 화면에 보이는 말 그대로 쓴다: 매일 · 매주 월요일 · 매월 15일 · 매월 말일 · 매월 넷째 주 월요일 · 분기 시작월 말일
import type {Duty, Unit} from './model';
import {ruleLabel, type Rule} from './schedule';

export const HEADER = ['직렬', '단위업무', '반복업무', '주기'];

/** 엑셀에서 저장한 CSV 는 UTF-8 이 아닐 수 있다(한국어 윈도우는 EUC-KR). 둘 다 받아 준다. */
export function decode(buf: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', {fatal: true}).decode(buf).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('euc-kr').decode(buf);
  }
}

/** 따옴표로 감싼 칸과 칸 안의 쉼표·줄바꿈까지 처리하는 CSV 읽기. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}

const WD = ['일', '월', '화', '수', '목', '금', '토'];
const NTH: Record<string, number> = {첫째: 1, 둘째: 2, 셋째: 3, 넷째: 4, 다섯째: 5, 마지막: -1};
const QM: Record<string, number> = {시작월: 0, 중간월: 1, 마지막월: 2};

/** '매월 15일' 같은 주기 말을 규칙으로. 못 읽으면 null. */
export function ruleFromLabel(raw: string): Rule | null {
  const t = raw.replace(/\s+/g, ' ').trim();
  let m: RegExpMatchArray | null;
  if (t === '매일') return {kind: 'daily'};
  if ((m = t.match(/^매주 ([일월화수목금토])요일$/))) return {kind: 'weekly', weekday: WD.indexOf(m[1])};
  if ((m = t.match(/^매월 (\d{1,2})일$/))) return {kind: 'monthly', day: Number(m[1])};
  if (t === '매월 말일') return {kind: 'monthly', day: 'last'};
  if ((m = t.match(/^매월 (첫째|둘째|셋째|넷째|다섯째|마지막) ?주 ([일월화수목금토])요일$/))) {
    return {kind: 'monthlyWeekday', nth: NTH[m[1]], weekday: WD.indexOf(m[2])};
  }
  if ((m = t.match(/^분기 (시작월|중간월|마지막월) (말일|\d{1,2}일)$/))) {
    return {kind: 'quarterly', month: QM[m[1]], day: m[2] === '말일' ? 'last' : Number(m[2].replace('일', ''))};
  }
  return null;
}

export type Built = {units: Unit[]; duties: Duty[]; series: string[]; bad: {line: number; text: string}[]};

/** 표 → 단위업무·반복업무. 읽지 못한 줄은 줄 번호와 함께 돌려준다. */
export function buildCatalog(orgId: string, rows: string[][]): Built {
  const head = rows[0]?.map(x => x.trim()) ?? [];
  const col = HEADER.map(h => head.indexOf(h));
  const hasHeader = col.every(i => i >= 0);
  const idx = hasHeader ? col : [0, 1, 2, 3];
  const body = hasHeader ? rows.slice(1) : rows;
  const unitIds = new Map<string, string>();
  const units: Unit[] = [], duties: Duty[] = [], bad: Built['bad'] = [];
  body.forEach((r, i) => {
    const [series, unit, title, cycle] = idx.map(k => (r[k] ?? '').trim());
    const rule = ruleFromLabel(cycle);
    if (!series || !unit || !title || !rule) {
      bad.push({line: i + (hasHeader ? 2 : 1), text: r.join(', ')});
      return;
    }
    const key = `${series}\u0000${unit}`;
    if (!unitIds.has(key)) {
      const id = `${orgId}-u${unitIds.size + 1}`;
      unitIds.set(key, id);
      units.push({id, org: orgId, series, name: unit});
    }
    duties.push({id: `${orgId}-d${duties.length + 1}`, unitIds: [unitIds.get(key)!], title, rule});
  });
  return {units, duties, series: [...new Set(units.map(u => u.series))], bad};
}

/** 조직의 기준표를 CSV 로. 엑셀에서 바로 열리게 BOM 을 붙인다. */
export function toCsv(units: Unit[], duties: Duty[]): string {
  const esc = (x: string) => (/[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x);
  const lines = [HEADER.join(',')];
  for (const u of units) {
    for (const d of duties.filter(x => x.unitIds.includes(u.id))) {
      lines.push([u.series, u.name, d.title, ruleLabel(d.rule)].map(esc).join(','));
    }
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}
