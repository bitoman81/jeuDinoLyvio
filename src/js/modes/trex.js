/* ---------- T-Rex : plateformes vues de côté ---------- */
MODES.platform = {
  oy: () => viewH - VIEW_H,
  build(d) {
    L.cols = d.len; L.grid = makeGrid(d.len); L.solid = v => v === 1;
    d.ground.forEach(([a, b]) => { for (let c = a; c < b; c++) { L.grid[c][8] = 1; L.grid[c][9] = 1; } });
    d.plats.forEach(([x, r, w]) => { for (let c = x; c < x + w; c++) L.grid[c][r] = 1; });
    L.gates = d.stones.map((c, k) => ({ c, k, x: c * T + 4, y: -600, w: T - 8, h: GROUND * T + 600, block: true, open: false, anim: 0, type: d.puzzles[k], eggY: GROUND * T - 78 }));
    L.items = d.fruits.map(([c, r]) => ({ x: c * T + T / 2, y: r * T + T / 2, taken: false, ph: Math.random() * 6 }));
    L.mush = d.mush.map(c => ({ x: c * T + 4, y: GROUND * T - 30, w: T - 8, h: 30, sq: 0 }));
    L.movers = d.movers.map(m => ({ x0: m.x * T, x: m.x * T, y: m.row * T, w: m.w * T, h: 18, amp: m.amp * T, speed: m.speed, dx: 0 }));
    // Rondins qui tombent : ils tremblent quand on monte dessus, tombent, puis reviennent.
    L.falls = (d.falls || []).map(([x, r, w]) => ({ x: x * T, y0: r * T, y: r * T, w: w * T, h: 18, dx: 0, t: 0, vy: 0, back: 0 }));
    L.nestX = d.nest * T;
    // Bouton posé sur une case (sol ou plateforme), porte haute sur le sol.
    makeSwitches(d, (sc, sr, dc) => ({ bx: sc * T + T / 2, by: sr * T, zone: { x: sc * T + T / 2 - 18, y: sr * T - 24, w: 36, h: 24 },
      door: { x: dc * T + 4, y: -600, w: T - 8, h: GROUND * T + 600, top: GROUND * T - 210, bot: GROUND * T } }));
    player = { x: d.start * T + 4, y: GROUND * T - 44, w: 40, h: 44, vx: 0, vy: 0, face: 1, ground: false, on: null, coy: 0, buf: 0 };
    L.safe = { x: player.x, y: player.y };
  },
  step() {
    const p = player;
    let ax = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    if (!ax && stick.id !== null) ax = clamp(stickDir()[0] * 1.5, -1, 1);
    p.vx = ax * SPEED; if (ax) p.face = Math.sign(ax);
    if (jumpPressed) { p.buf = 8; jumpPressed = false; } else if (p.buf > 0) p.buf--;
    if (p.ground) p.coy = 8; else if (p.coy > 0) p.coy--;
    if (p.ground) p.dbl = false;
    if (p.buf > 0 && p.coy > 0) { p.vy = JUMP; p.buf = 0; p.coy = 0; p.ground = false; p.on = null; SFX.jump(); }
    // Double saut (pouvoir) : une fois en l'air
    else if (p.buf > 0 && L.jump2 && !p.ground && !p.dbl) {
      p.vy = JUMP * .9; p.buf = 0; p.dbl = true; SFX.jump();
      for (let i = 0; i < 8; i++) parts.push({ x: p.x + p.w / 2, y: p.y + p.h, vx: (Math.random() - .5) * 4, vy: Math.random() * 2, life: 22, col: 'rgba(255,255,255,.8)', r: 4 });
    }
    p.vy = Math.min(p.vy + GRAV, 15);
    L.movers.forEach(m => { const nx = m.x0 + Math.sin(time * m.speed) * m.amp; m.dx = nx - m.x; m.x = nx; });
    L.falls.forEach(f => {
      if (f.back > 0) { if (--f.back === 0) { f.y = f.y0; f.t = f.vy = 0; } return; }
      if (f.t > 0) f.t++;
      if (f.t > 40) { f.vy = Math.min(f.vy + .35, 12); f.y += f.vy; if (f.y > VIEW_H + 120) f.back = 150; }
    });

    const dx = p.vx + (p.on ? p.on.dx : 0);
    p.x += dx;
    nearRects(p).forEach(r => { if (hit(p, r)) { if (dx > 0) p.x = r.x - p.w; else if (dx < 0) p.x = r.x + r.w; } });
    p.x = clamp(p.x, 0, L.cols * T - p.w);

    const prevBottom = p.y + p.h;
    p.y += p.vy; p.ground = false; p.on = null;
    L.mush.forEach(m => {
      if (p.vy > 0 && prevBottom <= m.y + 6 && p.y + p.h >= m.y && p.x + p.w > m.x && p.x < m.x + m.w) { p.y = m.y - p.h; p.vy = BOUNCE; m.sq = 1; SFX.boing(); }
    });
    nearRects(p).forEach(r => { if (hit(p, r)) { if (p.vy > 0) { p.y = r.y - p.h; p.vy = 0; p.ground = true; } else if (p.vy < 0) { p.y = r.y + r.h; p.vy = 0; } } });
    L.movers.forEach(m => {
      if (p.vy >= 0 && prevBottom <= m.y + 1 && p.y + p.h >= m.y && p.x + p.w > m.x + 4 && p.x < m.x + m.w - 4) { p.y = m.y - p.h; p.vy = 0; p.ground = true; p.on = m; }
    });
    L.falls.forEach(f => {
      if (!f.back && p.vy >= 0 && prevBottom <= f.y + 1 && p.y + p.h >= f.y && p.x + p.w > f.x + 4 && p.x < f.x + f.w - 4) {
        p.y = f.y - p.h; p.vy = 0; p.ground = true; p.on = f;
        if (!f.t) { f.t = 1; SFX.crack(); }
      }
    });
    if (p.ground && !p.on) L.safe = { x: p.x, y: p.y };
    // chute dans l'eau : on revient sans pénalité
    if (p.y > VIEW_H + 60) {
      SFX.splash();
      for (let i = 0; i < 14; i++) parts.push({ x: p.x + 20, y: VIEW_H - 30, vx: (Math.random() - .5) * 6, vy: -Math.random() * 7 - 2, life: 50, col: '#cfeeff', r: 5 });
      p.x = L.safe.x; p.y = L.safe.y - 4; p.vx = p.vy = 0; p.on = null;
      say(pick(['Plouf ! On recommence.', "Oups, de l'eau ! Réessaie."]));
    }
    L.mush.forEach(m => { m.sq *= .88; });
    stepFoes(p); collectItems(p, 14); checkGates(p); gateAnim(); checkSwitches(p);
    if (p.x + p.w >= L.nestX) { if (bossBlocks()) nestGuarded(p); else levelDone(); }
    updateParts(); follow(p);
  },
  render() {
    const d = L.d, oy = L.oy;
    drawSkyScene(d, oy + GROUND * T);
    ctx.save(); ctx.translate(-Math.round(camX * 2) / 2, oy);
    ctx.fillStyle = '#2f8fd8'; ctx.fillRect(camX - 10, GROUND * T + 30, viewW + 20, VIEW_H);
    ctx.strokeStyle = '#9fd8ff'; ctx.lineWidth = 4; ctx.beginPath();
    for (let x = Math.floor(camX / 40) * 40 - 40; x < camX + viewW + 40; x += 40) { const wy = GROUND * T + 32 + Math.sin(time * 2 + x * .05) * 3; ctx.moveTo(x, wy); ctx.quadraticCurveTo(x + 10, wy - 6, x + 20, wy); }
    ctx.stroke();
    const c0 = Math.max(0, Math.floor(camX / T) - 1), c1 = Math.min(L.cols - 1, Math.floor((camX + viewW) / T) + 1);
    layerDraw('tiles', c0, c1, Math.round(camX * 2) / 2, oy, (g, a, b) => this.tiles(g, d, a, b));
    L.movers.forEach(m => {
      ctx.fillStyle = '#9b6a3a'; ctx.strokeStyle = '#1d2b22'; ctx.lineWidth = 3;
      rr(ctx, m.x, m.y, m.w, m.h, 9); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#c99a62'; circle(ctx, m.x + 10, m.y + 9, 5); circle(ctx, m.x + m.w - 10, m.y + 9, 5);
      ctx.fillStyle = '#4caf50'; ctx.beginPath(); ctx.ellipse(m.x + m.w / 2, m.y + 1, 16, 5, -.3, 0, Math.PI * 2); ctx.fill();
    });
    L.falls.forEach(f => {
      if (f.back) return;
      const sx = f.t > 0 && f.t <= 40 ? Math.sin(f.t * 1.7) * 2 : 0;
      ctx.fillStyle = '#b08a5a'; ctx.strokeStyle = '#1d2b22'; ctx.lineWidth = 3;
      rr(ctx, f.x + sx, f.y, f.w, f.h, 9); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#6e4520'; ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(f.x + sx + f.w * .35, f.y + 2); ctx.lineTo(f.x + sx + f.w * .42, f.y + 9); ctx.lineTo(f.x + sx + f.w * .36, f.y + 16);
      ctx.moveTo(f.x + sx + f.w * .7, f.y + 3); ctx.lineTo(f.x + sx + f.w * .64, f.y + 12); ctx.stroke();
    });
    L.mush.forEach(m => {
      ctx.save(); ctx.translate(m.x + m.w / 2, m.y + m.h); ctx.scale(1 + m.sq * .25, 1 - m.sq * .3);
      ctx.strokeStyle = '#1d2b22'; ctx.lineWidth = 3;
      ctx.fillStyle = '#fff1d6'; rr(ctx, -9, -18, 18, 18, 5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e5483b'; ctx.beginPath(); ctx.ellipse(0, -18, 26, 16, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; circle(ctx, -10, -24, 4); circle(ctx, 6, -28, 3.5); circle(ctx, 14, -21, 3);
      ctx.restore();
    });
    L.items.forEach(drawFruit);
    this.nest();
    L.gates.forEach(g => { if (onScreen(g.c * T + T / 2)) this.stone(g, oy); });
    drawSwitches();
    const p = player;
    drawFoes();
    if (!(p.hurt > 0 && p.hurt % 8 < 4)) drawDino(ctx, world(), p.x + 20, p.y + 44, p.face, time, Math.abs(p.vx) > 0 && p.ground, !p.ground);
    drawParts();
    ctx.restore();
  },
  tiles(g, d, a, b) {
    for (let c = a; c <= b; c++) for (let r = 0; r < ROWS; r++) {
      if (!isSolid(c, r)) continue;
      const x = c * T, y = r * T, floating = r < GROUND && !isSolid(c, r + 1);
      g.fillStyle = d.dirt;
      if (floating) { rr(g, x, y, T + .5, T - 10, 10); g.fill(); } else g.fillRect(x, y, T + .5, T + .5);
      g.fillStyle = d.dirtDark; const s = srand(c * 7 + r * 13);
      circle(g, x + 10 + s * 24, y + 22 + s * 8, 4); circle(g, x + 34 - s * 10, y + (floating ? 26 : 38), 3);
      if (!isSolid(c, r - 1)) {
        g.fillStyle = d.grassDark; g.fillRect(x, y - 2, T + .5, 14);
        g.fillStyle = d.grass; g.fillRect(x, y - 4, T + .5, 12);
        for (let k = 0; k < 4; k++) circle(g, x + 6 + k * 12, y + 8, 6);
      }
    }
    for (let c = a; c <= b; c++) if (isSolid(c, GROUND) && !isSolid(c, GROUND - 1) && srand(c + 40) > .7) {
      const x = c * T + 24, y = GROUND * T - 2;
      g.strokeStyle = d.grassDark; g.lineWidth = 4; g.lineCap = 'round';
      for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + k * 8, y - 16, x + k * 14, y - 22 + Math.abs(k) * 4); g.stroke(); }
    }
  },
  stone(g, oy) {
    const x = g.c * T + 2, w = T - 4, top = GROUND * T - 160, bot = GROUND * T;
    if (g.open) {
      if (g.anim >= 1) { ctx.fillStyle = '#5d567a'; circle(ctx, x + 10, bot - 6, 8); circle(ctx, x + 32, bot - 5, 6); return; }
      ctx.globalAlpha = 1 - g.anim;
    }
    const pulse = .5 + .5 * Math.sin(time * 3 + g.c);
    ctx.fillStyle = `rgba(57,201,168,${.12 + pulse * .1})`;
    ctx.fillRect(x + 8, -oy - 20, w - 16, top + oy + 20);
    ctx.fillStyle = 'rgba(200,255,240,.8)';
    for (let k = 0; k < 4; k++) { const sy = ((time * 40 + k * 60 + g.c * 13) % (top + oy + 20)) - oy; circle(ctx, x + w / 2 + Math.sin(time * 2 + k) * 8, sy, 3); }
    ctx.fillStyle = '#7a6f9b'; ctx.strokeStyle = '#1d2b22'; ctx.lineWidth = 4;
    rr(ctx, x, top, w, bot - top + 4, 16); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#665c88'; ctx.fillRect(x + 6, top + 30, w - 12, 6); ctx.fillRect(x + 6, top + 128, w - 12, 6);
    ctx.fillStyle = `rgba(57,201,168,${.55 + pulse * .45})`; circle(ctx, x + w / 2, top + 82, 18);
    ctx.fillStyle = '#fff4dc'; ctx.beginPath(); ctx.ellipse(x + w / 2, top + 83, 10, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = '#fff7e6'; ctx.font = '26px "Lilita One", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('?', x + w / 2, top + 24 - Math.abs(Math.sin(time * 3)) * 4);
    ctx.globalAlpha = 1;
  },
  nest() {
    const x = L.nestX, y = GROUND * T;
    drawDino(ctx, world(), x + 110, y, -1, time, false, false, 2.1);
    ctx.fillStyle = '#a0692e'; ctx.strokeStyle = '#1d2b22'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x - 10, y - 30); ctx.lineTo(x + 70, y - 30); ctx.quadraticCurveTo(x + 64, y + 2, x + 30, y + 2); ctx.quadraticCurveTo(x - 4, y + 2, x - 10, y - 30); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#6e4520'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - 2, y - 20); ctx.lineTo(x + 62, y - 20); ctx.moveTo(x + 6, y - 10); ctx.lineTo(x + 54, y - 10); ctx.stroke();
  },
};

