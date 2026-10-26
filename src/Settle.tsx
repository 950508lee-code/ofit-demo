import {useState} from 'react';
import {Filling} from './Entry';
import {
  deptName, deptPath, inboxOf, moveDept, myUnits, nameOf, pendingOf, releaseUnits, sendHandover, takeUnits, type State,
} from './store';
import {UnitPicker, dutiesOf} from './ui';
import {DeptBrowse} from './views/DeptPicker';
import {InboxCards} from './views/common';

/**
 * 자리 잡기 — 업무를 정하는 전용 흐름. 홈은 할 일만 보여 주고, 업무는 늘 여기서 정한다.
 * move(발령): 지금 업무 정리 → 새 부서 → 받을 인수인계 → 업무 고르기 → 차오르는 장면
 * empty(맡은 업무 0개):                      받을 인수인계 → 업무 고르기 → 차오르는 장면
 * 처음 가입은 가입 흐름(Entry)이 같은 부품(부서 고르기·업무 고르기·차오르는 장면)으로 한다.
 */
type Step = 'sort' | 'dept' | 'inbox' | 'units' | 'fill';

export function SettleFlow({s, setS, toast, mode, onDone, onCancel}: {
  s: State; setS: (s: State) => void; toast: (m: string) => void; mode: 'move' | 'empty'; onDone: () => void; onCancel: () => void;
}) {
  const me = s.people.find(p => p.id === s.me)!;
  const holding = myUnits(s).filter(u => !pendingOf(s, u.id));
  const [step, setStep] = useState<Step>(mode === 'move' ? (holding.length ? 'sort' : 'dept') : 'inbox');
  const [plan, setPlan] = useState<Record<string, string>>({}); // 업무 → 받을 사람 id 또는 'drop'
  const [note, setNote] = useState('');
  // 이 흐름에서 받은 업무 = 흐름 안에서 받기를 누른 인수인계의 업무(넘기는 중인 업무와 같은 업무를 다시 받아도 센다)
  const [acc0] = useState(() => new Set(s.handovers.filter(h => h.to === s.me && h.state === 'accepted').map(h => h.id)));
  const [picked, setPicked] = useState<string[]>([]);
  const received = [...new Set(s.handovers.filter(h => h.to === s.me && h.state === 'accepted' && !acc0.has(h.id)).flatMap(h => h.unitIds))];
  const mates = s.people.filter(p => p.id !== s.me && p.deptId === me.deptId);
  const stepsAll: Step[] = mode === 'move' ? ['sort', 'dept', 'inbox', 'units', 'fill'] : ['inbox', 'units', 'fill'];
  const no = stepsAll.indexOf(step) + 1;
  const head = (title: string, lead: string) => (
    <>
      <button className="textbtn close" onClick={onCancel}>그만두기</button>
      <p className="settle-step">{mode === 'move' ? '부서 옮기기' : '자리 잡기'} · {no}/{stepsAll.length}</p>
      <h1>{title}</h1>
      <p className="lead">{lead}</p>
    </>
  );

  // 0. 지금 업무 정리(발령)
  if (step === 'sort') {
    const ok = holding.every(u => plan[u.id]);
    return (
      <div className="flow">
        {head('지금 맡은 업무를 정리하세요', `${deptName(s, me.deptId)}에 두고 갈 업무입니다. 이어받을 사람에게 인수인계하거나, 이어받을 사람이 없으면 뺍니다`)}
        {holding.map(u => (
          <div key={u.id} className="choice sort-row">
            <span className="ct"><b>{u.name}</b><small>반복업무 {dutiesOf(s, u).length}개</small></span>
            <select value={plan[u.id] ?? ''} onChange={e => setPlan({...plan, [u.id]: e.target.value})} aria-label={`${u.name} 넘길 곳`}>
              <option value="">어떻게 할까요</option>
              {mates.map(p => <option key={p.id} value={p.id}>{p.name} 님에게 인수인계</option>)}
              <option value="drop">빼기(이어받을 사람 없음)</option>
            </select>
          </div>
        ))}
        {mates.length === 0 && <p className="none">{deptName(s, me.deptId)}에 가입한 다른 사람이 없어 인수인계할 수 없습니다. 빼면 지난 기록은 남습니다</p>}
        {Object.values(plan).some(v => v && v !== 'drop') && (
          <textarea className="note" rows={3} placeholder="다음 담당자가 알아야 할 것 (적지 않아도 됨)" value={note} onChange={e => setNote(e.target.value)} />
        )}
        <div className="flow-foot">
          <button className="primary wide" disabled={!ok} onClick={() => {
            let n = s;
            const byTo: Record<string, string[]> = {};
            for (const u of holding) if (plan[u.id] !== 'drop') (byTo[plan[u.id]] ??= []).push(u.id);
            for (const [to, ids] of Object.entries(byTo)) n = sendHandover(n, to, ids, [], note.trim());
            n = releaseUnits(n, holding.filter(u => plan[u.id] === 'drop').map(u => u.id));
            setS(n); setStep('dept');
            const sent = Object.keys(byTo).length;
            if (sent) toast(`${Object.keys(byTo).map(id => nameOf(s, id)).join(', ')} 님에게 인수인계를 보냈습니다. 받으면 옮겨 갑니다`);
          }}>{ok ? '정리하고 다음' : '업무마다 골라 주세요'}</button>
        </div>
      </div>
    );
  }

  // 1. 새 부서
  if (step === 'dept') {
    return (
      <div className="flow">
        {head('어느 부서로 가나요', `지금 ${deptPath(s, me.deptId)}`)}
        <DeptBrowse s={s} org={me.org} onPick={id => { setS(moveDept(s, id)); setStep('inbox'); }}
          onCreate={(n, id) => { setS(moveDept(n, id)); setStep('inbox'); }} />
      </div>
    );
  }

  // 2. 받을 인수인계
  if (step === 'inbox') {
    const inbox = inboxOf(s);
    return (
      <div className="flow">
        {head('먼저 받을 인수인계', inbox.length ? '전임자가 보낸 업무입니다. 받으면 반복업무와 지난 기록이 그대로 이어집니다' : `${deptName(s, me.deptId)}에서 나에게 온 인수인계가 없습니다. 업무 고르기로 갑니다`)}
        <InboxCards s={s} setS={setS} toast={toast} />
        {received.length > 0 && <p className="what settle-got">받은 업무 · {s.units.filter(u => received.includes(u.id)).map(u => u.name).join(', ')}</p>}
        <div className="flow-foot">
          <button className="primary wide" onClick={() => setStep('units')}>{inbox.length ? '나머지는 나중에 · 다음' : '다음'}</button>
        </div>
      </div>
    );
  }

  // 3. 업무 고르기
  if (step === 'units') {
    return (
      <div className="settle-units">
        {received.length > 0 && (
          <button className="textbtn skip" onClick={() => { setPicked([]); setStep('fill'); }}>더 고를 업무 없음 · 받은 업무만으로 시작</button>
        )}
        <UnitPicker s={s} org={me.org} title="새 자리에서 맡을 업무를 고르세요"
          lead={`${deptPath(s, me.deptId)} · 여러 개 고를 수 있습니다${received.length ? ' · 받은 업무는 이미 들어 있습니다' : ''}`}
          doneLabel="고르기" back={{label: '그만두기', onClick: onCancel}}
          onDone={ids => { setPicked(ids); setStep('fill'); }} />
      </div>
    );
  }

  // 4. 차오르는 장면
  return <Filling s={s} units={[...received, ...picked]} onStart={() => { setS(takeUnits(s, picked)); onDone(); }} />;
}
