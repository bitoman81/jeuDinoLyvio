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

await load();
await ev(`say = () => {}; true`);
const steps = n => ev(`(() => { for (let i = 0; i < ${n}; i++) { time += 1 / 60; MODES[L.mode].step(); } return true; })()`);

// 1. Le sac se remplit et reste d'un endroit à l'autre
await ev(`prog.bag.n = 0; startLevel('rex', 0); cooldown = 9999; true`);
const got = await ev(`(() => { const f = L.items.find(x => !x.fossil); player.x = f.x - player.w / 2; player.y = f.y - player.h / 2; collectItems(player, 14); return [prog.bag.n, fruitCount]; })()`);
check('un fruit ramassé va dans le sac', got[0] === 1 && got[1] === 1, got);
await ev(`startLevel('plesio', 0); cooldown = 9999; true`);
const got2 = await ev(`(() => { const f = L.items.find(x => !x.fossil); player.x = f.x - player.w / 2; player.y = f.y - player.h / 2; collectItems(player, 16); return [prog.bag.n, fruitCount]; })()`);
check('une perle aussi, le sac garde le compte', got2[0] === 2 && got2[1] === 1, got2);
await ev(`save(); true`); await load();
check('sac enregistré', await ev(`prog.bag.n === 2`));

// 2. Fossile
await ev(`say = () => {}; prog.bag.fossils = {}; startLevel('trike', 1); cooldown = 9999; true`);
let fos = await ev(`(() => { const f = L.items.find(x => x.fossil); if (!f) return null; player.x = f.x - player.w / 2; player.y = f.y - player.h / 2; collectItems(player, 16); return { found: prog.bag.fossils['trike-1'], got: L.gotFossil, count: L.items.filter(x => x.fossil).length }; })()`);
check('un seul fossile par endroit, ramassé dans l’album', fos && fos.count === 1 && fos.found === true && fos.got === true, fos);
await ev(`startLevel('trike', 1); true`);
check('fossile déjà trouvé : plus de fossile à cet endroit', await ev(`!L.items.some(x => x.fossil)`));
await ev(`delete prog.bag.fossils['trike-1']; startLevel('ptero', 0); true`);
check('ptérodactyle et plésiosaure ont aussi leur fossile', await ev(`L.items.some(x => x.fossil) && (startLevel('plesio', 2), L.items.some(x => x.fossil))`));
await ev(`levelDone(); true`);
check('fin de niveau : sac indiqué', await ev(`$('doneText').textContent.includes('Ton sac')`));

// 3. Aide pendant une énigme
await ev(`showMenu(); prog.bag.n = 20; prog.skills.add.lvl = 6; prog.skills.add.ok = 2; startLevel('rex', 0); cooldown = 9999; varyType = t => t; true`);
await ev(`openPuzzle({ type: 'add', k: 0, x: 0, w: 1, eggY: 0 }); true`);
let h = await ev(`({ shown: !$('pzHelp').hidden, hint: $('helpHint').disabled, cut: $('helpCut').disabled, n: pz.choices.querySelectorAll('button.choice').length })`);
check('aide visible, les deux boutons utilisables', h.shown && !h.hint && !h.cut && h.n === 4, h);
await ev(`$('helpCut').click(); true`);
h = await ev(`({ n: prog.bag.n, gone: pz.choices.querySelectorAll('button.choice.gone').length, errs: pzErrs })`);
check('enlever une réponse : 5 trésors, une mauvaise réponse en moins', h.n === 15 && h.gone === 1 && h.errs === 1, h);
await ev(`$('helpHint').click(); true`);
h = await ev(`({ n: prog.bag.n, hint: pz.choices.querySelectorAll('button.choice.hint').length, again: $('helpHint').disabled, cutOff: $('helpCut').disabled })`);
check('montrer la réponse : 10 trésors, la bonne réponse brille, une seule fois', h.n === 5 && h.hint === 1 && h.again && h.cutOff, h);
await ev(`pz.choices.querySelector('button.choice.hint').click(); true`);
h = await ev(`({ stars: pzStars, lvl: prog.skills.add.lvl, hidden: $('pzHelp').hidden })`);
check('réponse montrée : 1 étoile et pas de montée de niveau', h.stars === 1 && h.lvl === 6 && h.hidden, h);
await sleep(1800);
await ev(`prog.bag.n = 4; openPuzzle({ type: 'add', k: 1, x: 0, w: 1, eggY: 0 }); true`);
check('pas assez de trésors : boutons grisés', await ev(`$('helpHint').disabled && $('helpCut').disabled`));
await ev(`$('pzBack').click(); prog.bag.n = 50; openPuzzle({ type: 'maze', k: 1, x: 0, w: 1, eggY: 0 }); true`);
check('pas d’aide pour les jeux (labyrinthe)', await ev(`$('pzHelp').hidden`));
await ev(`$('pzBack').click(); openPuzzle({ type: 'compare', k: 1, x: 0, w: 1, eggY: 0 }); true`);
check('2 réponses seulement : on ne peut pas en enlever', await ev(`$('helpCut').disabled && !$('helpHint').disabled`));
await ev(`$('pzBack').click(); true`);