/* Décor de ciel partagé : soleil, montagnes, collines, palmiers */
// Palmier du fond : une image toute faite par hauteur (arrondie à 10) et par couleur.
function drawPalm(x, base, h, col) {
  h = Math.round(h / 10) * 10;
  const spr = sprite('palmier' + h + col, 130, h + 40, g => paintPalm(g, 56, h + 32, h, col));
  if (spr) ctx.drawImage(spr, x - 56, base - h - 32, 130, h + 40); else paintPalm(ctx, x, base, h, col);
}
function paintPalm(ctx, x, base, h, col) {
  ctx.strokeStyle = col; ctx.lineWidth = 10; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, base); ctx.quadraticCurveTo(x + 18, base - h / 2, x + 8, base - h); ctx.stroke();
  ctx.fillStyle = col;
  for (let k = 0; k < 6; k++) {
    const a = -Math.PI / 2 + (k - 2.5) * .55;
    const ex = x + 8 + Math.cos(a) * 60, ey = base - h + Math.sin(a) * 30 + 16;
    ctx.beginPath(); ctx.moveTo(x + 8, base - h);
    ctx.quadraticCurveTo((x + 8 + ex) / 2, base - h - 26, ex, ey);
    ctx.quadraticCurveTo((x + 8 + ex) / 2, base - h - 6, x + 8, base - h);
    ctx.fill();
  }
}
function drawBrachio(x, base, col) {
  ctx.fillStyle = col; ctx.strokeStyle = col;
  ctx.beginPath(); ctx.ellipse(x, base - 46, 62, 30, 0, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 22; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x + 40, base - 56); ctx.quadraticCurveTo(x + 70, base - 120, x + 80, base - 170); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(x + 92, base - 174, 20, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 14;
  ctx.beginPath(); ctx.moveTo(x - 56, base - 40); ctx.quadraticCurveTo(x - 100, base - 30, x - 120, base - 10); ctx.stroke();
  [-36, -14, 20, 40].forEach(lx => { ctx.fillRect(x + lx - 9, base - 40, 18, 40); });
}
function drawMountains(d, base, f) {
  ctx.fillStyle = d.far;
  const sp = 380, s = Math.floor(camX * f / sp) - 1;
  for (let i = s; i < s + viewW / sp + 3; i++) {
    const x = i * sp - camX * f, h = 140 + srand(i) * 110;
    ctx.beginPath(); ctx.moveTo(x - 60, base); ctx.lineTo(x + 140, base - h); ctx.lineTo(x + 340, base); ctx.fill();
    if (d.volcano && i % 2 === 0) { ctx.fillStyle = '#ff7a3a'; ctx.beginPath(); ctx.moveTo(x + 120, base - h + 12); ctx.lineTo(x + 140, base - h); ctx.lineTo(x + 160, base - h + 12); ctx.fill(); ctx.fillStyle = d.far; }
  }
}
function drawSkyScene(d, base) {
  setView();
  ctx.fillStyle = screenGrad(d.sky[0], d.sky[1]); ctx.fillRect(0, 0, viewW, viewH);
  const top = base - GROUND * T;
  if (d.night) {
    ctx.fillStyle = '#fff8d6';
    for (let i = 0; i < 40; i++) { const tw = .5 + .5 * Math.sin(time * 2 + i); ctx.globalAlpha = .4 + tw * .6; circle(ctx, wrap(srand(i) * 1.3 * viewW - camX * .03, viewW + 20), top + srand(i + 50) * 220, 1.5 + srand(i + 9) * 1.2); }
    ctx.globalAlpha = 1; ctx.fillStyle = '#f5e6a8'; circle(ctx, viewW - 90, top + 70, 30);
    ctx.fillStyle = d.sky[0]; circle(ctx, viewW - 78, top + 62, 26);
  } else if (!d.cave) { ctx.fillStyle = 'rgba(255,220,120,.9)'; circle(ctx, viewW - 90, top + 70, 34); }
  drawMountains(d, base, .12);
  ctx.fillStyle = d.mid;
  const sp2 = 260, s2 = Math.floor(camX * .3 / sp2) - 1;
  for (let i = s2; i < s2 + viewW / sp2 + 3; i++) {
    const x = i * sp2 - camX * .3;
    ctx.beginPath(); ctx.ellipse(x + 130, base + 10, 170, 70 + srand(i + 9) * 40, 0, Math.PI, 0); ctx.fill();
    if (!d.cave && srand(i + 3) > .72) { drawBrachio(x + 120, base - 40, d.mid); ctx.fillStyle = d.mid; }
  }
  const sp3 = 210, s3 = Math.floor(camX * .55 / sp3) - 1;
  if (d.cave) {
    // Stalactites au plafond et cristaux qui brillent
    for (let i = s3; i < s3 + viewW / sp3 + 3; i++) {
      const x = i * sp3 - camX * .55 + srand(i + 5) * 80;
      ctx.fillStyle = d.near; ctx.beginPath(); ctx.moveTo(x - 30, 0); ctx.lineTo(x, top + 60 + srand(i + 2) * 90); ctx.lineTo(x + 30, 0); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x + 50, 0); ctx.lineTo(x + 66, top + 30 + srand(i + 7) * 50); ctx.lineTo(x + 82, 0); ctx.fill();
      const cx = x + 100, glow = .5 + .5 * Math.sin(time * 2 + i);
      ctx.fillStyle = `rgba(180,140,255,${.25 + glow * .25})`; circle(ctx, cx, base - 10, 26);
      ctx.fillStyle = '#b48cff'; ctx.beginPath(); ctx.moveTo(cx - 10, base); ctx.lineTo(cx - 4, base - 34); ctx.lineTo(cx + 2, base); ctx.moveTo(cx, base); ctx.lineTo(cx + 8, base - 24); ctx.lineTo(cx + 14, base); ctx.fill();
    }
  } else for (let i = s3; i < s3 + viewW / sp3 + 3; i++) drawPalm(i * sp3 - camX * .55 + srand(i + 5) * 80, base + 20, 130 + srand(i + 2) * 70, d.near);
  if (d.night) for (let i = 0; i < 14; i++) {
    // Lucioles
    const xx = wrap(srand(i + 3) * viewW * 1.4 - camX * .8 + Math.sin(time * .7 + i) * 30, viewW + 40) - 20, y = top + 120 + srand(i + 30) * 220 + Math.sin(time * 1.3 + i * 2) * 20;
    const a = .5 + .5 * Math.sin(time * 3 + i * 1.7);
    ctx.fillStyle = `rgba(255,240,120,${a * .35})`; circle(ctx, xx, y, 9); ctx.fillStyle = `rgba(255,250,190,${.4 + a * .6})`; circle(ctx, xx, y, 3);
  }
}

