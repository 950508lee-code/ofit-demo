// 시연 흐름 점검 — 심사 시연 순서대로 처음부터 끝까지 돌리며 PC 화면(1440)을 찍고, 단계마다 기대 결과를 확인한다.
// node scripts/screens/demo-flow.mjs scripts/screens/demo-flow.json
// node scripts/screens/shoot.mjs scripts/screens/demo-flow.json <저장 폴더>
// 각 장면은 'OK …' 또는 'CHECK …'(기대와 다름)을 찍는다. 예외는 메시지가 그대로 찍힌다.
import {writeFileSync} from 'node:fs';

const H = `
const all = () => [...document.querySelectorAll('button,label,a,[role=button],[role=tab],[role=gridcell],[role=radio]')];
const click = t => { const el = all().find(e => e.innerText.trim().startsWith(t)) || all().find(e => e.innerText.includes(t)); if (!el) throw new Error('못 찾음: ' + t); el.click(); };
const setEl = (el, v) => { const d = Object.getOwnPropertyDescriptor(el.__proto__, 'value'); d.set.call(el, v); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', {bubbles: true})); };
const setVal = (sel, v) => setEl(document.querySelector(sel), v);
const wait = ms => new Promise(r => setTimeout(r, ms));
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const txt = s => ($(s)?.innerText ?? '').split(String.fromCharCode(10)).join(' / ');
const who = () => $('button.who').click();
const nav = t => $$('.nav button').find(b => b.innerText.startsWith(t)).click();
// 사람 바꾸기: 들어와 있으면 시연용 계정 바꾸기로, 아니면 로그인 화면에서
const logoutTo = async n => {
  if ($('.acct-btn')) { $('.acct-btn').click(); await wait(250); const it = $$('.acct-menu button').find(b => b.innerText.startsWith(n)); if (it) { it.click(); await wait(800); return; } $('.acct-btn').click(); }
  if ($('button.who')) { who(); await wait(250); click('로그아웃'); await wait(350); } click(n); await wait(800);
};
const rows = () => $$('.daylist .row .row-main').map(b => b.innerText);
const check = (ok, msg) => (ok ? 'OK ' : 'CHECK ') + msg;
const toast = () => $('.toast')?.innerText.split(String.fromCharCode(10)).join(' ') ?? '';
const weekTo = async day => { if ($$('.cal-nav button').some(b => b.innerText === '이번 주' && !b.disabled)) { click('이번 주'); await wait(300); } let n = 0; while (!$$('.wday').some(b => b.querySelector('.wday-h b')?.innerText === String(day)) && n++ < 4) { click('다음 주'); await wait(300); } $$('.wday').find(b => b.querySelector('.wday-h b')?.innerText === String(day)).click(); await wait(300); };
`;
const U = 'http://localhost:5180/';
const s = (name, js, o = {}) => ({name, js: H + js, ...o});

