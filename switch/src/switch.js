/* ---------- Version Switch (nx.js) ----------
   Ce fichier vient après le code du jeu, dans le même module : il voit ses variables (L, state, keys…).
   Écrans : titre, menu (choix du dino puis de l'endroit), jeu, fin d'endroit.
   Commandes : croix ou stick pour choisir et marcher, A pour valider et sauter, B pour revenir,
   - pour revenir au menu pendant le jeu, + pour quitter, ZL + ZR pour une capture d'écran.
   Tactile : on touche les cartes du menu ; en jeu, le pouce gauche fait un joystick, la moitié droite agit.
   Les énigmes ne sont pas encore dessinées sur la Switch : la pierre s'ouvre toute seule. */
const SW = {
  ctx: screen.getContext('2d'), prev: {}, toast: '', toastT: 0,
  screen: 'title',          // 'title' | 'menu' | 'game'
  row: 0, wi: 0, lvl: 0,    // menu : rangée (0 animaux, 1 endroits), animal choisi, endroit choisi
  dir: '', dirT: 0,         // répétition de la croix quand on la garde appuyée
  hits: [],                 // zones à toucher du menu (dessinées à chaque image)
};
const SW_BTN = { B: 0, A: 1, Y: 2, X: 3, L: 4, R: 5, ZL: 6, ZR: 7, Minus: 8, Plus: 9, Up: 12, Down: 13, Left: 14, Right: 15 };
const SW_WORLDS = [...ORDER, 'final'];
// Lancé depuis l'album (applet : peu de mémoire, pas de carte graphique), le jeu saccade.
// libnx : AppletType_Application = 0, SystemApplet = 1, LibraryApplet = 2 (l'album), OverlayApplet = 3.
const SW_APPLET = (() => {
  let t = 'ordinateur';
  try { if (globalThis.Switch) t = Switch.appletType(); } catch (e) { t = 'inconnu'; }
  const applet = t === 1 || t === 2 || t === 3;
  swLog('type de lancement : ' + t + (applet ? ' (album)' : ''));
  return applet;
})();

// Un bruitage qui échoue ne doit jamais arrêter le jeu.
const swTone = tone;
tone = (...a) => { try { swTone(...a); } catch (e) { tone = () => {}; } };

function swToast(text) { SW.toast = text; SW.toastT = 150; }

// Énigmes : pas encore sur la Switch. La pierre s'ouvre, l'œuf est gagné.
openPuzzle = g => {
  currentGate = g; pzStars = 3; pzLocked = true;
  closePuzzle(true);
  SFX.yay(); swToast('Bravo, un œuf ! (les énigmes arrivent bientôt sur la Switch)');
};

/* ---------- Passer d'un écran à l'autre ---------- */
const swWorld = () => SW_WORLDS[SW.wi];
const swLevelName = (wk, i) => { const d = WORLDS[wk][i]; return d.bonus && !canPlay(wk, i) ? 'Endroit secret' : d.name; };
function swStart(wk, i) {
  SW.screen = 'game';
  prog.world = wk; save();
  startLevel(wk, i);
  swToast(WORLDS[wk][i].name);
}
// Le menu, avec l'endroit en cours (ou le dernier ouvert) déjà choisi.
function swMenu(row = 0) {
  const cur = L && (state === 'play' || state === 'done') ? L : null;
  if (cur) showMenu();
  SW.screen = 'menu'; SW.row = row;
  SW.wi = Math.max(0, SW_WORLDS.indexOf(prog.world));
  swPickLevel();
  if (cur && cur.world === swWorld()) SW.lvl = cur.i;
}
function swPickLevel() {
  const wk = swWorld();
  SW.lvl = clamp(prog.worlds[wk].unlocked - 1, 0, WORLDS[wk].length - 1);
}
function swNextLevel() {
  const i = L.i + 1;
  if (canPlay(L.world, i)) swStart(L.world, i); else swMenu(1);
}
// Valider l'animal choisi (rangée du haut)
function swChooseWorld() {
  const wk = swWorld();
  if (wk === 'final' && !allMaps()) {
    const n = ORDER.filter(k => prog.bag.maps[k]).length;
    swToast(`L'île secrète s'ouvre avec les 4 morceaux de la carte (tu en as ${n})`);
    return;
  }
  prog.world = wk; save(); SW.row = 1; swPickLevel();
}
// Valider l'endroit choisi (rangée du bas)
function swChooseLevel() {
  const wk = swWorld(), d = WORLDS[wk][SW.lvl];
  if (canPlay(wk, SW.lvl)) { swStart(wk, SW.lvl); return; }
  swToast(d.bonus ? "L'endroit secret s'ouvre avec la clé dorée" : 'Pas encore ouvert : finis les endroits d’avant');
}
function swMove(dir) {
  if (SW.row === 0) {
    if (dir === 'l') SW.wi = (SW.wi + SW_WORLDS.length - 1) % SW_WORLDS.length;
    else if (dir === 'r') SW.wi = (SW.wi + 1) % SW_WORLDS.length;
    else if (dir === 'd') swChooseWorld();
    if (dir === 'l' || dir === 'r') swPickLevel();
  } else {
    const n = WORLDS[swWorld()].length;
    if (dir === 'l') SW.lvl = (SW.lvl + n - 1) % n;
    else if (dir === 'r') SW.lvl = (SW.lvl + 1) % n;
    else if (dir === 'u') SW.row = 0;
  }
  SFX.key && SFX.key();
}

