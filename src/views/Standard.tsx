import {useState} from 'react';
import {parseDuty} from '../parse';
import {addDays, dateLabel, monthDay, occurrences, ruleLabel, type Rule} from '../schedule';
import {
  approveProposal, canApprove, isStdAdmin, isStdMaster, myAdminSeries, nameOf, orgOf, pendingProposals, propose, proposalsOfUnit,
  rejectProposal, reviewersOf, seriesAdminsOf, seriesOf, setSeriesAdmin, stdMasters, today, unitById, type State,
} from '../store';
import type {Proposal} from '../model';
import {Modal} from '../ui';

/**
 * 업무 표준 만들기 — 누구나 올리고, 관리자가 승인하면 같은 업무를 맡은 모두에게 들어간다.
 * 반복업무는 한 줄 글로 쓴다: '매월 25일 지출결의 마감'. 알아들은 주기와 다음 날짜를 바로 보여 준다.
 */
type Line = {title: string; rule?: Rule};
const parseLines = (xs: string[]): Line[] => xs.filter(x => x.trim()).map(parseDuty);
const nextDates = (r: Rule) => occurrences(r, today(), addDays(today(), 200)).slice(0, 3);
const who = (s: State, series: string) => reviewersOf(s, series).map(id => nameOf(s, id)).join(', ');

/** 반복업무 줄 입력 — 줄마다 알아들은 결과를 아래에. */
function DutyLines({lines, setLines}: {lines: string[]; setLines: (l: string[]) => void}) {
  return (
    <div className="dlines">
      {lines.map((x, i) => {
        const p = x.trim() ? parseDuty(x) : null;
        return (
          <div key={i} className="dline">
            <input value={x} placeholder={i === 0 ? '예) 매월 25일 지출결의 마감' : '예) 매주 금요일 초과근무 승인'}
              onChange={e => setLines(lines.map((y, j) => (j === i ? e.target.value : y)))} aria-label={`반복업무 ${i + 1}`} />
            {p && (p.rule && p.title
              ? <small className="ok"><b>{ruleLabel(p.rule)}</b> · {p.title} · 다음 {nextDates(p.rule).map(d => monthDay(d).replace('월 ', '.').replace('일', '')).join(', ')}</small>
              : <small className="bad">{p.rule ? '할 일 이름을 함께 적어 주세요' : '주기를 알아듣지 못했습니다. 예) 매일 · 매주 금요일 · 매월 25일 · 매월 셋째 주 수요일 · 분기 첫 달 10일'}</small>)}
          </div>
        );
      })}
      <button className="textbtn add" onClick={() => setLines([...lines, ''])}>한 줄 더</button>
    </div>
  );
}
const ready = (ls: Line[]) => ls.length > 0 && ls.every(l => l.rule && l.title);

/** 자리 화면: 이 업무에 반복업무 더하기 + 검토 중·기록. */
export function UnitStandard({s, setS, toast, unitId}: {s: State; setS: (s: State) => void; toast: (m: string) => void; unitId: string}) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<string[]>(['']);
  const series = unitById(s, unitId)?.series ?? '';
  const admin = canApprove(s, series);
  const parsed = parseLines(lines);
  const props = proposalsOfUnit(s, unitId).slice().reverse();
  const pending = props.filter(p => p.state === 'pending');
  const done = props.filter(p => p.state !== 'pending');
  const submit = () => {
    setS(propose(s, {unitId, duties: parsed.map(l => ({title: l.title, rule: l.rule!}))}));
    setOpen(false); setLines(['']);
    toast(admin ? `반복업무 ${parsed.length}개를 더했습니다. 맡은 사람 모두에게 들어갑니다` : `${who(s, series)} 님에게 올렸습니다. 승인되면 맡은 사람 모두에게 들어갑니다`);
  };
  return (
    <div className="day std">
      <div className="sec-h">
        <h3 className="dept">업무 표준</h3>
        {!open && <button className="textbtn" onClick={() => setOpen(true)}>반복업무 더하기</button>}
      </div>
      {open && (
        <div className="std-form">
          <p className="hint">{admin ? '더하면 이 업무를 맡은 모두의 할 일에 바로 들어갑니다' : `올리면 ${series} 분류 관리자(${who(s, series)})가 확인한 뒤 맡은 모두에게 들어갑니다`}</p>
          <DutyLines lines={lines} setLines={setLines} />
          <div className="mb">
            <button className="ghost" onClick={() => { setOpen(false); setLines(['']); }}>취소</button>
            <button className="primary sm" disabled={!ready(parsed)} onClick={submit}>{admin ? '더하기' : '관리자에게 올리기'}</button>
          </div>
        </div>
      )}
      {pending.map(p => <PropRow key={p.id} s={s} p={p} />)}
      {done.slice(0, 5).map(p => <PropRow key={p.id} s={s} p={p} />)}
      {!open && props.length === 0 && <p className="none">바꾼 기록이 없습니다</p>}
    </div>
  );
}

