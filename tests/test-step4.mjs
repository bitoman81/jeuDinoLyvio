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
await ev(`say = () => {}; true`);

// 1. Nouvelles énigmes à chaque niveau
const gen = await ev(`(() => {
  const bad = [], txt = b => b.textContent.trim();
  const types = ['numseq', 'parity', 'coins', 'clock', 'intrus', 'wordpic'];
  state = 'puzzle'; $('puzzle').hidden = false;
  for (const t of types) for (let k = 1; k <= 10; k++) for (let r = 0; r < 40; r++) {
    prog.skills[TYPE_SKILL[t]].lvl = k; pzLocked = false;
    try { PUZZLES[t](); } catch (e) { bad.push([t, k, String(e)]); continue; }
    const btns = [...pz.choices.querySelectorAll('button')], labels = btns.map(b => b.getAttribute('aria-label') || txt(b));
    const want = { numseq: nChoices(k), parity: 2, coins: nChoices(k), clock: nChoices(k), intrus: k <= 6 ? 4 : 5, wordpic: nChoices(k) }[t];
    if (btns.length !== want) bad.push([t, k, 'nb choix', btns.length]);
    if (t !== 'intrus' && new Set(labels).size !== labels.length) bad.push([t, k, 'doublon', labels]);
    if (t === 'numseq') {
      const v = [...pz.visual.querySelectorAll('.num:not(.q)')].map(e => +e.textContent), st = v[1] - v[0], ans = v[v.length - 1] + st;
      if (v.some((x, i) => i && x - v[i - 1] !== st)) bad.push([t, k, 'suite irrégulière', v]);
      if (ans < 0 || btns.filter(b => +txt(b) === ans).length !== 1) bad.push([t, k, 'réponse', v, labels]);
    }
    if (t === 'coins') {
      const sum = [...pz.visual.querySelectorAll('.coin')].reduce((a, c) => a + +c.dataset.v, 0);
      if (!labels.includes(eurosSaid(sum))) bad.push([t, k, 'somme absente', sum, labels]);
      if (k <= 2 && pz.visual.querySelector('.coin:not(.c100)')) bad.push([t, k, 'trop dur']);
      if (k <= 8 && pz.visual.querySelector('.c10, .c20')) bad.push([t, k, 'centimes trop tôt']);
    }
    if (t === 'clock') {
      if (k <= 4 && labels.some(l => !l.endsWith('heure') && !l.endsWith('heures'))) bad.push([t, k, 'minutes trop tôt', labels]);
    }
    if (t === 'intrus') {
      const shapes = btns.map(b => b.querySelector('g').innerHTML), fills = btns.map(b => b.querySelector('g').getAttribute('fill'));
      const key = btns.map((b, i) => shapes[i] + (k <= 6 ? fills[i] : ''));
      const uniq = key.filter(x => key.indexOf(x) === key.lastIndexOf(x));
      if (uniq.length !== 1) bad.push([t, k, 'pas un seul intrus', key.length, uniq.length]);
    }
    if (t === 'wordpic' && k <= 3 && labels.some(l => l.length > 4)) bad.push([t, k, 'mots longs', labels]);
  }
  $('puzzle').hidden = true; state = 'menu';
  return bad.slice(0, 8); })()`);
check('nouvelles énigmes valides aux 10 niveaux (2400 tirages)', gen.length === 0, gen);

// Bonne réponse marquée : on clique la bonne et on vérifie qu'elle est acceptée
const okAll = await ev(`(async () => {
  const res = {};
  for (const t of ['numseq', 'parity', 'coins', 'clock', 'intrus', 'wordpic']) {
    prog.skills[TYPE_SKILL[t]].lvl = 5;
    let good = 0;
    for (let r = 0; r < 10; r++) {
      state = 'puzzle'; $('puzzle').hidden = false; pzLocked = false; pzErrs = 0; currentGate = null;
      let okBtn = null; const orig = choicePuzzle;
      choicePuzzle = o => { orig(o); const i = o.choices.findIndex(c => c.ok); okBtn = pz.choices.querySelectorAll('button')[i]; if (o.choices.filter(c => c.ok).length !== 1) okBtn = null; };
      PUZZLES[t](); choicePuzzle = orig;
      if (okBtn) { okBtn.click(); if (pzLocked && pzErrs === 0) good++; }
    }
    res[t] = good;
  }
  $('puzzle').hidden = true; state = 'menu';
  return res; })()`);
