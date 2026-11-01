// Étape 5 (fin) : puzzle à pièces et miroir (symétrie), avec aide payante et aide gratuite après 2 erreurs.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const page = pathToFileURL(process.argv[2]).href;
const port = 9336;
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
await send('Page.navigate', { url: page }); await sleep(300);
for (let k = 0; k < 50; k++) { try { if (await ev(`typeof startLevel === 'function' && !!prog`)) break; } catch {} await sleep(200); }
await sleep(300);
let fails = 0;
const check = (name, ok, info = '') => { console.log((ok ? 'OK   ' : 'FAIL ') + name + (ok ? '' : '  ' + JSON.stringify(info))); if (!ok) fails++; };

await ev(`window.said = []; say = t => said.push(t); prog = cleanProg(null); applySkins(); startLevel('rex', 0); cooldown = 99999; true`);
// Ouvre une énigme précise à un niveau donné
const open = (type, lvl, n = 0) => ev(`(() => { closePuzzle(false); prog.skills.logique.lvl = ${lvl}; prog.bag.n = ${n}; varyType = t => t; openPuzzle({ type: '${type}', k: 0, x: 0, w: 1, eggY: 0 }); return true; })()`);
const clickPc = i => ev(`(() => { const b = document.querySelector('.jig .pc[data-p="${i}"]'); b.click(); return true; })()`);
const clickSlot = s => ev(`(() => { document.querySelector('.jig .slot[data-s="${s}"]').click(); return true; })()`);
const jig = () => ev(`({ slots: document.querySelectorAll('.jig .slot').length, tray: [...document.querySelectorAll('.jig .pc')].map(b => +b.dataset.p), placed: document.querySelectorAll('.jig .slot svg').length, ghost: !!document.querySelector('.jig .ghost-img'), glow: [...document.querySelectorAll('.jig .hint')].map(b => b.dataset.p ?? 's' + b.dataset.s) })`);

// 1. Les deux énigmes sont tirées dans les familles, et comptent pour la logique
check('dans les familles et la compétence logique', await ev(`FAMILY.compare.includes('pieces') && FAMILY.sequence.includes('symetrie') && TYPE_SKILL.pieces === 'logique' && TYPE_SKILL.symetrie === 'logique'`));

// 2. Puzzle à pièces, niveau 1 : 4 pièces, le dessin pâle aide
await open('pieces', 1);
let j = await jig();
check('puzzle : 4 places, 4 pièces, dessin pâle', j.slots === 4 && j.tray.length === 4 && j.ghost, j);
await clickPc(j.tray[0]); await clickSlot(j.tray[0]);
j = await jig();
check('une pièce à sa place se pose', j.placed === 1 && j.tray.length === 3, j);
// Une place libre qui n'est pas celle de la pièce choisie
const p = j.tray[0], wrong = j.tray.find(s => s !== p);
await clickPc(p); await clickSlot(wrong);
j = await jig();
check('mauvaise place : la pièce reste en bas', j.placed === 1 && j.tray.length === 3 && await ev(`pzErrs === 1`), j);
await clickSlot(wrong);
j = await jig();
check('2 erreurs : une pièce est posée gratuitement', j.placed === 2 && await ev(`said.at(-1) === 'Je te pose une pièce.' && prog.bag.n === 0`), j);
for (const i of (await jig()).tray) { await clickPc(i); await clickSlot(i); }
check('dessin complet : énigme réussie', await ev(`pzLocked && pzStars === 1 && document.querySelector('.pz-stars') !== null`));
await sleep(1800);

// 3. Aide payante du puzzle
await open('pieces', 4, 30);
j = await jig();
check('niveau 4 : 6 pièces, aide proposée', j.slots === 6 && !(await ev(`$('pzHelp').hidden`)) && (await ev(`$('helpCut').textContent`)).includes('Poser une pièce'), j);
await ev(`$('helpCut').click(); true`);
j = await jig();
check('poser une pièce : 5 trésors', j.placed === 1 && await ev(`prog.bag.n === 25 && pzErrs === 1`), j);
await ev(`$('helpHint').click(); true`);
j = await jig();
const pg = j.glow.find(g => !g.startsWith('s'));
check('montrer la place : 10 trésors, la pièce et sa place brillent', j.glow.length === 2 && pg !== undefined && j.glow.includes('s' + pg) && await ev(`prog.bag.n === 15`), j);
await ev(`$('pzBack').click(); true`);

// 4. Pièces tournées au niveau 9
await open('pieces', 9);
j = await jig();
check('niveau 9 : 9 pièces, sans dessin pâle', j.slots === 9 && !j.ghost, j);
const turned = await ev(`[...document.querySelectorAll('.jig .pc')].filter(b => b.style.getPropertyValue('--rot') !== '0deg').map(b => +b.dataset.p)`);
if (turned.length) {
  const t = turned[0];
  await clickPc(t); await clickSlot(t);
  check('pièce tournée à la bonne place : on explique de la tourner', await ev(`said.at(-1).includes('tourner') && !document.querySelector('.jig .slot[data-s="${t}"] svg')`));
  for (let r = 0; r < 4; r++) { if (await ev(`document.querySelector('.jig .pc[data-p="${t}"]').style.getPropertyValue('--rot') === '0deg'`)) break; await clickPc(t); }
  await clickSlot(t);
  check('tournée dans le bon sens : elle se pose', await ev(`!!document.querySelector('.jig .slot[data-s="${t}"] svg')`));
} else check('niveau 9 : au moins une pièce tournée', false, turned);
await ev(`$('pzBack').click(); true`);

