// 공동 편집 점검 — 처리방법은 하나의 공동 문서: 담당자 편집 → 안 맡은 사람이 한 줄 삭제(확인 창) → 담당자 알림 → 변경 기록(별도 화면) → 이전 판 복원(새 판으로 남음) → 문서로 돌아옴 → 할 일 상세에 같은 원본.
// node scripts/screens/coedit-flow.mjs scripts/screens/coedit.json && node scripts/screens/shoot.mjs scripts/screens/coedit.json <폴더>
import {readFileSync, writeFileSync} from 'node:fs';
const src = readFileSync('scripts/screens/demo-flow.mjs', 'utf8');
const st = src.indexOf('const H = `') + 11; const H = src.slice(st, src.indexOf('`;', st));
// 확인 창(삭제·복원)은 점검에서 '확인'으로 넘긴다
const X = `window.confirm = () => true;
const btn = t => $$('button').find(b => b.innerText.trim() === t && b.offsetParent);
const doc = async () => { await know('예산·회계'); $$('.dix-r').find(b => b.innerText.startsWith('지출결의 마감')).click(); await wait(500); };
const steps = () => $$('.duty-doc .sb-list li').map(l => l.innerText.trim().split(String.fromCharCode(10)).join(' '));
const save = async () => { $$('.editor .er-act .primary').at(-1).click(); await wait(400); };
`;
const s = (name, js, o = {}) => ({name, js: H + X + 'try {' + js + '} catch (e) { return "ERR " + e.message; }', ...o});
writeFileSync(process.argv[2], JSON.stringify([
  {name: 'c0', url: 'http://localhost:5180/', loadWait: 1500, fixDate: '2026-10-30T10:00:00+09:00'},
  s('c1', `localStorage.clear(); location.reload(); return 1;`, {wait: 4000}),
  s('c2-doc', `document.body.click(); await wait(500); await logoutTo('김건강'); await doc();
    return check(!!btn('편집') && !$('.know-doc:not(.duty-doc) .stepsb') && txt('.sb-kind').includes('공식 기준이 아닙니다'), '반복업무 문서 · ' + txt('.sb-kind'));`),
  s('c3-edit', `btn('편집').click(); await wait(300); btn('+ 단계 추가').click(); await wait(150); setEl($$('.editor .er input').at(-1), '마감 목록을 공유폴더에 올리기'); await wait(100); await save();
    return check(steps().length === 5 && toast().includes('모두에게 바로'), steps().length + '단계 · ' + toast());`),
  s('c4-other', `await logoutTo('한경영'); await doc(); btn('편집').click(); await wait(300); $$('.editor .er')[1].querySelector('button').click(); await wait(150); await save();
    return check(steps().length === 4 && txt('.sb-src').includes('한경영'), '안 맡은 사람이 한 줄 삭제 · ' + txt('.sb-src'));`),
  s('c5-notice', `await logoutTo('김건강'); alarm(); await wait(400); const n = $$('.detail.notices .row.notice').map(r => r.innerText).find(t => t.includes('처리방법')) ?? '';
    return check(n.includes('한경영'), '내 업무에서 바뀐 것: ' + n.split(String.fromCharCode(10)).join(' '));`),
  s('c6-history', `$('.detail .xbtn')?.click(); await wait(300); await doc(); $$('.sb-src button').find(b => b.innerText.startsWith('변경 기록')).click(); await wait(300);
    return check($$('.sb-hist li').length === 3, '판 ' + $$('.sb-hist li').length + '개');`),
  s('c7-version', `$$('.sb-hist li')[1].querySelector('button').click(); await wait(300);
    return check(txt('.sb-ver').includes('지금은 없음') && !!btn('이 판으로 복원'), txt('.sb-ver-h'));`),
  s('c8-restore', `btn('이 판으로 복원').click(); await wait(400); const h = txt('.sb-hist li');
    $$('.duty-doc .over .crumb').at(-1).click(); await wait(300);
    return check(steps().length === 5 && h.includes('복원'), '복원 뒤 ' + steps().length + '단계 · ' + h);`),
  s('c9-detail', `nav('내 업무'); await wait(400); if (!$('.wu-b')) $$('.wu-t')[0].click(); await wait(300); $$('.wu-b .row-main').find(b => b.innerText.startsWith('지출결의 마감')).click(); await wait(500);
    const li = $$('.detail .sb-list li'); return check(li.length === 5 && !$$('.detail button').some(b => b.innerText.trim() === '편집'), '할 일 상세 ' + li.length + '단계, 편집 단추 없음');`),
]));
