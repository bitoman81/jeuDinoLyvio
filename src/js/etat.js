/* ---------- État ---------- */
let L = null, player = null, state = 'menu', time = 0, camX = 0, parts = [], cooldown = 0, fruitCount = 0, eggsRun = 0;
const world = () => L ? L.sp : SPECIES[prog.world];
function makeGrid(cols) { const g = []; for (let c = 0; c < cols; c++) g.push(new Uint8Array(ROWS)); return g; }
function isSolid(c, r) {
  if (c < 0) return true;
  if (c >= L.cols || r < 0 || r >= ROWS) return false;
  return L.solid(L.grid[c][r]);
}
function nearRects(p, onTile) {
  const out = [];
  const c0 = Math.floor(p.x / T) - 1, c1 = Math.floor((p.x + p.w) / T) + 1;
  const r0 = Math.floor(p.y / T) - 1, r1 = Math.floor((p.y + p.h) / T) + 1;
  for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) {
    if (!isSolid(c, r)) continue;
    const rc = { x: c * T, y: r * T, w: T, h: T };
    if (onTile && hit(p, rc) && onTile(c, r)) continue;
    out.push(rc);
  }
  L.gates.forEach(g => { if (!g.open && g.block) out.push(g); });
  (L.doors || []).forEach(dr => { if (!dr.open) out.push(dr); });
  return out;
}
function moveBox(p, dx, dy, onTile) {
  const res = { x: false, y: false };
  p.x += dx;
  for (const r of nearRects(p, onTile)) if (hit(p, r)) { if (dx > 0) p.x = r.x - p.w; else if (dx < 0) p.x = r.x + r.w; res.x = true; }
  p.y += dy;
  for (const r of nearRects(p, onTile)) if (hit(p, r)) { if (dy > 0) p.y = r.y - p.h; else if (dy < 0) p.y = r.y + r.h; res.y = true; }
  return res;
}
function collectItems(p, pad) {
  // Aimant : les objets proches viennent tout seuls.
  if (L.magnet) L.items.forEach(f => {
    if (f.taken) return;
    const dx = p.x + p.w / 2 - f.x, dy = p.y + p.h / 2 - f.y, d = Math.hypot(dx, dy);
    if (d < 140 && d > 1) { f.x += dx / d * 5; f.y += dy / d * 5; }
  });
  L.items.forEach(f => {
    if (f.taken || !hit(p, { x: f.x - pad, y: f.y - pad, w: pad * 2, h: pad * 2 })) return;
    f.taken = true; fruitCount++; prog.bag.n++; $('hudFruit').textContent = fruitCount;
    if (f.fossil) { prog.bag.fossils[`${L.world}-${L.i}`] = true; L.gotFossil = true; SFX.yay(); say('Un fossile ! Il va dans ton album.'); }
    else if (f.key) { prog.bag.keys[L.world] = true; L.gotKey = true; SFX.yay(); say("La clé dorée ! Elle ouvre l'endroit secret."); }
    else SFX.fruit();
    autosave(f.fossil || f.key);
    for (let i = 0; i < 8; i++) parts.push({ x: f.x, y: f.y, vx: Math.cos(i) * 3, vy: Math.sin(i) * 3 - 1, life: 26, col: '#ffd23a', r: 4 });
  });
}
function checkGates(p) {
  if (cooldown > 0) return;
  const zone = { x: p.x - 6, y: p.y - 4, w: p.w + 12, h: p.h + 8 };
  const g = L.gates.find(g => !g.open && hit(zone, g));
  if (g) openPuzzle(g);
}
function gateAnim() { L.gates.forEach(g => { if (g.open && g.anim < 1) g.anim += 1 / 40; }); }

/* ---------- Interrupteurs ----------
   Un gros bouton rouge ouvre une porte plus loin. Dans le niveau : switches: [[bouton, rangée, porte]], en cases
   (tricératops : la rangée est un écart par rapport au chemin ; ptérodactyle : [x du bouton, y du bouton, x de la porte] en pixels).
   Pour ne jamais bloquer l'enfant : devant la porte fermée, une flèche montre le bouton,
   et au bout de 15 secondes la porte s'ouvre toute seule. */