// Capture d'écran (ZL + ZR) : une image PNG sur la carte SD, dans switch/dino-captures/
// (avec Atmosphère, l'album de la Switch est remplacé par le menu homebrew).
const SW_CAP_DIR = 'sdmc:/switch/dino-captures/';
function swCapture() {
  if (!globalThis.Switch || !screen.toBlob) return;
  const d = new Date(), p = n => String(n).padStart(2, '0');
  const name = `capture-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.png`;
  try {
    screen.toBlob(b => {
      if (!b) { swToast("La capture n'a pas marché"); return; }
      b.arrayBuffer().then(buf => {
        try { Switch.mkdirSync(SW_CAP_DIR); } catch (e) {}
        Switch.writeFileSync(SW_CAP_DIR + name, buf);
        swLog('capture : ' + name); swToast('Capture enregistrée : ' + name);
      }).catch(e => swToast("La capture n'a pas marché"));
    });
  } catch (e) { swToast("La capture n'a pas marché"); }
}

/* ---------- Manette ---------- */
function swPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const pad = pads && pads[0];
  if (!pad) return;
  const on = i => !!(pad.buttons[i] && pad.buttons[i].pressed);
  const down = i => { const was = SW.prev[i]; SW.prev[i] = on(i); return SW.prev[i] && !was; };
  const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
  const left = on(SW_BTN.Left) || ax < -.35, right = on(SW_BTN.Right) || ax > .35;
  const up = on(SW_BTN.Up) || ay < -.5, dn = on(SW_BTN.Down) || ay > .5;
  const zl = down(SW_BTN.ZL), zr = down(SW_BTN.ZR);
  if ((zl || zr) && on(SW_BTN.ZL) && on(SW_BTN.ZR)) swCapture();
  const a = down(SW_BTN.A), b = down(SW_BTN.B), minus = down(SW_BTN.Minus);

  if (SW.screen === 'title') { if (a) swMenu(); return; }
  if (SW.screen === 'menu') {
    // La croix agit une fois, puis se répète si on la garde appuyée.
    const dir = left ? 'l' : right ? 'r' : up ? 'u' : dn ? 'd' : '', now = performance.now();
    if (dir && (dir !== SW.dir || now > SW.dirT)) { swMove(dir); SW.dirT = now + (dir !== SW.dir ? 380 : 150); }
    SW.dir = dir;
    if (a) { if (SW.row === 0) swChooseWorld(); else swChooseLevel(); }
    else if (b) { if (SW.row === 1) SW.row = 0; else SW.screen = 'title'; }
    return;
  }
  if (minus) { swMenu(1); return; }
  if (state === 'done') { if (a) swNextLevel(); else if (b) swMenu(1); return; }
  if (state !== 'play') return;
  keys.left = left; keys.right = right; keys.up = up; keys.down = dn;
  if (a || b) jumpPressed = true;
}