function PropRow({s, p}: {s: State; p: Proposal}) {
  const st = p.state === 'pending' ? '검토 중' : p.state === 'approved' ? `${nameOf(s, p.decidedBy)} 님 승인` : `반려 · ${p.reason || '사유 없음'}`;
  return (
    <div className={`prop ${p.state}`}>
      <span className="pd">{dateLabel(p.at.slice(0, 10)).replace(/ \(.\)$/, '')} · {nameOf(s, p.by)} 님이 {p.newUnit ? `새 업무 '${p.newUnit.name}' 만듦` : '더함'}</span>
      <ul>{p.duties.map((d, i) => <li key={i}><b>{d.title}</b> <span>{ruleLabel(d.rule)}</span></li>)}</ul>
      <span className="ps">{st}</span>
    </div>
  );
}

/** 업무 고르기 아래 '업무 만들기' 창. */
export function NewUnitModal({s, setS, toast, onClose, onMade}: {s: State; setS: (s: State) => void; toast: (m: string) => void; onClose: () => void; onMade?: () => void}) {
  const series = seriesOf(s);
  const [name, setName] = useState('');
  const [ser, setSer] = useState(series[0] ?? '');
  const [newSer, setNewSer] = useState('');
  const [lines, setLines] = useState<string[]>(['']);
  const parsed = parseLines(lines);
  const sname = ser === '__new' ? newSer.trim() : ser;
  const admin = !!sname && canApprove(s, sname);
  const ok = !!name.trim() && !!sname && ready(parsed);
  const dup = s.units.some(u => u.org === orgOf(s) && u.name === name.trim());
  return (
    <Modal title="업무 만들기" onCancel={onClose}>
      <div className="compose">
        <label className="fld"><span>업무 이름</span>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="예) 차량 관리" />
          {dup && <small className="hint">같은 이름의 업무가 이미 있습니다. 업무 고르기에서 찾아 맡으세요</small>}
        </label>
        <div className="fld"><span>분류</span>
          <div className="chips">
            {series.map(x => <button key={x} className={`chip${ser === x ? ' on' : ''}`} onClick={() => setSer(x)}>{x}</button>)}
            <button className={`chip${ser === '__new' ? ' on' : ''}`} onClick={() => setSer('__new')}>새 분류</button>
          </div>
          {ser === '__new' && <input value={newSer} onChange={e => setNewSer(e.target.value)} placeholder="예) 총무" aria-label="새 분류 이름" />}
        </div>
        <div className="fld"><span>반복업무 <em>한 줄에 하나, 주기를 앞에</em></span>
          <DutyLines lines={lines} setLines={setLines} />
        </div>
        <small className="hint">{!sname ? '' : admin ? '만들면 기준표에 바로 들어가고 내 업무가 됩니다' : `${seriesAdminsOf(s, sname).length ? `${sname} 분류 관리자` : '업무 표준 총괄 관리자'}(${who(s, sname)})가 승인하면 기준표에 들어가고 내 업무가 됩니다`}</small>
      </div>
      <div className="mb">
        <button className="ghost" onClick={onClose}>취소</button>
        <button className="primary" disabled={!ok || dup} onClick={() => {
          setS(propose(s, {newUnit: {name: name.trim(), series: sname}, duties: parsed.map(l => ({title: l.title, rule: l.rule!}))}));
          toast(admin ? `'${name.trim()}' 업무를 만들었습니다` : `${who(s, sname)} 님에게 올렸습니다. 승인되면 내 업무에 들어갑니다`);
          onClose(); onMade?.();
        }}>{admin ? '만들기' : '관리자에게 올리기'}</button>
      </div>
    </Modal>
  );
}

