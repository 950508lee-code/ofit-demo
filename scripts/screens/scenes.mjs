// 화면 점검 장면. node scripts/screens/scenes.mjs scripts/screens/scenes.json
import {writeFileSync} from 'node:fs';
const H = `
const all = () => [...document.querySelectorAll('button,label,a,[role=button],[role=tab],[role=gridcell]')];
const click = t => { const el = all().find(e => e.innerText.trim().startsWith(t)) || all().find(e => e.innerText.includes(t)); if (el) el.click(); return el ? 'ok ' + t : 'MISS ' + t; };
const setVal = (sel, v) => { const el = document.querySelector(sel); const d = Object.getOwnPropertyDescriptor(el.__proto__, 'value'); d.set.call(el, v); el.dispatchEvent(new Event('input', {bubbles: true})); return 'set'; };
const wait = ms => new Promise(r => setTimeout(r, ms));
`;
const U = 'http://localhost:5180/';
const s = (name, js, o = {}) => ({name, js: H + js, ...o});
const scenes = [
  s('00-reset', `localStorage.clear(); location.reload(); return 1;`, {wait: 3800}),
  s('01-home', `click('김건강'); await wait(600); return 'x';`, {wait: 600}),
  s('02-home-other-day', `const b = [...document.querySelectorAll('.wd')][5]; b.click(); return 'x';`),
  s('03-home-card', `[...document.querySelectorAll('.wd')].find(b => b.classList.contains('today')).click(); await wait(200); const r = document.querySelectorAll('.daylist .row'); r[r.length - 1]?.click(); return r.length;`),
  s('04-calendar', `click('달력'); return 'x';`),
  s('05-calendar-day', `const c = [...document.querySelectorAll('.cell')].find(x => x.innerText.includes('사후관리')); c?.click(); return !!c;`),
  s('06-calendar-card', `document.querySelector('.daypanel .row:not(.static)')?.click(); return 'x';`),
  s('07-notices', `click('알림'); return 'x';`),
  s('08-me', `document.querySelector('button.who')?.click(); return 'x';`),
  s('09-me-unit', `click('상한제'); return 'x';`),
  s('m1-home', `click('홈'); return 'x';`, {mobile: true}),
  s('m2-calendar', `click('달력'); return 'x';`, {mobile: true}),
  s('m3-me', `click('내 정보'); return 'x';`, {mobile: true}),
];
writeFileSync(process.argv[2], JSON.stringify(scenes));
