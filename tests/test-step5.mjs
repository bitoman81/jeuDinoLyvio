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

await load();
await ev(`say = () => {}; window.__won = null; const s0 = solved; solved = w => { window.__won = { w, errs: pzErrs }; s0(w); }; true`);
const reset = `state = 'puzzle'; $('puzzle').hidden = false; pzLocked = false; pzErrs = 0; currentGate = null; window.__won = null; pzId++;`;

// 1. Génération aux 10 niveaux
const gen = await ev(`(() => { const bad = [];
  for (const t of ['maze', 'slide', 'memory', 'dots', 'sudoku', 'ombres']) for (let k = 1; k <= 10; k++) for (let r = 0; r < 15; r++) {
    prog.skills[TYPE_SKILL[t]].lvl = k; ${reset}
    try { PUZZLES[t](); } catch (e) { bad.push([t, k, String(e)]); }
  }
  $('puzzle').hidden = true; state = 'menu'; return bad.slice(0, 5); })()`);
check('6 nouvelles énigmes sans erreur aux 10 niveaux', gen.length === 0, gen);

// 2. Labyrinthe : on le résout en suivant le plus court chemin, avec les flèches
const maze = await ev(`(async () => { const out = [];
  for (const k of [1, 5, 10]) {
    prog.skills.logique.lvl = k; ${reset} PUZZLES.maze();
    const svg = pz.visual.querySelector('svg'), n = Math.round((svg.viewBox.baseVal.width - 2) / 10);
    // lit les murs depuis le chemin SVG : on teste chaque passage en essayant de bouger
    const arrows = [...pz.choices.querySelectorAll('button')]; // gauche, haut, bas, droite
    const btn = { 0: arrows[1], 1: arrows[3], 2: arrows[2], 3: arrows[0] };
    // parcours en profondeur réel avec retour arrière
    const D = [[0, -1], [1, 0], [0, 1], [-1, 0]], posOf = () => { const c = pz.visual.querySelector('svg g circle'); return Math.floor(+c.getAttribute('cy') / 10) * n + Math.floor(+c.getAttribute('cx') / 10); };
    const seen = new Set([0]); let steps = 0;
    const dfs = () => { const p = posOf(); if (p === n * n - 1) return true;
      for (let i = 0; i < 4; i++) { const x = p % n + D[i][0], y = Math.floor(p / n) + D[i][1], c = y * n + x;
        if (x < 0 || y < 0 || x >= n || y >= n || seen.has(c)) continue;
        btn[i].click(); if (posOf() !== c) continue; steps++; seen.add(c);
        if (window.__won || dfs()) return true; btn[(i + 2) % 4].click(); steps++; }
      return false; };
    dfs(); out.push({ k, n, won: !!window.__won, all: seen.size });
  }
  $('puzzle').hidden = true; state = 'menu'; return out; })()`);
check('labyrinthe : taille selon le niveau (5, 7, 9)', maze.map(m => m.n).join() === '5,7,9', maze);
check('labyrinthe : toujours une sortie, œuf atteint', maze.every(m => m.won), maze);
const mazeKeys = await ev(`(() => { prog.skills.logique.lvl = 1; ${reset} PUZZLES.maze(); const before = pz.visual.innerHTML;
  ['ArrowRight', 'ArrowDown'].forEach(c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c })));
  const moved = pz.visual.innerHTML !== before; $('puzzle').hidden = true; state = 'menu'; pzKey = null; return moved; })()`);
check('labyrinthe : flèches du clavier', mazeKeys);

// 3. Taquin : résolu par recherche, étoiles selon les coups
const slide = await ev(`(() => { const out = [];
  for (const k of [1, 4, 9]) {
    prog.skills.logique.lvl = k; ${reset} PUZZLES.slide();
    const read = () => [...pz.visual.querySelectorAll('.slide > *')].map(e => +(e.textContent || 0));
    const b0 = read(), n = Math.round(Math.sqrt(b0.length)), goal = [...Array(n * n - 1).keys()].map(i => i + 1).concat(0).join();
    const nb = e => [e - n, e + n, e % n ? e - 1 : -1, (e + 1) % n ? e + 1 : -1].filter(c => c >= 0 && c < n * n);
    const prev = new Map([[b0.join(), null]]); let q = [b0], found = null;
    while (q.length && !found) { const nq = []; for (const b of q) { if (b.join() === goal) { found = b; break; } const e = b.indexOf(0);
      for (const c of nb(e)) { const x = b.slice(); [x[e], x[c]] = [x[c], x[e]]; const key = x.join(); if (!prev.has(key)) { prev.set(key, [b.join(), c]); nq.push(x); } } } q = nq; }
    const path = []; for (let key = found.join(); prev.get(key); key = prev.get(key)[0]) path.unshift(prev.get(key)[1]);
    for (const c of path) pz.visual.querySelector('[data-i="' + c + '"]').click();
    out.push({ k, n, moves: path.length, won: !!window.__won, errs: window.__won && window.__won.errs });
  }
  $('puzzle').hidden = true; state = 'menu'; return out; })()`);
