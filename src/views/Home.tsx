import {addDays, dateLabel, HOLIDAYS, parse, weekday} from '../schedule';
import {addTask, myUnits, today} from '../store';
import {useEffect} from 'react';
import {arrival} from '../arrive';
import type {ComposePreset} from './Compose';
import {itemsInRange, rowsOn, sundayOf} from '../days';
import {DayList, InboxCards, QuickInput, ReceivedCards, useDirection, useWide, type Ctx} from './common';

const WD = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 홈 — 주인공은 오늘(고른 날) 할 일. 이번 주는 그 위에 흐름으로만.
 * PC: 위에 이번 주(날마다 할 일 제목 세 줄까지), 아래 고른 날 목록을 크게. 상세는 오른쪽에서 덮는다.
 * 폰: 위에 이번 주 한 줄 달력, 아래 고른 날 목록.
 * 둘 다 맨 아래 빠른 입력. 한 달은 달력에서.
 */
export function Home({s, setS, open, setOpen, toast, sel, setSel, onCompose, onSettle}: Ctx & {sel: string; setSel: (d: string) => void; onCompose: (p: ComposePreset) => void; onSettle: () => void}) {
  const start = sundayOf(sel);
  const days = Array.from({length: 7}, (_, i) => addDays(start, i));
  const busy = itemsInRange(s, days[0], days[6]);
  const d0 = parse(days[0]), d6 = parse(days[6]);
  const label = d0.getMonth() === d6.getMonth()
    ? `${d0.getFullYear()}년 ${d0.getMonth() + 1}월`
    : `${d0.getMonth() + 1}월 · ${d6.getMonth() + 1}월`;
  const day = today();
  // 업무분장을 고르고 일정이 채워진 직후: 이번 주 칸 → 칸 안 할 일 → 오늘 할 일 줄을 차례로 띄운다(하나 240ms, 튕김 없음)
  useEffect(() => {
    if (!arrival.pending) return;
    arrival.pending = false;
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const els = [...document.querySelectorAll<HTMLElement>('.main .wday, .main .week .wd, .main .wday .it, .main .daylist .row, .main .daylist .day > h3, .main .quick')];
    els.forEach((el, i) => el.animate(calm ? [{opacity: 0}, {opacity: 1}] : [{opacity: 0, transform: 'translateY(10px)'}, {opacity: 1, transform: 'none'}],
      {duration: 240, delay: 120 + i * 45, easing: 'cubic-bezier(.2,0,0,1)', fill: 'backwards'}));
  }, []);
  const dir = useDirection(start);
  const wide = useWide();
  // 맡은 업무가 없을 때: 홈에서 고르지 않고 자리 잡기 흐름으로 보낸다(업무는 늘 같은 전용 화면에서 정한다)
  const empty = myUnits(s).length === 0;
  const picker = (
    <div className="card empty-units">
      <h2>맡은 업무가 없습니다</h2>
      <p className="lead">발령으로 새 자리에 왔거나 업무를 모두 넘긴 경우입니다. 받을 인수인계를 먼저 받고, 맡을 업무를 고르면 반복업무가 오늘과 달력에 들어옵니다.</p>
      <button className="primary" onClick={onSettle}>자리 잡기</button>
    </div>
  );
  const quick = (
    <QuickInput base={sel} onDetail={onCompose} onAdd={p => {
      setS(addTask(s, p));
      if (p.date && p.date !== sel) setSel(p.date);
      toast(p.rule ? '반복 할 일을 넣었습니다' : '할 일을 넣었습니다');
    }} />
  );

  if (wide) {
    return (
      <section className="list with-input wk">
        <div className="cal-h">
          <h2>{days[1].slice(0, 4) === day.slice(0, 4) ? '' : `${days[1].slice(0, 4)}년 `}{dateLabel(days[1]).replace(/ \(.\)$/, '')} – {days[5].slice(5, 7) === days[1].slice(5, 7) ? '' : `${parse(days[5]).getMonth() + 1}월 `}{parse(days[5]).getDate()}일</h2>
          <div className="cal-nav">
            <button onClick={() => { setSel(addDays(sel, -7)); setOpen(null); }}>지난주</button>
            <button onClick={() => { setSel(day); setOpen(null); }} disabled={days.includes(day) && sel === day}>이번 주</button>
            <button onClick={() => { setSel(addDays(sel, 7)); setOpen(null); }}>다음 주</button>
          </div>
        </div>
        <WeekFlow s={s} days={days} sel={sel} setSel={setSel} setOpen={setOpen} dir={dir} />
        <InboxCards s={s} setS={setS} toast={toast} />
        <ReceivedCards s={s} setS={setS} />
        {empty ? picker : <DayList s={s} date={sel} open={open} setOpen={setOpen} />}
        {!empty && quick}
      </section>
    );
  }

  return (
    <section className="list with-input">
      <div className="week">
        <div className="week-h">
          <b>{label}</b>
          <span>
            <button className="textbtn" onClick={() => setSel(addDays(sel, -7))}>지난주</button>
            {!days.includes(day) || sel !== day ? <button className="textbtn" onClick={() => setSel(day)}>오늘</button> : null}
            <button className="textbtn" onClick={() => setSel(addDays(sel, 7))}>다음 주</button>
          </span>
        </div>
        <div key={start} className={`week-d slide-${dir}`} role="tablist" aria-label="이번 주">
          {days.map(d => {
            const n = busy.get(d)?.filter(r => !r.done).length ?? 0;
            const off = weekday(d) === 0 || !!HOLIDAYS[d];
            return (
              <button key={d} role="tab" aria-selected={d === sel}
                className={`wd${d === sel ? ' on' : ''}${d === day ? ' today' : ''}${off ? ' off' : ''}`}
                onClick={() => { setSel(d); setOpen(null); }}>
                <small>{WD[weekday(d)]}</small>
                <b>{parse(d).getDate()}</b>
                <i className={n > 0 ? 'has' : ''} aria-label={n > 0 ? `할 일 ${n}건` : undefined} />
              </button>
            );
          })}
        </div>
      </div>

      <InboxCards s={s} setS={setS} toast={toast} />
        <ReceivedCards s={s} setS={setS} />
      {empty ? picker : <DayList s={s} date={sel} open={open} setOpen={setOpen} />}
      {!empty && quick}
    </section>
  );
}

