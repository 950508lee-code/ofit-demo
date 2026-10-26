import {useLayoutEffect, useRef, useState} from 'react';
import {
  addTask, sendDispatchSeries, updateTask, deptName, emptyDepts, meOf, orgOf, recipientsOf, sendDispatch, today,
  unitsOfOrg, type State,
} from '../store';
import {Modal} from '../ui';
import {DeptMulti} from './DeptPicker';
import {parseInput} from '../parse';
import {ruleLabel, type Rule} from '../schedule';
import {RepeatPicker, repeatFrom, ruleOf, type RepeatState} from './RepeatPicker';

export type Target = 'me' | 'dept';
export type ComposePreset = {title?: string; date?: string; time?: string; rule?: Rule; target?: Target; editId?: string};

/**
 * 일정 등록 — 하나의 창에서 '누구에게'를 고른다.
 * 나: 내 할 일에만.
 * 부서: 받을 부서 + 받는 사람(부서 전체 / 특정 업무 담당자). 받는 사람의 홈·달력에 바로 들어간다.
 */
export function Compose({s, setS, preset, onClose, onDone}: {
  s: State; setS: (s: State) => void; preset: ComposePreset; onClose: () => void;
  onDone: (msg: string, date: string, to?: {sent?: boolean}) => void;
}) {
  const me = meOf(s)!;
  const [title, setTitle] = useState(preset.title ?? '');
  const [date, setDate] = useState(preset.date ?? today());
  const [time, setTime] = useState(preset.time ?? '');
  const [target, setTarget] = useState<Target>(preset.target ?? 'me');
  // 반복(나에게만): 리마인더처럼 켜면 반복 고르기가 열린다. 제목에 '매주 금요일'을 쓰면 저절로 켜지고 옮겨진다.
  const [repeat, setRepeat] = useState(!!preset.rule);
  const [rp, setRp] = useState<RepeatState>(() => repeatFrom(preset.date ?? today(), preset.rule));
  const [moved, setMoved] = useState('');
  const pull = () => {
    const p = parseInput(title, today());
    const got = [p.rule && '반복', p.date && '날짜', p.time && '시간'].filter(Boolean);
    if (!got.length || !p.title) return;
    if (p.date) setDate(p.date);
    if (p.time) setTime(p.time);
    if (p.rule && target === 'me') { setRepeat(true); setRp(repeatFrom(p.date ?? date, p.rule)); }
    setTitle(p.title);
    setMoved(`제목에 쓴 ${got.join('·')}을 아래 칸으로 옮겼습니다`);
  };
  // 부서
  const [toDepts, setToDepts] = useState<string[]>([]);
  const [withChildren, setWithChildren] = useState(false);
  const [byUnit, setByUnit] = useState(true);
  const [unitId, setUnitId] = useState('');
  const [body, setBody] = useState('');
  const units = unitsOfOrg(s, orgOf(s));
  const series = [...new Set(units.map(u => u.series))];
  const draft = {toDepts, withChildren, unitId: byUnit && unitId ? unitId : undefined, from: s.me};
  const recips = target === 'dept' ? recipientsOf(s, draft) : [];
  const empty = target === 'dept' ? emptyDepts(s, draft) : [];
  // 닫을 때는 창이 작아지며 사라진 뒤 닫는다(PC 150ms, 폰 250ms, 움직임 줄이기 120ms)
  const [closing, setClosing] = useState(false);
  const close = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, matchMedia('(prefers-reduced-motion: reduce)').matches ? 120 : innerWidth <= 900 ? 250 : 150);
  };
  const box = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  const check = () => { const b = box.current; if (b) setMore(b.scrollHeight - b.scrollTop - b.clientHeight > 4); };
  useLayoutEffect(check);

  const rule = repeat ? ruleOf(rp, date) : undefined;
  const ok = !!title.trim() && !!date && (
    (repeat && !rule) ? false :
    (target === 'me') ||
    (target === 'dept' && toDepts.length > 0 && (!byUnit || !!unitId))
  );

  const submit = () => {
    if (!ok) return;
    if (preset.editId) {
      setS(updateTask(s, preset.editId, {title: title.trim(), date, time: time || undefined, rule}));
      onDone('고쳤습니다', date);
    } else if (target === 'me') {
      setS(addTask(s, {title: title.trim(), date, time: time || undefined, rule}));
      onDone(rule ? '반복 할 일을 넣었습니다' : '할 일을 넣었습니다', date);
    } else {
      const x = {toDepts, withChildren, unitId: draft.unitId, title: title.trim(), body: body.trim()};
      setS(rule ? sendDispatchSeries(s, x, rule) : sendDispatch(s, {...x, due: date}));
      onDone(`${toDepts.length}곳에 ${rule ? `반복(${ruleLabel(rule)})으로 ` : ''}보냈습니다 · 지금 받는 사람 ${recips.length}명`, date, {sent: true});
    }
  };

  const TARGETS: {id: Target; label: string}[] = [
    {id: 'me', label: '나'},
    {id: 'dept', label: '부서'},
  ];

  return (
    <Modal title={preset.editId ? '할 일 고치기' : target === 'dept' ? '부서에 요청 보내기' : '일정 등록'} onCancel={close} closing={closing}>
      <div className={`compose${more ? ' more' : ''}`} ref={box} onScroll={check}>
        <label className="fld"><span>제목</span>
          <input autoFocus value={title} onChange={e => { setTitle(e.target.value); setMoved(''); }} onBlur={pull}
            placeholder={target === 'dept' ? '예) 3분기 예산 집행 실적 회신' : '예) 매주 금요일 3시 주간 회의'} />
          {moved && <small className="hint ok">{moved}</small>}
        </label>

        {!preset.editId && <div className="fld"><span>누구에게</span>
          <div className="seg2" role="radiogroup" aria-label="누구에게">
            {TARGETS.map(t => (
              <button key={t.id} role="radio" aria-checked={target === t.id} className={target === t.id ? 'on' : ''} onClick={() => setTarget(t.id)}>{t.label}</button>
            ))}
          </div>
          {/* 둘이 어떻게 다른지 — 고르는 순간 한 줄로 */}
          <small className="hint who-hint">{{
            me: '내 할 일에만 들어갑니다. 다른 사람은 보지 않습니다',
            dept: '다른 부서의 업무 담당자에게 일을 보내고 회신을 받습니다. 예) 지사별 실적 회신, 자료 제출 요청',
          }[target]}</small>
        </div>}
        {preset.editId && preset.rule && <small className="hint">반복 할 일은 묶음 전체가 바뀝니다. 지난 완료 기록은 그대로 남습니다.</small>}

        <div className="fld-row">
          <label className="fld"><span>{target !== 'me' ? (repeat ? '첫 기한' : '기한') : repeat ? '시작일' : '날짜'}</span>
            <input type="date" value={date} onChange={e => { setDate(e.target.value); setRp(repeat ? repeatFrom(e.target.value, ruleOf(rp, e.target.value)) : repeatFrom(e.target.value)); }} />
          </label>
          {target === 'me' && (
            <label className="fld"><span>시간 <em>적지 않아도 됨</em></span>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} />
            </label>
          )}
        </div>

        {(
          <div className="fld"><span>반복{target !== 'me' && <em> 회차마다 받는 사람의 할 일에 들어갑니다</em>}</span>
            <div className="seg2" role="radiogroup" aria-label="반복">
              <button role="radio" aria-checked={!repeat} className={!repeat ? 'on' : ''} onClick={() => setRepeat(false)}>안 함</button>
              <button role="radio" aria-checked={repeat} className={repeat ? 'on' : ''} onClick={() => { if (!repeat) setRp(repeatFrom(date)); setRepeat(true); }}>반복</button>
            </div>
            {repeat && <RepeatPicker value={rp} onChange={setRp} start={date} />}
          </div>
        )}

        {target === 'dept' && (
          <>
            <div className="fld"><span>받을 부서</span>
              <DeptMulti s={s} org={orgOf(s)} value={toDepts} onChange={setToDepts} exclude={me.deptId} />
              <label className="tick"><input type="checkbox" checked={withChildren} onChange={e => setWithChildren(e.target.checked)} /> 하위 부서까지</label>
            </div>
            <div className="fld"><span>받는 사람</span>
              <div className="seg2" role="radiogroup" aria-label="받는 사람">
                <button role="radio" aria-checked={byUnit} className={byUnit ? 'on' : ''} onClick={() => setByUnit(true)}>특정 업무 담당자</button>
                <button role="radio" aria-checked={!byUnit} className={!byUnit ? 'on' : ''} onClick={() => setByUnit(false)}>부서 전체</button>
              </div>
              {byUnit && (
                <select value={unitId} onChange={e => setUnitId(e.target.value)} aria-label="업무">
                  <option value="">업무를 고르세요</option>
                  {series.map(x => (
                    <optgroup key={x} label={x}>
                      {units.filter(u => u.series === x).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              )}
              {toDepts.length > 0 && (!byUnit || unitId) && (
                <small className="hint recips">
                  지금 받는 사람 {recips.length}명{recips.length ? ` · ${recips.slice(0, 4).map(p => `${p.name}(${deptName(s, p.deptId)})`).join(', ')}${recips.length > 4 ? ` 외 ${recips.length - 4}명` : ''}` : ''}
                  {empty.length > 0 && <><br />{empty.map(d => deptName(s, d)).join(', ')}에는 {byUnit ? '이 업무 담당자가' : '가입한 사람이'} 아직 없습니다. 생기면 그 사람에게 갑니다</>}
                </small>
              )}
            </div>
            <label className="fld"><span>내용 <em>적지 않아도 됨</em></span>
              <textarea className="note" rows={3} value={body} onChange={e => setBody(e.target.value)} placeholder="예) 첨부 양식에 지사별 실적을 적어 회신해 주세요" />
            </label>
          </>
        )}

      </div>
      <div className="mb">
        <button className="ghost" onClick={close}>취소</button>
        <button className="primary" disabled={!ok} onClick={submit}>{preset.editId ? '고치기' : target === 'me' ? '넣기' : '보내기'}</button>
      </div>
    </Modal>
  );
}
