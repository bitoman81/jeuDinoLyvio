// Test de la sauvegarde v2 dans Chrome headless, via le protocole DevTools.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
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

// 1. Reprise d'une sauvegarde v1
await load();
await wipe(`localStorage.clear(); localStorage.setItem('dino-explorateur-v1', JSON.stringify({ world: 'trike', diff: 'grand', sound: false, worlds: { rex: { unlocked: 2, eggs: [3, 1, 0, 0] } } }))`);
await load();
let p = await ev(`JSON.parse(JSON.stringify(prog))`);
check('v1 reprise : monde, niveau, son', p.world === 'trike' && p.diff === 'grand' && p.sound === false, p);
check('v1 reprise : œufs du T-Rex', p.worlds.rex.unlocked === 2 && JSON.stringify(p.worlds.rex.eggs) === '[3,1,0,0,0,0,0]', p.worlds.rex);
check('v1 reprise : pas de partie en cours', p.run === null && p.version === 2);
check('v1 laissée intacte', await ev(`!!localStorage.getItem('dino-explorateur-v1')`));
await ev(`save(); true`);
check('v2 écrite', await ev(`JSON.parse(localStorage.getItem('dino-explorateur-partie1')).version === 2`));

// 2. Pour chaque animal : pierre ouverte, objet ramassé, position, puis reprise
for (const w of ['rex', 'trike', 'ptero', 'plesio']) {
  await ev(`startLevel('${w}', 0); true`);
  await sleep(300);
  const before = await ev(`(() => {
    currentGate = L.gates[0]; state = 'puzzle'; closePuzzle(true);
    const f = L.items[0]; player.x = f.x - player.w / 2; player.y = f.y - player.h / 2;
    collectItems(player, 16);
    if (L.mode === 'platform') L.safe = { x: 300, y: 300 };
    if (L.mode === 'shmup') camX = 900;
    if (L.mode === 'topdown') { outer: for (let c = 0; c < L.cols; c++) for (let r = 0; r < 10; r++) if (L.grid[c][r] === 3) { L.grid[c][r] = 0; L.broken.push([c, r]); break outer; } }
    autosave();
    return { run: JSON.parse(localStorage.getItem('dino-explorateur-partie1')).run, fruit: fruitCount, px: Math.round(player.x), py: Math.round(player.y), broken: L.broken.slice() };
  })()`);
  const r = before.run;
  check(`${w} : partie enregistrée`, r && r.world === w && r.i === 0 && r.gates.includes(0) && r.taken.includes(0) && r.fruit === before.fruit, r);
  await ev(`showMenu(); true`);
  check(`${w} : bouton Continuer visible`, await ev(`!$('continueBtn').hidden && $('continueBtn').textContent.includes('Continuer')`));
  await load(); // comme si on fermait la page
  const after = await ev(`(() => { $('continueBtn').click(); return {
    world: L.world, i: L.i, open: L.gates.filter(g => g.open).map(g => g.k), eggsRun, fruit: fruitCount, hud: $('hudFruit').textContent,
    taken0: L.items[0].taken, px: Math.round(player.x), py: Math.round(player.y), cam: Math.round(camX), safe: L.safe || null,
    broken: L.mode === 'topdown' ? L.broken.slice() : [], cell: L.mode === 'topdown' && L.broken[0] ? L.grid[L.broken[0][0]][L.broken[0][1]] : null, state }; })()`);
  check(`${w} : pierre 1 ouverte après reprise`, JSON.stringify(after.open) === '[0]' && after.eggsRun === 1, after);
  check(`${w} : objets repris`, after.taken0 && after.fruit === before.fruit && after.hud === String(before.fruit), after);
  if (w === 'rex') check('rex : repart du sol sûr', after.px === 300 && after.py === 300, after);
  else if (w === 'ptero') check('ptero : caméra reprise', after.cam === 900 && after.px === r.x, after);
  else check(`${w} : position reprise`, after.px === before.px && after.py === before.py, { before, after });
  if (w === 'trike') check('trike : caillou cassé reste cassé', after.broken.length === 1 && after.cell === 0, after);
  await sleep(2500); // le jeu tourne après la reprise
  check(`${w} : le jeu tourne`, await ev(`state === 'play' || state === 'puzzle'`));
}

// 3. Sauvegarde périodique et en quittant la page
await ev(`startLevel('plesio', 1); true`);
await sleep(300);
await ev(`player.x += 96; lastAutosave = performance.now() - 11000; true`);
await sleep(400);
check('sauvegarde toutes les 10 s', await ev(`JSON.parse(localStorage.getItem('dino-explorateur-partie1')).run.x === Math.round(player.x)`));
await ev(`player.x += 48; window.dispatchEvent(new Event('pagehide')); true`);
check('sauvegarde en quittant la page', await ev(`JSON.parse(localStorage.getItem('dino-explorateur-partie1')).run.x === Math.round(player.x)`));

// 4. Fin de niveau
await ev(`levelDone(); true`);
const done = await ev(`(() => { const s = JSON.parse(localStorage.getItem('dino-explorateur-partie1')); return { run: s.run, eggs: s.worlds.plesio.eggs, un: s.worlds.plesio.unlocked }; })()`);
check('fin de niveau : partie effacée, œufs et niveau suivant', done.run === null && done.eggs[1] === 3 && done.un === 3, done);
await ev(`showMenu(); true`);
check('fin de niveau : plus de bouton Continuer', await ev(`$('continueBtn').hidden`));

// 5. Code de sauvegarde
await ev(`startLevel('rex', 1); true`);
await sleep(200);
await ev(`currentGate = L.gates[0]; state = 'puzzle'; closePuzzle(true); showMenu(); true`);
const code = await ev(`exportCode()`);
check('code : préfixe', code.startsWith('DINO2-'), code.slice(0, 20));
await wipe(`localStorage.clear()`);
await load();
check('appareil neuf : rien', await ev(`prog.run === null && prog.worlds.plesio.eggs[1] === 0`));
check('code invalide refusé', await ev(`importCode('DINO2-pasbon') === false && importCode('bonjour') === false`));
check('code accepté', await ev(`importCode(${JSON.stringify(code)})`));
const imp = await ev(`({ run: prog.run, eggs: prog.worlds.plesio.eggs, stored: !!localStorage.getItem('dino-explorateur-partie1') })`);
check('code : progression et partie en cours reprises', imp.run && imp.run.world === 'rex' && imp.run.i === 1 && imp.eggs[1] === 3 && imp.stored, imp);
// Formulaire de l'espace parents
await ev(`renderParents(); $('loadIn').value = 'nimportequoi'; $('loadForm').requestSubmit(); true`);
check("formulaire : message d'erreur", await ev(`$('loadErr').textContent.length > 0 && $('loadOk').hidden`));
await ev(`$('loadIn').value = ${JSON.stringify(code)}; $('loadForm').requestSubmit(); true`);
check('formulaire : chargé', await ev(`$('loadErr').textContent === '' && !$('loadOk').hidden && $('saveCode').value.startsWith('DINO2-')`));

check('aucune erreur JavaScript', errors.length === 0, errors);
console.log(fails ? `${fails} échec(s)` : 'Tous les tests passent');
ws.close(); chrome.kill();
process.exit(fails ? 1 : 0);
