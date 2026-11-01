// Étape 11 : ennemis, difficulté des endroits (Simple, Normal, Compliqué) et médailles.
// Usage : node tests/test-ennemis.mjs index.html [dossier des captures]
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const page = pathToFileURL(process.argv[2]).href;
const port = 9346;
const prof = mkdtempSync(join(tmpdir(), 'dino-chrome-'));
const out = process.argv[3] || prof;
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--window-size=1000,560', '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
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
  await ev(`say = () => {}; true`);
};
// En quittant la page, le jeu réenregistre : on le coupe avant d'effacer pour simuler un appareil vierge.
const wipe = js => ev(`save = () => {}; ${js}; true`);
const shot = async name => { const s = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(out, name), Buffer.from(s.result.data, 'base64')); return join(out, name); };

let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'OK   ' : 'FAIL ') + name + (ok ? '' : '  ' + JSON.stringify(info))); if (!ok) fails++; };
const HARD_NAMES = ['Simple', 'Normal', 'Compliqué'];

// 1. Une ancienne sauvegarde : un endroit fini compte comme une médaille de bronze
await load();
await wipe(`localStorage.clear(); localStorage.setItem('dino-explorateur-v2', JSON.stringify({ version: 2, worlds: { rex: { unlocked: 2, eggs: [3, 1, 0, 0] } } }))`);
await load();
check('ancienne sauvegarde : bronze pour un endroit fini', await ev(`JSON.stringify(prog.worlds.rex.medals.slice(0, 3)) === '[1,0,0]' && prog.hard === 0`), await ev('prog.worlds.rex.medals'));
check('Normal ouvert après le bronze, Compliqué fermé', await ev(`hardOpen('rex', 0, 1) && !hardOpen('rex', 0, 2) && !hardOpen('rex', 1, 1)`));
await ev(`prog.hard = 2; true`);
check('Compliqué choisi : se joue en Normal (bronze) ou en Simple', await ev(`hardFor('rex', 0) === 1 && hardFor('rex', 1) === 0`));

// 2. Chaque animal a ses ennemis, plus nombreux et plus rapides selon la difficulté
for (const [w, i, kind] of [['rex', 1, 'raptor'], ['trike', 1, 'snake'], ['ptero', 1, 'bug'], ['plesio', 1, 'fish']]) {
  const counts = [];
  for (let h = 0; h < 3; h++) {
    const r = await ev(`(() => { prog.worlds['${w}'].medals[${i}] = 2; prog.worlds['${w}'].unlocked = 7; prog.hard = ${h}; startLevel('${w}', ${i}); return { hard: L.hard, n: L.foes.length, kinds: [...new Set(L.foes.map(f => f.kind))], sp: L.foes[0] ? L.foes[0].sp : 0 }; })()`);
    counts.push(r.n);
    check(`${w} ${HARD_NAMES[h]} : ennemis « ${kind} »`, r.hard === h && r.n > 0 && r.kinds.length === 1 && r.kinds[0] === kind, r);
  }
  check(`${w} : plus d'ennemis en Compliqué qu'en Simple`, counts[2] > counts[0], counts);
  // Capture avec un ennemi à l'écran
  await ev(`(() => { prog.hard = 1; startLevel('${w}', ${i}); const f = L.foes[0]; if ('${w}' === 'ptero') { f.x = camX + 500; f.y0 = 220; } else { player.x = f.x - 160; if ('${w}' !== 'rex') player.y = f.y - 4; } return true; })()`);
  await sleep(500); await shot(`ennemis-${w}.png`);
}

// 3. Battre un ennemi : sauter sur la tête du vélociraptor
await ev(`prog.hard = 1; startLevel('rex', 1); true`);
const stomp = await ev(`(() => { const f = L.foes[0], p = player, n = L.items.length; f.sp = 0; p.x = f.x + 3; p.y = f.y - p.h - 2; p.vy = 6; p.ground = false; stepFoes(p); p.y += 4; stepFoes(p); return { gone: !!f.gone, vy: p.vy, item: L.items.length === n + 1 }; })()`);
check('T-Rex : sauter sur la tête bat le vélociraptor et laisse un fruit', stomp.gone && stomp.vy < 0 && stomp.item, stomp);
// Toucher de côté en Normal : repoussé, 2 fruits perdus
const side = await ev(`(() => { const f = L.foes.find(f => !f.gone) || L.foes[0]; f.gone = 0; const p = player; fruitCount = 5; prog.bag.n = 20; p.hurt = 0; p.x = f.x; p.y = f.y; p.vy = 0; stepFoes(p); return { fruit: fruitCount, bag: prog.bag.n, hurt: p.hurt }; })()`);
check('Normal : touché, 2 fruits perdus (et dans le sac)', side.fruit === 3 && side.bag === 18 && side.hurt > 0, side);
const again = await ev(`(() => { const f = L.foes.find(f => !f.gone); const p = player; p.x = f.x; p.y = f.y; stepFoes(p); return fruitCount; })()`);
check('juste après, on ne perd rien de plus (clignote)', again === 3, again);
// Compliqué : 5 fruits perdus et retour au dernier œuf libéré
await ev(`prog.worlds.rex.medals[1] = 2; prog.hard = 2; startLevel('rex', 1); true`);
const back = await ev(`(() => { const g = L.gates[0]; g.open = true; const f = L.foes[L.foes.length - 1], p = player; fruitCount = 3; p.hurt = 0; p.x = f.x; p.y = f.y; stepFoes(p); return { fruit: fruitCount, x: Math.round(p.x), gx: Math.round(g.x - 60), hard: L.hard }; })()`);
check('Compliqué : fruits perdus (jamais moins de 0), retour au dernier œuf', back.hard === 2 && back.fruit === 0 && back.x === back.gx, back);
// Bouclier : rien
const shield = await ev(`(() => { L.shield = true; const f = L.foes[0], p = player; fruitCount = 4; p.hurt = 0; p.x = f.x; p.y = f.y; f.gone = 0; stepFoes(p); L.shield = false; return fruitCount; })()`);
check('bouclier : les ennemis ne font rien', shield === 4, shield);

