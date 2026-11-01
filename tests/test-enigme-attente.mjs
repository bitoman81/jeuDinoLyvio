// Énigme qui s'ouvre : pendant PZ_WAIT, ni le doigt ni les touches ne choisissent de réponse
// (l'enfant appuie souvent encore pour sauter, foncer ou nager).
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const page = pathToFileURL(process.argv[2]).href;
const port = 9357;
const prof = mkdtempSync(join(tmpdir(), 'dino-chrome-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--window-size=1280,720', '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

let tabs;
for (let k = 0; k < 50; k++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(200); } }
const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pending = new Map(), errors = [];
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
};
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async expr => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result.exceptionDetails) throw new Error(expr.slice(0, 80) + ' -> ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text));
  return r.result.result.value;
};
await send('Runtime.enable'); await send('Page.enable');
await send('Page.navigate', { url: page }); await sleep(300);
for (let k = 0; k < 50; k++) { try { if (await ev(`typeof startLevel === 'function' && !!prog`)) break; } catch {} await sleep(200); }
await sleep(300);
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'OK   ' : 'FAIL ') + name + (ok ? '' : '  ' + JSON.stringify(info))); if (!ok) fails++; };

await ev(`say = () => {}; prog = cleanProg(null); applySkins(); true`);
const r = await ev(`(async () => {
  startLevel('rex', 0); cooldown = 0;
  openPuzzle(L.gates[0]);
  const waitCls = $('puzzle').classList.contains('wait'), waiting = pzWaiting(), pe = getComputedStyle($('puzzle')).pointerEvents;
  await new Promise(r => setTimeout(r, PZ_WAIT + 150));
  return { waitCls, waiting, pe, after: !$('puzzle').classList.contains('wait') && !pzWaiting(), pe2: getComputedStyle($('puzzle')).pointerEvents };
})()`);
check('énigme ouverte : on attend un instant (pas de doigt, pas de touche)', r.waitCls && r.waiting && r.pe === 'none', r);
check('après l’attente : l’énigme se joue', r.after && r.pe2 !== 'none', r);
// Labyrinthe : une flèche gardée appuyée depuis le jeu ne bouge pas le bébé pendant l'attente
const m = await ev(`(async () => {
  closePuzzle(false); startLevel('rex', 0); cooldown = 0; prog.skills.logique.lvl = 5;
  lastType = null; const t = L.gates[0].type; L.gates[0].type = 'sequence';
  let tries = 0; do { closePuzzle(false); openPuzzle(L.gates[0]); } while (!pzKey && ++tries < 60);
  if (!pzKey) return { none: true };
  const before = pz.visual.innerHTML;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' })); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown' }));
  const same = pz.visual.innerHTML === before;
  await new Promise(r => setTimeout(r, PZ_WAIT + 150));
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' })); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowDown' }));
  return { same, moved: pz.visual.innerHTML !== before };
})()`);
check('labyrinthe : les flèches attendent, puis marchent', !m.none && m.same && m.moved, m);
check('aucune erreur JavaScript', errors.length === 0, errors);
console.log(fails ? `${fails} échec(s)` : 'Tous les tests passent');
ws.close(); chrome.kill();
process.exit(fails ? 1 : 0);
