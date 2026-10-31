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

const part = (name, code) => `\n/* ======== ${name} ======== */\n${code}\n`;
// Démarrage : chaque étape s'affiche à l'écran, et une erreur s'écrit en rouge au lieu d'un écran noir.
const boot = readFileSync(join(here, 'src', 'boot.js'), 'utf8');
const main = boot
  + '\ntry {\n(function () {\n'
  + part('switch/src/dom.js', readFileSync(join(here, 'src', 'dom.js'), 'utf8'))
  + "swBoot('code du jeu');\n"
  + part('index.html (code du jeu)', m[1])
  + "swBoot('couche Switch');\n"
  + part('switch/src/switch.js', readFileSync(join(here, 'src', 'switch.js'), 'utf8'))
  + "swBoot('prêt');\n"
  + '})();\n} catch (e) { swBoot(\'erreur\', e); }\n';
mkdirSync(join(here, 'romfs'), { recursive: true });
writeFileSync(join(here, 'romfs', 'main.js'), main);
// Réglages du moteur nx.js. JIT coupé : avec le JIT (lancement en gardant R sur un jeu), nx.js 1.0.0-beta
// plante au démarrage dès qu'il compile une grosse fonction (bug nx.js n° 424), ce qui donne un écran noir.
writeFileSync(join(here, 'romfs', 'nxjs.ini'), '[v8]\n; JIT coupé : contourne le plantage au démarrage (bug nx.js n° 424)\njit = off\n');
console.log(`romfs/main.js prêt (${Math.round(main.length / 1024)} Ko)`);
