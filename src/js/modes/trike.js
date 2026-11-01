/* ---------- Tricératops : vue de dessus ---------- */
MODES.topdown = {
  oy: () => (viewH - VIEW_H) / 2,
  build(d) {
    const R = rng(d.seed), cols = d.len;
    L.cols = cols; L.grid = makeGrid(cols); L.solid = v => v >= 1 && v <= 4; // 1 arbre, 2 rocher, 3 caillou, 4 eau, 5 pont, 6 glace
    const flat = new Set();
    d.rivers.forEach(c => { for (let k = c - 2; k <= c + 3; k++) flat.add(k); });
    d.gates.forEach(c => { for (let k = c - 2; k <= c + 2; k++) flat.add(k); });
    (d.switches || []).forEach(([sc, , dc]) => [sc - 1, sc, sc + 1, dc - 1, dc, dc + 1].forEach(k => flat.add(k)));
    // Un chemin qui serpente garantit qu'on peut toujours passer.
    const path = []; let r = 5;
    for (let c = 0; c < cols; c++) { if (c > 3 && !flat.has(c) && R() < .35) r = clamp(r + (R() < .5 ? -1 : 1), 2, 7); path[c] = r; }
    for (let c = 0; c < cols; c++) { L.grid[c][0] = 1; L.grid[c][9] = 1; }
    for (let c = 4; c < cols - 7; c++) {
      if (flat.has(c)) continue;
      for (let rr2 = 1; rr2 <= 8; rr2++) if (Math.abs(rr2 - path[c]) > 1 && R() < d.density) L.grid[c][rr2] = R() < .55 ? 1 : 2;
    }
    d.rivers.forEach(c => { for (const k of [c, c + 1]) for (let rr2 = 1; rr2 <= 8; rr2++) L.grid[k][rr2] = d.frozen ? 6 : (rr2 === path[k] || rr2 === path[k] + 1) ? 5 : 4; });
    let n = 0, tries = 0;
    while (n < d.small && tries++ < 300) { const c = 6 + Math.floor(R() * (cols - 14)); if (flat.has(c) || L.grid[c][path[c]]) continue; L.grid[c][path[c]] = 3; n++; }
    L.items = []; tries = 0;
    while (L.items.length < d.fruits && tries++ < 600) {
      const c = 3 + Math.floor(R() * (cols - 9)), rr2 = 1 + Math.floor(R() * 8);
      if (L.grid[c][rr2] || d.gates.includes(c)) continue;
      L.items.push({ x: c * T + T / 2, y: rr2 * T + T / 2, taken: false, ph: R() * 6 });
    }
    L.gates = d.gates.map((c, k) => ({ c, k, x: c * T + 6, y: 0, w: T - 12, h: VIEW_H, block: true, open: false, anim: 0, type: d.puzzles[k], row: path[c], eggY: path[c] * T + T / 2 }));
    L.nestRow = path[d.nest]; L.nestX = d.nest * T;
    // Bouton par terre, à côté du chemin (les colonnes autour sont dégagées), barrière en travers de toute la plaine.
    makeSwitches(d, (sc, off, dc) => {
      const row = clamp(path[sc] + off, 1, 8), cx = sc * T + T / 2, cy = row * T + T / 2;
      return { bx: cx, by: cy + 12, zone: { x: cx - 18, y: cy - 18, w: 36, h: 36 }, door: { x: dc * T + 6, y: 0, w: T - 12, h: VIEW_H, top: T, bot: 9 * T } };
    });
    player = { x: T + 7, y: path[1] * T + 7, w: 34, h: 34, vx: 0, vy: 0, ang: 0, moving: false };
  },
  step() {
    const p = player; let [ix, iy] = inputDir(p);
    // Bouton d'action : le tricératops fonce, droit devant s'il ne tourne pas.
    if (jumpPressed) { jumpPressed = false; if (!(p.dash > 0)) { p.dash = L.charge ? 48 : 26; SFX.jump(); } }
    if (p.dash > 0) {
      p.dash--;
      if (!ix && !iy) { ix = Math.cos(p.ang); iy = Math.sin(p.ang); }
      if (p.dash % 3 === 0) parts.push({ x: p.x + p.w / 2 - Math.cos(p.ang) * 20, y: p.y + p.h / 2 - Math.sin(p.ang) * 20, vx: 0, vy: 0, g: 0, life: 18, col: 'rgba(150,130,90,.55)', r: 6 });
    }
    const sp = p.dash > 0 ? (L.charge ? 8.2 : 6.8) : 3.6;
    p.moving = ix !== 0 || iy !== 0;
    if (p.moving) { const ta = Math.atan2(iy, ix); const da = ((ta - p.ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI; p.ang += da * .25; }
    // Sur la glace, on glisse : l'élan reste et on tourne lentement.
    const col = L.grid[Math.floor((p.x + p.w / 2) / T)], onIce = col && col[Math.floor((p.y + p.h / 2) / T)] === 6;
    if (onIce) { p.vx = p.vx * .96 + ix * sp * .05; p.vy = p.vy * .96 + iy * sp * .05; }
    else { p.vx = ix * sp; p.vy = iy * sp; }
    const res = moveBox(p, p.vx, p.vy, (c, r) => {
      if (L.grid[c][r] !== 3) return false;
      L.grid[c][r] = 0; L.broken.push([c, r]); layerDirty(c); SFX.crack();
      for (let i = 0; i < 12; i++) parts.push({ x: c * T + T / 2, y: r * T + T / 2, vx: (Math.random() - .5) * 6, vy: (Math.random() - .5) * 6, g: 0, life: 30, col: pick(['#a39a8a', '#7d7466']), r: 3 + Math.random() * 3 });
      return true;
    });
    if (res.x) p.vx = 0; if (res.y) p.vy = 0;
    p.y = clamp(p.y, T, VIEW_H - T - p.h);
    stepFoes(p); collectItems(p, 16); checkGates(p); gateAnim(); checkSwitches(p);
    if (p.x + p.w >= L.nestX) { if (bossBlocks()) nestGuarded(p); else levelDone(); }
    updateParts(); follow(p);
  },
  render() {
    const d = L.d, oy = L.oy;
    setView(); ctx.fillStyle = d.edge; ctx.fillRect(0, 0, viewW, viewH);
    ctx.save(); ctx.translate(-Math.round(camX), oy);
    const c0 = Math.max(0, Math.floor(camX / T) - 1), c1 = Math.min(L.cols - 1, Math.floor((camX + viewW) / T) + 1);
    // Décor fixe (herbe, fleurs, glace, cailloux ; les arbres plus bas, par-dessus l'animal) : layerDraw
    layerDraw('ground', c0, c1, Math.round(camX), oy, (g, a, b) => this.ground(g, a, b));
    for (let c = c0; c <= c1; c++) for (let r = 0; r < ROWS; r++) {
      const v = L.grid[c][r], x = c * T, y = r * T;
      if (v === 4 || v === 5) {
        ctx.fillStyle = '#3d9ad6'; ctx.fillRect(x, y, T + .5, T + .5);
        ctx.strokeStyle = 'rgba(220,245,255,.6)'; ctx.lineWidth = 2;
        const wy = y + 16 + Math.sin(time * 2 + c + r) * 4; ctx.beginPath(); ctx.moveTo(x + 6, wy); ctx.quadraticCurveTo(x + 16, wy - 5, x + 26, wy); ctx.stroke();
        if (v === 5) {
          ctx.fillStyle = '#a0692e'; ctx.fillRect(x, y + 2, T + .5, T - 4);
          ctx.strokeStyle = '#6e4520'; ctx.lineWidth = 2;
          for (let k = 8; k < T; k += 10) { ctx.beginPath(); ctx.moveTo(x + k, y + 3); ctx.lineTo(x + k, y + T - 3); ctx.stroke(); }
          ctx.fillStyle = '#6e4520';
          if (L.grid[c][r - 1] !== 5) ctx.fillRect(x, y, T + .5, 4);
          if (L.grid[c][r + 1] !== 5) ctx.fillRect(x, y + T - 4, T + .5, 4);
        }
      }
    }
    L.items.forEach(drawFruit);
    this.nest();
    L.gates.forEach(g => { if (onScreen(g.c * T + T / 2)) this.gate(g); });
    drawSwitches();
    const p = player;
    drawFoes();
    if (!(p.hurt > 0 && p.hurt % 8 < 4)) drawTrikeTop(ctx, p.x + p.w / 2, p.y + p.h / 2, p.ang, time, p.moving, world().pal);
    layerDraw('trees', c0, c1, Math.round(camX), oy, (g, a, b) => this.trees(g, a, b));
    drawParts();
    ctx.restore();
  },
  // Décor fixe des colonnes a à b, dessiné dans le contexte g (l'écran, ou un morceau de layer).
  ground(g, a, b) {
    const d = L.d;
    g.fillStyle = d.grass; g.fillRect(a * T, 0, (b - a + 1) * T, VIEW_H);
    for (let c = a; c <= b; c++) for (let r = 1; r < 9; r++) {
      const s = srand(c * 31 + r * 7), x = c * T, y = r * T;
      if (s > .5) { g.fillStyle = d.grass2; circle(g, x + 10 + s * 20, y + 14, 4); circle(g, x + 16 + s * 20, y + 12, 3); circle(g, x + 30 - s * 10, y + 34, 4); }
      if (s > .93 && !L.grid[c][r] && !d.snowy) { g.fillStyle = pick2(['#f27bb4', '#ffd23a', '#fff'], c + r); for (let k = 0; k < 5; k++) circle(g, x + 24 + Math.cos(k * 1.26) * 4, y + 24 + Math.sin(k * 1.26) * 4, 3); g.fillStyle = '#ffb238'; circle(g, x + 24, y + 24, 2); }
    }
    for (let c = a; c <= b; c++) for (let r = 0; r < ROWS; r++) {
      const v = L.grid[c][r], x = c * T, y = r * T;
      if (v === 6) {
        g.fillStyle = '#bfe4f4'; g.fillRect(x, y, T + .5, T + .5);
        g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 3; g.lineCap = 'round';
        const s = srand(c * 3 + r); g.beginPath(); g.moveTo(x + 8 + s * 10, y + 30); g.lineTo(x + 22 + s * 10, y + 16); g.moveTo(x + 26, y + 40); g.lineTo(x + 34, y + 32); g.stroke();
      }
      if (v === 2 || v === 3) this.rock(g, x + T / 2, y + T / 2, v === 2 ? 20 : 13, c * 13 + r, v === 3);
    }
  },
  trees(g, a, b) {
    for (let c = a; c <= b; c++) for (let r = 0; r < ROWS; r++) if (L.grid[c][r] === 1) this.tree(g, c * T + T / 2, r * T + T / 2, c * 17 + r);
  },
  rock(g, x, y, rad, seed, small) {
    g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(x + 4, y + 5, rad, rad * .8, 0, 0, Math.PI * 2); g.fill();
    g.beginPath();
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, rr2 = rad * (.8 + srand(seed + k) * .3); g[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); }
    g.closePath(); g.fillStyle = small ? '#a39a8a' : '#8d8f94'; g.strokeStyle = '#1d2b22'; g.lineWidth = 2.5; g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.3)'; circle(g, x - rad * .3, y - rad * .3, rad * .3);
    if (small) { g.strokeStyle = '#5a5248'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x - 4, y - 6); g.lineTo(x + 1, y); g.lineTo(x - 2, y + 6); g.stroke(); }
  },
  tree(g, x, y, seed) {
    const d = L.d;
    if (d.cactus) {
      // Cactus vu du dessus : une étoile de côtes vertes avec des épines
      g.fillStyle = 'rgba(0,0,0,.2)'; circle(g, x + 5, y + 6, 20);
      g.fillStyle = '#4f8f3a'; g.strokeStyle = '#1d2b22'; g.lineWidth = 2.5; g.beginPath();
      for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, r = k % 2 ? 13 : 19; g[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r); }
      g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#7fbf5a'; circle(g, x - 3, y - 3, 7);
      g.fillStyle = '#fff4dc'; for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + .2; circle(g, x + Math.cos(a) * 21, y + Math.sin(a) * 21, 1.6); }
      if (srand(seed) > .6) { g.fillStyle = '#f27bb4'; circle(g, x + 2, y - 2, 4); }
      return;
    }
    const [c1, c2, c3] = d.tree || ['#2f6b37', '#3f8f45', '#5cad55'];
    g.fillStyle = 'rgba(0,0,0,.22)'; circle(g, x + 7, y + 7, 27);
    g.fillStyle = c1;
    for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2 + seed; circle(g, x + Math.cos(a) * 17, y + Math.sin(a) * 17, 11); }
    circle(g, x, y, 22);
    g.fillStyle = c2; circle(g, x - 4, y - 4, 16);
    g.fillStyle = c3; circle(g, x - 8, y - 8, 8);
    if (d.snowy) { g.fillStyle = '#fff'; circle(g, x - 10, y - 2, 6); circle(g, x + 6, y - 10, 5); circle(g, x + 8, y + 8, 4); }
  },
  gate(g) {
    const x = g.c * T + T / 2;
    if (g.open) { if (g.anim >= 1) return; ctx.globalAlpha = 1 - g.anim; }
    for (let r = 1; r <= 8; r++) {
      if (r === g.row) continue;
      const y = r * T + T / 2;
      ctx.fillStyle = 'rgba(0,0,0,.2)'; circle(ctx, x + 4, y + 5, 19);
      ctx.fillStyle = '#7a6f9b'; ctx.strokeStyle = '#1d2b22'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x, y, 19, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(57,201,168,.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x, y - 7); ctx.lineTo(x + 7, y); ctx.lineTo(x, y + 7); ctx.closePath(); ctx.stroke();
    }
    drawOrb(x, g.row * T + T / 2);
    ctx.globalAlpha = 1;
  },
  nest() {
    const x = L.nestX + 30, y = L.nestRow * T + T / 2;
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(x + 4, y + 5, 34, 30, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#a0692e'; ctx.strokeStyle = '#1d2b22'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(x, y, 32, 28, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#6e4520'; ctx.beginPath(); ctx.ellipse(x, y, 22, 18, 0, 0, Math.PI * 2); ctx.fill();
    [[-8, -4], [8, -4], [0, 8]].slice(0, eggsRun).forEach(([ex, ey]) => { ctx.fillStyle = '#fff4dc'; ctx.beginPath(); ctx.ellipse(x + ex, y + ey, 7, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 2; ctx.stroke(); });
    drawTrikeTop(ctx, x + 96, y, Math.PI, time, false, world().pal, 1.7);
  },
};
function pick2(a, i) { return a[Math.floor(srand(i) * a.length)]; }

