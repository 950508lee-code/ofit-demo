import {useCallback, useEffect, useRef} from 'react';

const EASE_OUT = 'cubic-bezier(.16,1,.3,1)'; // 빠르게 시작해 길게 멈춘다
const EASE_MOVE = 'cubic-bezier(.75,0,.2,1)'; // 천천히 떠나 빠르게 이동, 부드럽게 앉는다

/**
 * 스플래시 — OFIT 네 글자가 선 아래에서 차례로 솟아오르고,
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

  useEffect(() => {
    document.body.classList.add('splashing');
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(leave, reduce ? 500 : 1500);
    window.addEventListener('keydown', leave);
    return () => { clearTimeout(t); window.removeEventListener('keydown', leave); document.body.classList.remove('splashing'); };
  }, [leave]);

  return (
    <div className="splash" onClick={leave} role="presentation">
      <div ref={veil} className="sp-veil" />
      <div ref={logo} className="sp-logo" aria-label="OFIT">
        {'OFIT'.split('').map((c, i) => (
          <span key={i} className="sp-mask"><span style={{animationDelay: `${120 + i * 70}ms`, animationTimingFunction: EASE_OUT}}>{c}</span></span>
        ))}
      </div>
    </div>
  );
}
