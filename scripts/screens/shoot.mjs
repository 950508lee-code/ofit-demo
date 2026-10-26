// 크롬 개발자 프로토콜로 오핏의 여러 상태를 찍는다. node shoot.mjs <scenes.json> <outdir>
import {spawn} from 'node:child_process';
import {readFileSync, writeFileSync, mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const [scenesFile, outDir] = process.argv.slice(2);
const scenes = JSON.parse(readFileSync(scenesFile, 'utf8'));
const CH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const prof = mkdtempSync(join(tmpdir(), 'ofitcdp-'));
// 크롬과는 파이프(fd 3 = 보냄, fd 4 = 받음)로만 주고받는다. 포트를 열거나 HTTP로 접속하지 않는다.
const chrome = spawn(CH, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--remote-debugging-pipe', `--user-data-dir=${prof}`, '--window-size=1440,900', 'about:blank'],
  {stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe']});
const sleep = ms => new Promise(r => setTimeout(r, ms));
let id = 0, buf = '', session; const pending = new Map();
chrome.stdio[4].on('data', d => {
  buf += d.toString('utf8');
  let k;
  while ((k = buf.indexOf('\0')) >= 0) {
    const m = JSON.parse(buf.slice(0, k)); buf = buf.slice(k + 1);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  }
});
const raw = (method, params = {}, sessionId) => new Promise(r => { const i = ++id; pending.set(i, r); chrome.stdio[3].write(JSON.stringify({id: i, method, params, ...(sessionId ? {sessionId} : {})}) + '\0'); });
const send = (method, params = {}) => raw(method, params, session);
const {result: {targetId}} = await raw('Target.createTarget', {url: 'about:blank'});
session = (await raw('Target.attachToTarget', {targetId, flatten: true})).result.sessionId;
const evalJs = async js => { const r = await send('Runtime.evaluate', {expression: `(async()=>{${js}})()`, awaitPromise: true, returnByValue: true}); return r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description; };
await send('Page.enable'); await send('Runtime.enable');
// 장면 파일이 fixDate 를 주면 앱이 보는 날짜를 그 시각부터 흐르게 고정한다(요일에 따라 점검 결과가 바뀌지 않게)
const fix = scenes.find(x => x.fixDate)?.fixDate;
if (fix) await send('Page.addScriptToEvaluateOnNewDocument', {source: `(() => { const D = Date, off = D.parse(${JSON.stringify(fix)}) - D.now();
  class F extends D { constructor(...a) { super(...(a.length ? a : [D.now() + off])); } static now() { return D.now() + off; } }
  globalThis.Date = F; })();`});
for (const sc of scenes) {
  const mobile = sc.mobile;
  await send('Emulation.setDeviceMetricsOverride', mobile ? {width: 375, height: 812, deviceScaleFactor: 2, mobile: true} : {width: 1440, height: 900, deviceScaleFactor: 1, mobile: false});
  if (sc.url) { await send('Page.navigate', {url: sc.url}); await sleep(sc.loadWait ?? 3500); }
  if (sc.js) { const v = await evalJs(sc.js); if (v !== undefined) console.log(sc.name, '→', v); await sleep(sc.wait ?? 500); }
  const shot = await send('Page.captureScreenshot', {format: 'png'});
  writeFileSync(join(outDir, `${sc.name}.png`), Buffer.from(shot.result.data, 'base64'));
  console.log('찍음', sc.name);
}
await raw('Browser.close').catch(() => {}); chrome.kill();
