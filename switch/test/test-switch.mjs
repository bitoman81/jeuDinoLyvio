// Teste la version Switch (romfs/main.js) dans Chrome, en imitant nx.js :
// l'écran est un canvas de 1280 x 720 (`screen`), la manette est une fausse manette (navigator.getGamepads),
// et main.js est chargé comme un module, comme le fait nx.js. Usage : node test/test-switch.mjs
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(join(here, '..', 'romfs', 'main.js'), 'utf8');
const prof = mkdtempSync(join(tmpdir(), 'dino-nx-'));
const pagePath = join(prof, 'sim.html');
writeFileSync(pagePath, `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#000"><canvas id="scr" width="1280" height="720"></canvas>
<script>
window.screen = document.getElementById('scr');
window.__pad = { buttons: Array.from({ length: 16 }, () => ({ pressed: false })), axes: [0, 0, 0, 0] };
Object.defineProperty(navigator, 'getGamepads', { value: () => [window.__pad, null, null, null, null, null, null, null] });
// Fichiers de la carte SD (Switch.readFileSync / writeFileSync) ; le localStorage de nx.js ne doit jamais être touché
window.__files = {};
window.Switch = { readFileSync: f => f in __files ? new TextEncoder().encode(__files[f]).buffer : null, writeFileSync: (f, d) => { __files[f] = String(d); }, appendFileSync: (f, d) => { __files[f] = (__files[f] || '') + String(d); }, mkdirSync() {}, appletType: () => 0 };
Object.defineProperty(window, 'localStorage', { configurable: true, get() { __errors.push('localStorage de nx.js touché (choix du profil sans fin)'); return null; } });
delete window.speechSynthesis; delete Window.prototype.speechSynthesis;
window.__errors = []; addEventListener('error', e => __errors.push(e.message)); addEventListener('unhandledrejection', e => __errors.push(String(e.reason)));
</script></body>`);

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9337;
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
const game = expr => ev(`dinoEval(${JSON.stringify(expr)})`);
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'OK   ' : 'FAIL ') + name + (ok ? '' : '  ' + JSON.stringify(info))); if (!ok) fails++; };
const press = async (b, ms = 120) => { await ev(`__pad.buttons[${b}].pressed = true`); await sleep(ms); await ev(`__pad.buttons[${b}].pressed = false`); await sleep(80); };
const pixel = (x, y) => ev(`Array.from(screen.getContext('2d').getImageData(${x}, ${y}, 1, 1).data.slice(0, 3))`);
const shot = async name => { const s = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(prof, name), Buffer.from(s.result.data, 'base64')); return join(prof, name); };

await send('Runtime.enable'); await send('Page.enable');
await send('Page.navigate', { url: pathToFileURL(pagePath).href }); await sleep(500);
await ev(`(() => { const s = document.createElement('script'); s.type = 'module'; s.textContent = ${JSON.stringify(code)}; document.body.appendChild(s); return true; })()`);
await sleep(800);

// 1. Écran titre
check('main.js se charge sans erreur', await ev(`typeof dinoEval === 'function' && __errors.length === 0`), await ev(`__errors`));
check('écran titre dessiné', JSON.stringify(await pixel(20, 700)) === '[31,91,58]', await pixel(20, 700));
const title = await shot('switch-titre.png');

