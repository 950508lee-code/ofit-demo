import {useState} from 'react';
import {type Duty, type Task, type Unit} from './model';
import {cycleOf, dateLabel, ruleLabel, shortDate} from './schedule';
import {
  cancelHandover, complete, lastNote, refsOfUnit, occKey, pendingOf, setProgress,
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
      <XClose onClose={onClose} />
    </div>
  );
}

/** 판 닫기 — 오른쪽 위 ✕(2026-10-26 사용자 판정). 마우스를 올리면 '닫기', 화면 읽기 프로그램에도 '닫기'. */
export function XClose({onClose}: {onClose: () => void}) {
  return (
    <button className="xbtn" onClick={onClose} aria-label="닫기" title="닫기">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
    </button>
  );
}

/** 적어 둔 한 줄이 있으면 닫기 전에 묻는다(저장하지 않은 입력을 말없이 버리지 않는다). */
export const closeKeeping = (typed: string, onClose: () => void) => () => {
  if (!typed.trim() || confirm('적은 내용이 저장되지 않았습니다. 닫을까요?')) onClose();
};

/** 업무 카드 — 언제(머리), 어떻게, 지난번, 완료. 순서는 처음엔 비어 있고 일하면서 남긴다. */
export function DutyCard({s, setS, toast, onClose, duty, date}: Props & {duty: Duty; date: string}) {
  const rec = recordOf(s, duty.id, date);
  const steps = stepsOf(s, duty);
  const checks = rec ? steps.map(() => true) : (s.progress[occKey(duty.id, date)] ?? steps.map(() => false));
  const hand = duty.unitIds.map(id => lastNote(s, id)).find(Boolean);
  const memo = [
    ...recordsOfDuty(s, duty.id).filter(r => r.date !== date && r.note.trim()).map(r => ({date: r.date, by: r.by, note: r.note.trim(), hand: false})),
    ...(hand?.note?.trim() ? [{date: hand.date, by: hand.from, note: hand.note.trim(), hand: true}] : []),
  ].sort((a, b) => b.date.localeCompare(a.date))[0];
  const units = s.units.filter(u => duty.unitIds.includes(u.id)).map(u => u.name).join(' · ');
  const refs = refsOfUnit(s, duty.unitIds[0]);
  const [note, setNote] = useState('');
  const goPlace = usePlaceNav();

  return (
    <aside className="detail" aria-label={duty.title}>
      <Head over={units} title={duty.title} sub={`${dateLabel(date)} · ${ruleLabel(duty.rule)}`} onClose={closeKeeping(note, onClose)} />
      <p className="lockline"><button className="textbtn link" onClick={() => goPlace({kind: 'unit', id: duty.unitIds[0]}, {q: '', anchor: `duty:${duty.id}`})}>업무지식에서 보기</button></p>

      <section>
        <div className="sh"><h4>처리방법</h4></div>
        <StepsBlock s={s} setS={setS} toast={toast} duty={duty}
          check={{checks, done: !!rec, onToggle: i => setS(setProgress(s, duty.id, date, steps.map((_, j) => (j === i ? !checks[j] : !!checks[j]))))}} />
        {duty.basis && <div className="basis" role="note"><b>관련 근거</b><small>공식 규정·지침</small><p>{duty.basis}</p></div>}
      </section>

      {/* 지난 처리 메모 — 가장 최근의 실제 메모 1건(빈 메모는 빼고, 인수인계하며 남긴 말도 후보). 없으면 칸을 두지 않는다.
          전체 기록은 반복업무 문서의 '지난 수행 기록'에서(2026-10-26 사용자 판정: 지난 맥락은 접지 않고 바로, 하나만) */}
      {memo && (
        <section className="memo-last">
          <h4>지난 처리 메모</h4>
          <p className="hd">{shortDate(memo.date)} · {nameOf(s, memo.by)}{memo.hand ? ' · 인수인계하며 남긴 말' : ''}</p>
          <p className="mq">{memo.note}</p>
        </section>
      )}

      {/* 참고자료 — 지금 할 일에 필요한 것만 가져와 읽기만(추가·편집은 반복업무 문서에서). 없으면 칸을 두지 않는다 */}
      {refs.length > 0 && (
        <section>
          <h4>참고자료</h4>
          {refs.map(r => (
            <p key={r.id} className="ref-line">
              {r.kind === 'link' ? <a href={r.where} target="_blank" rel="noreferrer">{r.title}</a> : <b>{r.title}</b>}
              <small>{r.where}</small>
            </p>
          ))}
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
        <button className="ghost" onClick={onEdit}>편집</button>
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
        ) : <button className="ghost wide" onClick={onGive}>인수인계</button>}
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