// 4. Les autres animaux battent leurs ennemis avec l'action
await ev(`prog.hard = 1; startLevel('trike', 1); true`);
check('tricératops : foncer bat le serpent', await ev(`(() => { const f = L.foes[0], p = player; p.dash = 10; p.x = f.x; p.y = f.y; stepFoes(p); return !!f.gone; })()`));
await ev(`startLevel('plesio', 1); true`);
check('plésiosaure : nager vite fait fuir le poisson', await ev(`(() => { const f = L.foes[0], p = player; p.dash = 10; p.x = f.x; p.y = f.y; stepFoes(p); return !!f.gone; })()`));
check('plésiosaure : sans nager vite, il repousse', await ev(`(() => { const f = L.foes[1] || L.foes[0]; f.gone = 0; const p = player; p.dash = 0; p.hurt = 0; p.x = f.x; p.y = f.y; stepFoes(p); return p.hurt > 0; })()`));
await ev(`startLevel('ptero', 1); true`);
check('ptérodactyle : une graine bat la libellule', await ev(`(() => { const f = L.foes[0]; f.x = camX + 400; f.y0 = 200; stepFoes(player); L.shots.push({ x: f.x + 10, y: f.y + 10, vx: 0, hit: false }); stepFoes(player); return !!f.gone; })()`));

// 5. Fin d'un endroit : médaille de la difficulté jouée, la suivante s'ouvre
await ev(`prog.worlds.trike.medals[2] = 0; prog.worlds.trike.unlocked = 7; prog.hard = 0; startLevel('trike', 2); true`);
await ev(`levelDone(); true`);
check('fin en Simple : médaille de bronze, Normal ouvert', await ev(`prog.worlds.trike.medals[2] === 1 && hardOpen('trike', 2, 1) && /Médaille de bronze/.test($('doneText').textContent)`), await ev(`$('doneText').textContent`));
await ev(`prog.hard = 1; startLevel('trike', 2); levelDone(); true`);
check('fin en Normal : médaille d’argent', await ev(`prog.worlds.trike.medals[2] === 2 && /Médaille d'argent/.test($('doneText').textContent)`), await ev(`$('doneText').textContent`));
// Une partie reprise garde sa difficulté
await ev(`prog.hard = 2; startLevel('trike', 2); autosave(); true`);
check('partie en cours : difficulté enregistrée', await ev(`prog.run.hard === 2 && cleanRun(prog.run).hard === 2`));

// 6. Le menu : choisir la difficulté, médailles sur les endroits
await ev(`showMenu(); prog.world = 'trike'; prog.hard = 0; renderMenu(); true`);
await ev(`$('hardSel').querySelectorAll('button')[2].click(); true`);
check('menu : Compliqué choisi et enregistré', await ev(`prog.hard === 2 && $('hardSel').querySelectorAll('button')[2].getAttribute('aria-pressed') === 'true' && /5 fruits/.test($('hardText').textContent)`));
check('menu : médailles et « se joue en » sur les endroits', await ev(`$('levels').querySelectorAll('.lvl')[2].querySelectorAll('.medal:not(.off)').length === 2 && /Se joue en Simple/.test($('levels').querySelectorAll('.lvl')[0].textContent)`), await ev(`$('levels').querySelectorAll('.lvl')[0].textContent`));
await ev(`document.querySelector('#hardSel').scrollIntoView(); true`); await sleep(200);
await shot('ennemis-menu.png');

check('aucune erreur JavaScript', errors.length === 0, errors);
console.log('Captures :', out);
console.log(fails ? `${fails} échec(s)` : 'Tous les tests passent');
ws.close(); chrome.kill();
process.exit(fails ? 1 : 0);