// 2. Menu : A ouvre le menu, la croix choisit l'animal, A valide, A lance l'endroit
await press(1);
check('A : le menu des dinos s’ouvre', await game(`SW.screen === 'menu' && SW.row === 0`), await game(`[SW.screen, SW.row]`));
await sleep(200);
const menuShot = await shot('switch-menu.png');
await press(15);
check('croix à droite : le Tricératops est choisi', await game(`swWorld() === 'trike'`), await game('swWorld()'));
await press(1);
check('A : on passe aux endroits du Tricératops', await game(`SW.row === 1 && SW.lvl === 0`), await game(`[SW.row, SW.lvl]`));
await press(15);
check('croix à droite sur un endroit fermé', await game(`SW.lvl === 1`));
await press(1);
check('A sur un endroit fermé : un message, pas de jeu', await game(`SW.screen === 'menu' && /Pas encore ouvert/.test(SW.toast)`), await game('SW.toast'));
await press(14); await press(1);
check('A : le Tricératops joue (vue du ciel)', await game(`state === 'play' && L.world === 'trike' && L.mode === 'topdown'`), await game(`[state, L && L.world, L && L.mode]`));
// Les 3 autres animaux bougent à la manette
for (const [wk, mode] of [['trike', 'topdown'], ['ptero', 'shmup'], ['plesio', 'swim']]) {
  if (wk !== 'trike') await game(`swStart('${wk}', 0); true`);
  await sleep(1700);
  const p0 = await game('[player.x, player.y]');
  await ev(`__pad.axes[1] = 1`); await sleep(500); await ev(`__pad.axes[1] = 0`); await sleep(50);
  const p1 = await game('[player.x, player.y]');
  check(`${wk} (${mode}) : le stick vers le bas le fait bouger`, (await game('L.mode')) === mode && Math.abs(p1[1] - p0[1]) > 20, [p0, p1]);
}
await shot('switch-plesio.png');
// − revient au menu, sur l'endroit en cours
await press(8);
check('− : retour au menu, sur l’endroit en cours', await game(`SW.screen === 'menu' && state === 'menu' && swWorld() === 'plesio' && SW.row === 1 && SW.lvl === 0`), await game(`[SW.screen, state, swWorld(), SW.row, SW.lvl]`));
// B remonte aux animaux, B encore revient au titre ; l'île secrète est fermée
await press(0);
check('B : retour aux animaux', await game(`SW.row === 0`));
await press(15); await press(1);
check('île secrète fermée : un message', await game(`swWorld() === 'final' && SW.row === 0 && /4 morceaux/.test(SW.toast)`), await game(`[swWorld(), SW.toast]`));
// Au doigt : toucher le T-Rex puis toucher son premier endroit
const rexCard = await game(`JSON.stringify(SW.hits[0])`);
const rc = JSON.parse(rexCard);
await game(`swTouch('pointerdown', { changedTouches: [{ identifier: 1, clientX: ${rc.x + 50}, clientY: ${rc.y + 50} }] }); true`); await sleep(100);
check('toucher le T-Rex : il est choisi', await game(`swWorld() === 'rex' && SW.row === 0`), await game('[swWorld(), SW.row]'));
await game(`swTouch('pointerdown', { changedTouches: [{ identifier: 1, clientX: ${rc.x + 50}, clientY: ${rc.y + 50} }] }); true`); await sleep(100);
const lv = JSON.parse(await game(`JSON.stringify(SW.hits[5])`));
await game(`swTouch('pointerdown', { changedTouches: [{ identifier: 1, clientX: ${lv.x + 20}, clientY: ${lv.y + 20} }] }); true`); await sleep(100);
await game(`swTouch('pointerdown', { changedTouches: [{ identifier: 1, clientX: ${lv.x + 20}, clientY: ${lv.y + 20} }] }); true`); await sleep(100);
check('au doigt : le premier endroit du T-Rex commence', await game(`state === 'play' && L.world === 'rex' && L.i === 0 && L.mode === 'platform'`), await game(`[state, L && L.world, L && L.i]`));
await sleep(300);
check('le niveau est dessiné (ciel en haut)', (await pixel(640, 200))[2] > 150, await pixel(640, 200));

// 3. Le stick fait marcher, A fait sauter
const x0 = await game('player.x');
await ev(`__pad.axes[0] = 1`); await sleep(500); await ev(`__pad.axes[0] = 0`); await sleep(50);
const x1 = await game('player.x');
check('stick à droite : le T-Rex avance', x1 > x0 + 60, [x0, x1]);
await game(`player.y = GROUND * T - player.h; player.vy = 0; true`); await sleep(100);
await ev(`__pad.buttons[1].pressed = true`); await sleep(100);
const vy = await game('player.vy'); await ev(`__pad.buttons[1].pressed = false`);
check('A : le T-Rex saute', vy < -5, vy);
await ev(`__pad.buttons[15].pressed = true`); await sleep(300); await ev(`__pad.buttons[15].pressed = false`);
check('croix à droite : il avance aussi', (await game('player.x')) > x1 + 30);
await shot('switch-jeu.png');

