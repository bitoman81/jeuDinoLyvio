/* ---------- Dessin : outils ---------- */
function circle(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
/* Morceaux de décor fixe (layers) : le sol, les arbres, les tuiles ne bougent pas ; on les dessine une
   seule fois par morceaux de LAYER_COLS colonnes, puis on les recopie à chaque image. Sur la Switch,
   chaque ordre de dessin coûte cher (environ 8 µs) : redessiner tout le décor prenait plus d'une image.
   paint(g, a, b) dessine les colonnes a à b dans le contexte g (un morceau, ou l'écran si les morceaux
   sont impossibles). Chaque morceau a une marge de LAYER_M en haut et en bas, et contient aussi les
   colonnes voisines (ombres et feuillages qui dépassent). Il est dessiné à la taille des pixels de
   l'écran (R) pour rester net, et refait si l'écran change de taille. */
const LAYER_COLS = 8, LAYER_M = 48;
function newLayer(w, h) {
  let c;
  if (typeof OffscreenCanvas !== 'undefined') c = new OffscreenCanvas(w, h);
  else { c = document.createElement('canvas'); c.width = w; c.height = h; }
  c.layerW = w; c.layerH = h;
  return c;
}
/* Les morceaux ne sont pas jetés : ceux qui sortent de l'écran, et ceux de l'endroit qu'on quitte,
   attendent dans LAYER_POOL pour resservir (effacés). Sur la Switch, un morceau occupe environ 2 Mo
   de mémoire native que le moteur ne libère pas vite : en recréer à chaque endroit la remplissait. */
const LAYER_POOL = [], LAYER_POOL_MAX = 16;
function layerFree(c) { if (c && LAYER_POOL.length < LAYER_POOL_MAX && !LAYER_POOL.includes(c)) LAYER_POOL.push(c); }
function layerTake(w, h) {
  const i = LAYER_POOL.findIndex(c => c.layerW === w && c.layerH === h);
  if (i < 0) return newLayer(w, h);
  const c = LAYER_POOL.splice(i, 1)[0], g = c.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, w, h);
  return c;
}
// Rend tous les morceaux de l'endroit en cours (on change d'endroit, ou la taille de l'écran change).
function layerRelease() {
  if (L && L.layers) for (const n in L.layers) L.layers[n].forEach(layerFree);
  if (L) L.layers = null;
}
function layerGet(name, k, paint) {
  const R = dpr * scale;
  if (!L.layers || L.layerR !== R) { layerRelease(); L.layers = {}; L.layerR = R; }
  const Ls = L.layers[name] || (L.layers[name] = []);
  if (Ls[k]) return Ls[k];
  const W = LAYER_COLS * T, H = VIEW_H + 2 * LAYER_M, x0 = k * W;
  const a = Math.max(0, k * LAYER_COLS - 1), b = Math.min(L.cols - 1, (k + 1) * LAYER_COLS);
  const cnv = layerTake(Math.ceil(W * R), Math.ceil(H * R)), g = cnv.getContext('2d');
  g.setTransform(R, 0, 0, R, -x0 * R, LAYER_M * R);
  paint(g, a, b);
  return (Ls[k] = cnv);
}
// Décor fixe des colonnes c0 à c1, l'écran étant décalé de (-cx, oy) : recopié au pixel près, sans
// agrandissement ; en cas d'échec, retour pour de bon au dessin direct.
function layerDraw(name, c0, c1, cx, oy, paint) {
  if (!L.noLayers) {
    try {
      const k0 = Math.floor(c0 / LAYER_COLS), k1 = Math.floor(c1 / LAYER_COLS);
      for (let k = k0; k <= k1; k++) layerGet(name, k, paint);
      const R = L.layerR, y = Math.round((oy - LAYER_M) * R);
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      try { for (let k = k0; k <= k1; k++) ctx.drawImage(L.layers[name][k], Math.round((k * LAYER_COLS * T - cx) * R), y); }
      finally { ctx.restore(); }
      // Les morceaux loin de l'écran retournent dans la réserve.
      const Ls = L.layers[name];
      Ls.forEach((c, k) => { if (c && (k < k0 - 1 || k > k1 + 1)) { layerFree(c); delete Ls[k]; } });
      return;
    } catch (e) { L.noLayers = true; L.layers = null; }
  }
  paint(ctx, c0, c1);
}
// Petite image toute faite (w x h, en unités du jeu), dessinée une fois par paint(g) à la taille des
// pixels de l'écran ; null si c'est impossible (on dessine alors directement).
const SPRITES = new Map();
function sprite(key, w, h, paint) {
  if (L && L.noLayers) return null;   // retour au dessin direct (voir layerDraw)
  const R = dpr * scale, id = key + '@' + R;
  let c = SPRITES.get(id);
  if (c === undefined) {
    if (SPRITES.size >= 40) SPRITES.delete(SPRITES.keys().next().value);
    try { c = newLayer(Math.ceil(w * R), Math.ceil(h * R)); const g = c.getContext('2d'); g.setTransform(R, 0, 0, R, 0, 0); paint(g); }
    catch (e) { c = null; }
    SPRITES.set(id, c);
  }
  return c;
}
// Une case de la colonne c a changé : ses morceaux (et les voisins, qui la dessinent aussi) sont à refaire.
function layerDirty(c) {
  if (!L || !L.layers) return;
  const k = Math.floor(c / LAYER_COLS);
  for (const name in L.layers) for (let q = k - 1; q <= k + 1; q++) { layerFree(L.layers[name][q]); delete L.layers[name][q]; }
}
// Rectangle aux coins arrondis, avec arc() (arcTo dessine une boucle en trop sur la Switch).
function rr(c, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2)); const P = Math.PI;
  c.beginPath(); c.moveTo(x + r, y);
  c.lineTo(x + w - r, y); c.arc(x + w - r, y + r, r, -P / 2, 0);
  c.lineTo(x + w, y + h - r); c.arc(x + w - r, y + h - r, r, 0, P / 2);
  c.lineTo(x + r, y + h); c.arc(x + r, y + h - r, r, P / 2, P);
  c.lineTo(x, y + r); c.arc(x + r, y + r, r, P, P * 1.5);
  c.closePath();
}
const INK = 'rgba(30,24,14,.9)';
/* Dégradés gardés, par contexte de dessin et par clé : sur la Switch, chaque dégradé créé occupe de la
   mémoire native que le moteur JavaScript ne voit pas. En créer des dizaines à chaque image (corps des
   dinos, ciel, eau) remplissait la mémoire : saccades de plus en plus fortes et son qui crépite. */
