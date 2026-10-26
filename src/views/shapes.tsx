import {parse} from '../schedule';

/**
 * 글자 대신 모양 — 세 가지만 쓴다.
 * 점: 할 일 하나 / 칸: 묶음이 얼마나 찼나 / 선: 시간의 흐름.
 * 숫자는 모양 옆에 작게 남긴다(필요한 사람·화면 낭독기용).
 */

/** 칸 막대 — of칸 중 n칸 채움. 칸이 많으면 막대 하나로. */
export function Cells({n, of, label}: {n: number; of: number; label: string}) {
  return (
    <span className="cells" role="img" aria-label={`${label} ${of}개 중 ${n}개`}>
      <span className={`cells-row${of > 12 ? ' bar' : ''}`} aria-hidden="true">
        {of > 12
          ? <i style={{width: `${(n / of) * 100}%`}} />
          : Array.from({length: of}, (_, i) => <i key={i} className={i < n ? 'on' : ''} />)}
      </span>
      <small>{label} {n}/{of}</small>
    </span>
  );
}

/** 점 — all개 중 done개 끝냄. */
export function Pips({done, all}: {done: number; all: number}) {
  return (
    <span className="pips" aria-hidden="true">
      {Array.from({length: Math.min(all, 12)}, (_, i) => <i key={i} className={i < done ? 'done' : ''} />)}
      {all > 12 && <em>+{all - 12}</em>}
    </span>
  );
}

/** 기한 선 — 보낸 날에서 기한까지, 오늘이 어디쯤인지. 기한이 지나면 선 끝이 빨강. */
export function DueLine({from, due, today, done, fromLabel = '받음'}: {from: string; due: string; today: string; done?: boolean; fromLabel?: string}) {
  const a = parse(from).getTime(), b = parse(due).getTime(), t = parse(today).getTime();
  const p = b > a ? Math.min(1, Math.max(0, (t - a) / (b - a))) : 1;
  const days = Math.round((b - t) / 864e5);
  const over = !done && t > b;
  return (
    <span className={`dueline${over ? ' over' : ''}${done ? ' done' : ''}`} role="img"
      aria-label={done ? '완료' : over ? `기한 ${-days}일 지남` : days === 0 ? '오늘 기한' : `기한까지 ${days}일`}>
      <span className="track" aria-hidden="true"><i style={{width: `${p * 100}%`}} /><b style={{left: `${p * 100}%`}} /></span>
      <span className="ends" aria-hidden="true">
        <small>{from.slice(5).replace('-', '.')} {fromLabel}</small>
        <small>{done ? '완료' : over ? `${-days}일 지남` : days === 0 ? '오늘까지' : `${days}일 남음`}</small>
        <small>{due.slice(5).replace('-', '.')}까지</small>
      </span>
    </span>
  );
}