const scenes = [
  {name: 'd00', url: U, loadWait: 1500},
  // 1. 시작
  s('d01-splash', `localStorage.clear(); location.reload(); return 1;`, {wait: 900}),
  s('d02-login', `await wait(3000); return check($$('button').some(b => b.innerText.includes('업무 표준 총괄 관리자')), '로그인: ' + $$('.choices .choice').map(b => b.innerText.split(String.fromCharCode(10)).join(' ')).join(' | '));`),
  // 2. 가입
  s('d03-signup-name', `click('가입하기'); await wait(250); setVal('input', '박공단'); return 1;`),
  s('d04-signup-org', `click('다음'); await wait(300); return check($$('button').some(b => b.innerText.includes('국민건강보험공단')), '조직 고르기');`),
  s('d05-signup-dept', `click('국민건강보험공단'); await wait(300); setVal('.search', '노원'); await wait(250); return check($$('.choice').some(b => b.innerText.includes('노원지사')), '부서 찾기: 노원지사');`),
  s('d06-signup-units', `$$('.choice').find(b => b.innerText.includes('노원지사')).click(); await wait(350);
    for (const u of ['예산·회계', '인사·복무']) $$('label.choice').find(l => l.innerText.startsWith(u)).click();
    await wait(200); return check($('.flow-foot .primary')?.innerText.includes('2개'), '업무 2개 고름: ' + $('.flow-foot .primary')?.innerText);`),
  s('d07-filling', `$('.flow-foot .primary').click(); await wait(1200); return check(/반복업무/.test(document.body.innerText), '반복업무 채우는 장면');`, {wait: 300}),
  s('d08-home', `await wait(1500); click('시작하기'); await wait(900); return check($$('.wday').length >= 5 && rows().length > 0, '홈: 이번 주 탑 ' + $$('.wday').length + '칸, 오늘 ' + rows().join(', '));`),
  // 3. 홈
  s('d09-quick-preview', `setVal('.qi input', '매주 금요일 3시 주간 회의'); await wait(250); return check(txt('.quick .preview').includes('매주 금요일'), '빠른 입력 미리보기: ' + txt('.quick .preview'));`),
  s('d10-quick-added', `$('.qi button').click(); await wait(500); return check(rows().includes('주간 회의'), '오늘 목록에 주간 회의: ' + rows().join(', '));`),
  s('d11-done-undo', `const r = $$('.daylist .row').find(x => x.querySelector('.place')); r.querySelector('.row-main').click(); await wait(400);
    const t = $('.detail h2').innerText; $$('.detail .primary').find(b => b.innerText.trim() === '완료').click(); await wait(400);
    return check(toast().includes('되돌리기'), t + ' 완료 → ' + toast());`),
  // 4. 자리 화면
  s('d12-place', `$('.toast button')?.click(); await wait(300); const chip = $$('.row button.place')[0]; const name = chip.innerText; chip.click(); await wait(600);
    return check(txt('.place-h h2') === name && !!$('.beat'), '자리 화면: ' + txt('.place-h h2') + ' / ' + txt('.beat-h span'));`),
  s('d13-place-lower', `$('.std').scrollIntoView({block: 'start'}); await wait(300); return check(!!$('.tenure'), '업무 표준·지난 기록·있었던 사람: ' + txt('.tenure'));`),
  // 5. 부서 일정: 김건강이 노원지사 예산·회계 담당에게
  s('d14-dispatch-compose', `await logoutTo('김건강'); $('.newbtn').click(); await wait(400);
    setVal('.compose input', '3분기 예산 집행 실적 회신'); $$('.compose .seg2 button').find(b => b.innerText === '부서').click(); await wait(200);
    setVal('.dmulti input', '노원지사'); await wait(200); $('.found button').click(); await wait(200);
    const sel = $('select[aria-label=업무]'); setEl(sel, [...sel.options].find(o => o.text === '예산·회계').value);
    setEl($('.compose input[type=date]'), '2026-10-30'); setVal('.compose textarea', '첨부 양식에 집행 실적을 적어 회신해 주세요'); await wait(300);
    $('.compose').scrollTop = 999; await wait(200);
    return check(txt('.recips').includes('박공단'), '받는 사람 미리보기: ' + txt('.recips'));`),
  s('d15-dispatch-sent', `$('.modal .primary').click(); await wait(500); return check(toast().includes('보냈습니다'), toast());`),
  s('d16-dispatch-recv', `await logoutTo('박공단'); await weekTo(30);
    const r = $$('.daylist .row').find(x => x.innerText.includes('예산 집행 실적')); r.querySelector('.row-main').click(); await wait(400);
    return check(!!$('.dueline') && r.innerText.includes('예산·회계 담당에게'), '받은 쪽: ' + r.innerText.split(String.fromCharCode(10)).join(' ') + ' / ' + txt('.dueline .ends'));`),
  s('d17-dispatch-done', `setVal('.detail .memo', '집행률 61%, 양식 첨부했습니다'); $$('.detail .primary').find(b => b.innerText.trim() === '완료').click(); await wait(400);
    await logoutTo('김건강'); who(); await wait(400); $$('.row').find(r => r.innerText.includes('예산 집행 실적')).click(); await wait(400);
    return check(txt('.detail .cells small').includes('1/1'), '보낸 쪽 현황: ' + txt('.detail .cells small') + ' / ' + txt('.sent-dept'));`),
  s('d17b-dispatch-repeat', `$('.detail .x')?.click(); $('.newbtn').click(); await wait(400);
    setVal('.compose input', '월간 집행 실적 회신'); $$('.compose .seg2 button').find(b => b.innerText === '부서').click(); await wait(200);
    setVal('.dmulti input', '노원지사'); await wait(200); $('.found button').click(); await wait(200);
    const sel = $('select[aria-label=업무]'); setEl(sel, [...sel.options].find(o => o.text === '예산·회계').value);
    setEl($('.compose input[type=date]'), '2026-11-05'); await wait(100);
    $$('.fld .seg2 button').find(b => b.innerText === '반복').click(); await wait(200);
    $$('.rp-unit button').find(b => b.innerText === '개월').click(); await wait(200);
    $('.compose').scrollTop = 9999; await wait(200);
    return check(txt('.rp-sum').startsWith('매월 5일'), '반복 부서 일정: ' + txt('.rp-sum'));`),
  s('d17c-dispatch-repeat-sent', `$('.modal .primary').click(); await wait(500); return check(toast().includes('반복(매월 5일)'), toast());`),
  // 6. 그룹
  s('d18-group', `$('.detail .x')?.click(); nav('그룹'); await wait(300); click('그룹 만들기'); await wait(150); setVal('.inline-form input', '연말 고객 안내 캠페인'); click('만들기'); await wait(400);
    const code = $('.g-h .sub b').innerText;
    await logoutTo('박공단'); nav('그룹'); await wait(300); click('코드로 참여'); await wait(150); setVal('.inline-form input', code); click('참여하기'); await wait(400);
    await logoutTo('김건강'); nav('그룹'); await wait(300); click('연말 고객 안내 캠페인'); await wait(300); click('일정 만들기'); await wait(400);
    setVal('.compose input', '안내 리플릿 배포'); setEl($('.compose input[type=date]'), '2026-10-30');
    const add = () => $$('.compose .textbtn').find(b => b.innerText.includes('항목 더하기')).click(); add(); await wait(80);
    const names = ['리플릿 시안 확정', '노원지사 배포'], owners = ['김건강', '박공단'];
    $$('.compose .additem').forEach((r, i) => { setEl(r.querySelector('input'), names[i]); const o = [...r.querySelector('select').options].find(x => x.text === owners[i]); setEl(r.querySelector('select'), o.value); });
    await wait(150); $('.modal .primary').click(); await wait(500);
    return check(document.body.innerText.includes('안내 리플릿 배포'), '그룹 일정: 멤버 ' + txt('.g-h .sub'));`),
  // 7. 업무 표준: 박공단이 올림 → 경영지원 관리자 한경영 승인
  s('d19-std-propose', `await logoutTo('박공단'); who(); await wait(400); $$('.card .row').find(r => r.innerText.startsWith('예산·회계')).click(); await wait(500);
    click('반복업무 더하기'); await wait(200); setVal('.dline input', '매월 10일 예산 전용 신청 취합'); await wait(250);
    const hint = txt('.std-form .hint'); $('.std').scrollIntoView({block: 'center'}); await wait(200);
    return check(hint.includes('한경영') && txt('.dline small').includes('매월 10일'), hint + ' / ' + txt('.dline small'));`),
  s('d20-std-review', `$('.std .primary').click(); await wait(400); await logoutTo('한경영'); who(); await wait(400);
    return check(txt('.card .sec-h').includes('검토 1'), txt('.card .sec-h') + ' / ' + txt('.review .rv-h'));`),
  s('d21-std-approved', `$('.review .primary').click(); await wait(400); await logoutTo('박공단'); nav('알림'); await wait(400);
    return check(document.body.innerText.includes('개가 승인됐습니다'), '알림: ' + ($$('.notice')[0]?.innerText.split(String.fromCharCode(10)).join(' ') ?? ''));`),
  s('d21b-std-no-past', `nav('홈'); await wait(400); return check(!document.body.innerText.includes('기한 지난 일') || !rows().includes('예산 전용 신청 취합'), '승인된 새 반복업무가 지난 회차로 안 생김: ' + rows().join(', '));`),
  // 8. 인수인계: 김건강 → 이광진(같은 광진지사)
  s('d22-handover-send', `who(); await wait(250); click('로그아웃'); await wait(350);
    click('가입하기'); await wait(250); setVal('input', '이광진'); click('다음'); await wait(300); click('국민건강보험공단'); await wait(300);
    setVal('.search', '광진'); await wait(250); $$('.choice').find(b => b.innerText.includes('광진지사')).click(); await wait(350);
    $$('label.choice').find(l => l.innerText.startsWith('민원 응대')).click(); await wait(100); $('.flow-foot .primary').click(); await wait(2600); click('시작하기'); await wait(700);
    await logoutTo('김건강'); who(); await wait(300); click('인수인계 하기'); await wait(400);
    $$('label.choice').find(l => l.innerText.startsWith('이광진')).click(); $$('label.choice').find(l => l.innerText.startsWith('홍보')).click(); await wait(200);
    if ($('.flow textarea')) setVal('.flow textarea', '누리집 공지는 화요일 오전에 올립니다. 보도자료 결과는 언론 스크랩 폴더를 보세요'); await wait(100);
    return check($$('label.choice').find(l => l.innerText.startsWith('이광진'))?.innerText.includes('같은 부서'), '받을 사람: ' + $$('label.choice').find(l => l.innerText.startsWith('이광진'))?.innerText.split(String.fromCharCode(10)).join(' '));`),
  s('d23-handover-accept', `$('.flow .primary.wide').click(); await wait(500); await logoutTo('이광진'); await wait(200);
    const inbox = document.body.innerText.includes('받기'); click('받기'); await wait(500);
    return check(inbox && !!$('.inbox.got'), '받은 업무 판: ' + txt('.inbox.got'));`),
  s('d24-handover-place', `$$('.row button.place').find(b => b.innerText === '홍보')?.click() ?? (who(), 0); await wait(500);
    if (!$('.place-h')) { $$('.card .row').find(r => r.innerText.startsWith('홍보')).click(); await wait(500); }
    $('.tenure').scrollIntoView({block: 'center'}); await wait(200);
    return check(txt('.tenure').includes('김건강') && txt('.tenure').includes('이광진'), '사람 선: ' + txt('.tenure'));`),
  // 9. 업무 바꾸기
  s('d25-manage', `await logoutTo('김건강'); who(); await wait(400); click('업무 바꾸기'); await wait(400);
    $$('label.choice').find(l => l.innerText.startsWith('계약·구매')).click(); await wait(200);
    $('.flow-foot').scrollIntoView(); return check($('.flow-foot .primary').innerText.includes('1개 새로 맡기'), $('.flow-foot .primary').innerText);`),
  s('d26-manage-done', `$('.flow-foot .primary').click(); await wait(500); return check(toast().includes('맡았습니다'), toast() + ' / 내 업무: ' + $$('.card .row .t').slice(0, 4).map(x => x.innerText.split(String.fromCharCode(10))[0]).join(', '));`),
  // 10. 달력·알림
  s('d27-calendar', `nav('달력'); await wait(500); return check($$('.cell').length >= 35, '달력 칸 ' + $$('.cell').length + ', 칩 ' + $$('.cell .ev span').length);`),
  s('d28-notices', `nav('알림'); await wait(400); return check($$('.notice').length > 0, '알림 ' + $$('.notice').length + '건: ' + $$('.notice .k').map(x => x.innerText).join(', '));`),
];
writeFileSync(process.argv[2], JSON.stringify(scenes));
