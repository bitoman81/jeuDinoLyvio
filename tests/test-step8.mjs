// Étape 8 : statistiques pour les parents (tableau par compétence et courbe du niveau).
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const page = pathToFileURL(process.argv[2]).href;
const port = 9333;
const prof = mkdtempSync(join(tmpdir(), 'dino-chrome-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--window-size=900,500', '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
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
// Fausses données : additions qui montent sur 30 jours, lettres qui descendent cette semaine, compter joué il y a longtemps.
await ev(`(() => { prog.stats = {}; const t = dayDate(today());
  const put = (n, k, r) => { const x = new Date(t); x.setDate(t.getDate() - n); const d = dayKey(x); (prog.stats[d] = prog.stats[d] || {})[k] = r; };
  for (let n = 28; n >= 0; n -= 2) put(n, 'add', [4, 3, 1, Math.min(10, 2 + Math.floor((28 - n) / 4))]);
  put(9, 'lettres', [5, 5, 0, 6]); put(3, 'lettres', [4, 1, 6, 5]); put(1, 'lettres', [2, 0, 5, 4]);
  put(20, 'count', [10, 8, 3, 3]);
  prog.skills.add.lvl = 9; prog.skills.lettres.lvl = 4; prog.skills.count.lvl = 3; return true; })()`);
await ev(`renderParents(); $('parents').hidden = false; true`);
await sleep(300);
const rows = await ev(`[...document.querySelectorAll('#statTable tbody tr')].map(tr => [...tr.children].map(td => td.textContent))`);
const row = name => rows.find(r => r[0] === name);
check('tableau : une ligne par compétence', rows.length === Object.keys(await ev(`SKILLS`)).length, rows.length);
const add = row('Additions');
check('additions : niveau, énigmes, % du premier coup, erreurs, dernière fois, monte', add[1] === '9' && add[2] === '60' && add[3] === '75 %' && add[4] === '0,3' && add[5] === "aujourd'hui" && add[6].includes('monte'), add);
const let_ = row('Lettres');
check('lettres : descend sur 7 jours, joué hier', let_[2] === '11' && let_[5] === 'hier' && let_[6].includes('descend'), let_);
const cnt = row('Compter');
check('compter : pas joué cette semaine, date affichée', cnt[6] === 'pas joué' && /^\d\d\/\d\d$/.test(cnt[5]), cnt);
const never = row('Multiplications');
check('jamais joué : tirets', never[2] === '0' && never[3] === '–' && never[5] === 'jamais', never);
const ser = await ev(`levelSeries('add', curveDays('7'))`);
check('courbe : un jour sans énigme garde le niveau d’avant', ser.length === 7 && ser.every(v => v !== null), ser);
check('courbe : avant la première énigme, pas de point', await ev(`levelSeries('lettres', curveDays('30')).slice(0, 10).every(v => v === null)`));
check('légende 30 jours : les 3 compétences jouées', await ev(`$('curveLegend').textContent`) === 'CompterAdditionsLettres', await ev(`$('curveLegend').textContent`));
await ev(`document.querySelector('#curveRange button').click(); true`); await sleep(200);
check('7 jours : compter reste à son niveau, même sans énigme', await ev(`$('curveLegend').textContent === 'CompterAdditionsLettres' && document.querySelector('#curveRange button').getAttribute('aria-pressed') === 'true'`));
await ev(`const s = $('curveSkill'); s.value = 'add'; s.dispatchEvent(new Event('change')); true`); await sleep(200);
check('une seule compétence', await ev(`$('curveLegend').textContent === 'Additions' && $('curve').getAttribute('aria-label').includes('Additions : niveau 9')`));
await ev(`curveRange = 'all'; curveSkill = 'all'; renderStats(); true`);
await sleep(200);
check('depuis le début : du premier jour joué à aujourd’hui (29 jours)', await ev(`curveDays('all').length === 29`));
check('la courbe est dessinée', await ev(`(() => { const c = $('curve'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] === 0xe5 && d[i + 1] === 0x48) n++; return n > 50; })()`));
const W = process.env.SHOT_DIR;
if (W) {
  await ev(`$('statTable').scrollIntoView(); true`); await sleep(200);
  writeFileSync(W + '/stats.png', Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'));
  await ev(`$('curve').scrollIntoView(); true`); await sleep(200);
  writeFileSync(W + '/curve.png', Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'));
}
await send('Emulation.setDeviceMetricsOverride', { width: 380, height: 800, deviceScaleFactor: 1, mobile: true }); await sleep(300);
await ev(`$('statTable').scrollIntoView(); true`); await sleep(200);
if (W) writeFileSync(W + '/stats-phone.png', Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'));
{
  check('téléphone : pas de défilement horizontal de la page', await ev(`$('parents').scrollWidth <= $('parents').clientWidth + 1`), await ev(`[$('parents').scrollWidth, $('parents').clientWidth]`));
}
check('code de sauvegarde : les statistiques passent', await ev(`(() => { const n = Object.keys(prog.stats).length; return importCode(exportCode()) && Object.keys(prog.stats).length === n && n > 10; })()`));

check('aucune erreur JavaScript', errors.length === 0, errors);
console.log(fails ? `${fails} échec(s)` : 'Tous les tests passent');
ws.close(); chrome.kill();
process.exit(fails ? 1 : 0);
