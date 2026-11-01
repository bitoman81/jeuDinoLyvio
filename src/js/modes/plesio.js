/* ---------- Plésiosaure : sous l'eau ---------- */
MODES.swim = {
  oy: () => (viewH - VIEW_H) / 2,
  build(d) {
    const R = rng(d.seed), cols = d.len;
    L.cols = cols; L.grid = makeGrid(cols); L.solid = v => v === 1;
    const swc = (d.switches || []).flatMap(([sc, , dc]) => [sc, dc]);
    const near = c => d.gates.some(g => Math.abs(g - c) <= 2) || swc.some(g => Math.abs(g - c) <= 1) || c < 5 || c > cols - 9;
    L.floor = [];
    for (let c = 0; c < cols; c++) {
      const h = (!near(c) && R() < .35) ? 2 : 1;
      L.floor[c] = ROWS - h;
      for (let r = ROWS - h; r < ROWS; r++) L.grid[c][r] = 1;
      if (d.cave) L.grid[c][0] = 1;
    }
    for (let c = 5; c < cols - 9; c++) {
      if (near(c) || R() >= d.pillars) continue;
      const w = R() < .4 ? 2 : 1, height = 2 + Math.floor(R() * 2), top = d.cave && R() < .45;
      for (let k = c; k < c + w; k++) {
        if (near(k)) continue;
        for (let i = 0; i < height; i++) L.grid[k][top ? 1 + i : L.floor[k] - 1 - i] = 1;
      }
      c += w + 1;
    }
    L.jellies = []; let tries = 0;
    while (L.jellies.length < d.jelly && tries++ < 300) {
      const c = 7 + Math.floor(R() * (cols - 17));
      if (near(c) || [1, 2, 3, 4, 5, 6, 7].some(r => L.grid[c][r]) || L.jellies.some(j => Math.abs(j.c - c) < 4)) continue;
      L.jellies.push({ c, x: c * T + T / 2, y0: 150 + R() * 140, amp: 40 + R() * 50, sp: .8 + R() * .8, ph: R() * 6, y: 0 });
    }
    L.items = [];
    // pearls : 2 rangées de perles au lieu d'une (baie aux perles)
    for (let k = 0; k < (d.pearls || 1); k++) for (let c = 4 + k; c < cols - 8; c += 2) {
      const y = Math.round(200 + Math.sin(c * .45 + k * 2.5) * 110), r = Math.floor(y / T);
      if (L.grid[c][r] || d.gates.includes(c)) continue;
      L.items.push({ x: c * T + T / 2, y, taken: false, ph: c });
    }
    // Courants : [première colonne, dernière colonne, poussée en x, poussée en y]
    L.currents = (d.currents || []).map(([a, b, dx, dy]) => ({ x: a * T, w: (b - a + 1) * T, dx, dy }));
    L.weeds = [];
    for (let c = 0; c < cols; c++) if (!L.grid[c][L.floor[c] - 1] && R() < .45) L.weeds.push({ x: c * T + R() * T, base: L.floor[c] * T + 4, h: 30 + R() * 50, ph: R() * 6 });
    L.gates = d.gates.map((c, k) => ({ c, k, x: c * T + 6, y: -200, w: T - 12, h: VIEW_H + 400, block: true, open: false, anim: 0, type: d.puzzles[k], eggY: VIEW_H / 2 }));
    L.nestX = d.nest * T;
    // Bouton sur le sable, grille de haut en bas.
    makeSwitches(d, (sc, _, dc) => {
      const cx = sc * T + T / 2, y = L.floor[sc] * T;
      return { bx: cx, by: y, zone: { x: cx - 22, y: y - 34, w: 44, h: 34 }, door: { x: dc * T + 6, y: -200, w: T - 12, h: VIEW_H + 400, top: d.cave ? T : 0, bot: L.floor[dc] * T } };
    });
    player = { x: T * 1.5, y: 200, w: 46, h: 24, vx: 0, vy: 0, face: 1, hurt: 0 };
  },
  step() {
    const p = player; let [ix, iy] = inputDir(p);
    // Bouton d'action : un coup de nageoire pour aller plus vite.
    if (jumpPressed) { jumpPressed = false; if (!(p.dash > 0)) { p.dash = L.fin ? 60 : 30; SFX.pop(); } }
    const acc = p.dash > 0 ? (L.fin ? 1.4 : 1) : .5;
    if (p.dash > 0) { p.dash--; if (!ix && !iy) ix = p.face; }
    p.vx = (p.vx + ix * acc) * .9; p.vy = (p.vy + iy * acc) * .9;
    if (p.hurt > 0) p.hurt--;
    L.currents.forEach(k => { if (p.x + p.w / 2 > k.x && p.x + p.w / 2 < k.x + k.w) { p.vx += k.dx * .28; p.vy += k.dy * .28; } });
    const res = moveBox(p, p.vx, p.vy); if (res.x) p.vx = 0; if (res.y) p.vy = 0;
    const top = L.d.cave ? T : 26;
    if (p.y < top) { p.y = top; p.vy = 0; }
    if (p.y + p.h > VIEW_H) p.y = VIEW_H - p.h;
    if (Math.abs(p.vx) > .3) p.face = Math.sign(p.vx);
    L.jellies.forEach(j => {
      j.y = j.y0 + Math.sin(time * j.sp + j.ph) * j.amp;
      if (!L.shield && p.hurt <= 0 && hit(p, { x: j.x - 14, y: j.y - 14, w: 28, h: 30 })) {
        const dx = p.x + p.w / 2 - j.x, dy = p.y + p.h / 2 - j.y, dd = Math.hypot(dx, dy) || 1;
        p.vx = dx / dd * 6; p.vy = dy / dd * 6; p.hurt = 50; SFX.bonk();
      }
    });
    if (Math.random() < .04) parts.push({ x: p.x + (p.face > 0 ? p.w + 12 : -12), y: p.y - 8, vx: 0, vy: -.6, g: -.01, life: 70, col: 'rgba(220,245,255,.8)', r: 2 + Math.random() * 2 });
    stepFoes(p); collectItems(p, 16); checkGates(p); gateAnim(); checkSwitches(p);
    if (p.x + p.w >= L.nestX) { if (bossBlocks()) nestGuarded(p); else levelDone(); }
    updateParts(); follow(p);
  },
  render() {
    const d = L.d, oy = L.oy;
    setView();
    ctx.fillStyle = screenGrad(d.water[0], d.water[1]); ctx.fillRect(0, 0, viewW, viewH);
    if (!d.cave) {
      ctx.fillStyle = 'rgba(255,255,255,.07)';
      const sp = 180, s = Math.floor(camX * .3 / sp) - 1;
      for (let i = s; i < s + viewW / sp + 3; i++) { const x = i * sp - camX * .3; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 40, 0); ctx.lineTo(x - 60, viewH); ctx.lineTo(x - 120, viewH); ctx.fill(); }
    }
    ctx.fillStyle = 'rgba(10,40,70,.35)';
    const sp2 = 300, s2 = Math.floor(camX * .2 / sp2) - 1;
    for (let i = s2; i < s2 + viewW / sp2 + 3; i++) { const x = i * sp2 - camX * .2; ctx.beginPath(); ctx.ellipse(x + 150, oy + VIEW_H, 160, 90 + srand(i) * 60, 0, Math.PI, 0); ctx.fill(); }
    // Bancs de poissons du fond : 6 poissons, dessinés une fois (sprite) puis recopiés
    const school = (g, bx, by) => { for (let k = 0; k < 6; k++) { const fx = bx + (k % 3) * 18, fy = by + Math.floor(k / 3) * 14 + (k % 2) * 5; g.beginPath(); g.ellipse(fx, fy, 7, 3.5, 0, 0, Math.PI * 2); g.moveTo(fx - 6, fy); g.lineTo(fx - 11, fy - 4); g.lineTo(fx - 11, fy + 4); g.fill(); } };
    const fish = sprite('poissons', 56, 30, g => { g.fillStyle = '#fff'; school(g, 12, 5); });
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    const sp3 = 420, s3 = Math.floor(camX * .5 / sp3) - 1;
    if (fish) ctx.globalAlpha = .18;
    for (let i = s3; i < s3 + viewW / sp3 + 3; i++) {
      const bx = i * sp3 - camX * .5 + Math.sin(time * .5 + i) * 20, by = oy + 80 + srand(i + 4) * 260;
      if (fish) ctx.drawImage(fish, bx - 12, by - 5, 56, 30); else school(ctx, bx, by);
    }
    ctx.globalAlpha = 1;
    ctx.save(); ctx.translate(-Math.round(camX), oy);
    if (d.cave) { ctx.fillStyle = d.rock; ctx.fillRect(camX - 10, -oy - 10, viewW + 20, oy + 10); }
    else {
      ctx.fillStyle = '#bfe8f5'; ctx.fillRect(camX - 10, -oy - 10, viewW + 20, oy + 22);
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 4; ctx.beginPath();
      for (let x = Math.floor(camX / 40) * 40 - 40; x < camX + viewW + 40; x += 40) { const wy = 12 + Math.sin(time * 2 + x * .05) * 3; ctx.moveTo(x, wy); ctx.quadraticCurveTo(x + 10, wy - 6, x + 20, wy); }
      ctx.stroke();
    }
    ctx.fillStyle = d.rock; ctx.fillRect(camX - 10, VIEW_H, viewW + 20, oy + 10);
    if (d.wreck) this.wreck(d.wreck * T, L.floor[d.wreck] * T);
    L.currents.forEach(k => this.current(k));
    L.weeds.forEach(w => {
      if (w.x < camX - 40 || w.x > camX + viewW + 40) return;
      ctx.strokeStyle = '#3f9a5f'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(w.x, w.base);
      for (let k = 1; k <= 4; k++) ctx.lineTo(w.x + Math.sin(time * 1.5 + w.ph + k) * 6, w.base - w.h * k / 4);
      ctx.stroke();
    });
    {
      const c0 = Math.max(0, Math.floor(camX / T) - 1), c1 = Math.min(L.cols - 1, Math.floor((camX + viewW) / T) + 1);
      layerDraw('tiles', c0, c1, Math.round(camX), oy, (g, a, b) => this.tiles(g, d, a, b));
    }
    L.items.forEach(drawPearl);
    L.jellies.forEach(j => { if (onScreen(j.x)) this.jelly(j); });
    this.nest();
    L.gates.forEach(g2 => { if (onScreen(g2.c * T + T / 2)) this.gate(g2); });
    drawSwitches();
    const p = player;
    drawFoes();
    if (!(p.hurt > 0 && p.hurt % 8 < 4)) drawDino(ctx, world(), p.x + p.w / 2 + 6 * p.face, p.y + p.h / 2 + 13, p.face, time, true, true, 1.1);
    if (L.shield) drawShield(p.x + p.w / 2, p.y + p.h / 2, 38);
    drawParts();
    ctx.restore();
    if (d.deep) {
      // Grands fonds : il fait noir, sauf autour du plésiosaure
      // (un seul dégradé, centré en 0, 0 : on le déplace avec translate)
      const px = p.x + p.w / 2 - Math.round(camX), py = p.y + p.h / 2 + oy;
      ctx.fillStyle = gradCache(ctx, 'fonds', () => { const gl = ctx.createRadialGradient(0, 0, 70, 0, 0, 320); gl.addColorStop(0, 'rgba(2,8,20,0)'); gl.addColorStop(1, 'rgba(2,8,20,.6)'); return gl; });
      ctx.save(); ctx.translate(px, py); ctx.fillRect(-px, -py, viewW, viewH); ctx.restore();
    }
  },
  current(k) {
    if (k.x > camX + viewW || k.x + k.w < camX) return;
    ctx.fillStyle = 'rgba(220,245,255,.08)'; ctx.fillRect(k.x, 0, k.w, VIEW_H);
    ctx.fillStyle = 'rgba(230,250,255,.7)';
    for (let i = 0; i < 18; i++) {
      const x = k.x + wrap(srand(i + k.x) * k.w + time * 70 * k.dx, k.w), y = wrap(srand(i * 3 + k.x) * VIEW_H + time * 70 * k.dy, VIEW_H);
      circle(ctx, x, y, 2 + srand(i) * 3);
    }
    // Flèche douce au milieu
    const cx = k.x + k.w / 2, cy = VIEW_H / 2 + Math.sin(time * 2) * 6, a = Math.atan2(k.dy, k.dx);
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(a); ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-24, 0); ctx.lineTo(20, 0); ctx.moveTo(6, -14); ctx.lineTo(20, 0); ctx.lineTo(6, 14); ctx.stroke(); ctx.restore();
  },
  wreck(x, y) {
    // Vieux bateau couché sur le sable, derrière les rochers
    ctx.save(); ctx.translate(x, y + 6); ctx.rotate(-.12);
    ctx.fillStyle = '#6a4a32'; ctx.strokeStyle = '#1d2b22'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-170, -80); ctx.lineTo(170, -80); ctx.quadraticCurveTo(150, 10, 80, 10); ctx.lineTo(-110, 10); ctx.quadraticCurveTo(-170, -10, -170, -80); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#4a3222'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-160, -50); ctx.lineTo(160, -50); ctx.moveTo(-140, -20); ctx.lineTo(140, -20); ctx.stroke();
    ctx.fillStyle = '#1d3a52'; [-90, -30, 30, 90].forEach(h => { circle(ctx, h, -64, 8); });
    ctx.strokeStyle = '#4a3222'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(-20, -80); ctx.lineTo(-40, -240); ctx.stroke();
    ctx.fillStyle = 'rgba(240,230,200,.5)'; ctx.beginPath(); ctx.moveTo(-36, -220); ctx.lineTo(40, -170); ctx.lineTo(-28, -140); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3f9a5f'; circle(ctx, -150, -78, 8); circle(ctx, 120, -82, 6);
    ctx.restore();
  },
  tiles(g, d, a, b) {
    for (let c = a; c <= b; c++) for (let r = 0; r < ROWS; r++) {
      if (!isSolid(c, r)) continue;
      const x = c * T, y = r * T;
      g.fillStyle = d.rock; g.fillRect(x, y, T + .5, T + .5);
      g.fillStyle = 'rgba(0,0,0,.18)'; const s = srand(c * 5 + r * 11); circle(g, x + 12 + s * 20, y + 20, 5); circle(g, x + 34 - s * 8, y + 36, 4);
      if (!isSolid(c, r - 1) && r > 0) {
        g.fillStyle = d.sand; g.fillRect(x, y - 2, T + .5, 10);
        if (r < L.floor[c] && srand(c + r) > .4) { const col = pick2(['#f27bb4', '#ff8a5c', '#ffd23a', '#b48cff'], c * 3 + r); g.strokeStyle = col; g.lineWidth = 4; g.lineCap = 'round'; for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(x + 24, y); g.lineTo(x + 24 + k * 10, y - 14 - Math.abs(k) * -4); g.stroke(); } }
      }
      if (!isSolid(c, r + 1) && r < ROWS - 1) { g.fillStyle = d.rock; g.beginPath(); g.moveTo(x + 10, y + T); g.lineTo(x + 16, y + T + 12); g.lineTo(x + 22, y + T); g.moveTo(x + 30, y + T); g.lineTo(x + 35, y + T + 8); g.lineTo(x + 40, y + T); g.fill(); }
    }
  },
  jelly(j) {
    const x = j.x, y = j.y;
    ctx.strokeStyle = 'rgba(245,155,199,.8)'; ctx.lineWidth = 2.5;
    for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(x + k * 5, y); for (let s = 1; s <= 4; s++) ctx.lineTo(x + k * 5 + Math.sin(time * 4 + s + k) * 3, y + s * 6); ctx.stroke(); }
    ctx.fillStyle = 'rgba(245,155,199,.85)'; ctx.strokeStyle = '#1d2b22'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(x, y, 16, 14 + Math.sin(time * 4) * 1.5, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.5)'; circle(ctx, x - 6, y - 7, 3);
  },
  gate(g) {
    const x = g.c * T + T / 2;
    if (g.open) { if (g.anim >= 1) return; ctx.globalAlpha = 1 - g.anim; }
    for (let r = 0; r < ROWS; r++) {
      const y = r * T + T / 2; if (Math.abs(y - VIEW_H / 2) < 40) continue;
      ctx.fillStyle = pick2(['#f27bb4', '#ff8a5c', '#b48cff'], g.c + r); ctx.strokeStyle = '#1d2b22'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; circle(ctx, x - 5, y - 5, 5); circle(ctx, x + 6, y + 4, 3);
    }
    drawOrb(x, VIEW_H / 2);
    ctx.globalAlpha = 1;
  },
  nest() {
    const x = L.nestX + 30, y = L.floor[Math.min(L.cols - 1, Math.floor(L.nestX / T))] * T;
    ctx.fillStyle = '#f2d2b6'; ctx.strokeStyle = '#1d2b22'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - 36, y); ctx.quadraticCurveTo(x, y - 60, x + 36, y); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#c99a7a'; ctx.lineWidth = 2;
    for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + k * 14, y - 26 + Math.abs(k) * 6); ctx.stroke(); }
    drawDino(ctx, world(), x + 110, y - 40, -1, time, true, true, 1.8);
  },
};