/* ---------- Écran tactile ---------- */
setTouchUI(true);
function swTouch(type, e) {
  const list = e.changedTouches && e.changedTouches.length ? e.changedTouches : e.touches || [];
  const t0 = list[0];
  if (type === 'pointerdown' && SW.screen === 'title') { swMenu(); return; }
  if (SW.screen === 'menu') {
    if (type !== 'pointerdown' || !t0) return;
    const h = SW.hits.find(z => t0.clientX >= z.x && t0.clientX <= z.x + z.w && t0.clientY >= z.y && t0.clientY <= z.y + z.h);
    if (h) h.fn();
    return;
  }
  if (type === 'pointerdown' && state === 'done') { swNextLevel(); return; }
  if (type === 'pointerdown' && t0 && t0.clientX > SW_W - 140 && t0.clientY < 90) { swMenu(1); return; }
  for (let k = 0; k < list.length; k++) {
    const t = list[k];
    const ev = { pointerId: t.identifier === undefined ? k : t.identifier, clientX: t.clientX, clientY: t.clientY, preventDefault() {} };
    (swCanvasListeners[type] || []).forEach(fn => fn(ev));
  }
}
screen.addEventListener('touchstart', e => swTouch('pointerdown', e));
screen.addEventListener('touchmove', e => swTouch('pointermove', e));
screen.addEventListener('touchend', e => swTouch('pointerup', e));
screen.addEventListener('touchcancel', e => swTouch('pointercancel', e));

