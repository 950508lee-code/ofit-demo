// 상태와 동작. 화면은 여기 함수만 부른다 — 나중에 서버(Supabase)나 AI 를 붙일 때 이 파일만 바꾼다.
import {SEED_DEPTS, SEED_DUTIES, SEED_ORGS, SEED_PEOPLE, SEED_RECORDS, SEED_UNITS, type Duty, type Org, type OrgId, type Person, type Rec, type Step, type Task, type Handover, type Notice, type Unit, type Dept, type Dispatch, type Proposal, type Series, type Ref, type Guide, type DeptWay, type StepChange, type Move} from './model';
import type {Parsed} from './parse';
import {addDays, occurrences, ruleLabel, type Rule} from './schedule';

export type State = {
  orgs: Org[]; // 등록된 조직
  units: Unit[]; // 모든 조직의 단위업무
  duties: Duty[]; // 모든 조직의 반복업무
  people: Person[]; // 가입한 사람
  me: string; // 로그인한 사람 ('' = 로그인 전)
  depts: Dept[]; // 모든 조직의 부서
  holds: Record<string, string[]>; // 사람 id → 맡은 단위업무 id (지사마다 같은 업무를 따로 맡는다)
  since: Record<string, string>; // '사람:단위업무' → 맡은 날 (그 전 회차는 그 사람 할 일이 아니다)
  gotAt: Record<string, string>; // '사람:단위업무' → 맡은 시각(ISO). 인수인계를 보낸 뒤 같은 업무를 다시 맡았는지 가린다
  dispatches: Dispatch[];
  records: Rec[];
  handovers: Handover[];
  notices: Notice[];
  tasks: Task[];
  progress: Record<string, boolean[]>; // '업무@날짜' → 체크리스트 진행
  series: Series[]; // 반복으로 보낸 요청 묶음
  until: Record<string, string>; // '사람:업무' → 마지막으로 맡은 날(뺐거나 인수인계로 넘긴 업무). 그날까지 회차·기록은 남는다
  proposals: Proposal[]; // 업무 표준 제안(승인되면 units·duties에 들어간다)
  stepEdits: Record<string, Step[]>; // 업무 id → 고친 순서 (다음 담당자도 이 판을 본다)
  refs: Ref[]; // 참고자료(조직 안에서 같이 쓴다)
  unitRefs: Record<string, string[]>; // 단위업무 id → 붙인 참고자료 id(순서대로)
  guides: Record<string, Guide>; // '부서:단위업무' → 업무 안내(부서마다 따로)
  deptWays: Record<string, Record<string, DeptWay>>; // '부서:반복업무' → 단계 id('_end' = 끝에 더 하는 일) → 부서 운영 방식(새로 쓰지 않음, 이전 기록으로 읽기만)
  stepHistory: Record<string, StepChange[]>; // 반복업무 id → 처리방법 판(편집마다 전·후 전체, 복원도 한 판)
  knowScope: Record<string, 'org'>; // '부서:단위업무' → 조직 전체 공개(없으면 우리 부서만, 2026-10-26 사용자 판정)
  moves: Move[]; // 부서 옮김 기록
  ver: number; // 저장 모양 판(바뀌면 migrate 가 옮긴다. 지우지 않는다)
};

export const occKey = (id: string, date: string) => `${id}@${date}`;
const uid = () => Math.random().toString(36).slice(2, 9);

const seedUnit = (name: string) => SEED_UNITS.find(u => u.name === name)!.id;

/**
 * 시연용 지난 기록: 김건강이 지난 3주 동안 맡은 일을 해 왔다고 채운다(메모 있는 기록은 SEED_RECORDS).
 * 가장 최근 회차 하나(누리집 공지 갱신)는 비워 둔다. 반복업무라 기한 지난 일로 쌓이지 않고 달력에만 남는다.
 */
function seedHistory(holds: string[]): Rec[] {
  const day = today(), from = addDays(day, -21), to = addDays(day, -1);
  const out: Rec[] = [];
  for (const d of SEED_DUTIES.filter(x => x.unitIds.some(u => holds.includes(u)))) {
    const dates = occurrences(d.rule, from, to);
    for (const date of dates) {
      if (d.id === 'h1' && date === dates[dates.length - 1]) continue;
      if (SEED_RECORDS.some(r => r.dutyId === d.id && r.date === date)) continue;
      out.push({dutyId: d.id, date, by: 'kim', note: ''});
    }
  }
  return out;
}

export const initialState = (): State => ({
  orgs: SEED_ORGS,
  units: SEED_UNITS,
  duties: SEED_DUTIES,
  people: SEED_PEOPLE,
  me: '',
  depts: SEED_DEPTS,
  holds: {kim: [seedUnit('예산·회계'), seedUnit('인사·복무'), seedUnit('홍보')]},
  since: {},
  gotAt: {},
  dispatches: [],
  // 시연 기록은 김건강이 광진지사에서 남긴 것 — 그때의 부서·업무를 박아 둔다
  records: [...SEED_RECORDS, ...seedHistory([seedUnit('예산·회계'), seedUnit('인사·복무'), seedUnit('홍보')])]
    .map(r => ({...r, deptId: seedDeptOf(r.by), unitId: SEED_DUTIES.find(d => d.id === r.dutyId)?.unitIds[0]})),
  handovers: [],
  notices: [],
  tasks: [],
  progress: {},
  proposals: [],
  series: [],
  until: {},
  stepEdits: {},
  refs: [],
  unitRefs: {},
  guides: {},
  deptWays: {},
  stepHistory: {},
  knowScope: {},
  moves: [],
  ver: VER,
});

/*
 * 저장: 열쇠는 하나로 고정하고, 저장 모양이 바뀌면 판(VER)을 올려 migrate 가 옮긴다 — 판이 바뀌어도 자료를 지우지 않는다(2026-10-26).
 * 예전처럼 판마다 열쇠를 바꾸던 자료(ofit-demo-v21 등)는 처음 한 번 가장 새 것을 읽어 옮기고, 옛 열쇠는 그대로 둔다.
 */
