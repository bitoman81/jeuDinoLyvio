// Étape 7 (fin) : interrupteurs. Un bouton rouge ouvre une porte ; flèche et ouverture automatique pour ne pas bloquer l'enfant.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const page = pathToFileURL(process.argv[2]).href;
const port = 9334;
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
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'OK   ' : 'FAIL ') + name + (ok ? '' : '  ' + JSON.stringify(info))); if (!ok) fails++; };

await load();
await ev(`window.said = []; say = t => said.push(t); prog = cleanProg(null); applySkins(); true`);

// 1. Les endroits avec un interrupteur
const list = await ev(`Object.keys(WORLDS).flatMap(k => WORLDS[k].map((d, i) => [k, i, (d.switches || []).length]).filter(x => x[2]))`);
check('8 endroits ont un interrupteur, 2 par animal', list.length === 8 && ['rex', 'trike', 'ptero', 'plesio'].every(k => list.filter(x => x[0] === k).length === 2), list);
// Le bouton est avant la porte, et la porte du T-Rex est sur le sol.
const place = await ev(`(() => { const bad = []; for (const [k, i] of ${JSON.stringify(list)}) { startLevel(k, i); L.switches.forEach(s => { if (s.bx >= s.door.x) bad.push(k + i + ' bouton après la porte'); }); const d = WORLDS[k][i]; if (L.mode === 'platform') d.switches.forEach(([sc, sr, dc]) => { if (!d.ground.some(([a, b]) => dc >= a && dc < b)) bad.push(k + i + ' porte dans l’eau'); if (!isSolid(sc, sr)) bad.push(k + i + ' bouton dans le vide'); }); if (L.mode === 'topdown') L.switches.forEach(s => { const c = Math.floor(s.bx / T), r = Math.floor((s.by - 12) / T); if (L.grid[c][r]) bad.push(k + i + ' bouton sous un arbre'); }); } return bad; })()`);
check('boutons atteignables, portes bien placées', place.length === 0, place);

// 2. Chaque mode : la porte bloque, le bouton l'ouvre
for (const [k, i] of list.filter((_, n) => n % 2 === 0)) {
  await ev(`startLevel('${k}', ${i}); cooldown = 99999; L.gates.forEach(g => { g.open = true; g.anim = 1; }); true`);
  const r = await ev(`(() => {
    const s = L.switches[0], dr = s.door, p = player;
    // On pousse l'animal vers la porte.
    if (L.mode === 'shmup') { camX = dr.x - viewW * .78; }
    p.x = dr.x - p.w - 40; if (L.mode === 'platform') { p.y = GROUND * T - p.h; p.vy = 0; } else if (L.mode === 'topdown') p.y = (L.grid[Math.floor(dr.x / T)].findIndex((v, r) => r > 0 && !v)) * T + 7; else p.y = 200;
    keys.right = true; for (let f = 0; f < 90; f++) { time += 1 / 60; MODES[L.mode].step(); }
    const blocked = p.x + p.w <= dr.x + 1 && !dr.open, pointer = time - dr.near < 2;
    keys.right = false;
    p.x = s.zone.x + s.zone.w / 2 - p.w / 2; p.y = s.zone.y + s.zone.h - p.h; if (L.mode === 'topdown' || L.mode === 'shmup') p.y = s.zone.y + s.zone.h / 2 - p.h / 2;
    checkSwitches(p);
    const opened = s.on && dr.open;
    for (let f = 0; f < 40; f++) { time += 1 / 60; MODES[L.mode].step(); }
    p.x = dr.x - p.w - 20; if (L.mode === 'platform') { p.y = GROUND * T - p.h; p.vy = 0; }
    let far = p.x; keys.right = true; for (let f = 0; f < 60; f++) { time += 1 / 60; MODES[L.mode].step(); far = Math.max(far, p.x); } keys.right = false;
    MODES[L.mode].render();
    return { blocked, pointer, opened, past: far > dr.x + dr.w, said: said.some(t => t.includes('gros bouton rouge')) };
  })()`);
  check(`${k} : porte fermée qui bloque, flèche et consigne`, r.blocked && r.pointer && r.said, r);
  check(`${k} : le bouton ouvre la porte, on passe`, r.opened && r.past, r);
}

// 3. Aide gratuite : la porte s'ouvre toute seule au bout de 15 secondes
await ev(`startLevel('rex', 2); cooldown = 99999; true`);
const auto = await ev(`(() => { const dr = L.doors[0], p = player; p.x = dr.x - p.w; p.y = GROUND * T - p.h; keys.right = true; let f = 0; for (; f < 60 * 20 && !dr.open; f++) { time += 1 / 60; MODES.platform.step(); } keys.right = false; return { open: dr.open, sec: Math.round(f / 60), said: said.at(-1) }; })()`);
check('15 secondes devant la porte : elle s’ouvre toute seule', auto.open && auto.sec >= 14 && auto.sec <= 16 && auto.said.includes("Je t'aide"), auto);

// 4. Sauvegarde : le bouton reste appuyé à la reprise
await ev(`startLevel('plesio', 2); cooldown = 99999; pressSwitch(L.switches[0], 'ok'); autosave(); showMenu(); true`);
check('la partie en cours garde le bouton', await ev(`JSON.stringify(prog.run.sw) === '[0]'`));
await load(); await ev(`say = () => {}; true`);
await ev(`$('continueBtn').click(); true`);
check('reprise : la porte est ouverte', await ev(`L.world === 'plesio' && L.i === 2 && L.switches[0].on && L.doors[0].open && !nearRects({ x: L.doors[0].x, y: 200, w: 10, h: 10 }).includes(L.doors[0])`));
check('ancienne partie sans bouton : lue sans erreur', await ev(`cleanRun({ world: 'rex', i: 2, gates: [], taken: [] }).sw.length === 0`));

// 5. Tous les endroits se jouent encore
const run = await ev(`(() => { const out = []; for (const k of Object.keys(WORLDS)) WORLDS[k].forEach((d, i) => { startLevel(k, i); cooldown = 99999; for (let s = 0; s < 120; s++) { time += 1 / 60; MODES[L.mode].step(); if (state !== 'play') break; } MODES[L.mode].render(); out.push(k + i); }); return out.length; })()`);
check('les 32 endroits tournent', run === 32, run);

check('aucune erreur JavaScript', errors.length === 0, errors);
console.log(fails ? `${fails} échec(s)` : 'Tous les tests passent');
ws.close(); chrome.kill();
process.exit(fails ? 1 : 0);
