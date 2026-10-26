import {useState} from 'react';
import {usePlaceNav} from './placeNav';
import {NewUnitModal, StandardCard} from './Standard';
import {RepeatList} from './RepeatList';
import {SettleFlow} from '../Settle';
import {dateLabel, monthDay} from '../schedule';
import {
  cancelHandover, handoverableTasks, myUnits, nameOf, nextDateOf, orgOf, pendingOf, releaseUnits, sendHandover,
  takeUnits, unitsOfOrg,
} from '../store';
import type {Handover} from '../model';
import {HandoverFlow} from '../Handover';
import {UnitPicker, dutiesOf} from '../ui';
import type {Ctx} from './common';

export type WorkSub = {kind: 'main'} | {kind: 'pick'} | {kind: 'send'; preselect?: string} | {kind: 'settle'; mode: 'move' | 'empty'};

/**
 * 내 정보 맨 위의 업무 판들 — '나는 어떤 자리를 맡고 있나'.
 * (관리자) 검토 · 내 업무(누르면 업무 화면, 업무 바꾸기·부서 옮기기) · 반복 할 일 · 인수인계 · 업무 기준표(둘러보기·업무 만들기).
 * 자주 쓰는 길은 할 일 줄의 업무 이름표 → 업무 화면이고, 여기는 가끔(업무 조정·인사이동) 오는 곳이라 메뉴 탭이 아니라 내 정보에 둔다.
 * sub 가 main 이 아니면 전용 흐름(업무 바꾸기·인수인계·자리 잡기) 화면을 통째로 돌려준다.
 */
export function Work({s, setS, open, setOpen, toast, sub, setSub, onHome}: Ctx & {
  sub: WorkSub; setSub: (m: WorkSub) => void; onHome: () => void;
}) {
  const goPlace = usePlaceNav();
  const [making, setMaking] = useState(false);

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
        <UnitPicker manage onCreate={() => setMaking(true)} s={s} org={orgOf(s)} title="업무 바꾸기" doneLabel="적용"
          lead="체크한 업무가 내 업무입니다. 맡으면 반복업무가 홈과 달력에 들어오고, 빼면 오늘부터 안 들어옵니다"
          back={{label: '닫기', onClick: () => setSub({kind: 'main'})}}
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
  const all = unitsOfOrg(s, orgOf(s));
  const series = [...new Set(all.map(u => u.series))];

  return (
    <>
      {making && <NewUnitModal s={s} setS={setS} toast={toast} onClose={() => setMaking(false)} />}

      <StandardCard s={s} setS={setS} toast={toast} />

      <div className="card">
      <div className="sec-h">
        <h3 className="dept">내 업무 {units.length}</h3>
        <span className="sec-acts">
          <button className="textbtn" onClick={() => { setOpen(null); setSub({kind: 'pick'}); }}>업무 바꾸기</button>
          <button className="textbtn" onClick={() => { setOpen(null); setSub({kind: 'settle', mode: 'move'}); }}>부서 옮기기(발령)</button>
        </span>
      </div>
      {units.length === 0 && (
        <div className="settle-cta">
          <p className="none">맡은 업무가 없습니다. 받을 인수인계를 받고 업무를 고르면 반복업무가 홈과 달력에 들어옵니다</p>
          <button className="primary sm" onClick={() => setSub({kind: 'settle', mode: 'empty'})}>자리 잡기</button>
        </div>
      )}
      {units.map(u => {
        const p = pendingOf(s, u.id);
        const next = nextDateOf(s, u.id);
        const sel = open?.kind === 'unit' && open.id === u.id;
        return (
          <button key={u.id} className={`row${sel ? ' sel' : ''}`} onClick={() => goPlace({kind: 'unit', id: u.id})}>
            <span className="t">{u.name}<small>반복업무 {dutiesOf(s, u).length}개</small></span>
            <span className="st">{p ? `${nameOf(s, p.to)} 님에게 인수인계 중` : next ? `다음 ${monthDay(next)}` : '매일'}</span>
          </button>
        );
      })}
      </div>

      <RepeatList s={s} open={open} setOpen={setOpen} />

      <div className="card">
      <div className="sec-h">
        <h3 className="dept">인수인계</h3>
        {(units.length > 0 || handoverableTasks(s).length > 0) && <button className="textbtn" onClick={() => { setOpen(null); setSub({kind: 'send'}); }}>인수인계 하기</button>}
      </div>
      {sent.length === 0 && past.length === 0 && <p className="none">주고받은 인수인계가 없습니다</p>}
      {sent.map(h => (
        <div key={h.id} className="row static">
          <span className="t">{unitNames(h)}<small>{nameOf(s, h.to)} 님이 받기를 기다리는 중</small></span>
          <button className="ghost" onClick={() => { setS(cancelHandover(s, h.id)); toast('인수인계를 취소했습니다'); }}>취소</button>
        </div>
      ))}
      {past.map(h => (
        <div key={h.id} className="row static">
          <span className="t">{unitNames(h)}<small>{nameOf(s, h.from)} 님이 {nameOf(s, h.to)} 님에게 · {dateLabel(h.date)}</small></span>
          <span className="st">{h.state === 'accepted' ? '받음' : '거절됨'}</span>
        </div>
      ))}
      </div>


      <div className="card">
        <div className="sec-h">
          <h3 className="dept">업무 기준표 · {all.length}개</h3>
          <button className="textbtn" onClick={() => setMaking(true)}>업무 만들기</button>
        </div>
        {series.map(x => (
          <div key={x} className="std-series">
            <small>{x}</small>
            <div className="chips">
              {all.filter(u => u.series === x).map(u => (
                <button key={u.id} className={`chip${units.some(m => m.id === u.id) ? ' on' : ''}`} onClick={() => goPlace({kind: 'unit', id: u.id})}>{u.name}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
