import {addDays, occurrences, parse, ruleLabel, weekday, type Rule} from '../schedule';

/**
 * 반복 고르기 — 리마인더 앱의 반복 화면을 옮겼다.
 * 문장처럼 '매 [n] [일·주·개월·분기·년] 마다' → 단위별 세부(요일 여러 개 / 일자·n째 주 요일·말일 / 분기 달 / 년 월·일)
 * → '공휴일·주말 건너뛰기'. 맨 위에 알아들은 규칙과 다음 3번.
 * 시작일은 일정 등록 창의 날짜 칸이다(규칙의 기준일 anchor).
 */
export type Unit = 'day' | 'week' | 'month' | 'quarter' | 'year';
export type RepeatState = {
  every: number; unit: Unit;
  days: number[]; // 주: 고른 요일(0=일)
  mode: 'date' | 'nth' | 'last'; // 개월: 일자 지정 / 요일 지정 / 말일
  mday: number; nth: number; nwd: number;
  qmonth: number; qlast: boolean; qday: number; // 분기
  ymonth: number; yday: number; // 년
  skip: boolean; // 공휴일·주말 건너뛰기
};

const WD = ['일', '월', '화', '수', '목', '금', '토'];
const UNITS: {id: Unit; label: string}[] = [
  {id: 'day', label: '일'}, {id: 'week', label: '주'}, {id: 'month', label: '개월'}, {id: 'quarter', label: '분기'}, {id: 'year', label: '년'},
];

/** 시작일에 맞춘 처음 값 — 날짜 칸이 금요일이면 '매주 금요일'부터. */
export function repeatFrom(date: string, rule?: Rule): RepeatState {
  const d = parse(date);
  const base: RepeatState = {
    every: 1, unit: 'week', days: [weekday(date)], mode: 'date', mday: d.getDate(), nth: Math.min(4, Math.ceil(d.getDate() / 7)), nwd: weekday(date),
    qmonth: (d.getMonth()) % 3, qlast: false, qday: Math.min(28, d.getDate()), ymonth: d.getMonth() + 1, yday: d.getDate(), skip: true,
  };
  if (!rule) return base;
  const r = {...base, every: rule.every ?? 1, skip: !rule.exact};
  switch (rule.kind) {
    case 'daily': return {...r, unit: 'day'};
    case 'weekly': return {...r, unit: 'week', days: rule.days?.length ? rule.days : [rule.weekday]};
    case 'monthly': return rule.day === 'last' ? {...r, unit: 'month', mode: 'last'} : {...r, unit: 'month', mode: 'date', mday: rule.day};
    case 'monthlyWeekday': return {...r, unit: 'month', mode: 'nth', nth: rule.nth, nwd: rule.weekday};
    case 'quarterly': return {...r, unit: 'quarter', qmonth: rule.month, qlast: rule.day === 'last', qday: rule.day === 'last' ? 28 : rule.day};
    case 'yearly': return {...r, unit: 'year', ymonth: rule.month, yday: rule.day};
  }
}

export function ruleOf(x: RepeatState, anchor: string): Rule | undefined {
  const b = {every: x.every > 1 ? x.every : undefined, anchor, exact: x.skip ? undefined : true};
  switch (x.unit) {
    case 'day': return {...b, kind: 'daily'};
    case 'week': return x.days.length ? {...b, kind: 'weekly', weekday: x.days[0], days: x.days.length > 1 ? x.days : undefined} : undefined;
    case 'month':
      return x.mode === 'nth' ? {...b, kind: 'monthlyWeekday', nth: x.nth, weekday: x.nwd}
        : {...b, kind: 'monthly', day: x.mode === 'last' ? 'last' : x.mday};
    case 'quarter': return {...b, every: undefined, kind: 'quarterly', month: x.qmonth, day: x.qlast ? 'last' : x.qday};
    case 'year': return {...b, every: undefined, kind: 'yearly', month: x.ymonth, day: x.yday};
  }
}

const range = (a: number, b: number) => Array.from({length: b - a + 1}, (_, i) => a + i);
const mmdd = (d: string) => `${parse(d).getMonth() + 1}.${parse(d).getDate()}`;

