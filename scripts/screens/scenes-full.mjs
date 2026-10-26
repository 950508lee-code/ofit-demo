// 전체 화면 점검 장면 — 사람 셋·그룹·부서 일정이 있는 상태를 만든 뒤 모든 화면을 데스크톱·폰으로 찍는다.
// node scripts/screens/scenes-full.mjs scripts/screens/scenes-full.json
// node scripts/screens/shoot.mjs scripts/screens/scenes-full.json <저장 폴더>
import {writeFileSync} from 'node:fs';

const H = `
const all = () => [...document.querySelectorAll('button,label,a,[role=button],[role=tab],[role=gridcell],[role=radio]')];
const click = t => { const el = all().find(e => e.innerText.trim().startsWith(t)) || all().find(e => e.innerText.includes(t)); if (el) el.click(); return el ? 'ok ' + t : 'MISS ' + t; };
const setEl = (el, v) => { const d = Object.getOwnPropertyDescriptor(el.__proto__, 'value'); d.set.call(el, v); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', {bubbles: true})); };
const setVal = (sel, v) => setEl(document.querySelector(sel), v);
const wait = ms => new Promise(r => setTimeout(r, ms));
const who = () => document.querySelector('button.who').click();
const nav = t => [...document.querySelectorAll('.nav button')].find(b => b.innerText.startsWith(t)).click();
const logoutTo = async n => { if (document.querySelector('button.who')) { who(); await wait(200); click('로그아웃'); await wait(300); } click(n); await wait(700); };
const signupAs = async (name, dept, unit) => {
  click('가입하기'); await wait(200); setVal('input', name); await wait(100); click('다음'); await wait(200); click('국민건강보험공단'); await wait(300);
  setVal('.search', dept); await wait(200); [...document.querySelectorAll('.choice')].find(b => b.innerText.includes(dept)).click(); await wait(300);
  setVal('.search', unit); await wait(200); [...document.querySelectorAll('label.choice')].find(l => l.innerText.startsWith(unit)).click(); await wait(100);
  click('1개 고르기'); await wait(2400); click('시작하기'); await wait(600);
};
const compose = async () => { document.querySelector('.detailbtn').click(); await wait(300); };
const target = async t => { [...document.querySelectorAll('.compose .seg2 button')].find(b => b.innerText === t).click(); await wait(200); };
`;
const U = 'http://localhost:5180/';
const s = (name, js, o = {}) => ({name, js: H + js, ...o});

