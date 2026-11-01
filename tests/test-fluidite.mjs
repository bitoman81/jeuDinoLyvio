// Fluidité : le décor fixe (plaine, tuiles du T-Rex et du plésiosaure) est dessiné une fois par morceaux
// (layers), puis recopié ; fruits, perles et ennemis hors de l'écran ne sont pas dessinés.
// On vérifie que l'image est la même qu'avant (dessin direct), qu'un caillou cassé disparaît bien,
// et que le dessin est plus rapide.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const page = pathToFileURL(process.argv[2]).href;
const port = 9353;
const prof = mkdtempSync(join(tmpdir(), 'dino-chrome-'));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, '--window-size=1280,720', '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
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
await send('Page.navigate', { url: page }); await sleep(300);
for (let k = 0; k < 50; k++) { try { if (await ev(`typeof startLevel === 'function' && !!prog`)) break; } catch {} await sleep(200); }
await sleep(300);
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'OK   ' : 'FAIL ') + name + (ok ? '' : '  ' + JSON.stringify(info))); if (!ok) fails++; };

await ev(`say = () => {}; prog = cleanProg(null); applySkins(); true`);
// Outils dans la page : une image de l'écran, et la part de pixels nettement différents entre deux images.
await ev(`window.shot = () => ctx.getImageData(0, 0, cv.width, cv.height).data;
// Un pixel compte comme différent s'il n'a aucun pareil à moins d'un pixel dans l'autre image (les bords
// peuvent bouger d'un demi-pixel : les morceaux sont recopiés au pixel près).
window.diff = (a, b) => {
  const W = cv.width, H = cv.height, near = (i, j) => Math.abs(a[i] - b[j]) + Math.abs(a[i + 1] - b[j + 1]) + Math.abs(a[i + 2] - b[j + 2]) <= 60;
  let n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (near(i, i)) continue;
    let ok = false;
    for (let dy = -1; dy <= 1 && !ok; dy++) for (let dx = -1; dx <= 1 && !ok; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < W && Y < H) ok = near(i, (Y * W + X) * 4); }
    if (!ok) n++;
  }
  return n / (W * H);
};
window.both = () => { L.noLayers = false; MODES[L.mode].render(); const a = shot(); L.noLayers = true; L.layers = null; MODES[L.mode].render(); const b = shot(); L.noLayers = false; return diff(a, b); };
true`);

// 1. Même image qu'avant, dans tous les endroits, au début, au milieu et à la fin
const same = await ev(`(() => {
  const out = [];
  for (const k of Object.keys(WORLDS)) WORLDS[k].forEach((d, i) => {
    startLevel(k, i);
    cooldown = 99999; parts = [];
    for (const f of [0, .5, 1]) { camX = Math.max(0, (L.cols * T - viewW) * f); out.push([k + i + '@' + f, +both().toFixed(4)]); }
  });
  return out;
})()`);
const worst = same.reduce((m, x) => x[1] > m[1] ? x : m, ['', 0]);
check(`${same.length / 3} endroits : même image qu'avant (moins de 1 % de pixels différents : fines rayures de la glace)`, same.length >= 90 && worst[1] < .01, { n: same.length, worst });
for (const [w, names] of [['trike', 'ground,trees'], ['rex', 'tiles'], ['plesio', 'tiles']])
  check(`${w} : les morceaux sont bien utilisés (${names})`, await ev(`startLevel('${w}', 0); MODES[L.mode].render(); !L.noLayers && L.layerR === dpr * scale && '${names}'.split(',').every(n => L.layers[n].filter(Boolean).length > 0)`));

// 2. Un caillou cassé disparaît du morceau déjà dessiné
const rock = await ev(`(() => {
  startLevel('trike', 0); cooldown = 99999; parts = [];
  let cell = null;
  for (let c = 0; c < L.cols && !cell; c++) for (let r = 1; r < 9; r++) if (L.grid[c][r] === 3) { cell = [c, r]; break; }
  if (!cell) return { none: true };
  const [c, r] = cell; camX = Math.max(0, c * T - viewW / 2);
  MODES.topdown.render(); const before = shot();
  L.grid[c][r] = 0; layerDirty(c);
  const rebuilt = !L.layers.ground[Math.floor(c / LAYER_COLS)] && !L.layers.trees[Math.floor(c / LAYER_COLS)];
  const d = both(); MODES.topdown.render(); const changed = diff(before, shot());
  return { cell, rebuilt, d, changed };
})()`);
check('caillou cassé : son morceau est refait et l’image suit', !rock.none && rock.rebuilt && rock.d < .005 && rock.changed > 0, rock);