export function RepeatPicker({value, onChange, start}: {value: RepeatState; onChange: (v: RepeatState) => void; start: string}) {
  const set = (p: Partial<RepeatState>) => onChange({...value, ...p});
  const rule = ruleOf(value, start);
  const next = rule ? occurrences(rule, start, addDays(start, 800)).slice(0, 3) : [];
  return (
    <div className="rpick">
      <p className="rp-sum">{rule ? <><b>{ruleLabel(rule)}</b>{next.length > 0 && <span> · 다음 {next.map(mmdd).join(', ')}</span>}</> : <span className="bad">요일을 골라 주세요</span>}</p>

      <div className="rp-line">
        <span>매</span>
        {value.unit !== 'quarter' && value.unit !== 'year' && (
          <select value={value.every} onChange={e => set({every: Number(e.target.value)})} aria-label="몇 번마다">
            {range(1, 30).map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        )}
        <div className="seg2 rp-unit" role="radiogroup" aria-label="반복 단위">
          {UNITS.map(u => <button key={u.id} role="radio" aria-checked={value.unit === u.id} className={value.unit === u.id ? 'on' : ''} onClick={() => set({unit: u.id})}>{u.label}</button>)}
        </div>
        <span>마다</span>
      </div>

      {value.unit === 'week' && (
        <div className="rp-days" role="group" aria-label="요일">
          {[1, 2, 3, 4, 5, 6, 0].map(w => (
            <button key={w} className={`${value.days.includes(w) ? 'on' : ''}${w === 0 || w === 6 ? ' we' : ''}`} aria-pressed={value.days.includes(w)}
              onClick={() => set({days: value.days.includes(w) ? value.days.filter(x => x !== w) : [...value.days, w]})}>{WD[w]}</button>
          ))}
        </div>
      )}

      {value.unit === 'month' && (
        <div className="rp-sub">
          <div className="seg2" role="radiogroup" aria-label="개월 방식">
            {([['date', '일자 지정'], ['nth', '요일 지정'], ['last', '말일']] as const).map(([k, l]) => (
              <button key={k} role="radio" aria-checked={value.mode === k} className={value.mode === k ? 'on' : ''} onClick={() => set({mode: k})}>{l}</button>
            ))}
          </div>
          {value.mode === 'date' && (
            <select value={value.mday} onChange={e => set({mday: Number(e.target.value)})} aria-label="며칠">
              {range(1, 31).map(n => <option key={n} value={n}>{n}일</option>)}
            </select>
          )}
          {value.mode === 'nth' && (
            <div className="rp-two">
              <select value={value.nth} onChange={e => set({nth: Number(e.target.value)})} aria-label="몇째 주">
                {[[1, '첫째'], [2, '둘째'], [3, '셋째'], [4, '넷째'], [-1, '마지막']].map(([n, l]) => <option key={n} value={n}>{l} 주</option>)}
              </select>
              <select value={value.nwd} onChange={e => set({nwd: Number(e.target.value)})} aria-label="무슨 요일">
                {[1, 2, 3, 4, 5, 6, 0].map(w => <option key={w} value={w}>{WD[w]}요일</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {value.unit === 'quarter' && (
        <div className="rp-sub">
          <div className="seg2" role="radiogroup" aria-label="분기의 몇째 달">
            {[[0, '시작월 (1·4·7·10)'], [1, '중간월'], [2, '마지막월 (3·6·9·12)']].map(([k, l]) => (
              <button key={k} role="radio" aria-checked={value.qmonth === k} className={value.qmonth === k ? 'on' : ''} onClick={() => set({qmonth: k as number})}>{l}</button>
            ))}
          </div>
          <div className="rp-two">
            <select value={value.qlast ? 'last' : value.qday} onChange={e => set(e.target.value === 'last' ? {qlast: true} : {qlast: false, qday: Number(e.target.value)})} aria-label="며칠">
              {range(1, 28).map(n => <option key={n} value={n}>{n}일</option>)}
              <option value="last">말일</option>
            </select>
          </div>
        </div>
      )}

      {value.unit === 'year' && (
        <div className="rp-two">
          <select value={value.ymonth} onChange={e => set({ymonth: Number(e.target.value)})} aria-label="몇 월">
            {range(1, 12).map(n => <option key={n} value={n}>{n}월</option>)}
          </select>
          <select value={value.yday} onChange={e => set({yday: Number(e.target.value)})} aria-label="며칠">
            {range(1, 31).map(n => <option key={n} value={n}>{n}일</option>)}
          </select>
        </div>
      )}

      <label className="rp-skip">
        <input type="checkbox" checked={value.skip} onChange={e => set({skip: e.target.checked})} />
        <span>공휴일·주말 건너뛰기 <small>{value.unit === 'day' ? '쉬는 날은 빼고' : '쉬는 날이면 앞 근무일로'}</small></span>
      </label>
    </div>
  );
}
