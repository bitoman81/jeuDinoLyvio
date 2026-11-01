// Étape 14 : le gardien du nid (boss) à la fin de chaque animal.
// Usage : node tests/test-boss.mjs index.html [dossier des captures]
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const page = pathToFileURL(process.argv[2]).href;
const port = 9351;
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

await load();
await wipe(`localStorage.clear()`);
await load();
await ev(`slotNew(0, 'Test'); leaveParties(); window.__said = []; say = t => __said.push(t); ORDER.forEach(w => prog.worlds[w].unlocked = 7); true`);

// 1. Un gardien à la fin de chaque endroit : 3 cœurs, 6 au dernier endroit de chaque animal et à la fin de l'île secrète
const KIND = { rex: 'raptor', trike: 'snake', ptero: 'bug', plesio: 'fish' };
const hearts = await ev(`(() => { const out = {}; for (const w in WORLDS) out[w] = WORLDS[w].map((d, i) => { startLevel(w, i); return L.bossFoe ? L.bossFoe.kind + L.bossFoe.hp : '-'; }); return out; })()`);
for (const [w, kind] of Object.entries(KIND)) {
  const want = WORLDS_N => Array.from({ length: 7 }, (_, i) => kind + (i === 5 ? 6 : 3)).join();
  check(`${w} : un gardien (${kind}) à chaque endroit, 6 cœurs au dernier (endroit secret compris : 3)`, hearts[w].join() === want(), hearts[w]);
}
check('île secrète : un gardien à chaque endroit, 6 cœurs au dernier', hearts.final.slice(0, -1).every(h => h.endsWith('3')) && hearts.final.at(-1).endsWith('6'), hearts.final);
check('gardien final plus grand', await ev(`startLevel('rex', 5); const a = L.bossFoe.w; startLevel('rex', 0); a > L.bossFoe.w`));

// 2. T-Rex : le nid est gardé ; 3 sauts sur la tête, 3 énigmes ; une énigme ratée ne compte pas
await ev(`startLevel('rex', 0); L.gates.forEach(g => { g.open = true; }); eggsRun = 3; true`);
const guard = await ev(`(() => { const p = player; p.x = L.nestX - 10; p.y = GROUND * T - p.h; p.vy = 0; cooldown = 0; MODES.platform.step(); return { state, x: Math.round(p.x + p.w), nest: L.nestX, said: __said.at(-1) }; })()`);
check('nid gardé : on ne peut pas l’atteindre, la voix le dit', guard.state === 'play' && guard.x <= guard.nest && /gardé/.test(guard.said), guard);
const stomp = js => ev(`(() => { const f = L.bossFoe, p = player; f.on = true; f.inv = 0; f.sp = 0; p.x = f.x + 20; p.y = f.y - p.h - 2; p.vy = 6; p.ground = false; stepFoes(p); p.y += 6; stepFoes(p); return { state, boss: !!(currentGate && currentGate.boss), vy: p.vy }; })()`);
let st = await stomp();
check('saut sur la tête : une énigme s’ouvre, le T-Rex rebondit', st.state === 'puzzle' && st.boss && st.vy < 0, st);
await ev(`closePuzzle(false); true`);
check('énigme abandonnée : le gardien garde ses 3 cœurs', await ev(`L.bossFoe.hp === 3 && state === 'play' && L.bossFoe.inv > 0`));
st = await stomp(); await ev(`closePuzzle(true); true`);
check('énigme réussie : 2 cœurs, « Encore deux fois »', await ev(`L.bossFoe.hp === 2 && /deux fois/.test(__said.at(-1))`), await ev('[L.bossFoe.hp, __said.at(-1)]'));
await stomp(); await ev(`closePuzzle(true); true`);
check('encore une : 1 cœur, « Encore une fois »', await ev(`L.bossFoe.hp === 1 && /une fois/.test(__said.at(-1))`));
await ev(`(() => { const f = L.bossFoe; f.x = player.x + 200; return true; })()`); await sleep(300); await shot('boss-rex.png');
await stomp(); const n0 = await ev(`L.items.length`); await ev(`closePuzzle(true); true`);
check('3e énigme réussie : le gardien s’en va et laisse 5 fruits', await ev(`!!L.bossFoe.gone && L.items.length === ${n0} + 5 && /chemin du nid est libre/.test(__said.at(-1)) && !bossBlocks()`), await ev('[L.bossFoe.gone, L.items.length, __said.at(-1)]'));
await ev(`(() => { const p = player; p.x = L.nestX - 10; p.y = GROUND * T - p.h; cooldown = 0; MODES.platform.step(); return true; })()`);
check('le nid est libre : endroit fini', await ev(`state === 'done'`), await ev('state'));
// Toucher le gardien de côté : comme un ennemi
// Le gardien final : 6 cœurs, « Encore cinq fois », 10 fruits
await ev(`startLevel('rex', 5); true`);
check('gardien final : il se présente quand on approche', await ev(`(() => { const f = L.bossFoe; player.x = f.min - 100; stepFoes(player); return f.on && /roi des vélociraptors/.test(__said.at(-1)); })()`), await ev('__said.at(-1)'));
await stomp(); await ev(`closePuzzle(true); true`);
check('gardien final : 5 cœurs restants, « Encore cinq fois »', await ev(`L.bossFoe.hp === 5 && /cinq fois/.test(__said.slice(-3).join())`), await ev('[L.bossFoe.hp, __said.slice(-2)]'));
await ev(`L.bossFoe.hp = 1; true`); await stomp(); const n1 = await ev(`L.items.length`); await ev(`closePuzzle(true); true`);
check('gardien final battu : 10 fruits', await ev(`!!L.bossFoe.gone && L.items.length === ${n1} + 10`));
await ev(`prog.hard = 0; startLevel('rex', 0); true`);
check('toucher le gardien de côté : repoussé', await ev(`(() => { const f = L.bossFoe, p = player; f.on = true; p.hurt = 0; p.x = f.x + 10; p.y = f.y + 30; p.vy = 0; stepFoes(p); return p.hurt > 0 && state === 'play'; })()`));

