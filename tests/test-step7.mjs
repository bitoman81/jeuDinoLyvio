// Étape 7 : nouveaux endroits, clé dorée, endroits secrets, carte au trésor et île secrète. Aide pour les mots.
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

await load();
await ev(`say = () => {}; true`);
const fresh = `prog = cleanProg(null); applySkins();`;

// 1. Les niveaux
const counts = await ev(`Object.fromEntries(Object.keys(WORLDS).map(k => [k, [regularCount(k), WORLDS[k].filter(d => d.bonus).length, WORLDS[k].filter(d => d.key).length]]))`);
const countsOk = ['rex', 'trike', 'ptero', 'plesio'].every(k => counts[k][0] === 6 && counts[k][1] === 1 && counts[k][2] === 1) && counts.final[0] === 4 && counts.final[1] === 0;
check('6 endroits par animal, 1 secret et 1 clé', countsOk, counts);
check('le monde final réunit les 4 animaux', await ev(`WORLDS.final.map((d, i) => levelSp('final', i).mode).join() === 'platform,topdown,shmup,swim'`));
// Les trous du T-Rex : 3 cases au plus, sinon une plateforme, une bûche ou un rondin pour passer.
const holes = await ev(`(() => { const bad = []; for (const k of ['rex', 'final']) WORLDS[k].forEach((d, i) => { if (d.sp && d.sp !== 'rex') return; d.ground.slice(1).forEach(([a], j) => { const b = d.ground[j][1]; if (a - b <= 3) return; const help = d.movers.some(m => m.x < a && m.x + m.w > b) || [...d.plats, ...(d.falls || [])].some(([x]) => x >= b && x < a); if (!help) bad.push(k + i + ':' + b + '-' + a); }); d.stones.forEach(c => { if (!d.ground.some(([a, b]) => c >= a && c < b)) bad.push(k + i + ' pierre ' + c); }); }); return bad; })()`);
check('T-Rex : chaque trou se passe, chaque pierre est sur le sol', holes.length === 0, holes);

// 2. Chaque endroit se construit et tourne 5 secondes sans erreur
const run = await ev(`(() => { const out = []; for (const k of Object.keys(WORLDS)) WORLDS[k].forEach((d, i) => { startLevel(k, i); cooldown = 99999; for (let s = 0; s < 300; s++) { time += 1 / 60; MODES[L.mode].step(); if (state !== 'play') break; } MODES[L.mode].render(); out.push(k + i + ':' + L.gates.length + ':' + L.baseItems); }); return out; })()`);
const badRun = run.filter(r => +r.split(':')[1] !== 3 || +r.split(':')[2] < 8);
check('les 32 endroits se jouent et se dessinent', run.length === 32 && badRun.length === 0, badRun);
check('pas d’erreur pendant ces parties', errors.length === 0, errors);

// 3. Anciennes sauvegardes : le volcan fini ouvre le marais
const mig = await ev(`(() => { const p = cleanProg({ worlds: { rex: { unlocked: 4, eggs: [3, 3, 3, 3] }, trike: { unlocked: 3, eggs: [3, 3, 2] } } }); return [p.worlds.rex.unlocked, p.worlds.rex.eggs.length, p.worlds.trike.unlocked, p.worlds.final.unlocked]; })()`);
check('ancienne sauvegarde : le niveau suivant s’ouvre', JSON.stringify(mig) === '[5,7,3,1]', mig);

