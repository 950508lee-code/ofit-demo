import {useEffect, useLayoutEffect, useRef, useState, type RefObject} from 'react';
import {addDays, dateLabel, monthDay, ruleLabel} from '../schedule';
import {parseInput, type Parsed} from '../parse';
import {acceptHandover, declineHandover, inboxOf, nameOf, occKey, receivedRecently, recordsOfUnit, seeHandover, today, type State} from '../store';
import {itemsInRange, overdue, rowsOn, type Row} from '../days';
import {placeColor} from './placeColor';
import {Upcoming} from '../Handover';
import {usePlaceNav} from './placeNav';
import {Pips} from './shapes';
import type {CSSProperties} from 'react';

export type Open = {kind: 'duty' | 'task'; id: string; date: string} | {kind: 'daily'; date: string} | {kind: 'unit'; id: string} | {kind: 'gevent'; id: string} | {kind: 'dispatch'; id: string} | null;
export type Ctx = {s: State; setS: (s: State) => void; open: Open; setOpen: (o: Open) => void; toast: (m: string, undo?: State) => void};

const isSel = (open: Open, r: Row) =>
  !!open && (r.kind === 'gitem' ? open.kind === 'gevent' && open.id === r.ref
    : r.kind === 'drecv' ? open.kind === 'dispatch' && open.id === r.id
    : open.kind === r.kind && 'date' in open && open.date === r.date && (r.kind === 'daily' || ('id' in open && open.id === r.id)));

/**
 * 할 일 한 줄 — 제목 / 자리 이름표 / 리듬·사정. 오른쪽 끝은 상태(또는 right).
 * 줄을 누르면 상세, 이름표를 누르면 그 자리 화면.
 */
export function RowButton({r, open, setOpen, showDate, k, right, s}: {r: Row; open: Open; setOpen: (o: Open) => void; showDate?: boolean; k?: string; right?: string; s?: State}) {
  const day = today();
  const pc = s && r.at ? ({'--pc': placeColor(s, r.at)} as CSSProperties) : undefined;
  const goPlace = usePlaceNav();
  const late = !r.done && !!r.date && r.date < day;
  const pick = () => setOpen(r.kind === 'daily' ? {kind: 'daily', date: r.date || day} : r.kind === 'gitem' ? {kind: 'gevent', id: r.ref!} : r.kind === 'drecv' ? {kind: 'dispatch', id: r.id} : {kind: r.kind, id: r.id, date: r.date});
  return (
    <div className={`row${isSel(open, r) ? ' sel' : ''}`} data-k={k}>
      <span className={`dot${r.done ? ' done' : late ? ' late' : ''}`} />
      <span className="t">
        <button className="row-main" onClick={pick}>{r.title}</button>
        {(r.place || r.when || showDate || r.count) && (
          <span className="meta">
            {r.count && <Pips done={r.count.done} all={r.count.all} />}
            {r.place && (r.at
              ? <button className="place" style={pc} onClick={() => goPlace(r.at!)} aria-label={`${r.place} 자리 보기`}>{r.place}</button>
              : <span className="place" style={pc}>{r.place}</span>)}
            {(r.when || showDate) && <span className="when">{[showDate ? dateLabel(r.date) : '', r.when].filter(Boolean).join(' · ')}</span>}
          </span>
        )}
      </span>
      <span className="st">{right ?? (r.kind === 'daily' ? '' : r.done ? '완료' : late ? '기한 지남' : r.time ?? '')}</span>
    </div>
  );
}

