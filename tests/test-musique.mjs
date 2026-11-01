// Étape 13 : la musique (un morceau par animal, calculé par le jeu).
// Usage : node tests/test-musique.mjs index.html [dossier des captures]
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const page = pathToFileURL(process.argv[2]).href;
const port = 9349;
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
await ev(`slotNew(0, 'Test'); leaveParties(); true`);

// 1. Chaque morceau : 8 mesures, pas muet, jamais trop fort, toujours le même
const songs = await ev(`(() => { const a = new OfflineAudioContext(1, 48000, 48000), out = {};
  for (const k in SONGS) { const t0 = performance.now(); delete SONG_CACHE[k]; const b = songBuffer(a, k), d = b.getChannelData(0);
    let peak = 0, sum = 0; for (let i = 0; i < d.length; i++) { peak = Math.max(peak, Math.abs(d[i])); sum += d[i] * d[i]; }
    delete SONG_CACHE[k]; const d2 = songBuffer(a, k).getChannelData(0);
    out[k] = { sec: +b.duration.toFixed(2), want: +(32 * 60 / SONGS[k].bpm).toFixed(2), peak: +peak.toFixed(3), rms: +Math.sqrt(sum / d.length).toFixed(3), same: d[12345] === d2[12345] && d[d.length - 7] === d2[d.length - 7], ms: Math.round(performance.now() - t0) }; }
  return out; })()`);
for (const [k, r] of Object.entries(songs)) check(`morceau « ${k} » : ${r.sec} s, pas muet, pas trop fort, toujours le même (${r.ms} ms pour deux calculs)`, Math.abs(r.sec - r.want) < .05 && r.rms > .02 && r.peak <= .951 && r.same, r);

// 2. Le bon morceau au bon moment, prévu un peu à l'avance (son de l'appareil imité)
await ev(`(() => { const off = new OfflineAudioContext(1, 48000, 48000);
  window.__started = []; window.__stopped = 0;
  actx = { sampleRate: 48000, currentTime: 10, state: 'running', destination: {},
    createBuffer: (...x) => off.createBuffer(...x),
    createGain: () => ({ gain: { setValueAtTime() {} }, connect() {} }),
    createBufferSource: () => { const s = { connect() {}, start(t) { __started.push([music.theme, t]); }, stop() { __stopped++; } }; return s; } };
  SFX.key = SFX.yay = SFX.pop = SFX.no = () => {};
  showMenu(); musicTick(); return true; })()`);
check('menu : la musique du menu commence', await ev(`music.theme === 'menu' && __started.length === 1 && Math.abs(__started[0][1] - 10.1) < .01`), await ev('[music.theme, __started]'));
await ev(`musicTick(); true`);
check('pas de deuxième morceau trop tôt', await ev(`__started.length === 1`));
await ev(`actx.currentTime = music.next - 1; musicTick(); true`);
check('la suite est prévue juste à la fin du morceau', await ev(`__started.length === 2 && Math.abs(__started[1][1] - (10.1 + SONG_CACHE.menu.duration)) < .01`), await ev('__started'));
await ev(`startLevel('trike', 0); musicTick(); true`);
check('dans un endroit du tricératops : sa musique, l’ancienne s’arrête', await ev(`music.theme === 'trike' && __started.at(-1)[0] === 'trike' && __stopped >= 2`), await ev('[music.theme, __started.length, __stopped]'));
await ev(`state = 'puzzle'; musicTick(); true`);
check('pendant une énigme : la même musique continue', await ev(`music.theme === 'trike' && __started.at(-1)[0] === 'trike' && __started.length === 3`));
await ev(`state = 'play'; startLevel('final', 1); musicTick(); true`);
check('île secrète : la musique de l’animal de l’endroit', await ev(`music.theme === L.sp.key`), await ev('[music.theme, L.sp.key]'));

// 3. Couper la musique (bouton du menu), ou tout le son
await ev(`showMenu(); $('menuMusic').click(); musicTick(); true`);
check('bouton musique : coupée, enregistrée, icône barrée', await ev(`!prog.music && music.theme === '' && JSON.parse(localStorage.getItem(SLOT_KEY(slots.cur))).music === false && $('menuMusic').getAttribute('aria-pressed') === 'false'`));
await ev(`$('menuMusic').click(); musicTick(); true`);
check('bouton musique : remise', await ev(`prog.music && music.theme === 'menu'`));
await ev(`prog.sound = false; musicTick(); true`);
check('son coupé : pas de musique', await ev(`music.theme === ''`));
await ev(`prog.sound = true; prog.music = false; slotNew(1, 'Autre'); true`);
check('nouvelle partie : la musique reste réglée comme sur l’appareil', await ev(`prog.music === false`));
check('code de sauvegarde : sans le réglage de la musique', await ev(`!('music' in JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(exportCode().slice(6)), c => c.charCodeAt(0)))))`));
await ev(`actx = null; music.srcs = []; music.gain = null; music.theme = ''; true`);
await sleep(150); await shot('musique-menu.png');

check('aucune erreur JavaScript', errors.length === 0, errors);
console.log(fails ? `${fails} échec(s)` : 'Tous les tests passent');
ws.close(); chrome.kill();
process.exit(fails ? 1 : 0);
