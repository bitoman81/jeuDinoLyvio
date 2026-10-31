/* ---------- Version Switch (nx.js) : prototype du T-Rex ----------
   Ce fichier vient après le code du jeu, dans le même module : il voit ses variables (L, state, keys…).
   Commandes : stick gauche ou croix pour marcher, A ou B pour sauter, + pour quitter.
   Tactile : le pouce gauche fait un joystick, la moitié droite de l'écran fait sauter.
   Les énigmes ne sont pas encore dessinées sur la Switch : la pierre s'ouvre toute seule. */
const SW = { ctx: screen.getContext('2d'), prev: {}, toast: '', toastT: 0, started: false };
const SW_BTN = { B: 0, A: 1, Y: 2, X: 3, L: 4, R: 5, ZL: 6, ZR: 7, Minus: 8, Plus: 9, Up: 12, Down: 13, Left: 14, Right: 15 };
const SW_LEVELS = WORLDS.rex.filter(d => !d.bonus).length;
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

function swStart(i) {
  SW.started = true;
  startLevel('rex', clamp(i, 0, SW_LEVELS - 1));
  swToast(WORLDS.rex[L.i].name);
}
function swNext() { swStart((L.i + 1) % SW_LEVELS); }

/* ---------- Manette ---------- */
function swPad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const pad = pads && pads[0];
  if (!pad) return;
  const on = i => !!(pad.buttons[i] && pad.buttons[i].pressed);
  const down = i => { const was = SW.prev[i]; SW.prev[i] = on(i); return SW.prev[i] && !was; };
  const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
  const jump = down(SW_BTN.A) | down(SW_BTN.B);
  if (!SW.started || state === 'menu') { if (jump) swStart(prog.worlds.rex.unlocked - 1); return; }
  if (state === 'done') { if (jump) swNext(); return; }
  if (state !== 'play') return;
  keys.left = on(SW_BTN.Left) || ax < -.35;
  keys.right = on(SW_BTN.Right) || ax > .35;
  keys.up = on(SW_BTN.Up) || ay < -.5;
  keys.down = on(SW_BTN.Down) || ay > .5;
  if (jump) jumpPressed = true;
}

