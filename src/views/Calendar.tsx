import {addDays, HOLIDAYS, parse, weekday, ymd} from '../schedule';
import {today} from '../store';
import {dailyCount, itemsInRange, sundayOf} from '../days';
import {useDirection, type Ctx} from './common';
import {placeColor} from './placeColor';
import type {CSSProperties} from 'react';

const WD = ['일', '월', '화', '수', '목', '금', '토'];

/** 달력 — 한 달 칸 달력. 칸마다 제목 1~2개와 '외 n건'. 날짜를 누르면 오른쪽에 그날 목록. */
export function Calendar({s, setOpen, sel, setSel}: Ctx & {sel: string; setSel: (d: string) => void}) {
  const first = ymd(new Date(parse(sel).getFullYear(), parse(sel).getMonth(), 1));
  const month = parse(first).getMonth();
  const start = sundayOf(first);
  const cells = Array.from({length: 42}, (_, i) => addDays(start, i));
  const weeks = cells[35] && parse(cells[35]).getMonth() !== month ? 5 : 6;
  const shown = cells.slice(0, weeks * 7);
  const items = itemsInRange(s, shown[0], shown[shown.length - 1]);
  const daily = dailyCount(s);
  const day = today();
  const dir = useDirection(first);
  const moveMonth = (n: number) => {
    const d = parse(first);
    setSel(ymd(new Date(d.getFullYear(), d.getMonth() + n, 1)));
    setOpen(null);
  };

  return (
    <section className="list cal">
      <div className="cal-h">
        <h2>{parse(first).getFullYear()}년 {month + 1}월</h2>
        <div className="cal-nav">
          <button onClick={() => moveMonth(-1)}>지난달</button>
          <button onClick={() => { setSel(day); setOpen(null); }} disabled={sel === day}>오늘</button>
          <button onClick={() => moveMonth(1)}>다음 달</button>
        </div>
      </div>

      <div className="calcard">
      <div className="grid" aria-hidden="true">
        {WD.map((w, i) => <div key={w} className={`gh${i === 0 ? ' off' : ''}`}>{w}</div>)}
      </div>
      <div key={first} className={`grid slide-${dir}`} role="grid" aria-label={`${parse(first).getFullYear()}년 ${month + 1}월`}>
        {shown.map(d => {
          const list = items.get(d) ?? [];
          const left = list.filter(r => !r.done);
          const out = parse(d).getMonth() !== month;
          const off = weekday(d) === 0 || !!HOLIDAYS[d];
          return (
            <button key={d} role="gridcell" aria-selected={d === sel}
              className={`cell${out ? ' out' : ''}${d === sel ? ' on' : ''}${d === day ? ' today' : ''}${off ? ' off' : ''}`}
              onClick={() => { setSel(d); setOpen(null); }}>
              <span className="cn">
                <b>{parse(d).getDate()}</b>
                {HOLIDAYS[d] && <em className="hol">{HOLIDAYS[d]}</em>}
              </span>
              <span className="ev">
                {list.slice(0, 3).map(r => <span key={r.kind + r.id} className={r.done ? 'done' : ''} style={{'--pc': placeColor(s, r.at)} as CSSProperties}>{r.title}</span>)}
                {list.length > 3 && <span className="more">외 {list.length - 3}건</span>}
              </span>
              {left.length > 0 && <i className="has" aria-label={`할 일 ${left.length}건`} />}
            </button>
          );
        })}
      </div>
      </div>
      {daily > 0 && <p className="cal-note">매일 하는 일 {daily}개는 달력에 따로 적지 않습니다</p>}
    </section>
  );
}
