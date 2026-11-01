// Étape 17 : résumé de la semaine pour les parents (progrès, blocages, énigmes les plus ratées).
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const page = pathToFileURL(process.argv[2]).href;
const port = 9341;
const prof = mkdtempSync(join(tmpdir(), 'dino-chrome-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--window-size=900,500', '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

let tabs;
// Chrome peut mettre longtemps à démarrer (machines de GitHub) : jusqu'à 60 s
for (let k = 0; k < 300 && !tabs; k++) { try { tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { await sleep(200); } }
if (!tabs) { console.log('FAIL Chrome ne répond pas'); console.log('1 échec(s)'); chrome.kill(); process.exit(1); }
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
const load = async () => {
  await send('Page.navigate', { url: page }); await sleep(300);
  for (let k = 0; k < 50; k++) { try { if (await ev(`typeof startLevel === 'function' && !!prog`)) break; } catch {} await sleep(200); }
  await sleep(300);
};
// En quittant la page, le jeu réenregistre : on le coupe avant d'effacer pour simuler un appareil vierge.
const wipe = js => ev(`save = () => {}; ${js}; true`);

let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'OK   ' : 'FAIL ') + name + (ok ? '' : '  ' + JSON.stringify(info))); if (!ok) fails++; };

import { writeFileSync } from 'node:fs';
await load();
await ev(`say = () => {}; true`);

// 1. Les énigmes sont notées par type : réussie (avec les erreurs) ou abandonnée.
await ev(`prog.stats = {}; startLevel('rex', 0); true`);
await ev(`openPuzzle({ type: 'clock' }); true`); await sleep(1000);
const t1 = await ev(`pzType`);
await ev(`pzErrs = 1; $('pzBack').click(); true`);
check('abandon noté', JSON.stringify(await ev(`statDay().types['${t1}']`)) === '[0,0,1,1]', await ev(`statDay().types`));
await ev(`openPuzzle({ type: 'clock' }); true`); await sleep(1000);
const t2 = await ev(`pzType`);
await ev(`pzErrs = 2; solved(); true`); await sleep(100);
const r2 = await ev(`statDay().types['${t2}']`);
check('réussite notée avec ses erreurs', t1 === t2 ? JSON.stringify(r2) === '[1,0,3,1]' : JSON.stringify(r2) === '[1,0,2,0]', [t1, t2, r2]);
await ev(`openPuzzle({ type: 'add' }); true`); await sleep(1000);
await ev(`pzErrs = 0; solved(); true`); await sleep(100);
check('du premier coup', await ev(`(() => { const r = statDay().types[lastType]; return r[0] >= 1 && r[1] >= 1; })()`));
check('énigme des parents : type « parents »', await ev(`(() => { custom.calcs = ['5x5']; const d = prog.diff; prog.diff = 'expert'; const r = Math.random; Math.random = () => .1; openPuzzle({ type: 'count' }); Math.random = r; prog.diff = d; custom.calcs = []; const t = pzType; $('pzBack').click(); return t === 'parents' && statDay().types.parents[3] === 1; })()`));
await sleep(1100);
check('le temps de jeu du jour est compté', await ev(`new Promise(ok => { state = 'play'; const a = statDay().sec || 0; setTimeout(() => ok((statDay().sec || 0) > a), 2300); })`));

// 2. Le résumé, avec de fausses données sur 14 jours.
await ev(`(() => { prog.stats = {}; const t = dayDate(today());
  const put = (n, k, r) => { const x = new Date(t); x.setDate(t.getDate() - n); const d = dayKey(x); (prog.stats[d] = prog.stats[d] || {})[k] = r; return prog.stats[d]; };
  // semaine d'avant : 10 énigmes
  put(10, 'add', [6, 4, 3, 3]); put(9, 'lettres', [4, 4, 0, 6]);
  // cette semaine : additions de 3 à 5, lettres de 6 à 4, multiplications presque parfaites, heure souvent abandonnée
  put(5, 'add', [5, 4, 1, 4]).types = { add: [5, 4, 1, 0], clock: [1, 0, 2, 2] };
  put(5, 'heure', [1, 0, 2, 1]);
  put(3, 'lettres', [4, 1, 6, 5]).types = { missing: [4, 1, 6, 1] };
  put(1, 'lettres', [2, 0, 5, 4]).types = { first: [2, 0, 5, 0] };
  Object.assign(put(1, 'mult', [6, 5, 1, 5]).types, { mult: [6, 5, 1, 0] });
  put(0, 'add', [3, 3, 0, 5]).types = { add: [3, 3, 0, 0] };
  prog.stats[dayKey(new Date(t.getTime() - 5 * 864e5))].sec = 1500;
  prog.stats[today()].sec = 1260;
  return true; })()`);
