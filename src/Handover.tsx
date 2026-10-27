import {Cells} from './views/shapes';
import {useState} from 'react';
import {dateLabel, monthDay, ruleLabel} from './schedule';
import {colleagues, deptName, stepsOf, draftNote, handoverableTasks, myUnits, nextDateOf, pendingOf, upcomingOf, type State} from './store';
import {dutiesOf} from './ui';

/**
 * 인수인계 — 받을 사람을 고르고, 넘길 업무와 그 밖의 일정을 골라 보낸다.
 * 업무를 고르면 기준표의 반복업무는 저절로 같이 간다.
 */
export function HandoverFlow({s, preselect, onCancel, onSend}: {
  s: State; preselect?: string; onCancel: () => void;
  onSend: (to: string, unitIds: string[], taskIds: string[], note: string) => void;
}) {
  const myDept = s.people.find(p => p.id === s.me)?.deptId;
  // 같은 부서 사람이 먼저 — 인수인계는 대개 같은 자리 후임에게 간다
  const people = [...colleagues(s)].sort((a, b) => +(b.deptId === myDept) - +(a.deptId === myDept));
  // 먼저 돌아오는 업무가 위 — 넘기기를 미루면 그것부터 놓친다
  const units = myUnits(s).filter(u => !pendingOf(s, u.id))
    .map(u => ({u, next: nextDateOf(s, u.id)}))
    .sort((a, b) => (a.next ?? '9').localeCompare(b.next ?? '9'));
  const others = handoverableTasks(s);
  const [to, setTo] = useState(people.length === 1 ? people[0].id : '');
  const [unitIds, setUnitIds] = useState<string[]>(preselect ? [preselect] : []);
  const [taskIds, setTaskIds] = useState<string[]>([]);
  const [note, setNote] = useState(() => (preselect ? draftNote(s, preselect) : ''));
  const flip = (list: string[], id: string) => (list.includes(id) ? list.filter(x => x !== id) : [...list, id]);
  const total = unitIds.length + taskIds.length;

  return (
    <div className="flow">
      <button className="textbtn close" onClick={onCancel}>취소</button>
      <h1>인수인계</h1>
      <p className="lead">고른 업무와 할 일이 받는 사람에게 그대로 옮겨 갑니다</p>

      <h3 className="dept">받을 사람</h3>
      {people.length === 0
        ? <p className="none">같은 조직에 가입한 사람이 아직 없습니다. 받을 사람이 먼저 가입해야 합니다.</p>
        : people.map(p => (
          <label key={p.id} className="choice check">
            <input type="radio" name="to" checked={to === p.id} onChange={() => setTo(p.id)} />
            <span className="ct"><b>{p.name}</b><small>{deptName(s, p.deptId)}{p.deptId === myDept ? ' · 같은 부서' : ''}</small></span>
          </label>
        ))}

      <h3 className="dept">넘길 업무</h3>
      {units.length === 0 && <p className="none">넘길 수 있는 업무가 없습니다</p>}
      {units.map(({u, next}) => {
        return (
          <label key={u.id} className="choice check">
            <input type="checkbox" checked={unitIds.includes(u.id)} onChange={() => setUnitIds(l => flip(l, u.id))} />
            <span className="ct">
              <b>{u.name}</b>
              <small>{next ? `다음 ${monthDay(next)} · ` : ''}반복업무 {dutiesOf(s, u).length}개</small>
              <Cells n={dutiesOf(s, u).filter(d => stepsOf(s, d).length).length} of={dutiesOf(s, u).length} label="처리 순서 적은 일" />
            </span>
          </label>
        );
      })}

      {others.length > 0 && (
        <>
          <h3 className="dept">그 밖의 일정</h3>
          {others.map(t => (
            <label key={t.id} className="choice check">
              <input type="checkbox" checked={taskIds.includes(t.id)} onChange={() => setTaskIds(l => flip(l, t.id))} />
              <span className="ct">
                <b>{t.title}</b>
                <small>{t.rule ? ruleLabel(t.rule) : dateLabel(t.date!)}{t.time ? ` ${t.time}` : ''}</small>
              </span>
            </label>
          ))}
        </>
      )}

      {total > 0 && <Upcoming s={s} unitIds={unitIds} taskIds={taskIds} heading="받는 사람 할 일에 이렇게 들어갑니다" />}

      <h3 className="dept">남길 말 <span>선택</span></h3>
      <textarea className="note" rows={3} placeholder="다음 담당자가 알아야 할 것" value={note} onChange={e => setNote(e.target.value)} />

      <div className="flow-foot">
        <p className="foot-sum">{!to ? '받을 사람을 고르세요' : total === 0 ? '넘길 것을 고르세요' : `업무 ${unitIds.length}개${taskIds.length ? ` · 일정 ${taskIds.length}개` : ''}`}</p>
        <button className="primary wide" disabled={!to || total === 0} onClick={() => onSend(to, unitIds, taskIds, note.trim())}>보내기</button>
      </div>
    </div>
  );
}

/** 넘어갈 일이 앞으로 석 달 동안 언제 들어오는지 날짜순으로. 보내는 쪽과 받는 쪽이 같은 표를 본다. */
export function Upcoming({s, unitIds, taskIds, heading, limit = 6}: {
  s: State; unitIds: string[]; taskIds: string[]; heading: string; limit?: number;
}) {
  const {dates, daily} = upcomingOf(s, unitIds, taskIds, 92);
  const shown = dates.slice(0, limit);
  return (
    <div className="upcoming">
      <h4>{heading} <span>앞으로 석 달</span></h4>
      <ul>
        {daily > 0 && <li><span className="d">매일</span><span>매일 하는 일 {daily}개</span></li>}
        {shown.map(x => (
          <li key={x.date}>
            <span className="d">{dateLabel(x.date)}</span>
            <span>{x.titles[0]}{x.titles.length > 1 && <em> 외 {x.titles.length - 1}건</em>}</span>
          </li>
        ))}
      </ul>
      {dates.length > limit && <p className="more">그 뒤로 {dates.length - limit}번 더 있습니다</p>}
    </div>
  );
}