// 4. Un robot joue l'endroit : il avance et saute régulièrement ; les pierres s'ouvrent seules
await game(`player.x = 3 * T; player.y = GROUND * T - player.h; camX = 0; true`);
await ev(`__pad.axes[0] = 1; window.__bot = setInterval(() => { __pad.buttons[1].pressed = !__pad.buttons[1].pressed; }, 260)`);
let st = '';
for (let k = 0; k < 120 && st !== 'done'; k++) { await sleep(250); st = await game('state'); }
await ev(`clearInterval(__bot); __pad.axes[0] = 0; __pad.buttons[1].pressed = false`);
check('le robot finit la clairière : 3 œufs, écran Bravo', st === 'done' && await game('eggsRun === 3'), [st, await game('eggsRun'), await game('Math.round(player.x / T)')]);
await sleep(300);
const bravo = await shot('switch-bravo.png');
await press(1);
check('A : endroit suivant (la rivière)', await game(`state === 'play' && L.i === 1`), await game(`[state, L.i]`));
check('sauvegarde : la clairière est finie', await game(`prog.worlds.rex.eggs[0] === 3 && JSON.parse(localStorage.getItem(KEY)).worlds.rex.unlocked >= 2`));
check('sauvegarde écrite sur la carte SD', await ev(`JSON.parse(JSON.parse(__files['sdmc:/switch/dino-explorateur/sauvegarde.json'])[${JSON.stringify('dino-explorateur-v2')}] || 'null')?.worlds?.rex?.unlocked >= 2`), await ev(`Object.keys(__files)`));

// 5. Écran tactile : pouce gauche = joystick, moitié droite = saut
const tx0 = await game('player.x');
await game(`swTouch('pointerdown', { changedTouches: [{ identifier: 1, clientX: 200, clientY: 500 }] }); swTouch('pointermove', { changedTouches: [{ identifier: 1, clientX: 280, clientY: 500 }] }); true`);
await sleep(400);
const tx1 = await game('player.x');
await game(`swTouch('pointerup', { changedTouches: [{ identifier: 1, clientX: 280, clientY: 500 }] }); true`);
check('tactile : le joystick fait avancer', tx1 > tx0 + 40 && await game('stick.id === null'), [tx0, tx1]);
await game(`player.x = 2 * T; player.y = GROUND * T - player.h; player.vy = 0; true`); await sleep(80);
await game(`swTouch('pointerdown', { changedTouches: [{ identifier: 2, clientX: 1000, clientY: 400 }] }); true`); await sleep(60);
check('tactile : la moitié droite fait sauter', (await game('player.vy')) < -3, await game('player.vy'));

await ev(`__pad.buttons[6].pressed = true; __pad.buttons[7].pressed = true`); await sleep(150); await ev(`__pad.buttons[6].pressed = false; __pad.buttons[7].pressed = false`);
for (let k = 0; k < 30 && !(await ev(`Object.keys(__files).some(f => f.includes('dino-captures/'))`)); k++) await sleep(100);
check('ZL + ZR : capture PNG sur la carte SD', await ev(`Object.keys(__files).some(f => f.startsWith('sdmc:/switch/dino-captures/capture-') && f.endsWith('.png'))`), await ev(`Object.keys(__files)`));
check('journal sur la carte SD', await ev(`/main.js lanc/.test(__files['sdmc:/switch/dino-journal.txt']) && /jeu : image 60/.test(__files['sdmc:/switch/dino-journal.txt'])`), await ev(`__files['sdmc:/switch/dino-journal.txt']`));
check('aucune erreur JavaScript', errors.length === 0 && (await ev('__errors.length')) === 0, [errors, await ev('__errors')]);
console.log('Captures :', title, menuShot, bravo);
console.log(fails ? `${fails} échec(s)` : 'Tous les tests passent');
ws.close(); chrome.kill();
process.exit(fails ? 1 : 0);
