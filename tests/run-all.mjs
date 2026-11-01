// Lance tous les tests (tests/test-*.mjs) l'un après l'autre : node tests/run-all.mjs index.html
// Un fichier qui échoue est relancé une fois (Chrome sans fenêtre a parfois un souci de minutage) ;
// s'il passe au 2e essai, c'est signalé comme avertissement. Code de sortie 1 si un fichier échoue deux fois.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const page = process.argv[2] || join(here, '..', 'index.html');
const files = readdirSync(here).filter(f => /^test-.*\.mjs$/.test(f)).sort();
const ci = !!process.env.GITHUB_ACTIONS;
const failed = [], flaky = [];
for (const f of files) {
  let ok = false;
  for (let essai = 1; essai <= 2 && !ok; essai++) {
    const t = Date.now();
    const r = spawnSync(process.execPath, [join(here, f), page], { encoding: 'utf8', timeout: 10 * 60e3 });
    const out = (r.stdout || '') + (r.stderr || '');
    ok = r.status === 0;
    console.log(`${ok ? 'OK   ' : 'FAIL '} ${f}${essai > 1 ? ' (2e essai)' : ''}  ${Math.round((Date.now() - t) / 1000)} s`);
    if (!ok) {
      const lines = out.split('\n').filter(l => /^FAIL|Error|échec/.test(l)).slice(0, 12);
      console.log((lines.length ? lines : out.split('\n').slice(-15)).map(l => '      ' + l).join('\n'));
    }
    if (ok && essai > 1) flaky.push(f);
  }
  if (!ok) failed.push(f);
}
if (ci) flaky.forEach(f => console.log(`::warning title=Test instable::${f} a réussi seulement au 2e essai`));
if (ci) failed.forEach(f => console.log(`::error title=Test raté::${f} a échoué deux fois`));
console.log(failed.length ? `\n${failed.length} fichier(s) en échec sur ${files.length} : ${failed.join(', ')}` : `\nLes ${files.length} fichiers de tests passent` + (flaky.length ? ` (au 2e essai : ${flaky.join(', ')})` : ''));
process.exit(failed.length ? 1 : 0);