/* ---------- Écran tactile : on le passe au joystick du jeu ---------- */
setTouchUI(true);
function swTouch(type, e) {
  const list = e.changedTouches && e.changedTouches.length ? e.changedTouches : e.touches || [];
  if (type === 'pointerdown' && (!SW.started || state === 'menu')) { swStart(prog.worlds.rex.unlocked - 1); return; }
  if (type === 'pointerdown' && state === 'done') { swNext(); return; }
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

/* ---------- Dessin par-dessus le jeu ---------- */
function swPanel(x, y, w, h) {
  const c = SW.ctx;
  c.fillStyle = '#fff7e6'; c.strokeStyle = '#1d2b22'; c.lineWidth = 4;
  rr(c, x, y, w, h, 18); c.fill(); c.stroke();
}
function swText(t, x, y, size, color = '#1d2b22', align = 'left') {
  const c = SW.ctx; c.font = `${size}px sans-serif`; c.fillStyle = color; c.textAlign = align; c.textBaseline = 'middle'; c.fillText(t, x, y);
}
function swEgg(x, y, on) {
  const c = SW.ctx; c.globalAlpha = on ? 1 : .3;
  c.fillStyle = '#fff4dc'; c.strokeStyle = '#1d2b22'; c.lineWidth = 3;
  c.beginPath(); c.ellipse(x, y, 13, 17, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#8fd18f'; circle(c, x - 4, y - 3, 3); circle(c, x + 4, y + 6, 3.5);
  c.globalAlpha = 1;
}
function swDraw() {
  const c = SW.ctx;
  c.setTransform(1, 0, 0, 1, 0, 0); c.textAlign = 'left';
  if (!SW.started || state === 'menu') {
    c.fillStyle = '#1f5b3a'; c.fillRect(0, 0, SW_W, SW_H);
    swText('Dino Explorateur', SW_W / 2, 230, 84, '#fff7e6', 'center');
    swText("Prototype Switch : l'aventure du T-Rex", SW_W / 2, 320, 36, '#ffb238', 'center');
    swText('Appuie sur A (ou touche l’écran) pour jouer', SW_W / 2, 450, 34, '#fff7e6', 'center');
    swText('Stick ou croix : marcher    A : sauter    + : quitter', SW_W / 2, 530, 26, '#d9f0dc', 'center');
    if (SW_APPLET) {
      swPanel(SW_W / 2 - 470, 600, 940, 70);
      swText('Pour jouer sans saccades : quitte, puis relance le jeu en gardant R appuyé sur un jeu', SW_W / 2, 635, 24, '#b23a7a', 'center');
    }
    return;
  }
  // HUD : les œufs, les fruits, le nom de l'endroit
  swPanel(16, 14, 330, 62);
  for (let k = 0; k < 3; k++) swEgg(48 + k * 36, 45, k < eggsRun);
  c.fillStyle = '#b23a7a'; c.strokeStyle = '#1d2b22'; c.lineWidth = 3; c.beginPath(); c.arc(174, 45, 13, 0, Math.PI * 2); c.fill(); c.stroke();
  swText(String(fruitCount), 196, 46, 34);
  const name = `${L.i + 1}. ${WORLDS.rex[L.i].name}`;
  c.font = '30px sans-serif'; const nw = c.measureText(name).width + 40;
  swPanel(SW_W - 16 - nw, 14, nw, 62); swText(name, SW_W - 36, 46, 30, '#1d2b22', 'right');
  // Joystick tactile
  if (stick.id !== null) {
    c.globalAlpha = .55; c.strokeStyle = '#1d2b22'; c.lineWidth = 5; c.fillStyle = 'rgba(255,247,230,.3)';
    c.beginPath(); c.arc(stick.ox, stick.oy, STICK_R, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = '#fff7e6'; c.beginPath(); c.arc(stick.ox + stick.x * STICK_R, stick.oy + stick.y * STICK_R, 25, 0, Math.PI * 2); c.fill(); c.stroke();
    c.globalAlpha = 1;
  }
  if (SW.toastT > 0) {
    SW.toastT--;
    c.globalAlpha = Math.min(1, SW.toastT / 20);
    c.font = '28px sans-serif'; const w = c.measureText(SW.toast).width + 48;
    swPanel(SW_W / 2 - w / 2, 96, w, 56); swText(SW.toast, SW_W / 2, 125, 28, '#1d2b22', 'center');
    c.globalAlpha = 1;
  }
  if (state === 'done') {
    c.fillStyle = 'rgba(16,40,26,.55)'; c.fillRect(0, 0, SW_W, SW_H);
    swPanel(SW_W / 2 - 330, 200, 660, 300);
    swText('Bravo !', SW_W / 2, 270, 72, '#3f9a4f', 'center');
    swText(`Les 3 œufs sont retrouvés. ${fruitCount} fruits ramassés.`, SW_W / 2, 350, 30, '#1d2b22', 'center');
    swText('A : endroit suivant', SW_W / 2, 430, 34, '#b23a7a', 'center');
  }
}

// Pour les tests sur ordinateur (switch/test) : lire ou changer les variables du jeu de l'extérieur.
globalThis.dinoEval = code => eval(code);

let swFrames = 0;
function swLoop() {
  if (++swFrames === 1 || swFrames === 60) swLog('jeu : image ' + swFrames + ', état ' + state);
  try { swPad(); swDraw(); } catch (e) { swToast('Erreur : ' + (e && e.message)); }
  // Une erreur du jeu reste affichée (sinon l'écran se figerait sans explication).
  if (SWB.err) swBoot(SWB.step, null);
  requestAnimationFrame(swLoop);
}
requestAnimationFrame(swLoop);
