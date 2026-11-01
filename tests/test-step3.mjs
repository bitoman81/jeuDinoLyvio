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

await send('Emulation.setDeviceMetricsOverride', { width: 740, height: 360, deviceScaleFactor: 1, mobile: true });
await load();
await ev(`say = () => {}; setTouchUI(true); true`);
const ptr = (type, x, y, id) => ev(`cv.dispatchEvent(new PointerEvent('${type}', { clientX: ${x}, clientY: ${y}, pointerId: ${id}, bubbles: true, pointerType: 'touch' })); true`);
const steps = n => ev(`(() => { for (let i = 0; i < ${n}; i++) { time += 1 / 60; if (cooldown > 0) cooldown--; MODES[L.mode].step(); } return true; })()`);
const vis = id => ev(`getComputedStyle($('${id}')).display !== 'none'`);

// Affichage
check('menu : choix des commandes visible en mode tactile', await ev(`getComputedStyle(document.querySelector('.touch-only')).display !== 'none'`));
await ev(`startLevel('rex', 0); cooldown = 9999; true`);
check('T-Rex : joystick et bouton affichés', await vis('stick') && await vis('act'));
check('bouton : Saute', await ev(`$('act').textContent === 'Saute' && $('act').getAttribute('aria-label') === 'Sauter'`));
let home = await ev(`[parseFloat($('stick').style.left), parseFloat($('stick').style.top)]`);
check('joystick au repos en bas à gauche', home[0] < 120 && home[1] > 240, home);

// T-Rex : le joystick fait avancer, la moitié droite fait sauter
await ev(`player.x = 300; L.safe = { x: 300, y: player.y }; true`);
await steps(30);
let x0 = await ev(`player.x`);
await ptr('pointerdown', 120, 280, 1);
check('joystick sous le pouce', await ev(`$('stick').classList.contains('on') && parseFloat($('stick').style.left) === 120`));
await ptr('pointermove', 170, 280, 1);
check('bouton du joystick suit le pouce', await ev(`$('stickKnob').style.transform.includes('50px')`), await ev(`$('stickKnob').style.transform`));
await steps(20);
let x1 = await ev(`player.x`);
check('T-Rex avance vers la droite', x1 > x0 + 50, { x0, x1 });
// (au sol : après avoir avancé, il peut être en l'air et ne pas pouvoir sauter)
// Tout dans le même appel : sinon la vraie boucle du jeu peut jouer une image entre deux (le T-Rex tombe ou retombe).
const jump = await ev(`(() => { player.x = 5 * T; player.y = GROUND * T - player.h; player.vy = 0; player.ground = true; player.coy = 8;
  cv.dispatchEvent(new PointerEvent('pointerdown', { clientX: 600, clientY: 200, pointerId: 2, bubbles: true, pointerType: 'touch' }));
  time += 1 / 60; MODES[L.mode].step(); return player.vy; })()`);
check('moitié droite : le T-Rex saute', jump < 0, jump);
await ptr('pointerup', 170, 280, 1);
check('pouce levé : joystick revient au repos', await ev(`stick.id === null && !$('stick').classList.contains('on') && parseFloat($('stick').style.left) < 120`));
await steps(60);
x0 = await ev(`player.x`); await steps(20);
check('T-Rex s’arrête', Math.abs((await ev(`player.x`)) - x0) < 1);
await ptr('pointerdown', 120, 280, 3); await ptr('pointermove', 125, 282, 3); await steps(10);
check('petit mouvement du pouce ignoré', await ev(`player.vx === 0`));
await ptr('pointerup', 125, 282, 3);
check('caméra : T-Rex au milieu', await ev(`camLead() === .45`));