/* ---------- Petits dessins ---------- */
const SW_INK = '#1d2b22', SW_PAPER = '#fff7e6', SW_SUN = '#ffb238';
function swPanel(x, y, w, h, fill = SW_PAPER) {
  const c = SW.ctx;
  c.fillStyle = fill; c.strokeStyle = SW_INK; c.lineWidth = 4;
  rr(c, x, y, w, h, 18); c.fill(); c.stroke();
}
function swText(t, x, y, size, color = SW_INK, align = 'left') {
  const c = SW.ctx; c.font = `${size}px sans-serif`; c.fillStyle = color; c.textAlign = align; c.textBaseline = 'middle'; c.fillText(t, x, y);
}
// Taille de police la plus grande (jusqu'à `size`) pour que le texte tienne dans `maxW`.
function swFit(t, maxW, size, min = 14) {
  const c = SW.ctx;
  for (; size > min; size -= 2) { c.font = `${size}px sans-serif`; if (c.measureText(t).width <= maxW) break; }
  return size;
}
// Coupe un texte en lignes qui tiennent dans maxW.
function swWrap(t, maxW, size) {
  const c = SW.ctx; c.font = `${size}px sans-serif`;
  const lines = []; let cur = '';
  t.split(' ').forEach(w => { const s = cur ? cur + ' ' + w : w; if (c.measureText(s).width > maxW && cur) { lines.push(cur); cur = w; } else cur = s; });
  if (cur) lines.push(cur);
  return lines;
}
function swEgg(x, y, on, s = 1) {
  const c = SW.ctx; c.globalAlpha = on ? 1 : .3;
  c.fillStyle = '#fff4dc'; c.strokeStyle = SW_INK; c.lineWidth = 3;
  c.beginPath(); c.ellipse(x, y, 13 * s, 17 * s, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#8fd18f'; circle(c, x - 4 * s, y - 3 * s, 3 * s); circle(c, x + 4 * s, y + 6 * s, 3.5 * s);
  c.globalAlpha = 1;
}
function swStar(x, y, r, on) {
  const c = SW.ctx; c.beginPath();
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, q = k % 2 ? r * .45 : r; c[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * q, y + Math.sin(a) * q); }
  c.closePath(); c.fillStyle = on ? '#ffd23a' : 'rgba(29,43,34,.15)'; c.fill();
  c.strokeStyle = SW_INK; c.lineWidth = 2; c.stroke();
}
function swLock(x, y, s = 1) {
  const c = SW.ctx; c.strokeStyle = SW_INK; c.lineWidth = 4 * s; c.fillStyle = '#c9b48a';
  c.beginPath(); c.arc(x, y - 6 * s, 9 * s, Math.PI, 0); c.stroke();
  rr(c, x - 14 * s, y - 6 * s, 28 * s, 22 * s, 5 * s); c.fill(); c.stroke();
  c.fillStyle = SW_INK; circle(c, x, y + 4 * s, 3 * s);
}
function swIsland(cx, base, open) {
  const c = SW.ctx;
  c.fillStyle = '#4fa3d8'; c.beginPath(); c.ellipse(cx, base + 6, 100, 18, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#e9d18f'; c.strokeStyle = SW_INK; c.lineWidth = 3;
  c.beginPath(); c.ellipse(cx, base, 74, 20, 0, Math.PI, 0); c.closePath(); c.fill(); c.stroke();
  drawPalm(cx - 6, base - 4, 92, open ? '#2e7d32' : '#6d7a70');
}
// Une carte du menu : cadre, surbrillance si choisie, zone à toucher.
function swCard(x, y, w, h, picked, focused, fn) {
  const c = SW.ctx;
  if (focused) { c.fillStyle = SW_SUN; rr(c, x - 8, y - 8, w + 16, h + 16, 24); c.fill(); }
  swPanel(x, y, w, h, picked ? '#ffe7b8' : SW_PAPER);
  SW.hits.push({ x, y, w, h, fn });
}

/* ---------- Écrans ---------- */
function swDrawTitle() {
  const c = SW.ctx;
  c.fillStyle = '#1f5b3a'; c.fillRect(0, 0, SW_W, SW_H);
  const t = performance.now() / 1000;
  ORDER.forEach((k, n) => drawDino(c, SPECIES[k], 290 + n * 235, 640, 1, t + n, true, false, 1.5));
  swText('Dino Explorateur', SW_W / 2, 150, 84, SW_PAPER, 'center');
  swText('Appuie sur A (ou touche l’écran) pour jouer', SW_W / 2, 280, 34, SW_SUN, 'center');
  swText('Croix ou stick : choisir et marcher    A : valider et sauter    B : retour', SW_W / 2, 350, 24, '#d9f0dc', 'center');
  swText('−  : revenir au menu pendant le jeu        + : quitter', SW_W / 2, 392, 24, '#d9f0dc', 'center');
  if (SW_APPLET) {
    swPanel(SW_W / 2 - 470, 430, 940, 64);
    swText('Pour jouer sans saccades : quitte, puis relance le jeu en gardant R appuyé sur un jeu', SW_W / 2, 462, 24, '#b23a7a', 'center');
  }
}
function swDrawMenu() {
  const c = SW.ctx, t = performance.now() / 1000, wk = swWorld();
  SW.hits = [];
  c.fillStyle = '#1f5b3a'; c.fillRect(0, 0, SW_W, SW_H);
  swText('Choisis ton dino', 40, 44, 40, SW_PAPER);
  swText(`Ton sac : ${prog.bag.n} trésor${prog.bag.n > 1 ? 's' : ''}`, SW_W - 40, 44, 28, SW_SUN, 'right');

  // Rangée du haut : les 4 animaux et l'île secrète
  const cw = 224, ch = 236, gap = 20, x0 = (SW_W - (cw * 5 + gap * 4)) / 2, y0 = 82;
  SW_WORLDS.forEach((k, n) => {
    const x = x0 + n * (cw + gap), picked = n === SW.wi, focused = picked && SW.row === 0;
    swCard(x, y0, cw, ch, picked, focused, () => { if (SW.wi === n && SW.row === 0) swChooseWorld(); else { SW.wi = n; SW.row = 0; swPickLevel(); } });
    if (k === 'final') {
      const open = allMaps(), nMaps = ORDER.filter(m => prog.bag.maps[m]).length;
      swIsland(x + cw / 2, y0 + 150, open);
      if (!open) swLock(x + cw - 34, y0 + 40);
      swText("L'île secrète", x + cw / 2, y0 + 184, swFit("L'île secrète", cw - 20, 30), SW_INK, 'center');
      const sub = open ? 'Les 4 animaux ensemble' : `${nMaps} morceau${nMaps > 1 ? 'x' : ''} de carte sur 4`;
      swText(sub, x + cw / 2, y0 + 214, swFit(sub, cw - 20, 18), '#4b5d50', 'center');
      return;
    }
    const sp = SPECIES[k];
    drawDino(c, sp, x + cw / 2, y0 + 158, 1, t, focused, false, 1.6);
    swText(sp.name, x + cw / 2, y0 + 184, swFit(sp.name, cw - 20, 30), SW_INK, 'center');
    swText(sp.label, x + cw / 2, y0 + 214, swFit(sp.label, cw - 20, 18), '#4b5d50', 'center');
  });

  // Rangée du bas : les endroits de l'animal choisi
  const levels = WORLDS[wk], w = prog.worlds[wk], isle = wk === 'final';
  swText(isle ? "L'île secrète" : `L'aventure du ${SPECIES[wk].name}`, 40, 362, 30, SW_PAPER);
  const n = levels.length, lg = 14, lw = Math.min(200, (SW_W - 80 - lg * (n - 1)) / n), lh = 214;
  const lx0 = (SW_W - (lw * n + lg * (n - 1))) / 2, ly = 392;
  levels.forEach((d, i) => {
    const x = lx0 + i * (lw + lg), open = canPlay(wk, i), picked = i === SW.lvl, focused = picked && SW.row === 1;
    swCard(x, ly, lw, lh, picked && SW.row === 1, focused, () => { if (SW.row === 1 && SW.lvl === i) swChooseLevel(); else { SW.row = 1; SW.lvl = i; } });
    if (!open) c.globalAlpha = .55;
    // Numéro (ou clé dorée pour l'endroit secret)
    if (d.bonus) drawKey({ x: x + lw / 2, y: ly + 38, ph: 0 });
    else {
      c.fillStyle = open ? '#3f9a4f' : '#8a958c'; c.strokeStyle = SW_INK; c.lineWidth = 3;
      c.beginPath(); c.arc(x + lw / 2, ly + 38, 22, 0, Math.PI * 2); c.fill(); c.stroke();
      swText(String(i + 1), x + lw / 2, ly + 39, 26, SW_PAPER, 'center');
    }
    const name = swLevelName(wk, i), lines = swWrap(name, lw - 18, 22).slice(0, 2);
    lines.forEach((ln, k) => swText(ln, x + lw / 2, ly + 86 + k * 26 - (lines.length - 1) * 13, swFit(ln, lw - 14, 22), SW_INK, 'center'));
    c.globalAlpha = 1;
    if (!open) swLock(x + lw / 2, ly + 150, 1.1);
    else {
      const es = Math.min(1, (lw - 20) / 108);
      for (let k = 0; k < 3; k++) swEgg(x + lw / 2 + (k - 1) * 34 * es, ly + 148, k < w.eggs[i], es);
      for (let k = 0; k < 3; k++) swStar(x + lw / 2 + (k - 1) * 26 * es, ly + 188, 10 * es, k < w.stars[i]);
    }
  });
  swText(SW.row === 0 ? 'A : choisir cet animal    Croix : changer' : 'A : jouer    Croix : changer d’endroit    B : changer d’animal',
    SW_W / 2, 690, 24, '#d9f0dc', 'center');
}
function swDrawGame() {
  const c = SW.ctx;
  // HUD : les œufs, les fruits (ou perles), le nom de l'endroit, le bouton menu
  swPanel(16, 14, 330, 62);
  for (let k = 0; k < 3; k++) swEgg(48 + k * 36, 45, k < eggsRun);
  c.fillStyle = L.mode === 'swim' ? '#f6f3ff' : '#b23a7a'; c.strokeStyle = SW_INK; c.lineWidth = 3;
  c.beginPath(); c.arc(174, 45, 13, 0, Math.PI * 2); c.fill(); c.stroke();
  swText(String(fruitCount), 196, 46, 34);
  const name = `${WORLDS[L.world][L.i].bonus ? '' : L.i + 1 + '. '}${WORLDS[L.world][L.i].name}`;
  c.font = '30px sans-serif'; const nw = c.measureText(name).width + 40;
  swPanel(SW_W - 140 - nw, 14, nw, 62); swText(name, SW_W - 160, 46, 30, SW_INK, 'right');
  swPanel(SW_W - 124, 14, 108, 62); swText('− Menu', SW_W - 70, 46, 24, SW_INK, 'center');
  // Joystick tactile
  if (stick.id !== null) {
    c.globalAlpha = .55; c.strokeStyle = SW_INK; c.lineWidth = 5; c.fillStyle = 'rgba(255,247,230,.3)';
    c.beginPath(); c.arc(stick.ox, stick.oy, STICK_R, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = SW_PAPER; c.beginPath(); c.arc(stick.ox + stick.x * STICK_R, stick.oy + stick.y * STICK_R, 25, 0, Math.PI * 2); c.fill(); c.stroke();
    c.globalAlpha = 1;
  }
  if (state === 'done') {
    c.fillStyle = 'rgba(16,40,26,.55)'; c.fillRect(0, 0, SW_W, SW_H);
    swPanel(SW_W / 2 - 400, 150, 800, 400);
    swText('Bravo !', SW_W / 2, 215, 72, '#3f9a4f', 'center');
    const stars = prog.worlds[L.world].stars[L.i];
    for (let k = 0; k < 3; k++) swStar(SW_W / 2 + (k - 1) * 56, 290, 24, k < stars);
    // Le texte de fin écrit par le jeu (œufs, trésors, clé dorée, morceau de carte)
    const text = document.getElementById('doneText').textContent || '';
    swWrap(text, 720, 26).slice(0, 5).forEach((ln, k) => swText(ln, SW_W / 2, 350 + k * 34, 26, SW_INK, 'center'));
    const next = canPlay(L.world, L.i + 1);
    swText(next ? 'A : endroit suivant    B : menu' : 'A : menu', SW_W / 2, 515, 30, '#b23a7a', 'center');
  }
}
function swDrawToast() {
  if (SW.toastT <= 0) return;
  const c = SW.ctx; SW.toastT--;
  c.globalAlpha = Math.min(1, SW.toastT / 20);
  const size = swFit(SW.toast, SW_W - 120, 28); c.font = `${size}px sans-serif`;
  const w = c.measureText(SW.toast).width + 48;
  swPanel(SW_W / 2 - w / 2, 96, w, 56); swText(SW.toast, SW_W / 2, 125, size, SW_INK, 'center');
  c.globalAlpha = 1;
}
function swDraw() {
  const c = SW.ctx;
  c.setTransform(1, 0, 0, 1, 0, 0); c.textAlign = 'left'; c.globalAlpha = 1;
  if (SW.screen === 'title') swDrawTitle();
  else if (SW.screen === 'menu') swDrawMenu();
  else if (L) swDrawGame();
  swDrawToast();
}

// Pour les tests sur ordinateur (switch/test) : lire ou changer les variables du jeu de l'extérieur.
globalThis.dinoEval = code => eval(code);

let swFrames = 0;
function swLoop() {
  if (++swFrames === 1 || swFrames === 60) swLog('jeu : image ' + swFrames + ', état ' + state);
  // Fluidité : images par seconde, notées dans le journal toutes les 600 images (10 s si tout va bien).
  const now = performance.now();
  if (swFrames % 600 === 1) { if (SW.fpsT) swLog(`fluidité : ${Math.round(600000 / (now - SW.fpsT))} images/s (${SW.screen}, ${L ? L.world + ' ' + L.mode : '-'})`); SW.fpsT = now; }
  try { swPad(); swDraw(); } catch (e) { swToast('Erreur : ' + (e && e.message)); swLog('erreur : ' + (e && (e.stack || e.message))); }
  // Une erreur du jeu reste affichée (sinon l'écran se figerait sans explication).
  if (SWB.err) swBoot(SWB.step, null);
  requestAnimationFrame(swLoop);
}
requestAnimationFrame(swLoop);
