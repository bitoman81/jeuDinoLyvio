/* ---------- Version Switch (nx.js) : les énigmes à choix ----------
   Le code des énigmes du jeu tourne tel quel : il remplit le titre, l'image (HTML et SVG) et crée un
   bouton par réponse, sur les faux éléments de dom.js. Ici, on relit tout cela et on le dessine sur
   l'écran, puis on renvoie les choix (A, X, Y, B ou le doigt) aux boutons du jeu. Les erreurs, les
   étoiles, la difficulté, les aides et les statistiques restent donc exactement celles du jeu web.
   nx.js n'affiche ni HTML ni SVG : un petit lecteur les transforme en dessins sur le canvas.
   Les énigmes-jeux (labyrinthe, taquin, mémoire...) et les mots à écrire viendront ensuite :
   en attendant, leur pierre s'ouvre toute seule. */

/* ---------- Lire du HTML ou du SVG (le lecteur est dans dom.js) ---------- */
const swParse = html => swParseInto(new SwEl('#root'), html);
const swCls = (n, c) => n.a && (' ' + (n.a.class || '') + ' ').includes(' ' + c + ' ');
const swStyle = (n, prop) => { const m = n.a && n.a.style && n.a.style.match(new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*([^;]+)')); return m ? m[1].trim() : null; };

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
  // stretch : étiré dans le rectangle (preserveAspectRatio="none", morceaux du puzzle)
  let s = Math.min(w / vb[2], h / vb[3]), sy = s;
  if (opt.stretch) { s = w / vb[2]; sy = h / vb[3]; }
  const sc = (swStyle(svg, 'transform') || '').match(/scale\(([\d.]+)\)/); if (sc) { s *= +sc[1]; sy *= +sc[1]; }
  const masks = {};
  (function find(n) { (n.k || []).forEach(k => { if (k.tag === 'mask' && k.a.id) masks[k.a.id] = k; else find(k); }); })(svg);
  c.save();
  // Comme dans un navigateur, ce qui dépasse du cadre du SVG est caché (morceaux du puzzle).
  c.beginPath(); c.rect(x, y, w, h); c.clip();
  c.translate(x + w / 2, y + h / 2);
  if (opt.flip) c.scale(-1, 1);
  c.scale(s, sy); c.translate(-vb[0] - vb[2] / 2, -vb[1] - vb[3] / 2);
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
// SW.tf garde les agrandissements en cours, pour placer les zones à toucher au bon endroit de l'écran.
SW.tf = [];
function swFitBox(b, maxW, maxH, grow = 1) {
  const s = Math.min(grow, maxW / Math.max(1, b.w), maxH / Math.max(1, b.h));
  if (s === 1) return b;
  return { w: b.w * s, h: b.h * s, draw(x, y) { const c = SW.ctx; c.save(); c.translate(x, y); c.scale(s, s); SW.tf.push([x, y, s]); b.draw(0, 0); SW.tf.pop(); c.restore(); } };
}

/* ---------- Les énigmes-jeux : dessiner les éléments du jeu et noter ceux qu'on peut toucher ---------- */
SW.pzClick = [];
// Note un élément cliquable à sa place sur l'écran (nav : false = seulement au doigt).
function swReg(el, x, y, w, h, extra = {}) {
  for (let i = SW.tf.length - 1; i >= 0; i--) { const [tx, ty, s] = SW.tf[i]; x = tx + x * s; y = ty + y * s; w *= s; h *= s; }
  SW.pzClick.push({ el, x, y, w, h, ...extra });
}
const swClickable = el => typeof el.onclick === 'function' && !el.disabled;
const swGridCols = (n, d) => { const m = (n.a.style || '').match(/repeat\((\d+)/); return m ? +m[1] : d; };
const swCssVar = (n, v, d) => { const m = (n.a.style || '').match(new RegExp('--' + v + ':\\s*([\\d.-]+)')); return m ? +m[1] : d; };
// Une grille de cases (taquin, sudoku, miroir, plateau du puzzle).
function swGrid(cells, cols, cw, ch, gap, gapAfter = () => 0) {
  const rows = Math.ceil(cells.length / cols);
  const xs = [], ys = []; let x = 0, y = 0;
  for (let i = 0; i < cols; i++) { xs.push(x); x += cw + gap + gapAfter('c', i); }
  for (let i = 0; i < rows; i++) { ys.push(y); y += ch + gap + gapAfter('r', i); }
  return { w: x - gap, h: y - gap, draw(x0, y0) { cells.forEach((cell, i) => cell(x0 + xs[i % cols], y0 + ys[(i / cols) | 0], cw, ch)); } };
}
// Contour qui brille (aide) ou rouge (erreur) autour d'une case.
function swMark(el, x, y, w, h, r = 14) {
  const c = SW.ctx, cl = el.classList;
  if (cl.contains('hint') && !pzLocked) { c.globalAlpha = .55 + .45 * Math.sin(performance.now() / 160); c.strokeStyle = SW_SUN; c.lineWidth = 8; rr(c, x - 5, y - 5, w + 10, h + 10, r + 4); c.stroke(); c.globalAlpha = 1; }
  if (cl.contains('bad')) { c.strokeStyle = '#e5483b'; c.lineWidth = 5; rr(c, x - 3, y - 3, w + 6, h + 6, r + 2); c.stroke(); }
}
function swCellBox(el, x, y, w, h, fill, r = 14) {
  const c = SW.ctx;
  c.fillStyle = fill; c.strokeStyle = SW_INK; c.lineWidth = 4; rr(c, x, y, w, h, r); c.fill(); c.stroke();
}
function swGBox(n, ctx) {
  if (n.t !== undefined) return swBoxText(n.t.trim(), ctx.fs, ctx.color);
  const c = SW.ctx, kids = n.k.filter(k => k.tag || (k.t && k.t.trim()));
  // Taquin : tuiles de couleur numérotées
  if (swCls(n, 'slide')) {
    return swGrid(kids.map(k => (x, y, w, h) => {
      if (k.tag !== 'button') { c.strokeStyle = 'rgba(29,43,34,.25)'; c.lineWidth = 3; rr(c, x, y, w, h, 16); c.stroke(); return; }
      swCellBox(k, x, y, w, h, swStyle(k, 'background') || '#ccc', 16);
      swText(swTextOf(k), x + w / 2, y + h / 2 + 2, 52, '#fff', 'center');
      if (swClickable(k)) swReg(k, x, y, w, h);
    }), swGridCols(n, 3), 116, 116, 8);
  }
  // Sudoku des formes : 4 x 4, traits épais entre les carrés
  if (swCls(n, 'sdk')) {
    return swGrid(kids.map(k => (x, y, w, h) => {
      const sel = swCls(k, 'sel'), given = swCls(k, 'given');
      swCellBox(k, x, y, w, h, given ? '#efe6cf' : sel ? '#ffe7b8' : '#fff', 10);
      if (sel) { c.strokeStyle = SW_SUN; c.lineWidth = 6; rr(c, x + 4, y + 4, w - 8, h - 8, 8); c.stroke(); }
      const svg = k.k.find(s => s.tag === 'svg'); if (svg) swSvg(c, svg, x + 10, y + 10, w - 20, h - 20);
      swMark(k, x, y, w, h, 10);
      if (swClickable(k)) swReg(k, x, y, w, h);
    }), 4, 92, 92, 4, (d, i) => i === 1 ? 10 : 0);
  }
  // Miroir : cases à colorier, la ligne du miroir au milieu
  if (swCls(n, 'sym')) {
    const cols = swGridCols(n, 4);
    return swGrid(kids.map(k => (x, y, w, h) => {
      const bg = swStyle(k, 'background');
      swCellBox(k, x, y, w, h, bg || (swCls(k, 'given') ? '#efe6cf' : '#fff'), 8);
      if (swCls(k, 'mid')) { c.fillStyle = SW_RUNE; c.fillRect(x - 9, y - 4, 6, h + 8); }
      swMark(k, x, y, w, h, 8);
      if (swClickable(k)) swReg(k, x, y, w, h);
    }), cols, 64, 64, 4, (d, i) => d === 'c' && i === cols / 2 - 1 ? 10 : 0);
  }
  // Puzzle à pièces : le plateau (avec le dessin en transparence) et les pièces à poser
  if (swCls(n, 'jig')) {
    const cols = swCssVar(n, 'c', 2), rows = swCssVar(n, 'r', 2), BW = 360, cw = BW / cols, ch = BW / rows;
    const board = n.k.find(k => swCls(k, 'board')), tray = n.k.find(k => swCls(k, 'tray'));
    const ghost = board && board.k.find(k => k.tag === 'svg' && swCls(k, 'ghost-img'));
    const slots = board ? board.k.filter(k => swCls(k, 'slot')) : [];
    const pcs = tray ? tray.k.filter(k => swCls(k, 'pc')) : [];
    const boardBox = {
      w: BW, h: BW, draw(x, y) {
        swCellBox(board, x - 6, y - 6, BW + 12, BW + 12, '#fff', 12);
        if (ghost) swSvg(c, ghost, x, y, BW, BW, { alpha: .25, stretch: true });
        slots.forEach((k, i) => {
          const sx = x + (i % cols) * cw, sy = y + ((i / cols) | 0) * ch;
          const svg = k.k.find(s => s.tag === 'svg');
          if (svg) swSvg(c, svg, sx, sy, cw, ch, { stretch: true });
          else { c.strokeStyle = 'rgba(29,43,34,.3)'; c.lineWidth = 2; c.strokeRect(sx + 2, sy + 2, cw - 4, ch - 4); }
          swMark(k, sx, sy, cw, ch, 4);
          if (swClickable(k)) swReg(k, sx, sy, cw, ch);
        });
      },
    };
    const pcBoxes = pcs.map(k => ({
      w: cw, h: ch, draw(x, y) {
        if (swCls(k, 'sel')) { c.fillStyle = SW_SUN; rr(c, x - 8, y - 8, cw + 16, ch + 16, 12); c.fill(); }
        swCellBox(k, x - 3, y - 3, cw + 6, ch + 6, '#fff', 8);
        const rot = swCssVar(k, 'rot', 0), svg = k.k.find(s => s.tag === 'svg');
        c.save(); c.translate(x + cw / 2, y + ch / 2); c.rotate(rot * Math.PI / 180);
        if (svg) swSvg(c, svg, -cw / 2, -ch / 2, cw, ch, { stretch: true });
        c.restore();
        swMark(k, x - 3, y - 3, cw + 6, ch + 6, 8);
        if (swClickable(k)) swReg(k, x, y, cw, ch);
      },
    }));
    const trayBox = swBoxFlow(pcBoxes, 3 * cw + 60, 24, 24);
    return swBoxFlow([boardBox, trayBox], 1100, 60);
  }
  // Jeu de mémoire : la carte est retournée (dessin) ou cachée (dos vert)
  if (n.tag === 'button' && swCls(n, 'mcard')) {
    return {
      w: 120, h: 120, draw(x, y) {
        const up = swCls(n, 'up') || swCls(n, 'done');
        c.globalAlpha = swCls(n, 'done') ? .6 : 1;
        swCellBox(n, x, y, 120, 120, up ? '#fff' : '#3f9a4f', 18);
        const svg = n.k.find(s => s.tag === 'svg');
        if (up && svg) swSvg(c, svg, x + 12, y + 12, 96, 96);
        else if (!up) swText('?', x + 60, y + 64, 56, '#d4efb0', 'center');
        c.globalAlpha = 1;
        if (swClickable(n)) swReg(n, x, y, 120, 120);
      },
    };
  }
  // Touches : lettres, flèches, formes, couleurs
  if (n.tag === 'button' && swCls(n, 'choice')) {
    const inner = swBoxGroup(n.k, { fs: 48, color: SW_INK }), S = Math.max(92, inner.w + 30);
    return {
      w: S, h: 92, draw(x, y) {
        if (swCls(n, 'gone')) return;
        const cl = n.classList, pressed = n.a['aria-pressed'] === 'true';
        c.globalAlpha = cl.contains('bad') || n.disabled && !cl.contains('good') ? .35 : 1;
        c.fillStyle = SW_INK; rr(c, x, y + 5, S, 92, 18); c.fill();
        swCellBox(n, x, y, S, 92, cl.contains('good') ? '#8fd18f' : pressed ? '#ffe7b8' : '#fff', 18);
        if (pressed) { c.strokeStyle = SW_SUN; c.lineWidth = 6; rr(c, x + 4, y + 4, S - 8, 84, 14); c.stroke(); }
        inner.draw(x + (S - inner.w) / 2, y + (92 - inner.h) / 2);
        c.globalAlpha = 1;
        swMark(n, x, y, S, 92, 18);
        if (swClickable(n)) swReg(n, x, y, S, 92);
      },
    };
  }
  // Dessins SVG : labyrinthe (la croix déplace le bébé) et points à relier (chaque point se touche)
  if (n.tag === 'svg' && (swCls(n, 'maze') || swCls(n, 'dots'))) {
    const S = 440;
    return {
      w: S, h: S, draw(x, y) {
        swSvg(c, n, x, y, S, S);
        const vb = n.a.viewBox.split(/[\s,]+/).map(Number), s = Math.min(S / vb[2], S / vb[3]);
        const ox = x + S / 2 - (vb[0] + vb[2] / 2) * s, oy = y + S / 2 - (vb[1] + vb[3] / 2) * s;
        if (swClickable(n)) swReg(n, x, y, S, S, { nav: false, svg: { n, ox, oy, s } });
        swWalk(n, g => {
          if (!swClickable(g)) return;
          const dot = g.k.find(k => k.tag === 'circle');
          if (dot) { const cx = ox + swNum(dot.a.cx) * s, cy = oy + swNum(dot.a.cy) * s, r = 9 * s; swReg(g, cx - r, cy - r, 2 * r, 2 * r); }
        });
      },
    };
  }
  if (n.tag === 'svg' || swCls(n, 'word') || swCls(n, 'say-big') || swCls(n, 'group') || n.tag === 'small' || swCls(n, 'dot') || swCls(n, 'num')) return swBox(n, ctx);
  // Autres conteneurs : leurs enfants à la suite
  return swBoxFlow(kids.map(k => swGBox(k, ctx)), 1100, 16, 12);
}
// Touche d'un dessin SVG (labyrinthe) : la case sous le doigt devient la cible du clic.
function swSvgClick(e, px, py) {
  const { n, ox, oy, s } = e.svg, sx = (px - ox) / s, sy = (py - oy) / s;
  let target = n;
  swWalk(n, k => {
    const a = k.a, N = swNum;
    if (k.tag === 'rect' && 'data-c' in a && sx >= N(a.x) && sx <= N(a.x) + N(a.width) && sy >= N(a.y) && sy <= N(a.y) + N(a.height)) target = k;
  });
  n.onclick({ type: 'click', target, currentTarget: n, preventDefault() {}, stopPropagation() {} });
}
// La case choisie à la croix : la plus proche du dernier point visé (les cases sont redessinées après chaque coup).
function swPzCur() {
  const P = SW.pz, l = SW.pzClick.filter(e => e.nav !== false);
  if (!l.length) return null;
  if (P.fx === undefined) { P.fx = l[0].x + l[0].w / 2; P.fy = l[0].y + l[0].h / 2; }
  let best = null, bd = 1e12;
  l.forEach(e => { const d = (e.x + e.w / 2 - P.fx) ** 2 + (e.y + e.h / 2 - P.fy) ** 2; if (d < bd) { bd = d; best = e; } });
  return best;
}
function swPzNav(dir) {
  const cur = swPzCur(); if (!cur) return;
  const cx = cur.x + cur.w / 2, cy = cur.y + cur.h / 2;
  let best = null, bs = 1e12;
  SW.pzClick.filter(e => e.nav !== false && e !== cur).forEach(e => {
    const dx = e.x + e.w / 2 - cx, dy = e.y + e.h / 2 - cy;
    const along = { l: -dx, r: dx, u: -dy, d: dy }[dir], side = dir === 'l' || dir === 'r' ? Math.abs(dy) : Math.abs(dx);
    if (along < 8) return;
    const sc = along + side * 2.5; if (sc < bs) { bs = sc; best = e; }
  });
  if (best) { SW.pz.fx = best.x + best.w / 2; SW.pz.fy = best.y + best.h / 2; SFX.key(); }
}
const SW_ARROW = { l: 'ArrowLeft', r: 'ArrowRight', u: 'ArrowUp', d: 'ArrowDown' };
function swDrawGamePuzzle() {
  const c = SW.ctx, ctx = { fs: 56, color: SW_INK };
  SW.pzClick = [];
  const visKids = pz.visual.k.filter(k => k.tag || (k.t && k.t.trim())), choKids = pz.choices.k.filter(k => k.tag && !swCls(k, 'pz-stars'));
  const top = 134, room = 476;
  // Les cartes et les touches en lignes égales (8 cartes : 2 lignes de 4, pas 7 + 1)
  let cho = null;
  if (choKids.length) {
    const boxes = choKids.map(k => swGBox(k, ctx)), n = boxes.length, bw = Math.max(...boxes.map(b => b.w)), gap = 16;
    const rows = Math.ceil((n * (bw + gap) - gap) / 1060) || 1, per = Math.ceil(n / rows);
    cho = swBoxFlow(boxes, per * (bw + gap) - gap + 1, gap, 18);
  }
  const choMax = visKids.length ? 210 : room;
  const choFit = cho ? swFitBox(cho, 1060, choMax) : null;
  const visRoom = room - (choFit ? choFit.h + 18 : 0);
  if (visKids.length) { const vis = swFitBox(swGBox(pz.visual, ctx), 1060, visRoom, 1.25); vis.draw((SW_W - vis.w) / 2, top + (visRoom - vis.h) / 2); }
  if (choFit) choFit.draw((SW_W - choFit.w) / 2, top + (visKids.length ? visRoom + 18 : (room - choFit.h) / 2));
  // La case choisie à la croix
  const cur = !pzLocked && !pzKey && swPzCur();
  if (cur) { c.strokeStyle = SW_SUN; c.lineWidth = 7; rr(c, cur.x - 7, cur.y - 7, cur.w + 14, cur.h + 14, 16); c.stroke(); }
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
  // Énigme-jeu ou mot à écrire : dessinée à chaque image à partir des éléments créés par le jeu.
  SW.pz = { game: true, t0: performance.now() };
};
function swPuzzleSetup() {
  const o = SW.pzo, ctx = { fs: 56, color: SW_INK };
  SW.pz = {
    title: o.title, focus: 0, t0: performance.now(),
    visual: swFitBox(swBoxGroup(swParse(o.visual || '').k, ctx), 1000, 250, 1.6),
    cards: pzHelp.btns.map(b => ({ b, box: swFitBox(swBoxGroup(swParse(b.innerHTML).k, ctx), 320, 190) })),
  };
}
const swPzOn = () => state === 'puzzle' && !!SW.pz;
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
  if (SW.pz.game) {
    // Labyrinthe : la croix déplace le bébé (comme les flèches du clavier). Sinon, elle choisit une case.
    if (btn.dir) { if (pzKey) pzKey(SW_ARROW[btn.dir]); else swPzNav(btn.dir); }
    if (btn.a && !pzLocked && !pzKey) { const cur = swPzCur(); if (cur) cur.el.click(); }
  } else {
    if (btn.dir === 'l') swPzMove(-1); else if (btn.dir === 'r') swPzMove(1);
    if (btn.a) swPzChoose(SW.pz.focus);
  }
  if (btn.a) return true;
  if (btn.x) swHelpCut();
  else if (btn.y) swHelpHint();
  else if (btn.b) swPzBack();
  return true;
}
function swPzTouch(x, y) {
  if (!swPzOn()) return false;
  const h = SW.pzHits.find(z => x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h);
  if (h) { h.fn(); return true; }
  if (SW.pz.game && !pzLocked) {
    // La plus petite zone sous le doigt (un point plutôt que tout le dessin)
    const e = SW.pzClick.filter(z => x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h).sort((a, b) => a.w * a.h - b.w * b.h)[0];
    if (e) { if (e.svg) swSvgClick(e, x, y); else { SW.pz.fx = e.x + e.w / 2; SW.pz.fy = e.y + e.h / 2; e.el.click(); } }
  }
  return true;
}
function swDrawPuzzle() {
  if (!swPzOn()) { if (state !== 'puzzle') SW.pz = null; return; }
  const c = SW.ctx, P = SW.pz, t = performance.now() / 1000;
  SW.pzHits = [];
  c.fillStyle = 'rgba(16,40,26,.6)'; c.fillRect(0, 0, SW_W, SW_H);
  swPanel(60, 24, SW_W - 120, SW_H - 48);
  // Titre, puis ce que la voix dirait
  const title = P.game ? pz.title.textContent : P.title;
  swText(title, SW_W / 2, 70, swFit(title, SW_W - 360, 40), SW_INK, 'center');
  const said = SW.said || '';
  if (said && said !== title) swText(said, SW_W / 2, 112, swFit(said, SW_W - 200, 24), '#4b5d50', 'center');
  if (P.game) swDrawGamePuzzle(); else swDrawChoices(P, t);
  swDrawPzBar();
}
function swDrawChoices(P, t) {
  const c = SW.ctx;
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
}
// Bas de l'écran : les aides et le retour, ou les étoiles quand c'est gagné
function swDrawPzBar() {
  const c = SW.ctx, by = SW_H - 92;
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
