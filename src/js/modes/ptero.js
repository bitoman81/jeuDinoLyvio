/* ---------- Ptérodactyle : vol et lancer de graines ---------- */
MODES.shmup = {
  oy: () => (viewH - VIEW_H) / 2,
  build(d) {
    const R = rng(d.seed);
    L.cols = 0; L.grid = []; L.solid = () => false;
    L.items = []; L.rocks = []; L.shots = [];
    const gx = [.25, .5, .75].map(f => Math.round(d.len * f));
    L.gates = gx.map((x, k) => ({ k, x: x - 30, y: 200, baseY: 200, w: 60, h: 80, block: false, open: false, anim: 0, type: d.puzzles[k], eggY: 240 }));
    // Bouton sur un petit nuage, mur de lianes plus loin : pas de cailloux autour.
    const sw = (d.switches || []).flatMap(([sx, , dx]) => [sx, dx]);
    for (let x = 650; x < d.len - 450;) {
      if (gx.some(g => Math.abs(g - x) < 260) || sw.some(g => Math.abs(g - x) < 320)) { x += 120; continue; }
      if (R() < (d.rockRate || .62)) L.rocks.push({ x, y: 50 + R() * 380, r: 14 + R() * 9, vx: -(.5 + R() * 1.2) * d.rocks, vy: (R() - .5) * .8, rot: R() * 6, seed: Math.floor(R() * 1000) });
      else { const y0 = 90 + R() * 300; for (let k = 0; k < 5; k++) L.items.push({ x: x + k * 42, y: y0 + Math.sin(k * .8) * 40, taken: false, ph: k }); }
      x += (170 + R() * 200) / d.rocks;
    }
    L.nestX = d.len;
    makeSwitches(d, (sx, sy, dx) => ({ bx: sx, by: sy, zone: { x: sx - 26, y: sy - 34, w: 52, h: 44 }, door: { x: dx, y: -200, w: 42, h: VIEW_H + 400, top: 0, bot: VIEW_H } }));
    player = { x: 80, y: 210, w: 46, h: 30, fire: 20, hurt: 0, kx: 0 };
  },
  step() {
    const p = player, d = L.d;
    const next = L.gates.find(g => !g.open);
    let limit = next ? next.x + next.w / 2 - viewW * .78 : L.nestX + 260 - viewW;
    // Une porte fermée arrête aussi la caméra.
    const shut = L.doors.find(dr => !dr.open);
    if (shut) limit = Math.min(limit, shut.x + shut.w / 2 - viewW * .78);
    const before = camX; if (camX < limit) camX = Math.min(limit, camX + d.speed);
    const scroll = camX - before;
    const [ix, iy] = inputDir(p);
    p.x += ix * 4.6 + scroll; p.y += iy * 4.6;
    // Le vent pousse doucement vers le haut puis vers le bas.
    if (d.wind) p.y += Math.sin(time * .8) * d.wind;
    if (p.hurt > 0) { p.hurt--; p.x += p.kx; p.kx *= .9; }
    // Sur téléphone, le ptérodactyle reste loin des bords, là où sont les pouces (120 au plus :
    // sur un écran très large, une marge plus grande l'empêchait d'atteindre le nid).
    const mx = touchUI ? Math.min(viewW * .18, 120) : 8;
    p.x = clamp(p.x, camX + mx, camX + viewW - p.w - mx); p.y = clamp(p.y, 6, VIEW_H - p.h - 6);
    if (shut && p.x + p.w > shut.x - 4) p.x = shut.x - p.w - 4;
    if (--p.fire <= 0) { p.fire = 20; L.shots.push({ x: p.x + p.w, y: p.y + p.h * .45, vx: 7.5, hit: false }); }
    // Bouton d'action : une graine de plus, tout de suite.
    if (jumpPressed) { jumpPressed = false; if (!(p.cool > 0)) {
      p.cool = 12; L.shots.push({ x: p.x + p.w, y: p.y + p.h * .45, vx: 8.5, hit: false }); SFX.pop();
      // Graine triple (pouvoir) : deux graines de plus, vers le haut et vers le bas
      if (L.triple) [-1.8, 1.8].forEach(vy => L.shots.push({ x: p.x + p.w, y: p.y + p.h * .45, vx: 8.2, vy, hit: false }));
    } }
    if (p.cool > 0) p.cool--;
    L.shots.forEach(s => { s.x += s.vx; s.y += s.vy || 0; });
    L.rocks.forEach(r => {
      if (r.dead || r.x > camX + viewW + 60) return;
      r.x += r.vx; r.y += r.vy; r.rot += .02;
      if (r.y < 20 || r.y > VIEW_H - 20) r.vy *= -1;
      for (const s of L.shots) if (!s.hit && Math.hypot(s.x - r.x, s.y - r.y) < r.r + 6) {
        s.hit = true; r.dead = true; SFX.pop();
        for (let i = 0; i < 12; i++) parts.push({ x: r.x, y: r.y, vx: (Math.random() - .5) * 7, vy: (Math.random() - .5) * 7, g: .15, life: 30, col: pick(['#8a7a6a', '#ffd23a', '#fff4dc']), r: 3 + Math.random() * 3 });
        if (Math.random() < .5) L.items.push({ x: r.x, y: r.y, taken: false, ph: 0 });
        break;
      }
      if (!r.dead && !L.shield && p.hurt <= 0 && hit(p, { x: r.x - r.r * .8, y: r.y - r.r * .8, w: r.r * 1.6, h: r.r * 1.6 })) { p.hurt = 50; p.kx = -3; r.vx -= 1.5; SFX.bonk(); }
    });
    L.shots = L.shots.filter(s => !s.hit && s.x < camX + viewW + 30);
    L.rocks = L.rocks.filter(r => !r.dead && r.x > camX - 80);
    L.gates.forEach(g => { if (!g.open) { g.y = g.baseY + Math.sin(time * 2 + g.k) * 14; g.eggY = g.y + 40; } });
    stepFoes(p); collectItems(p, 16); checkGates(p); gateAnim(); checkSwitches(p);
    // Le nid est atteint aussi quand le ptérodactyle est au bout de l'écran, caméra arrêtée.
    if (!next && !shut && !bossBlocks() && p.x + p.w >= Math.min(L.nestX + 40, camX >= limit ? camX + viewW - mx - 4 : Infinity)) levelDone();
    updateParts();
  },
  render() {
    const d = L.d, oy = L.oy;
    setView();
    ctx.fillStyle = screenGrad(d.sky[0], d.sky[1]); ctx.fillRect(0, 0, viewW, viewH);
    if (!d.storm) { ctx.fillStyle = d.sunset ? 'rgba(255,150,80,.95)' : 'rgba(255,220,120,.9)'; circle(ctx, viewW - 90, oy + (d.sunset ? 300 : 70), d.sunset ? 50 : 34); }
    if (d.rainbow) ['#e5483b', '#ff8a2a', '#f5c518', '#3fa34d', '#2f7fe0', '#8a5ad8'].forEach((c, k) => {
      ctx.strokeStyle = c; ctx.globalAlpha = .45; ctx.lineWidth = 14;
      ctx.beginPath(); ctx.arc(viewW * .6, oy + VIEW_H + 40, 300 - k * 14, Math.PI, 0); ctx.stroke(); ctx.globalAlpha = 1;
    });
    drawMountains(d, oy + VIEW_H - 30, .12);
    this.clouds(.35, .7, oy, 0);
    ctx.save(); ctx.translate(-Math.round(camX), oy);
    // cimes des arbres ou mer de nuages en bas
    ctx.fillStyle = d.ground;
    for (let x = Math.floor(camX / 60) * 60 - 60; x < camX + viewW + 60; x += 60) circle(ctx, x, VIEW_H + 14 - srand(x) * 16, 44);
    this.cliff();
    L.items.forEach(drawFruit);
    L.rocks.forEach(r => this.meteor(r));
    L.shots.forEach(s => {
      ctx.fillStyle = '#8a5a2b'; ctx.strokeStyle = '#1d2b22'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(s.x, s.y, 6, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#4caf50'; ctx.beginPath(); ctx.ellipse(s.x - 6, s.y - 4, 4, 2, -.6, 0, Math.PI * 2); ctx.fill();
    });
    L.gates.forEach(g => this.crystal(g));
    drawSwitches();
    const p = player;
    drawFoes();
    if (!(p.hurt > 0 && p.hurt % 8 < 4)) drawDino(ctx, world(), p.x + p.w / 2 - 4, p.y + p.h / 2 + 18, 1, time, true, true, 1.15);
    if (L.shield) drawShield(p.x + p.w / 2, p.y + p.h / 2, 36);
    drawParts();
    ctx.restore();
    if (d.clouds) this.clouds(1.3, .45, oy, 7);
    if (d.wind) {
      // Traits de vent
      const tilt = -Math.sin(time * .8) * d.wind * 10;
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath();
      for (let k = 0; k < 10; k++) { const x = wrap(srand(k) * viewW - time * (300 + k * 20), viewW + 120) - 60, y = oy + 30 + srand(k + 7) * (VIEW_H - 60); ctx.moveTo(x, y); ctx.lineTo(x + 46, y - tilt); }
      ctx.stroke();
    }
    if (d.storm) {
      ctx.strokeStyle = 'rgba(200,220,255,.5)'; ctx.lineWidth = 2; ctx.beginPath();
      for (let k = 0; k < 40; k++) { const x = wrap(srand(k) * viewW - time * 120, viewW), y = wrap(srand(k + 40) * viewH + time * 600, viewH); ctx.moveTo(x, y); ctx.lineTo(x - 6, y + 16); }
      ctx.stroke();
      // Éclair doux, toutes les 6 secondes
      const f = time % 6; if (f < .25) { ctx.fillStyle = `rgba(255,255,240,${(.25 - f) * 1.4})`; ctx.fillRect(0, 0, viewW, viewH); }
    }
  },
  clouds(f, alpha, oy, seed) {
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    const sp = 320, s = Math.floor(camX * f / sp) - 1;
    for (let i = s; i < s + viewW / sp + 3; i++) {
      const x = i * sp - camX * f + srand(i + seed) * 120, y = oy + 40 + srand(i * 3 + seed) * 300;
      circle(ctx, x, y, 26); circle(ctx, x + 28, y - 10, 32); circle(ctx, x + 60, y, 24);
      ctx.fillRect(x, y, 60, 24);
    }
  },
  meteor(r) {
    ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.rot);
    ctx.beginPath();
    for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2, rad = r.r * (.8 + srand(r.seed + k) * .3); ctx[k ? 'lineTo' : 'moveTo'](Math.cos(a) * rad, Math.sin(a) * rad); }
    ctx.closePath(); ctx.fillStyle = '#8a7a6a'; ctx.strokeStyle = '#1d2b22'; ctx.lineWidth = 2.5; ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#6d5f52'; circle(ctx, r.r * .25, -r.r * .2, r.r * .25); circle(ctx, -r.r * .35, r.r * .3, r.r * .18);
    ctx.restore();
  },
  crystal(g) {
    if (g.open && g.anim >= 1) return;
    const x = g.x + g.w / 2, y = g.y + g.h / 2, sc = g.open ? 1 + g.anim : 1;
    ctx.save(); ctx.globalAlpha = g.open ? 1 - g.anim : 1; ctx.translate(x, y); ctx.scale(sc, sc);
    const pulse = .5 + .5 * Math.sin(time * 3 + g.k);
    ctx.fillStyle = `rgba(57,201,168,${.2 + pulse * .2})`; circle(ctx, 0, 0, 48);
    ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(28, 0); ctx.lineTo(0, 40); ctx.lineTo(-28, 0); ctx.closePath();
    const gg = gradCache(ctx, 'cristal', () => { const x = ctx.createLinearGradient(-28, -40, 28, 40); x.addColorStop(0, '#b9a8ff'); x.addColorStop(1, '#5a4c9a'); return x; });
    ctx.fillStyle = gg; ctx.strokeStyle = '#1d2b22'; ctx.lineWidth = 3; ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff4dc'; ctx.beginPath(); ctx.ellipse(0, 2, 9, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.moveTo(-6, -30); ctx.lineTo(-18, -4); ctx.lineTo(-12, -4); ctx.closePath(); ctx.fill();
    ctx.restore();
  },
  cliff() {
    const x = L.nestX, top = 320;
    ctx.fillStyle = L.d.volcano ? '#5b3b2a' : '#7d6a55'; ctx.strokeStyle = '#1d2b22'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - 40, VIEW_H + 40); ctx.lineTo(x - 10, top + 10); ctx.lineTo(x + 10, top); ctx.lineTo(x + 300, top); ctx.lineTo(x + 300, VIEW_H + 40); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#4caf50'; ctx.fillRect(x + 10, top - 3, 290, 8);
    ctx.fillStyle = '#a0692e'; ctx.beginPath(); ctx.moveTo(x + 40, top - 22); ctx.lineTo(x + 120, top - 22); ctx.quadraticCurveTo(x + 112, top + 4, x + 80, top + 4); ctx.quadraticCurveTo(x + 48, top + 4, x + 40, top - 22); ctx.closePath(); ctx.fill(); ctx.stroke();
    drawDino(ctx, world(), x + 200, top + 30, -1, 1.2, false, false, 1.8);
  },
};

