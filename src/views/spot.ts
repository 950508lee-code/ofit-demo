// 찾기 결과에서 업무 화면으로 왔을 때: 그 자리로 옮기고 찾은 말을 강조한다.
// 강조는 글자를 감싸지 않고 브라우저의 강조 기능(CSS Custom Highlight)으로 칠한다 — 화면 구조(React)를 건드리지 않는다.
import type {Spot} from './placeNav';

const norm = (x: string) => x.replace(/\s+/g, '');

/** 업무 화면에서 spot 이 가리키는 요소. 업무 안내는 그 문장이 든 줄까지 찾는다. */
function target(root: HTMLElement, sp: Spot): HTMLElement | null {
  if (sp.anchor === 'top') return root.querySelector('.place-h');
  const el = root.querySelector<HTMLElement>(`[data-spot="${sp.anchor}"]`);
  if (!el || sp.anchor !== 'guide' || !sp.text) return el;
  const want = norm(sp.text);
  return [...el.querySelectorAll<HTMLElement>('h4, p, li')].find(b => norm(b.textContent ?? '').includes(want)) ?? el;
}

/** 찾은 말의 자리(Range)들. 띄어쓰기가 달라도 찾는다. */
function ranges(el: HTMLElement, q: string): Range[] {
  const k = norm(q).toLowerCase();
  if (!k) return [];
  const out: Range[] = [];
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode() as Text | null; n; n = w.nextNode() as Text | null) {
    const t = n.data, low = t.toLowerCase();
    for (let i = 0; i < t.length; i++) {
      if (/\s/.test(t[i])) continue;
      let j = i, m = 0;
      while (j < t.length && m < k.length) { if (/\s/.test(t[j])) { j++; continue; } if (low[j] !== k[m]) break; j++; m++; }
      if (m === k.length) { const r = new Range(); r.setStart(n, i); r.setEnd(n, j); out.push(r); i = j - 1; }
    }
  }
  return out;
}

type Hl = {set: (name: string, h: unknown) => void; delete: (name: string) => void};
const highlights = () => (globalThis as unknown as {CSS?: {highlights?: Hl}}).CSS?.highlights;
const HighlightCtor = () => (globalThis as unknown as {Highlight?: new (...r: Range[]) => unknown}).Highlight;

/** 옮기고 칠한다. 돌려받은 함수로 지운다. */
export function showSpot(root: HTMLElement, sp: Spot): () => void {
  const el = target(root, sp);
  if (!el) return () => {};
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({block: 'center', behavior: reduce ? 'auto' : 'smooth'});
  el.classList.add('spot-on');
  const hl = highlights(), H = HighlightCtor();
  if (hl && H) hl.set('ofit-hit', new H(...ranges(el, sp.q)));
  return () => { el.classList.remove('spot-on'); highlights()?.delete('ofit-hit'); };
}