check('taquin : 2 x 2 puis 3 x 3', slide.map(s => s.n).join() === '2,3,3', slide);
check('taquin : toujours résoluble, 3 étoiles au plus court', slide.every(s => s.won && s.errs === 0 && s.moves > 0), slide);

// 4. Mémoire
const mem = await ev(`(async () => {
  prog.skills.logique.lvl = 6; ${reset} PUZZLES.memory();
  const cards = [...pz.choices.querySelectorAll('.mcard')], n = cards.length;
  const wrong = cards.findIndex((c, i) => i > 0 && c.innerHTML !== cards[0].innerHTML);
  cards[0].click(); cards[wrong].click();
  const both = cards[0].classList.contains('up') && cards[wrong].classList.contains('up');
  await new Promise(r => setTimeout(r, 1000));
  const back = !cards[0].classList.contains('up');
  const done = new Set();
  for (let i = 0; i < n; i++) { if (done.has(i)) continue; const j = cards.findIndex((c, x) => x !== i && c.innerHTML === cards[i].innerHTML); cards[i].click(); cards[j].click(); done.add(i); done.add(j); }
  const r = { n, both, back, won: !!window.__won, errs: window.__won && window.__won.errs };
  $('puzzle').hidden = true; state = 'menu'; return r; })()`);
check('mémoire : 6 paires au niveau 6', mem.n === 12, mem);
check('mémoire : deux cartes différentes se retournent', mem.both && mem.back, mem);
check('mémoire : toutes les paires, 1 erreur = 3 étoiles', mem.won && mem.errs === 0, mem);

// 5. Points à relier
const dots = await ev(`(() => { const out = [];
  for (const k of [1, 7, 9]) {
    prog.skills.count.lvl = k; ${reset} PUZZLES.dots();
    const labels = () => [...pz.visual.querySelectorAll('g[data-i] text')].map(t => +t.textContent);
    const nums = labels(), tap = i => pz.visual.querySelector('g[data-i="' + i + '"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    tap(nums.length - 1); const err1 = pzErrs;
    for (let i = 0; i < nums.length; i++) tap(i);
    out.push({ k, count: nums.length, step: nums[1] - nums[0], first: nums[0], err1, won: !!window.__won, errs: window.__won && window.__won.errs, filled: !!pz.visual.querySelector('polygon') });
  }
  $('puzzle').hidden = true; state = 'menu'; return out; })()`);
check('points : 5 points au niveau 1, de 2 en 2 au 7, de 5 en 5 au 9', dots[0].count === 5 && dots[1].step === 2 && dots[1].first === 2 && dots[2].step === 5, dots);
check('points : un mauvais point compte une erreur, le dessin se remplit', dots.every(d => d.err1 === 1 && d.won && d.errs === 1 && d.filled), dots);

// 6. Sudoku
const sdk = await ev(`(() => { const out = [];
  for (const k of [5, 7, 10]) {
    prog.skills.logique.lvl = k; ${reset} PUZZLES.sudoku();
    const empty0 = pz.visual.querySelectorAll('.sdk button:not(.given)').length;
    const pal = [...pz.choices.querySelectorAll('button')];
    let tries = 0;
    while (!window.__won && tries < 100) { for (const b of pal) { tries++; const before = pz.visual.querySelectorAll('.sdk button:not(.given)[aria-label="case vide"]').length; b.click(); if (window.__won || pz.visual.querySelectorAll('[aria-label="case vide"]').length < before) break; } }
    const cells = [...pz.visual.querySelectorAll('.sdk button')].map(b => b.getAttribute('aria-label'));
    const groups = []; for (let i = 0; i < 4; i++) { groups.push(cells.slice(i * 4, i * 4 + 4)); groups.push([0, 1, 2, 3].map(r => cells[r * 4 + i])); const br = (i >> 1) * 2, bc = (i & 1) * 2; groups.push([cells[br * 4 + bc], cells[br * 4 + bc + 1], cells[(br + 1) * 4 + bc], cells[(br + 1) * 4 + bc + 1]]); }
    out.push({ k, empty0, won: !!window.__won, valid: groups.every(g => new Set(g).size === 4), errs: window.__won && window.__won.errs });
  }
  $('puzzle').hidden = true; state = 'menu'; return out; })()`);