// 4. La clé dorée
await ev(`${fresh} startLevel('rex', 0); true`);
check('pas de clé dans la clairière', await ev(`!L.items.some(f => f.key)`));
await ev(`startLevel('rex', 3); cooldown = 99999; true`);
check('une clé dorée dans le volcan', await ev(`L.items.filter(f => f.key).length === 1 && !L.items.find(f => f.key).fossil`));
await ev(`showMenu(); prog.world = 'rex'; prog.worlds.rex.unlocked = 6; renderMenu(); true`);
let lv = await ev(`[...document.querySelectorAll('#levels .lvl')].map(b => [b.disabled, b.classList.contains('bonus'), b.querySelector('.nm').textContent])`);
check('menu : 7 endroits, le secret est fermé et caché', lv.length === 7 && lv[6][0] && lv[6][1] && lv[6][2] === 'Endroit secret' && !lv[5][0], lv);
await ev(`startLevel('rex', 3); cooldown = 99999; const f = L.items.find(x => x.key); player.x = f.x - player.w / 2; player.y = f.y - player.h / 2; collectItems(player, 14); true`);
check('clé ramassée : gardée dans le sac', await ev(`prog.bag.keys.rex === true && L.gotKey === true`));
await ev(`startLevel('rex', 3); true`);
check('clé trouvée : plus de clé au volcan', await ev(`!L.items.some(f => f.key)`));
await ev(`showMenu(); renderMenu(); true`);
check('menu : l’endroit secret est ouvert', await ev(`(() => { const b = [...document.querySelectorAll('#levels .lvl')][6]; return !b.disabled && b.querySelector('.nm').textContent === 'La grotte secrète'; })()`));
await ev(`startLevel('rex', 5); levelDone(); true`);
check('fin du dernier endroit : bouton vers l’endroit secret', await ev(`!$('doneNext').hidden && $('doneNext').textContent === "L'endroit secret" && prog.worlds.rex.unlocked === 6`));
await ev(`prog.bag.keys = {}; startLevel('rex', 5); levelDone(); true`);
check('sans la clé : pas de bouton suivant', await ev(`$('doneNext').hidden`));

// 5. Carte au trésor et île secrète
await ev(`${fresh} ['rex', 'trike', 'ptero'].forEach(k => { prog.bag.keys[k] = true; startLevel(k, 6); levelDone(); }); true`);
check('3 endroits secrets finis : 3 morceaux', await ev(`Object.keys(prog.bag.maps).length === 3 && !allMaps() && $('hatch').querySelector('.map') !== null`));
check('fin de l’endroit secret : il ne rouvre rien d’autre', await ev(`prog.worlds.ptero.unlocked === 1 && $('doneNext').hidden`));
await ev(`showMenu(); renderMenu(); true`);
check('menu : l’île est fermée, 3 morceaux sur 4', await ev(`(() => { const b = document.querySelector('#dinoPick .island'); return b.classList.contains('locked') && b.textContent.includes('3 morceaux de carte sur 4'); })()`));
await ev(`document.querySelector('#dinoPick .island').click(); true`);
check('île fermée : on reste sur l’animal', await ev(`prog.world !== 'final'`));
await ev(`prog.bag.keys.plesio = true; startLevel('plesio', 6); levelDone(); true`);
check('4e morceau : l’île s’ouvre', await ev(`allMaps() && $('doneText').textContent.includes("l'île secrète est ouverte")`));
await ev(`showMenu(); document.querySelector('#dinoPick .island').click(); true`);
lv = await ev(`[...document.querySelectorAll('#levels .lvl')].map(b => b.disabled)`);
check('menu de l’île : 4 endroits, le premier ouvert', await ev(`prog.world === 'final' && $('worldTitle').textContent === "L'île secrète" && $('shopSkins').hidden`) && lv.length === 4 && !lv[0] && lv[1], lv);
await ev(`startLevel('final', 1); cooldown = 99999; true`);
check('île : le tricératops joue le 2e endroit', await ev(`L.mode === 'topdown' && world() === SPECIES.trike && L.world === 'final'`));
await ev(`autosave(); showMenu(); true`); await load(); await ev(`say = () => {}; true`);
check('reprise sur l’île', await ev(`!$('continueBtn').hidden && $('continueBtn').textContent.includes("La jungle de l'île")`));
await ev(`$('continueBtn').click(); true`);
check('reprise : bon animal', await ev(`L.world === 'final' && L.i === 1 && L.mode === 'topdown'`));
await ev(`levelDone(); true`);
check('île : endroit suivant ouvert', await ev(`!$('doneNext').hidden && prog.worlds.final.unlocked === 3`));
await ev(`startLevel('final', 3); levelDone(); true`);
await sleep(3400);
check('fin de l’île : un bébé de chaque famille, plus de suite', await ev(`$('hatch').querySelectorAll('canvas').length === 4 && $('doneNext').hidden && $('doneText').textContent.includes('quatre familles')`));
const back = await ev(`importCode(exportCode()) && JSON.stringify([prog.bag.keys, prog.bag.maps])`);
const all4 = { rex: true, trike: true, ptero: true, plesio: true };
check('code de sauvegarde : clés et carte passent', back === JSON.stringify([all4, all4]), back);
const cl = await ev(`JSON.stringify(cleanProg({ bag: { keys: { rex: true, x: true, trike: 1 }, maps: { ptero: true, final: true } } }).bag)`);
check('clés et carte nettoyées à la lecture', cl.includes('"keys":{"rex":true}') && cl.includes('"maps":{"ptero":true}'), cl);