const KEY = 'ofit-demo';
export const VER = 22;
const OLD_KEYS = ['ofit-demo-v21', 'ofit-demo-v20', 'ofit-demo-v19', 'ofit-demo-v18', 'ofit-demo-v17'];
export function loadState(): State {
  try {
    const raw = localStorage.getItem(KEY) ?? OLD_KEYS.map(k => localStorage.getItem(k)).find(Boolean);
    if (raw) return extendSeries(pruneNotices(migrate({...initialState(), ...JSON.parse(raw)} as State, JSON.parse(raw).ver ?? 0)));
  } catch { /* 저장소를 못 쓰는 환경 */ }
  return initialState();
}
const seedDeptOf = (pid: string) => SEED_PEOPLE.find(p => p.id === pid)?.deptId;
/** 옛 판의 자료를 지금 모양으로. 확인할 수 있는 것만 채우고, 못 하면 비워 둔다. */
export function migrate(s: State, from: number): State {
  let n = {...s, ver: VER};
  if (from < 22) n = {...n, records: n.records.map(r => (r.deptId ? r : restoreRecord(n, r))), handovers: n.handovers.map(h => (h.deptId ? h : restoreHandover(n, h)))};
  return n;
}
/**
 * 옛 기록(부서·업무가 안 박힌 것)의 그때 부서·업무 되살리기 — 증거가 있을 때만.
 * 업무: 그 반복업무가 든 업무가 하나뿐이면 그것, 아니면 쓴 사람이 그때 맡고 있던 것이 하나로 정해질 때만.
 * 부서: ① 쓴 사람이 지금도 그 업무를 맡고 있고, 맡은 날(since)이 기록보다 앞이며, 그 뒤로 빼거나 인수인계한 일이 없으면 → 지금 부서
 *      ② 시연 처음 사람이고, 기록이 그 사람의 첫 변화(업무 빼기·맡기·인수인계·부서 옮김)보다 앞이면 → 처음 부서
 *      ③ 그 밖에는 비워 둔다(지금 부서를 그때 부서로 지어 넣지 않는다).
 */
/** 옛 인수인계의 보낸 때 부서 — 보낸 사람에게 그날 이후(그날 포함) 다른 변화가 없으면 지금 부서, 처음 사람이 첫 변화 전에 보냈으면 처음 부서. 아니면 비워 둔다. */
function restoreHandover(s: State, h: Handover): Handover {
  const ev = changesOf(s, h.from).filter(e => e.id !== h.id).map(e => e.date).sort();
  const me = s.people.find(p => p.id === h.from);
  if (me && !ev.some(d => d >= h.date)) return {...h, deptId: me.deptId};
  if (seedDeptOf(h.from) && (!ev.length || h.date < ev[0])) return {...h, deptId: seedDeptOf(h.from)};
  return h;
}
/** 사람의 변화(업무 빼기·맡기·인수인계·부서 옮김)가 있었던 날들. 옛 기록의 그때 부서를 확인할 때만 쓴다. */
const changesOf = (s: State, pid: string) => [
  ...Object.entries(s.until).filter(([k]) => k.startsWith(`${pid}:`)).map(([, d]) => ({id: '', date: addDays(d, 1)})),
  ...Object.entries(s.since).filter(([k]) => k.startsWith(`${pid}:`)).map(([, d]) => ({id: '', date: d})),
  ...s.handovers.filter(h => h.from === pid || h.to === pid).map(h => ({id: h.id, date: h.date})),
  ...(s.moves ?? []).filter(m => m.pid === pid).map(m => ({id: '', date: m.date})),
];
function restoreRecord(s: State, r: Rec): Rec {
  const duty = s.duties.find(d => d.id === r.dutyId);
  const cands = duty?.unitIds ?? [];
  const heldThen = cands.filter(u => holdsOf(s, r.by).includes(u) && (s.since[`${r.by}:${u}`] ?? '9999') <= r.date);
  const unitId = cands.length === 1 ? cands[0] : heldThen.length === 1 ? heldThen[0] : undefined;
  const events = changesOf(s, r.by).map(e => e.date).sort();
  const me = s.people.find(p => p.id === r.by);
  let deptId: string | undefined;
  const u = unitId ?? heldThen[0];
  if (me && u && holdsOf(s, r.by).includes(u)) {
    const since = s.since[`${r.by}:${u}`];
    const after = events.filter(d => since && d > since);
    if (since && since <= r.date && !after.length) deptId = me.deptId;
  }
  if (!deptId && seedDeptOf(r.by) && (!events.length || r.date < events[0])) deptId = seedDeptOf(r.by);
  return {...r, unitId, deptId};
}
export function saveState(s: State) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* 무시 */ }
}

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/* ── 조직·업무 기준표 ── */
export const orgName = (s: State, id?: string) => s.orgs.find(o => o.id === id)?.name ?? '';
export const unitsOfOrg = (s: State, org: OrgId) => s.units.filter(u => u.org === org);
export const unitById = (s: State, id: string) => s.units.find(u => u.id === id);
export const dutyById = (s: State, id: string) => s.duties.find(d => d.id === id);
export const dutiesOfUnit = (s: State, unitId: string) => s.duties.filter(d => d.unitIds.includes(unitId));
/** 조직 등록 — 이름과 기준표(단위업무·반복업무). 등록하면 그 조직 사람들이 바로 업무를 고를 수 있다. */
export const registerOrg = (s: State, id: OrgId, name: string, units: Unit[], duties: Duty[]): State =>
  ({...s, orgs: [...s.orgs, {id, name}], units: [...s.units, ...units], duties: [...s.duties, ...duties]});
export const newOrgId = () => `o${uid()}`;

export const holdsOf = (s: State, pid: string) => s.holds[pid] ?? [];
export const myUnits = (s: State) => s.units.filter(u => holdsOf(s, s.me).includes(u.id));
export const stepsOf = (s: State, d: Duty) => s.stepEdits[d.id] ?? d.steps ?? [];
/** 내가 맡은 단위업무에 들어 있는 반복업무(겹치는 건 한 번만). */
export const myDuties = (s: State) => s.duties.filter(d => d.unitIds.some(id => holdsOf(s, s.me).includes(id)));
/** 지금 맡았거나 예전에 맡았던(뺐거나 넘긴) 업무의 반복업무 — 맡았던 기간의 회차가 달력에 남는다. */
export const myDutiesEver = (s: State) => {
  const ended = Object.keys(s.until).filter(k => k.startsWith(`${s.me}:`)).map(k => k.slice(s.me.length + 1));
  const ids = new Set([...holdsOf(s, s.me), ...ended]);
  return s.duties.filter(d => d.unitIds.some(u => ids.has(u)));
};
/** 이 반복업무가 내 것이었던 기간. to 가 없으면 지금도 맡고 있다. */
export const myWindow = (s: State, d: Duty): {from: string; to?: string} => {
  const held = holdsOf(s, s.me);
  const spans = d.unitIds.filter(u => held.includes(u) || s.until[`${s.me}:${u}`]).map(u => ({
    from: s.since[`${s.me}:${u}`] ?? '2000-01-01',
    to: held.includes(u) ? undefined : s.until[`${s.me}:${u}`],
  }));
  if (!spans.length) return {from: '9999-12-31'};
  const start = spans.map(x => x.from).sort()[0];
  return {from: d.since && d.since > start ? d.since : start, to: spans.some(x => !x.to) ? undefined : spans.map(x => x.to!).sort().reverse()[0]};
};
export const inWindow = (w: {from: string; to?: string}, date: string) => date >= w.from && (!w.to || date <= w.to);
/** 이 반복업무를 내가 맡은 날. 기록이 없는 처음 담당(시드)은 아주 예전부터로 본다. */
export const mySince = (s: State, d: Duty) =>
  d.unitIds.filter(id => holdsOf(s, s.me).includes(id)).map(id => s.since[`${s.me}:${id}`] ?? '2000-01-01').sort()[0] ?? '9999-12-31';
