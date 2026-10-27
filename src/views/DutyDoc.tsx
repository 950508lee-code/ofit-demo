import {useState, type CSSProperties} from 'react';
import {addDays, cycleOf, monthDay, occurrences, ruleLabel, shortDate} from '../schedule';
import {canEditCommon, holdsOf, josa, lastNote, nameOf, recordOf, recordsOfDuty, stepsOf, today, unitById} from '../store';
import {itemsInRange} from '../days';
import type {Duty} from '../model';
import type {Ctx} from './common';
import {History, StepsBlock} from './Steps';
import {Refs, dutiesInIndexOrder} from './Place';
import {Fold} from './Fold';
import {placeColor} from './placeColor';

/**
 * 반복업무 문서 — 반복업무 하나가 원본(2026-10-26 사용자 판정: 색인 + 반복업무마다 자기 문서).
 * 업무 문서(색인)는 목록만 두고, 처리방법은 여기에만 있다. 할 일 상세 판은 같은 원본(StepsBlock)에서 지금 할 일에 필요한 부분만 가져온다.
 * 위: 이름 · 주기 · (맡은 사람에게만) 다음 예정일, '오늘 할 일 열기'는 오늘 회차가 있을 때만.
 * 본문: 처리방법(주의는 그 단계 아래) · 관련 근거 → 참고자료 → 지난번 → 반복 설정(문서 아래, 길은 분명하게).
 */
export function DutyDoc({s, setS, toast, setOpen, duty, unitId, onBack, onGo}: Pick<Ctx, 's' | 'setS' | 'toast' | 'setOpen'> & {
  duty: Duty; unitId: string; onBack: () => void; onGo: (dutyId: string) => void;
}) {
  // 변경 기록(판 목록 · 비교 · 복원)은 문서 한가운데서 펼치지 않고 같은 자리의 별도 화면으로(2026-10-26 사용자 판정, docs/IA.md)
  const [hist, setHist] = useState(false);
  const u = unitById(s, unitId)!;
  const mine = duty.unitIds.some(id => holdsOf(s, s.me).includes(id));
  const day = today();
  const daily = cycleOf(duty.rule) === '매일';
  // 맡은 사람에게만: 오늘부터 처음 오는, 아직 끝내지 않은 회차(매일은 오늘이 근무일이면 오늘)
  const next = !mine ? undefined : daily
    ? (occurrences(duty.rule, day, addDays(day, 14))[0])
    : [...itemsInRange(s, day, addDays(day, 400)).entries()].sort(([a], [b]) => a.localeCompare(b))
        .find(([, rows]) => rows.some(r => r.kind === 'duty' && r.id === duty.id && !r.done))?.[0];
  const todayOpen = mine && next === day && !recordOf(s, duty.id, day);
  const past = recordsOfDuty(s, duty.id).sort((a, b) => b.date.localeCompare(a.date));
  const hand = mine ? lastNote(s, unitId) : undefined;
  // 이전 · 다음 반복업무 — 색인과 같은 순서(신규 담당자가 업무 전체를 한 방향으로 읽게, 2026-10-26 사용자 승인)
  const order = dutiesInIndexOrder(s, unitId), at = order.findIndex(d => d.id === duty.id);
  const prev = order[at - 1], nxt = order[at + 1];
  const top = () => window.scrollTo({top: 0});

  if (hist) return (
    <article className="list place know-doc duty-doc" style={{'--pc': placeColor(s, {kind: 'unit', id: unitId})} as CSSProperties}>
      <div className="place-h">
        <div>
          <p className="over"><button className="textbtn crumb" onClick={onBack}>{u.name}</button> · <button className="textbtn crumb" onClick={() => { setHist(false); top(); }}>{duty.title}</button></p>
          <h2>변경 기록</h2>
          <p className="sub">처리방법을 편집할 때마다 남은 판 · 판을 열어 지금과 비교하고 복원합니다</p>
        </div>
      </div>
      <div className="day">
        <History s={s} setS={setS} toast={toast} duty={duty} hist={s.stepHistory[duty.id] ?? []} steps={stepsOf(s, duty)} may={canEditCommon(s, duty)} />
      </div>
    </article>
  );

  return (
    <article className="list place know-doc duty-doc" data-spot={`duty:${duty.id}`} style={{'--pc': placeColor(s, {kind: 'unit', id: unitId})} as CSSProperties}>
      <div className="place-h">
        <div>
          <p className="over"><button className="textbtn crumb" onClick={onBack}>{u.name}</button> · 반복업무</p>
          <h2>{duty.title}</h2>
          <p className="sub">{ruleLabel(duty.rule)}{next ? ` · 다음 ${next === day ? '오늘' : monthDay(next)}` : ''}</p>
        </div>
        {todayOpen && (
          <button className="ghost" onClick={() => setOpen(daily ? {kind: 'daily', date: day} : {kind: 'duty', id: duty.id, date: day})}>오늘 할 일 열기</button>
        )}
      </div>

      <div className="day howto">
        <StepsBlock s={s} setS={setS} toast={toast} duty={duty} spot head="처리방법" onHistory={() => { setHist(true); top(); }} />
        {duty.basis && <div className="basis" role="note"><b>관련 근거</b><small>공식 규정·지침</small><p>{duty.basis}</p></div>}
      </div>

      <Refs key={'refs' + unitId} s={s} setS={setS} toast={toast} unitId={unitId} mine={mine} note={`${u.name} 업무에 붙은 자료`} />

      {/* 부가 정보는 접는다 — 처리방법·참고자료는 늘 보이고, 지난 수행 기록과 반복 설정은 필요할 때 */}
      {(past.length > 0 || hand) && (
        <Fold title="지난 수행 기록" count={past.length}>
          {hand && <p className="rec-last">{nameOf(s, hand.from)} 님이 인수인계하며 남긴 말 · {hand.note}</p>}
          {past.map(r => (
            <div key={r.date + r.by} className="rec">
              <span className="rd">{shortDate(r.date)} · {nameOf(s, r.by)}</span>
              {r.note && <span className="rn">{r.note}</span>}
            </div>
          ))}
        </Fold>
      )}

      {/* 반복 설정 — 일정에 영향을 주는 변경(주기 변경 · 반복 중지)이 들어올 자리. 지금은 주기만 보인다 */}
      <Fold title="반복 설정">
        <p className="dset-row"><span>주기</span><b>{ruleLabel(duty.rule)}</b></p>
        <p className="dset-row"><span>들어가는 곳</span><b>{u.name}{josa(u.name, '을', '를')} 맡은 모든 담당자</b></p>
      </Fold>

      {/* 이전 · 다음 — 색인 순서, 지금 몇 번째인지 함께(폰에서도) */}
      {order.length > 1 && (
        <nav className="dd-nav" aria-label="반복업무 이동">
          {prev ? <button className="textbtn" onClick={() => { onGo(prev.id); top(); }}><small>이전</small>{prev.title}</button> : <span />}
          <span className="dd-at">{at + 1} / {order.length}</span>
          {nxt ? <button className="textbtn nx" onClick={() => { onGo(nxt.id); top(); }}><small>다음</small>{nxt.title}</button> : <span />}
        </nav>
      )}
    </article>
  );
}