// 4. Pouvoirs
await ev(`showMenu(); prog.bag.n = 30; renderMenu(); true`);
const shop = await ev(`[...document.querySelectorAll('#shopPowers .it')].map(b => b.disabled)`);
check('boutique : 6 pouvoirs achetables', shop.length === 6 && shop.every(d => !d), shop);
await ev(`document.querySelectorAll('#shopPowers .it')[0].click(); document.querySelectorAll('#shopPowers .it')[1].click(); true`);
check('achat : 24 trésors dépensés', await ev(`prog.bag.n === 6 && prog.bag.power.magnet === 1 && prog.bag.power.shield === 1`));
check('plus assez : pouvoirs grisés', await ev(`[...document.querySelectorAll('#shopPowers .it')].every(b => b.disabled)`));
await ev(`startLevel('rex', 1); cooldown = 9999; true`);
check('T-Rex : l’aimant est utilisé, le bouclier est gardé', await ev(`L.magnet && !L.shield && prog.bag.power.magnet === 0 && prog.bag.power.shield === 1 && $('hudPow').querySelectorAll('svg').length === 1`));
const mag = await ev(`(() => { const f = L.items.find(x => !x.taken && !x.fossil); player.x = f.x - 100; player.y = f.y - player.h / 2; const d0 = Math.hypot(player.x + player.w / 2 - f.x, player.y + player.h / 2 - f.y); for (let i = 0; i < 40; i++) collectItems(player, 14); return { d0, taken: f.taken }; })()`);
check('aimant : un fruit à 100 px vient tout seul', mag.taken, mag);
await ev(`autosave(); showMenu(); true`); await load();
await ev(`say = () => {}; $('continueBtn').click(); true`);
check('reprise : l’aimant est toujours actif', await ev(`L.magnet === true && prog.bag.power.magnet === 0`));
await ev(`startLevel('plesio', 0); cooldown = 9999; true`);
check('plésiosaure : le bouclier est utilisé', await ev(`L.shield && prog.bag.power.shield === 0`));
const jel = await ev(`(() => { const j = L.jellies[0]; for (let i = 0; i < 5; i++) { player.x = j.x - player.w / 2; player.y = j.y0 + Math.sin(time * j.sp + j.ph) * j.amp - player.h / 2; MODES.swim.step(); } return player.hurt; })()`);
check('bouclier : les méduses ne piquent plus', jel === 0, jel);

// 5. Couleurs
await ev(`showMenu(); prog.world = 'rex'; prog.bag.n = 20; renderMenu(); true`);
let sk = await ev(`[...document.querySelectorAll('#shopSkins .it')].map(b => [b.textContent, b.disabled, b.getAttribute('aria-pressed')])`);
check('4 couleurs : origine choisie, 15 achetable, 25 et 40 trop chères', sk.length === 4 && sk[0][2] === 'true' && !sk[1][1] && sk[2][1] && sk[3][1], sk);
await ev(`document.querySelectorAll('#shopSkins .it')[1].click(); true`);
check('achat d’une couleur : mise tout de suite', await ev(`prog.bag.n === 5 && prog.bag.skin.rex === 'foret' && SPECIES.rex.pal.body === '#4f8f3c' && SPECIES.rex.pal === SPECIES.rex.pal`));
await ev(`document.querySelectorAll('#shopSkins .it')[0].click(); true`);
check('remettre la couleur d’origine, gratuit', await ev(`prog.bag.skin.rex === 'base' && SPECIES.rex.pal === SPECIES.rex.base && prog.bag.n === 5`));
await ev(`document.querySelectorAll('#shopSkins .it')[1].click(); true`);
check('couleur déjà achetée : remise sans payer', await ev(`prog.bag.skin.rex === 'foret' && prog.bag.n === 5`));
await ev(`save(); true`); await load();
check('couleur gardée après rechargement', await ev(`SPECIES.rex.pal.body === '#4f8f3c'`));

// 6. Album et nettoyage
check('album : 32 fossiles (un par endroit)', await ev(`document.querySelectorAll('#fossilList .fos').length === 32`));
const cl = await ev(`(() => { const p = cleanProg({ bag: { n: -4, fossils: { 'rex-0': true, 'rex-99': true, 'x-1': true }, owned: { 'rex:foret': true, 'rex:faux': true }, skin: { rex: 'faux', trike: 'menthe' }, power: { magnet: 500, shield: 'a' } } }); return p.bag; })()`);
check('sac nettoyé à la lecture', cl.n === 0 && JSON.stringify(cl.fossils) === '{"rex-0":true}' && JSON.stringify(cl.owned) === '{"rex:foret":true}' && cl.skin.rex === 'base' && cl.skin.trike === 'base' && cl.power.magnet === 99 && cl.power.shield === 0, cl);
check('code de sauvegarde : le sac passe', await ev(`importCode(exportCode()) && prog.bag.skin.rex === 'foret' && SPECIES.rex.pal.body === '#4f8f3c'`));

check('aucune erreur JavaScript', errors.length === 0, errors);
console.log(fails ? `${fails} échec(s)` : 'Tous les tests passent');
ws.close(); chrome.kill();
process.exit(fails ? 1 : 0);
