import {myGroups, myUnits, type State} from '../store';
import type {Place} from './placeNav';

/**
 * 자리 색 — 업무·부서·그룹마다 차분한 진한 색 하나(6색, --p0~--p5).
 * 초록(끝냄)·빨강(기한 지남)은 상태 색이라 쓰지 않는다. 내 일·매일 하는 일은 색 없음(--ink).
 * 내 업무는 맡은 순서대로 0번부터, 그룹은 그 다음, 부서는 이름으로 고정.
 */
const N = 6;
export function placeColor(s: State, at?: Place): string {
  if (!at) return 'var(--sub)';
  if (at.kind === 'unit') {
    const i = myUnits(s).findIndex(u => u.id === at.id);
    return `var(--p${(i < 0 ? hash(at.id) : i) % N})`;
  }
  if (at.kind === 'group') {
    const i = myGroups(s).findIndex(g => g.id === at.id);
    return `var(--p${(myUnits(s).length + (i < 0 ? hash(at.id) : i)) % N})`;
  }
  return `var(--p${hash(at.id) % N})`;
}
const hash = (x: string) => [...x].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