// 5. Miroir, niveau 1 : une couleur, grille 4 x 4
const symState = () => ev(`[...document.querySelectorAll('.sym button')].map(b => [b.classList.contains('given'), b.style.background || '', +b.dataset.i])`);
await open('symetrie', 1, 30);
let cells = await symState();
check('miroir : 16 cases, la moitié gauche est donnée', cells.length === 16 && cells.filter(c => c[0]).length === 8, cells.length);
// Les cases à colorier : le reflet des cases colorées de gauche
const targets = await ev(`(() => { const bs = [...document.querySelectorAll('.sym button')], cols = 4; return bs.filter(b => !b.classList.contains('given')).map(b => +b.dataset.i).filter(i => { const r = (i / cols) | 0, c = i % cols; return !!bs[r * cols + cols - 1 - c].style.background; }); })()`);
const blanks = await ev(`[...document.querySelectorAll('.sym button:not(.given)')].map(b => +b.dataset.i).filter(i => !${JSON.stringify(targets)}.includes(i))`);
await ev(`document.querySelector('.sym button[data-i="${blanks[0]}"]').click(); true`);
check('case qui reste blanche : erreur, pas coloriée', await ev(`pzErrs === 1 && !document.querySelector('.sym button[data-i="${blanks[0]}"]').style.background && said.at(-1).includes('blanche')`));
await ev(`$('helpHint').click(); true`);
check('montrer les cases : elles brillent', await ev(`[...document.querySelectorAll('.sym .hint')].length === ${targets.length} && prog.bag.n === 20`));
await ev(`document.querySelector('.sym button[data-i="${blanks[0]}"]').click(); true`);
check('2 erreurs : une case coloriée gratuitement', await ev(`said.at(-1) === "Je t'en colorie une." || pzLocked`));
for (const i of targets) await ev(`(() => { const b = document.querySelector('.sym button[data-i="${i}"]'); if (b && !b.style.background) b.click(); return true; })()`);
check('les deux côtés pareils : réussi', await ev(`pzLocked && pzStars === 1`));
await sleep(1800);

// 6. Miroir, niveau 8 : deux couleurs à choisir
await open('symetrie', 8);
check('niveau 8 : 48 cases, 2 couleurs à choisir', await ev(`document.querySelectorAll('.sym button').length === 48 && pz.choices.querySelectorAll('button.choice').length === 2`));
const bad = await ev(`(() => { const bs = [...document.querySelectorAll('.sym button')], cols = 8, col = getComputedStyle(pz.choices.querySelector('button[aria-pressed="true"] .dot')).backgroundColor;
  const i = bs.filter(b => !b.classList.contains('given')).map(b => +b.dataset.i).find(i => { const m = bs[((i / cols) | 0) * cols + cols - 1 - i % cols]; return m.style.background && getComputedStyle(m).backgroundColor !== col; });
  if (i === undefined) return -1; bs[i].click(); return i; })()`);
check('mauvaise couleur : erreur', bad >= 0 && await ev(`pzErrs === 1 && said.at(-1).includes('Pas cette couleur')`), bad);
await ev(`$('pzBack').click(); true`);

// 7. Petit téléphone en paysage : pas de défilement de côté
await send('Emulation.setDeviceMetricsOverride', { width: 740, height: 360, deviceScaleFactor: 1, mobile: true });
await sleep(150);
for (const [t, l] of [['pieces', 7], ['symetrie', 7]]) {
  await open(t, l);
  const fit = await ev(`(() => { const c = $('pzCard'); return [c.scrollWidth <= c.clientWidth + 1, c.getBoundingClientRect().right <= innerWidth]; })()`);
  check(`${t} tient en largeur sur 740 x 360`, fit[0] && fit[1], fit);
  await ev(`$('pzBack').click(); true`);
}
await send('Emulation.clearDeviceMetricsOverride');

// 8. Nom des lettres : de vrais mots, sinon la voix épelle (« èl » devenait « E accent grave L »)
const letters = await ev(`JSON.stringify(LETTER)`);
check('nom des lettres : plus de « èl », « èm »…', !/"(èf|èl|èm|èn|èr|èss|zèd|iks|ku)"/.test(letters) && JSON.parse(letters).L === 'elle', letters);

check('aucune erreur JavaScript', errors.length === 0, errors);
console.log(fails ? `${fails} échec(s)` : 'Tous les tests passent');
ws.close(); chrome.kill();
process.exit(fails ? 1 : 0);
