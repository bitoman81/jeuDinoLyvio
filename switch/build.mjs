// Prépare la version Switch à partir du jeu (../index.html) :
// - le JavaScript est traduit en ES5 : le moteur web de la console est ancien et refuse par exemple `const` ;
// - les fonctions récentes (Array.from, Object.entries, Promise…) viennent de core-js ;
// - les polices Google ne sont pas chargées : la console est hors ligne ;
// - la page de test (web/test.html) est ajoutée.
// Tout va dans romfs/webapp, que le Makefile range dans le .nro.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import babel from '@babel/core';
import { parse } from 'acorn';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const out = join(here, 'romfs', 'webapp');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

let html = readFileSync(join(here, '..', 'index.html'), 'utf8');
html = html.replace(/<link[^>]+fonts\.(googleapis|gstatic)\.com[^>]*>\s*/g, '');
const m = html.match(/<script>([\s\S]*)<\/script>/);
if (!m) throw new Error('Script du jeu introuvable dans index.html');

const es5 = babel.transformSync(m[1], {
  presets: [[require.resolve('@babel/preset-env'), { targets: 'ie 11', modules: false }]],
  sourceType: 'script', babelrc: false, configFile: false, compact: false,
}).code;
// Vérifie que le résultat est bien de l'ES5 pur.
parse(es5, { ecmaVersion: 5, sourceType: 'script' });

writeFileSync(join(out, 'polyfills.js'), readFileSync(require.resolve('core-js-bundle/minified.js')));
writeFileSync(join(out, 'jeu.js'), es5);
html = html.replace(m[0], () => '<script src="polyfills.js"></script>\n<script src="jeu.js"></script>');
writeFileSync(join(out, 'index.html'), html);
const test = readFileSync(join(here, 'web', 'test.html'), 'utf8');
for (const s of test.match(/<script>([\s\S]*?)<\/script>/g) || []) parse(s.slice(8, -9), { ecmaVersion: 5, sourceType: 'script' });
copyFileSync(join(here, 'web', 'test.html'), join(out, 'test.html'));

// bip.wav pour la page de test : 0,3 seconde à 660 Hz, 22 050 Hz, 16 bits, mono.
const rate = 22050, count = Math.round(rate * .3), wav = Buffer.alloc(44 + count * 2);
wav.write('RIFF', 0); wav.writeUInt32LE(36 + count * 2, 4); wav.write('WAVE', 8); wav.write('fmt ', 12);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(rate, 24);
wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(count * 2, 40);
for (let i = 0; i < count; i++) wav.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 660 * i / rate) * 9000 * Math.min(1, (count - i) / 800)), 44 + i * 2);
writeFileSync(join(out, 'bip.wav'), wav);

const kb = f => Math.round(readFileSync(join(out, f)).length / 1024) + ' Ko';
console.log(`romfs/webapp prêt : index.html ${kb('index.html')}, jeu.js ${kb('jeu.js')}, polyfills.js ${kb('polyfills.js')}, test.html ${kb('test.html')}`);