const GRADS = new WeakMap();
function gradCache(c, key, make) {
  let m = GRADS.get(c);
  if (!m) GRADS.set(c, m = new Map());
  let g = m.get(key);
  if (!g) { if (m.size > 300) m.clear(); g = make(); m.set(key, g); }
  return g;
}
function grad(c, top, bot, pal) {
  return gradCache(c, `l${top},${bot},${pal.dark},${pal.body},${pal.belly}`, () => {
    const g = c.createLinearGradient(0, top, 0, bot);
    g.addColorStop(0, pal.dark); g.addColorStop(.45, pal.body); g.addColorStop(1, pal.belly);
    return g;
  });
}
// Dégradé vertical de tout l'écran (ciel, eau)
const screenGrad = (top, bot) => gradCache(ctx, `s${viewH},${top},${bot}`, () => {
  const g = ctx.createLinearGradient(0, 0, 0, viewH); g.addColorStop(0, top); g.addColorStop(1, bot); return g;
});
// Contour puis remplissage : les sous-chemins se fondent en une seule silhouette.
function shape(c, build, fill, lw = 3) { build(); c.lineWidth = lw; c.strokeStyle = INK; c.stroke(); c.fillStyle = fill; c.fill(); }
function leg(c, hx, hy, len, w, ang, col) {
  c.save(); c.translate(hx, hy); c.rotate(ang);
  shape(c, () => {
    c.beginPath(); c.moveTo(-w / 2, 0);
    c.quadraticCurveTo(-w * .62, len * .5, -w * .34, len - 2);
    c.lineTo(-w * .34, len); c.lineTo(w * .34 + 4, len);
    c.quadraticCurveTo(w * .4 + 3, len - 4, w * .3, len - 5);
    c.quadraticCurveTo(w * .62, len * .45, w / 2, 0); c.closePath();
  }, col, 2.5);
  c.fillStyle = '#ece3c8';
  for (let k = 0; k < 3; k++) circle(c, -w * .25 + k * (w * .3 + 1.2) + 1, len - .5, 1.2);
  c.restore();
}
function eye(c, x, y, r, t) {
  if ((t % 3.7) < .12) { c.strokeStyle = INK; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x - r, y); c.lineTo(x + r, y); c.stroke(); return; }
  c.fillStyle = '#1e180e'; circle(c, x, y, r + .8);
  c.fillStyle = '#e0a526'; circle(c, x, y, r);
  c.fillStyle = '#1e180e'; c.beginPath(); c.ellipse(x + r * .15, y, r * .32, r * .85, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(255,255,255,.9)'; circle(c, x - r * .35, y - r * .35, r * .3);
}
function marks(c, col, list) {
  c.strokeStyle = col; c.lineWidth = 2.2; c.lineCap = 'round';
  list.forEach(([x1, y1, x2, y2]) => { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); });
}
function legAngles(a, air) { return air ? [.45, -.35] : [a, -a]; }

