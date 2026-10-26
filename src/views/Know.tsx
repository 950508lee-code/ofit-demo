import {useEffect, useRef, useState, type CSSProperties} from 'react';
import {deptName, dutiesOfUnit, holdsOf, meOf, nameOf, orgOf, stepsOf, unitById, unitsOfOrg} from '../store';
import type {Ctx} from './common';
import {Cells} from './shapes';
import {GuideBox} from './Guide';
import {HowTo, Refs, Tenure, notedOf} from './Place';
import {NewUnitModal, StandardCard, UnitStandard} from './Standard';
import {placeColor} from './placeColor';
import {useWorkNav, type Spot} from './placeNav';
import {showSpot} from './spot';

/**
 * 업무지식 — '어떻게 하지?'(2026-10-26 사용자 판정). 조직의 업무 기준표 전체를 왼쪽에 두고, 고른 업무의 지식을 문서로 읽는다.
 * 내가 맡지 않은 업무도 읽을 수 있다. 업무 안내는 지금처럼 우리 부서 것만(공통 업무지식은 나중).
 * 지난 기록은 내 업무가 주인이고, 여기서는 한 줄 요약과 '보기'(오른쪽 판)만 둔다.
 * 폰: 고른 업무가 없으면 목록, 고르면 문서(위에 '업무 목록'). 좁은 PC(1280 미만): 목록 대신 위쪽 고르기 칸 — 문서 폭을 먼저.
 */
export function Know({s, setS, open, setOpen, toast, id, setId, spot}: Ctx & {id: string | null; setId: (id: string | null) => void; spot?: Spot | null}) {
  const goWork = useWorkNav();
  const [making, setMaking] = useState(false);
  const root = useRef<HTMLElement>(null);
  const all = unitsOfOrg(s, orgOf(s));
  const held = holdsOf(s, s.me);
  const series = [...new Set(all.map(u => u.series))];
  // PC는 고른 것이 없으면 내 첫 업무(없으면 목록 첫 업무)를 펼쳐 둔다
  const curId = id ?? all.find(u => held.includes(u.id))?.id ?? all[0]?.id;
  const u = curId ? unitById(s, curId) : undefined;
  // 찾기 결과에서 왔으면 화면 전환이 끝난 뒤 그 자리로 옮기고 찾은 말을 칠한다
  useEffect(() => {
    if (!spot || !root.current) return;
    let undo = () => {};
    const t = setTimeout(() => { if (root.current) undo = showSpot(root.current, spot); }, 260);
    return () => { clearTimeout(t); undo(); };
  }, [spot, curId]);

  const me = meOf(s)!;
  const mine = !!u && held.includes(u.id);
  const duties = u ? dutiesOfUnit(s, u.id) : [];
  const holders = u ? s.people.filter(p => p.deptId === me.deptId && holdsOf(s, p.id).includes(u.id)) : [];
  const noted = u ? notedOf(s, u.id) : [];

  return (
    <div className={`know${id ? ' reading' : ''}`}>
      {making && <NewUnitModal s={s} setS={setS} toast={toast} onClose={() => setMaking(false)} />}
      <div className="know-top"><StandardCard s={s} setS={setS} toast={toast} /></div>
      <div className="know-pick">
        <label htmlFor="know-pick">업무</label>
        <select id="know-pick" value={curId ?? ''} onChange={e => setId(e.target.value)}>
          {series.map(x => (
            <optgroup key={x} label={x}>
              {all.filter(v => v.series === x).map(v => <option key={v.id} value={v.id}>{v.name}{held.includes(v.id) ? ' (맡음)' : ''}</option>)}
            </optgroup>
          ))}
        </select>
        <button className="textbtn" onClick={() => setMaking(true)}>업무 만들기</button>
      </div>
      <div className="know-grid">
        <nav className="know-list" aria-label="업무 목록">
          <h2 className="m-only-block">업무지식</h2>
          {series.map(x => (
            <div key={x} className="kl-g">
              <h3>{x}</h3>
              {all.filter(v => v.series === x).map(v => (
                <button key={v.id} className={v.id === curId ? 'on' : ''} aria-current={v.id === curId ? 'page' : undefined} onClick={() => setId(v.id)}>
                  <span>{v.name}</span>{held.includes(v.id) && <small>맡음</small>}
                </button>
              ))}
            </div>
          ))}
          <button className="textbtn kl-new" onClick={() => setMaking(true)}>업무 만들기</button>
        </nav>

        {u && (
          <article ref={root} className="list place know-doc" style={{'--pc': placeColor(s, {kind: 'unit', id: u.id})} as CSSProperties}>
            <div className="flow-back m-only-block"><button className="textbtn" onClick={() => setId(null)}>업무 목록</button></div>
            <div className="place-h">
              <div>
                <p className="over">업무지식 · {u.series}</p>
                <h2><span className="swatch" aria-hidden="true" />{u.name}</h2>
                <p className="sub">반복업무 {duties.length}개 · {holders.length ? `${deptName(s, me.deptId)}에서 ${holders.map(p => p.name).join(', ')} 님이 맡음` : `${deptName(s, me.deptId)}에서 맡은 사람 없음`}</p>
                <Cells n={duties.filter(d => stepsOf(s, d).length).length} of={duties.length} label="처리 순서 적은 일" />
              </div>
              {mine && <button className="ghost" onClick={() => goWork(u.id)}>내 업무에서 보기</button>}
            </div>

            <GuideBox s={s} setS={setS} toast={toast} unitId={u.id} />
            <HowTo s={s} duties={duties} />
            <Refs s={s} setS={setS} toast={toast} unitId={u.id} mine={mine} />
            <UnitStandard s={s} setS={setS} toast={toast} unitId={u.id} />

            <div className="day">
              <div className="sec-h">
                <h3 className="dept">지난 기록 <span>{noted.length}</span></h3>
                {noted.length > 0 && <button className="textbtn" aria-pressed={open?.kind === 'recs' && open.id === u.id}
                  onClick={() => setOpen({kind: 'recs', id: u.id})}>보기</button>}
              </div>
              {noted.length === 0
                ? <p className="none">남긴 기록이 없습니다</p>
                : <p className="rec-last">가장 최근 {noted[0].date.slice(2).replace(/-/g, '.')} · {nameOf(s, noted[0].by)} · {s.duties.find(d => d.id === noted[0].dutyId)?.title}</p>}
            </div>

            <Tenure s={s} unitId={u.id} />
          </article>
        )}
      </div>
    </div>
  );
}