check('une seule bonne réponse, acceptée du premier coup', Object.values(okAll).every(v => v === 10), okAll);
await sleep(1800);

// Réponses justes, vérifiées à la main sur des cas fixes
check('heure : textes', await ev(`hourText(180) === '3 h' && hourSaid(180) === '3 heures' && hourSaid(90) === '1 heure et demie' && hourSaid(555) === '9 heures et quart' && hourText(645) === '10 h 45'`));
check('euros : textes', await ev(`euros(350) === '3,50 €' && euros(200) === '2 €' && eurosSaid(350) === '3 euros 50' && eurosSaid(100) === '1 euro' && eurosSaid(70) === '70 centimes'`));
check('intrus : accords', await ev(`shapeName('etoile', COLORS[3]) === 'une étoile verte' && shapeName('carre', COLORS[1]) === 'un carré bleu'`));

// 2. Mots
const bag = await ev(`(() => { const seen = []; for (let i = 0; i < 40; i++) seen.push(pickWord(1)); const mid = []; for (let i = 0; i < 57; i++) mid.push(pickWord(5)); return { petit: new Set(seen).size, allShort: seen.every(w => w.length <= 4), mid: new Set(mid).size, midMax: Math.max(...mid.map(w => w.length)), again: pickWord(1).length > 0 }; })()`);
check('40 mots courts sans répétition', bag.petit === 40 && bag.allShort, bag);
check('niveaux 4 à 6 : 57 mots de 6 lettres au plus, sans répétition', bag.mid === 57 && bag.midMax <= 6, bag);
check('sac vide : il se remplit', bag.again);

// 3. Variété des énigmes
const vary = await ev(`(() => {
  prog.diff = 'grand'; Object.values(prog.skills).forEach(s => s.lvl = 1);
  const seen = {}; let repeat = 0;
  for (let i = 0; i < 400; i++) { const g = pick(['count', 'add', 'compare', 'sequence', 'first']); const t = varyType(g); if (t === lastType && FAMILY[g].some(x => x !== t && (!READY[x] || READY[x]()))) repeat++; lastType = t; seen[t] = 1; }
  const early = !seen.parity && !seen.coins;
  prog.skills.count.lvl = 5; prog.skills.add.lvl = 2;
  for (let i = 0; i < 400; i++) { const t = varyType(pick(['count', 'add'])); lastType = t; seen[t] = 1; }
  return { repeat, early, seen: Object.keys(seen).sort() }; })()`);
check('jamais deux fois la même énigme de suite', vary.repeat === 0, vary);
check('pair/impair et pièces seulement quand le niveau le permet', vary.early, vary);
check('toutes les énigmes sortent', ['add', 'clock', 'coins', 'compare', 'count', 'first', 'intrus', 'numseq', 'parity', 'sequence', 'wordpic'].every(t => vary.seen.includes(t)), vary.seen);
const flow = await ev(`(() => { startLevel('trike', 0); const g = L.gates[0]; const out = []; for (let i = 0; i < 30; i++) { openPuzzle(g); out.push(lastType + ':' + pzSkill); pzLocked = true; $('puzzle').hidden = true; state = 'play'; } return [...new Set(out)]; })()`);
check('pierre "compter" : énigmes et compétences cohérentes', flow.every(x => ['count:count', 'parity:count', 'coins:add', 'dots:count'].includes(x)), flow);

// 4. Espace parents : nouvelles compétences
await ev(`renderParents(); true`);
check('parents : 11 compétences', await ev(`document.querySelectorAll('#skillList .skill').length === 11`));
check('ancienne sauvegarde : nouvelles compétences au départ du niveau', await ev(`(() => { const p = cleanProg({ diff: 'expert', skills: { count: { lvl: 9 } } }); return p.skills.count.lvl === 9 && p.skills.heure.lvl === 7 && p.skills.lire.lvl === 7; })()`));

check('aucune erreur JavaScript', errors.length === 0, errors);
console.log(fails ? `${fails} échec(s)` : 'Tous les tests passent');
ws.close(); chrome.kill();
process.exit(fails ? 1 : 0);
