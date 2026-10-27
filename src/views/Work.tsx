import {useEffect, useState, type CSSProperties} from 'react';
import {usePlaceNav} from './placeNav';
import {NewUnitModal} from './Standard';
import {RepeatList} from './RepeatList';
import {SettleFlow} from '../Settle';
import {dateLabel, monthDay, occurrences, ruleLabel} from '../schedule';
import {
  cancelHandover, deptName, dispatchProgress, doneForMe, dutiesOfUnit, handoverableTasks, meOf, myDispatches, myUnits, nameOf, nextDateOf,
  orgOf, pendingOf, releaseUnits, sendHandover, sentDispatches, seriesById, takeUnits, today, unitById,
} from '../store';
import type {Handover} from '../model';
import {HandoverFlow} from '../Handover';
import {UnitPicker} from '../ui';
import type {Ctx} from './common';
import {Asks, DutyHead, DutyRows, notedOf} from './Place';
import {placeColor} from './placeColor';

export type WorkSub = {kind: 'main'} | {kind: 'pick'} | {kind: 'send'; preselect?: string} | {kind: 'settle'; mode: 'move' | 'empty'};

/**
 * 내 업무 — '무엇을 해야 하지?'(2026-10-26 사용자 판정: 실행 공간과 지식 공간을 나눈다. 화면은 분리, 데이터는 통합).
 * 맡은 업무마다 접힌 줄(다음 할 일·처리할 받은 요청) → 펼치면 반복업무·받은 요청·지난 기록·업무 표준. 그 아래 반복 할 일 · 인수인계 · 보낸 요청.
 * 처리 방법·업무 안내는 업무지식(Know.tsx)에서 읽는다. sub 가 main 이 아니면 전용 흐름(업무 바꾸기·인수인계·자리 잡기) 화면을 통째로 돌려준다.
 */
