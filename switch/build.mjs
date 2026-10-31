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

const kb = f => Math.round(readFileSync(join(out, f)).length / 1024) + ' Ko';
console.log(`romfs/webapp prêt : index.html ${kb('index.html')}, jeu.js ${kb('jeu.js')}, polyfills.js ${kb('polyfills.js')}, test.html ${kb('test.html')}`);
