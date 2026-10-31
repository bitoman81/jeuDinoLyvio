/* ---------- Version Switch (nx.js) : démarrage visible ----------
   Affiche l'étape du chargement en cours, et toute erreur en rouge, au lieu d'un écran noir.
   Une fois le jeu prêt, c'est lui qui dessine l'écran. */
// Journal sur la carte SD (sdmc:/switch/dino-journal.txt) : chaque étape y est écrite, même si l'écran reste noir.
const SW_LOG = 'sdmc:/switch/dino-journal.txt';
function swLog(m) {
  try { if (globalThis.Switch) Switch.appendFileSync(SW_LOG, new Date().toISOString().slice(11, 19) + ' ' + m + '\n'); } catch (e) {}
}
try { if (globalThis.Switch) Switch.writeFileSync(SW_LOG, 'Journal de Dino Explorateur\n'); } catch (e) {}
const SWB = { ctx: screen.getContext('2d'), step: '', ready: false, err: '' };
function swBoot(step, err) {
  SWB.step = step;
  swLog('étape : ' + step + (err ? ' ERREUR ' + String((err && (err.stack || err.message)) || err) : ''));
  if (step === 'prêt') { SWB.ready = true; return; }
  if (err) SWB.err = String((err && (err.stack || err.message)) || err);
  const c = SWB.ctx;
  try {
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1;
    c.fillStyle = '#1f5b3a'; c.fillRect(0, 0, screen.width, screen.height);
    c.textAlign = 'left'; c.textBaseline = 'top';
    c.fillStyle = '#fff7e6'; c.font = '48px sans-serif'; c.fillText('Dino Explorateur', 60, 50);
    c.font = '30px sans-serif'; c.fillText('Chargement : ' + step, 60, 130);
    if (SWB.err) {
      c.fillStyle = '#ffb4a8'; c.font = '26px sans-serif';
      const lines = [];
      SWB.err.split('\n').forEach(l => { while (l.length > 80) { lines.push(l.slice(0, 80)); l = l.slice(80); } lines.push(l); });
      lines.slice(0, 16).forEach((l, i) => c.fillText(l, 60, 200 + i * 32));
      c.fillStyle = '#fff7e6'; c.fillText('Appuie sur + pour quitter. Fais une capture et envoie-la.', 60, 680);
    }
  } catch (e) {}
}
swLog('main.js lancé');
try { addEventListener('error', e => swBoot(SWB.step + ' (erreur)', e && (e.error || e.message))); } catch (e) {}
try { addEventListener('unhandledrejection', e => swBoot(SWB.step + ' (erreur)', e && e.reason)); } catch (e) {}
swBoot('démarrage');