check('sudoku : trous selon le niveau (4, 6, 8)', sdk.map(s => s.empty0).join() === '4,6,8', sdk);
check('sudoku : grille finie valide, mauvaises formes comptées', sdk.every(s => s.won && s.valid && s.errs >= 0), sdk);
const uniq = await ev(`(() => { let ok = 0; for (let r = 0; r < 30; r++) { prog.skills.logique.lvl = 10; ${reset} PUZZLES.sudoku(); if (pz.visual.querySelectorAll('[aria-label="case vide"]').length === 8) ok++; } $('puzzle').hidden = true; state = 'menu'; return ok; })()`);
check('sudoku : 8 trous possibles à chaque fois', uniq === 30, uniq);

// 7. Ombres
const omb = await ev(`(() => { prog.skills.logique.lvl = 8; ${reset} PUZZLES.ombres(); const n = pz.choices.querySelectorAll('.shadow').length; $('puzzle').hidden = true; state = 'menu'; return n; })()`);
check('ombres : 4 ombres au niveau 8', omb === 4, omb);

// 8. Variété et compétences
const fam = await ev(`(() => { Object.values(prog.skills).forEach(s => s.lvl = 6); const seen = {}; lastType = null;
  for (let i = 0; i < 600; i++) { const t = varyType(pick(['count', 'compare', 'sequence'])); lastType = t; seen[t] = TYPE_SKILL[t]; }
  Object.values(prog.skills).forEach(s => s.lvl = 1); const low = {}; for (let i = 0; i < 300; i++) { const t = varyType(pick(['count', 'sequence'])); lastType = t; low[t] = 1; }
  return { seen, low: Object.keys(low) }; })()`);
check('les jeux sortent des pierres compter, comparer, suites', ['maze', 'slide', 'memory', 'dots', 'sudoku', 'ombres'].every(t => fam.seen[t]), fam.seen);
check('niveau 1 : pas de taquin, sudoku ni points', !['slide', 'sudoku', 'dots'].some(t => fam.low.includes(t)), fam.low);

// 9. Statistiques du jour
await ev(`prog.stats = {}; true`);
const st = await ev(`(() => { prog.skills.add.lvl = 3; prog.skills.add.ok = 2; ${reset} pzSkill = 'add'; pzErrs = 0; solved(''); const a = JSON.parse(JSON.stringify(prog.stats));
  pzLocked = false; pzSkill = 'add'; pzErrs = 2; solved(''); pzLocked = false; pzSkill = null; solved('');
  return { a, b: prog.stats[today()].add, days: Object.keys(prog.stats), key: today() }; })()`);
check('statistiques : réussite du premier coup notée avec le nouveau niveau', JSON.stringify(st.a[st.key].add) === '[1,1,0,4]', st);
check('statistiques : 2e énigme avec 2 erreurs, énigme des parents ignorée', JSON.stringify(st.b) === '[2,1,2,4]' && st.days.length === 1, st);
await sleep(3200);
check('statistiques enregistrées et dans le code de sauvegarde', await ev(`save(), JSON.parse(localStorage.getItem('dino-explorateur-partie1')).stats[today()].add[0] === 2 && JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(exportCode().slice(6)), c => c.charCodeAt(0)))).stats[today()].add[0] === 2`));
const clean = await ev(`(() => { const st = { 'pas-une-date': { add: [1, 1, 0, 1] }, '2026-10-01': { add: [3, 5, 1, 12], inconnu: [1, 1, 1, 1], count: [1, 'x', 0, 1] } };
  for (let i = 0; i < 450; i++) { const d = new Date(2024, 0, 1 + i); st[d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')] = { add: [1, 0, 1, 2] }; }
  const p = cleanProg({ stats: st }); const days = Object.keys(p.stats);
  return { n: days.length, last: days[days.length - 1], oct: p.stats['2026-10-01'] }; })()`);
check('statistiques nettoyées : 400 jours, valeurs corrigées', clean.n === 400 && clean.last === '2026-10-01' && JSON.stringify(clean.oct) === '{"add":[3,3,1,10]}', clean);

check('aucune erreur JavaScript', errors.length === 0, errors);
console.log(fails ? `${fails} échec(s)` : 'Tous les tests passent');
ws.close(); chrome.kill();
process.exit(fails ? 1 : 0);
