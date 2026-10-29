// Test de la sauvegarde v2 dans Chrome headless, via le protocole DevTools.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
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

// 1. Ancienne sauvegarde v2 sans compétences
await load();
await wipe(`localStorage.clear(); localStorage.setItem('dino-explorateur-v2', JSON.stringify({ version: 2, diff: 'grand', worlds: { rex: { unlocked: 2, eggs: [3, 0, 0, 0] } } }))`);
await load();
let p = await ev(`JSON.parse(JSON.stringify(prog))`);
check('sans compétences : départ Grand = 4', Object.values(p.skills).every(s => s.lvl === 4 && s.ok === 0 && s.bad === 0), p.skills);
check('étoiles initialisées', JSON.stringify(p.worlds.rex.stars) === '[0,0,0,0,0,0,0]', p.worlds.rex);

// 2. Règles de progression
const lr = await ev(`(() => {
  const s = prog.skills.count; s.lvl = 4; s.ok = 0; s.bad = 0; const out = [];
  out.push(learn('count', 0), learn('count', 0)); out.push(s.lvl);
  out.push(learn('count', 0)); out.push(s.lvl, s.ok);
  learn('count', 0); learn('count', 1); learn('count', 0); learn('count', 0); out.push(s.lvl);
  learn('count', 2); out.push(s.lvl); learn('count', 1); learn('count', 2); out.push(s.lvl); learn('count', 3); out.push(s.lvl);
  s.lvl = 10; learn('count', 0); learn('count', 0); out.push(learn('count', 0), s.lvl);
  s.lvl = 1; learn('count', 2); learn('count', 2); out.push(s.lvl, s.bad);
  out.push(learn(null, 0));
  return out; })()`);
check('2 réussites : pas encore', lr[0] === '' && lr[1] === '' && lr[2] === 4, lr);
check('3e réussite du premier coup : +1 et message', lr[3] === 'Tu progresses pour compter !' && lr[4] === 5 && lr[5] === 0, lr);
check('une erreur casse la série', lr[6] === 5, lr);
check('une énigme difficile seule : pas de baisse', lr[7] === 5, lr);
check('1 erreur entre deux difficiles : pas de baisse', lr[8] === 5, lr);
check('2 difficiles de suite : -1', lr[9] === 4, lr);
check('plafond 10', lr[10] === '' && lr[11] === 10, lr);
check('plancher 1', lr[12] === 1 && lr[13] === 0, lr);
check('énigme des parents : sans effet', lr[14] === '', lr);

// 3. Génération des énigmes à chaque niveau
const gen = await ev(`(() => {
  const bad = []; const txt = b => b.textContent.trim();
  const types = ['count', 'add', 'sub', 'mult', 'compare', 'sequence', 'first', 'missing', 'hangman', 'order'];
  state = 'puzzle'; $('puzzle').hidden = false;
  for (const t of types) for (let k = 1; k <= 10; k++) for (let r = 0; r < 25; r++) {
    prog.skills[TYPE_SKILL[t]].lvl = k; pzLocked = false;
    try { PUZZLES[t](); } catch (e) { bad.push([t, k, String(e)]); continue; }
    const btns = [...pz.choices.querySelectorAll('button')], labels = btns.map(b => b.getAttribute('aria-label') || txt(b));
    if (t !== 'order' && new Set(labels).size !== labels.length) bad.push([t, k, 'doublon', labels]);
    const title = pz.title.textContent;
    const want = { count: nChoices(k), add: nChoices(k), sub: nChoices(k), mult: nChoices(k), compare: 2, sequence: k <= 5 ? 3 : 4, first: k <= 4 ? 3 : k <= 7 ? 4 : 5, missing: k <= 4 ? 3 : k <= 7 ? 4 : 5 }[t];
    if (want && btns.length !== want) bad.push([t, k, 'nb choix', btns.length]);
    let ans = null, m;
    if ((m = title.match(/^(\\d+) \\+ (\\d+)/))) ans = +m[1] + +m[2];
    else if ((m = title.match(/^(\\d+) − (\\d+)/))) { ans = +m[1] - +m[2]; if (ans < 0) bad.push([t, k, 'négatif', title]); }
    else if ((m = title.match(/^(\\d+) × (\\d+)/))) ans = +m[1] * +m[2];
    else if (t === 'count') ans = pz.visual.querySelectorAll('svg').length;
    if (ans !== null && btns.filter(b => +txt(b) === ans).length !== 1) bad.push([t, k, 'réponse absente', title, labels]);
    if (t === 'first' && !labels.includes(currentWord[0])) bad.push([t, k, 'lettre absente']);
    if (t === 'count') { const max = tier('countMax', k); if (ans > max) bad.push([t, k, 'trop', ans]); }
  }
  $('puzzle').hidden = true; state = 'menu';
  return bad.slice(0, 8); })()`);
