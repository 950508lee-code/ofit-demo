import {flushSync} from 'react-dom';
import {useCallback, useEffect, useRef, useState, type ReactNode} from 'react';
import {addNotice, deptName, dutyById, hasNotice, loadState, meOf, myDuties, occKey, orgName, saveState, today, unitById, unreadCount, type State, roleOf
} from './store';
import {DailyCard, DutyCard, RecsCard, TaskCard, UnitPanel} from './Cards';
import {Login} from './Entry';
import {Splash} from './Splash';
import {leftToday, summarize} from './days';
import {permission, show, type Perm} from './notify';
import {DayList, type Open} from './views/common';
import {DeptPlace} from './views/Place';
import {Know} from './views/Know';
import {Work} from './views/Work';
import {AccountSwitch} from './views/AccountSwitch';
import {PlaceNav, WorkNav, type Place, type Spot} from './views/placeNav';
import {Home} from './views/Home';
import {Calendar} from './views/Calendar';
import {Notices} from './views/Notices';
import {Me} from './views/Me';
import type {WorkSub} from './views/Work';
import {Compose, type ComposePreset} from './views/Compose';
import {DispatchCard} from './views/Dispatch';
import {SearchResults} from './views/Search';
import {dateLabel} from './schedule';

type View = 'home' | 'calendar' | 'work' | 'know' | 'notices' | 'me' | 'search';

