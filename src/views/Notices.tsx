import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {canApprove, dispatchById, doneForMe, myNotices, readAll, readNotice, recentChanges, unitById, type Change, type State} from '../store';
import type {Notice} from '../model';
import {Head} from '../Cards';
import {monthDay} from '../schedule';
import {ago} from './common';

const KIND: Record<Notice['kind'], string> = {deadline: '마감', handover: '인수인계', dept: '요청', standard: '업무 표준'};

/**
 * 지금도 처리를 기다리는 알림이면 그 사정(받기 기다림·n일까지·검토 기다림). 처리했으면 빈 값 — 아래 '알림'으로 내려간다.
 * 알림이 생길 때가 아니라 지금 상태로 가른다(받거나 끝내면 바로 내려감).
 */
export function waiting(s: State, n: Notice): string {
  if (n.kind === 'handover' && n.handoverId) {
    const h = s.handovers.find(x => x.id === n.handoverId);
    return h && h.state === 'pending' && h.to === s.me ? '받기 기다림' : '';
  }
  if (n.kind === 'dept' && n.go === 'home' && n.dispatchId) {
    const d = dispatchById(s, n.dispatchId);
    return d && !doneForMe(s, d) ? `${monthDay(d.due)}까지` : '';
  }
  if (n.kind === 'standard' && n.proposalId) {
    const p = s.proposals.find(x => x.id === n.proposalId);
    const series = p ? (p.newUnit?.series ?? (p.unitId ? unitById(s, p.unitId)?.series : '') ?? '') : '';
    return p && p.state === 'pending' && p.by !== s.me && canApprove(s, series) ? '검토 기다림' : '';
  }
  return '';
}

/**
 * 알림 판 — 오른쪽 위 종을 누르면 오른쪽에 열린다(2026-10-26 사용자 판정: 왼쪽은 이동, 오른쪽은 확인과 처리).
 * 처리할 것(인수인계 받기·받은 요청·업무 표준 검토)을 먼저, 그 아래 확인만 하면 되는 알림. 누르면 그 업무·인수인계 화면으로 간다.
 */
export function NoticePanel({s, setS, onClose, onGo, onUnit}: {s: State; setS: (s: State) => void; onClose: () => void; onGo: (n: Notice) => void; onUnit: (unitId: string) => void}) {
  const list = myNotices(s);
  const unread = list.filter(n => !n.read).length;
  const act = list.filter(n => waiting(s, n)), rest = list.filter(n => !waiting(s, n));
  const changes = recentChanges(s);
  const row = (n: Notice) => (
    <button key={n.id} className={`row notice${n.read ? '' : ' unread'}`} onClick={() => { setS(readNotice(s, n.id)); onGo(n); }}>
      <span className="t">
        <small className="k">{KIND[n.kind]}</small>
        {n.title}
        {n.body && <small>{n.body}</small>}
      </span>
      <span className="st">{waiting(s, n) || ago(n.at)}</span>
    </button>
  );
  return (
    <aside className="detail notices" aria-label="알림">
      <Head title="알림" sub={unread ? `안 읽은 알림 ${unread}개` : '모두 읽었습니다'} onClose={onClose} />
      {list.length === 0 && changes.length === 0 && <section><p className="none">알림이 없습니다</p></section>}
      {act.length > 0 && (
        <section>
          <h4>처리할 것 {act.length}</h4>
          {act.map(row)}
        </section>
      )}
      {changes.length > 0 && (
        <section>
          <h4>내 업무에서 바뀐 것</h4>
          {changes.map(c => (
            <button key={c.key} className="row notice" onClick={() => onUnit(c.unitId)}>
              <span className="t"><small className="k">{c.kind}</small>{c.title}<small>{c.sub}</small></span>
              <span className="st">{monthDay(c.at)}</span>
            </button>
          ))}
        </section>
      )}
      {rest.length > 0 && (
        <section>
          <div className="sh-row">
            <h4>알림</h4>
            {unread > 0 && <button className="textbtn" onClick={() => setS(readAll(s))}>모두 읽음</button>}
          </div>
          {rest.map(row)}
        </section>
      )}
    </aside>
  );
}

/**
 * 오늘 화면 맨 위 인사말 아래 알림 한 줄(2026-10-26 사용자: "알림은 한 줄 전광판으로, 누르면 알림 창").
 * 처리할 것 → 안 읽은 알림 → 내 업무에서 바뀐 것 순서로 한 줄에 이어 붙이고, 칸보다 길면 오른쪽에서 왼쪽으로 천천히 흐른다.
 * 마우스를 올리거나 칸에 들어가면 멈추고, '멈춤'으로 세울 수 있다(5초 넘게 저절로 움직이는 것은 멈출 수 있어야 한다).
 * 움직임 줄이기면 흐르지 않는다. 줄을 누르면 오른쪽 알림 판이 열린다. 보일 것이 없으면 줄을 두지 않는다.
 */
type Tick = {key: string; k: string; t: string; sub: string; strong: boolean};
export function NoticeTicker({s, onOpen}: {s: State; onOpen: () => void}) {
  const list = myNotices(s);
  const act = list.filter(n => waiting(s, n));
  const items: Tick[] = [
    ...act.map(n => ({key: n.id, k: KIND[n.kind], t: n.title, sub: waiting(s, n), strong: true})),
    ...list.filter(n => !n.read && !waiting(s, n)).map(n => ({key: n.id, k: KIND[n.kind], t: n.title, sub: ago(n.at), strong: true})),
    ...recentChanges(s).map((c: Change) => ({key: c.key, k: c.kind, t: c.title, sub: monthDay(c.at), strong: false})),
  ].slice(0, 8);
  const win = useRef<HTMLDivElement>(null), run = useRef<HTMLDivElement>(null);
  const [over, setOver] = useState(0); // 칸을 넘친 길이(px). 0이면 흐르지 않는다
  const [stop, setStop] = useState(false);
  const sig = items.map(i => i.key + i.sub).join('|');
  useLayoutEffect(() => {
    const w = win.current, r = run.current;
    if (!w || !r) return;
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const one = (r.firstElementChild as HTMLElement | null)?.offsetWidth ?? 0;
    setOver(!calm && one > w.clientWidth ? one : 0);
  }, [sig]);
  useEffect(() => { if (!over) setStop(false); }, [over]);
  if (!items.length) return null;
  const line = (dup?: boolean) => (
    <span className="tk-set" aria-hidden={dup || undefined}>
      {items.map(i => (
        <span key={i.key} className="tk-it"><small>{i.k}</small><b className={i.strong ? 'on' : ''}>{i.t}</b><span>{i.sub}</span></span>
      ))}
    </span>
  );
  return (
    <div className="tk">
      <button className="tk-main" onClick={onOpen} aria-label={`알림 열기. ${items.map(i => `${i.k} ${i.t}`).join(', ')}`}>
        <span className="tk-k">알림{act.length > 0 && <b> 처리할 것 {act.length}</b>}</span>
        <span ref={win} className={`tk-win${over ? ' moving' : ''}`}>
          <span ref={run} className={`tk-run${over && !stop ? ' go' : ''}`} style={over ? {animationDuration: `${Math.round(over / 40)}s`} : undefined}>
            {line()}{over > 0 && line(true)}
          </span>
        </span>
      </button>
      {over > 0 && <button className="textbtn tk-stop" onClick={() => setStop(x => !x)} aria-pressed={stop}>{stop ? '흐르기' : '멈춤'}</button>}
    </div>
  );
}
