/* ---------- Ennemis et difficulté des endroits ----------
   Chaque endroit se joue en Simple, Normal ou Compliqué (L.hard = 0, 1, 2) : plus d'ennemis, plus
   rapides, et une pénalité plus forte quand on les touche. Normal s'ouvre quand l'endroit est fini
   en Simple, Compliqué après Normal ; chaque difficulté finie donne une médaille (bronze, argent, or).
   T-Rex : vélociraptors (sauter sur leur tête) ; tricératops : serpents (foncer dedans) ;
   ptérodactyle : libellules géantes (une graine) ; plésiosaure : poissons (nager vite dedans).
   Un ennemi battu laisse un fruit (ou une perle). Le bouclier protège aussi des ennemis. */
const HARD = [
  { name: 'Simple', medal: 'de bronze', n: .5, sp: .7, lose: 0, text: 'Quelques ennemis lents. On est seulement repoussé.' },
  { name: 'Normal', medal: "d'argent", n: 1, sp: 1, lose: 2, text: "Plus d'ennemis. On perd 2 fruits en les touchant." },
  { name: 'Compliqué', medal: "d'or", n: 1.6, sp: 1.35, lose: 5, back: true, text: "Beaucoup d'ennemis. On perd 5 fruits et on repart au dernier œuf." },
];
const MEDAL_COL = ['#c7803e', '#b8c2cc', '#ffd23a'];
// Normal se joue après la médaille de bronze de l'endroit, Compliqué après l'argent.
const hardOpen = (wk, i, h) => h === 0 || (prog.worlds[wk].medals[i] || 0) >= h;
// La difficulté jouée : celle choisie dans le menu, ou la plus haute déjà ouverte pour cet endroit.
const hardFor = (wk, i) => { let h = prog.hard; while (h > 0 && !hardOpen(wk, i, h)) h--; return h; };
const MEDAL_SVG = (h, on) => `<svg viewBox="0 0 24 30" class="medal${on ? '' : ' off'}" aria-hidden="true"><path d="M7 1h4l2 9H9zM13 1h4l-2 9h-4z" fill="${on ? '#e5483b' : '#c9c2b0'}"/><circle cx="12" cy="19" r="9" fill="${on ? MEDAL_COL[h] : '#e4dcc4'}" stroke="#1d2b22" stroke-width="2"/><text x="12" y="23" text-anchor="middle" font-size="10" font-weight="700" fill="#1d2b22">${h + 1}</text></svg>`;

