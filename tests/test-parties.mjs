// Étape 10 : les parties (3 au plus, avec un nom et un résumé), remise à zéro des statistiques.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const page = pathToFileURL(process.argv[2]).href;
const port = 9344;
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


// 1. Une ancienne sauvegarde devient la partie 1 ; au lancement, l'écran des parties s'affiche
await load();
await wipe(`localStorage.clear(); localStorage.setItem('dino-explorateur-v2', JSON.stringify({ version: 2, world: 'trike', worlds: { rex: { unlocked: 2, eggs: [3, 1, 0, 0] } }, bag: { n: 17 }, time: 3725 }))`);
await load();
check('ancienne sauvegarde : partie 1', await ev(`slots.names[0] === 'Partie 1' && slots.cur === 0 && prog.bag.n === 17 && prog.time === 3725`), await ev('[slots, prog.bag.n, prog.time]'));
check('ancienne sauvegarde laissée intacte', await ev(`!!localStorage.getItem('dino-explorateur-v2')`));
check('au lancement : écran des parties', await ev(`!$('parties').hidden && $('menu').hidden && document.querySelectorAll('#slotList .slot').length === 3`));
const sum = await ev(`slotSummary(0)`);
check('résumé : temps, œufs, trésors, animal', sum.time === '1 h 02' && sum.eggs === 4 && sum.treasures === 17 && sum.animal === 'Tricératops' && /\d\d\/\d\d\/\d{4}/.test(sum.date || '01/01/2026'), sum);
check('résumé affiché', await ev(`/Temps de jeu : 1 h 02/.test($('slotList').textContent) && /Trésors : 17/.test($('slotList').textContent)`));

// 2. Nouvelle partie dans la place 2 : un nom, une partie vierge
await ev(`document.querySelectorAll('#slotList .slot')[1].querySelector('button').click(); true`);
await ev(`const i = document.querySelector('#slotList input'); i.value = 'Lyvio'; i.form.requestSubmit(); true`);
check('nouvelle partie : nommée, vierge, menu ouvert', await ev(`slots.cur === 1 && slots.names[1] === 'Lyvio' && prog.bag.n === 0 && prog.time === 0 && !$('menu').hidden && $('parties').hidden`), await ev('[slots, prog.bag.n]'));
check('la partie 1 est gardée', await ev(`JSON.parse(localStorage.getItem('dino-explorateur-partie1')).bag.n === 17`));
// Le temps de jeu compte dans un endroit
await ev(`startLevel('rex', 0); true`); await sleep(2300);
check('temps de jeu compté en jouant', await ev(`prog.time >= 2`), await ev('prog.time'));
await ev(`prog.bag.n = 5; showMenu(); true`);

// 3. Changer de partie : on retrouve chacune ; le son reste celui de l'appareil
await ev(`prog.sound = false; $('partiesBtn').click(); true`);
check('« Changer de partie » : écran des parties', await ev(`!$('parties').hidden`));
await ev(`document.querySelectorAll('#slotList .slot')[0].querySelector('.btn.primary').click(); true`);
check('partie 1 reprise, son de l’appareil gardé', await ev(`slots.cur === 0 && prog.bag.n === 17 && prog.sound === false`), await ev('[slots.cur, prog.bag.n, prog.sound]'));
check('partie de Lyvio enregistrée', await ev(`JSON.parse(localStorage.getItem('dino-explorateur-partie2')).bag.n === 5`));

// 4. Effacer : on demande d'abord, puis la place redevient libre
await ev(`showParties(); document.querySelectorAll('#slotList .slot')[1].querySelector('.ghost').click(); true`);
check('effacer : confirmation demandée', await ev(`/Effacer la partie de Lyvio/.test($('slotList').textContent) && slots.names[1] === 'Lyvio'`));
await ev(`[...document.querySelectorAll('#slotList .slot')[1].querySelectorAll('button')].find(b => b.textContent === 'Oui, effacer').click(); true`);
check('effacer : place libre', await ev(`slots.names[1] === '' && !localStorage.getItem('dino-explorateur-partie2') && slots.cur === 0`), await ev('slots'));
// Effacer la partie en cours : on passe à une autre partie, ou à une partie vierge
await ev(`slotNew(2, 'Zoé'); slotErase(2); true`);
check('effacer la partie en cours : retour à une autre partie', await ev(`slots.cur === 0 && prog.bag.n === 17`), await ev('[slots, prog.bag.n]'));
await ev(`slotErase(0); true`);
check('tout effacé : partie vierge, nommée à la première sauvegarde', await ev(`prog.bag.n === 0 && slots.names.every(n => !n)`) && await ev(`save(), slots.names[slots.cur] === 'Partie ' + (slots.cur + 1)`));

// 5. Remise à zéro des statistiques (espace parents), avec confirmation
await ev(`slotNew(0, 'Test'); prog.bag.n = 9; prog.worlds.rex.eggs[0] = 3; prog.stats = { '2026-10-30': { add: [5, 3, 2, 6] } }; prog.skills.add.lvl = 6; save(); renderParents(); true`);
await ev(`$('resetStats').click(); true`);
check('remise à zéro : confirmation demandée', await ev(`Object.keys(prog.stats).length === 1 && /Oui/.test($('resetStats').textContent)`));
await ev(`$('resetStats').click(); true`);
check('remise à zéro : statistiques et niveaux effacés, œufs et sac gardés', await ev(`Object.keys(prog.stats).length === 0 && prog.skills.add.lvl === SKILL_START[prog.diff] && prog.bag.n === 9 && prog.worlds.rex.eggs[0] === 3 && !$('resetOk').hidden`), await ev('[prog.stats, prog.skills.add.lvl]'));

check('aucune erreur JavaScript', errors.length === 0, errors);
console.log(fails ? `${fails} échec(s)` : 'Tous les tests passent');
ws.close(); chrome.kill();
process.exit(fails ? 1 : 0);
