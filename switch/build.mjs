// Prépare la version Switch (nx.js) : un seul fichier romfs/main.js, que nx.js lance au démarrage.
// Il contient, dans le même module : le faux DOM (src/dom.js), le code du jeu tiré tel quel
// de ../index.html, puis la couche Switch (src/switch.js) qui voit les variables du jeu.
// Ensuite, `npm run nro` fabrique DinoExplorateur.nro.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '..', 'index.html'), 'utf8');
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m) throw new Error('Script du jeu introuvable dans index.html');
if (/console\./.test(m[1])) throw new Error('Le jeu appelle console : sur nx.js, cela repasse l’écran en mode texte');
// Le moteur V8 de nx.js est compilé sans tables Unicode (ICU) : \p{...} dans une expression régulière
// fait refuser tout le fichier (écran noir), et Intl / toLocale... ne sont pas fiables.
const icu = m[1].match(/\\[pP]\{|\bIntl\.|\.toLocale[A-Za-z]*\(|\.localeCompare\(|\.normalize\(/);
// arcTo dessine une boucle en trop sur la Switch (coins des pierres et des panneaux) : utiliser arc().
if (/\.arcTo\(/.test(m[1])) throw new Error('Le jeu utilise arcTo, mal dessiné par nx.js : utiliser arc()');
if (icu) throw new Error(`Le jeu utilise « ${icu[0]} », absent du moteur de la Switch (pas d’ICU)`);

const part = (name, code) => `\n/* ======== ${name} ======== */\n${code}\n`;
// Démarrage : chaque étape s'affiche à l'écran, et une erreur s'écrit en rouge au lieu d'un écran noir.
const boot = readFileSync(join(here, 'src', 'boot.js'), 'utf8');
// nx.js ne montre l'écran qu'entre deux images : on laisse passer quelques images (écran de chargement
// visible) avant de lancer le jeu. Si quelque chose bloque ensuite, l'étape atteinte reste affichée.
const main = boot
  + '\nlet swWaitF = 0;\n'
  + 'function swErrLoop() { swBoot(SWB.step, null); requestAnimationFrame(swErrLoop); }\n'
  + "function swWait() { if (++swWaitF < 4) { swLog('image ' + swWaitF); swBoot('démarrage'); requestAnimationFrame(swWait); return; }\n"
  + 'try {\n(function () {\n'
  + part('switch/src/dom.js', readFileSync(join(here, 'src', 'dom.js'), 'utf8'))
  + "swBoot('code du jeu');\n"
  + part('index.html (code du jeu)', m[1])
  + "swBoot('couche Switch');\n"
  + part('switch/src/switch.js', readFileSync(join(here, 'src', 'switch.js'), 'utf8'))
  + "swBoot('prêt');\n"
  + '})();\n} catch (e) { swBoot(\'erreur\', e); requestAnimationFrame(swErrLoop); }\n}\n'
  + 'requestAnimationFrame(swWait);\n';
mkdirSync(join(here, 'romfs'), { recursive: true });
// Fichier écrit en ASCII pur : chaque caractère accentué devient une séquence \u (même sens pour
// JavaScript), au cas où le moteur lirait mal les accents.
const ascii = main.replace(/[^\x00-\x7f]/g, ch => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'));
writeFileSync(join(here, 'romfs', 'main.js'), ascii);
// Réglages du moteur nx.js. JIT automatique (actif en gardant R sur un jeu, coupé depuis l'album), mais
// sans Sparkplug : avec lui, nx.js 1.0.0-beta plante au démarrage dès qu'il compile une grosse fonction
// (bug nx.js n° 424). Sans JIT du tout (jit = off), le jeu marche mais saccade.
writeFileSync(join(here, 'romfs', 'nxjs.ini'), '[v8]\n; JIT sans Sparkplug (bug nx.js 424)\njit = auto\nflags = --no-sparkplug\n');
console.log(`romfs/main.js prêt (${Math.round(main.length / 1024)} Ko)`);
