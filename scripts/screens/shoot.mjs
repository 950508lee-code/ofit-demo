// 크롬 개발자 프로토콜로 오핏의 여러 상태를 찍는다. node shoot.mjs <scenes.json> <outdir>
import {spawn} from 'node:child_process';
import {readFileSync, writeFileSync, mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const [scenesFile, outDir] = process.argv.slice(2);
const scenes = JSON.parse(readFileSync(scenesFile, 'utf8'));
const CH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9333;
const prof = mkdtempSync(join(tmpdir(), 'ofitcdp-'));
const chrome = spawn(CH, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--window-size=1440,900', 'about:blank']);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ws, id = 0; const pending = new Map();
for (let i = 0; i < 50; i++) { try { const r = await fetch(`http://127.0.0.1:${port}/json/list`); const t = (await r.json()).find(x => x.type === 'page'); ws = new WebSocket(t.webSocketDebuggerUrl); break; } catch { await sleep(200); } }
await new Promise(r => ws.addEventListener('open', r));
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({id: i, method, params})); });
const evalJs = async js => { const r = await send('Runtime.evaluate', {expression: `(async()=>{${js}})()`, awaitPromise: true, returnByValue: true}); return r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description; };
await send('Page.enable'); await send('Runtime.enable');
for (const sc of scenes) {
  const mobile = sc.mobile;
  await send('Emulation.setDeviceMetricsOverride', mobile ? {width: 375, height: 812, deviceScaleFactor: 2, mobile: true} : {width: 1440, height: 900, deviceScaleFactor: 1, mobile: false});
  if (sc.url) { await send('Page.navigate', {url: sc.url}); await sleep(sc.loadWait ?? 3500); }
  if (sc.js) { const v = await evalJs(sc.js); if (v !== undefined) console.log(sc.name, '→', v); await sleep(sc.wait ?? 500); }
  const shot = await send('Page.captureScreenshot', {format: 'png'});
  writeFileSync(join(outDir, `${sc.name}.png`), Buffer.from(shot.result.data, 'base64'));
  console.log('찍음', sc.name);
}
ws.close(); chrome.kill();
