import {useState} from 'react';
import {dateLabel, ruleLabel, ymd} from '../schedule';
import {Cells, DueLine} from './shapes';
import {XClose, closeKeeping} from '../Cards';
import {
  completeDispatch, deptAndBelow, deptDoneBy, deptName, deptOf, dispatchById, dispatchProgress, doneForMe, nameOf, recipientsOf, seriesById, stopSeries, undoDispatch, type State,
} from '../store';

/**
 * 부서 일정 카드.
 * 받은 사람: 보낸 곳·내용·완료(한 줄 남기기).
 * 보낸 사람: 받은 부서별로 누가 받았고 누가 완료했는지.
 */
export function DispatchCard({s, setS, toast, onClose, id}: {
  s: State; setS: (s: State) => void; toast: (m: string, undo?: State) => void; onClose: () => void; id: string;
}) {
  const d = dispatchById(s, id);
  const [note, setNote] = useState('');
  if (!d) return null;
  const mine = d.from === s.me;
  const unit = d.unitId ? s.units.find(u => u.id === d.unitId)?.name : '';
  const recips = recipientsOf(s, d);
  const prog = dispatchProgress(s, d);
  const myDone = doneForMe(s, d);
  const sr = seriesById(s, d.seriesId);
  // 반복 회차의 기한 선은 앞 회차 기한부터(첫 회차는 보낸 날부터)
  const prev = sr ? s.dispatches.filter(x => x.seriesId === sr.id && x.due < d.due).map(x => x.due).sort().pop() : undefined;

  return (
    <aside className="detail" aria-label={d.title}>
      <div className="dh">
        <div>
          <p className="over">{mine ? '내가 보낸 요청' : `${deptName(s, d.fromDept)} · ${nameOf(s, d.from)} 님이 보냄`}</p>
          <h2>{d.title}</h2>
          <p className="when">{dateLabel(d.due)}까지{unit ? ` · ${unit} 담당에게` : ' · 부서 전체에게'}</p>
          {sr && <p className="series">반복 · {ruleLabel(sr.rule)}{sr.stopped ? ` · ${sr.stopped.slice(5).replace('-', '.')}에 멈춤` : ' · 이번 회차'}</p>}
          <DueLine from={prev ?? ymd(new Date(d.sentAt))} fromLabel={prev ? '지난 회차' : '받음'} due={d.due} today={ymd(new Date())} done={mine ? prog.done === prog.all && prog.all > 0 : !!myDone} />
        </div>
        <XClose onClose={closeKeeping(note, onClose)} />
      </div>

      {d.body && (
        <section>
          <h4>내용</h4>
          <p className="body-text">{d.body}</p>
        </section>
      )}

      {mine ? (
        <section>
          <h4>받은 곳</h4>
          <Cells n={prog.done} of={prog.all} label={prog.unit === '곳' ? '완료한 부서' : '완료한 사람'} />
          {d.toDepts.map(dep => {
            const set = new Set(d.withChildren ? deptAndBelow(s, dep) : [dep]);
            const ps = recips.filter(p => set.has(p.deptId));
            const dd = d.unitId ? deptDoneBy(s, d, dep) : null;
            return (
              <div key={dep} className="sent-dept">
                <b>{deptOf(s, dep)?.name}{d.withChildren && ' 와 하위 부서'}</b>
                {dd && <span className="ok">{nameOf(s, dd.by)} 님이 {dd.on.slice(5).replace('-', '.')} 완료{dd.note ? ` · ${dd.note}` : ''}</span>}
                {dd && ps.some(p => p.id !== dd.by) && <small>지금 담당 {ps.map(p => p.name).join(', ')}</small>}
                {!dd && ps.length === 0 && <small>{unit ? `${unit} 담당자가 아직 없습니다. 담당자가 생기면 그 사람에게 갑니다` : '아직 가입한 사람이 없습니다'}</small>}
                {!dd && ps.map(p => (
                  <span key={p.id} className={d.done[p.id] ? 'ok' : ''}>
                    {p.name}{d.withChildren && p.deptId !== dep ? ` · ${deptName(s, p.deptId)}` : ''} — {d.done[p.id] ? `${d.done[p.id].on.slice(5).replace('-', '.')} 완료${d.done[p.id].note ? ` · ${d.done[p.id].note}` : ''}` : '아직'}
                  </span>
                ))}
              </div>
            );
          })}
        </section>
      ) : null}
      {mine && sr && !sr.stopped && (
        <div className="act">
          <button className="ghost" onClick={() => { setS(stopSeries(s, sr.id)); toast('반복을 중지했습니다. 아직 아무도 손대지 않은 앞으로의 회차는 삭제했습니다', s); }}>반복 중지</button>
        </div>
      )}

      {!mine && (
        <div className="act">
          {myDone ? (
            <>
              <p className="donemsg">{myDone.by === s.me ? '' : `${nameOf(s, myDone.by)} 님이 `}{myDone.on.slice(5).replace('-', '.')} 완료했습니다{myDone.note && ` · ${myDone.note}`}</p>
              {myDone.by === s.me && <button className="ghost" onClick={() => setS(undoDispatch(s, d.id))}>완료 취소</button>}
            </>
          ) : (
            <>
              <input className="memo" placeholder="한 줄 회신 (선택)" value={note} onChange={e => setNote(e.target.value)} />
              <button className="primary" onClick={() => { setS(completeDispatch(s, d.id, note.trim())); toast(`완료했습니다. ${nameOf(s, d.from)} 님에게 알렸습니다`, s); }}>완료</button>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