check('énigmes valides aux 10 niveaux (2500 tirages)', gen.length === 0, gen);
const ranges = await ev(`(() => { const r = {}; for (const k of [1, 4, 7, 10]) { prog.skills.add.lvl = k; let hi = 0; for (let i = 0; i < 200; i++) { PUZZLES.add(); const m = pz.title.textContent.match(/(\\d+) \\+ (\\d+)/); hi = Math.max(hi, +m[1] + +m[2]); } r[k] = hi; } return r; })()`);
check('additions plus grandes quand le niveau monte', ranges[1] <= 5 && ranges[4] <= 10 && ranges[7] <= 25 && ranges[10] > 40, ranges);
const cmp = await ev(`(() => { prog.skills.compare.lvl = 8; PUZZLES.compare(); return pz.title.textContent; })()`);
check('comparer niveau 8 : nombres écrits', cmp.startsWith('Quel nombre'), cmp);
const ord = await ev(`(() => { varyType = t => t; prog.skills.mots.lvl = 2; const g = { type: 'order', k: 0 }; openPuzzle(g); const t = pz.title.textContent; $('puzzle').hidden = true; state = 'menu'; return t; })()`);
check('mots niveau 2 : lettres dans l’ordre remplacées par la 1re lettre', ord.startsWith('Par quelle lettre'), ord);

// 4. Partie complète : étoiles et progression
const said = [];
await ev(`window.__said = []; say = t => window.__said.push(t); varyType = t => t; true`);
await ev(`Object.values(prog.skills).forEach(s => { s.lvl = 3; s.ok = 0; s.bad = 0; }); prog.skills.count.ok = 2; startLevel('rex', 0); true`);
await sleep(200);
const clickCorrect = `(() => { const btns = [...pz.choices.querySelectorAll('button.choice')];
  const n = pz.visual.querySelectorAll('svg').length; const b = btns.find(x => +x.textContent === n); b.click(); return n; })()`;