// 6. Nouveaux éléments de jeu
await ev(`startLevel('rex', 4); cooldown = 99999; true`);
const fall = await ev(`(() => { const f = L.falls[0]; player.x = f.x + 10; player.y = f.y - player.h - 2; player.vy = 0; const y0 = f.y; let on = false; for (let i = 0; i < 20; i++) { time += 1 / 60; MODES.platform.step(); if (player.on === f) on = true; } const yMid = f.y; for (let i = 0; i < 60; i++) { time += 1 / 60; MODES.platform.step(); } return { on, y0, yMid, y: f.y, t: f.t }; })()`);
check('rondin : on tient dessus, puis il tombe', fall.on && fall.yMid === fall.y0 && fall.y > fall.y0 + 30, fall);
const backf = await ev(`(() => { const f = L.falls[0]; for (let i = 0; i < 400; i++) { time += 1 / 60; MODES.platform.step(); } return f.y === f.y0 && f.t === 0; })()`);
check('rondin : il revient', backf);
check('chute : le T-Rex revient sur le sol', await ev(`player.y < VIEW_H && !player.on`));

await ev(`startLevel('trike', 4); cooldown = 99999; true`);
const ice = await ev(`(() => { const c = WORLDS.trike[4].rivers[0], r = L.grid[c].findIndex((v, i) => i > 0 && v === 6); player.x = c * T + 2; player.y = r * T + 7; player.vx = 3.6; player.vy = 0; keys.right = false; const x0 = player.x; for (let i = 0; i < 6; i++) { time += 1 / 60; MODES.topdown.step(); } return { slid: player.x - x0, cell: L.grid[c][r] }; })()`);
check('glace : le tricératops glisse sans toucher les touches', ice.cell === 6 && ice.slid > 8, ice);

await ev(`startLevel('plesio', 3); cooldown = 99999; true`);
const cur = await ev(`(() => { const k = L.currents[0]; player.x = k.x + k.w / 2 - player.w / 2; player.y = 220; player.vx = player.vy = 0; const y0 = player.y; for (let i = 0; i < 10; i++) { time += 1 / 60; MODES.swim.step(); } return { dy: player.y - y0, dir: k.dy }; })()`);
check('courant : le plésiosaure est poussé', cur.dir === -1 && cur.dy < -5, cur);

await ev(`startLevel('ptero', 3); cooldown = 99999; time = 2; true`);
const wind = await ev(`(() => { player.y = 200; const y0 = player.y; for (let i = 0; i < 20; i++) { time += 1 / 60; MODES.shmup.step(); } return player.y - y0; })()`);
check('vent : le ptérodactyle bouge tout seul', Math.abs(wind) > 5, wind);