/** 자리는 '우리 부서의 이 업무' — 기록도 같은 부서 사람 것만 본다(다른 지사 기록은 섞지 않는다). */
/**
 * 우리 부서 기록인가 — 기록이 생긴 때의 부서로 가른다(쓴 사람이 지금 어느 부서인지는 보지 않는다).
 * 그때 부서를 확인하지 못한 옛 기록은 쓴 사람에게만 보인다.
 */
export const isOurRecord = (s: State, r: Rec) => (r.deptId ? r.deptId === meOf(s)?.deptId : r.by === s.me);
/** 이 업무의 우리 부서 기록. 업무가 박힌 기록은 그 업무에만, 옛 기록은 그 반복업무가 든 업무 모두에. */
export const recordsOfUnit = (s: State, unitId: string) => {
  const ids = new Set(s.duties.filter(d => d.unitIds.includes(unitId)).map(d => d.id));
  return s.records.filter(r => ids.has(r.dutyId) && (r.unitId ? r.unitId === unitId : true) && isOurRecord(s, r));
};
/** 이 반복업무 회차의 우리 부서 기록(다른 부서가 같은 날 끝낸 것은 섞이지 않는다). */
export const recordOf = (s: State, dutyId: string, date: string) =>
  s.records.find(r => r.dutyId === dutyId && r.date === date && isOurRecord(s, r));
export const recordsOfDuty = (s: State, dutyId: string) => s.records.filter(r => r.dutyId === dutyId && isOurRecord(s, r));
export const meOf = (s: State) => s.people.find(p => p.id === s.me);
export const nameOf = (s: State, id?: string) => s.people.find(p => p.id === id)?.name ?? '';
export const orgOf = (s: State): OrgId => meOf(s)?.org ?? 'nhis';
export const colleagues = (s: State) => s.people.filter(p => p.org === orgOf(s) && p.id !== s.me);

/* ── 가입·로그인 ── */
/** 가입 — 이름, 조직, 고른 단위업무. 고른 업무의 반복일정이 바로 할 일에 들어간다. */
export const signup = (s: State, name: string, org: OrgId, deptId: string, unitIds: string[]): State => {
  const id = uid();
  return give({...s, people: [...s.people, {id, name, org, deptId}], me: id}, id, unitIds);
};
/** 업무 맡기 — 내 맡은 업무에 더한다. 같은 업무를 다른 부서 사람이 맡고 있어도 상관없다. */
export const takeUnits = (s: State, unitIds: string[]) => give(s, s.me, unitIds);
export const login = (s: State, id: string): State => ({...s, me: id});
export const logout = (s: State): State => ({...s, me: ''});

/* ── 맡기·이어받기·넘겨주기 ── */
function give(s: State, pid: string, unitIds: string[]): State {
  return {
    ...s,
    holds: {...s.holds, [pid]: [...new Set([...holdsOf(s, pid), ...unitIds])]},
    since: {...s.since, ...Object.fromEntries(unitIds.map(u => [`${pid}:${u}`, today()]))},
    gotAt: {...s.gotAt, ...Object.fromEntries(unitIds.map(u => [`${pid}:${u}`, new Date().toISOString()]))},
    until: Object.fromEntries(Object.entries(s.until).filter(([k]) => !unitIds.some(u => k === `${pid}:${u}`))),
  };
}
/** 업무 빼기 — 어제까지 내 것. 지난 회차·기록은 남고 오늘부터는 안 들어온다. 다음 사람이 이어받아야 하면 인수인계를 쓴다. */
export const releaseUnits = (s: State, unitIds: string[]): State => !unitIds.length ? s : ({
  ...s,
  holds: {...s.holds, [s.me]: holdsOf(s, s.me).filter(u => !unitIds.includes(u))},
  until: {...s.until, ...Object.fromEntries(unitIds.map(u => [`${s.me}:${u}`, addDays(today(), -1)]))},
});
/** 같은 부서에서 이 업무를 맡은 사람(나 제외). */
export const sameDeptHolders = (s: State, unitId: string) => {
  const dept = meOf(s)?.deptId;
  return s.people.filter(p => p.id !== s.me && p.deptId === dept && holdsOf(s, p.id).includes(unitId));
};

/* ── 알림 내역 ── */
/** 알림 하나를 쌓는다. key 가 이미 있으면 그대로 둔다. */
export const addNotice = (s: State, n: Omit<Notice, 'id' | 'at' | 'read'>): State =>
  n.key && s.notices.some(x => x.key === n.key) ? s
    : {...s, notices: [{...n, id: uid(), at: new Date().toISOString(), read: false}, ...s.notices]};
export const hasNotice = (s: State, key: string) => s.notices.some(x => x.key === key);
export const myNotices = (s: State) => s.notices.filter(n => n.to === s.me);
export const unreadCount = (s: State) => myNotices(s).filter(n => !n.read).length;

/** 내 업무에서 바뀐 것 한 줄 — 누가 언제 무엇을 바꿨는지(이미 저장되는 자료만 모은다, 2026-10-26 오늘 화면 알림 한 줄). */
export type Change = {key: string; kind: '업무 표준' | '처리방법' | '업무 안내' | '참고자료' | '부서 방식'; title: string; sub: string; at: string; unitId: string};

/**
 * 맡은 업무에 최근(기본 14일) 생긴 변화: 업무 표준 승인으로 더해진 반복업무 · 공통 처리 순서 · 우리 부서 업무 안내 · 붙은 참고자료 · 우리 부서 방식.
 * 내가 한 것은 빼고, 새것부터. 날짜는 앞 10자리(YYYY-MM-DD)로 맞춘다.
 */