const SW_HELP = 60 * 15;
const DOOR_COL = { platform: ['#8a5a2b', '#6e4520'], topdown: ['#a0692e', '#6e4520'], shmup: ['#4caf50', '#2f7a3a'], swim: ['#8d8f94', '#5f6f86'] };
// place(a, b, c) rend le bouton { bx, by, zone } et la porte { x, y, w, h, top, bot }.
function makeSwitches(d, place) {
  L.switches = (d.switches || []).map(([a, b, c], k) => {
    const s = place(a, b, c);
    s.k = k; s.on = false; Object.assign(s.door, { open: false, anim: 0, wait: 0, near: -9 });
    return s;
  });
  L.doors = L.switches.map(s => s.door);
}
function pressSwitch(s, msg) {
  s.on = true; s.door.open = true; s.door.anim = 0; SFX.yay(); say(msg); autosave(true);
  for (let i = 0; i < 14; i++) parts.push({ x: s.bx, y: s.by - 10, vx: (Math.random() - .5) * 6, vy: -Math.random() * 5, g: .15, life: 36, col: pick(['#3fa34d', '#ffd23a', '#fff4dc']), r: 3 + Math.random() * 3 });
}
function checkSwitches(p) {
  L.switches.forEach(s => {
    const dr = s.door;
    if (dr.open) { if (dr.anim < 1) dr.anim = Math.min(1, dr.anim + 1 / 30); return; }
    if (hit(p, s.zone)) { pressSwitch(s, "Bravo, tu as appuyé sur le bouton ! La porte s'ouvre."); return; }
    if (!(p.x + p.w > dr.x - 30 && p.x < dr.x)) return;
    // Devant la porte fermée : on explique, la flèche montre le bouton, puis la porte s'ouvre toute seule.
    if (dr.wait % 600 === 0) say('La porte est fermée. Va appuyer sur le gros bouton rouge : la flèche te montre où il est !');
    dr.wait++; dr.near = time;
    if (dr.wait >= SW_HELP) pressSwitch(s, "Je t'aide : la porte s'ouvre !");
  });
}
function drawDoor(dr) {
  if (dr.open && dr.anim >= 1) return;
  const [c1, c2] = DOOR_COL[L.mode], h = dr.bot - dr.top, x = dr.x, w = dr.w;
  ctx.save(); ctx.globalAlpha = dr.open ? 1 - dr.anim : 1; ctx.translate(0, dr.open ? -dr.anim * h : 0);
  ctx.strokeStyle = '#1d2b22'; ctx.lineWidth = 3;
  for (let k = 0; k < 3; k++) { ctx.fillStyle = c1; rr(ctx, x + k * w / 3 + 1, dr.top, w / 3 - 2, h, 5); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = c2;
  for (let y = dr.top + 30; y < dr.bot - 20; y += 70) { ctx.fillRect(x - 4, y, w + 8, 10); ctx.strokeRect(x - 4, y, w + 8, 10); }
  // Le point rouge de la porte, de la même couleur que le bouton
  ctx.fillStyle = '#e5483b'; circle(ctx, x + w / 2, (dr.top + dr.bot) / 2, 12); ctx.stroke();
  ctx.restore();
}
function drawButton(s) {
  const x = s.bx, y = s.by, on = s.on;
  ctx.strokeStyle = '#1d2b22'; ctx.lineWidth = 3;
  if (L.mode === 'shmup') { ctx.fillStyle = 'rgba(255,255,255,.9)'; circle(ctx, x - 18, y + 6, 14); circle(ctx, x + 18, y + 6, 14); circle(ctx, x, y + 10, 18); }
  if (!on) { const pl = .5 + .5 * Math.sin(time * 4); ctx.fillStyle = `rgba(255,120,90,${.2 + pl * .25})`; circle(ctx, x, y - 8, 30); }
  ctx.fillStyle = '#8d8f94'; rr(ctx, x - 20, y - 8, 40, 10, 4); ctx.fill(); ctx.stroke();
  ctx.fillStyle = on ? '#3fa34d' : '#e5483b';
  ctx.beginPath(); ctx.ellipse(x, y - 8, 14, on ? 4 : 11, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  if (!on) {
    const ay = y - 30 - Math.abs(Math.sin(time * 3)) * 8;
    ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.moveTo(x - 10, ay - 12); ctx.lineTo(x + 10, ay - 12); ctx.lineTo(x, ay); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
}
// Flèche près de l'animal, tournée vers le bouton
function drawPointer(s) {
  const p = player, cx = p.x + p.w / 2, cy = p.y + p.h / 2 - 20, a = Math.atan2(s.by - 10 - cy, s.bx - cx), d = 48 + Math.sin(time * 6) * 6;
  ctx.save(); ctx.translate(cx + Math.cos(a) * d, cy + Math.sin(a) * d); ctx.rotate(a);
  ctx.fillStyle = '#ffd23a'; ctx.strokeStyle = '#1d2b22'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-8, -13); ctx.lineTo(-3, 0); ctx.lineTo(-8, 13); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}
function drawSwitches() {
  L.switches.forEach(s => { drawDoor(s.door); drawButton(s); });
  L.switches.forEach(s => { if (!s.door.open && time - s.door.near < 2) drawPointer(s); });
}
function updateParts() {
  parts.forEach(q => { q.x += q.vx; q.y += q.vy; q.vy += q.g ?? .3; q.life--; });
  parts = parts.filter(q => q.life > 0);
}
// Sur téléphone, l'animal reste vers le milieu, entre les deux pouces.
const camLead = () => touchUI ? (L.mode === 'platform' ? .45 : .5) : .38;
function follow(p) {
  const target = clamp(p.x - viewW * camLead(), 0, Math.max(0, L.cols * T - viewW));
  camX += (target - camX) * .15;
}
function drawParts() {
  parts.forEach(q => {
    if (q.egg) {
      ctx.globalAlpha = Math.min(1, q.life / 20); ctx.fillStyle = '#fff4dc'; ctx.strokeStyle = '#1d2b22'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(q.x, q.y, 12, 15, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1; return;
    }
    ctx.fillStyle = q.col; circle(ctx, q.x, q.y, q.r);
  });
}
// Fossile caché : une ammonite qui brille, une par endroit.
function drawFossil(f) {
  const x = f.x, y = f.y + Math.sin(time * 3 + f.ph) * 4;
  ctx.fillStyle = `rgba(255,240,180,${.35 + .2 * Math.sin(time * 4)})`; circle(ctx, x, y, 21);
  ctx.fillStyle = '#d9c9a3'; ctx.strokeStyle = '#1d2b22'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.lineWidth = 2; ctx.beginPath();
  for (let a = 0; a < Math.PI * 5; a += .2) { const r = 11 * (1 - a / (Math.PI * 5.3)); ctx[a ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r); }
  ctx.stroke();
}
// Clé dorée : elle ouvre l'endroit secret de l'animal.
function drawKey(f) {
  const x = f.x, y = f.y + Math.sin(time * 3 + f.ph) * 4;
  ctx.fillStyle = `rgba(255,220,90,${.35 + .2 * Math.sin(time * 5)})`; circle(ctx, x, y, 24);
  ctx.save(); ctx.translate(x, y); ctx.rotate(-.5 + Math.sin(time * 2) * .15);
  ctx.fillStyle = '#ffd23a'; ctx.strokeStyle = '#1d2b22'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(-9, 0, 8, 0, Math.PI * 2); ctx.moveTo(-1, -3); ctx.lineTo(16, -3); ctx.lineTo(16, 7); ctx.lineTo(11, 7); ctx.lineTo(11, 3); ctx.lineTo(7, 3); ctx.lineTo(7, 7); ctx.lineTo(2, 7); ctx.lineTo(2, 3); ctx.lineTo(-1, 3);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#a0692e'; circle(ctx, -9, 0, 3);
  ctx.restore();
}
// Visible à l'écran (avec une marge) ? Sinon, rien à dessiner.
const onScreen = (x, m = 80) => x > camX - m && x < camX + viewW + m;
function drawFruit(f) {
  if (f.taken || !onScreen(f.x)) return;
  if (f.fossil) { drawFossil(f); return; }
  if (f.key) { drawKey(f); return; }
  const y = f.y + Math.sin(time * 3 + f.ph) * 4;
  ctx.fillStyle = '#b23a7a'; ctx.strokeStyle = '#1d2b22'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(f.x, y, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.6)'; circle(ctx, f.x - 4, y - 4, 3);
  ctx.fillStyle = '#4caf50'; ctx.beginPath(); ctx.ellipse(f.x + 5, y - 12, 7, 3.5, -.5, 0, Math.PI * 2); ctx.fill();
}
function drawPearl(f) {
  if (f.taken || !onScreen(f.x)) return;
  if (f.fossil) { drawFossil(f); return; }
  if (f.key) { drawKey(f); return; }
  const y = f.y + Math.sin(time * 2 + f.ph) * 3;
  ctx.fillStyle = 'rgba(255,255,255,.25)'; circle(ctx, f.x, y, 15);
  ctx.fillStyle = '#f6f3ff'; ctx.strokeStyle = '#1d2b22'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(f.x, y, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#cfc6e6'; circle(ctx, f.x + 3, y + 3, 4);
  ctx.fillStyle = '#fff'; circle(ctx, f.x - 3, y - 3, 2.5);
}
// Bulle du bouclier autour de l'animal
function drawShield(x, y, r) {
  ctx.fillStyle = 'rgba(140,210,255,.15)'; circle(ctx, x, y, r);
  ctx.strokeStyle = `rgba(140,210,255,${.6 + .3 * Math.sin(time * 5)})`; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
}
// Pierre magique ronde (vue de dessus et sous l'eau)
function drawOrb(x, y) {
  const pulse = .5 + .5 * Math.sin(time * 3 + x);
  ctx.fillStyle = `rgba(57,201,168,${.25 + pulse * .25})`; circle(ctx, x, y, 30);
  ctx.fillStyle = '#7a6f9b'; ctx.strokeStyle = '#1d2b22'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = `rgba(57,201,168,${.6 + pulse * .4})`; circle(ctx, x, y, 14);
  ctx.fillStyle = '#fff4dc'; ctx.beginPath(); ctx.ellipse(x, y, 8, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#fff7e6'; ctx.font = '26px "Lilita One", sans-serif'; ctx.textAlign = 'center';
  ctx.strokeStyle = '#1d2b22'; ctx.lineWidth = 4; ctx.strokeText('?', x, y - 30 - Math.abs(Math.sin(time * 3)) * 4); ctx.fillText('?', x, y - 30 - Math.abs(Math.sin(time * 3)) * 4);
}

/* ---------- Entrées ---------- */
const keys = { left: false, right: false, up: false, down: false };
let jumpPressed = false, pointer = null;
const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', KeyQ: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up', KeyZ: 'up', ArrowDown: 'down', KeyS: 'down', Space: 'jump' };
window.addEventListener('keydown', e => {
  if (state !== 'play') return;
  const k = KEYMAP[e.code]; if (!k) return;
  e.preventDefault();
  // Espace : l'action de chaque animal. La flèche du haut ne saute qu'avec le T-Rex.
  if (k === 'jump' || (k === 'up' && L && L.mode === 'platform')) { if (!e.repeat) jumpPressed = true; }
  if (k !== 'jump') keys[k] = true;
});
window.addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k && k !== 'jump') keys[k] = false; });
function bindPad(id, down, up) {
  const b = $(id);
  b.addEventListener('pointerdown', e => { e.preventDefault(); audio(); try { b.setPointerCapture(e.pointerId); } catch (_) {} b.classList.add('on'); down(); });
  const end = () => { b.classList.remove('on'); up(); };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => b.addEventListener(ev, end));
  b.addEventListener('contextmenu', e => e.preventDefault());
}
bindPad('act', () => jumpPressed = true, () => {});
/* Téléphone : un joystick apparaît sous le pouce dans la moitié gauche de l'écran, la moitié droite
   et le bouton font l'action. Pour les animaux autres que le T-Rex, on peut choisir à la place
   de toucher l'écran là où l'animal doit aller (prog.touch = 'tap'). */
