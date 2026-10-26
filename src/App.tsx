import {flushSync} from 'react-dom';
import {useCallback, useEffect, useRef, useState, type ReactNode} from 'react';
import {addNotice, deptName, dutyById, hasNotice, loadState, meOf, myDuties, occKey, orgName, saveState, today, unitById, unreadCount, type State, roleOf
} from './store';
import {DailyCard, DutyCard, TaskCard, UnitPanel} from './Cards';
import {Login} from './Entry';
import {Splash} from './Splash';
import {leftToday, summarize} from './days';
import {permission, show, type Perm} from './notify';
import {DayList, type Open} from './views/common';
import {DeptPlace, UnitPlace} from './views/Place';
import {AccountSwitch} from './views/AccountSwitch';
import {PlaceNav, type Place} from './views/placeNav';
import {Home} from './views/Home';
import {Calendar} from './views/Calendar';
import {Notices} from './views/Notices';
import {Me} from './views/Me';
import type {WorkSub} from './views/Work';
import {Compose, type ComposePreset} from './views/Compose';
import {DispatchCard} from './views/Dispatch';
import {dateLabel} from './schedule';

type View = 'home' | 'calendar' | 'notices' | 'me';

export default function App() {
  const [s, setS] = useState<State>(loadState);
  const [view, setView] = useState<View>('home');
  const [sel, setSel] = useState(today());
  const [workSub, setWorkSub] = useState<WorkSub>({kind: 'main'});
  const [open, setOpen] = useState<Open>(null);
  const [compose, setCompose] = useState<ComposePreset | null>(null);
  // 알림 한 줄. 되돌릴 수 있는 일(완료)이면 바뀌기 전 상태를 함께 받아 '되돌리기'를 단다(5초).
  const [toastMsg, setToastMsg] = useState<{m: string; undo?: State; n: number} | null>(null);
  const setToast = (m: string, undo?: State) => setToastMsg(t => (m ? {m, undo, n: (t?.n ?? 0) + 1} : null));
  const [splash, setSplash] = useState(true);
  const [perm, setPerm] = useState<Perm>(permission);
  const endSplash = useCallback(() => setSplash(false), []);
  // 자리 화면(업무·부서). 열려 있으면 본문을 대신하고, 메뉴 표시는 원래 화면에 남긴다.
  const [place, setPlace] = useState<Place | null>(null);
  // 시연용 계정 바꾸기를 한 번이라도 쓰면 본문 위에 '누구로 보는 중' 띠
  const [viewing, setViewing] = useState(false);
  // 상세 패널 닫기: 밀려 나가는 움직임이 끝난 뒤에 닫는다(PC 180ms·폰 250ms, 움직임 줄이기 120ms)
  const [leaving, setLeaving] = useState(false);
  useEffect(() => setLeaving(false), [open]);
  const escRef = useRef<() => void>(() => {});
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.scrim')) escRef.current(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  const closePanel = () => {
    const cur = open;
    const ms = matchMedia('(prefers-reduced-motion: reduce)').matches ? 120 : innerWidth <= 900 ? 250 : 180;
    setLeaving(true);
    setTimeout(() => setOpen(o => (o === cur ? null : o)), ms);
  };

  useEffect(() => saveState(s), [s]);
  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), toastMsg.undo ? 5000 : 3000);
    return () => clearTimeout(t);
  }, [toastMsg]);

  const me = meOf(s);
  useEffect(() => setToastMsg(null), [s.me]);
  // 메뉴 전환(fade through): 본문만 이전 화면 90ms 사라짐 → 새 화면 180ms 살짝 커지며 나타남. 왼쪽 메뉴는 그대로.
  // 본문 바꾸기(fade through): 이전 화면 90ms 사라짐 → 새 화면 180ms 살짝 커지며 나타남. 왼쪽 메뉴는 그대로.
  const swap = (apply: () => void, same = false) => {
    const vt = (document as Document & {startViewTransition?: (f: () => void) => unknown}).startViewTransition;
    if (same || !vt || matchMedia('(prefers-reduced-motion: reduce)').matches) return apply();
    // 창이 가려져 그리기가 멈춰 있으면 전환이 시작되지 않으므로, 250ms 안에 안 되면 그냥 바꾼다
    let done = false;
    const run = () => { if (!done) { done = true; flushSync(apply); } };
    vt.call(document, run);
    setTimeout(() => { if (!done) { done = true; apply(); } }, 250);
  };
  const go = (v: View, then?: () => void) =>
    swap(() => { setView(v); setOpen(null); setPlace(null); setWorkSub({kind: 'main'}); then?.(); }, v === view && !place);
  // 이름표를 누르면 그 자리(업무·부서) 화면으로.
  const goPlace = (p: Place) => swap(() => { setPlace(p); setOpen(null); });

  // 마감 알림: 창이 열려 있는 동안 30초마다 확인해 알림 내역에 쌓고, 허용돼 있으면 윈도우 알림도 띄운다.
  // 외부 서버가 필요 없어 업무망에서도 된다.
  const sRef = useRef(s);
  sRef.current = s;
  useEffect(() => {
    if (!me) return;
    const tick = () => {
      const cur = sRef.current, who = cur.me;
      if (!meOf(cur)) return;
      const day = today(), now = new Date(), min = now.getHours() * 60 + now.getMinutes();
      const sum = summarize(cur, day);
      const adds: {key: string; title: string; body: string}[] = [];
      if (min >= 9 * 60 && min < 18 * 60 && sum.any) adds.push({key: `${who}:morning:${day}`, title: sum.title, body: sum.body});
      for (const t of sum.timed) {
        const [h, m] = t.time.split(':').map(Number), at = h * 60 + m;
        if (min >= at - 10 && min < at) adds.push({key: `${who}:${t.id}@${day}`, title: `${at - min}분 뒤 · ${t.title}`, body: `${t.time} 일정입니다`});
      }
      const fresh = adds.filter(a => !hasNotice(cur, a.key));
      if (!fresh.length) return;
      setS(prev => fresh.reduce((acc, a) => addNotice(acc, {to: who, kind: 'deadline', go: 'home', ...a}), prev));
      if (permission() === 'granted') fresh.forEach(a => show(a.title, a.body, a.key));
    };
    tick();
    const iv = setInterval(tick, 30_000);
    return () => clearInterval(iv);
  }, [me?.id]);

  // 스플래시는 화면 위에 덮어 띄운다 — 로고가 다음 화면의 로고 자리로 날아가 앉도록
  const overlay = splash && <Splash onDone={endSplash} />;

  if (!me) {
    return <><main className="app start"><Login s={s} setS={n => { setS(n); go('home'); setSel(today()); }} /></main>{overlay}</>;
  }

  const ctx = {s, setS, open, setOpen, toast: setToast};
  const unread = unreadCount(s);
  const left = leftToday(s);

  // 달력은 닫아도 오른쪽에 고른 날 목록이 남으므로 바로 바꾼다
  const onClose = view === 'calendar' ? () => setOpen(null) : closePanel;
  escRef.current = () => { if (open) onClose(); };
  const panelProps = {s, setS, toast: setToast, onClose};
  let panel = null;
  if (open?.kind === 'duty') panel = <DutyCard key={occKey(open.id, open.date)} {...panelProps} duty={dutyById(s, open.id)!} date={open.date} />;
  if (open?.kind === 'daily') panel = <DailyCard key={`daily${open.date}`} {...panelProps} date={open.date} duties={myDuties(s).filter(d => d.rule.kind === 'daily')} />;
  if (open?.kind === 'task') {
    const t = s.tasks.find(x => x.id === open.id);
    if (t) panel = <TaskCard key={occKey(open.id, open.date)} {...panelProps} task={t} date={open.date}
      onEdit={() => setCompose({editId: t.id, target: 'me', title: t.title, date: t.rule ? (t.date ?? open.date) : open.date, time: t.time, rule: t.rule})} />;
  }
  if (open?.kind === 'dispatch') panel = <DispatchCard key={open.id} s={s} setS={setS} toast={setToast} onClose={onClose} id={open.id} />;
  if (open?.kind === 'unit') {
    const u = unitById(s, open.id)!;
    panel = <UnitPanel key={u.id} {...panelProps} unit={u} onGive={() => { setOpen(null); setView('me'); setWorkSub({kind: 'send', preselect: u.id}); }} />;
  }
  // 달력에서는 아무것도 열려 있지 않으면 오른쪽에 고른 날 목록을 둔다
  if (!panel && view === 'calendar' && !place) {
    panel = (
      <aside className="detail daypanel" aria-label={dateLabel(sel)}>
        <DayList s={s} date={sel} open={open} setOpen={setOpen} />
      </aside>
    );
  }

  // 폰 아래 탭 아이콘(KRDS: 탭은 아이콘+글자). 선 1.6px 무채색, 외부 파일 없이 직접 그림.
  const ICON: Partial<Record<View, ReactNode>> = {
    home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9v11h14V9" /><path d="M10 20v-6h4v6" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
    me: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="10" r="3" /><path d="M6.5 18.5c1.2-2 3.1-3 5.5-3s4.3 1 5.5 3" /></>,
  };
  const NAV: {id: View; label: string; count?: number; badge?: boolean; only?: 'd' | 'm'}[] = [
    {id: 'home', label: '홈', count: left},
    {id: 'calendar', label: '달력'},
    {id: 'notices', label: '알림', count: unread, badge: true, only: 'd'},
    {id: 'me', label: '내 정보', only: 'm'},
  ];

  return (
    <PlaceNav.Provider value={goPlace}>
      <div className="shell">
        <aside className="side">
          <div className="brand" data-logo>OFIT</div>
          <button className="primary newbtn" onClick={() => setCompose({target: 'me', date: view === 'home' || view === 'calendar' ? sel : today()})}>일정 등록</button>
          <button className={`topalarm m-only${view === 'notices' ? ' on' : ''}`} onClick={() => go('notices')}>
            알림{unread > 0 && <em className="badge">{unread}</em>}
          </button>
          <nav className="nav" aria-label="메뉴">
            {NAV.map(n => (
              <button key={n.id} className={`${view === n.id ? 'on' : ''}${n.only ? ` ${n.only}-only` : ''}`}
                aria-current={view === n.id ? 'page' : undefined} onClick={() => go(n.id)}>
                {ICON[n.id] && <svg className="ico" viewBox="0 0 24 24" aria-hidden="true">{ICON[n.id]}</svg>}
                <span>{n.label}</span>
                {!!n.count && <em className={n.badge ? 'badge' : ''}>{n.count}</em>}
              </button>
            ))}
          </nav>
          <button className={`who d-only${view === 'me' ? ' on' : ''}`} onClick={() => go('me')} aria-current={view === 'me' ? 'page' : undefined}>
            <b>{me.name}</b>
            <span>{deptName(s, me.deptId) || orgName(s, me.org)} · 내 정보</span>
          </button>
          <AccountSwitch s={s} onSwitch={n => { setS(n); setViewing(true); go('home'); setSel(today()); }} />
        </aside>

        <main className="main">
          {viewing && (
            <div className="viewing" role="status">
              <b>{me.name}</b> 님으로 보는 중 · {[deptName(s, me.deptId), roleOf(s, me.id)].filter(Boolean).join(' · ')}
            </div>
          )}
          <div className={`body${place ? '' : view === 'calendar' ? ' calbody' : ''}`}>
            {place?.kind === 'unit' && <UnitPlace {...ctx} id={place.id} onBack={() => swap(() => { setPlace(null); setOpen(null); })}
              onGive={() => go('me', () => setWorkSub({kind: 'send', preselect: place.id}))} />}
            {place?.kind === 'dept' && <DeptPlace {...ctx} id={place.id} onBack={() => swap(() => { setPlace(null); setOpen(null); })} />}
            {!place && view === 'home' && <Home onSettle={() => go('me', () => setWorkSub({kind: 'settle', mode: 'empty'}))} {...ctx} sel={sel} setSel={setSel} onCompose={p => setCompose({...p, target: 'me'})} />}
            {!place && view === 'calendar' && <Calendar {...ctx} sel={sel} setSel={setSel} />}
            {!place && view === 'notices' && <Notices s={s} setS={setS} onGo={n => go(n.go!, () => { if (n.go === 'home') setSel(today()); if (n.dispatchId) setOpen({kind: 'dispatch', id: n.dispatchId}); })} />}
            {!place && view === 'me' && <Me onSwitch={n => { setS(n); setViewing(true); go('home'); setSel(today()); }} {...ctx} perm={perm} setPerm={setPerm} sub={workSub} setSub={setWorkSub} onHome={() => go('home', () => setSel(today()))} />}
            {panel && <div className={`pw${leaving ? ' out' : ''}`}>{panel}</div>}
          </div>
        </main>
      </div>
      {compose && (
        <Compose s={s} setS={setS} preset={compose} onClose={() => setCompose(null)}
          onDone={(msg, date, to) => {
            setCompose(null); setToast(msg);
            if (to?.sent) { setView('me'); setWorkSub({kind: 'main'}); setOpen(null); }
            else { setSel(date); }
          }} />
      )}
      {toastMsg && (
        <div key={toastMsg.n} className={`toast${toastMsg.undo ? ' has-undo' : ''}`} role="status">
          <span>{toastMsg.m}</span>
          {toastMsg.undo && <button onClick={() => { setS(toastMsg.undo!); setToastMsg({m: '되돌렸습니다', n: toastMsg.n + 1}); }}>되돌리기</button>}
        </div>
      )}
      {overlay}
    </PlaceNav.Provider>
  );
}