export function Work({s, setS, open, setOpen, toast, sub, setSub, onHome, focus}: Ctx & {
  sub: WorkSub; setSub: (m: WorkSub) => void; onHome: () => void; focus?: string | null;
}) {
  const [making, setMaking] = useState(false);
  // 펼친 업무. 업무지식에서 '내 업무에서 보기'로 왔으면 그 업무를 펼치고 그 자리로 옮긴다
  const [wide, setWide] = useState<string[]>(focus ? [focus] : []);
  useEffect(() => {
    if (!focus) return;
    setWide(w => (w.includes(focus) ? w : [...w, focus]));
    const t = setTimeout(() => document.getElementById(`wu-${focus}`)?.scrollIntoView({block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'}), 260);
    return () => clearTimeout(t);
  }, [focus]);

  if (sub.kind === 'settle') {
    return (
      <section className="list">
        <SettleFlow s={s} setS={setS} toast={toast} mode={sub.mode} onCancel={() => setSub({kind: 'main'})} onDone={onHome} />
      </section>
    );
  }

  if (sub.kind === 'pick') {
    return (
      <section className="list">
        {making && <NewUnitModal s={s} setS={setS} toast={toast} onClose={() => setMaking(false)} />}
        <UnitPicker manage onCreate={() => setMaking(true)} s={s} org={orgOf(s)} title="업무 변경" doneLabel="저장"
          lead="체크한 업무가 내 업무입니다. 맡으면 반복업무가 오늘과 달력에 들어오고, 빼면 오늘부터 안 들어옵니다"
          back={{label: '취소', onClick: () => setSub({kind: 'main'})}}
          onDone={ids => {
            const held = myUnits(s).map(u => u.id);
            const add = ids.filter(x => !held.includes(x)), drop = held.filter(x => !ids.includes(x));
            const n = s.duties.filter(d => d.unitIds.some(u => add.includes(u))).length;
            setS(releaseUnits(takeUnits(s, add), drop)); setSub({kind: 'main'});
            toast([add.length && `${add.length}개 업무를 맡았습니다(반복업무 ${n}개)`, drop.length && `${drop.length}개 업무를 뺐습니다`].filter(Boolean).join(' · '));
          }} />
      </section>
    );
  }
  if (sub.kind === 'send') {
    return (
      <section className="list">
        <HandoverFlow s={s} preselect={sub.preselect} onCancel={() => setSub({kind: 'main'})}
          onSend={(to, unitIds, taskIds, note) => {
            setS(sendHandover(s, to, unitIds, taskIds, note));
            setSub({kind: 'main'});
            toast(`${nameOf(s, to)} 님에게 보냈습니다. 받으면 옮겨 갑니다`);
          }} />
      </section>
    );
  }

  const units = myUnits(s);
  const sent = s.handovers.filter(h => h.from === s.me && h.state === 'pending');
  const past = s.handovers.filter(h => (h.from === s.me || h.to === s.me) && (h.state === 'accepted' || h.state === 'declined')).reverse();
  const unitNames = (h: Handover) => s.units.filter(x => h.unitIds.includes(x.id)).map(x => x.name).join(', ') || '일정';
  const canGive = units.length > 0 || handoverableTasks(s).length > 0;

  return (
    <section className="list me work">
      <div className="me-h work-h">
        <div>
          <h2>내 업무</h2>
          <p>{deptName(s, meOf(s)!.deptId)} · 맡은 업무 {units.length}개</p>
        </div>
      </div>

      {units.length === 0 && (
        <div className="card settle-cta">
          <p className="none">맡은 업무가 없습니다. 받을 인수인계를 받고 업무를 고르면 반복업무가 오늘과 달력에 들어옵니다</p>
          <button className="primary sm" onClick={() => setSub({kind: 'settle', mode: 'empty'})}>자리 잡기</button>
        </div>
      )}
      {units.map(u => (
        <UnitBlock key={u.id} s={s} setS={setS} open={open} setOpen={setOpen} toast={toast} unitId={u.id}
          expanded={wide.includes(u.id)} onToggle={() => setWide(w => (w.includes(u.id) ? w.filter(x => x !== u.id) : [...w, u.id]))}
          onGive={() => { setOpen(null); setSub({kind: 'send', preselect: u.id}); }} />
      ))}
      {units.length > 0 && (
        <div className="list-end"><button className="textbtn" onClick={() => { setOpen(null); setSub({kind: 'pick'}); }}>업무 변경</button></div>
      )}

      <RepeatList mineOnly s={s} open={open} setOpen={setOpen} />

      <div className="card">
        <div className="sec-h">
          <h3 className="dept">인수인계</h3>
          {canGive && <button className="textbtn" onClick={() => { setOpen(null); setSub({kind: 'send'}); }}>인수인계</button>}
        </div>
        {sent.length === 0 && past.length === 0 && <p className="none">주고받은 인수인계가 없습니다</p>}
        {sent.map(h => (
          <div key={h.id} className="row static">
            <span className="t">{unitNames(h)}<small>{nameOf(s, h.to)} 님이 받기를 기다리는 중</small></span>
            <button className="ghost" onClick={() => { setS(cancelHandover(s, h.id)); toast('인수인계를 취소했습니다'); }}>인수인계 취소</button>
          </div>
        ))}
        {past.map(h => (
          <div key={h.id} className="row static">
            <span className="t">{unitNames(h)}<small>{nameOf(s, h.from)} 님이 {nameOf(s, h.to)} 님에게 · {dateLabel(h.date)}</small></span>
            <span className="st">{h.state === 'accepted' ? '받음' : '거절됨'}</span>
          </div>
        ))}
      </div>

      <SentRequests s={s} open={open} setOpen={setOpen} />
    </section>
  );
}

/**
 * 맡은 업무 하나 — 접힌 채로: 이름 · 다음 할 일 · (있으면) 처리할 받은 요청 수. 완료 회차는 보이지 않는다
 * (반복업무는 완료 표시가 의무가 아니라서 '3번 중 2번'이 실적처럼 읽힌다, 2026-10-26 사용자 판정). 펼치면 반복업무 줄 · 달마다 몰리는 때 · 받은 요청 · 지난 기록 · 업무 표준.
 * '업무지식'은 같은 업무의 업무 안내·처리 순서로 간다.
 */
function UnitBlock({s, setS, open, setOpen, toast, unitId, expanded, onToggle, onGive}: Ctx & {
  unitId: string; expanded: boolean; onToggle: () => void; onGive: () => void;
}) {
  const goPlace = usePlaceNav();
  const u = unitById(s, unitId)!;
  const duties = dutiesOfUnit(s, unitId);
  const p = pendingOf(s, unitId);
  const next = nextDateOf(s, unitId);
  const nextTitles = next ? duties.filter(d => occurrences(d.rule, next, next).length && d.rule.kind !== 'daily').map(d => d.title) : [];
  const asks = myDispatches(s).filter(d => d.unitId === unitId && !doneForMe(s, d)).length;
  return (
    <div className={`card wu${expanded ? ' open' : ''}`} id={`wu-${unitId}`} style={{'--pc': placeColor(s, {kind: 'unit', id: unitId})} as CSSProperties}>
      <div className="wu-h">
        <button className="wu-t" aria-expanded={expanded} onClick={onToggle}>
          <span className="nm"><span className="swatch" aria-hidden="true" />{u.name}</span>
          <span className="nx">{p ? `${nameOf(s, p.to)} 님에게 인수인계 중` : next ? <>다음 <b>{monthDay(next)}</b> {nextTitles.join(', ')}</> : '매일 하는 일만 있습니다'}</span>
          {asks > 0 && <span className="pr"><span className="ask">처리할 받은 요청 {asks}</span></span>}
        </button>
        <span className="wu-acts">
          <button className="textbtn" onClick={() => goPlace({kind: 'unit', id: unitId})}>업무지식에서 보기</button>
          <button className="textbtn" onClick={onToggle}>{expanded ? '접기' : '펼치기'}</button>
        </span>
      </div>
      {expanded && (
        <div className="wu-b">
          <DutyHead s={s} setS={setS} toast={toast} unitId={unitId} />
          <DutyRows s={s} open={open} setOpen={setOpen} unitId={unitId} />
          <Asks s={s} open={open} setOpen={setOpen} unitId={unitId} />
          {/* 펼치면 다음 할 일과 받은 요청이 중심(2026-10-26 사용자 판정). 지난 기록은 없애지 않고 오른쪽 판으로, 인수인계는 이 업무 맥락에 그대로 */}
          <div className="wu-give">
            {notedOf(s, unitId).length > 0 && <button className="textbtn wu-recs" aria-pressed={open?.kind === 'recs' && open.id === unitId} onClick={() => setOpen({kind: 'recs', id: unitId})}>지난 기록 {notedOf(s, unitId).length}</button>}
            {p
              ? <><span className="wait">{nameOf(s, p.to)} 님에게 인수인계 중</span><button className="ghost" onClick={() => { setS(cancelHandover(s, p.id)); toast('인수인계를 취소했습니다'); }}>인수인계 취소</button></>
              : <button className="ghost" onClick={onGive}>인수인계</button>}
          </div>
        </div>
      )}
    </div>
  );
}

/** 보낸 요청(부서에 보낸 것). 없으면 칸을 두지 않는다. 반복으로 보낸 것은 묶음 하나로 — 다가오는 회차(없으면 마지막 회차)를 연다. */
function SentRequests({s, open, setOpen}: Pick<Ctx, 's' | 'open' | 'setOpen'>) {
  const list = sentDispatches(s);
  if (!list.length) return null;
  const day = today(), seen = new Set<string>();
  const rows = list.slice().sort((a, b) => a.due.localeCompare(b.due)).filter(d => {
    if (!d.seriesId) return true;
    if (seen.has(d.seriesId)) return false;
    const all = s.dispatches.filter(x => x.seriesId === d.seriesId).sort((a, b) => a.due.localeCompare(b.due));
    const open1 = (x: typeof d) => { const pr = dispatchProgress(s, x); return pr.done < pr.all; };
    const pick = all.find(x => x.due >= day && open1(x)) ?? all.find(x => x.due >= day) ?? all[all.length - 1];
    if (pick.id !== d.id) return false;
    seen.add(d.seriesId); return true;
  }).reverse();
  return (
    <div className="card">
      <div className="sec-h"><h3 className="dept">보낸 요청</h3></div>
      {rows.map(d => {
        const pr = dispatchProgress(s, d);
        const sr = seriesById(s, d.seriesId);
        const sel = open?.kind === 'dispatch' && open.id === d.id;
        return (
          <button key={d.id} className={`row${sel ? ' sel' : ''}`} onClick={() => setOpen({kind: 'dispatch', id: d.id})}>
            <span className="t">{d.title}<small>{sr ? `반복 · ${ruleLabel(sr.rule)}${sr.stopped ? ' · 멈춤' : ''} · 이번 ` : ''}{dateLabel(d.due)}까지 · {d.toDepts.length}곳</small></span>
            <span className="st">{pr.all ? `${pr.all}${pr.unit} 중 ${pr.done}${pr.unit} 완료` : '받는 사람 없음'}</span>
          </button>
        );
      })}
    </div>
  );
}
