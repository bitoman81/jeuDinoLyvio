// Étape 12 : accessoires et nouveaux pouvoirs.
// Usage : node tests/test-boutique.mjs index.html [dossier des captures]
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const page = pathToFileURL(process.argv[2]).href;
const port = 9348;
const prof = mkdtempSync(join(tmpdir(), 'dino-chrome-'));
const out = process.argv[3] || prof;
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--window-size=1000,560', '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
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
  await ev(`say = () => {}; true`);
};
// En quittant la page, le jeu réenregistre : on le coupe avant d'effacer pour simuler un appareil vierge.
const wipe = js => ev(`save = () => {}; ${js}; true`);
const shot = async name => { const s = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(out, name), Buffer.from(s.result.data, 'base64')); return join(out, name); };

let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'OK   ' : 'FAIL ') + name + (ok ? '' : '  ' + JSON.stringify(info))); if (!ok) fails++; };

// 1. Accessoires : achetés une fois, portés par l'animal choisi, gardés dans la sauvegarde
await load();
await wipe(`localStorage.clear()`);
await load();
await ev(`slotNew(0, 'Test'); prog.world = 'rex'; prog.bag.n = 100; showMenu(); renderMenu(); true`);
check('boutique : 6 accessoires (avec « sans accessoire »)', await ev(`document.querySelectorAll('#shopAcc .it').length === 6 && !$('accTitle').hidden`));
await ev(`document.querySelectorAll('#shopAcc .it')[5].click(); true`);
check('couronne achetée (50) et mise au T-Rex', await ev(`prog.bag.n === 50 && prog.bag.accOwned.couronne && prog.bag.acc.rex === 'couronne' && SPECIES.rex.acc === 'couronne'`), await ev('[prog.bag.n, prog.bag.acc]'));
await ev(`prog.world = 'trike'; renderMenu(); document.querySelectorAll('#shopAcc .it')[5].click(); true`);
check('déjà achetée : le tricératops la met sans payer', await ev(`prog.bag.n === 50 && prog.bag.acc.trike === 'couronne'`), await ev('[prog.bag.n, prog.bag.acc]'));
await ev(`document.querySelectorAll('#shopAcc .it')[0].click(); true`);
check('« sans accessoire » : le tricératops l’enlève', await ev(`prog.bag.acc.trike === '' && SPECIES.trike.acc === ''`));
check('trop cher : bouton désactivé', await ev(`prog.bag.n = 5; renderMenu(); document.querySelectorAll('#shopAcc .it')[2].disabled`));
await ev(`prog.bag.n = 200; ['fleur', 'casquette', 'lunettes', 'pirate'].forEach(id => prog.bag.accOwned[id] = true); prog.bag.acc = { rex: 'couronne', trike: 'casquette', ptero: 'pirate', plesio: 'lunettes' }; save(); true`);
await load();
check('sauvegarde : accessoires achetés et portés', await ev(`prog.bag.accOwned.pirate && prog.bag.acc.ptero === 'pirate' && SPECIES.plesio.acc === 'lunettes'`), await ev('prog.bag.acc'));
check('sauvegarde abîmée : accessoire inconnu ou pas acheté ignoré', await ev(`cleanProg({ bag: { accOwned: { chapeau: true, fleur: 'oui' }, acc: { rex: 'chapeau', trike: 'fleur' } } }).bag.acc.rex === '' && cleanProg({ bag: { accOwned: { fleur: true }, acc: { trike: 'fleur' } } }).bag.acc.trike === 'fleur'`));
// Image : les 4 animaux avec leur accessoire, en grand, et la boutique
await ev(`(() => { const cv = document.createElement('canvas'); cv.id = 'accShot'; cv.width = 960; cv.height = 300; cv.style.cssText = 'position:fixed;left:0;top:0;z-index:99;background:#fff7e6';
  const c = cv.getContext('2d'); ORDER.forEach((k, n) => drawDino(c, SPECIES[k], 120 + n * 240, 260, 1, 1, false, false, 3.6)); document.body.appendChild(cv); return true; })()`);
await sleep(200); await shot('accessoires.png');
await ev(`$('accShot').remove(); leaveParties(); prog.world = 'rex'; renderMenu(); $('shopAcc').scrollIntoView(); true`); await sleep(200);
await shot('boutique-accessoires.png');

// 2. Nouveaux pouvoirs : chacun ne sert qu'à son animal
await ev(`prog.bag.power = { magnet: 0, shield: 0, jump2: 1, charge: 1, triple: 1, fin: 1 }; startLevel('trike', 0); true`);
check('pouvoirs : au tricératops, seule la grande charge est prise', await ev(`L.charge && !L.jump2 && !L.triple && !L.fin && prog.bag.power.jump2 === 1 && prog.bag.power.charge === 0`), await ev('prog.bag.power'));
check('pouvoir affiché dans le haut de l’écran', await ev(`/Grande charge/.test($('hudPow').innerHTML)`));
check('grande charge : foncer dure plus longtemps', await ev(`(() => { jumpPressed = true; MODES.topdown.step(); return player.dash > 40; })()`));
await ev(`autosave(); true`);
check('partie en cours : le pouvoir est gardé', await ev(`prog.run.pows.join() === 'charge' && cleanRun(prog.run).pows.join() === 'charge'`), await ev('prog.run.pows'));
check('ancienne partie en cours : aimant et bouclier repris', await ev(`cleanRun({ ...prog.run, pows: undefined, magnet: true }).pows.join() === 'magnet'`));
// Double saut
await ev(`startLevel('rex', 0); true`);
const dbl = await ev(`(() => { const p = player; cooldown = 0; p.y = GROUND * T - 300; p.vy = 2; p.ground = false; p.coy = 0; jumpPressed = true; MODES.platform.step(); const v1 = p.vy; jumpPressed = true; MODES.platform.step(); return { L: !!L.jump2, v1, v2: p.vy }; })()`);
check('double saut : un saut en l’air, pas deux', dbl.L && dbl.v1 < -10 && dbl.v2 > dbl.v1, dbl);
// Graine triple
await ev(`startLevel('ptero', 0); true`);
const tri = await ev(`(() => { const n = L.shots.length; player.cool = 0; jumpPressed = true; MODES.shmup.step(); const s = L.shots.slice(n); return { L: !!L.triple, n: s.filter(x => x.vx > 8).length, vys: s.map(x => x.vy || 0) }; })()`);
check('graine triple : trois graines, une en haut et une en bas', tri.L && tri.n === 3 && tri.vys.some(v => v < 0) && tri.vys.some(v => v > 0), tri);
// Super nageoire
await ev(`startLevel('plesio', 0); true`);
check('super nageoire : nager vite dure plus longtemps', await ev(`(() => { jumpPressed = true; MODES.swim.step(); return !!L.fin && player.dash > 50; })()`));
check('tous les pouvoirs ont été utilisés une fois', await ev(`Object.values(prog.bag.power).every(v => v === 0)`), await ev('prog.bag.power'));

check('aucune erreur JavaScript', errors.length === 0, errors);
console.log('Captures :', out);
console.log(fails ? `${fails} échec(s)` : 'Tous les tests passent');
ws.close(); chrome.kill();
process.exit(fails ? 1 : 0);