const STICK_R = 52;
let touchUI = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
const stick = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
function setTouchUI(on) { touchUI = on; $('app').classList.toggle('touch', on); stickHome(); }
const useStick = () => touchUI && L && (L.mode === 'platform' || prog.touch !== 'tap');
function placeStick(x, y) { const el = $('stick'); el.style.left = x + 'px'; el.style.top = y + 'px'; }
function moveKnob() { $('stickKnob').style.transform = `translate(${stick.x * STICK_R}px,${stick.y * STICK_R}px)`; }
// Au repos, le joystick attend en bas à gauche, à moitié transparent.
function stickHome() {
  if (stick.id !== null) return;
  const r = cv.getBoundingClientRect(), m = 16 + STICK_R + 10;
  placeStick(m, r.height - m);
}
function releaseStick() { stick.id = null; stick.x = stick.y = 0; $('stick').classList.remove('on'); moveKnob(); stickHome(); }
function stickDir() {
  const l = Math.hypot(stick.x, stick.y);
  return l < .2 ? [0, 0] : [stick.x, stick.y];
}
function canvasXY(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top, r]; }
function setPointer(e) { const [x, y] = canvasXY(e); pointer = { sx: x / scale, sy: y / scale }; }
cv.addEventListener('pointerdown', e => {
  if (state !== 'play' || !L) return;
  audio();
  if (useStick()) {
    const [x, y, r] = canvasXY(e);
    if (x >= r.width / 2) { jumpPressed = true; return; }
    if (stick.id !== null) return;
    try { cv.setPointerCapture(e.pointerId); } catch (_) {}
    Object.assign(stick, { id: e.pointerId, ox: x, oy: y, x: 0, y: 0 });
    placeStick(x, y); moveKnob(); $('stick').classList.add('on');
    return;
  }
  if (L.mode === 'platform') return;
  try { cv.setPointerCapture(e.pointerId); } catch (_) {} setPointer(e);
});
cv.addEventListener('pointermove', e => {
  if (e.pointerId === stick.id) {
    const [x, y] = canvasXY(e), dx = (x - stick.ox) / STICK_R, dy = (y - stick.oy) / STICK_R, l = Math.max(1, Math.hypot(dx, dy));
    stick.x = dx / l; stick.y = dy / l; moveKnob();
    return;
  }
  if (pointer) setPointer(e);
});
['pointerup', 'pointercancel'].forEach(ev => cv.addEventListener(ev, e => { if (e.pointerId === stick.id) releaseStick(); else pointer = null; }));
function clearKeys() { keys.left = keys.right = keys.up = keys.down = false; jumpPressed = false; pointer = null; releaseStick(); document.querySelectorAll('#act.on').forEach(b => b.classList.remove('on')); }
function inputDir(p) {
  let ix = (keys.right ? 1 : 0) - (keys.left ? 1 : 0), iy = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
  if (!ix && !iy && stick.id !== null) [ix, iy] = stickDir();
  if (!ix && !iy && pointer) {
    const dx = pointer.sx + camX - (p.x + p.w / 2), dy = pointer.sy - L.oy - (p.y + p.h / 2), d = Math.hypot(dx, dy);
    if (d > 10) { const k = Math.min(1, d / 60); ix = dx / d * k; iy = dy / d * k; }
  }
  const l = Math.hypot(ix, iy); if (l > 1) { ix /= l; iy /= l; }
  return [ix, iy];
}

/* =========================================================
   MODES DE JEU
   ========================================================= */
