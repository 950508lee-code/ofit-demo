// 인수인계 초안 — 칸마다 항목, 항목마다 출처. 전임자가 확정한 것만 인수인계에 실린다.
export type DraftKind = 'schedule' | 'contact' | 'issue' | 'step' | 'caution' | 'past';
export type Source =
  | {type: 'ofit'; label: string} // 오핏에 쌓인 것(업무 기준표·요청·완료 기록) — AI 없이 만든 칸
  | {type: 'file'; file: string; loc: string; chunk: string; quote: string}; // 넣은 자료에서 AI가 찾은 것
export type DraftItem = {
  id: string; kind: DraftKind; text: string; when?: string; unitId?: string;
  src: Source;
  check: 'ok' | 'need'; // need = AI 인용이 원문에서 확인되지 않음 → 기본 선택 해제, 고쳐서 확정
  pick: 'keep' | 'drop'; // 전임자 검토
};
export const KIND_NAME: Record<DraftKind, string> = {schedule: '시기별 할 일', contact: '협의할 사람', issue: '진행 중인 현안', step: '처리 순서', caution: '주의할 점', past: '지난 기록'};