/**
 * PC 이번 주 — 날마다 그날 할 일 제목을 세 줄까지(매일 하는 일은 빼고). 넘치면 +n.
 * 그날만의 일(한 번·매월·분기·매년)은 굵게, 매주는 보통. 끝낸 일은 흐리게 줄 긋는다. 경고색은 쓰지 않는다.
 * 업무 색 옆줄은 쓰지 않는다(상태 없는 옆줄 강조선 금지, nhisreminder 문서 25). 자세한 것은 아래 고른 날 목록에서 본다.
 */
function WeekFlow({s, days, sel, setSel, setOpen, dir}: Pick<Ctx, 's' | 'setOpen'> & {days: string[]; sel: string; setSel: (d: string) => void; dir: string}) {
  const day = today();
  const shown = [...days.slice(1, 6), ...[days[0], days[6]].filter(d => rowsOn(s, d).some(r => r.kind !== 'daily'))].sort();
  return (
    <div key={days[0]} className={`wdays slide-${dir}`} role="group" aria-label="이번 주"
      style={{gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))`}}>
      {shown.map(d => {
        const rows = rowsOn(s, d).filter(r => r.kind !== 'daily');
        const more = rows.length - 3;
        return (
          <button key={d} className={`wday${d === day ? ' today' : ''}${d === sel ? ' on' : ''}${HOLIDAYS[d] || weekday(d) === 0 || weekday(d) === 6 ? ' off' : ''}`}
            onClick={() => { setSel(d); setOpen(null); }} aria-pressed={d === sel}
            aria-label={`${dateLabel(d)}${d === day ? ', 오늘' : ''}: ${rows.map(r => r.title).join(', ') || '할 일 없음'}`}>
            <span className="wday-h"><small>{d === day ? '오늘' : WD[weekday(d)]}</small><b>{parse(d).getDate()}</b>{HOLIDAYS[d] && <em>{HOLIDAYS[d]}</em>}</span>
            <span className="wday-l" aria-hidden="true">
              {rows.slice(0, 3).map((r, i) => (
                <span key={i} className={`it${r.when?.startsWith('매주') ? '' : ' sp'}${r.done ? ' done' : ''}`}>{r.title}</span>
              ))}
              {more > 0 && <span className="more">+{more}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
