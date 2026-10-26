import {useEffect, useRef, useState} from 'react';
import {canEditGuide, deptName, guideOf, meOf, nameOf, refsOfUnit, saveGuide, scopeOf, setScope, type State} from '../store';
import type {Ref} from '../model';

/**
 * 업무 안내 — 업무 전체에 관한 부서의 경험. 읽던 자리에서 그대로 고친다(따로 문서 창을 열지 않는다).
 * 서식은 제목·목록·번호 목록·참고자료 연결뿐. 쓰지 않아도 업무는 그대로 돈다.
 * 쓰는 동안 1초 멈추면 이 브라우저에 임시저장하고, 다시 열면 이어서 쓴다.
 */

// 남기는 태그. 나머지 꾸밈(글꼴·색·표 등)은 벗기고 글만 남긴다. 붙여 넣은 글과 저장된 글 모두 이것을 거친다.
const KEEP: Record<string, string> = {P: 'P', DIV: 'P', H1: 'H4', H2: 'H4', H3: 'H4', H4: 'H4', H5: 'H4', H6: 'H4', UL: 'UL', OL: 'OL', LI: 'LI', B: 'B', STRONG: 'B', BR: 'BR'};
export function cleanGuide(html: string): string {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const out = document.createElement('div');
  const walk = (from: Node, to: Node) => from.childNodes.forEach(n => {
    if (n.nodeType === Node.TEXT_NODE) { to.appendChild(document.createTextNode(n.textContent ?? '')); return; }
    if (!(n instanceof Element) || /^(SCRIPT|STYLE|META|LINK|TITLE)$/.test(n.tagName)) return;
    if (n.tagName === 'A' && n.getAttribute('data-ref')) {
      const a = document.createElement('a'); a.className = 'rf'; a.setAttribute('data-ref', n.getAttribute('data-ref')!); a.textContent = n.textContent; to.appendChild(a); return;
    }
    const tag = KEEP[n.tagName];
    if (!tag) { walk(n, to); return; }
    const el = document.createElement(tag); walk(n, el); to.appendChild(el);
  });
  walk(doc.body.firstChild!, out);
  return out.innerHTML.replace(/<p>(\s|<br>)*<\/p>/g, '').trim();
}

const DRAFT = (k: string) => `ofit-guide-draft-${k}`;
const loadDraft = (k: string) => { try { return localStorage.getItem(DRAFT(k)); } catch { return null; } };
const keepDraft = (k: string, html: string) => { try { localStorage.setItem(DRAFT(k), html); } catch { /* 저장소를 못 쓰면 화면 안에서만 */ } };
const dropDraft = (k: string) => { try { localStorage.removeItem(DRAFT(k)); } catch { /* 무시 */ } };
const hhmm = (d = new Date()) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const md = (iso: string) => { const d = new Date(iso); return `${d.getMonth() + 1}월 ${d.getDate()}일`; };

/** 읽기용: 참고자료 연결은 그 자료로 가는 글자로 바꾼다(링크는 새 창, 파일은 있는 곳을 말풍선으로). */
// 목차는 제목 수가 아니라 글의 실제 길이로 정한다: 제목이 둘 이상이고, 그려진 본문 높이가 TOC_H를 넘을 때만.
const TOC_H = 720;

export function GuideBody({html, refs, spot = true}: {html: string; refs: Ref[]; spot?: boolean}) {
  const box = useRef<HTMLDivElement>(null);
  const [toc, setToc] = useState<string[]>([]);
  useEffect(() => {
    box.current?.querySelectorAll<HTMLAnchorElement>('a.rf').forEach(a => {
      const r = refs.find(x => x.id === a.dataset.ref);
      if (!r) { a.removeAttribute('href'); return; }
      if (r.kind === 'link') { a.href = r.where; a.target = '_blank'; a.rel = 'noreferrer'; } else a.title = r.where;
    });
  }, [html, refs]);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => {
      const heads = [...el.querySelectorAll('h4')].map(h => h.textContent?.trim() ?? '');
      setToc(heads.length >= 2 && el.offsetHeight > TOC_H ? heads : []);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [html]);
  const jump = (i: number) => {
    const h = box.current?.querySelectorAll('h4')[i];
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    h?.scrollIntoView({behavior: calm ? 'auto' : 'smooth', block: 'start'});
  };
  return <>
    {toc.length > 0 && (
      <nav className="gd-toc" aria-label="업무 안내 목차">
        {toc.map((t, i) => <button key={i} onClick={() => jump(i)}><span>{i + 1}</span>{t}</button>)}
      </nav>
    )}
    <div ref={box} data-spot={spot ? 'guide' : undefined} className="gd-body" dangerouslySetInnerHTML={{__html: cleanGuide(html)}} />
  </>;
}

