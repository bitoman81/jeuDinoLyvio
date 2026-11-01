// Assemble le jeu : src/page.html + les fichiers de src/ -> index.html (un seul fichier, comme avant).
//   node build.mjs           fabrique index.html
//   node build.mjs --check   vérifie seulement que index.html est à jour (tests sur GitHub)
// Dans src/page.html, une ligne « <!-- inclure chemin --> » est remplacée par le fichier src/chemin.
// Pas de dépendance : Node seul. Les fins de ligne suivent celles de src/page.html.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, 'src'), OUT = join(here, 'index.html');
const lf = t => t.replace(/\r\n/g, '\n');

export function build() {
  const raw = readFileSync(join(SRC, 'page.html'), 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const seen = new Set();
  const out = lf(raw).split('\n').map(line => {
    const m = /^<!-- inclure (\S+) -->$/.exec(line);
    if (!m) return line;
    const f = m[1];
    if (seen.has(f)) throw new Error(`${f} est inclus deux fois`);
    seen.add(f);
    const p = join(SRC, f);
    if (!existsSync(p)) throw new Error(`fichier introuvable : src/${f}`);
    const t = lf(readFileSync(p, 'utf8'));
    if (!t.endsWith('\n')) throw new Error(`src/${f} doit finir par un saut de ligne`);
    return t.slice(0, -1);
  }).join('\n');
  return { html: out.split('\n').join(eol), files: seen.size };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { html, files } = build();
  if (process.argv.includes('--check')) {
    const cur = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
    if (lf(cur) !== lf(html)) {
      console.log('index.html n’est pas à jour avec src/ : lancez « node build.mjs » puis ajoutez index.html au commit.');
      process.exit(1);
    }
    console.log(`index.html est à jour (${files} fichiers de src/)`);
  } else {
    writeFileSync(OUT, html);
    console.log(`index.html assemblé : ${files} fichiers de src/, ${Math.round(Buffer.byteLength(html) / 1024)} Ko`);
  }
}
