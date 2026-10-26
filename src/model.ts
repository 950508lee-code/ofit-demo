// 오핏의 데이터 모양. 구조는 리마인더 앱과 같다: 직렬 > 단위업무 > 반복업무.
// 단위업무를 고르면 그 안의 반복업무가 할 일에 자동으로 들어간다.
// 서버로 옮길 때 표 다섯 개가 된다: 단위업무 · 반복업무 · 담당 · 회차 기록 · 인계
import type {Rule} from './schedule';
import {DEMO_DUTIES, DEMO_UNITS} from './data/demo';
import {DEMO_DEPTS} from './data/demoDepts';

export type OrgId = string;
/** 조직 — 업무 기준표 하나를 가진 단위. 기준표 파일을 올리면 누구나 만들 수 있다. */
/** admins = 업무 표준 마스터(모든 분류 승인·분류별 관리자 지정), seriesAdmins = 분류별 관리자(그 분류만 승인). */
export type Org = {id: OrgId; name: string; admins?: string[]; seriesAdmins?: Record<string, string[]>};

/**
 * 업무 표준 제안 — 누구나 올리고 관리자가 승인하면 같은 업무를 맡은 모두에게 반영된다.
 * 새 업무(newUnit)거나 있는 업무(unitId)에 반복업무를 더한다.
 */
export type Proposal = {
  id: string; org: OrgId; by: string; at: string;
  unitId?: string; newUnit?: {name: string; series: string};
  duties: {title: string; rule: Rule}[];
  state: 'pending' | 'approved' | 'rejected';
  decidedBy?: string; decidedAt?: string; reason?: string; madeUnitId?: string;
};
export type Step = {text: string; form?: string; warn?: boolean}; // warn: 주의 줄 — 체크하지 않고, 관련 단계 바로 아래에 둔다

/** 단위업무 — 사람이 맡고 넘기는 단위. 업무분장표의 한 줄. series 는 직렬(대분류). */
export type Unit = {id: string; org: OrgId; series: string; name: string};

/** 반복업무 — 단위업무 안에 정해진 주기로 돌아오는 일. 한 업무가 단위업무 여러 개에 걸칠 수 있다. */
export type Duty = {
  id: string;
  unitIds: string[];
  title: string;
  rule: Rule;
  tag?: string; // 결재 · 고유
  steps?: Step[]; // 처리 순서 — 처음엔 비어 있고 담당자가 일하며 채운다
  basis?: string;
  since?: string; // 업무 표준에 더해진 날 — 그 전 회차는 아무에게도 생기지 않는다
};

/** 부서 — 조직 안의 위아래 구조. 조직표에 없는 부서는 가입할 때 사용자가 만든다. */
export type Dept = {id: string; org: OrgId; name: string; parentId: string | null; kind: string};

export type Person = {id: string; name: string; org: OrgId; deptId: string};

/**
 * 부서 일정 — 받을 부서와 (선택) 업무를 정해 보낸다. 받는 사람은 보낼 때 고정하지 않고
 * 그때그때 '그 부서에서 그 업무를 맡은 사람'으로 찾는다. 그래서 인수인계 뒤에는 새 담당자에게 간다.
 * done 은 사람별 완료 기록.
 */
export type Dispatch = {
  id: string; from: string; fromDept: string; sentAt: string;
  toDepts: string[]; withChildren: boolean; unitId?: string;
  title: string; due: string; body: string;
  done: Record<string, {on: string; note: string}>;
  seriesId?: string; // 반복으로 보낸 회차면 묶음 id
};

/**
 * 반복 묶음 — 요청을 반복으로 보낼 때. 회차는 다가오는 두 달치를 그때그때 보통 일정 한 건으로 만든다
 * (받기·완료·현황은 한 번짜리와 똑같이 돈다). stopped 이면 더 만들지 않는다.
 */
export type Series = {
  id: string; kind: 'dispatch'; rule: Rule; by: string; made: string; stopped?: string;
  dispatch?: Pick<Dispatch, 'from' | 'fromDept' | 'toDepts' | 'withChildren' | 'unitId' | 'title' | 'body'>;
};

/** 빠른 입력으로 넣은 일. 인수인계 때 골라서 넘길 수 있다. */
/** 내 할 일. 반복(rule)이면 date 는 시작일. */
export type Task = {id: string; owner: string; title: string; date?: string; time?: string; rule?: Rule; done: string[]};

/**
 * 알림 내역 — 새로 온 것은 모두 여기로 모인다. key 가 같으면 한 번만 쌓인다.
 * go 는 눌렀을 때 갈 곳.
 */
