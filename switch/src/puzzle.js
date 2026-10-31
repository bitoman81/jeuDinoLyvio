/* ---------- Version Switch (nx.js) : les énigmes à choix ----------
   Le code des énigmes du jeu tourne tel quel : il remplit le titre, l'image (HTML et SVG) et crée un
   bouton par réponse, sur les faux éléments de dom.js. Ici, on relit tout cela et on le dessine sur
   l'écran, puis on renvoie les choix (A, X, Y, B ou le doigt) aux boutons du jeu. Les erreurs, les
   étoiles, la difficulté, les aides et les statistiques restent donc exactement celles du jeu web.
   nx.js n'affiche ni HTML ni SVG : un petit lecteur les transforme en dessins sur le canvas.
   Les énigmes-jeux (labyrinthe, taquin, mémoire...) et les mots à écrire viendront ensuite :
   en attendant, leur pierre s'ouvre toute seule. */

/* ---------- Lire du HTML ou du SVG ---------- */
const SW_ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const swDecode = s => s.replace(/&(#\d+|[a-z]+);/g, (m, e) => e[0] === '#' ? String.fromCharCode(+e.slice(1)) : SW_ENT[e] || m);
// Transforme une chaîne en arbre : { tag, a: {attributs}, k: [enfants] } ou { t: 'texte' }.
function swParse(html) {
  const root = { tag: '#root', a: {}, k: [] }, stack = [root];
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)((?:\s+[\w:-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(String(html)))) {
    const top = stack[stack.length - 1];
    if (m[5] !== undefined) { const t = swDecode(m[5]); if (t.trim()) top.k.push({ t }); continue; }
    if (!m[2]) continue;
    const tag = m[2].toLowerCase();
    if (m[1]) { for (let i = stack.length - 1; i > 0; i--) if (stack[i].tag === tag) { stack.length = i; break; } continue; }
    const a = {}, ar = /([\w:-]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g; let am;
    while ((am = ar.exec(m[3]))) a[am[1]] = am[2] === undefined ? '' : swDecode(am[2].replace(/^["']|["']$/g, ''));
    const node = { tag, a, k: [] };
    top.k.push(node);
    if (!m[4] && !['br', 'img', 'input', 'hr'].includes(tag)) stack.push(node);
  }
  return root;
}
const swCls = (n, c) => n.a && (' ' + (n.a.class || '') + ' ').includes(' ' + c + ' ');
const swStyle = (n, prop) => { const m = n.a && n.a.style && n.a.style.match(new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*([^;]+)')); return m ? m[1].trim() : null; };
const swTextOf = n => n.t !== undefined ? n.t : (n.k || []).map(swTextOf).join('');

/* ---------- Dessiner du SVG sur le canvas ---------- */
const swNum = (v, d = 0) => { const f = parseFloat(v); return isNaN(f) ? d : f; };
function swTransform(c, tr) {
  const re = /(translate|scale|rotate|matrix)\s*\(([^)]*)\)/g; let m;
  while ((m = re.exec(tr))) {
    const v = m[2].split(/[\s,]+/).filter(Boolean).map(Number);
    if (m[1] === 'translate') c.translate(v[0] || 0, v[1] || 0);
    else if (m[1] === 'scale') c.scale(v[0], v.length > 1 ? v[1] : v[0]);
    else if (m[1] === 'rotate') { if (v.length > 2) { c.translate(v[1], v[2]); c.rotate(v[0] * Math.PI / 180); c.translate(-v[1], -v[2]); } else c.rotate(v[0] * Math.PI / 180); }
    else if (m[1] === 'matrix') c.transform(v[0], v[1], v[2], v[3], v[4], v[5]);
  }
}
// Ajoute la forme d'un élément simple au tracé en cours (pas les <path>, qui passent par Path2D).
function swShapePath(c, n) {
  const a = n.a, N = swNum;
  if (n.tag === 'circle') { c.moveTo(N(a.cx) + N(a.r), N(a.cy)); c.arc(N(a.cx), N(a.cy), N(a.r), 0, Math.PI * 2); }
  else if (n.tag === 'ellipse') { c.moveTo(N(a.cx) + N(a.rx), N(a.cy)); c.ellipse(N(a.cx), N(a.cy), N(a.rx), N(a.ry), 0, 0, Math.PI * 2); }
  else if (n.tag === 'rect') {
    const x = N(a.x), y = N(a.y), w = N(a.width), h = N(a.height), r = Math.min(N(a.rx, N(a.ry)), w / 2, h / 2);
    if (r > 0) {
      const P = Math.PI;
      c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.arc(x + w - r, y + r, r, -P / 2, 0); c.lineTo(x + w, y + h - r); c.arc(x + w - r, y + h - r, r, 0, P / 2);
      c.lineTo(x + r, y + h); c.arc(x + r, y + h - r, r, P / 2, P); c.lineTo(x, y + r); c.arc(x + r, y + r, r, P, P * 1.5); c.closePath();
    } else c.rect(x, y, w, h);
  }
  else if (n.tag === 'line') { c.moveTo(N(a.x1), N(a.y1)); c.lineTo(N(a.x2), N(a.y2)); }
  else if (n.tag === 'polygon' || n.tag === 'polyline') {
    const p = (a.points || '').trim().split(/[\s,]+/).map(Number);
    for (let i = 0; i + 1 < p.length; i += 2) c[i ? 'lineTo' : 'moveTo'](p[i], p[i + 1]);
    if (n.tag === 'polygon') c.closePath();
  }
}
const SW_NOPAINT = v => !v || v === 'none' || v === 'transparent';
function swSvgNode(c, n, st, masks, opt) {
  if (n.t !== undefined || ['mask', 'defs', 'title', 'desc', 'clippath'].includes(n.tag)) return;
  const a = n.a, s = { ...st };
  for (const [k, p] of [['fill', 'fill'], ['stroke', 'stroke'], ['stroke-width', 'sw'], ['stroke-linecap', 'cap'], ['stroke-linejoin', 'join'], ['font-size', 'fs'], ['text-anchor', 'anchor'], ['fill-opacity', 'fo'], ['stroke-opacity', 'so']])
    if (a[k] !== undefined) s[p] = a[k];
  c.save();
  if (a.opacity !== undefined) c.globalAlpha *= swNum(a.opacity, 1);
  if (a.transform) swTransform(c, a.transform);
  // Masque (la lune) : la partie blanche du masque moins ses formes noires, par la règle pair-impair.
  const mk = a.mask && a.mask.match(/url\(#([^)]+)\)/);
  if (mk && masks[mk[1]]) { c.beginPath(); masks[mk[1]].k.forEach(m => { if (m.tag) swShapePath(c, m); }); c.clip('evenodd'); }
  const col = v => v === 'currentColor' ? (opt.color || SW_INK) : opt.mono || v;
  const paint = path => {
    if (!SW_NOPAINT(s.fill)) { c.fillStyle = col(s.fill); const ga = c.globalAlpha; c.globalAlpha *= swNum(s.fo, 1); path ? c.fill(path) : c.fill(); c.globalAlpha = ga; }
    if (!SW_NOPAINT(s.stroke)) {
      c.strokeStyle = col(s.stroke); c.lineWidth = swNum(s.sw, 1); c.lineCap = s.cap || 'butt'; c.lineJoin = s.join || 'miter';
      const ga = c.globalAlpha; c.globalAlpha *= swNum(s.so, 1); path ? c.stroke(path) : c.stroke(); c.globalAlpha = ga;
    }
  };
  if (n.tag === 'g' || n.tag === 'svg') n.k.forEach(k => swSvgNode(c, k, s, masks, opt));
  else if (n.tag === 'path') { if (!n.p2d) n.p2d = new Path2D(a.d || ''); paint(n.p2d); }
  else if (n.tag === 'text') {
    if (!SW_NOPAINT(s.fill)) {
      c.font = `${swNum(s.fs, 16)}px sans-serif`; c.textAlign = { middle: 'center', end: 'right' }[s.anchor] || 'left'; c.textBaseline = 'alphabetic';
      c.fillStyle = col(s.fill); c.fillText(swTextOf(n), swNum(a.x), swNum(a.y));
    }
  }
  else { c.beginPath(); swShapePath(c, n); paint(null); }
  c.restore();
}
// Dessine un <svg> dans le rectangle (x, y, w, h), en gardant ses proportions.
function swSvg(c, svg, x, y, w, h, opt = {}) {
  const vb = (svg.a.viewbox || svg.a.viewBox || '0 0 100 100').split(/[\s,]+/).map(Number);
  let s = Math.min(w / vb[2], h / vb[3]);
  const sc = (swStyle(svg, 'transform') || '').match(/scale\(([\d.]+)\)/); if (sc) s *= +sc[1];
  const masks = {};
  (function find(n) { (n.k || []).forEach(k => { if (k.tag === 'mask' && k.a.id) masks[k.a.id] = k; else find(k); }); })(svg);
  c.save();
  c.translate(x + w / 2, y + h / 2);
  if (opt.flip) c.scale(-1, 1);
  c.scale(s, s); c.translate(-vb[0] - vb[2] / 2, -vb[1] - vb[3] / 2);
  if (opt.alpha !== undefined) c.globalAlpha *= opt.alpha;
  svg.k.forEach(k => swSvgNode(c, k, { fill: '#000', fo: 1, so: 1 }, masks, opt));
  c.restore();
}

/* ---------- Mettre en page le HTML des énigmes ----------
   Chaque morceau devient une boîte { w, h, draw(x, y) }. Les tailles reprennent le CSS du jeu web. */
const SW_RUNE = '#7a6f9b';
const SW_SVG_SIZE = { pic: 170, mini: 54, clock: 200, shape: 80, shadow: 110, 'egg-i': 30 };
const SW_COIN = { 200: 80, 100: 70, 50: 64, 20: 58, 10: 52 };
function swBoxText(t, size, color = SW_INK) {
  const c = SW.ctx; c.font = `${size}px sans-serif`;
  const w = c.measureText(t).width;
  return { w, h: size * 1.15, draw: (x, y) => swText(t, x + w / 2, y + size * .6, size, color, 'center') };
}
function swBoxSvg(n, opt = {}) {
  let size = 60;
  for (const k in SW_SVG_SIZE) if (swCls(n, k)) size = SW_SVG_SIZE[k];
  if (swCls(n, 'coin')) { const m = (n.a.class || '').match(/c(\d+)/); size = SW_COIN[m && m[1]] || 56; }
  if (opt.size) size = opt.size;
  const o = swCls(n, 'shadow') ? { mono: '#111', alpha: .85, flip: swCls(n, 'flip') } : {};
  return { w: size, h: size, draw: (x, y) => swSvg(SW.ctx, n, x, y, size, size, o) };
}
// Une rangée qui passe à la ligne au-delà de maxW, centrée.
function swBoxFlow(boxes, maxW, gap = 10, vgap = 8) {
  const lines = [[]]; let lw = 0;
  boxes.forEach(b => { if (lines[lines.length - 1].length && lw + gap + b.w > maxW) { lines.push([]); lw = 0; } lw += (lines[lines.length - 1].length ? gap : 0) + b.w; lines[lines.length - 1].push(b); });
  const dims = lines.map(l => ({ w: l.reduce((s, b) => s + b.w, 0) + gap * Math.max(0, l.length - 1), h: Math.max(0, ...l.map(b => b.h)) }));
  const w = Math.max(0, ...dims.map(d => d.w)), h = dims.reduce((s, d) => s + d.h, 0) + vgap * Math.max(0, lines.length - 1);
  return {
    w, h, draw(x, y) {
      lines.forEach((l, i) => {
        let cx = x + (w - dims[i].w) / 2;
        l.forEach(b => { b.draw(cx, y + (dims[i].h - b.h) / 2); cx += b.w + gap; });
        y += dims[i].h + vgap;
      });
    },
  };
}
function swBoxCol(boxes, gap = 6) {
  const w = Math.max(0, ...boxes.map(b => b.w)), h = boxes.reduce((s, b) => s + b.h, 0) + gap * Math.max(0, boxes.length - 1);
  return { w, h, draw(x, y) { boxes.forEach(b => { b.draw(x + (w - b.w) / 2, y); y += b.h + gap; }); } };
}
function swBox(n, ctx) {
  if (n.t !== undefined) return swBoxText(n.t.trim(), ctx.fs, ctx.color);
  const c = SW.ctx;
  if (n.tag === 'svg') return swBoxSvg(n);
  if (n.tag === 'button' && swCls(n, 'say-big')) {
    const svg = n.k.find(k => k.tag === 'svg');
    return { w: 110, h: 110, draw: (x, y) => { swPanel(x, y, 110, 110); if (svg) swSvg(c, svg, x + 20, y + 20, 70, 70, { color: SW_INK }); } };
  }
  if (n.tag === 'span' && swCls(n, 'dot')) {
    const q = swCls(n, 'q'), bg = swStyle(n, 'background') || '#fff';
    return {
      w: 50, h: 50, draw: (x, y) => {
        c.fillStyle = q ? '#fff' : bg; c.strokeStyle = SW_INK; c.lineWidth = 4;
        if (q && c.setLineDash) c.setLineDash([7, 5]);
        c.beginPath(); c.arc(x + 25, y + 25, 22, 0, Math.PI * 2); c.fill(); c.stroke();
        if (c.setLineDash) c.setLineDash([]);
        if (q) swText('?', x + 25, y + 27, 28, SW_RUNE, 'center');
      },
    };
  }
  if (n.tag === 'span' && swCls(n, 'num')) {
    const q = swCls(n, 'q'), t = q ? '?' : swTextOf(n);
    c.font = '32px sans-serif'; const w = Math.max(60, c.measureText(t).width + 26);
    return {
      w, h: 60, draw: (x, y) => {
        c.fillStyle = '#fff'; c.strokeStyle = SW_INK; c.lineWidth = 4;
        if (q && c.setLineDash) c.setLineDash([8, 6]);
        rr(c, x, y, w, 60, 14); c.fill(); c.stroke();
        if (c.setLineDash) c.setLineDash([]);
        swText(t, x + w / 2, y + 32, 32, q ? SW_RUNE : SW_INK, 'center');
      },
    };
  }
  if (n.tag === 'div' && swCls(n, 'word')) {
    const cells = n.k.filter(k => k.tag === 'span').map(k => {
      const gap = swCls(k, 'gap'), t = swTextOf(k);
      return {
        w: 50, h: 66, draw: (x, y) => {
          c.fillStyle = gap ? SW_RUNE : SW_INK; c.fillRect(x, y + 60, 50, 6);
          if (t) swText(t, x + 25, y + 32, 46, gap ? SW_RUNE : SW_INK, 'center');
        },
      };
    });
    return swBoxFlow(cells, 1000, 10);
  }
  if (n.tag === 'div' && swCls(n, 'group')) {
    const mw = swNum(swStyle(n, 'max-width'), 260) * 1.15;
    return swBoxFlow(n.k.map(k => swBox(k, ctx)), mw, 5, 5);
  }
  if (n.tag === 'small') return swBoxCol(swWrap(swTextOf(n), 260, 20).map(l => swBoxText(l, 20, '#4b5d50')), 2);
  if (n.tag === 'span' && swCls(n, 'wd')) return swBoxText(swTextOf(n), Math.round(ctx.fs * .75), ctx.color);
  return swBoxGroup(n.k, ctx);
}
// Des enfants à la suite ; les <small> (sous-titres) passent dessous.
function swBoxGroup(kids, ctx, maxW = 1000) {
  const main = kids.filter(k => k.tag !== 'small').map(k => swBox(k, ctx)).filter(b => b.w > 0);
  const smalls = kids.filter(k => k.tag === 'small').map(k => swBox(k, ctx));
  const row = swBoxFlow(main, maxW, 12);
  return smalls.length ? swBoxCol([row, ...smalls], 4) : row;
}
// Réduit une boîte pour qu'elle tienne dans (maxW, maxH), ou l'agrandit jusqu'à `grow` fois s'il y a la place.
function swFitBox(b, maxW, maxH, grow = 1) {
  const s = Math.min(grow, maxW / Math.max(1, b.w), maxH / Math.max(1, b.h));
  if (s === 1) return b;
  return { w: b.w * s, h: b.h * s, draw(x, y) { const c = SW.ctx; c.save(); c.translate(x, y); c.scale(s, s); b.draw(0, 0); c.restore(); } };
}

/* ---------- L'énigme à l'écran ---------- */
const swOpenPuzzle = openPuzzle;
const swChoicePuzzle = choicePuzzle;
const swSay = say;
SW.pz = null;
// La voix n'existe pas encore sur la Switch : ce qu'elle dirait s'écrit sous le titre.
say = text => { SW.said = text; swSay(text); };
choicePuzzle = o => { SW.pzo = o; swChoicePuzzle(o); };
openPuzzle = g => {
  SW.pzo = null; SW.said = '';
  swOpenPuzzle(g);
  if (SW.pzo && pzHelp && pzHelp.btns) { swPuzzleSetup(); return; }
  // Énigme-jeu ou mot à écrire : pas encore sur la Switch, la pierre s'ouvre.
  currentGate = g; pzStars = 3; pzLocked = true;
  closePuzzle(true);
  SFX.yay(); swToast('Bravo, un œuf ! (cette énigme arrive bientôt sur la Switch)');
};
function swPuzzleSetup() {
  const o = SW.pzo, ctx = { fs: 56, color: SW_INK };
  SW.pz = {
    title: o.title, focus: 0, t0: performance.now(),
    visual: swFitBox(swBoxGroup(swParse(o.visual || '').k, ctx), 1000, 250, 1.6),
    cards: pzHelp.btns.map(b => ({ b, box: swFitBox(swBoxGroup(swParse(b.innerHTML).k, ctx), 320, 190) })),
  };
}
const swPzOn = () => state === 'puzzle' && SW.pz && pzHelp;
const swCardOk = cd => !cd.b.disabled && !cd.b.classList.contains('gone');
function swPzMove(d) {
  const cards = SW.pz.cards; let i = SW.pz.focus;
  for (let k = 0; k < cards.length; k++) { i = (i + d + cards.length) % cards.length; if (swCardOk(cards[i])) break; }
  SW.pz.focus = i; SFX.key();
}
function swPzChoose(i) {
  const cd = SW.pz.cards[i];
  if (!cd || pzLocked || !swCardOk(cd)) return;
  SW.pz.focus = i; cd.b.onclick();
  // Après une erreur, on passe à une réponse encore possible.
  if (!pzLocked && !swCardOk(cd)) swPzMove(1);
}
const swHelpCut = () => { const b = $('helpCut'); if (!pzLocked && !b.disabled && b.onclick) b.onclick(); };
const swHelpHint = () => { const b = $('helpHint'); if (!pzLocked && !b.disabled && b.onclick) b.onclick(); };
const swPzBack = () => { if (!pzLocked) { $('pzBack').onclick(); SW.pz = null; } };
// Manette pendant une énigme : renvoie true si elle a pris la main.
function swPzPad(btn) {
  if (!swPzOn()) return false;
  if (btn.dir === 'l') swPzMove(-1); else if (btn.dir === 'r') swPzMove(1);
  if (btn.a) swPzChoose(SW.pz.focus);
  else if (btn.x) swHelpCut();
  else if (btn.y) swHelpHint();
  else if (btn.b) swPzBack();
  return true;
}
function swPzTouch(x, y) {
  if (!swPzOn()) return false;
  const h = SW.pzHits.find(z => x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h);
  if (h) h.fn();
  return true;
}
function swDrawPuzzle() {
  if (!swPzOn()) { if (state !== 'puzzle') SW.pz = null; return; }
  const c = SW.ctx, P = SW.pz, t = performance.now() / 1000;
  SW.pzHits = [];
  c.fillStyle = 'rgba(16,40,26,.6)'; c.fillRect(0, 0, SW_W, SW_H);
  swPanel(60, 24, SW_W - 120, SW_H - 48);
  // Titre, puis ce que la voix dirait
  swText(P.title, SW_W / 2, 70, swFit(P.title, SW_W - 200, 40), SW_INK, 'center');
  const said = SW.said || '';
  if (said && said !== P.title) swText(said, SW_W / 2, 112, swFit(said, SW_W - 200, 24), '#4b5d50', 'center');
  // L'image de l'énigme
  const vy = 136, vh = 250;
  if (P.visual.w > 0) P.visual.draw((SW_W - P.visual.w) / 2, vy + (vh - P.visual.h) / 2);
  // Les réponses
  const cards = P.cards, gap = 26;
  let cw = Math.max(150, ...cards.map(cd => cd.box.w + 44)), ch = Math.max(150, ...cards.map(cd => cd.box.h + 40));
  cw = Math.min(cw, (SW_W - 200 - gap * (cards.length - 1)) / cards.length);
  const cy = vh + vy + 14, x0 = (SW_W - (cw * cards.length + gap * (cards.length - 1))) / 2;
  cards.forEach((cd, i) => {
    const b = cd.b, cl = b.classList, x = x0 + i * (cw + gap);
    if (cl.contains('gone')) return;
    const good = cl.contains('good'), bad = cl.contains('bad'), hint = cl.contains('hint') && !pzLocked;
    if (hint) { c.globalAlpha = .55 + .45 * Math.sin(t * 6); c.fillStyle = SW_SUN; rr(c, x - 12, cy - 12, cw + 24, ch + 24, 30); c.fill(); c.globalAlpha = 1; }
    if (i === P.focus && !pzLocked) { c.fillStyle = SW_SUN; rr(c, x - 8, cy - 8, cw + 16, ch + 16, 28); c.fill(); }
    if (bad) c.globalAlpha = .35;
    c.fillStyle = SW_INK; rr(c, x, cy + 6, cw, ch, 22); c.fill();
    swPanel(x, cy, cw, ch, good ? '#8fd18f' : '#fff');
    const bx = cd.box; bx.draw(x + (cw - bx.w) / 2, cy + (ch - bx.h) / 2);
    c.globalAlpha = 1;
    SW.pzHits.push({ x, y: cy, w: cw, h: ch, fn: () => swPzChoose(i) });
  });
  // Bas de l'écran : les aides et le retour, ou les étoiles quand c'est gagné
  const by = SW_H - 92;
  if (pzLocked) {
    for (let k = 0; k < 3; k++) swStar(SW_W / 2 + (k - 1) * 60, by + 30, 24, k < pzStars);
    return;
  }
  const helpOn = !$('pzHelp').hidden;
  const btns = [
    helpOn && { key: 'X', el: $('helpCut'), fn: swHelpCut },
    helpOn && { key: 'Y', el: $('helpHint'), fn: swHelpHint },
    { key: 'B', label: 'Retour au jeu', fn: swPzBack },
  ].filter(Boolean);
  const bw = 340, bg = 20, bx0 = (SW_W - (bw * btns.length + bg * (btns.length - 1))) / 2;
  btns.forEach((h, i) => {
    const x = bx0 + i * (bw + bg), off = h.el && h.el.disabled;
    const label = h.label || swDecode((h.el.innerHTML || '').replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
    c.globalAlpha = off ? .4 : 1;
    swPanel(x, by, bw, 58, h.label ? SW_PAPER : '#ffe7b8');
    c.fillStyle = SW_INK; circle(c, x + 30, by + 29, 18); swText(h.key, x + 30, by + 30, 22, SW_PAPER, 'center');
    if (h.el) {
      // « Enlever une réponse 5 » : le prix avec un petit trésor
      const m = label.match(/^(.*?)\s*(\d+)$/), txt = m ? m[1] : label, price = m ? m[2] : '';
      swText(txt, x + 58, by + 30, swFit(txt, bw - 130, 22), SW_INK);
      if (price) { c.fillStyle = '#ffd23a'; c.strokeStyle = SW_INK; c.lineWidth = 2; c.beginPath(); c.arc(x + bw - 52, by + 29, 10, 0, Math.PI * 2); c.fill(); c.stroke(); swText(price, x + bw - 36, by + 30, 22); }
    } else swText(label, x + 58, by + 30, 22);
    c.globalAlpha = 1;
    SW.pzHits.push({ x, y: by, w: bw, h: 58, fn: h.fn });
  });
  swText(`Ton sac : ${prog.bag.n} trésor${prog.bag.n > 1 ? 's' : ''}`, SW_W - 90, 70, 20, '#4b5d50', 'right');
}
