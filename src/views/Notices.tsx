import {canApprove, dispatchById, doneForMe, myNotices, readAll, readNotice, unitById, type State} from '../store';
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
export function NoticePanel({s, setS, onClose, onGo}: {s: State; setS: (s: State) => void; onClose: () => void; onGo: (n: Notice) => void}) {
  const list = myNotices(s);
  const unread = list.filter(n => !n.read).length;
  const act = list.filter(n => waiting(s, n)), rest = list.filter(n => !waiting(s, n));
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
      {list.length === 0 && <section><p className="none">알림이 없습니다</p></section>}
      {act.length > 0 && (
        <section>
          <h4>처리할 것 {act.length}</h4>
          {act.map(row)}
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
