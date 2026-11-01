/* ---------- Boucle ---------- */
let last = performance.now(), acc = 0;
// Téléphone tenu en portrait : le jeu attend qu'on le tourne.
const rotateMQ = window.matchMedia ? window.matchMedia('(orientation: portrait) and (pointer: coarse)') : { matches: false };
let playMs = 0;
function loop(now) {
  const step = Math.min(100, now - last);
  acc += step; last = now;
  // Temps de jeu : compté dans les endroits et les énigmes, ajouté à la partie chaque seconde.
  if (L && (state === 'play' || state === 'puzzle')) { playMs += step; if (playMs >= 1000) { const n = Math.floor(playMs / 1000), day = statDay(); prog.time += n; day.sec = (day.sec || 0) + n; playMs %= 1000; } }
  if (L && state === 'play' && !rotateMQ.matches) {
    while (acc >= 1000 / 60) {
      time += 1 / 60; if (cooldown > 0) cooldown--;
      L.oy = MODES[L.mode].oy();
      MODES[L.mode].step(); acc -= 1000 / 60;
      if (state !== 'play') break;
    }
    if (state === 'play' && now - lastAutosave > AUTOSAVE_MS) autosave();
  } else { acc = 0; if (L) time += 1 / 60; }
  if (L && state !== 'menu') { L.oy = MODES[L.mode].oy(); MODES[L.mode].render(); }
  try { musicTick(); } catch (e) { prog.music = false; }
  requestAnimationFrame(loop);
}

/* ---------- HUD ---------- */
function renderHudEggs(popIndex = -1) {
  $('hudEggs').innerHTML = [0, 1, 2].map(i => EGG_SVG('egg-i' + (i < eggsRun ? '' : ' off') + (i === popIndex ? ' pop' : ''))).join('');
}

