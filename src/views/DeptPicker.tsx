import {useState} from 'react';
import type {OrgId} from '../model';
import {addDept, deptOf, deptPath, deptsOfOrg, type State} from '../store';

/** 받침에 맞는 '으로/로' (ㄹ 받침은 '로'). */
const ro = (w: string) => {
  const c = w.charCodeAt(w.length - 1) - 0xac00;
  if (c < 0 || c > 11171) return '로';
  const jong = c % 28;
  return jong === 0 || jong === 8 ? '로' : '으로';
};

/**
 * 부서 하나 고르기(가입할 때) — 위에서부터 들어가며 고르거나 검색. 없으면 지금 보고 있는 부서 아래에 만든다.
 * 조직표가 없는 조직(파일로 등록한 조직)은 바로 '부서 만들기'만 보인다.
 */
export function DeptBrowse({s, org, onPick, onCreate}: {
  s: State; org: OrgId; onPick: (id: string) => void; onCreate: (s: State, id: string) => void;
}) {
  const all = deptsOfOrg(s, org);
  const [at, setAt] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [making, setMaking] = useState(!all.length);
  const [name, setName] = useState('');
  const k = q.trim();
  const kids = (id: string | null) => all.filter(d => d.parentId === id);
  const list = k ? all.filter(d => d.name.includes(k)).slice(0, 40) : kids(at);
  const here = deptOf(s, at ?? undefined);

  return (
    <>
      <input className="search" placeholder="부서 이름으로 찾기  예) 광진지사" value={q} onChange={e => setQ(e.target.value)} aria-label="부서 찾기" />
      {!k && here && (
        <div className="crumb">
          <button className="textbtn" onClick={() => setAt(here.parentId)}>위로</button>
          <span>{deptPath(s, here.id)}</span>
          <button className="ghost strong" onClick={() => onPick(here.id)}>{here.name}{ro(here.name)} 정하기</button>
        </div>
      )}
      <div className="choices">
        {list.map(d => {
          const n = kids(d.id).length;
          return (
            <button key={d.id} className="choice" onClick={() => (n && !k ? (setAt(d.id), setQ('')) : onPick(d.id))}>
              <span>{k ? deptPath(s, d.id) : d.name}</span>
              <small>{n && !k ? `하위 ${n}` : '고르기'}</small>
            </button>
          );
        })}
        {list.length === 0 && all.length > 0 && <p className="none">찾는 부서가 없습니다</p>}
      </div>
      {making ? (
        <div className="inline-form mk">
          <input className="search" autoFocus value={name} placeholder={here ? `${here.name} 아래 새 부서 이름  예) 급여부` : '새 부서 이름'} onChange={e => setName(e.target.value)} aria-label="새 부서 이름" />
          <button className="ghost strong" disabled={!name.trim()} onClick={() => { const r = addDept(s, org, name.trim(), at); onCreate(r.s, r.id); }}>만들기</button>
          {all.length > 0 && <button className="textbtn" onClick={() => setMaking(false)}>취소</button>}
        </div>
      ) : (
        <button className="textbtn more-link" onClick={() => setMaking(true)}>
          찾는 부서가 없나요? {here ? `${here.name} 아래에 ` : ''}부서 만들기
        </button>
      )}
    </>
  );
}

/** 부서 여러 개 고르기(부서 일정 보낼 때) — 검색 결과에서 고르고, 고른 것은 위에 칩으로. */
export function DeptMulti({s, org, value, onChange, exclude}: {
  s: State; org: OrgId; value: string[]; onChange: (v: string[]) => void; exclude?: string;
}) {
  const [q, setQ] = useState('');
  const k = q.trim();
  const all = deptsOfOrg(s, org).filter(d => d.id !== exclude);
  const found = k ? all.filter(d => d.name.includes(k) && !value.includes(d.id)).slice(0, 8) : [];
  return (
    <div className="dmulti">
      {value.length > 0 && (
        <div className="chips">
          {value.map(id => (
            <button key={id} className="chip on" onClick={() => onChange(value.filter(x => x !== id))} aria-label={`${deptPath(s, id)} 빼기`}>
              {deptOf(s, id)?.name} <span aria-hidden>×</span>
            </button>
          ))}
        </div>
      )}
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="부서 찾기  예) 광진지사, 보험급여" aria-label="받을 부서 찾기" />
      {found.length > 0 && (
        <ul className="found">
          {found.map(d => (
            <li key={d.id}><button onClick={() => { onChange([...value, d.id]); setQ(''); }}>{deptPath(s, d.id)}</button></li>
          ))}
        </ul>
      )}
    </div>
  );
}