const W = JSON.parse((await ev(`JSON.stringify(weekLines())`)).replace(/\u00a0/g, ' '));
console.log(JSON.stringify(W, null, 1));
check('en-tête : jours, temps, énigmes, premier coup', /joué 4 jours sur 7, 46 min de jeu, 21 énigmes réussies, dont 62 % du premier coup\./.test(W.head[0]), W.head);
check('comparaison avec la semaine d’avant', W.head[1] === "C'est 11 de plus que la semaine d'avant (10).", W.head);
check('progrès : additions 3 → 5, multiplications du premier coup', W.good.includes('Additions : niveau 3 → 5') && W.good.some(t => t.startsWith('Multiplications : 83 %')), W.good);
check('blocage : lettres 6 → 4, heure abandonnée', W.bad.includes('Lettres : niveau 6 → 4') && W.bad.includes("Lire l'heure : abandonné 2 fois"), W.bad);
check('plus ratées : première lettre, heure, lettre qui manque', W.missed[0].startsWith('Première lettre : 2,5 erreurs') && W.missed[1].startsWith("Lire l'heure : ") && W.missed[1].includes('2 abandons') && W.missed.length === 3 && W.missed.every(t => !t.startsWith('Additions')), W.missed);
check('idée pour les parents', W.tip.includes('« Lettres »'), W.tip);
await ev(`renderParents(); $('parents').hidden = false; $('weekSum').scrollIntoView(); true`); await sleep(300);
check('affiché dans l’espace parents', await ev(`$('weekSum').querySelectorAll('.week-box').length === 3 && $('weekSum').textContent.replace(/\\u00a0/g, ' ').includes('Lettres : niveau 6 → 4')`));
await ev(`state = 'menu'; true`);
check('sauvegarde : types et temps gardés', await ev(`(() => { const d = today(); const b = JSON.stringify(prog.stats[d]); return importCode(exportCode()) && JSON.stringify(prog.stats[d]) === b && prog.stats[d].sec >= 1260; })()`));
check('sauvegarde : valeurs fausses rejetées', await ev(`(() => { const d = today(); prog.stats[d].types.add = [1, 'x', 0, 0]; prog.stats[d].types.zzz = [1, 1, 0, 0]; prog.stats[d].sec = -4; importCode(exportCode()); return !prog.stats[d].types && !prog.stats[d].sec && prog.stats[d].add[0] === 3; })()`));
const SD = process.env.SHOT_DIR;
if (SD) writeFileSync(SD + '/semaine.png', Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'));

// 3. Semaine vide et téléphone.
await ev(`prog.stats = {}; renderParents(); true`);
check('semaine vide', await ev(`weekLines().head[0].startsWith('Pas encore joué') && $('weekSum').textContent.includes('Rien ne bloque')`));
await ev(`(() => { const t = dayDate(today()); const x = new Date(t); x.setDate(t.getDate() - 2); prog.stats[dayKey(x)] = { add: [3, 1, 4, 2], types: { add: [3, 1, 4, 0] } }; renderParents(); return true; })()`);
await send('Emulation.setDeviceMetricsOverride', { width: 380, height: 800, deviceScaleFactor: 1, mobile: true }); await sleep(300);
await ev(`$('weekSum').scrollIntoView(); true`); await sleep(200);
if (SD) writeFileSync(SD + '/semaine-phone.png', Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'));
check('téléphone : pas de défilement horizontal', await ev(`$('parents').scrollWidth <= $('parents').clientWidth + 1`));

check('aucune erreur JavaScript', errors.length === 0, errors);
console.log(fails ? `${fails} échec(s)` : 'Tous les tests passent');
ws.close(); chrome.kill();
process.exit(fails ? 1 : 0);
