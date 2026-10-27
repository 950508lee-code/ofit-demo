import {useId, useState, type ReactNode} from 'react';

/**
 * 접는 칸 — 짧고 보조적인 정보에만(2026-10-26 사용자 판정, docs/IA.md). 핵심 정보(처리방법·참고자료)는 접지 않는다.
 * 접힌다는 것이 보이게: 제목 앞 ▸/▾ 표시(장식이 아닌 기능 표시 — ✕와 같은 예외) + 화면 읽기 프로그램에 펼침 상태(aria-expanded).
 * 제목 줄 전체가 단추(44px 이상). 오른쪽 끝(extra)에는 개수 같은 짧은 정보만.
 */
export function Fold({title, count, children, open: init = false}: {title: string; count?: number; children: ReactNode; open?: boolean}) {
  const [open, setOpen] = useState(init);
  const id = useId();
  return (
    <div className={`day fold${open ? ' on' : ''}`}>
      <button className="fold-h" aria-expanded={open} aria-controls={id} onClick={() => setOpen(o => !o)}>
        <span className="fold-mk" aria-hidden="true">{open ? '▾' : '▸'}</span>
        <span className="dept">{title}{count !== undefined && <span> {count}</span>}</span>
      </button>
      {open && <div id={id} className="fold-b">{children}</div>}
    </div>
  );
}
