import {searchWork, splitHit, type Hit} from '../search';
import type {State} from '../store';
import {usePlaceNav} from './placeNav';

const GROUPS: {id: Hit['group']; label: string}[] = [
  {id: 'name', label: '업무 이름'},
  {id: 'guide', label: '업무 안내'},
  {id: 'step', label: '처리 순서'},
];

/** 업무 찾기 결과 — 업무 · 있는 곳 · 그 문장. 누르면 그 업무 화면. 메뉴가 아니라 왼쪽 위 찾기 칸에서 연다. */
export function SearchResults({s, q}: {s: State; q: string}) {
  const goPlace = usePlaceNav();
  const hits = searchWork(s, q);
  const Mark = ({text}: {text: string}) => <>{splitHit(text, q).map((x, i) => (x.on ? <mark key={i}>{x.t}</mark> : <span key={i}>{x.t}</span>))}</>;
  return (
    <section className="list sr">
      {!q.trim() && <p className="none">업무 이름, 업무 안내, 처리 순서에서 찾습니다</p>}
      {q.trim() && hits.length === 0 && <p className="none">찾은 것이 없습니다</p>}
      {GROUPS.map(g => {
        const list = hits.filter(h => h.group === g.id);
        if (!list.length) return null;
        return (
          <div key={g.id} className="sr-g">
            <h3 className="dept">{g.label} <span>{list.length}</span></h3>
            {list.map((h, i) => (
              <button key={i} className="hit" onClick={() => goPlace({kind: 'unit', id: h.unitId}, {q, anchor: h.anchor, text: h.text})}>
                <b><Mark text={h.unit} /></b><span className="path">{h.where}</span>
                {h.text && <p><Mark text={h.text} /></p>}
              </button>
            ))}
          </div>
        );
      })}
    </section>
  );
}
