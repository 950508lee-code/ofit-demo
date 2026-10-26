import {useState} from 'react';
import {type Duty, type Task, type Unit} from './model';
import {cycleOf, dateLabel, ruleLabel, shortDate} from './schedule';
import {
  cancelHandover, complete, lastNote, occKey, pendingOf, removeTask, setProgress,
  nameOf, stepsOf, toggleTask, uncomplete, type State, recordOf, recordsOfDuty, deptName, meOf
} from './store';
import {dutiesOf} from './ui';
import {usePlaceNav} from './views/placeNav';
import {Records} from './views/Place';
import {StepsBlock} from './views/Steps';

type Props = {s: State; setS: (s: State) => void; toast: (m: string, undo?: State) => void; onClose: () => void};

export function Head({over, title, sub, onClose}: {over?: string; title: string; sub: string; onClose: () => void}) {
  return (
    <div className="dh">
      <div>
        {over && <p className="over">{over}</p>}
        <h2>{title}</h2>
        <p className="when">{sub}</p>
      </div>
      <button className="textbtn x" onClick={onClose}>닫기</button>
    </div>
  );
}

/** 업무 카드 — 언제(머리), 어떻게, 지난번, 완료. 순서는 처음엔 비어 있고 일하면서 남긴다. */
export function DutyCard({s, setS, toast, onClose, duty, date}: Props & {duty: Duty; date: string}) {
  const rec = recordOf(s, duty.id, date);
  const steps = stepsOf(s, duty);
  const checks = rec ? steps.map(() => true) : (s.progress[occKey(duty.id, date)] ?? steps.map(() => false));
  const past = recordsOfDuty(s, duty.id).filter(r => r.date !== date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const hand = duty.unitIds.map(id => lastNote(s, id)).find(Boolean);
  const units = s.units.filter(u => duty.unitIds.includes(u.id)).map(u => u.name).join(' · ');
  const [note, setNote] = useState('');
  const goPlace = usePlaceNav();

  return (
    <aside className="detail" aria-label={duty.title}>
      <Head over={units} title={duty.title} sub={`${dateLabel(date)} · ${ruleLabel(duty.rule)}`} onClose={onClose} />
      <p className="lockline">이름·주기는 <button className="textbtn" onClick={() => goPlace({kind: 'unit', id: duty.unitIds[0]})}>{units} 업무 표준</button>에서 바꿉니다</p>

      <section>
        <div className="sh"><h4>어떻게</h4></div>
        <StepsBlock s={s} setS={setS} toast={toast} duty={duty}
          check={{checks, done: !!rec, onToggle: i => setS(setProgress(s, duty.id, date, steps.map((_, j) => (j === i ? !checks[j] : !!checks[j]))))}} />
        {duty.basis && <p className="basis">근거 · {duty.basis}</p>}
      </section>

      {(past.length > 0 || hand) && (
        <section>
          <h4>지난번</h4>
          {hand && (
            <div className="hand">
              <span className="hd">{nameOf(s, hand.from)} 님이 인수인계하며 남긴 말</span>
              <p>{hand.note}</p>
            </div>
          )}
          <ul className="hist">
            {past.map(r => (
              <li key={r.date}>
                <span className="hd">{shortDate(r.date)} · {nameOf(s, r.by)}</span>
                {r.note && <span>{r.note}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="act">
        {rec ? (
          <p className="donemsg">{nameOf(s, rec.by)} 님이 완료했습니다{rec.note && ` · ${rec.note}`}</p>
        ) : (
          <>
            <input className="memo" placeholder="한 줄 남기기 (선택)" value={note} onChange={e => setNote(e.target.value)} />
            <button className="primary" onClick={() => { setS(complete(s, duty.id, date, note.trim())); toast('완료했습니다', s); }}>완료</button>
          </>
        )}
      </div>
    </aside>
  );
}

/** 매일 하는 일 — 그날의 매일 반복업무를 한 번에 체크한다. */
export function DailyCard({s, setS, onClose, duties, date}: Props & {duties: Duty[]; date: string}) {
  const done = (d: Duty) => !!recordOf(s, d.id, date);
  const left = duties.filter(d => !done(d)).length;
  return (
    <aside className="detail" aria-label="매일 하는 일">
      <Head title="매일 하는 일" sub={`${dateLabel(date)} · ${left ? `${left}개 남음` : '모두 마침'}`} onClose={onClose} />
      <section>
        <ul className="checks">
          {duties.map(d => (
            <li key={d.id}>
              <label>
                <input type="checkbox" checked={done(d)}
                  onChange={() => setS(done(d) ? uncomplete(s, d.id, date) : complete(s, d.id, date, ''))} />
                <span><span className="tt">{d.title}</span><small>{s.units.filter(u => d.unitIds.includes(u.id)).map(u => u.name).join(' · ')}</small></span>
              </label>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}

/** 빠른 입력으로 넣은 일. */
export function TaskCard({s, setS, toast, onClose, task, date, onEdit}: Props & {task: Task; date: string; onEdit: () => void}) {
  const done = task.done.includes(date);
  const when = `${dateLabel(date)}${task.time ? ` ${task.time}` : ''}${task.rule ? ` · ${ruleLabel(task.rule)}` : ''}`;
  return (
    <aside className="detail" aria-label={task.title}>
      <Head title={task.title} sub={when} onClose={onClose} />
      <div className="act">
        <button className="ghost" onClick={() => { setS(removeTask(s, task.id)); onClose(); toast(task.rule ? '반복 할 일을 모두 지웠습니다' : '지웠습니다', s); }}>지우기</button>
        <button className="ghost" onClick={onEdit}>고치기</button>
        <button className={done ? 'ghost' : 'primary'} onClick={() => { setS(toggleTask(s, task.id, date)); if (!done) toast('완료했습니다', s); }}>{done ? '완료 취소' : '완료'}</button>
      </div>
    </aside>
  );
}

/** 단위업무 상세 — 들어 있는 반복업무(주기별), 넘겨주기. */
export function UnitPanel({s, setS, toast, onClose, unit, onGive}: Props & {unit: Unit; onGive: () => void}) {
  const pending = pendingOf(s, unit.id);
  const duties = dutiesOf(s, unit);
  const cycles = ['매일', '매주', '매월', '분기', '매년'].filter(c => duties.some(d => cycleOf(d.rule) === c));
  return (
    <aside className="detail" aria-label={unit.name}>
      <Head title={unit.name} sub={`${unit.series} · 반복업무 ${duties.length}개`} onClose={onClose} />

      {cycles.map(c => (
        <section key={c}>
          <h4>{c}</h4>
          <ul className="hist">
            {duties.filter(d => cycleOf(d.rule) === c).map(d => (
              <li key={d.id}><span>{d.title}</span>{c !== '매일' && <span className="hd">{ruleLabel(d.rule)}</span>}</li>
            ))}
          </ul>
        </section>
      ))}


      <div className="act">
        {pending ? (
          <>
            <p className="wait">{nameOf(s, pending.to)} 님이 받기를 기다리는 중</p>
            <button className="ghost" onClick={() => { setS(cancelHandover(s, pending.id)); toast('인수인계를 취소했습니다'); }}>인수인계 취소</button>
          </>
        ) : <button className="ghost wide" onClick={onGive}>인수인계 하기</button>}
      </div>
    </aside>
  );
}

/** 지난 기록 — 업무지식에서 과거 처리 사례를 볼 때 오른쪽 판으로(주인은 내 업무). */
export function RecsCard({s, onClose, unit}: Pick<Props, 's' | 'onClose'> & {unit: Unit}) {
  return (
    <aside className="detail" aria-label={`${unit.name} 지난 기록`}>
      <Head over={unit.name} title="지난 기록" sub={`${deptName(s, meOf(s)?.deptId)}에서 끝내며 남긴 한 줄`} onClose={onClose} />
      <section><Records s={s} unitId={unit.id} limit={30} head={false} /></section>
    </aside>
  );
}
