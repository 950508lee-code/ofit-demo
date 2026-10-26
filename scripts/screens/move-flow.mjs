// 발령 장면 점검 — 김건강이 광진지사에서 노원지사로: 맡던 업무 정리 → 새 부서 → 받을 인수인계 → 업무 고르기 → 차오르는 장면.
// node scripts/screens/move-flow.mjs scripts/screens/move-flow.json && node scripts/screens/shoot.mjs scripts/screens/move-flow.json <폴더>
import {readFileSync, writeFileSync} from 'node:fs';
const src = readFileSync('scripts/screens/demo-flow.mjs', 'utf8');
const st = src.indexOf('const H = `') + 11; const H = src.slice(st, src.indexOf('`;', st));
const s = (name, js, o = {}) => ({name, js: H + js, ...o});
const signup = (n, dept, unit) => `click('새 직원으로 시작하기'); await wait(250); setVal('input', '${n}'); click('다음'); await wait(300); click('국민건강보험공단'); await wait(300);
    setVal('.search', '${dept}'); await wait(250); $$('.choice').find(b => b.innerText.includes('${dept}')).click(); await wait(350);
    $$('label.choice').find(l => l.innerText.startsWith('${unit}')).click(); $('.flow-foot .primary').click(); await wait(2600); click('시작하기'); await wait(700);`;
writeFileSync(process.argv[2], JSON.stringify([
  {name: 'm0', url: 'http://localhost:5180/', loadWait: 1500},
  s('m1', `localStorage.clear(); location.reload(); return 1;`, {wait: 4000}),
  s('m2-setup', `${signup('박공단', '노원지사', '계약·구매')}
    nav('내 업무'); await wait(300); click('인수인계 하기'); await wait(400);
    $$('label.choice').find(l => l.innerText.startsWith('김건강')).click(); $$('label.choice').find(l => l.innerText.startsWith('계약·구매')).click();
    setVal('.flow textarea', '계약 만료 목록은 공유폴더 계약대장에 있습니다'); $('.flow .primary.wide').click(); await wait(500);
    who(); await wait(200); click('로그아웃'); await wait(300); ${signup('이광진', '광진지사', '민원 응대')}
    await logoutTo('김건강'); return 'ok';`),
  s('m3-me', `nav('내 업무'); await wait(400); return $$('.work-h .sec-acts button').map(b => b.innerText).join(', ');`),
  s('m4-sort', `click('부서 옮기기'); await wait(400);
    const sels = $$('.sort-row select'); const names = $$('.sort-row b').map(b => b.innerText);
    sels.forEach((sel, i) => { const want = names[i] === '홍보' ? 'drop' : [...sel.options].find(o => o.text.startsWith('이광진')).value; setEl(sel, want); });
    await wait(200); if ($('.flow textarea')) setVal('.flow textarea', '예산 전용은 매월 10일 전에 회계팀과 먼저 맞춥니다'); await wait(100);
    return txt('.settle-step') + ' / ' + names.join(',') + ' / ' + $('.flow-foot .primary').innerText;`),
  s('m5-dept', `$('.flow-foot .primary').click(); await wait(500); const t = toast(); setVal('.search', '노원'); await wait(300); return txt('.settle-step') + ' / ' + t;`),
  s('m6-inbox', `$$('.choice').find(b => b.innerText.includes('노원지사')).click(); await wait(500); return txt('.settle-step') + ' / ' + txt('.flow h1') + ' / ' + txt('.inbox p');`),
  s('m7-accepted', `click('받기'); await wait(500); return txt('.settle-got') + ' / ' + $('.flow-foot .primary').innerText;`),
  s('m8-units', `$('.flow-foot .primary').click(); await wait(500); $$('label.choice').find(l => l.innerText.startsWith('시설·안전')).click(); await wait(200);
    return txt('.settle-step') + ' / ' + txt('.flow h1') + ' / skip=' + !!$('.settle-units .skip') + ' / ' + $('.flow-foot .primary').innerText;`),
  s('m9-fill', `$('.flow-foot .primary').click(); await wait(2600); return txt('.flow h1');`),
  s('m10-home', `click('시작하기'); await wait(800); return '부서: ' + txt('button.who span') + ' / 오늘: ' + rows().join(', ') + ' / 받은 판: ' + !!$('.inbox.got');`),
  s('m11-lee', `await logoutTo('이광진'); return '이광진 받을 인수인계: ' + txt('.inbox .what');`),
]));