export default function App() {
  const [s, setS] = useState<State>(loadState);
  const [view, setView] = useState<View>('home');
  const [sel, setSel] = useState(today());
  const [workSub, setWorkSub] = useState<WorkSub>({kind: 'main'});
  const [open, setOpen] = useState<Open>(null);
  // 업무 찾기(메뉴가 아니라 왼쪽 위 찾기 칸). '/' 키로 바로 쓴다
  const [q, setQ] = useState('');
  const qRef = useRef<HTMLInputElement>(null);
  const [compose, setCompose] = useState<ComposePreset | null>(null);
  // 알림 한 줄. 되돌릴 수 있는 일(완료)이면 바뀌기 전 상태를 함께 받아 '되돌리기'를 단다(5초).
  const [toastMsg, setToastMsg] = useState<{m: string; undo?: State; n: number} | null>(null);
  const setToast = (m: string, undo?: State) => setToastMsg(t => (m ? {m, undo, n: (t?.n ?? 0) + 1} : null));
  const [splash, setSplash] = useState(true);
  const [perm, setPerm] = useState<Perm>(permission);
  const endSplash = useCallback(() => setSplash(false), []);
  // 자리 화면(업무·부서). 열려 있으면 본문을 대신하고, 메뉴 표시는 원래 화면에 남긴다.
  const [place, setPlace] = useState<Place | null>(null);
  // 찾기 결과에서 왔으면 업무지식 안에서 그 자리로 가서 찾은 말을 강조한다
  const [spot, setSpot] = useState<Spot | null>(null);
  // 업무지식에서 고른 업무(없으면 PC는 내 첫 업무, 폰은 목록) · 내 업무에서 펼쳐 보일 업무
  const [knowId, setKnowId] = useState<string | null>(null);
  const [workFocus, setWorkFocus] = useState<string | null>(null);
  // 시연용 계정 바꾸기를 한 번이라도 쓰면 본문 위에 '누구로 보는 중' 띠
  const [viewing, setViewing] = useState(false);
  // 상세 패널 닫기: 밀려 나가는 움직임이 끝난 뒤에 닫는다(PC 180ms·폰 250ms, 움직임 줄이기 120ms)
  const [leaving, setLeaving] = useState(false);
  useEffect(() => setLeaving(false), [open]);
  const escRef = useRef<() => void>(() => {});
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('.scrim')) escRef.current();
      const t = e.target as HTMLElement;
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(t.tagName) && !t.isContentEditable) { e.preventDefault(); qRef.current?.focus(); }
    };
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
  // 찾기는 쓰는 동안 화면이 바뀌므로 전환 움직임 없이 바로 결과로 간다(입력 칸 초점 유지)
  const toSearch = () => { setView('search'); setPlace(null); setOpen(null); };
  const go = (v: View, then?: () => void) =>
    swap(() => { setView(v); setOpen(null); setPlace(null); setWorkSub({kind: 'main'}); setSpot(null); setWorkFocus(null); if (v === 'know') setKnowId(null); then?.(); }, v === view && !place);
  // 업무 이름표를 누르면 그 업무의 업무지식으로, 부서 이름표는 부서 화면으로.
  const goPlace = (p: Place, sp?: Spot) => swap(() => {
    setOpen(null); setSpot(sp ?? null);
    if (p.kind === 'unit') { setPlace(null); setView('know'); setKnowId(p.id); } else setPlace(p);
  });
  // 업무지식 '내 업무에서 보기' → 내 업무에서 그 업무를 펼친다
  const goWork = (unitId?: string) => swap(() => { setPlace(null); setOpen(null); setView('work'); setWorkSub({kind: 'main'}); setWorkFocus(unitId ?? null); });

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
    panel = <UnitPanel key={u.id} {...panelProps} unit={u} onGive={() => { setOpen(null); setView('work'); setWorkSub({kind: 'send', preselect: u.id}); }} />;
  }
  if (open?.kind === 'recs') {
    const u = unitById(s, open.id);
    if (u) panel = <RecsCard key={`recs${u.id}`} s={s} onClose={onClose} unit={u} />;
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
    work: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18" /></>,
    me: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="10" r="3" /><path d="M6.5 18.5c1.2-2 3.1-3 5.5-3s4.3 1 5.5 3" /></>,
  };
  // PC: 오늘 · 달력 · 내 업무 · 업무지식. 폰: 오늘 · 달력 · 업무(안에서 내 업무/업무지식) · 내 정보. 알림은 둘 다 위쪽 숫자 버튼(2026-10-26).
  const NAV: {id: View; label: string; count?: number; badge?: boolean; only?: 'd' | 'm'; also?: View}[] = [
    {id: 'home', label: '오늘', count: left},
    {id: 'calendar', label: '달력'},
    {id: 'work', label: '내 업무', only: 'd'},
    {id: 'know', label: '업무지식', only: 'd'},
    {id: 'work', label: '업무', only: 'm', also: 'know'},
    {id: 'me', label: '내 정보', only: 'm'},
  ];
  const on = (n: (typeof NAV)[number]) => !place && (view === n.id || view === n.also);

  return (
    <PlaceNav.Provider value={goPlace}><WorkNav.Provider value={goWork}>
      <div className="shell">
        <aside className="side">
          <div className="brand-row">
            <div className="brand" data-logo>OFIT</div>
            <button className={`topalarm${view === 'notices' ? ' on' : ''}`} aria-current={view === 'notices' ? 'page' : undefined} onClick={() => go('notices')}
              aria-label={unread ? `알림 ${unread}개 안 읽음` : '알림'}>
              알림{unread > 0 && <em className="badge">{unread}</em>}
            </button>
          </div>
          <button className="primary newbtn" onClick={() => setCompose({target: 'me', date: view === 'home' || view === 'calendar' ? sel : today()})}>일정 등록</button>
          <label className="srch d-only">
            <input ref={qRef} value={q} placeholder="업무 찾기" aria-label="업무 찾기"
              onChange={e => { setQ(e.target.value); toSearch(); }}
              onFocus={() => { if (q.trim()) toSearch(); }} />
            {!q && <kbd aria-hidden="true">/</kbd>}
          </label>
          <nav className="nav" aria-label="메뉴">
            {NAV.map(n => (
              <button key={n.id + n.label} className={`${on(n) ? 'on' : ''}${n.only ? ` ${n.only}-only` : ''}`}
                aria-current={on(n) ? 'page' : undefined} onClick={() => go(n.id)}>
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
          <div className={`body${place ? '' : view === 'calendar' ? ' calbody' : view === 'know' ? ' knowbody' : ''}`}>
            {!place && (view === 'work' || view === 'know') && (
              <div className="seg2 worktabs m-only" role="tablist" aria-label="업무">
                <button role="tab" aria-selected={view === 'work'} className={view === 'work' ? 'on' : ''} onClick={() => go('work')}>내 업무</button>
                <button role="tab" aria-selected={view === 'know'} className={view === 'know' ? 'on' : ''} onClick={() => go('know')}>업무지식</button>
              </div>
            )}
            {place?.kind === 'dept' && <DeptPlace {...ctx} id={place.id} onBack={() => swap(() => { setPlace(null); setOpen(null); })} />}
            {!place && view === 'work' && <Work {...ctx} sub={workSub} setSub={setWorkSub} focus={workFocus} onHome={() => go('home', () => setSel(today()))} />}
            {!place && view === 'know' && <Know {...ctx} id={knowId} setId={id => { setKnowId(id); setSpot(null); setOpen(null); }} spot={spot} />}
            {!place && view === 'home' && <Home onSettle={() => go('work', () => setWorkSub({kind: 'settle', mode: 'empty'}))} {...ctx} sel={sel} setSel={setSel} onCompose={p => setCompose({...p, target: 'me'})} />}
            {!place && view === 'search' && <SearchResults s={s} q={q} />}
            {!place && view === 'calendar' && <Calendar {...ctx} sel={sel} setSel={setSel} />}
            {!place && view === 'notices' && <Notices s={s} setS={setS} onGo={n => go(n.go === 'me' ? (n.kind === 'standard' ? 'know' : 'work') : n.go!, () => { if (n.go === 'home') setSel(today()); if (n.dispatchId) setOpen({kind: 'dispatch', id: n.dispatchId}); })} />}
            {!place && view === 'me' && <Me onSwitch={n => { setS(n); setViewing(true); go('home'); setSel(today()); }} s={s} setS={setS} perm={perm} setPerm={setPerm} />}
            {panel && <div className={`pw${leaving ? ' out' : ''}`}>{panel}</div>}
          </div>
        </main>
      </div>
      {compose && (
        <Compose s={s} setS={setS} preset={compose} onClose={() => setCompose(null)}
          onDone={(msg, date, to) => {
            setCompose(null); setToast(msg);
            if (to?.sent) { setView('work'); setPlace(null); setWorkSub({kind: 'main'}); setOpen(null); }
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
    </WorkNav.Provider></PlaceNav.Provider>
  );
}
