import {myNotices, readAll, readNotice, type State} from '../store';
import type {Notice} from '../model';
import {ago} from './common';

const KIND: Record<Notice['kind'], string> = {deadline: '마감', handover: '인수인계', dept: '부서 요청', standard: '업무 표준'};

/** 알림 내역 — 새로 온 것을 시간순으로. 누르면 해당 화면으로 가고 읽음 처리된다. */
export function Notices({s, setS, onGo}: {s: State; setS: (s: State) => void; onGo: (n: Notice) => void}) {
  const list = myNotices(s);
  const unread = list.filter(n => !n.read).length;
  return (
    <section className="list">
      <div className="lh">
        <h2>알림</h2>
        {unread > 0 && <button className="textbtn" onClick={() => setS(readAll(s))}>모두 읽음</button>}
      </div>
      {list.length === 0 && <p className="none">알림이 없습니다. 마감, 인수인계, 부서 요청, 업무 표준 소식이 생기면 여기에 쌓입니다.</p>}
      {list.length > 0 && <div className="card">
      {list.map(n => (
        <button key={n.id} className={`row notice${n.read ? '' : ' unread'}`}
          onClick={() => { setS(readNotice(s, n.id)); if (n.go) onGo(n); }}>
          <span className="t">
            <small className="k">{KIND[n.kind]}</small>
            {n.title}
            {n.body && <small>{n.body}</small>}
          </span>
          <span className="st">{ago(n.at)}</span>
        </button>
      ))}
      </div>}
    </section>
  );
}