const scenes = [
  {name: 'a00', url: U, loadWait: 1500},
  s('a01-login', `localStorage.clear(); location.reload(); return 1;`, {wait: 3800}),
  s('a02-name', `click('가입하기'); await wait(200); setVal('input', '박공단'); return 1;`),
  s('a03-org', `click('다음'); return 1;`),
  s('a04-dept', `click('국민건강보험공단'); await wait(300); setVal('.search', '노원'); return 1;`),
  s('a05-units', `[...document.querySelectorAll('.choice')].find(b => b.innerText.includes('노원지사')).click(); await wait(300); setVal('.search', '예산'); await wait(200); [...document.querySelectorAll('label.choice')][0].click(); return 1;`),
  s('a06-filling', `click('1개 고르기'); return 1;`, {wait: 2600}),
  // 정본부 가입 + 김건강 그룹 + 부서 일정
  s('a07-setup', `click('시작하기'); await wait(600); who(); await wait(200); click('로그아웃'); await wait(300);
    await signupAs('정본부', '보험급여실', '정보공개');
    await compose(); setVal('.compose input', '3분기 예산 집행 실적 회신'); setEl(document.querySelector('.compose input[type=date]'), '2026-10-30'); await target('부서');
    for (const q of ['광진지사', '노원지사']) { setVal('.dmulti input', q); await wait(150); document.querySelector('.found button').click(); await wait(150); }
    const sel = document.querySelector('select[aria-label=업무]'); setEl(sel, [...sel.options].find(o => o.text === '예산·회계').value); await wait(100);
    setVal('.compose textarea', '첨부 양식에 지사별 집행 실적을 적어 회신해 주세요'); document.querySelector('.modal .primary').click(); await wait(400);
    await logoutTo('김건강'); nav('그룹'); await wait(200); click('그룹 만들기'); await wait(100); setVal('.inline-form input', '연말 고객 안내 캠페인'); click('만들기'); await wait(300);
    const code = document.querySelector('.g-h .sub b').innerText;
    await logoutTo('박공단'); nav('그룹'); await wait(200); click('코드로 참여'); await wait(100); setVal('.inline-form input', code); click('참여하기'); await wait(300);
    await logoutTo('김건강'); nav('그룹'); await wait(200); click('연말 고객 안내 캠페인'); await wait(200); click('일정 만들기'); await wait(300);
    setVal('.compose input', '안내 리플릿 배포'); setEl(document.querySelector('.compose input[type=date]'), '2026-10-30');
    const add = () => [...document.querySelectorAll('.compose .textbtn')].find(b => b.innerText.includes('항목 더하기')).click();
    add(); await wait(50); add(); await wait(100);
    const names = ['리플릿 시안 확정', '광진지사 배포', '노원지사 배포'], owners = ['김건강', '김건강', '박공단'];
    document.querySelectorAll('.compose .additem').forEach((r, i) => { setEl(r.querySelector('input'), names[i]); const o = [...r.querySelector('select').options].find(x => x.text === owners[i]); setEl(r.querySelector('select'), o.value); });
    await wait(100); document.querySelector('.modal .primary').click(); await wait(400);
    click('안내 리플릿 배포'); await wait(300); document.querySelector('.gchecks input').click(); await wait(100);
    const ci = document.querySelectorAll('.detail .additem')[1]; setEl(ci.querySelector('input'), '시안 공유 폴더에 올렸습니다'); ci.querySelector('button').click(); await wait(200);
    setVal('.inline-form input', '다음 주 월요일까지 지사별 배포 수량 확정 바랍니다'); [...document.querySelectorAll('.inline-form button')][0].click(); await wait(200);
    return code;`, {wait: 300}),
  // 데스크톱: 김건강
  s('b01-home', `nav('홈'); await wait(300); return 1;`),
  s('b02-home-day', `click('다음 주'); await wait(150); click('다음 주'); await wait(150); [...document.querySelectorAll('.wday, .wd')].find(b => b.innerText.includes('30'))?.click(); await wait(200); return document.querySelectorAll('.wday, .wd').length;`),
  s('b03-dispatch-card', `[...document.querySelectorAll('.daylist .row')].find(r => r.innerText.includes('회신'))?.click(); return 1;`),
  s('b04-gitem-card', `[...document.querySelectorAll('.daylist .row')].find(r => r.innerText.includes('광진지사 배포'))?.click(); return 1;`),
  s('b05-calendar', `nav('달력'); await wait(300); return 1;`),
  s('b06-groups', `nav('그룹'); await wait(300); return 1;`),
  s('b07-group', `click('연말 고객 안내 캠페인'); await wait(300); return 1;`),
  s('b08-notices', `nav('알림'); await wait(300); return 1;`),
  s('b09-me', `who(); await wait(300); return 1;`),
  s('b10-compose-me', `nav('홈'); await wait(200); await compose(); setVal('.compose input', '팀 회의'); return 1;`),
  s('b10b-compose-dept-filled', `await target('부서'); setVal('.dmulti input', '노원'); await wait(150); document.querySelector('.found button').click(); await wait(150); const sel = document.querySelector('select[aria-label=업무]'); setEl(sel, [...sel.options].find(o => o.text === '예산·회계').value); await wait(200); return 1;`),
  s('b11-compose-dept', `await target('부서'); return 1;`),
  s('b12-compose-group', `await target('그룹'); return 1;`),
  s('b13-handover', `document.querySelector('.modal .ghost').click(); await wait(200); who(); await wait(200); click('인수인계 하기'); await wait(300); [...document.querySelectorAll('label.choice')].find(l => l.innerText.startsWith('예산·회계'))?.click(); return 1;`),
  // 정본부: 보낸 일정
  s('b14-sent', `click('닫기'); await wait(200); await logoutTo('정본부'); who(); await wait(300); [...document.querySelectorAll('.row')].find(r => r.innerText.includes('회신'))?.click(); return 1;`),
  // 폰: 박공단
  s('m01-home', `await logoutTo('박공단'); return 1;`, {mobile: true}),
  s('m02-calendar', `nav('달력'); return 1;`, {mobile: true}),
  s('m03-groups', `nav('그룹'); await wait(200); click('연말 고객 안내 캠페인'); return 1;`, {mobile: true}),
  s('m04-notices', `document.querySelector('.topalarm').click(); return 1;`, {mobile: true}),
  s('m05-me', `nav('내 정보'); return 1;`, {mobile: true}),
  s('m06-card', `nav('홈'); await wait(200); click('다음 주'); await wait(150); click('다음 주'); await wait(150); [...document.querySelectorAll('.wday, .wd')].find(b => b.innerText.includes('30'))?.click(); await wait(200); [...document.querySelectorAll('.daylist .row')].find(r => r.innerText.includes('회신'))?.click(); return 1;`, {mobile: true}),
];
writeFileSync(process.argv[2], JSON.stringify(scenes));
