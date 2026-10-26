import {useCallback, useEffect, useRef} from 'react';

const EASE_OUT = 'cubic-bezier(.16,1,.3,1)'; // 빠르게 시작해 길게 멈춘다
const EASE_MOVE = 'cubic-bezier(.75,0,.2,1)'; // 천천히 떠나 빠르게 이동, 부드럽게 앉는다

/**
 * 스플래시 — 글자로만(2026-10-26 사용자 판정: 영상 배경 없이 글씨로만 세련되게).
 * OFIT 네 글자가 가늘고 넓게 선 아래에서 차례로 솟아오른 뒤, 굵어지며 자간이 좁혀져 로고가 되고, 그 아래 한 줄이 떠오른다.
 * (Pretendard 가변 글꼴의 굵기를 그대로 움직인다.)
 * 끝나면 로고가 다음 화면의 로고 자리([data-logo])로 그대로 날아가 앉는다.
 * 누르거나 키를 치면 바로 나가는 단계로 넘어간다.
 */
export function Splash({onDone}: {onDone: () => void}) {
  const logo = useRef<HTMLDivElement>(null);
  const veil = useRef<HTMLDivElement>(null);
  const leaving = useRef(false);

  const leave = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const el = logo.current, bg = veil.current;
    const target = document.querySelector<HTMLElement>('[data-logo]');
    document.body.classList.add('revealing');
    // 나머지 요소가 다 올라온 뒤에 효과를 걷는다(중간에 걷으면 툭 끊긴다)
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      document.body.classList.remove('splashing');
      setTimeout(() => document.body.classList.remove('revealing'), 1200);
      onDone();
    };
    if (!el || !bg || reduce) { finish(); return; }

    const dur = 760;
    // 탭이 뒤에 있으면 애니메이션 완료 신호가 늦거나 오지 않는다 — 시간이 되면 무조건 넘어간다
    setTimeout(finish, dur + 120);
    bg.animate([{opacity: 1}, {opacity: 0}], {duration: dur * 0.8, delay: dur * 0.2, easing: 'ease-out', fill: 'forwards'});
    // 아래 한 줄은 로고가 떠나기 전에 먼저 걷힌다
    el.parentElement?.querySelector('.sp-tag')?.animate([{opacity: 1}, {opacity: 0, transform: 'translateY(6px)'}], {duration: 220, easing: 'ease-in', fill: 'forwards'});
    if (target) {
      const a = el.getBoundingClientRect(), b = target.getBoundingClientRect();
      const k = parseFloat(getComputedStyle(target).fontSize) / parseFloat(getComputedStyle(el).fontSize);
      el.animate(
        [{transform: 'translate(0,0) scale(1)'}, {transform: `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(${k})`}],
        {duration: dur, easing: EASE_MOVE, fill: 'forwards'},
      ).finished.then(finish);
    } else {
      el.animate([{opacity: 1}, {opacity: 0}], {duration: dur, fill: 'forwards'}).finished.then(finish);
    }
  }, [onDone]);

  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    document.body.classList.add('splashing');
    // 글자가 굵어지고 한 줄이 떠오른 뒤 잠깐 머물고 나간다(누르면 바로). 움직임 줄이기면 짧게
    const t = setTimeout(leave, reduce ? 500 : 2100);
    window.addEventListener('keydown', leave);
    return () => { clearTimeout(t); window.removeEventListener('keydown', leave); document.body.classList.remove('splashing'); };
  }, [leave, reduce]);

  return (
    <div className="splash" onClick={leave} role="presentation">
      <div ref={veil} className="sp-veil" />
      <div className="sp-stack">
        <div ref={logo} className="sp-logo" aria-label="OFIT">
          {'OFIT'.split('').map((c, i) => (
            <span key={i} className="sp-mask"><span style={{animationDelay: `${120 + i * 70}ms, ${120 + i * 70}ms`, animationTimingFunction: `${EASE_OUT}, ${EASE_OUT}`}}>{c}</span></span>
          ))}
        </div>
        <p className="sp-tag" aria-hidden="true">담당자가 바뀌어도 업무는 이어집니다</p>
      </div>
    </div>
  );
}
