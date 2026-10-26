// 시연용 업무 기준표 — 어느 기관에나 있는 업무로, 처음 보는 사람도 읽을 수 있게.
// 분류 > 업무(단위업무) > 반복업무. weekday 0 = 일요일.
import type {Duty, Unit} from '../model';

const u = (id: string, series: string, name: string): Unit => ({id, org: 'nhis', series, name});

export const DEMO_UNITS: Unit[] = [
  u('u1', '경영지원', '예산·회계'),
  u('u2', '경영지원', '인사·복무'),
  u('u3', '경영지원', '계약·구매'),
  u('u4', '경영지원', '시설·안전'),
  u('u5', '대민서비스', '민원 응대'),
  u('u6', '대민서비스', '정보공개'),
  u('u7', '소통', '홍보'),
  u('u8', '정보보안', '개인정보 보호'),
];

const d = (id: string, unit: string, title: string, rule: Duty['rule'], extra: Partial<Duty> = {}): Duty =>
  ({id, unitIds: [unit], title, rule, ...extra});

export const DEMO_DUTIES: Duty[] = [
  // 예산·회계
  d('a1', 'u1', '지출결의 마감', {kind: 'monthly', day: 25}, {steps: [
    {text: '전자결재에서 이번 달 지출결의 목록 내려받기'},
    {text: '증빙(영수증·계약서)이 빠진 건 표시'},
    {text: '담당자에게 보완 요청'},
    {text: '회계팀에 마감 목록 보내기'},
  ]}),
  d('a2', 'u1', '법인카드 사용내역 정리', {kind: 'monthly', day: 5}),
  d('a3', 'u1', '분기 예산 집행률 보고', {kind: 'quarterly', month: 0, day: 10}),
  d('a4', 'u1', '회계 전표 결재', {kind: 'daily'}, {tag: '결재'}),
  // 인사·복무
  d('b1', 'u2', '근태 확인', {kind: 'daily'}),
  d('b2', 'u2', '초과근무 승인', {kind: 'weekly', weekday: 5}, {tag: '결재'}),
  d('b3', 'u2', '월간 복무 점검', {kind: 'monthly', day: 'last'}),
  d('b4', 'u2', '법정 의무교육 이수 현황 점검', {kind: 'quarterly', month: 2, day: 20}),
  // 계약·구매
  d('c1', 'u3', '계약 만료 예정 확인', {kind: 'monthly', day: 1}),
  d('c2', 'u3', '물품 구매 요청 취합', {kind: 'weekly', weekday: 2}),
  d('c3', 'u3', '분기 계약 현황 공개', {kind: 'quarterly', month: 0, day: 'last'}),
  // 시설·안전
  d('e1', 'u4', '소방시설 점검', {kind: 'monthlyWeekday', nth: 1, weekday: 1}),
  d('e2', 'u4', '비품 재고 확인', {kind: 'quarterly', month: 2, day: 25}),
  d('e3', 'u4', '관용차 운행일지 정리', {kind: 'monthly', day: 'last'}),
  // 민원 응대
  d('f1', 'u5', '접수된 민원 확인', {kind: 'daily'}),
  d('f2', 'u5', '민원 처리기한 점검', {kind: 'weekly', weekday: 3}),
  d('f3', 'u5', '월간 민원 처리 실적 보고', {kind: 'monthly', day: 3}),
  // 정보공개
  d('g1', 'u6', '정보공개 청구 처리 현황 확인', {kind: 'weekly', weekday: 4}),
  d('g2', 'u6', '사전정보 공표 목록 갱신', {kind: 'quarterly', month: 0, day: 15}),
  // 홍보
  d('h1', 'u7', '누리집 공지 갱신', {kind: 'weekly', weekday: 2}),
  d('h2', 'u7', 'SNS 게시물 올리기', {kind: 'weekly', weekday: 4}),
  d('h3', 'u7', '보도자료 배포 결과 정리', {kind: 'monthly', day: 15}),
  // 개인정보 보호
  d('i1', 'u8', '개인정보 접속기록 점검', {kind: 'monthly', day: 20}),
  d('i2', 'u8', 'PC 보안 점검', {kind: 'monthlyWeekday', nth: 3, weekday: 3}),
  d('i3', 'u8', '비밀번호 변경 안내', {kind: 'quarterly', month: 0, day: 5}),
];