// 3. Tricératops (foncer), plésiosaure (nager vite) : une énigme à chaque coup
for (const [w, mode] of [['trike', 'topdown'], ['plesio', 'swim']]) {
  await ev(`startLevel('${w}', 1); true`);
  const r = await ev(`(() => { const f = L.bossFoe, p = player; f.on = true; f.inv = 0; p.dash = 10; p.x = f.x + 10; p.y = f.y + 10; stepFoes(p); return { state, boss: !!(currentGate && currentGate.boss) }; })()`);
  check(`${w} : foncer ou nager vite dans le gardien ouvre une énigme`, r.state === 'puzzle' && r.boss, r);
  await ev(`closePuzzle(true); true`);
  check(`${w} : réussie, il perd un cœur`, await ev(`L.bossFoe.hp === 2`));
  await ev(`(() => { const f = L.bossFoe; player.x = f.x - 260; player.y = f.y; f.inv = 0; return true; })()`); await sleep(300); await shot(`boss-${w}.png`);
}
// Ptérodactyle : le gardien vient quand tous les œufs sont libérés, au bout du ciel ; une graine le touche
await ev(`startLevel('ptero', 1); true`);
check('ptérodactyle : pas de gardien avant la fin du ciel', await ev(`stepFoes(player); !L.bossFoe.on`));
await ev(`L.gates.forEach(g => { g.open = true; }); camX = L.nestX + 260 - viewW; stepFoes(player); true`);
check('ptérodactyle : au bout du ciel, la libellule géante arrive', await ev(`L.bossFoe.on && /libellule géante/.test(__said.at(-1))`), await ev('[L.bossFoe.on, __said.at(-1)]'));
const seed = await ev(`(() => { const f = L.bossFoe; for (let k = 0; k < 120; k++) stepFoes(player); f.inv = 0; L.shots.push({ x: f.x + 20, y: f.y + 20, vx: 0, hit: false }); stepFoes(player); return { state, boss: !!(currentGate && currentGate.boss) }; })()`);
check('ptérodactyle : une graine sur la libellule géante ouvre une énigme', seed.state === 'puzzle' && seed.boss, seed);
await ev(`closePuzzle(true); player.x = camX + 120; player.y = 200; true`); await sleep(300); await shot('boss-ptero.png');
check('ptérodactyle : le nid attend le gardien', await ev(`bossBlocks()`));

check('aucune erreur JavaScript', errors.length === 0, errors);
console.log('Captures :', out);
console.log(fails ? `${fails} échec(s)` : 'Tous les tests passent');
ws.close(); chrome.kill();
process.exit(fails ? 1 : 0);
