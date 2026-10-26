import {AccountSwitch} from './AccountSwitch';
import {deptPath, logout, orgName, type State} from '../store';
import {askPermission, preview, type Perm} from '../notify';
import {summarize} from '../days';
import type {Ctx} from './common';

/** 내 정보 — 이름·소속, 알림 설정, (시연) 계정 바꾸기, 로그아웃. 업무 판들은 내 업무로 옮겼다(2026-10-26). */
export function Me({s, setS, perm, setPerm, onSwitch}: Pick<Ctx, 's' | 'setS'> & {
  onSwitch: (n: State) => void; perm: Perm; setPerm: (p: Perm) => void;
}) {
  const me = s.people.find(p => p.id === s.me)!;


  return (
    <section className="list me">
      <div className="me-h">
        <h2>{me.name}</h2>
        <p>{orgName(s, me.org)}{me.deptId ? ` · ${deptPath(s, me.deptId)}` : ''}</p>
      </div>

      <div className="card">
      <div className="sec-h"><h3 className="dept">알림</h3></div>
      <div className="row static">
        <span className="t">윈도우 알림
          <small>{perm === 'granted' ? '켜짐 · 9시에 오늘 할 일, 시간 정해진 일은 10분 전'
            : perm === 'denied' ? '막혀 있습니다. 브라우저 주소창 왼쪽에서 허용해 주세요'
            : perm === 'unsupported' ? '이 브라우저는 알림을 지원하지 않습니다'
            : '오핏 창이 열려 있으면 마감을 윈도우 알림으로 알려 줍니다'}</small>
        </span>
        {perm === 'default' && <button className="ghost strong" onClick={async () => setPerm(await askPermission())}>켜기</button>}
        {perm === 'granted' && <button className="ghost" onClick={() => { const x = summarize(s); preview(x.title, x.body || '오핏 알림이 이렇게 뜹니다'); }}>미리 보기</button>}
      </div>
      </div>

      <div className="card m-only-block">
        <div className="sec-h"><h3 className="dept">시연용 계정 바꾸기</h3></div>
        <AccountSwitch inline s={s} onSwitch={onSwitch} />
      </div>

      <div className="sec-end">
        <button className="textbtn" onClick={() => setS(logout(s))}>로그아웃</button>
      </div>
    </section>
  );
}