// 3. Les morceaux sont refaits si l'écran change de taille
const rs = await ev(`(() => { startLevel('trike', 1); MODES.topdown.render(); const r0 = L.layerR; scale *= 1.25; MODES.topdown.render(); const r1 = L.layerR; scale /= 1.25; MODES.topdown.render(); return { r0, r1, back: L.layerR === r0 }; })()`);
check('nouvelle taille d’écran : morceaux refaits', rs.r1 !== rs.r0 && rs.back, rs);

// 4. Moins d'ordres de dessin par image : sur la Switch, c'est leur nombre qui coûte (environ 8 µs chacun)
await ev(`window.orders = () => {
  const P = CanvasRenderingContext2D.prototype, back = []; let n = 0;
  for (const k of Object.getOwnPropertyNames(P)) { const d = Object.getOwnPropertyDescriptor(P, k); if (typeof d.value === 'function' && k !== 'constructor') { P[k] = function (...a) { n++; return d.value.apply(this, a); }; back.push(() => P[k] = d.value); } }
  try { for (let k = 0; k < 10; k++) MODES[L.mode].render(); } finally { back.forEach(f => f()); }
  return Math.round(n / 10);
}; true`);
for (const w of ['trike', 'rex', 'plesio']) {
  const o = await ev(`(() => {
    startLevel('${w}', 0); cooldown = 99999; for (let s = 0; s < 200; s++) { keys.right = true; time += 1 / 60; MODES[L.mode].step(); } keys.right = false;
    L.noLayers = true; L.layers = null; const avant = orders(); L.noLayers = false; const après = orders();
    return { avant, après };
  })()`);
  check(`${w} : ordres de dessin par image ${o.avant} -> ${o.après} (moins de 1000, comme le ptéranodon fluide)`, o.après < 1000 && o.après < o.avant * .8, o);
}
// 5. Fruits, perles et ennemis loin de l'écran : rien n'est dessiné pour eux
const cull = await ev(`(() => {
  startLevel('rex', 0); camX = 0; let n = 0; const f0 = ctx.arc; ctx.arc = function (...a) { n++; return f0.apply(this, a); };
  const far = L.items.filter(f => f.x > viewW + 200).length;
  drawFruit(L.items.find(f => f.x > viewW + 200)); const after = n; delete ctx.arc;
  return { far, after };
})()`);
check('fruit loin de l’écran : pas dessiné', cull.far > 0 && cull.after === 0, cull);

// 6. Mémoire (Switch) : plus de dégradé créé à chaque image, et des morceaux de décor réutilisés
const mem = await ev(`(() => {
  const P = CanvasRenderingContext2D.prototype, O = OffscreenCanvasRenderingContext2D.prototype, back = [];
  let grads = 0, made = 0;
  for (const Q of [P, O]) for (const k of ['createLinearGradient', 'createRadialGradient']) { const f = Q[k]; Q[k] = function (...a) { grads++; return f.apply(this, a); }; back.push(() => Q[k] = f); }
  const OC = OffscreenCanvas; window.OffscreenCanvas = function (w, h) { made++; return new OC(w, h); };
  const perLevel = [];
  try {
    for (const k of Object.keys(WORLDS)) WORLDS[k].forEach((d, i) => {
      startLevel(k, i); cooldown = 99999;
      for (let f = 0; f < 3; f++) MODES[L.mode].render();      // premières images : les dégradés se créent
      grads = 0;
      for (let f = 0; f < 120; f++) { keys.right = true; time += 1 / 60; MODES[L.mode].step(); if (state !== 'play') state = 'play'; MODES[L.mode].render(); }
      keys.right = false;
      perLevel.push(grads);
    });
    // Deux tours de tous les endroits : au 2e tour, presque plus de morceau neuf
    const made1 = made;
    for (const k of Object.keys(WORLDS)) WORLDS[k].forEach((d, i) => { startLevel(k, i); for (let f = 0; f < 60; f++) { keys.right = true; time += 1 / 60; MODES[L.mode].step(); if (state !== 'play') state = 'play'; MODES[L.mode].render(); } keys.right = false; });
    return { maxGrads: Math.max(...perLevel), made1, made2: made - made1, pool: LAYER_POOL.length };
  } finally { back.forEach(f => f()); window.OffscreenCanvas = OC; }
})()`);
check(`dégradés : aucun créé pendant le jeu (120 images par endroit, au pire ${mem.maxGrads})`, mem.maxGrads === 0, mem);
check(`morceaux de décor réutilisés : ${mem.made1} créés au 1er tour, ${mem.made2} au 2e, réserve ${mem.pool}`, mem.made2 <= 4 && mem.pool <= 16, mem);
check('aucune erreur JavaScript', errors.length === 0, errors);
console.log(fails ? `${fails} échec(s)` : 'Tous les tests passent');
ws.close(); chrome.kill();
process.exit(fails ? 1 : 0);