// Les ennemis d'un endroit, placés loin du départ, des pierres, des boutons et du nid.
function makeFoes(d, hard) {
  const H = HARD[hard], foes = [], mode = L.mode, seed = (d.seed || 0) + (d.len || 0) + d.name.length * 7, R = k => srand(seed * 131 + hard * 17 + k);
  // (les endroits du T-Rex n'ont pas de « seed » : la longueur et le nom en tiennent lieu)
  const sw = (L.switches || []).flatMap(s => [s.bx, s.door.x]);
  if (mode === 'shmup') {
    const n = Math.max(1, Math.round(d.len / 1300 * H.n)), gx = L.gates.map(g => g.x);
    for (let k = 0; k < n; k++) {
      let x = 900 + (k + .5) * (d.len - 1400) / n;
      for (let t = 0; t < 12 && (gx.some(g => Math.abs(g - x) < 300) || sw.some(g => Math.abs(g - x) < 300)); t++) x += 90;
      foes.push({ kind: 'bug', x, y0: 80 + R(k) * 300, y: 0, w: 46, h: 30, sp: (1.1 + R(k + 50) * .6) * H.sp, ph: R(k + 9) * 6 });
    }
    return foes;
  }
  const cols = L.cols, first = mode === 'platform' ? (d.start || 1) + 7 : 7, last = Math.floor(L.nestX / T) - 3;
  const busy = c => c < first || c > last || L.gates.some(g => Math.abs(Math.floor(g.x / T) - c) <= 2) || sw.some(x => Math.abs(Math.floor(x / T) - c) <= 2);
  // Case libre pour l'ennemi : sur le sol (T-Rex), dans l'herbe (tricératops), dans l'eau (plésiosaure).
  const free = mode === 'platform' ? (c, r) => L.grid[c] && L.grid[c][GROUND] === 1 && L.grid[c][GROUND - 1] !== 1 && !busy(c)
    : (c, r) => L.grid[c] && !L.grid[c][r] && !busy(c);
  const rows = mode === 'platform' ? [GROUND - 1] : mode === 'topdown' ? [2, 3, 4, 5, 6, 7] : [3, 4, 5, 6];
  const n = Math.max(1, Math.round((last - first) / 14 * H.n)), span = (last - first) / n;
  for (let k = 0; k < n; k++) {
    let spot = null;
    for (let t = 0; t < 40 && !spot; t++) {
      const c = Math.round(first + (k + R(k * 3 + t) * .8 + .1) * span) + (t % 2 ? t : -t) % 5;
      const r = rows[Math.floor(R(k * 7 + t) * rows.length)];
      if (free(c, r) && free(c - 1, r) && free(c + 1, r) && !foes.some(f => Math.abs(f.c - c) < 4)) spot = [c, r];
    }
    if (!spot) continue;
    const [c, r] = spot;
    // Va-et-vient sur 3 cases au plus de chaque côté, sans quitter les cases libres.
    let a = c, b = c;
    while (a > c - 3 && free(a - 1, r)) a--;
    while (b < c + 3 && free(b + 1, r)) b++;
    const f = { c, min: a * T, max: (b + 1) * T, dir: R(k + 30) < .5 ? -1 : 1, ph: R(k + 40) * 6 };
    if (mode === 'platform') Object.assign(f, { kind: 'raptor', w: 46, h: 40, x: c * T, y: GROUND * T - 40, sp: 1.3 * H.sp });
    else if (mode === 'topdown') Object.assign(f, { kind: 'snake', w: 42, h: 22, x: c * T + 3, y: r * T + 13, sp: 1 * H.sp });
    else Object.assign(f, { kind: 'fish', w: 42, h: 24, x: c * T + 3, y: r * T + 12, y0: r * T + 12, sp: 1.4 * H.sp });
    foes.push(f);
  }
  return foes;
}
// Un ennemi battu : il s'en va et laisse un fruit (ou une perle) à ramasser.
function beatFoe(f) {
  f.gone = 1; SFX.pop();
  L.items.push({ x: f.x + f.w / 2, y: f.y + f.h / 2 - (f.kind === 'raptor' ? 20 : 0), taken: false, ph: 0 });
  for (let i = 0; i < 10; i++) parts.push({ x: f.x + f.w / 2, y: f.y + f.h / 2, vx: (Math.random() - .5) * 6, vy: (Math.random() - .5) * 6, g: .1, life: 28, col: pick(['#fff4dc', '#ffd23a', '#9fd8ff']), r: 3 + Math.random() * 3 });
}
// Touché par un ennemi : repoussé ; en Normal on perd 2 fruits, en Compliqué 5, et on repart au dernier œuf.
function hurtByFoe(p, f) {
  const H = HARD[L.hard];
  p.hurt = 60; SFX.bonk();
  const dx = p.x + p.w / 2 - (f.x + f.w / 2), dy = p.y + p.h / 2 - (f.y + f.h / 2), dd = Math.hypot(dx, dy) || 1;
  if (L.mode === 'platform') { p.vy = -7; p.ground = false; f.dir = dx > 0 ? -1 : 1; }
  else if (L.mode === 'topdown') { moveBox(p, dx / dd * 26, dy / dd * 26); p.dash = 0; }
  else if (L.mode === 'shmup') p.kx = -3;
  else { p.vx = dx / dd * 6; p.vy = dy / dd * 6; }
  const n = Math.min(H.lose, fruitCount);
  if (n) {
    fruitCount -= n; prog.bag.n = Math.max(0, prog.bag.n - n); $('hudFruit').textContent = fruitCount;
    for (let i = 0; i < n * 3; i++) parts.push({ x: p.x + p.w / 2, y: p.y, vx: (Math.random() - .5) * 7, vy: -Math.random() * 6 - 2, g: .3, life: 40, col: L.sp.item === 'perles' ? '#f6f3ff' : '#b23a7a', r: 5 });
  }
  if (H.back && L.mode !== 'shmup') {
    const g = L.gates.filter(x => x.open).pop();
    if (L.mode === 'platform') { p.x = g ? g.x - 60 : L.start.x; p.y = GROUND * T - p.h - 2; p.vx = p.vy = 0; p.on = null; L.safe = { x: p.x, y: p.y }; }
    else if (L.mode === 'topdown') { p.x = g ? g.x - 44 : L.start.x; p.y = g ? g.row * T + 7 : L.start.y; p.vx = p.vy = 0; }
    else { p.x = g ? g.x - 56 : L.start.x; p.y = g ? VIEW_H / 2 - p.h / 2 : L.start.y; p.vx = p.vy = 0; }
  }
}
function stepFoes(p) {
  if (!L.foes) return;
  if (L.mode === 'platform' || L.mode === 'topdown') { if (p.hurt > 0) p.hurt--; }
  L.foes.forEach(f => {
    if (f.gone) { f.gone++; if (f.kind === 'fish') { f.x += f.dir * 6; f.y -= 1; } if (f.kind === 'bug') f.y += 4; return; }
    if (f.inv > 0) f.inv--;
    const beat = () => f.boss ? (f.inv ? false : (bossHit(f), true)) : (beatFoe(f), true);
    if (f.boss && !f.on) {
      // Le gardien se montre quand on approche (ptérodactyle : quand tous les œufs sont libérés, au bout du ciel)
      const near = L.mode === 'shmup' ? !L.gates.some(g => !g.open) && camX >= L.nestX + 260 - viewW - 2 : p.x + p.w > f.min - 420;
      if (!near) return;
      f.on = true; say(BOSS[f.kind].hello[f.big ? 1 : 0]);
      if (L.mode === 'shmup') f.x = camX + viewW + 60;
    }
    if (f.kind === 'bug') {
      if (f.boss) { f.x += (camX + viewW - 230 - f.x) * .04; f.y = f.y0 + Math.sin(time * 1.3) * 150; }
      else {
        if (f.x > camX + viewW + 60) return;   // elle attend d'être à l'écran
        f.x -= f.sp; f.y = f.y0 + Math.sin(time * 2.2 + f.ph) * 46;
      }
      for (const s of L.shots) if (!s.hit && hit({ x: s.x - 6, y: s.y - 6, w: 12, h: 12 }, f)) { s.hit = true; if (beat()) return; }
    } else if (f.axis === 'y') {
      f.y += f.dir * f.sp;
      if (f.y < f.min) { f.y = f.min; f.dir = 1; } else if (f.y + f.h > f.max) { f.y = f.max - f.h; f.dir = -1; }
    } else {
      f.x += f.dir * f.sp;
      if (f.x < f.min) { f.x = f.min; f.dir = 1; } else if (f.x + f.w > f.max) { f.x = f.max - f.w; f.dir = -1; }
      if (f.kind === 'fish') f.y = f.y0 + Math.sin(time * 1.6 + f.ph) * 10;
    }
    if (!hit(p, f)) return;
    // Battre l'ennemi : sauter sur la tête du vélociraptor, foncer dans le serpent, nager vite dans le poisson.
    if (f.kind === 'raptor' && p.vy > 0 && p.y + p.h - p.vy <= f.y + 14 * (f.s || 1)) { p.vy = JUMP * .7; SFX.boing(); if (beat()) return; return; }
    if ((f.kind === 'snake' || f.kind === 'fish') && p.dash > 0) { if (f.kind === 'fish' && !f.boss) f.dir = p.face || 1; beat(); return; }
    if (!L.shield && !(p.hurt > 0)) hurtByFoe(p, f);
  });
  L.foes = L.foes.filter(f => !(f.gone > 36) && !(f.kind === 'bug' && f.x < camX - 120));
}
function drawFoes() {
  if (!L.foes) return;
  const c = ctx;
  L.foes.forEach(f => {
    if (f.boss && !f.on) return;
    if (!onScreen(f.x, 160 + f.w)) return;
    c.save();
    if (f.gone) c.globalAlpha = Math.max(0, 1 - f.gone / 36);
    else if (f.inv > 0 && f.inv % 10 < 5) c.globalAlpha = .45;
    c.strokeStyle = '#1d2b22'; c.lineWidth = 3; c.lineJoin = c.lineCap = 'round';
    const cx = f.x + f.w / 2, cy = f.y + f.h / 2, k = f.s || 1;
    if (f.boss && !f.gone) {
      // Ses cœurs, au-dessus de lui
      for (let i = 0; i < f.hpMax; i++) { c.fillStyle = i < f.hp ? '#e5483b' : 'rgba(255,255,255,.6)'; heart(c, cx + (i - (f.hpMax - 1) / 2) * 20, f.y - 18, 8); c.stroke(); }
    }
    if (f.kind === 'raptor') {
      // Vélociraptor vu de côté, il regarde dans le sens de sa marche
      c.translate(cx, f.y + f.h); c.scale(f.dir * k, (f.gone ? .5 : 1) * k);
      const step = Math.sin(time * 10 + f.ph) * 5;
      c.beginPath(); c.moveTo(-6, -20); c.lineTo(-6 + step, 0); c.moveTo(6, -20); c.lineTo(6 - step, 0); c.stroke();
      c.fillStyle = '#c96a2a';
      c.beginPath(); c.moveTo(-8, -26); c.quadraticCurveTo(-30, -30, -34, -22); c.quadraticCurveTo(-20, -18, -8, -16); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.ellipse(0, -22, 14, 9, -.2, 0, Math.PI * 2); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(8, -26); c.quadraticCurveTo(12, -38, 18, -38); c.lineTo(26, -36); c.quadraticCurveTo(28, -31, 24, -30); c.lineTo(14, -29); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#7a3a1a'; [[-4, -28], [2, -29], [-12, -26]].forEach(([x, y]) => { c.beginPath(); c.ellipse(x, y, 2, 4, .3, 0, Math.PI * 2); c.fill(); });
      c.fillStyle = '#fff'; circle(c, 18, -35, 3); c.fillStyle = '#1d2b22'; circle(c, 19, -35, 1.6);
    } else if (f.kind === 'snake') {
      // Serpent vu de dessus : une suite de ronds qui ondule
      c.translate(cx, cy);
      if (f.axis === 'y') { c.rotate(f.dir > 0 ? Math.PI / 2 : -Math.PI / 2); c.scale(k, k); } else c.scale(f.dir * k, k);
      const seg = 7;
      for (let k = seg; k >= 0; k--) {
        const x = 16 - k * 5, y = Math.sin(time * 8 - k * .9 + f.ph) * 4 * (k / seg);
        c.fillStyle = k % 2 ? '#5aa83c' : '#e0c23a'; circle(c, x, y, 7 - k * .4);
      }
      c.fillStyle = '#5aa83c'; c.beginPath(); c.ellipse(18, 0, 9, 7, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.strokeStyle = '#e5483b'; c.lineWidth = 2; c.beginPath(); c.moveTo(27, 0); c.lineTo(32, -2); c.moveTo(27, 0); c.lineTo(32, 2); c.stroke();
      c.fillStyle = '#1d2b22'; circle(c, 21, -4, 1.6); circle(c, 21, 4, 1.6);
    } else if (f.kind === 'bug') {
      // Libellule géante : quatre ailes qui battent, gros yeux
      c.translate(cx, cy); c.scale(k, k);
      const flap = Math.abs(Math.sin(time * 25 + f.ph));
      c.fillStyle = 'rgba(210,240,255,.75)'; c.lineWidth = 2;
      [[-4, -1], [6, -1]].forEach(([x, s]) => { c.beginPath(); c.ellipse(x, -8 - flap * 4, 16, 5 + flap * 2, s * .5, 0, Math.PI * 2); c.fill(); c.stroke(); c.beginPath(); c.ellipse(x, 8 + flap * 4, 16, 5 + flap * 2, -s * .5, 0, Math.PI * 2); c.fill(); c.stroke(); });
      c.lineWidth = 3; c.fillStyle = '#3fa7c9';
      c.beginPath(); c.ellipse(4, 0, 24, 5, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = '#2a7f9c'; for (let k = 0; k < 4; k++) circle(c, 12 + k * 5, 0, 1.6);
      c.fillStyle = '#e5483b'; circle(c, -20, -4, 6); circle(c, -20, 4, 6);
      c.fillStyle = '#fff'; circle(c, -22, -5, 2); circle(c, -22, 3, 2);
    } else {
      // Poisson : corps rond, queue, nageoire
      c.translate(cx, cy); c.scale(f.dir * k, k);
      const wag = Math.sin(time * 9 + f.ph) * 4;
      c.fillStyle = '#ff7a3a';
      c.beginPath(); c.moveTo(-14, 0); c.lineTo(-26, -10 + wag); c.lineTo(-26, 10 + wag); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.ellipse(0, 0, 18, 11, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = '#ffd23a'; c.beginPath(); c.moveTo(-4, -10); c.lineTo(4, -16); c.lineTo(8, -9); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = '#c0501a'; c.lineWidth = 2; c.beginPath(); c.arc(-2, 0, 7, -1, 1); c.stroke();
      c.fillStyle = '#fff'; circle(c, 9, -3, 3.5); c.fillStyle = '#1d2b22'; circle(c, 10, -3, 1.8);
    }
    c.restore();
  });
}

/* ---------- Le gardien du nid (boss) ----------
   À la fin de chaque endroit, un gros ennemi garde le nid. On le touche comme les autres (sauter sur
   sa tête, foncer, une graine, nager vite) ; chaque fois, une énigme s'ouvre : réussie, il perd un
   cœur. Quand il n'a plus de cœur, il s'en va et le nid est libre. Il a 3 cœurs ; le gardien final
   (dernier endroit de chaque animal, et fin de l'île secrète) en a 6 et il est plus grand.
   Le toucher autrement fait perdre comme un ennemi (selon la difficulté). */
const BOSS = {
  raptor: { hello: ['Le grand vélociraptor garde le nid ! Saute trois fois sur sa tête.', 'Le roi des vélociraptors garde le nid ! Saute six fois sur sa tête.'] },
  snake: { hello: ['Le grand serpent garde le nid ! Fonce trois fois dedans.', 'Le roi des serpents garde le nid ! Fonce six fois dedans.'] },
  bug: { hello: ['La libellule géante garde le nid ! Lance-lui trois graines.', 'La reine des libellules garde le nid ! Lance-lui six graines.'] },
  fish: { hello: ['Le gros poisson garde le nid ! Nage vite trois fois dedans.', 'Le roi des poissons garde le nid ! Nage vite six fois dedans.'] },
};
// Ce qu'on dit quand il reste n cœurs au gardien
const BOSS_LEFT = ['', 'Bravo ! Encore une fois !', 'Bravo ! Encore deux fois !', 'Bravo ! Encore trois fois !', 'Bravo ! Encore quatre fois !', 'Bravo ! Encore cinq fois !'];
const bossLevel = () => true;
const bossFinal = (wk, i) => wk === 'final' ? i === WORLDS.final.length - 1 : i === regularCount(wk) - 1;
const bossBlocks = () => !!(L.bossFoe && !L.bossFoe.gone);
function heart(c, x, y, r) {
  c.beginPath(); c.moveTo(x, y + r * .9);
  c.bezierCurveTo(x - r * 1.6, y - r * .2, x - r * .7, y - r * 1.3, x, y - r * .4);
  c.bezierCurveTo(x + r * .7, y - r * 1.3, x + r * 1.6, y - r * .2, x, y + r * .9); c.closePath(); c.fill();
}
function makeBoss(d, hard) {
  const H = HARD[hard], nc = Math.floor(L.nestX / T), mode = L.mode, lastGate = Math.max(...L.gates.map(g => Math.floor(g.x / T)), 0);
  const big = bossFinal(L.world, L.i), hp = big ? 6 : 3, k = big ? 2.5 : 2;
  const b = { boss: true, big, hp, hpMax: hp, inv: 0, on: false, s: k, dir: -1, ph: 0 };
  if (mode === 'platform') {
    // Sur le dernier bout de sol, autour du nid
    let a = nc - 1, e = nc;
    while (a > lastGate + 2 && L.grid[a - 1] && L.grid[a - 1][GROUND] === 1) a--;
    while (e < L.cols - 1 && L.grid[e + 1][GROUND] === 1) e++;
    return Object.assign(b, { kind: 'raptor', w: 46 * k, h: 40 * k, x: (a + e) / 2 * T, y: GROUND * T - 40 * k, min: a * T, max: Math.max((e + 1) * T, a * T + 46 * k + 10), sp: 1.5 * H.sp });
  }
  if (mode === 'topdown') {
    // De haut en bas, dans la colonne libre la plus longue juste avant le nid
    let best = null;
    for (let c = nc - 6; c <= nc - 2; c++) {
      let r0 = 1;
      for (let r = 1; r <= 9; r++) {
        if (r === 9 || L.grid[c][r]) { if (r - r0 >= 3 && (!best || r - r0 > best[2] - best[1])) best = [c, r0, r]; r0 = r + 1; }
      }
    }
    const [c, r0, r1] = best || [nc - 3, 1, 9];
    return Object.assign(b, { kind: 'snake', axis: 'y', w: 42 * k, h: 42 * k, x: c * T + T / 2 - 21 * k, y: r0 * T, min: r0 * T, max: Math.max(r1 * T, r0 * T + 42 * k + 10), sp: 1.3 * H.sp });
  }
  if (mode === 'shmup') return Object.assign(b, { kind: 'bug', w: 46 * k, h: 30 * k, x: L.nestX, y0: VIEW_H / 2 - 15 * k, y: VIEW_H / 2 - 15 * k, min: L.nestX });
  return Object.assign(b, { kind: 'fish', w: 42 * k, h: 24 * k, x: (nc - 5) * T, y: VIEW_H / 2 - 12 * k, y0: VIEW_H / 2 - 12 * k, min: (nc - 9) * T, max: nc * T, sp: 1.6 * H.sp });
}
// Touché comme il faut : une énigme ; réussie, il perd un cœur (voir closePuzzle).
function bossHit(f) {
  f.inv = 150; SFX.boing();
  openPuzzle({ boss: f, type: pick(L.d.puzzles), x: f.x, w: f.w, eggY: f.y });
}
function bossPuzzleDone(f, win) {
  f.inv = 120;
  if (!win) return;
  f.hp--;
  for (let i = 0; i < 14; i++) parts.push({ x: f.x + f.w / 2, y: f.y + f.h / 2, vx: (Math.random() - .5) * 8, vy: -Math.random() * 6, life: 40, col: pick(['#ffd23a', '#fff4dc', '#e5483b']), r: 4 });
  if (f.hp > 0) { say(BOSS_LEFT[f.hp]); return; }
  // Battu : il s'en va, et laisse 5 fruits (ou perles)
  f.gone = 1; SFX.yay();
  const gift = f.big ? 10 : 5;
  for (let i = 0; i < gift; i++) L.items.push({ x: f.x + f.w / 2 + (i - (gift - 1) / 2) * 26, y: f.y + f.h / 2 - 30 - (i % 2) * 24, taken: false, ph: i });
  say('Bravo ! Le gardien s’en va. Le chemin du nid est libre !');
}
// Le nid est gardé : on ne peut pas le rejoindre avant d'avoir battu le gardien.
function nestGuarded(p) {
  p.x = L.nestX - p.w - 2; if (L.mode === 'swim') p.vx = Math.min(p.vx, 0);
  if (!L.guardSaid || time - L.guardSaid > 6) { L.guardSaid = time; say("Le nid est gardé ! Bats d'abord le gardien."); }
}
const MODES = {};