/** 내 정보: 관리자는 검토할 것, 그 밖의 사람은 내가 올린 것. */
export function StandardCard({s, setS, toast}: {s: State; setS: (s: State) => void; toast: (m: string) => void}) {
  const [reason, setReason] = useState<Record<string, string>>({});
  if (isStdAdmin(s)) {
    const list = pendingProposals(s);
    const scope = isStdMaster(s) ? '총괄 관리자 · 모든 분류' : `${myAdminSeries(s).join(', ')} 분류 관리자`;
    return (
      <>
      <div className="card">
        <div className="sec-h"><h3 className="dept">업무 표준 검토 {list.length}</h3><span className="scope">{scope}</span></div>
        {list.length === 0 && <p className="none">검토할 것이 없습니다</p>}
        {list.map(p => (
          <div key={p.id} className="review">
            <p className="rv-h"><b>{nameOf(s, p.by)}</b> 님 · {p.newUnit ? `새 업무 '${p.newUnit.name}'` : `${unitById(s, p.unitId!)?.name}에 더하기`} · {p.newUnit?.series ?? unitById(s, p.unitId!)?.series}</p>
            <ul>{p.duties.map((d, i) => <li key={i}><b>{d.title}</b> <span>{ruleLabel(d.rule)}</span></li>)}</ul>
            <div className="rv-act">
              <input placeholder="반려 사유 (반려할 때만)" value={reason[p.id] ?? ''} onChange={e => setReason({...reason, [p.id]: e.target.value})} />
              <button className="ghost" onClick={() => { setS(rejectProposal(s, p.id, (reason[p.id] ?? '').trim())); toast('반려했습니다'); }}>반려</button>
              <button className="primary sm" onClick={() => { setS(approveProposal(s, p.id)); toast('승인했습니다. 맡은 사람 모두에게 들어갑니다'); }}>승인</button>
            </div>
          </div>
        ))}
      </div>
      {isStdMaster(s) && <SeriesAdmins s={s} setS={setS} toast={toast} />}
      </>
    );
  }
  const mine = s.proposals.filter(p => p.by === s.me).slice().reverse();
  if (!mine.length) return null;
  return (
    <div className="card">
      <div className="sec-h"><h3 className="dept">내가 올린 업무 표준</h3></div>
      {mine.slice(0, 5).map(p => <PropRow key={p.id} s={s} p={p} />)}
    </div>
  );
}

/** 마스터: 분류마다 관리자 한 명. 비워 두면 그 분류는 마스터가 승인한다. */
function SeriesAdmins({s, setS, toast}: {s: State; setS: (s: State) => void; toast: (m: string) => void}) {
  const people = s.people.filter(p => p.org === orgOf(s) && !stdMasters(s).includes(p.id));
  return (
    <div className="card">
      <div className="sec-h"><h3 className="dept">분류별 관리자</h3><span className="scope">비워 두면 총괄 관리자가 승인</span></div>
      {seriesOf(s).map(x => (
        <div key={x} className="sa-row">
          <b>{x}</b>
          <select value={seriesAdminsOf(s, x)[0] ?? ''} aria-label={`${x} 분류 관리자`}
            onChange={e => { setS(setSeriesAdmin(s, x, e.target.value)); toast(e.target.value ? `${x} 분류 관리자를 ${nameOf(s, e.target.value)} 님으로 정했습니다` : `${x} 분류는 총괄 관리자가 승인합니다`); }}>
            <option value="">총괄 관리자가 맡음</option>
            {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      ))}
    </div>
  );
}
