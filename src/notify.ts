// 브라우저 알림 — 외부 푸시 서버 없이 페이지가 직접 띄운다. 그래서 기관 업무망 안에서도 된다.
// 조건: 오핏 창(탭)이 열려 있어야 한다. 최소화돼 있어도 윈도우 알림으로 뜬다.
// 숨겨진 창의 타이머는 브라우저가 1분 단위로 묶어 돌리므로 최대 1분쯤 늦을 수 있다.

export type Perm = 'default' | 'granted' | 'denied' | 'unsupported';

export const permission = (): Perm =>
  typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported';

/** 허용 요청은 반드시 사용자가 누른 버튼 안에서 부른다(브라우저 규칙). */
export async function askPermission(): Promise<Perm> {
  if (permission() === 'unsupported') return 'unsupported';
  return Notification.requestPermission();
}

const KEY = 'ofit-notified';
const sent = (): Record<string, string> => {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
};
const markSent = (key: string, day: string) => {
  try {
    // 오늘 것만 남겨 저장소가 불어나지 않게 한다
    const kept = Object.fromEntries(Object.entries(sent()).filter(([, d]) => d === day));
    localStorage.setItem(KEY, JSON.stringify({...kept, [key]: day}));
  } catch { /* 저장소를 못 쓰는 환경 */ }
};

function pop(title: string, body: string, tag: string) {
  const n = new Notification(title, {body, tag});
  n.onclick = () => { window.focus(); n.close(); };
}

/** 같은 key 는 하루에 한 번만 띄운다. */
export function notifyOnce(key: string, day: string, title: string, body: string): boolean {
  if (permission() !== 'granted' || sent()[key]) return false;
  markSent(key, day);
  pop(title, body, key);
  return true;
}

/** 미리 보기 — 기록 없이 바로 띄운다. */
export function preview(title: string, body: string) {
  if (permission() === 'granted') pop(title, body, 'ofit-preview');
}

/** 바로 띄운다(중복 관리는 부르는 쪽 — 알림 내역의 key 로 한다). */
export function show(title: string, body: string, tag: string) {
  if (permission() === 'granted') pop(title, body, tag);
}