/* ---------- Espèces vues de côté ----------
   Repère : x = 0 au centre, le bas touche y = 44, la tête regarde à droite.
   Tout tient entre x -48 et 40, y -14 et 46. */
function drawRex(c, t, a, air, p) {
  const [back, front] = legAngles(a, air);
  leg(c, -3, 23, 21, 10, front, p.dark);
  shape(c, () => {
    c.beginPath(); c.moveTo(-6, 11); c.quadraticCurveTo(-24, 9, -42, 15); c.quadraticCurveTo(-24, 22, -6, 30); c.closePath();
    c.moveTo(17, 21); c.ellipse(1, 21, 16, 11, -.15, 0, Math.PI * 2);
  }, grad(c, 8, 34, p));
  marks(c, 'rgba(60,55,25,.55)', [[-4, 11, -3, 16], [3, 10, 4, 15], [-12, 12, -11, 17], [-20, 13, -19, 17], [-28, 14, -27, 17]]);
  shape(c, () => {
    c.beginPath(); c.moveTo(7, 15); c.quadraticCurveTo(9, 4, 16, 1); c.lineTo(29, 0);
    c.quadraticCurveTo(37, 1, 37, 7); c.lineTo(36, 10); c.lineTo(22, 11); c.lineTo(34, 12);
    c.quadraticCurveTo(33, 17, 24, 17); c.quadraticCurveTo(16, 18, 14, 25); c.closePath();
  }, grad(c, 0, 26, p));
  c.fillStyle = '#f4efe0';
  for (let x = 25; x <= 34; x += 3) { c.beginPath(); c.moveTo(x, 10); c.lineTo(x + 1, 12.5); c.lineTo(x + 2, 10); c.fill(); }
  marks(c, p.dark, [[17, 2.5, 24, 2.5]]);
  eye(c, 21, 5, 2.2, t);
  c.fillStyle = INK; circle(c, 34, 4, 1);
  c.strokeStyle = p.dark; c.lineWidth = 3.5; c.lineCap = 'round';
  c.beginPath(); c.moveTo(13, 21); c.lineTo(18, 25); c.lineTo(21, 24); c.stroke();
  leg(c, 3, 23, 21, 13, back, p.body);
}
function drawTrike(c, t, a, air, p) {
  const [back, front] = legAngles(a, air);
  leg(c, -15, 28, 16, 8, front, p.dark); leg(c, 9, 28, 16, 8, back, p.dark);
  shape(c, () => {
    c.beginPath(); c.moveTo(-18, 18); c.quadraticCurveTo(-32, 22, -38, 30); c.quadraticCurveTo(-28, 31, -18, 31); c.closePath();
    c.moveTo(18, 24); c.ellipse(-3, 24, 21, 12, 0, 0, Math.PI * 2);
  }, grad(c, 12, 36, p));
  marks(c, 'rgba(60,45,25,.45)', [[-14, 14, -13, 19], [-6, 12, -5, 17], [2, 13, 3, 18], [-22, 18, -21, 22]]);
  shape(c, () => { c.beginPath(); c.ellipse(15, 15, 10, 15, .5, 0, Math.PI * 2); }, p.frill);
  c.fillStyle = p.frillDark;
  for (let k = 0; k < 5; k++) { const an = -2.2 + k * .55; circle(c, 15 + Math.cos(an + .5) * 8, 15 + Math.sin(an + .5) * 12, 1.8); }
  shape(c, () => {
    c.beginPath(); c.moveTo(13, 11); c.quadraticCurveTo(26, 10, 32, 18); c.lineTo(38, 25);
    c.quadraticCurveTo(34, 30, 28, 29); c.quadraticCurveTo(18, 31, 11, 26); c.closePath();
  }, grad(c, 10, 30, p));
  shape(c, () => { c.beginPath(); c.moveTo(18, 13); c.quadraticCurveTo(27, 5, 35, 2); c.quadraticCurveTo(28, 9, 22, 15); c.closePath(); }, '#d6ccb2', 2);
  shape(c, () => { c.beginPath(); c.moveTo(21, 14); c.quadraticCurveTo(30, 7, 39, 5); c.quadraticCurveTo(31, 11, 25, 16); c.closePath(); }, '#efe6cf', 2);
  shape(c, () => { c.beginPath(); c.moveTo(29, 19); c.lineTo(33, 13); c.lineTo(33, 21); c.closePath(); }, '#efe6cf', 2);
  eye(c, 23, 18, 1.9, t);
  leg(c, -10, 28, 16, 9, back, p.body); leg(c, 13, 28, 16, 9, front, p.body);
}
function drawPtero(c, t, a, air, p) {
  const flap = Math.sin(t * 9), tip = 24 - 22 * flap;
  shape(c, () => { c.beginPath(); c.moveTo(4, 22); c.quadraticCurveTo(-4, tip - 4, -14, tip); c.quadraticCurveTo(-10, 25, -9, 30); c.closePath(); }, p.dark, 2);
  marks(c, p.dark, [[-10, 30, -20, 34], [-8, 31, -18, 37]]);
  shape(c, () => {
    c.beginPath(); c.ellipse(-2, 28, 13, 7, -.1, 0, Math.PI * 2);
    c.moveTo(8, 24); c.quadraticCurveTo(14, 18, 18, 16); c.lineTo(22, 20); c.quadraticCurveTo(14, 26, 10, 31); c.closePath();
  }, grad(c, 20, 36, p));
  shape(c, () => { c.beginPath(); c.moveTo(17, 13); c.lineTo(2, 5); c.lineTo(20, 10); c.closePath(); }, p.crest, 2);
  shape(c, () => {
    c.beginPath(); c.ellipse(20, 16, 6, 5, 0, 0, Math.PI * 2);
    c.moveTo(22, 13); c.lineTo(40, 17); c.lineTo(22, 20); c.closePath();
  }, grad(c, 10, 22, p), 2.5);
  marks(c, INK, [[25, 17, 38, 17]]);
  eye(c, 20, 15, 1.7, t);
  shape(c, () => { c.beginPath(); c.moveTo(6, 24); c.quadraticCurveTo(0, tip, -8, tip + 4); c.quadraticCurveTo(-8, 27, -12, 31); c.closePath(); }, p.wing, 2);
  c.strokeStyle = 'rgba(80,40,25,.5)'; c.lineWidth = 1.2;
  c.beginPath(); c.moveTo(5, 24); c.lineTo(-6, tip + 4); c.stroke();
}
function flipper(c, x, y, ang, col) {
  c.save(); c.translate(x, y); c.rotate(ang);
  shape(c, () => { c.beginPath(); c.ellipse(-7, 3, 11, 3.6, 0, 0, Math.PI * 2); }, col, 2);
  c.restore();
}
function drawPlesio(c, t, a, air, p) {
  const f = Math.sin(t * 5) * .5;
  flipper(c, 8, 34, .6 + f, p.dark); flipper(c, -14, 34, .6 - f, p.dark);
  shape(c, () => {
    c.beginPath(); c.ellipse(-6, 32, 18, 9, 0, 0, Math.PI * 2);
    c.moveTo(-20, 30); c.quadraticCurveTo(-32, 32, -38, 36); c.quadraticCurveTo(-30, 38, -20, 36); c.closePath();
    c.moveTo(8, 28); c.quadraticCurveTo(20, 24, 26, 10); c.lineTo(31, 10); c.quadraticCurveTo(27, 30, 10, 37); c.closePath();
    c.moveTo(37, 8); c.ellipse(30, 8, 7, 5, 0, 0, Math.PI * 2);
  }, grad(c, 3, 42, p));
  c.fillStyle = 'rgba(25,55,70,.35)';
  [[-12, 26, 2.4], [-4, 25, 2], [-18, 29, 1.8], [3, 27, 1.6], [24, 15, 1.4]].forEach(([x, y, r]) => circle(c, x, y, r));
  eye(c, 31, 6, 1.5, t);
  marks(c, INK, [[33, 10, 37, 9.5]]);
  flipper(c, 6, 37, .3 - f, p.body); flipper(c, -16, 37, .3 + f, p.body);
}
function drawDino(c, sp, cx, bottom, face, t, moving, air, s = 1) {
  c.save(); c.translate(cx, bottom - 44 * s); c.scale(face * s, s);
  if (moving && !air) c.translate(0, -Math.abs(Math.sin(t * 12)) * 1.5);
  c.lineJoin = 'round'; c.lineCap = 'round';
  sp.draw(c, t, moving && !air ? Math.sin(t * 12) * .5 : 0, air, sp.pal);
  if (sp.acc && HEAD[sp.key]) drawAccessory(c, sp.acc, HEAD[sp.key]);
  c.restore();
}
// Un accessoire posé sur la tête (hx, hy : haut de la tête ; ex, ey : l'œil), dans le repère de l'animal.
function drawAccessory(c, id, [hx, hy, ex, ey]) {
  c.save(); c.strokeStyle = INK; c.lineWidth = 1.4; c.lineJoin = 'round';
  if (id === 'fleur') {
    c.fillStyle = '#f27bb4'; for (let k = 0; k < 5; k++) { const a = k * 1.26; circle(c, hx + Math.cos(a) * 3, hy - 3 + Math.sin(a) * 3, 2.4); }
    c.fillStyle = '#ffd23a'; circle(c, hx, hy - 3, 1.8);
  } else if (id === 'casquette') {
    c.fillStyle = '#e5483b'; c.beginPath(); c.ellipse(hx, hy + .5, 6.5, 5, 0, Math.PI, 0); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(hx + 5, hy + .5); c.lineTo(hx + 12, hy + 1.5); c.lineTo(hx + 5, hy + 2.5); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#fff'; circle(c, hx, hy - 4, 1.2);
  } else if (id === 'lunettes') {
    c.lineWidth = 1.3; c.beginPath(); c.moveTo(ex - 2, ey - 1); c.lineTo(ex - 9, ey - 2.5); c.stroke();
    c.fillStyle = '#1d2b22'; c.beginPath(); c.ellipse(ex + .5, ey, 3.6, 3, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,.6)'; circle(c, ex + 1.6, ey - 1.1, .9);
  } else if (id === 'pirate') {
    c.fillStyle = '#1d2b22'; c.beginPath(); c.moveTo(hx - 9, hy + 1); c.quadraticCurveTo(hx, hy - 3, hx + 9, hy + 1); c.quadraticCurveTo(hx + 4, hy - 9, hx, hy - 8); c.quadraticCurveTo(hx - 4, hy - 9, hx - 9, hy + 1); c.fill();
    c.fillStyle = '#fff'; circle(c, hx, hy - 3.5, 1.6); c.fillRect(hx - 2, hy - 1.6, 4, .9);
  } else if (id === 'couronne') {
    c.fillStyle = '#ffd23a'; c.beginPath(); c.moveTo(hx - 6, hy + 1); c.lineTo(hx - 6, hy - 5); c.lineTo(hx - 3, hy - 2); c.lineTo(hx, hy - 7); c.lineTo(hx + 3, hy - 2); c.lineTo(hx + 6, hy - 5); c.lineTo(hx + 6, hy + 1); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#e5483b'; circle(c, hx, hy - 1.5, 1.2);
  }
  c.restore();
}
/* Tricératops vu de dessus, tête vers la droite */
function drawTrikeTop(c, x, y, ang, t, moving, p, s = 1) {
  c.save(); c.translate(x, y); c.rotate(ang); c.scale(s, s);
  c.lineJoin = 'round'; c.lineCap = 'round';
  c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(3, 5, 27, 16, 0, 0, Math.PI * 2); c.fill();
  const w = moving ? Math.sin(t * 12) * 4 : 0;
  [[10, -12, w], [10, 12, -w], [-10, -13, -w], [-10, 13, w]].forEach(([lx, ly, o]) => shape(c, () => { c.beginPath(); c.ellipse(lx + o, ly, 5.5, 4.5, 0, 0, Math.PI * 2); }, p.dark, 2));
  shape(c, () => { c.beginPath(); c.moveTo(-14, -6); c.quadraticCurveTo(-28, -2 + w * .5, -35, w * .6); c.quadraticCurveTo(-28, 2 + w * .5, -14, 6); c.closePath(); }, p.body, 2.5);
  const g = gradCache(c, `r${p.belly},${p.body},${p.dark}`, () => {
    const r = c.createRadialGradient(-3, -3, 2, -2, 0, 20);
    r.addColorStop(0, p.belly); r.addColorStop(.5, p.body); r.addColorStop(1, p.dark);
    return r;
  });
  shape(c, () => { c.beginPath(); c.ellipse(-2, 0, 19, 13, 0, 0, Math.PI * 2); }, g);
  marks(c, 'rgba(60,45,25,.5)', [[-13, -3, -13, 3], [-6, -4, -6, 4], [1, -3, 1, 3]]);
  shape(c, () => { c.beginPath(); c.ellipse(13, 0, 7, 16, 0, 0, Math.PI * 2); }, p.frill);
  c.fillStyle = p.frillDark; for (let k = -2; k <= 2; k++) circle(c, 10, k * 6, 1.6);
  shape(c, () => { c.beginPath(); c.moveTo(14, -7); c.quadraticCurveTo(28, -6, 33, 0); c.quadraticCurveTo(28, 6, 14, 7); c.closePath(); }, p.body);
  [-1, 1].forEach(sg => shape(c, () => { c.beginPath(); c.moveTo(19, -5 * sg); c.lineTo(37, -10 * sg); c.lineTo(22, -1 * sg); c.closePath(); }, '#efe6cf', 2));
  shape(c, () => { c.beginPath(); c.moveTo(28, -1.6); c.lineTo(35, 0); c.lineTo(28, 1.6); c.closePath(); }, '#efe6cf', 1.5);
  c.fillStyle = '#1e180e'; circle(c, 22, -5.5, 1.6); circle(c, 22, 5.5, 1.6);
  c.restore();
}

/* ---------- Écran ---------- */
const cv = $('game'), ctx = cv.getContext('2d');
let dpr = 1, scale = 1, viewW = 800, viewH = VIEW_H;
function resize() {
  const r = cv.getBoundingClientRect();
  dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.max(1, Math.round(r.height * dpr));
  scale = Math.max(.1, Math.min(r.height / VIEW_H, r.width / 480));
  viewW = r.width / scale; viewH = r.height / scale;
  stickHome();
}
window.addEventListener('resize', resize);
const setView = () => ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);