// Tricératops : il fonce
await ev(`startLevel('trike', 0); cooldown = 9999; true`);
check('bouton : Fonce', await ev(`$('act').textContent === 'Fonce'`));
await ev(`player.ang = 0; true`);
x0 = await ev(`player.x`);
await ptr('pointerdown', 120, 280, 4); await ptr('pointermove', 172, 280, 4);
await steps(10); x1 = await ev(`player.x`);
await ptr('pointerup', 172, 280, 4);
const walk = x1 - x0;
await ev(`$('act').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 5 })); $('act').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 5 })); true`);
x0 = await ev(`player.x`); await steps(10); x1 = await ev(`player.x`);
check('bouton Fonce : plus vite, tout droit sans joystick', walk > 20 && x1 - x0 > walk * 1.4, { walk, dash: x1 - x0 });
check('Flèche du haut : ne fonce pas', await ev(`(() => { player.dash = 0; window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowUp' })); const j = jumpPressed; window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowUp' })); return !j; })()`));
check('Espace : fonce', await ev(`(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })); MODES[L.mode].step(); return player.dash > 0; })()`));

// Ptérodactyle
await ev(`startLevel('ptero', 0); cooldown = 9999; true`);
check('bouton : Graine', await ev(`$('act').textContent === 'Graine'`));
await steps(5);
const shots = await ev(`(() => { player.fire = 99; const n = L.shots.length; jumpPressed = true; MODES.shmup.step(); const a = L.shots.length; jumpPressed = true; MODES.shmup.step(); return [n, a, L.shots.length]; })()`);
check('une graine de plus, avec un petit délai', shots[1] === shots[0] + 1 && shots[2] === shots[1], shots);
await ev(`player.x = camX; MODES.shmup.step(); true`);
check('ptérodactyle loin du bord gauche', await ev(`player.x - camX >= Math.min(viewW * .18, 120) - 5`), await ev(`[player.x - camX, viewW]`));

// Plésiosaure
await ev(`startLevel('plesio', 0); cooldown = 9999; true`);
check('bouton : Vite', await ev(`$('act').textContent === 'Vite'`));
x0 = await ev(`player.x`); await ptr('pointerdown', 120, 200, 6); await ptr('pointermove', 172, 200, 6); await steps(20); x1 = await ev(`player.x`); await ptr('pointerup', 172, 200, 6);
const swim = x1 - x0;
await steps(40);
await ev(`jumpPressed = true; true`); await ptr('pointerdown', 120, 200, 7); await ptr('pointermove', 172, 200, 7);
x0 = await ev(`player.x`); await steps(20); x1 = await ev(`player.x`); await ptr('pointerup', 172, 200, 7);
check('bouton Vite : nage plus vite', x1 - x0 > swim * 1.3, { swim, dash: x1 - x0 });

// Mode « toucher l'écran »
await ev(`showMenu(); $('touchTap').click(); true`);
check('choix enregistré', await ev(`prog.touch === 'tap' && JSON.parse(localStorage.getItem('dino-explorateur-partie1')).touch === 'tap'`));
await ev(`startLevel('trike', 0); cooldown = 9999; true`);
check('tricératops en mode toucher : pas de joystick', !(await vis('stick')) && await vis('act'));
await ptr('pointerdown', 600, 200, 8);
check('toucher l’écran : l’animal va vers le doigt', await ev(`pointer !== null && stick.id === null && !jumpPressed`));
await ptr('pointerup', 600, 200, 8);
await ev(`startLevel('rex', 0); true`);
check('T-Rex garde le joystick en mode toucher', await vis('stick'));
await ev(`showMenu(); $('touchStick').click(); true`);
check('code de sauvegarde sans le choix des commandes', await ev(`!('touch' in JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(exportCode().slice(6)), c => c.charCodeAt(0)))))`));

// Ordinateur
await ev(`setTouchUI(false); startLevel('rex', 0); true`);
check('ordinateur : pas de joystick ni de bouton', !(await vis('stick')) && !(await vis('act')));
check('ordinateur : caméra comme avant', await ev(`camLead() === .38`));
await ev(`startLevel('trike', 0); cooldown = 9999; true`);
await ptr('pointerdown', 600, 200, 9);
check('ordinateur : clic = aller là', await ev(`pointer !== null && stick.id === null`));
await ptr('pointerup', 600, 200, 9);
check('menu : choix des commandes caché', await ev(`showMenu(), getComputedStyle(document.querySelector('.touch-only')).display === 'none'`));

check('aucune erreur JavaScript', errors.length === 0, errors);
console.log(fails ? `${fails} échec(s)` : 'Tous les tests passent');
ws.close(); chrome.kill();
process.exit(fails ? 1 : 0);
