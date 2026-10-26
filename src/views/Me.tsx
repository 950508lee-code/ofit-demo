import {AccountSwitch} from './AccountSwitch';
import {Work, type WorkSub} from './Work';
import {dateLabel, ruleLabel} from '../schedule';
import {deptPath, dispatchProgress, logout, orgName, sentDispatches, seriesById, today, type State} from '../store';
import {askPermission, preview, type Perm} from '../notify';
import {summarize} from '../days';
import type {Ctx} from './common';

export function Me({s, setS, open, setOpen, toast, perm, setPerm, onSwitch, sub, setSub, onHome}: Ctx & {
  onSwitch: (n: State) => void; perm: Perm; setPerm: (p: Perm) => void;
  sub: WorkSub; setSub: (m: WorkSub) => void; onHome: () => void;
}) {
  const work = <Work s={s} setS={setS} open={open} setOpen={setOpen} toast={toast} sub={sub} setSub={setSub} onHome={onHome} />;
  if (sub.kind !== 'main') return work;
  const me = s.people.find(p => p.id === s.me)!;


  return (
    <section className="list me">
      <div className="me-h">
        <h2>{me.name}</h2>
        <p>{orgName(s, me.org)}{me.deptId ? ` · ${deptPath(s, me.deptId)}` : ''}</p>
      </div>

      {work}

      {/* 보낸 요청이 없으면 칸을 두지 않는다 */}
      {sentDispatches(s).length > 0 && <div className="card">
      <div className="sec-h"><h3 className="dept">보낸 요청</h3></div>
      {/* 반복으로 보낸 것은 묶음 하나로 — 다가오는 회차(없으면 마지막 회차)를 연다 */}
      {(() => {
        const day = today(), seen = new Set<string>();
        return sentDispatches(s).slice().sort((a, b) => a.due.localeCompare(b.due)).filter(d => {
          if (!d.seriesId) return true;
          if (seen.has(d.seriesId)) return false;
          const all = s.dispatches.filter(x => x.seriesId === d.seriesId).sort((a, b) => a.due.localeCompare(b.due));
          const open1 = (x: typeof d) => { const pr = dispatchProgress(s, x); return pr.done < pr.all; };
          const pick = all.find(x => x.due >= day && open1(x)) ?? all.find(x => x.due >= day) ?? all[all.length - 1];
          if (pick.id !== d.id) return false;
          seen.add(d.seriesId); return true;
        }).reverse().map(d => {
          const pr = dispatchProgress(s, d);
          const sr = seriesById(s, d.seriesId);
          const sel = open?.kind === 'dispatch' && open.id === d.id;
          return (
            <button key={d.id} className={`row${sel ? ' sel' : ''}`} onClick={() => setOpen({kind: 'dispatch', id: d.id})}>
              <span className="t">{d.title}<small>{sr ? `반복 · ${ruleLabel(sr.rule)}${sr.stopped ? ' · 멈춤' : ''} · 이번 ` : ''}{dateLabel(d.due)}까지 · {d.toDepts.length}곳</small></span>
              <span className="st">{pr.all ? `${pr.all}${pr.unit} 중 ${pr.done}${pr.unit} 완료` : '받는 사람 없음'}</span>
            </button>
          );
        });
      })()}
      </div>}

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