export function recentChanges(s: State, days = 14): Change[] {
  const from = addDays(today(), -days), dep = meOf(s)?.deptId;
  const out: Change[] = [];
  const keep = (c: Change, by: string) => { if (by !== s.me && c.at >= from) out.push(c); };
  for (const u of myUnits(s)) {
    for (const p of s.proposals) {
      if (p.state === 'approved' && p.decidedAt && (p.unitId === u.id || p.madeUnitId === u.id))
        keep({key: `p${p.id}`, kind: '업무 표준', title: `${p.duties.map(d => d.title).join(' · ')} 더해짐`, sub: `${u.name} · ${nameOf(s, p.decidedBy)} 승인`, at: p.decidedAt.slice(0, 10), unitId: u.id}, p.decidedBy ?? '');
    }
    for (const d of dutiesOfUnit(s, u.id)) {
      for (const [i, c] of (s.stepHistory[d.id] ?? []).entries())
        keep({key: `h${d.id}${i}`, kind: '처리방법', title: `${d.title} 처리방법 ${c.restored ? '복원' : '편집'}`, sub: `${u.name} · ${nameOf(s, c.by)}`, at: c.at.slice(0, 10), unitId: u.id}, c.by);
      const ways = dep ? Object.values(s.deptWays[`${dep}:${d.id}`] ?? {}) : [];
      const w = ways.sort((a, b) => b.at.localeCompare(a.at))[0];
      if (w) keep({key: `w${d.id}`, kind: '부서 방식', title: `${d.title} 우리 부서 방식 고침`, sub: `${u.name} · ${nameOf(s, w.by)}`, at: w.at.slice(0, 10), unitId: u.id}, w.by);
    }
    const g = dep ? s.guides[`${dep}:${u.id}`] : undefined;
    if (g) keep({key: `g${u.id}`, kind: '업무 안내', title: `${u.name} 업무 안내 고침`, sub: `${deptName(s, dep)} · ${nameOf(s, g.by)}`, at: g.at.slice(0, 10), unitId: u.id}, g.by);
    for (const id of s.unitRefs[u.id] ?? []) {
      const r = s.refs.find(x => x.id === id);
      if (r) keep({key: `r${u.id}${r.id}`, kind: '참고자료', title: `${r.title} 붙임`, sub: `${u.name} · ${nameOf(s, r.by)}`, at: r.at.slice(0, 10), unitId: u.id}, r.by);
    }
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}
export const readNotice = (s: State, id: string): State => ({...s, notices: s.notices.map(n => (n.id === id ? {...n, read: true} : n))});
export const readAll = (s: State): State => ({...s, notices: s.notices.map(n => (n.to === s.me ? {...n, read: true} : n))});
/** 30일 지난 알림은 정리한다. */
const pruneNotices = (s: State): State => {
  const cut = new Date(Date.now() - 30 * 864e5).toISOString();
  return {...s, notices: (s.notices ?? []).filter(n => n.at >= cut)};
};
const unitNames = (s: State, ids: string[]) => s.units.filter(u => ids.includes(u.id)).map(u => u.name).join(', ');

/** 넘겨주기 — 받는 사람에게 요청이 간다. 받기 전까지 담당은 그대로이고 보낸 사람이 취소할 수 있다. */
export const sendHandover = (s: State, to: string, unitIds: string[], taskIds: string[], note: string): State => {
  const hid = uid();
  return addNotice({
    ...s,
    handovers: [...s.handovers, {id: hid, from: s.me, to, unitIds, taskIds, date: today(), at: new Date().toISOString(), note, state: 'pending', deptId: meOf(s)?.deptId}],
  }, {
    to, kind: 'handover', go: 'home', handoverId: hid,
    title: `${nameOf(s, s.me)} 님이 인수인계를 보냈습니다`,
    body: [unitNames(s, unitIds), taskIds.length ? `일정 ${taskIds.length}개` : ''].filter(Boolean).join(' · '),
  });
};

const settle = (s: State, id: string, state: 'accepted' | 'declined' | 'cancelled'): State => {
  const h = s.handovers.find(x => x.id === id);
  if (!h || h.state !== 'pending') return s;
  const n: State = state === 'cancelled' ? s : addNotice(s, {
    to: h.from, kind: 'handover', go: 'me', handoverId: h.id,
    title: `${nameOf(s, h.to)} 님이 인수인계를 ${state === 'accepted' ? '받았습니다' : '거절했습니다'}`,
    body: unitNames(s, h.unitIds) || `일정 ${h.taskIds.length}개`,
  });
  s = n;
  // 보낸 뒤 같은 업무를 다른 자리에서 다시 맡았다면(발령 뒤 새 부서에서 받음) 그건 넘긴 사람에게 그대로 둔다
  const sentAt = h.at ?? `${h.date}T00:00:00.000Z`;
  const regot = (u: string) => (s.gotAt[`${h.from}:${u}`] ?? '') > sentAt;
  const leaving = h.unitIds.filter(u => !regot(u));
  return {
    ...s,
    holds: state === 'accepted'
      ? {...s.holds, [h.from]: holdsOf(s, h.from).filter(u => !leaving.includes(u)), [h.to]: [...new Set([...holdsOf(s, h.to), ...h.unitIds])]}
      : s.holds,
    since: state === 'accepted' ? {...s.since, ...Object.fromEntries(h.unitIds.map(u => [`${h.to}:${u}`, today()]))} : s.since,
    gotAt: state === 'accepted' ? {...s.gotAt, ...Object.fromEntries(h.unitIds.map(u => [`${h.to}:${u}`, new Date().toISOString()]))} : s.gotAt,
    until: state === 'accepted' ? {...s.until, ...Object.fromEntries(leaving.map(u => [`${h.from}:${u}`, addDays(today(), -1)]))} : s.until,
    tasks: state === 'accepted' ? s.tasks.map(t => (h.taskIds.includes(t.id) ? {...t, owner: h.to} : t)) : s.tasks,
    handovers: s.handovers.map(x => (x.id === id ? {...x, state, date: state === 'accepted' ? today() : x.date} : x)),
  };
};
export const acceptHandover = (s: State, id: string) => settle(s, id, 'accepted');
export const declineHandover = (s: State, id: string) => settle(s, id, 'declined');
export const cancelHandover = (s: State, id: string) => settle(s, id, 'cancelled');
/** 내가 보내서 아직 안 받은 인수인계(남이 나에게 보낸 같은 업무는 세지 않는다). */
export const pendingOf = (s: State, unitId: string) => s.handovers.find(h => h.unitIds.includes(unitId) && h.state === 'pending' && h.from === s.me);
/** 넘겨줄 수 있는 그 밖의 일정: 내가 직접 넣은 일 중 아직 끝나지 않은 것. */
export const handoverableTasks = (s: State) =>
  myTasks(s).filter(t => t.rule || (t.date ?? '') >= today() || !t.done.includes(t.date ?? ''));
/**
 * 인수인계로 넘어갈 것이 앞으로 언제 돌아오는지 — 날짜순(먼저 돌아오는 것이 위).
 * 매일 하는 업무는 날짜마다 늘어놓지 않고 개수만 센다.
 */
export function upcomingOf(s: State, unitIds: string[], taskIds: string[], days = 92) {
  const from = today(), to = addDays(from, days);
  const duties = s.duties.filter(d => d.unitIds.some(u => unitIds.includes(u)));
  const byDate = new Map<string, string[]>();
  const put = (date: string, title: string) => byDate.set(date, [...(byDate.get(date) ?? []), title]);
  for (const d of duties) {
    if (d.rule.kind === 'daily') continue;
    for (const date of occurrences(d.rule, from, to)) put(date, d.title);
  }
  for (const t of s.tasks.filter(x => taskIds.includes(x.id))) {
    const dates = t.rule ? occurrences(t.rule, from, to) : [t.date!].filter(x => x >= from && x <= to);
    for (const date of dates) put(date, t.title);
  }
  return {
    dates: [...byDate].sort(([a], [b]) => a.localeCompare(b)).map(([date, titles]) => ({date, titles})),
    daily: duties.filter(d => d.rule.kind === 'daily').length,
  };
}
/** 이 단위업무에서 다음에 돌아오는 날(매일 업무는 빼고). */
export const nextDateOf = (s: State, unitId: string) => upcomingOf(s, [unitId], [], 120).dates[0]?.date;

export const inboxOf = (s: State) => s.handovers.filter(h => h.to === s.me && h.state === 'pending');
/** 이 인수인계가 우리 부서 자리에서 일어난 것인가 — 보낸 때의 부서로 가른다. 부서를 확인 못 한 옛 것은 주고받은 두 사람에게만. */
export const isOurHandover = (s: State, h: Handover) => (h.deptId ? h.deptId === meOf(s)?.deptId : h.from === s.me || h.to === s.me);
export const lastNote = (s: State, unitId: string) =>
  [...s.handovers].reverse().find(h => h.unitIds.includes(unitId) && h.state === 'accepted' && h.note && isOurHandover(s, h));

/**
 * 넘겨줄 때 남길 말의 초안. 지금은 비워 둔다.
 * 다음 단계에서 이 단위업무의 회차 기록(recordsOfUnit)으로 초안을 채울 수 있는 자리.
 */
export const draftNote = (_s: State, _unitId: string): string => '';

/* ── 업무 하기 ── */
export const setProgress = (s: State, dutyId: string, date: string, v: boolean[]): State =>
  ({...s, progress: {...s.progress, [occKey(dutyId, date)]: v}});
/** 완료 — 지금 부서·지금 맡은 업무를 기록에 박는다(발령·업무 변경 뒤에도 기록은 여기 남는다). */
export const complete = (s: State, dutyId: string, date: string, note: string): State => {
  const d = dutyById(s, dutyId);
  const unitId = d?.unitIds.find(u => holdsOf(s, s.me).includes(u)) ?? d?.unitIds[0];
  return {...s, records: [...s.records, {dutyId, date, by: s.me, note, deptId: meOf(s)?.deptId, unitId}]};
};
/** 완료 되돌리기 — 내가 남긴 그 회차 기록만(다른 부서·다른 사람 기록은 건드리지 않는다). */
export const uncomplete = (s: State, dutyId: string, date: string): State =>
  ({...s, records: s.records.filter(r => !(r.dutyId === dutyId && r.date === date && r.by === s.me))});
/* ── 참고자료 ── */
export const refsOfUnit = (s: State, unitId: string) =>
  (s.unitRefs[unitId] ?? []).map(id => s.refs.find(r => r.id === id)).filter((r): r is Ref => !!r);
/** 이 자료를 붙인 업무 수. */
export const refUse = (s: State, refId: string) => Object.values(s.unitRefs).filter(l => l.includes(refId)).length;
/** 우리 조직에 등록돼 있지만 이 업무에는 아직 안 붙은 자료(다른 업무에서 쓰던 것을 고른다). */
export const otherRefs = (s: State, unitId: string) => s.refs.filter(r => r.org === orgOf(s) && !(s.unitRefs[unitId] ?? []).includes(r.id));
export const linkRef = (s: State, unitId: string, refId: string): State =>
  ({...s, unitRefs: {...s.unitRefs, [unitId]: [...new Set([...(s.unitRefs[unitId] ?? []), refId])]}});
export const addRef = (s: State, unitId: string, x: Pick<Ref, 'kind' | 'title' | 'where'>): State => {
  const r: Ref = {...x, id: uid(), org: orgOf(s), by: s.me, at: today()};
  return linkRef({...s, refs: [...s.refs, r]}, unitId, r.id);
};
/** 이 업무에서만 뗀다. 다른 업무에 붙은 자료는 그대로다. */
export const unlinkRef = (s: State, unitId: string, refId: string): State =>
  ({...s, unitRefs: {...s.unitRefs, [unitId]: (s.unitRefs[unitId] ?? []).filter(id => id !== refId)}});

/* ── 업무 안내(부서마다) ── */
const guideKey = (deptId: string, unitId: string) => `${deptId}:${unitId}`;
/** 내 부서의 이 업무 안내. 없으면 undefined. */
export const guideOf = (s: State, unitId: string) => {
  const dep = meOf(s)?.deptId;
  return dep ? s.guides[guideKey(dep, unitId)] : undefined;
};
/** 고칠 수 있는가 — 이 업무를 맡은 사람(같은 부서에서 여럿이 맡으면 모두). */
export const canEditGuide = (s: State, unitId: string) => holdsOf(s, s.me).includes(unitId);
/** 업무 안내 저장. 비우면 지운다. */
export const saveGuide = (s: State, unitId: string, html: string): State => {
  const dep = meOf(s)?.deptId;
  if (!dep || !canEditGuide(s, unitId)) return s;
  const k = guideKey(dep, unitId);
  const {[k]: _old, ...rest} = s.guides;
  return {...s, guides: html.trim() ? {...rest, [k]: {html, by: s.me, at: new Date().toISOString()}} : rest};
};

/* ── 처리방법: 하나의 공동 문서(2026-10-26 사용자 판정, docs/COEDIT.md) ──
 * 조직 구성원 누구나 바로 편집(승인 없음) · 편집마다 판이 남고(stepHistory: 전·후 전체) · 이전 판으로 복원(복원도 새 판).
 * 부서 운영 방식(deptWays)은 새로 쓰지 않는다 — 이미 쓴 것은 지우지 않고 읽기로만 보인다(정리는 나중에, 자동으로 합치지 않음). */
/** 단계의 오래가는 id. 처음 등록된 순서는 순번으로 짓는다. */
export const stepIdOf = (d: Duty, st: Step, i: number) => st.id ?? `${d.id}:${i}`;
/** 처리방법을 편집할 수 있는가 — 같은 조직의 구성원 누구나(맡았는지와 상관없이). */
export const canEditCommon = (s: State, d: Duty) => !!meOf(s) && d.unitIds.some(id => unitById(s, id)?.org === orgOf(s));
/** 처리방법 편집(누구나, 바로 반영). 바뀌지 않은 단계는 id를 이어받아 남아 있는 부서 운영 방식이 그대로 붙어 있게 하고, 판을 남긴다.
 *  restored: 이전 판으로 되돌린 편집이면 그 판의 시각('first' = 처음 등록 자료). */
export function editCommonSteps(s: State, dutyId: string, next: Step[], restored?: string): State {
  const d = dutyById(s, dutyId);
  if (!d || !canEditCommon(s, d)) return s;
  const before = stepsOf(s, d).map((st, i) => ({...st, id: stepIdOf(d, st, i)}));
  const used = new Set<string>();
  const after = next.map((st, i) => {
    const same = before.find(b => b.text === st.text && !!b.warn === !!st.warn && !used.has(b.id!));
    const at = before[i] && !used.has(before[i].id!) && !!before[i].warn === !!st.warn && !next.some(x => x.text === before[i].text) ? before[i] : undefined;
    const id = same?.id ?? at?.id ?? uid();
    used.add(id);
    return {...st, id};
  });
  if (JSON.stringify(before.map(x => [x.text, !!x.warn, x.form ?? ''])) === JSON.stringify(after.map(x => [x.text, !!x.warn, x.form ?? '']))) return s;
  const ch: StepChange = {by: s.me, at: new Date().toISOString(), before, after, ...(restored ? {restored} : {})};
  return {...s, stepEdits: {...s.stepEdits, [dutyId]: after}, stepHistory: {...s.stepHistory, [dutyId]: [...(s.stepHistory[dutyId] ?? []), ch]}};
}
const wayKey = (deptId: string, dutyId: string) => `${deptId}:${dutyId}`;
export const waysOf = (s: State, deptId: string | undefined, dutyId: string) => (deptId ? s.deptWays[wayKey(deptId, dutyId)] : undefined) ?? {};
/** 부서 운영 방식이 쓸 때와 공통 단계가 달라졌는가(단계가 바뀌었거나 없어짐). 지우지 않고 '확인 필요'로만 보인다. */
export const wayStale = (s: State, d: Duty, stepId: string, w: DeptWay) => {
  if (stepId === '_end') return false;
  const i = stepsOf(s, d).findIndex((st, j) => stepIdOf(d, st, j) === stepId);
  return i < 0 || stepsOf(s, d)[i].text !== w.base;
};

/* ── 업무지식 공개 범위: 업무 안내·부서 운영 방식을 부서·업무마다 한 번에(처음 값 '우리 부서만') ── */
export const scopeOf = (s: State, deptId: string | undefined, unitId: string): 'org' | 'dept' =>
  deptId && s.knowScope[`${deptId}:${unitId}`] === 'org' ? 'org' : 'dept';
export function setScope(s: State, unitId: string, scope: 'org' | 'dept'): State {
  const dep = meOf(s)?.deptId;
  if (!dep || !holdsOf(s, s.me).includes(unitId)) return s;
  const {[`${dep}:${unitId}`]: _x, ...rest} = s.knowScope;
  return {...s, knowScope: scope === 'org' ? {...rest, [`${dep}:${unitId}`]: 'org'} : rest};
}
/** 다른 부서 사례 — 조직 전체에 공개한 부서의 업무 안내와 운영 방식(읽기만). 우리 부서는 빼고, 쓴 것이 있는 부서만. */
export function otherCases(s: State, unitId: string) {
  const mine = meOf(s)?.deptId;
  const duties = dutiesOfUnit(s, unitId);
  const depts = new Set<string>();
  for (const k of Object.keys(s.guides)) { const [dep, u] = k.split(':'); if (u === unitId) depts.add(dep); }
  for (const k of Object.keys(s.deptWays)) { const [dep, du] = k.split(':'); if (duties.some(d => d.id === du)) depts.add(dep); }
  return [...depts].filter(dep => dep !== mine && scopeOf(s, dep, unitId) === 'org').map(dep => {
    const guide = s.guides[guideKey(dep, unitId)];
    const ways = duties.map(d => ({duty: d, ways: waysOf(s, dep, d.id)})).filter(x => Object.keys(x.ways).length);
    const at = [guide?.at, ...ways.flatMap(x => Object.values(x.ways).map(w => w.at))].filter((x): x is string => !!x).sort().pop() ?? '';
    return {deptId: dep, guide, ways, at};
  }).sort((a, b) => b.at.localeCompare(a.at));
}

/* ── 빠른 입력 ── */
export const addTask = (s: State, p: Parsed): State => ({
  ...s,
  // 반복이면 date 는 '이날부터' — 만들기 전 회차는 들어가지 않는다
  tasks: [...s.tasks, {id: uid(), owner: s.me, title: p.title, date: p.date ?? today(), time: p.time, rule: p.rule, done: []}],
});
export const myTasks = (s: State) => s.tasks.filter(t => t.owner === s.me);
export const toggleTask = (s: State, id: string, date: string): State => ({
  ...s,
  tasks: s.tasks.map(t => (t.id !== id ? t : {...t, done: t.done.includes(date) ? t.done.filter(d => d !== date) : [...t.done, date]})),
});
export const removeTask = (s: State, id: string): State => ({...s, tasks: s.tasks.filter(t => t.id !== id)});
/** 고치기 — 반복이면 묶음 전체를 고친다(리마인더와 같음). 완료 기록(done)은 그대로 둔다(리마인더는 여기서 지워지는 버그). */
export const updateTask = (s: State, id: string, p: {title: string; date: string; time?: string; rule?: Rule}): State => ({
  ...s,
  tasks: s.tasks.map(t => (t.id !== id ? t : {...t, title: p.title, date: p.date, time: p.time, rule: p.rule})),
});

/* ── 부서 ── */
export const deptOf = (s: State, id?: string) => s.depts.find(d => d.id === id);
/** '서울지역본부 › 광진지사' 처럼 위 부서까지 이어 쓴 이름. */
export const deptPath = (s: State, id?: string): string => {
  const d = deptOf(s, id);
  if (!d) return '';
  const up = d.parentId ? deptPath(s, d.parentId) : '';
  return up ? `${up} › ${d.name}` : d.name;
};
export const deptName = (s: State, id?: string) => deptOf(s, id)?.name ?? '';
export const deptsOfOrg = (s: State, org: OrgId) => s.depts.filter(d => d.org === org);
/** 자기 자신과 그 아래 모든 부서. */
export const deptAndBelow = (s: State, id: string): string[] =>
  [id, ...s.depts.filter(d => d.parentId === id).flatMap(d => deptAndBelow(s, d.id))];
/** 부서 만들기 — 조직표에 없는 부서(예: 지사 안의 급여부)를 상위 부서 아래에 더한다. */
export const addDept = (s: State, org: OrgId, name: string, parentId: string | null): {s: State; id: string} => {
  const id = `u-${uid()}`;
  return {s: {...s, depts: [...s.depts, {id, org, name, parentId, kind: '부서'}]}, id};
};

/* ── 부서 일정 송수신 ── */
const mdd = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`;
/** 받는 사람 — 보낼 때가 아니라 지금 기준으로 찾는다(인수인계 뒤에는 새 담당자). */
export const recipientsOf = (s: State, d: Pick<Dispatch, 'toDepts' | 'withChildren' | 'unitId' | 'from'>) => {
  const depts = new Set(d.withChildren ? d.toDepts.flatMap(x => deptAndBelow(s, x)) : d.toDepts);
  return s.people.filter(p => p.id !== d.from && depts.has(p.deptId) && (!d.unitId || holdsOf(s, p.id).includes(d.unitId)));
};
/** 받는 사람이 없는 부서(보내기 전에 알려 준다). */
export const emptyDepts = (s: State, d: Pick<Dispatch, 'toDepts' | 'withChildren' | 'unitId' | 'from'>) =>
  d.toDepts.filter(x => recipientsOf(s, {...d, toDepts: [x]}).length === 0);
/**
 * 완료 판단.
 * 업무 담당자에게 보낸 일정은 '부서의 그 업무' 단위로 센다 — 전임자가 완료했으면 후임자에게도 완료다.
 * 부서 전체에게 보낸 일정은 사람마다 센다.
 */
const personDept = (s: State, pid: string) => s.people.find(p => p.id === pid)?.deptId;
export const deptDoneBy = (s: State, d: Dispatch, dep: string) => {
  const set = new Set(d.withChildren ? deptAndBelow(s, dep) : [dep]);
  const hit = Object.entries(d.done).find(([pid]) => set.has(personDept(s, pid) ?? ''));
  return hit ? {by: hit[0], ...hit[1]} : null;
};
export const doneForMe = (s: State, d: Dispatch) => {
  if (!d.unitId) return d.done[s.me] ? {by: s.me, ...d.done[s.me]} : null;
  const mine = meOf(s)?.deptId;
  const dep = d.toDepts.find(x => (d.withChildren ? deptAndBelow(s, x) : [x]).includes(mine ?? ''));
  return dep ? deptDoneBy(s, d, mine!) ?? null : null;
};
/** 보낸 쪽 현황 숫자: 업무 담당자 대상이면 부서 수, 전체 대상이면 사람 수. */
export const dispatchProgress = (s: State, d: Dispatch) => {
  if (d.unitId) {
    const done = d.toDepts.filter(dep => deptDoneBy(s, d, dep)).length;
    return {done, all: d.toDepts.length, unit: '곳'};
  }
  const r = recipientsOf(s, d);
  return {done: r.filter(p => d.done[p.id]).length, all: r.length, unit: '명'};
};
export const myDispatches = (s: State) => s.dispatches.filter(d => recipientsOf(s, d).some(p => p.id === s.me));
export const sentDispatches = (s: State) => s.dispatches.filter(d => d.from === s.me).slice().reverse();
export const dispatchById = (s: State, id?: string) => s.dispatches.find(d => d.id === id);

export const sendDispatch = (s: State, x: Pick<Dispatch, 'toDepts' | 'withChildren' | 'unitId' | 'title' | 'due' | 'body'>): State => {
  const me = meOf(s)!;
  const d: Dispatch = {...x, id: uid(), from: s.me, fromDept: me.deptId, sentAt: new Date().toISOString(), done: {}};
  const n: State = {...s, dispatches: [...s.dispatches, d]};
  const unit = x.unitId ? s.units.find(u => u.id === x.unitId)?.name : '';
  return recipientsOf(n, d).reduce((acc, p) => addNotice(acc, {
    to: p.id, kind: 'dept', go: 'home', dispatchId: d.id,
    title: `${deptName(s, me.deptId)}에서 요청이 왔습니다`,
    body: `${x.title} · ${mdd(x.due)}까지${unit ? ` · ${unit} 담당` : ''}`,
  }), n);
};
/** 받은 사람의 완료 — 보낸 사람에게 알린다. */
export const completeDispatch = (s: State, id: string, note: string): State => {
  const d = dispatchById(s, id)!;
  const me = meOf(s)!;
  const n: State = {...s, dispatches: s.dispatches.map(x => (x.id === id ? {...x, done: {...x.done, [s.me]: {on: today(), note}}} : x))};
  return addNotice(n, {
    to: d.from, kind: 'dept', go: 'me', dispatchId: id,
    title: `${deptName(s, me.deptId)} ${me.name} 님이 완료했습니다`,
    body: `${d.title}${note ? ` · ${note}` : ''}`,
  });
};
export const undoDispatch = (s: State, id: string): State => ({
  ...s,
  dispatches: s.dispatches.map(x => {
    if (x.id !== id) return x;
    const done = {...x.done};
    delete done[s.me];
    return {...x, done};
  }),
});

/* ── 업무 표준: 누구나 올리고, 관리자가 승인하면 모두에게 ──
   총괄 관리자(조직에 한 명, 코드에선 master): 모든 분류 승인 + 분류별 관리자 지정. 분류별 관리자: 그 분류만.
   올린 것은 그 분류 관리자에게, 관리자가 없는 분류·새 분류는 총괄 관리자에게 간다. */
const orgRec = (s: State) => s.orgs.find(o => o.id === orgOf(s));
export const stdMasters = (s: State) => orgRec(s)?.admins ?? [];
export const seriesAdminsOf = (s: State, series: string) => orgRec(s)?.seriesAdmins?.[series] ?? [];
export const isStdMaster = (s: State) => stdMasters(s).includes(s.me);
/** 이 분류에 올리면 받는 사람 — 분류 관리자, 없으면 마스터. */
export const reviewersOf = (s: State, series: string) => {
  const a = seriesAdminsOf(s, series);
  return a.length ? a : stdMasters(s);
};
const seriesOfProposal = (s: State, p: Proposal) => p.newUnit?.series ?? unitById(s, p.unitId!)?.series ?? '';
export const canApprove = (s: State, series: string) => isStdMaster(s) || seriesAdminsOf(s, series).includes(s.me);
export const isStdAdmin = (s: State) => isStdMaster(s) || Object.values(orgRec(s)?.seriesAdmins ?? {}).some(l => l.includes(s.me));
export const myAdminSeries = (s: State) => Object.entries(orgRec(s)?.seriesAdmins ?? {}).filter(([, l]) => l.includes(s.me)).map(([k]) => k);
export const pendingProposals = (s: State) => s.proposals.filter(p => p.org === orgOf(s) && p.state === 'pending' && canApprove(s, seriesOfProposal(s, p)));
export const proposalsOfUnit = (s: State, unitId: string) => s.proposals.filter(p => p.unitId === unitId || p.madeUnitId === unitId);
export const seriesOf = (s: State) => [...new Set(unitsOfOrg(s, orgOf(s)).map(u => u.series))];
/** 마스터가 분류 관리자를 정한다(빈 값이면 마스터가 맡음). */
export const setSeriesAdmin = (s: State, series: string, pid: string): State => ({
  ...s,
  orgs: s.orgs.map(o => (o.id === orgOf(s) ? {...o, seriesAdmins: {...(o.seriesAdmins ?? {}), [series]: pid ? [pid] : []}} : o)),
});
const holdersOf = (s: State, unitId: string) => s.people.filter(p => holdsOf(s, p.id).includes(unitId)).map(p => p.id);
/** 받침 있으면 a, 없으면 b — '1개가', '…관리'를'. 따옴표·괄호는 건너뛰고 본다. */
export const josa = (w: string, a: string, b: string) => {
  const c = w.replace(/['")\]\s]+$/, '').slice(-1).charCodeAt(0) - 0xac00;
  return c >= 0 && c <= 11171 && c % 28 !== 0 ? a : b;
};
const propLabel = (s: State, p: Proposal) => p.newUnit ? `새 업무 '${p.newUnit.name}'` : `${unitById(s, p.unitId!)?.name ?? ''}에 반복업무 ${p.duties.length}개`;

/** 올리기. 관리자가 올리면 바로 반영된다. */
export function propose(s: State, x: {unitId?: string; newUnit?: {name: string; series: string}; duties: {title: string; rule: Rule}[]}): State {
  const p: Proposal = {...x, id: uid(), org: orgOf(s), by: s.me, at: new Date().toISOString(), state: 'pending'};
  let n: State = {...s, proposals: [...s.proposals, p]};
  const series = seriesOfProposal(s, p);
  if (canApprove(s, series)) return approveProposal(n, p.id);
  for (const a of reviewersOf(s, series)) n = addNotice(n, {to: a, kind: 'standard', go: 'me', proposalId: p.id, unitId: p.unitId, title: `${nameOf(s, s.me)} 님이 ${propLabel(s, p)}${josa(propLabel(s, p), '을', '를')} 올렸습니다`, body: p.duties.map(d => d.title).join(', ')});
  return n;
}
/** 승인 — 업무·반복업무를 기준표에 넣고, 새 업무는 올린 사람이 맡는다. 맡은 사람 모두에게 알린다. */
export function approveProposal(s: State, id: string): State {
  const p = s.proposals.find(x => x.id === id);
  if (!p || p.state !== 'pending') return s;
  let n = s;
  let unitId = p.unitId;
  if (p.newUnit) {
    unitId = uid();
    n = {...n, units: [...n.units, {id: unitId, org: p.org, series: p.newUnit.series, name: p.newUnit.name}]};
  }
  const duties = p.duties.map(d => ({id: uid(), unitIds: [unitId!], title: d.title, rule: d.rule, since: today()}));
  n = {...n, duties: [...n.duties, ...duties]};
  if (p.newUnit) n = give(n, p.by, [unitId!]);
  n = {...n, proposals: n.proposals.map(x => (x.id === id ? {...x, state: 'approved' as const, decidedBy: s.me, decidedAt: today(), madeUnitId: p.newUnit ? unitId : undefined} : x))};
  const uname = unitById(n, unitId!)?.name ?? '';
  if (p.by !== s.me) n = addNotice(n, {to: p.by, kind: 'standard', go: 'me', proposalId: p.id, unitId, title: `${propLabel(s, p)}${josa(propLabel(s, p), '이', '가')} 승인됐습니다`, body: p.newUnit ? '내 업무에 들어갔습니다' : '맡은 사람 모두의 할 일에 들어갑니다'});
  for (const h of holdersOf(n, unitId!).filter(h => h !== p.by && h !== s.me)) {
    n = addNotice(n, {to: h, kind: 'standard', go: 'home', unitId, title: `${uname} 업무에 반복업무가 더해졌습니다`, body: p.duties.map(d => d.title).join(', ')});
  }
  return n;
}
export function rejectProposal(s: State, id: string, reason: string): State {
  const p = s.proposals.find(x => x.id === id);
  if (!p || p.state !== 'pending') return s;
  const n = {...s, proposals: s.proposals.map(x => (x.id === id ? {...x, state: 'rejected' as const, decidedBy: s.me, decidedAt: today(), reason} : x))};
  return addNotice(n, {to: p.by, kind: 'standard', go: 'me', proposalId: p.id, unitId: p.unitId, title: `${propLabel(s, p)}${josa(propLabel(s, p), '이', '가')} 반려됐습니다`, body: reason || '사유 없음'});
}

/** 로그인 목록에 붙일 역할 — 업무 표준 마스터 / ○○ 분류 관리자. */
export const roleOf = (s: State, pid: string) => {
  const o = s.orgs.find(x => x.id === s.people.find(p => p.id === pid)?.org);
  if (o?.admins?.includes(pid)) return '업무 표준 총괄 관리자';
  const ser = Object.entries(o?.seriesAdmins ?? {}).filter(([, l]) => l.includes(pid)).map(([k]) => k);
  return ser.length ? `${ser.join('·')} 관리자` : '';
};

/* ── 반복으로 보내는 요청 ── */
const AHEAD = 62; // 회차를 미리 만들어 두는 날 수
/** 묶음마다 오늘부터 두 달 안의 회차가 다 있게 만든다. 앱을 열 때·보낼 때 부른다. */
export function extendSeries(s: State): State {
  let n = s;
  const to = addDays(today(), AHEAD);
  for (const x of s.series) {
    if (x.stopped || x.made >= to) continue;
    const dates = occurrences(x.rule, addDays(x.made, 1), to);
    for (const due of dates) {
      if (x.kind === 'dispatch' && x.dispatch) {
        n = {...n, dispatches: [...n.dispatches, {...x.dispatch, id: uid(), due, seriesId: x.id, sentAt: new Date().toISOString(), done: {}}]};
      }
    }
    n = {...n, series: n.series.map(y => (y.id === x.id ? {...y, made: to} : y))};
  }
  return n;
}
export const seriesById = (s: State, id?: string) => s.series.find(x => x.id === id);
/** 반복 부서 일정 보내기 — 받는 사람에게는 묶음으로 한 번 알린다. */
export function sendDispatchSeries(s: State, x: Pick<Dispatch, 'toDepts' | 'withChildren' | 'unitId' | 'title' | 'body'>, rule: Rule): State {
  const me = meOf(s)!;
  const sr: Series = {id: uid(), kind: 'dispatch', rule, by: s.me, made: addDays(rule.anchor ?? today(), -1),
    dispatch: {...x, from: s.me, fromDept: me.deptId}};
  let n = extendSeries({...s, series: [...s.series, sr]});
  const first = n.dispatches.find(d => d.seriesId === sr.id);
  const unit = x.unitId ? s.units.find(u => u.id === x.unitId)?.name : '';
  if (first) n = recipientsOf(n, first).reduce((acc, p) => addNotice(acc, {
    to: p.id, kind: 'dept', go: 'home', dispatchId: first.id,
    title: `${deptName(s, me.deptId)}에서 반복 요청이 왔습니다`,
    body: `${x.title} · ${ruleLabel(rule)}${unit ? ` · ${unit} 담당` : ''}`,
  }), n);
  return n;
}
/** 반복 멈추기 — 오늘 뒤 회차 중 아무도 손대지 않은 것은 지우고, 더 만들지 않는다. */
export function stopSeries(s: State, id: string): State {
  const day = today();
  return {
    ...s,
    series: s.series.map(x => (x.id === id ? {...x, stopped: day} : x)),
    dispatches: s.dispatches.filter(d => !(d.seriesId === id && d.due > day && !Object.keys(d.done).length)),
  };
}

/** 최근 7일 안에 받은 인수인계(홈 '받은 업무' 판). 확인하면 사라진다. */
export const receivedRecently = (s: State) =>
  s.handovers.filter(h => h.to === s.me && h.state === 'accepted' && !h.seen && h.date >= addDays(today(), -7));
export const seeHandover = (s: State, id: string): State => ({...s, handovers: s.handovers.map(h => (h.id === id ? {...h, seen: true} : h))});

/** 발령 — 내 부서를 바꾼다. 맡던 업무 정리(인수인계·빼기)는 자리 잡기 흐름이 먼저 한다. */
export const moveDept = (s: State, deptId: string): State => ({
  ...s,
  people: s.people.map(p => (p.id === s.me ? {...p, deptId} : p)),
  moves: [...s.moves, {pid: s.me, from: meOf(s)?.deptId ?? '', to: deptId, date: today()}],
});
