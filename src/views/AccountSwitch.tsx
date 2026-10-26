import {useEffect, useRef, useState} from 'react';
import {deptName, login, nameOf, roleOf, type State} from '../store';

/**
 * 시연용 계정 바꾸기 — 로그아웃·로그인을 거치지 않고 다른 사람으로 바로 들어간다.
 * 시연에서 보내는 사람·받는 사람·관리자를 오갈 때 쓴다. 실제 도입 때는 뺀다.
 */
export function AccountSwitch({s, onSwitch, inline}: {s: State; onSwitch: (n: State) => void; inline?: boolean}) {
  const [open, setOpen] = useState(!!inline);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open || inline) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    addEventListener('mousedown', away); addEventListener('keydown', esc);
    return () => { removeEventListener('mousedown', away); removeEventListener('keydown', esc); };
  }, [open, inline]);
  const others = s.people.filter(p => p.id !== s.me);
  return (
    <div className={`acct${inline ? ' inline' : ''}`} ref={box}>
      {!inline && <button className="acct-btn" aria-expanded={open} onClick={() => setOpen(o => !o)}>시연용 계정 바꾸기</button>}
      {open && (
        <div className="acct-menu" role="menu" aria-label="다른 사람으로 들어가기">
          <p className="acct-h">지금 {nameOf(s, s.me)} 님 · 누구로 볼까요</p>
          {others.map(p => (
            <button key={p.id} role="menuitem" onClick={() => { setOpen(!!inline); onSwitch(login(s, p.id)); }}>
              <b>{p.name}</b>
              <small>{[deptName(s, p.deptId), roleOf(s, p.id)].filter(Boolean).join(' · ')}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
