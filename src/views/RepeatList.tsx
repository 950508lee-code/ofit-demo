import {useState} from 'react';
import {addDays, occurrences, ruleLabel} from '../schedule';
import {myDuties, myTasks, myUnits, today, type State} from '../store';
import type {Row} from '../days';
import {RowButton, type Open} from './common';

/**
 * 반복 할 일 모아 보기 — 리마인더 '반복일정 관리'처럼 둘로 나눈다.
 * 내가 만든 것: 누르면 상세(고치기·지우기). 업무에서 온 것: 업무 표준에서 오므로 여기서 못 고친다(이름표 → 자리 화면).
 * mineOnly: 내 업무 화면은 업무마다 반복업무 줄을 이미 보여 주므로 내가 만든 것만(같은 정보 한 번만).
 */
export function RepeatList({s, open, setOpen, mineOnly}: {s: State; open: Open; setOpen: (o: Open) => void; mineOnly?: boolean}) {
  const [tab, setTab] = useState<'mine' | 'unit'>('mine');
  const day = today();
  const next = (r: Parameters<typeof occurrences>[0], from = day) => occurrences(r, from, addDays(day, 400))[0];
  const mine: Row[] = myTasks(s).filter(t => t.rule).map((t): Row => {
    const d = next(t.rule!, t.date && t.date > day ? t.date : day) ?? day;
    return {kind: 'task', id: t.id, date: d, title: t.title, done: false, when: ruleLabel(t.rule!)};
  });
  const units = myUnits(s);
  const fromUnit: Row[] = myDuties(s).map((d): Row => {
    const u = units.find(x => d.unitIds.includes(x.id))!;
    return {kind: d.rule.kind === 'daily' ? 'daily' : 'duty', id: d.id, date: next(d.rule) ?? day, title: d.title, done: false,
      place: u?.name, at: u ? {kind: 'unit', id: u.id} : undefined, when: ruleLabel(d.rule)};
  }).sort((a, b) => (a.place ?? '').localeCompare(b.place ?? '') || a.date.localeCompare(b.date));
  const list = tab === 'mine' ? mine : fromUnit;
  return (
    <div className="card">
      <div className="sec-h">
        <h3 className="dept">반복 할 일</h3>
        {!mineOnly && <div className="seg2 tabs" role="tablist" aria-label="반복 할 일">
          <button role="tab" aria-selected={tab === 'mine'} className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>내가 만든 것 {mine.length}</button>
          <button role="tab" aria-selected={tab === 'unit'} className={tab === 'unit' ? 'on' : ''} onClick={() => setTab('unit')}>업무에서 온 것 {fromUnit.length}</button>
        </div>}
      </div>
      {tab === 'mine' && mine.length === 0 && <p className="none">내가 만든 반복 할 일이 없습니다</p>}
      {list.map(r => <RowButton key={r.kind + r.id} s={s} r={r} open={open} setOpen={setOpen} right={r.kind === 'daily' ? '매일' : `다음 ${r.date.slice(5).replace('-', '.')}`} />)}
    </div>
  );
}