// 7. Aide pour les mots : lettres à acheter, et une lettre offerte toutes les 2 erreurs
await ev(`showMenu(); prog.bag.n = 30; prog.skills.mots.lvl = 5; startLevel('rex', 0); cooldown = 99999; varyType = t => t; true`);
await ev(`openPuzzle({ type: 'hangman', k: 0, x: 0, w: 1, eggY: 0 }); PUZZLES.hangman('LAPIN'); true`);
let wh = await ev(`({ shown: !$('pzHelp').hidden, cut: $('helpCut').textContent, hint: $('helpHint').textContent, cutOn: !$('helpCut').disabled, hintOn: !$('helpHint').disabled })`);
check('mot caché : aide proposée (donner une lettre, montrer les lettres)', wh.shown && wh.cut.includes('Donner une lettre') && wh.hint.includes('Montrer les lettres') && wh.cutOn && wh.hintOn, wh);
await ev(`$('helpCut').click(); true`);
wh = await ev(`({ n: prog.bag.n, found: [...document.querySelectorAll('#pzVisual .word span')].filter(s => s.textContent).length, errs: pzErrs })`);
check('donner une lettre : 5 trésors, une lettre écrite', wh.n === 25 && wh.found === 1 && wh.errs === 1, wh);
const wrong = await ev(`[...pz.choices.querySelectorAll('button.choice')].filter(b => !b.disabled && !'LAPIN'.includes(b.textContent)).map(b => b.textContent)`);
await ev(`(() => { const bs = [...pz.choices.querySelectorAll('button.choice')]; bs.find(b => b.textContent === '${wrong[0]}').click(); return true; })()`);
let f1 = await ev(`[...document.querySelectorAll('#pzVisual .word span')].filter(s => s.textContent).length`);
await ev(`(() => { const bs = [...pz.choices.querySelectorAll('button.choice')]; bs.find(b => b.textContent === '${wrong[1]}').click(); return true; })()`);
let f2 = await ev(`[...document.querySelectorAll('#pzVisual .word span')].filter(s => s.textContent).length`);
check('2 erreurs : une lettre offerte gratuitement', f1 === 1 && f2 === 2 && await ev(`prog.bag.n === 25`), [f1, f2]);
await ev(`$('helpHint').click(); true`);
wh = await ev(`({ n: prog.bag.n, glow: [...pz.choices.querySelectorAll('button.choice.hint')].map(b => b.textContent) })`);
check('montrer les lettres : 10 trésors, la lettre suivante brille', wh.n === 15 && wh.glow.length === 1 && 'LAPIN'.includes(wh.glow[0]), wh);
await ev(`pz.choices.querySelector('button.choice.hint').click(); true`);
check('après une bonne lettre, la suivante brille', await ev(`pz.choices.querySelectorAll('button.choice.hint').length === 1`));
for (let k = 0; k < 4; k++) await ev(`(() => { const b = pz.choices.querySelector('button.choice.hint'); if (b) b.click(); return true; })()`);
check('le mot se termine, 1 étoile', await ev(`pzLocked && pzStars === 1 && $('pzHelp').hidden`));
await sleep(1800);
await ev(`openPuzzle({ type: 'order', k: 1, x: 0, w: 1, eggY: 0 }); PUZZLES.order('LAPIN'); true`);
check('lettres dans l’ordre : aide proposée aussi', await ev(`!$('pzHelp').hidden && $('helpCut').textContent.includes('Donner une lettre')`));
await ev(`(() => { const b = [...pz.choices.querySelectorAll('button.choice')].find(x => x.textContent !== 'L'); b.click(); b.click(); return true; })()`);
check('2 erreurs : la première lettre est posée pour lui', await ev(`document.querySelector('#pzVisual .word span').textContent === 'L'`));
await ev(`$('pzBack').click(); true`);

// 8. Téléphone en paysage, écran large et bas (barre du navigateur) : le ptérodactyle atteint le nid
await send('Emulation.setDeviceMetricsOverride', { width: 800, height: 300, deviceScaleFactor: 1, mobile: false });
await sleep(150);
const nest = await ev(`(() => { openPuzzle = g => { g.open = true; g.anim = 1; eggsRun++; }; setTouchUI(true); startLevel('ptero', 0); if (L.bossFoe) L.bossFoe.gone = 1; resize(); stick.id = 1; let f = 0;
  for (; f < 60 * 400 && state === 'play'; f++) { const g = L.gates.find(q => !q.open), tx = g ? g.x + g.w / 2 : L.nestX + 400, ty = g ? g.y + g.h / 2 : 200, dx = tx - player.x - player.w / 2, dy = ty - player.y - player.h / 2, dl = Math.hypot(dx, dy) || 1; stick.x = dx / dl; stick.y = dy / dl; time += 1 / 60; cooldown = 0; L.oy = MODES.shmup.oy(); MODES.shmup.step(); }
  stick.id = null; setTouchUI(false); return [state, Math.round(viewW)]; })()`);
check('téléphone 800 x 300 : le ptérodactyle atteint le nid', nest[0] === 'done' && nest[1] > 1200, nest);
await send('Emulation.clearDeviceMetricsOverride');

check('aucune erreur JavaScript', errors.length === 0, errors);
console.log(fails ? `${fails} échec(s)` : 'Tous les tests passent');
ws.close(); chrome.kill();
process.exit(fails ? 1 : 0);
