// Étape 15 : une partie de la Switch arrive sur le téléphone (QR code, code de la partie après le # de l'adresse).
// Usage : node tests/test-qr.mjs index.html [dossier des captures]
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const page = pathToFileURL(process.argv[2]).href;
const port = 9352;
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

const go = async hash => {
  // (même page avec seulement un # différent : pas de rechargement, d'où la page vide avant)
  await send('Page.navigate', { url: 'about:blank' }); await sleep(200);
  await send('Page.navigate', { url: page + hash }); await sleep(300);
  for (let k = 0; k < 50; k++) { try { if (await ev(`typeof startLevel === 'function' && !!prog`)) break; } catch {} await sleep(200); }
  await sleep(300); await ev(`say = () => {}; true`);
};

// 1. Le code court de la Switch : sans statistiques ni partie en cours, avec le nom ; assez court pour un QR code
await load();
await wipe(`localStorage.clear()`);
await load();
await ev(`slotNew(0, 'Lyvio'); prog.bag.n = 42; prog.worlds.rex.eggs[0] = 3; prog.worlds.rex.medals[0] = 2; prog.skills.add.lvl = 6;
  for (let d = 0; d < 60; d++) prog.stats['2026-0' + (1 + d % 9) + '-' + String(10 + d % 18)] = { add: [5, 3, 2, 6], count: [4, 4, 0, 3] };
  startLevel('rex', 0); autosave(); true`);
const sizes = await ev(`({ full: exportCode().length, light: exportCode(true).length })`);
check('code court (DINO3-) : moins de 200 caractères, bien plus court que le code complet', sizes.light < 200 && sizes.light < sizes.full / 5, sizes);
// Aller-retour complet : tout ce qui passe revient à l'identique
const same = await ev(`(() => { const b = prog.bag; b.fossils['rex-0'] = b.fossils['plesio-6'] = b.fossils['final-3'] = true; b.owned['trike:prune'] = true; b.skin.trike = 'prune'; b.power.jump2 = 3; b.power.fin = 2; b.keys.ptero = true; b.maps.rex = true; b.accOwned.couronne = b.accOwned.fleur = true; b.acc.plesio = 'couronne'; prog.world = 'plesio'; prog.diff = 'expert'; prog.hard = 2; prog.time = 98765; prog.worlds.final.unlocked = 3; prog.worlds.ptero.stars[4] = 2; prog.skills.logique.lvl = 10;
  const back = cleanProg({ ...decodeCode(exportShort()), ...devicePrefs() }), keep = x => JSON.stringify({ world: x.world, diff: x.diff, hard: x.hard, time: x.time, worlds: x.worlds, skills: Object.fromEntries(Object.entries(x.skills).map(([k, v]) => [k, v.lvl])), bag: { ...x.bag, fossils: Object.keys(x.bag.fossils).sort() } });
  const ref = cleanProg(JSON.parse(JSON.stringify(prog))); return keep(back) === keep(ref) ? true : [keep(back), keep(ref)]; })()`);
check('code court : œufs, étoiles, médailles, niveaux, sac, couleurs, pouvoirs, clés, accessoires reviennent à l’identique', same === true, same);
const code = await ev(`exportCode(true)`);
const dec = await ev(`decodeCode(${JSON.stringify(code)})`);
check('code court : nom, trésors, œufs, médailles, niveaux ; pas de statistiques ni de partie en cours', dec.name === 'Lyvio' && dec.bag.n === 42 && dec.worlds.rex.eggs[0] === 3 && dec.worlds.rex.medals[0] === 2 && dec.skills.add.lvl === 6 && !dec.stats && dec.run === null, dec);

// 2. Ouvrir le jeu avec le code : la partie arrive, on choisit sa place (place libre)
await wipe(`localStorage.clear()`);
await go('#' + code);
check('au lancement : « Une partie arrive de la Switch : Lyvio », l’adresse est nettoyée', await ev(`!$('parties').hidden && /arrive de la Switch : Lyvio/.test($('incomingText').textContent) && !location.hash`), await ev(`[$('incomingText').textContent, location.hash]`));
await ev(`document.querySelectorAll('#slotList .slot')[1].querySelector('.btn.primary').click(); true`);
check('place libre : la partie de Lyvio y est, menu ouvert', await ev(`slots.cur === 1 && slots.names[1] === 'Lyvio' && prog.bag.n === 42 && prog.worlds.rex.medals[0] === 2 && !$('menu').hidden && !incoming`), await ev('[slots, prog.bag.n]'));

// 3. Place déjà prise : on demande avant de remplacer
await ev(`slotNew(0, 'Papa'); prog.bag.n = 7; save(); true`);
await go('#' + code);
await ev(`document.querySelectorAll('#slotList .slot')[0].querySelector('.btn.primary').click(); true`);
check('place prise : on demande avant de remplacer la partie de Papa', await ev(`/Remplacer la partie de Papa/.test($('slotList').textContent) && slots.names[0] === 'Papa'`));
await ev(`[...document.querySelectorAll('#slotList .slot')[0].querySelectorAll('button')].find(b => b.textContent === 'Non').click(); true`);
check('« Non » : la partie de Papa est gardée, on peut choisir ailleurs', await ev(`slots.names[0] === 'Papa' && !!incoming && /arrive de la Switch/.test($('incomingText').textContent)`));
await sleep(100); await shot('qr-arrivee.png');
await ev(`document.querySelectorAll('#slotList .slot')[0].querySelector('.btn.primary').click(); [...document.querySelectorAll('#slotList .slot')[0].querySelectorAll('button')].find(b => b.textContent === 'Oui, remplacer').click(); true`);
check('« Oui » : la partie de la Switch remplace celle de Papa', await ev(`slots.cur === 0 && slots.names[0] === 'Lyvio' && prog.bag.n === 42`), await ev('[slots, prog.bag.n]'));

// 4. Du téléphone vers la Switch : le QR code « Recevoir » de la Switch ouvre le jeu avec #SEND-adresse:port
await ev(`slotNew(1, 'Zoé'); prog.bag.n = 13; prog.worlds.trike.eggs[0] = 3; save(); slotPlay(0); true`);
await go('#SEND-192.168.1.20:8765');
check('« La Switch attend une partie », adresse nettoyée, un bouton par partie', await ev(`sendTo === '192.168.1.20:8765' && /La Switch attend une partie/.test($('incomingText').textContent) && !location.hash && [...document.querySelectorAll('#slotList button')].filter(b => b.textContent === 'Envoyer vers la Switch').length === 2`), await ev(`[sendTo, $('incomingText').textContent]`));
const url = await ev(`switchUrl(1)`);
const sent = await ev(`decodeCode(${JSON.stringify(url)}.split('#')[1])`);
check('envoyer la partie de Zoé : adresse de la Switch en http, code court de cette partie', url.startsWith('http://192.168.1.20:8765/#DINO3-') && sent.name === 'Zoé' && sent.bag.n === 13 && sent.worlds.trike.eggs[0] === 3, [url.slice(0, 60), sent && sent.name]);
await go('#SEND-pasuneadresse');
check('adresse abîmée : rien', await ev(`!sendTo && $('incomingText').hidden`));

// 4. Un code abîmé dans l'adresse : ignoré
await go('#DINO2-pasbon');
check('code abîmé : rien n’arrive', await ev(`!incoming && $('incomingText').hidden`));

check('aucune erreur JavaScript', errors.length === 0, errors);
console.log(fails ? `${fails} échec(s)` : 'Tous les tests passent');
ws.close(); chrome.kill();
process.exit(fails ? 1 : 0);