export type Notice = {
  id: string; to: string; kind: 'deadline' | 'handover' | 'dept' | 'standard';
  title: string; body: string; at: string; read: boolean; key?: string;
  go?: 'home' | 'me';
  dispatchId?: string;
  /** 무엇에 관한 알림인지 — 알림 판에서 '처리할 것'을 가르고(지금도 기다리는 인수인계·검토), 누르면 그 업무로 간다 */
  handoverId?: string; proposalId?: string; unitId?: string;
};

/** 회차 기록 — 완료할 때 저절로 남는다. note 만 선택 입력. */
export type Rec = {dutyId: string; date: string; by: string; note: string};

/**
 * 참고자료 — 지침·서식·시스템 주소처럼 일할 때 펴 보는 것. 파일은 올리지 않고 어디 있는지만 적는다(원본 권한은 원본을 따른다).
 * 업무에 붙어 있어서 인수인계·업무 고르기 때 업무와 함께 간다. 같은 자료를 여러 업무에 붙일 수 있다.
 */
/**
 * 업무 안내 — 업무 전체에 관한 부서의 경험(개요·흐름·예외·노하우). 업무 표준(조직 공통 반복업무·처리 순서)과 달리 부서마다 따로 쌓는다.
 * 쓰지 않아도 된다. 그 부서에서 그 업무를 맡은 사람은 누구나 고친다. html 은 제목·목록·문단·참고자료 연결만 남긴 글.
 */
export type Guide = {html: string; by: string; at: string};

export type Ref = {id: string; org: OrgId; kind: 'link' | 'file'; title: string; where: string; by: string; at: string};

/**
 * 인수인계 — 전임자가 단위업무(기준표의 반복업무가 저절로 따라감)와 그 밖의 내 일정 중 고른 것을 묶어 보낸다.
 * 받는 사람이 받아야 끝나고, 그 전엔 보낸 사람이 취소할 수 있다. 업무 고르기에서 이어받기는 바로 끝난다.
 */
export type Handover = {
  id: string; from: string; to: string; unitIds: string[]; taskIds: string[]; date: string; note: string;
  state: 'pending' | 'accepted' | 'declined' | 'cancelled';
  seen?: boolean; // 받은 사람이 홈의 '받은 업무' 판을 확인함
  at?: string; // 보낸 시각(ISO) — 보낸 뒤 같은 업무를 다시 맡았는지 가릴 때
};

// 처음 등록돼 있는 조직: 국민건강보험공단(리마인더 앱 주기업무 기준표).
export const SEED_ORGS: Org[] = [{id: 'nhis', name: '국민건강보험공단', admins: ['choi'], seriesAdmins: {경영지원: ['han']}}];
// 시연은 누구나 읽을 수 있는 업무로(src/data/demo.ts). 다른 기준표는 조직 등록에서 CSV로 넣을 수 있다.
export const SEED_UNITS: Unit[] = DEMO_UNITS;
export const SEED_DUTIES: Duty[] = DEMO_DUTIES;

/** 처음부터 쓰고 있던 사람. 새로 가입하는 사람은 상태에 더해진다. */
export const SEED_DEPTS: Dept[] = DEMO_DEPTS; // 지어낸 시연용 조직표(src/data/demoDepts.ts)
export const SEED_PEOPLE: Person[] = [
  {id: 'kim', name: '김건강', org: 'nhis', deptId: 'r0-b1'}, // 서울지역본부 › 광진지사
  {id: 'choi', name: '최표준', org: 'nhis', deptId: 'h-d1'}, // 본부 › 기획조정실 — 업무 표준 총괄 관리자
  {id: 'han', name: '한경영', org: 'nhis', deptId: 'h-d6'}, // 본부 › 인력지원실 — 경영지원 분류 관리자
];

// 김건강의 지난 기록 예시 — 예산·회계·인사·복무·홍보 업무에 붙인다.
export const SEED_RECORDS: Rec[] = [
  {dutyId: 'a1', date: '2026-08-25', by: 'kim', note: '8월분 지출결의 32건 마감, 증빙 빠진 1건 보완 요청'},
  {dutyId: 'a1', date: '2026-09-25', by: 'kim', note: '9월분 28건 마감, 이상 없음'},
  {dutyId: 'a2', date: '2026-09-04', by: 'kim', note: '법인카드 47건 정리, 5일이 토요일이라 4일 처리'},
  {dutyId: 'a3', date: '2026-07-10', by: 'kim', note: '2분기 집행률 48%, 사업비 이월 검토 필요'},
  {dutyId: 'b3', date: '2026-09-30', by: 'kim', note: '9월 복무 점검, 지각 2건 사유서 받음'},
  {dutyId: 'h3', date: '2026-09-15', by: 'kim', note: '보도자료 3건 배포, 지역 언론 5곳 게재'},
]
