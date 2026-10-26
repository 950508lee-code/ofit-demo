// 발령 중 같은 업무를 넘기면서 받기 점검 — 김건강이 광진 예산·회계를 이광진에게 넘기는 중에 노원에서 박공단의 예산·회계를 받는다.
// 기대: 이광진(광진 예산·회계) · 김건강(노원 예산·회계) · 박공단(없음)
import {readFileSync, writeFileSync} from 'node:fs';
const src = readFileSync('scripts/screens/demo-flow.mjs', 'utf8');
const st = src.indexOf('const H = `') + 11; const H = src.slice(st, src.indexOf('`;', st));
const s = (name, js, o = {}) => ({name, js: H + 'try {' + js + '} catch (e) { return "ERR " + e.message; }', ...o});
const signup = (n, dept, unit) => `click('새 직원으로 시작하기'); await wait(250); setVal('input', '${n}'); click('다음'); await wait(300); click('국민건강보험공단'); await wait(300);
    setVal('.search', '${dept}'); await wait(250); $$('.choice').find(b => b.innerText.includes('${dept}')).click(); await wait(350);
    $$('label.choice').find(l => l.innerText.startsWith('${unit}')).click(); $('.flow-foot .primary').click(); await wait(2600); click('시작하기'); await wait(700);`;
const units = `nav('내 업무'); await wait(400); const r = $$('.wu-t .nm').map(x => x.innerText);`;
writeFileSync(process.argv[2], JSON.stringify([
  {name: 'x0', url: 'http://localhost:5180/', loadWait: 1500},
  s('x1', `localStorage.clear(); location.reload(); return 1;`, {wait: 4000}),
  s('x2', `${signup('박공단', '노원지사', '예산·회계')}
    nav('내 업무'); await wait(300); click('인수인계 하기'); await wait(400);
    $$('label.choice').find(l => l.innerText.startsWith('김건강')).click(); $$('label.choice').find(l => l.innerText.startsWith('예산·회계')).click();
    $('.flow .primary.wide').click(); await wait(500);
    who(); await wait(200); click('로그아웃'); await wait(300); ${signup('이광진', '광진지사', '민원 응대')}
    await logoutTo('김건강'); nav('내 업무'); await wait(300); click('부서 옮기기'); await wait(400);
    const sels = $$('.sort-row select'); const names = $$('.sort-row b').map(b => b.innerText);
    sels.forEach((sel, i) => setEl(sel, names[i] === '예산·회계' ? [...sel.options].find(o => o.text.startsWith('이광진')).value : 'drop'));
    await wait(200); $('.flow-foot .primary').click(); await wait(500);
    setVal('.search', '노원'); await wait(300); $$('.choice').find(b => b.innerText.includes('노원지사')).click(); await wait(500);
    click('받기'); await wait(500); $('.flow-foot .primary').click(); await wait(500);
    $('.settle-units .skip').click(); await wait(2600); click('시작하기'); await wait(800);
    ${units} return '김건강(이광진 받기 전): ' + r.join(',');`),
  s('x3', `await logoutTo('이광진'); click('받기'); await wait(500); ${units} return '이광진: ' + r.join(',');`),
  s('x4', `await logoutTo('김건강'); ${units} return '김건강(이광진 받은 뒤): ' + r.join(',') + ' / 부서 ' + txt('button.who span');`),
  s('x5', `await logoutTo('박공단'); ${units} return '박공단: ' + r.join(',');`),
]));