/** 줄 자리가 바뀌면(완료해서 아래로 등) 이전 자리에서 새 자리로 미끄러지게(FLIP, 120ms 뒤 250ms). data-k 붙은 줄만. */
export function useFlip(box: RefObject<HTMLElement | null>) {
  const pos = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const next = new Map<string, number>();
    el.querySelectorAll<HTMLElement>('[data-k]').forEach(n => {
      // 줄이 든 칸 기준 위치 — 화면을 굴려도 움직이지 않게
      const ref = (n.closest('[data-flip]') ?? el).getBoundingClientRect().top;
      const y = n.getBoundingClientRect().top - ref;
      const old = pos.current.get(n.dataset.k!);
      next.set(n.dataset.k!, y);
      if (old !== undefined && Math.abs(old - y) > 1 && !calm) {
        n.animate([{transform: `translateY(${old - y}px)`}, {transform: 'none'}], {duration: 250, delay: 120, easing: 'cubic-bezier(.2,0,0,1)', fill: 'backwards'});
      }
    });
    pos.current = next;
  });
}

/** PC 폭(901px 이상)인지. 창 크기를 바꾸면 따라간다. */
export function useWide() {
  const q = '(min-width: 901px)';
  const [wide, setWide] = useState(() => matchMedia(q).matches);
  useEffect(() => {
    const m = matchMedia(q);
    const f = () => setWide(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  return wide;
}

/** 고른 날의 목록. 오늘이면 기한 지난 일을 맨 위에. */
export function DayList({s, date, open, setOpen}: {s: State; date: string; open: Open; setOpen: (o: Open) => void}) {
  const day = today();
  const rows = rowsOn(s, date);
  const late = date === day ? overdue(s, day) : [];
  const box = useRef<HTMLDivElement>(null);
  useFlip(box);
  return (
    <div className="daylist" ref={box}>
      {late.length > 0 && (
        <div className="day">
          <h3 className="late">기한 지난 일 {late.length}</h3>
          {late.map(r => { const k = `l${r.kind}${occKey(r.id, r.date)}`; return <RowButton key={k} k={k} s={s} r={r} open={open} setOpen={setOpen} showDate />; })}
        </div>
      )}
      <div className="day">
        <h3 className={date === day ? 'today' : ''}>{date === day ? `오늘 · ${dateLabel(date)}` : dateLabel(date)}</h3>
        {rows.length === 0 && <p className="none">이 날은 할 일이 없습니다</p>}
        {rows.map(r => { const k = `${r.kind}${occKey(r.id, r.date)}`; return <RowButton key={k} k={k} s={s} r={r} open={open} setOpen={setOpen} />; })}
      </div>
    </div>
  );
}

/** 빠른 입력 — 쓰는 동안 어떻게 읽었는지 보여 준다. */
export function QuickInput({base, onAdd, onDetail}: {base: string; onAdd: (p: Parsed) => void; onDetail?: (p: Partial<Parsed>) => void}) {
  const [text, setText] = useState('');
  const p = text.trim() ? parseInput(text, today()) : null;
  const when = p ? (p.rule ? ruleLabel(p.rule) : dateLabel(p.date ?? base)) + (p.time ? ` ${p.time}` : '') : '';
  const submit = () => {
    if (!p?.title) return;
    onAdd(p.rule || p.date ? p : {...p, date: base});
    setText('');
  };
  return (
    <div className="quick">
      {p?.title && <div className="preview"><span><b>{when}</b> · {p.title}</span></div>}
      <div className="qi">
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit(); }}
          placeholder="예) 18일까지 자료 제출" aria-label="할 일 입력" />
        <button className="ghost strong" disabled={!p?.title} onClick={submit}>추가</button>
      </div>
      {onDetail && (
        <button className="textbtn detailbtn" onClick={() => { onDetail(p ? {title: p.title, date: p.date ?? base, time: p.time, rule: p.rule} : {date: base}); setText(''); }}>
          자세히 입력
        </button>
      )}
    </div>
  );
}

/** 받은 인수인계 요청 카드 — 홈 맨 위. */
export function InboxCards({s, setS, toast}: {s: State; setS: (s: State) => void; toast: (m: string, undo?: State) => void}) {
  return (
    <>
      {inboxOf(s).map(h => {
        const names = s.units.filter(x => h.unitIds.includes(x.id)).map(x => x.name).join(', ');
        const recs = h.unitIds.reduce((n, u) => n + recordsOfUnit(s, u).length, 0);
        const extra = h.taskIds.length + (h.itemIds?.length ?? 0);
        const what = [names, extra && `일정 ${extra}개`, recs && `지난 기록 ${recs}건`].filter(Boolean).join(' · ');
        return (
          <div key={h.id} className="inbox">
            <p>{nameOf(s, h.from)} 님이 인수인계를 보냈습니다</p>
            <p className="what"><b>{what}</b></p>
            {h.note && <p className="q">{h.note}</p>}
            <Upcoming s={s} unitIds={h.unitIds} taskIds={h.taskIds} itemIds={h.itemIds} heading="받으면 할 일에 이렇게 들어옵니다" />
            <div className="ib-act">
              <button className="ghost" onClick={() => { setS(declineHandover(s, h.id)); toast('거절했습니다'); }}>거절</button>
              <button className="ghost strong" onClick={() => { setS(acceptHandover(s, h.id)); toast('받았습니다. 할 일에 들어갔습니다'); }}>받기</button>
            </div>
          </div>
        );
      })}
    </>
  );
}

/** '방금', '3분 전', '2시간 전', '4일 전'. */
export function ago(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  if (m < 60 * 24) return `${Math.floor(m / 60)}시간 전`;
  return `${Math.floor(m / 1440)}일 전`;
}

/** 달·주가 바뀐 방향. 앞으로 가면 'next', 뒤로 가면 'prev'. 처음엔 ''(움직이지 않음). */
export function useDirection(key: string) {
  const [m, setM] = useState({key, dir: ''});
  if (m.key !== key) {
    const dir = key > m.key ? 'next' : 'prev';
    setM({key, dir});
    return dir;
  }
  return m.dir;
}

/**
 * 인수인계를 받은 직후 홈 맨 위 — 무엇을 받았고, 다음에 무엇을 언제 하는지, 전임자가 남긴 말.
 * 업무 이름표를 누르면 그 자리 화면(전임자 기록·있었던 사람). 7일이 지나거나 '확인'하면 사라진다.
 */
export function ReceivedCards({s, setS}: {s: State; setS: (s: State) => void}) {
  const goPlace = usePlaceNav();
  const list = receivedRecently(s);
  if (!list.length) return null;
  const ahead = itemsInRange(s, today(), addDays(today(), 120));
  const nextOf = (unitId: string) => {
    for (const d of [...ahead.keys()].sort()) {
      const r = ahead.get(d)!.find(x => x.kind === 'duty' && x.at?.id === unitId && !x.done);
      if (r) return r;
    }
    return undefined;
  };
  return (
    <>
      {list.map(h => {
        const units = s.units.filter(u => h.unitIds.includes(u.id));
        const extra = h.taskIds.length + (h.itemIds?.length ?? 0);
        return (
          <div key={h.id} className="inbox got">
            <p>{nameOf(s, h.from)} 님에게서 받은 업무 · {dateLabel(h.date)}</p>
            {units.map(u => {
              const n = nextOf(u.id);
              const cnt = s.duties.filter(d => d.unitIds.includes(u.id)).length;
              return (
                <div key={u.id} className="got-u" style={{'--pc': placeColor(s, {kind: 'unit', id: u.id})} as CSSProperties}>
                  <button className="place" onClick={() => goPlace({kind: 'unit', id: u.id})}>{u.name}</button>
                  <span>반복업무 {cnt}개{n ? ` · 다음 ${monthDay(n.date)} ${n.title}` : ''}</span>
                </div>
              );
            })}
            {extra > 0 && <p className="what">함께 받은 할 일·그룹 항목 {extra}개</p>}
            {h.note && <p className="q">{nameOf(s, h.from)} 님이 남긴 말 · {h.note}</p>}
            <div className="ib-act">
              <span className="hint">업무 이름을 누르면 전임자 기록과 처리 순서를 볼 수 있습니다</span>
              <button className="ghost" onClick={() => setS(seeHandover(s, h.id))}>확인</button>
            </div>
          </div>
        );
      })}
    </>
  );
}
