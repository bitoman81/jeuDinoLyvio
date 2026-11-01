// Énigmes de mots : le mot est dit avec l'image, et redit après chaque erreur (pour les petits).
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const page = pathToFileURL(process.argv[2]).href;
const port = 9358;
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

await ev(`window.said = []; say = t => said.push(t); prog = cleanProg(null); applySkins(); startLevel('rex', 0); state = 'puzzle'; true`);
const r = await ev(`(() => {
  const out = {};
  // Mot caché avec image : le mot est dit
  said.length = 0; PUZZLES.hangman('GIRAFE'); out.hangSay = said[0];
  const bad = [...pz.choices.querySelectorAll('button')].find(b => !'GIRAFE'.includes(b.textContent));
  said.length = 0; bad.onclick(); out.hangOops = said[0];
  // Première lettre et lettre qui manque : erreur -> le mot
  for (const t of ['first', 'missing']) {
    said.length = 0; pzLocked = false; PUZZLES[t]('BANANE');
    const b = [...pz.choices.querySelectorAll('button')].find(x => !pzHelp.good.includes(x));
    said.length = 0; b.onclick(); out[t] = said[0];
  }
  // Lettres dans l'ordre : erreur -> le mot
  said.length = 0; pzLocked = false; PUZZLES.order('LAPIN');
  const wrong = [...pz.choices.querySelectorAll('button')].find(x => x.textContent !== 'L');
  said.length = 0; wrong.onclick(); out.order = said[0];
  // Lettre offerte après 2 erreurs : le mot aussi
  said.length = 0; pzLocked = false; PUZZLES.hangman('CHAT');
  const bads = [...pz.choices.querySelectorAll('button')].filter(b => !'CHAT'.includes(b.textContent));
  said.length = 0; bads[0].onclick(); bads[1].onclick(); out.given = said.find(t => /donne la lettre/.test(t));
  return out;
})()`);
check('mot caché : « Écris le mot girafe » avec l’image', /Écris le mot girafe\. Regarde bien l'image/.test(r.hangSay), r.hangSay);
check('mot caché, erreur : le mot est redit', /Le mot girafe\.$/.test(r.hangOops), r.hangOops);
check('première lettre, erreur : le mot est redit', /Le mot banane\.$/.test(r.first), r.first);
check('lettre qui manque, erreur : le mot est redit', /Le mot banane\.$/.test(r.missing), r.missing);
check('lettres dans l’ordre, erreur : le mot est redit', /Essaie une autre lettre\. Le mot lapin\.$/.test(r.order), r.order);
check('lettre offerte : le mot aussi', /Je te donne la lettre .*\. Le mot chat\.$/.test(r.given || ''), r.given);
check('aucune erreur JavaScript', errors.length === 0, errors);
console.log(fails ? `${fails} échec(s)` : 'Tous les tests passent');
ws.close(); chrome.kill();
process.exit(fails ? 1 : 0);
