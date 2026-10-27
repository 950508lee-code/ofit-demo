import {useEffect, useRef, useState} from 'react';
import {arrival} from './arrive';
import {HEADER, buildCatalog, decode, parseCsv, toCsv, type Built} from './catalog';
import type {OrgId} from './model';
import {addDays, occurrences} from './schedule';
import {initialState, login, newOrgId, orgName, registerOrg, signup, today, unitsOfOrg, type State, deptName
} from './store';
import {UnitPicker, dutiesOf} from './ui';
import {DeptBrowse} from './views/DeptPicker';
import {deptPath} from './store';

/** 첫 화면 — 가입한 사람으로 들어가기, 가입하기, 조직 등록하기. */
export function Login({s, setS}: {s: State; setS: (s: State) => void}) {
  const [mode, setMode] = useState<'home' | 'join' | 'org'>('home');
  if (mode === 'join') return <Signup s={s} setS={setS} onCancel={() => setMode('home')} />;
  if (mode === 'org') return <RegisterOrg s={s} onCancel={() => setMode('home')} onDone={n => { setS(n); setMode('home'); }} />;
  // 시연 계정은 '이 계정으로 무엇을 보는지' 한 줄로. 김건강에서 시작하게 한다. 시연 중에 가입한 사람은 부서를 보인다.
  const ROLE: Record<string, string> = {kim: '업무관리 · 인수인계', han: '반복업무 표준 검토', choi: '업무 표준 총괄 관리'};
  const order = ['kim', 'han', 'choi'];
  const people = [...s.people].sort((a, b) => (order.indexOf(a.id) + 1 || 99) - (order.indexOf(b.id) + 1 || 99));
  return (
    <div className="flow start-flow">
      <h1 className="logo" data-logo>OFIT<span className="logo-ko">오핏</span></h1>
      <p className="lead tag">담당자가 바뀌어도 업무는 이어집니다.</p>
      {/* 시연은 회원가입부터(2026-10-26 사용자 요청): 이름 → 소속 부서 → 업무분장 → 주기업무가 일정에 들어감 → 홈 */}
      <div className="choices start-join">
        <button className="choice acct first" onClick={() => setMode('join')}>
          <span>새 직원으로 시작하기</span>
          <small>회원가입 · 업무분장 고르기</small>
          <em className="go">여기서 시작</em>
        </button>
      </div>
      {people.length > 0 && <p className="choices-label">이미 가입한 사람으로 보기</p>}
      <div className="choices">
        {people.map(p => (
          <button key={p.id} className="choice acct" onClick={() => setS(login(s, p.id))}>
            <span>{p.name}</span>
            <small>{ROLE[p.id] ?? (deptName(s, p.deptId) || orgName(s, p.org))}</small>
          </button>
        ))}
      </div>
      <div className="start-acts">
        <button className="ghost wide" onClick={() => setMode('org')}>우리 기관 등록하기</button>
      </div>
      <p className="start-foot">
        <span>본 서비스는 시연용이며, 인물과 업무자료는 모두 가상입니다.</span>
        <button className="textbtn" onClick={() => setS(initialState())}>처음 상태로 되돌리기</button>
      </p>
    </div>
  );
}

const download = (name: string, text: string) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], {type: 'text/csv;charset=utf-8'}));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

