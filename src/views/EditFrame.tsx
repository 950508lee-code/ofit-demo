import type {ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {useWide} from './common';

/**
 * 긴 편집(처리 순서·업무 안내)의 틀 — 편집 상태에서만 세부 조작이 보인다(2026-10-26 사용자 확정).
 * PC: 읽던 자리에서 그대로, 아래 오른쪽 [취소] [저장].
 * 폰: 그 묶음만 전체 화면으로 열고 위 왼쪽 '취소' · 위 오른쪽 '저장'(자판에 가리지 않게). 짧은 편집(자료 하나 추가 등)은 이 틀을 쓰지 않고 그 자리에서.
 */
export function EditFrame({title, onCancel, onSave, saveOff, foot, children, className = ''}: {
  title: string; onCancel: () => void; onSave: () => void; saveOff?: boolean; foot?: ReactNode; children: ReactNode; className?: string;
}) {
  const wide = useWide();
  const node = (
    <div className={`editor big ${className}`} role="group" aria-label={`${title} 편집`}>
      <div className="ed-top">
        <button className="textbtn" onClick={onCancel}>취소</button>
        <b>{title}</b>
        <button className="primary sm" disabled={saveOff} onClick={onSave}>저장</button>
      </div>
      {children}
      <div className="er-act">
        {foot && <span className="er-foot">{foot}</span>}
        <button className="ghost" onClick={onCancel}>취소</button>
        <button className="primary sm" disabled={saveOff} onClick={onSave}>저장</button>
      </div>
    </div>
  );
  // 폰: 화면 전환 움직임(transform)이 남은 조상 안에서는 fixed 가 화면에 붙지 않으므로 문서 맨 끝에 띄운다
  return wide ? node : createPortal(node, document.body);
}