export function GuideBox({s, setS, toast, unitId}: {s: State; setS: (s: State) => void; toast: (m: string) => void; unitId: string}) {
  const g = guideOf(s, unitId), mine = canEditGuide(s, unitId), refs = refsOfUnit(s, unitId);
  const scope = scopeOf(s, meOf(s)?.deptId, unitId);
  const dk = `${s.people.find(p => p.id === s.me)?.deptId}:${unitId}`;
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState('');
  const [pick, setPick] = useState(false);
  const ed = useRef<HTMLDivElement>(null);
  const timer = useRef<number>(0);
  const start = () => {
    const d = loadDraft(dk);
    setEditing(true); setSaved(d ? '이어서 씁니다' : '');
    setTimeout(() => {
      const el = ed.current; if (!el) return;
      el.innerHTML = cleanGuide(d ?? g?.html ?? '') || '<p><br></p>';
      document.execCommand('defaultParagraphSeparator', false, 'p');
      el.focus();
    }, 0);
  };
  const onInput = () => {
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { if (ed.current) { keepDraft(dk, ed.current.innerHTML); setSaved(`임시저장 ${hhmm()}`); } }, 1000);
  };
  const finish = (save: boolean) => {
    clearTimeout(timer.current);
    if (save && ed.current) { setS(saveGuide(s, unitId, cleanGuide(ed.current.innerHTML))); toast('저장했습니다'); }
    dropDraft(dk); setEditing(false); setPick(false);
  };
  const cmd = (c: 'h' | 'b' | 'ul' | 'ol') => {
    ed.current?.focus();
    if (c === 'h') {
      // 지금 줄이 제목이면 문단으로, 아니면 제목으로(브라우저마다 다른 queryCommandValue 대신 화면 구조로 판단)
      const n = getSelection()?.anchorNode;
      const el = n && (n.nodeType === Node.ELEMENT_NODE ? n as Element : n.parentElement);
      document.execCommand('formatBlock', false, el?.closest('h4') ? 'p' : 'h4');
    }
    if (c === 'b') document.execCommand('bold'); // 핵심 정보(마감·주의)는 작성자가 직접 굵게 표시한다
    if (c === 'ul') document.execCommand('insertUnorderedList');
    if (c === 'ol') document.execCommand('insertOrderedList');
    onInput();
  };
  const sel = useRef<Range | null>(null);
  const keepSel = () => { const x = getSelection(); if (x?.rangeCount && ed.current?.contains(x.anchorNode)) sel.current = x.getRangeAt(0).cloneRange(); };
  const insertRef = (r: Ref) => {
    ed.current?.focus();
    if (sel.current) { const x = getSelection(); x?.removeAllRanges(); x?.addRange(sel.current); }
    const text = sel.current && !sel.current.collapsed ? sel.current.toString() : r.title;
    document.execCommand('insertHTML', false, `<a class="rf" data-ref="${r.id}">${text.replace(/[<>&"]/g, '')}</a>&nbsp;`);
    setPick(false); onInput();
  };
  const onPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html'), text = e.clipboardData.getData('text/plain');
    const esc = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    document.execCommand('insertHTML', false, html ? cleanGuide(html) : text.split(/\n{2,}/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join(''));
    onInput();
  };

  return (
    <div className="day gd">
      <div className="gd-h">
        <h3 className="dept">업무 안내</h3>
        {!editing && g && <span className="gd-who">{md(g.at)} {nameOf(s, g.by)} 고침{mine && <button className="textbtn" onClick={start}>고치기</button>}</span>}
      </div>
      <div className="gd-kind">
        <p className="kind">{deptName(s, meOf(s)?.deptId)} 운영 방식 · 업무 전체에 관한 것</p>
        {/* 공개 범위: 업무 안내와 처리 순서의 우리 부서 방식을 한 번에. 처음 값은 우리 부서만(2026-10-26 사용자 판정) */}
        {mine ? (
          <span className="scope-t">{scope === 'org' ? '조직 전체 공개' : '우리 부서만 공개'}
            <button className="textbtn" onClick={() => { const v = scope === 'org' ? 'dept' : 'org'; setS(setScope(s, unitId, v)); toast(v === 'org' ? '조직 전체에 공개했습니다. 다른 부서는 읽기만 합니다' : '우리 부서만 봅니다'); }}>
              {scope === 'org' ? '우리 부서만 보기로' : '조직 전체에 공개'}
            </button>
          </span>
        ) : <span className="scope-t">{scope === 'org' ? '조직 전체 공개' : '우리 부서만 공개'}</span>}
      </div>
      {editing ? (
        <>
          <div className="tools" role="toolbar" aria-label="서식">
            <button onMouseDown={e => e.preventDefault()} onClick={() => cmd('h')}>제목</button>
            <button onMouseDown={e => e.preventDefault()} onClick={() => cmd('b')}>굵게</button>
            <button onMouseDown={e => e.preventDefault()} onClick={() => cmd('ul')}>목록</button>
            <button onMouseDown={e => e.preventDefault()} onClick={() => cmd('ol')}>번호 목록</button>
            {refs.length > 0 && <button onMouseDown={e => { e.preventDefault(); keepSel(); }} onClick={() => setPick(p => !p)}>참고자료 연결</button>}
          </div>
          {pick && (
            <div className="ref-pop" role="menu">
              {refs.map(r => <button key={r.id} role="menuitem" onMouseDown={e => e.preventDefault()} onClick={() => insertRef(r)}>{r.title}</button>)}
            </div>
          )}
          <div ref={ed} className="gd-body ed" contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label="업무 안내"
            onInput={onInput} onPaste={onPaste} onKeyUp={keepSel} onMouseUp={keepSel} />
          <div className="ed-foot">
            <span>{saved}</span>
            <span className="btns">
              <button className="ghost" onClick={() => finish(false)}>취소</button>
              <button className="primary" onClick={() => finish(true)}>저장</button>
            </span>
          </div>
        </>
      ) : g ? (
        <GuideBody html={g.html} refs={refs} />
      ) : mine ? (
        <button className="gd-empty" onClick={start}>이 업무를 처음 맡는 사람이 알아야 할 것을 적어 두세요</button>
      ) : (
        <p className="none">적힌 안내가 없습니다</p>
      )}
    </div>
  );
}
