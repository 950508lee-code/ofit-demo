// 업무 찾기 — 업무 이름(반복업무 이름 포함), 업무 안내(내 부서), 처리 순서를 함께 찾는다.
// 후임자는 정보가 어디에 적혀 있는지 모르므로 세 곳을 한 번에 본다. 결과 한 줄 = 업무 · 있는 곳 · 그 문장.
import {dutiesOfUnit, guideOf, orgOf, stepsOf, unitsOfOrg, type State} from './store';

export type Hit = {unitId: string; unit: string; where: string; text: string; group: 'name' | 'guide' | 'step'; anchor: string};

const norm = (x: string) => x.replace(/\s+/g, '').toLowerCase();
/** 저장된 업무 안내 글에서 문장(블록) 단위로 글자만 뽑는다. */
const blocks = (html: string) =>
  html.split(/<\/(?:p|h4|li)>|<br\s*\/?>/i).map(x => x.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()).filter(Boolean);

export function searchWork(s: State, q: string): Hit[] {
  const k = norm(q);
  if (!k) return [];
  const has = (x: string) => norm(x).includes(k);
  const out: Hit[] = [];
  for (const u of unitsOfOrg(s, orgOf(s))) {
    const duties = dutiesOfUnit(s, u.id);
    if (has(u.name)) out.push({unitId: u.id, unit: u.name, where: u.series, text: `반복업무 ${duties.length}개`, group: 'name', anchor: 'top'});
    for (const d of duties) if (has(d.title)) out.push({unitId: u.id, unit: d.title, where: `${u.name} 반복업무`, text: '', group: 'name', anchor: `duty:${d.id}`});
    const g = guideOf(s, u.id);
    if (g) for (const b of blocks(g.html)) if (has(b)) out.push({unitId: u.id, unit: u.name, where: '업무 안내', text: b, group: 'guide', anchor: 'guide'});
    for (const d of duties) {
      let n = 0;
      stepsOf(s, d).forEach((st, i) => {
        const label = st.warn ? '주의' : `${++n}단계`;
        if (has(st.text)) out.push({unitId: u.id, unit: u.name, where: `처리 순서 · ${d.title} ${label}`, text: st.text, group: 'step', anchor: `step:${d.id}:${i}`});
      });
    }
  }
  return out;
}

/** 찾은 말이 든 자리를 나눠 돌려준다(강조용). 띄어쓰기가 달라도 찾는다. */
export function splitHit(text: string, q: string): {t: string; on: boolean}[] {
  const k = q.replace(/\s+/g, '');
  if (!k) return [{t: text, on: false}];
  const re = new RegExp(k.split('').map(c => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*'), 'gi');
  const out: {t: string; on: boolean}[] = [];
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text))) { if (m.index > last) out.push({t: text.slice(last, m.index), on: false}); out.push({t: m[0], on: true}); last = m.index + m[0].length; if (!m[0]) re.lastIndex++; }
  if (last < text.length) out.push({t: text.slice(last), on: false});
  return out;
}