await ev(`openPuzzle(L.gates[0]); true`);
await ev(clickCorrect);
await sleep(300);
check('étoiles affichées après la réponse', await ev(`pz.choices.querySelectorAll('.pz-stars .star:not(.off)').length === 3`));
check('message de progrès dit à voix haute', await ev(`window.__said.some(t => t.includes('Tu progresses pour compter'))`), await ev(`window.__said`));
await sleep(2800);
let st = await ev(`({ open: L.gates[0].open, stars: L.gates[0].stars, lvl: prog.skills.count.lvl, run: JSON.parse(localStorage.getItem('dino-explorateur-v2')).run.stars, state })`);
check('pierre 1 : ouverte, 3 étoiles, compter passe au niveau 4', st.open && st.stars === 3 && st.lvl === 4 && st.run[0] === 3 && st.state === 'play', st);
// Pierre 2 : 'first', deux erreurs
await ev(`openPuzzle(L.gates[1]); true`);
await ev(`(() => { const l = currentWord[0]; const btns = [...pz.choices.querySelectorAll('button.choice')]; btns.filter(b => b.textContent !== l).slice(0, 2).forEach(b => b.click()); btns.find(b => b.textContent === l).click(); })()`);
await sleep(1900);
st = await ev(`({ stars: L.gates[1].stars, bad: prog.skills.lettres.bad })`);
check('pierre 2 : 2 erreurs = 1 étoile, compte comme difficile', st.stars === 1 && st.bad === 1, st);
// Reprise : les étoiles des pierres sont gardées
await ev(`showMenu(); true`);
await load();
await ev(`$('continueBtn').click(); true`);
st = await ev(`L.gates.map(g => g.stars || 0)`);
check('étoiles des pierres gardées après reprise', JSON.stringify(st) === '[3,1,0]', st);
await ev(`window.__said = []; say = t => window.__said.push(t); varyType = t => t; true`);
await ev(`openPuzzle(L.gates[2]); true`);
await ev(`(() => { const b = [...pz.choices.querySelectorAll('button.choice')]; const want = pz.visual.querySelectorAll('.dot'); b[0].click(); })()`); // réponse quelconque, puis la bonne
await ev(`(() => { const b = [...pz.choices.querySelectorAll('button.choice:not(:disabled)')].find(x => x.classList.contains('hint') || true); })()`);
await ev(`(() => { for (const b of pz.choices.querySelectorAll('button.choice')) if (!b.disabled && !pzLocked) b.click(); })()`);
await sleep(1900);
await ev(`levelDone(); true`);
st = await ev(`({ stars: prog.worlds.rex.stars[0], shown: $('doneStars').querySelectorAll('.star:not(.off)').length, gates: L.gates.map(g => g.stars) })`);
const expect = Math.max(1, Math.min(3, Math.round(st.gates.reduce((a, b) => a + b, 0) / 3)));
check('fin de niveau : étoiles = moyenne des pierres', st.stars === expect && st.shown === expect, { st, expect });
await ev(`showMenu(); true`);
check('menu : étoiles sur l’endroit', await ev(`document.querySelectorAll('#levels .lvl')[0].querySelectorAll('.st .star:not(.off)').length === prog.worlds.rex.stars[0]`));

// 5. Changer de niveau dans le menu
await ev(`prog.diff = 'grand'; prog.skills.add.lvl = 9; true`);
await ev(`$('diffGrand').click(); true`);
check('même niveau recliqué : rien ne change', await ev(`prog.skills.add.lvl === 9`));
await ev(`$('diffExpert').click(); true`);
check('Expert : toutes les compétences à 7', await ev(`Object.values(prog.skills).every(s => s.lvl === 7) && JSON.parse(localStorage.getItem('dino-explorateur-v2')).skills.add.lvl === 7`));

// 6. Espace parents
await ev(`prog.skills.count.lvl = 1; renderParents(); $('parents').hidden = false; true`);
let rows = await ev(`[...document.querySelectorAll('#skillList .skill')].map(r => ({ n: r.querySelector('.nm').textContent, v: r.querySelector('b').textContent, minus: r.querySelectorAll('button')[0].disabled }))`);
check('parents : 11 compétences listées', rows.length === 11 && rows[0].n === 'Compter' && rows[0].v === '1' && rows[0].minus === true, rows);
await ev(`document.querySelectorAll('#skillList .skill')[0].querySelectorAll('button')[1].click(); true`);
check('parents : bouton + monte le niveau et enregistre', await ev(`prog.skills.count.lvl === 2 && document.querySelector('#skillList .skill b').textContent === '2' && JSON.parse(localStorage.getItem('dino-explorateur-v2')).skills.count.lvl === 2`));
check('code de sauvegarde contient les compétences', await ev(`JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(exportCode().slice(6)), c => c.charCodeAt(0)))).skills.count.lvl === 2`));
await ev(`$('parents').hidden = true; true`);

check('aucune erreur JavaScript', errors.length === 0, errors);
console.log(fails ? `${fails} échec(s)` : 'Tous les tests passent');
ws.close(); chrome.kill();
process.exit(fails ? 1 : 0);