/** 조직 등록 — 이름과 업무 기준표 파일 하나. 이것만 있으면 어느 조직이든 쓸 수 있다. */
function RegisterOrg({s, onCancel, onDone}: {s: State; onCancel: () => void; onDone: (s: State) => void}) {
  const [step, setStep] = useState<'name' | 'file' | 'check'>('name');
  const [name, setName] = useState('');
  const [orgId] = useState(newOrgId);
  const [built, setBuilt] = useState<Built | null>(null);
  const [fileName, setFileName] = useState('');
  const taken = s.orgs.some(o => o.name === name.trim());
  const sample = s.orgs[0];

  if (step === 'name') {
    const ok = name.trim() && !taken;
    return (
      <div className="flow" key={step}>
        <button className="textbtn close" onClick={onCancel}>취소</button>
        <h1>조직 이름을 입력해 주세요</h1>
        <input className="search big" autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="조직 이름" aria-label="조직 이름"
          onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && ok) setStep('file'); }} />
        {taken && <p className="err">이미 등록된 조직입니다</p>}
        <div className="flow-foot">
          <button className="primary wide" disabled={!ok} onClick={() => setStep('file')}>다음</button>
        </div>
      </div>
    );
  }

  if (step === 'file') {
    const read = async (f: File) => {
      setFileName(f.name);
      setBuilt(buildCatalog(orgId, parseCsv(decode(await f.arrayBuffer()))));
      setStep('check');
    };
    return (
      <div className="flow" key={step}>
        <button className="textbtn close" onClick={() => setStep('name')}>이전</button>
        <h1>업무 기준표를 올려 주세요</h1>
        <p className="lead">네 칸짜리 표 하나면 됩니다. 엑셀은 CSV로 저장해서 올려 주세요.</p>
        <table className="sheet">
          <thead><tr>{HEADER.map(h => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>
            <tr><td>경영지원</td><td>예산·회계</td><td>지출결의 마감</td><td>매월 25일</td></tr>
            <tr><td>경영지원</td><td>예산·회계</td><td>분기 예산 집행률 보고</td><td>분기 시작월 10일</td></tr>
          </tbody>
        </table>
        <p className="hint">주기는 매일 · 매주 월요일 · 매월 15일 · 매월 말일 · 매월 넷째 주 월요일 · 분기 시작월 말일 처럼 씁니다</p>
        <div className="links">
          <button className="textbtn" onClick={() => download('업무기준표_양식.csv', toCsv([], []))}>양식 내려받기</button>
          {sample && <button className="textbtn" onClick={() => download(`${sample.name}_업무기준표.csv`, toCsv(unitsOfOrg(s, sample.id), s.duties))}>{sample.name} 예시 내려받기</button>}
        </div>
        <div className="flow-foot">
          <label className="primary wide filebtn">
            파일 고르기
            <input type="file" accept=".csv,text/csv" onChange={e => { const f = e.target.files?.[0]; if (f) read(f); }} />
          </label>
        </div>
      </div>
    );
  }

  const b = built!;
  const ok = b.units.length > 0;
  return (
    <div className="flow" key={step}>
      <button className="textbtn close" onClick={() => setStep('file')}>파일 다시 올리기</button>
      <h1>{name.trim()}</h1>
      <p className="lead">{fileName}</p>
      {ok ? (
        <ul className="ready">
          {b.series.map(x => {
            const us = b.units.filter(u => u.series === x);
            const n = b.duties.filter(d => us.some(u => d.unitIds.includes(u.id))).length;
            return <li key={x}><b>{x}</b><span>단위업무 {us.length}개 · 반복업무 {n}개</span></li>;
          })}
        </ul>
      ) : <p className="err">읽을 수 있는 줄이 없습니다. 네 칸(직렬, 단위업무, 반복업무, 주기)이 맞는지 확인해 주세요.</p>}
      {b.bad.length > 0 && (
        <div className="badlines">
          <p className="err">읽지 못한 줄 {b.bad.length}개는 빼고 등록합니다</p>
          <ul>{b.bad.slice(0, 5).map(x => <li key={x.line}>{x.line}번째 줄 · {x.text}</li>)}</ul>
        </div>
      )}
      <div className="flow-foot">
        <p className="foot-sum">{ok ? `단위업무 ${b.units.length}개 · 반복업무 ${b.duties.length}개` : '등록할 수 없습니다'}</p>
        <button className="primary wide" disabled={!ok} onClick={() => onDone(registerOrg(s, orgId, name.trim(), b.units, b.duties))}>등록</button>
      </div>
    </div>
  );
}

/** 가입 — 이름 → 조직 → 업무 여러 개 → 반복일정이 들어간다. */
function Signup({s, setS, onCancel}: {s: State; setS: (s: State) => void; onCancel: () => void}) {
  const [step, setStep] = useState<'name' | 'org' | 'dept' | 'units' | 'done'>('name');
  const [deptId, setDeptId] = useState('');
  const [name, setName] = useState('');
  // 조직이 하나뿐이면 고르는 화면을 건너뛴다(회원가입 3단계: 이름 · 소속 부서 · 업무분장)
  const only = s.orgs.length === 1 ? s.orgs[0].id : null;
  const [org, setOrg] = useState<OrgId | null>(only);
  const afterName = () => setStep(only ? 'dept' : 'org');
  const [picked, setPicked] = useState<string[]>([]);

  if (step === 'name') {
    return (
      <div className="flow" key={step}>
        <button className="textbtn close" onClick={onCancel}>취소</button>
        <p className="signup-step">회원가입 1/3</p>
        <h1>이름을 입력해 주세요</h1>
        <input className="search big" autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="이름" aria-label="이름"
          onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && name.trim()) afterName(); }} />
        <div className="flow-foot">
          <button className="primary wide" disabled={!name.trim()} onClick={afterName}>다음</button>
        </div>
      </div>
    );
  }

  if (step === 'org') {
    return (
      <div className="flow" key={step}>
        <button className="textbtn close" onClick={() => setStep('name')}>이전</button>
        <h1>어느 조직에서 일하나요?</h1>
        <p className="lead">조직을 고르면 그 조직의 업무가 나옵니다</p>
        <div className="choices">
          {s.orgs.map(o => (
            <button key={o.id} className="choice" onClick={() => { setOrg(o.id); setStep('dept'); }}>
              <span>{o.name}</span>
              <small>업무 {unitsOfOrg(s, o.id).length}개</small>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (step === 'dept') {
    return (
      <div className="flow" key={step}>
        <button className="textbtn close" onClick={() => setStep(only ? 'name' : 'org')}>이전</button>
        <p className="signup-step">회원가입 2/3</p>
        <h1>어느 부서에서 일하나요?</h1>
        <p className="lead">{orgName(s, org!)} 조직표에서 고르세요. 없으면 그 자리에 만들 수 있습니다</p>
        <DeptBrowse s={s} org={org!} onPick={id => { setDeptId(id); setStep('units'); }}
          onCreate={(n, id) => { setS(n); setDeptId(id); setStep('units'); }} />
      </div>
    );
  }

  if (step === 'units') {
    return (
      <UnitPicker s={s} org={org!} title="맡은 업무를 모두 고르세요" lead={`회원가입 3/3 · ${deptPath(s, deptId)} · 여러 개 고를 수 있습니다`}
        doneLabel="다음" back={{label: '이전', onClick: () => setStep('dept')}}
        onDone={ids => { setPicked(ids); setStep('done'); }} />
    );
  }

  return <Filling s={s} units={picked} onStart={() => setS(signup(s, name.trim(), org!, deptId, picked))} />;
}

/**
 * 업무분장에 따라 주기업무를 일정에 넣는 화면(시연의 첫 장면, 2026-10-26 사용자 요청).
 * 반복업무가 하나씩 들어올 때마다 앞으로 4주 날짜 칸에 그 회차가 점으로 찍히고, 다 차면 잠시 뒤 저절로 홈으로 간다.
 * 움직임은 하나에 250ms 이하·튕김 없음. 움직임 줄이기면 점·줄이 투명도로만 나타난다.
 */
export function Filling({s, units, onStart}: {s: State; units: string[]; onStart: () => void}) {
  const picked = s.units.filter(u => units.includes(u.id));
  const duties = [...new Set(picked.flatMap(u => dutiesOf(s, u)))];
  const from = today(), to = addDays(from, 27);
  const total = duties.reduce((n, d) => n + occurrences(d.rule, from, to).length, 0);
  // 가운데 한 문장 + 아래 선(시간)이 차오른다(반복업무 이름은 보이지 않는다, 2026-10-26). 다 차면 잠깐 머물고 저절로 홈으로
  const step = Math.max(100, Math.min(250, 1200 / Math.max(duties.length, 1)));
  const [shown, setShown] = useState(0);
  const started = useRef(false);
  const root = useRef<HTMLDivElement>(null);
  // 나갈 때: 글자와 선이 먼저 걷히고(200ms) → 흰 막 아래에서 다음 화면으로 바뀐 뒤 막이 걷힌다(360ms). 화면이 툭 바뀌지 않게
  const go = () => {
    if (started.current) return;
    started.current = true;
    arrival.pending = true;
    const el = root.current;
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) { onStart(); return; }
    [...el.children].forEach(c => c.animate([{opacity: 1}, {opacity: 0, transform: 'translateY(-8px)'}], {duration: 200, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards'}));
    setTimeout(() => {
      const veil = document.createElement('div');
      veil.className = 'veil';
      document.body.append(veil);
      onStart();
      veil.animate([{opacity: 1}, {opacity: 0}], {duration: 360, delay: 40, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards'}).finished.then(() => veil.remove(), () => veil.remove());
    }, 200);
  };
  useEffect(() => {
    if (shown >= duties.length) { const t = setTimeout(go, 1300); return () => clearTimeout(t); }
    const t = setTimeout(() => setShown(n => n + 1), shown === 0 ? 400 : step);
    return () => clearTimeout(t);
  }, [shown, duties.length, step]);
  const done = shown >= duties.length;
  return (
    <div ref={root} className={`flow fill2${done ? ' done' : ''}`} onClick={() => done && go()}>
      <div className="fl-word" aria-live="polite">
        {done
          ? <h1 key="done" className="fl-in">반복업무 {duties.length}개를<br />일정에 넣었습니다</h1>
          : <h1 key="ing">업무분장에 따라<br />일정을 채우고 있어요</h1>}
      </div>
      <div className="fl-line" aria-hidden="true"><i style={{transform: `scaleX(${duties.length ? shown / duties.length : 1})`}} /></div>
      <p className="fl-n">{done ? <>앞으로 4주 할 일 <b>{total}개</b></> : <>반복업무 {shown} / {duties.length}</>}</p>
    </div>
  );
}
