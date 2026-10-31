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
const main = part('switch/src/dom.js', readFileSync(join(here, 'src', 'dom.js'), 'utf8'))
  + part('index.html (code du jeu)', m[1])
  + part('switch/src/switch.js', readFileSync(join(here, 'src', 'switch.js'), 'utf8'));
mkdirSync(join(here, 'romfs'), { recursive: true });
writeFileSync(join(here, 'romfs', 'main.js'), main);
console.log(`romfs/main.js prêt (${Math.round(main.length / 1024)} Ko)`);
