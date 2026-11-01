/* ---------- Espace parents ----------
   Les réglages vivent dans la base de la page (document parents/custom) : seul le propriétaire
   les modifie, tous ceux qui ouvrent le jeu les lisent. Sans base (hors claude.ai), on garde
   une copie sur l'appareil. */
const PKEY = 'dino-explorateur-parents';
// Lettres écrites à la main (pas de classe Unicode) : le moteur de la Switch n'a pas les tables Unicode.
const WORD_RE = /^[A-Za-zÀ-ÖØ-öø-ÿŒœ]{2,12}$/;
let custom = { calcs: [], words: [], tables: [2, 3, 4, 5, 10] }, dbDoc = null, canWrite = true, storeMode = 'local', saving = Promise.resolve();
function parseCalc(s) {
  if (typeof s !== 'string') return null;
  const t = s.replace(/\s+/g, '').replace(/[xX×*]/g, '*').replace(/[÷:/]/g, '/').replace(/[−–]/g, '-');
  if (!/^\d{1,3}([+\-*/]\d{1,3}){1,3}$/.test(t)) return null;
  const toks = t.match(/\d+|[+\-*/]/g);
  const nums = [+toks[0]], ops = [];
  for (let i = 1; i < toks.length; i += 2) {
    const op = toks[i], n = +toks[i + 1];
    if (op === '*') nums.push(nums.pop() * n);
    else if (op === '/') { const a = nums.pop(); if (n === 0 || a % n) return null; nums.push(a / n); }
    else { ops.push(op); nums.push(n); }
  }
  let v = nums[0];
  ops.forEach((op, i) => { v = op === '+' ? v + nums[i + 1] : v - nums[i + 1]; });
  if (v < 0 || v > 1000) return null;
  return {
    ans: v, key: t,
    disp: toks.map(k => ({ '*': '×', '/': '÷', '-': '−' }[k] || k)).join(' '),
    spoken: toks.map(k => ({ '*': 'fois', '/': 'divisé par', '-': 'moins', '+': 'plus' }[k] || k)).join(' '),
  };
}
function cleanCustom(o) {
  const tables = Array.isArray(o && o.tables) ? o.tables.filter(n => Number.isInteger(n) && n >= 1 && n <= 10) : [];
  return {
    calcs: Array.isArray(o && o.calcs) ? o.calcs.filter(c => parseCalc(c)).slice(0, 200) : [],
    words: Array.isArray(o && o.words) ? o.words.filter(w => typeof w === 'string' && WORD_RE.test(w)).slice(0, 200) : [],
    tables: tables.length ? tables : [2, 3, 4, 5, 10],
  };
}
try { const s = JSON.parse(localStorage.getItem(PKEY)); if (s) custom = cleanCustom(s); } catch (e) {}
function keepLocal() { try { localStorage.setItem(PKEY, JSON.stringify(custom)); } catch (e) {} }
async function initStore() {
  if (!window.claude || !window.claude.use) return;
  try {
    const db = await window.claude.use('db'); if (!db) return;
    const user = await window.claude.use('user');
    canWrite = user ? await user.canEdit() : false;
    dbDoc = db.doc('parents/custom'); storeMode = 'db';
    let first = true;
    dbDoc.onSnapshot(s => {
      if (s.exists) { custom = cleanCustom(s.data()); keepLocal(); }
      else if (first && canWrite && (custom.calcs.length || custom.words.length)) saveCustom(); // reprend ce qui était saisi sur cet appareil
      first = false;
      if (!$('parents').hidden) renderParents();
    }, () => { dbDoc = null; storeMode = 'local'; });
  } catch (e) {}
}
function statusText() {
  if (storeMode === 'db') return canWrite ? 'Enregistré automatiquement, sur tous les appareils.' : 'Lecture seule : seul le propriétaire du jeu peut modifier ces réglages.';
  return 'Enregistré sur cet appareil.';
}
function saveCustom() {
  keepLocal();
  if (!dbDoc || !canWrite) return;
  const data = JSON.parse(JSON.stringify(custom));
  saving = saving.then(() => dbDoc.set(data)).then(() => { $('pStatus').textContent = statusText(); }, err => {
    $('pStatus').textContent = err && err.code === 'quota_exceeded' ? "Plus de place pour enregistrer : retirez quelques calculs ou mots." : "L'enregistrement n'a pas marché. Vos réglages restent sur cet appareil, réessayez plus tard.";
  });
}
function chips(id, labels, remove, ro, emptyText) {
  const el = $(id); el.innerHTML = '';
  if (!labels.length) { const p = document.createElement('p'); p.className = 'empty-note'; p.textContent = emptyText; el.appendChild(p); return; }
  labels.forEach((t, i) => {
    const c = document.createElement('span'); c.className = 'chip'; c.append(t);
    if (!ro) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = '×'; b.setAttribute('aria-label', 'Retirer ' + t);
      b.onclick = () => { remove(i); saveCustom(); renderParents(); };
      c.appendChild(b);
    }
    el.appendChild(c);
  });
}
function renderParents() {
  const ro = storeMode === 'db' && !canWrite;
  $('pStatus').textContent = statusText();
  $('saveCode').value = exportCode();
  renderSkills();
  renderWeek();
  renderStats();
  ['calcIn', 'wordIn'].forEach(id => { $(id).disabled = ro; });
  chips('calcList', custom.calcs.map(k => parseCalc(k).disp + ' = ' + parseCalc(k).ans), i => custom.calcs.splice(i, 1), ro, 'Aucun calcul pour le moment. Ajoutez par exemple 5x5.');
  chips('wordList', custom.words, i => custom.words.splice(i, 1), ro, 'Aucun mot pour le moment. Ajoutez par exemple les mots de la semaine.');
  const tl = $('tableList'); tl.innerHTML = '';
  for (let n = 1; n <= 10; n++) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = n; b.disabled = ro;
    b.setAttribute('aria-pressed', custom.tables.includes(n)); b.setAttribute('aria-label', 'Table de ' + n);
    b.onclick = () => {
      if (custom.tables.includes(n)) { if (custom.tables.length > 1) custom.tables = custom.tables.filter(k => k !== n); }
      else custom.tables = [...custom.tables, n].sort((a, c) => a - c);
      saveCustom(); renderParents();
    };
    tl.appendChild(b);
  }
}
/* ---------- Statistiques pour les parents ----------
   prog.stats[jour][compétence] = [énigmes, réussies du premier coup, erreurs, niveau en fin de journée] */
const CURVE_COLORS = { count: '#2f7fe0', add: '#e5483b', sub: '#a0692e', mult: '#8a5ad8', compare: '#3fa34d', suite: '#e0a526', lettres: '#d94f9a', mots: '#1f5b3a', lire: '#2aa8b8', heure: '#5a5a5a', logique: '#ff7a1a' };
const CURVE_RANGES = [['7', '7 jours'], ['30', '30 jours'], ['all', 'Depuis le début']];
let curveSkill = 'all', curveRange = '30';
const dayDate = d => new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const dayKey = t => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
const daysAgo = d => Math.round((dayDate(today()) - dayDate(d)) / 864e5);
// Les jours de la période, du plus ancien à aujourd'hui.
function curveDays(range) {
  const first = Object.keys(prog.stats).sort()[0];
  const n = range === 'all' ? (first ? daysAgo(first) + 1 : 7) : +range;
  const t = dayDate(today());
  return Array.from({ length: Math.max(2, n) }, (_, i) => { const x = new Date(t); x.setDate(t.getDate() - (Math.max(2, n) - 1 - i)); return dayKey(x); });
}
// Niveau en fin de chaque jour ; un jour sans énigme garde le niveau d'avant. null avant la première énigme.
function levelSeries(k, days) {
  let lvl = null;
  Object.keys(prog.stats).sort().forEach(d => { if (d < days[0] && prog.stats[d][k]) lvl = prog.stats[d][k][3]; });
  return days.map(d => { const r = prog.stats[d] && prog.stats[d][k]; if (r) lvl = r[3]; return lvl; });
}
function skillStats(k) {
  const days = Object.keys(prog.stats).filter(d => prog.stats[d][k]).sort();
  const sum = days.reduce((a, d) => { const r = prog.stats[d][k]; a[0] += r[0]; a[1] += r[1]; a[2] += r[2]; return a; }, [0, 0, 0]);
  // Tendance : niveau d'aujourd'hui comparé à celui de la veille des 7 jours (ou au premier niveau de la semaine).
  const week = curveDays('7'), ser = levelSeries(k, week), played = week.some(d => prog.stats[d] && prog.stats[d][k]);
  const prev = dayDate(week[0]); prev.setDate(prev.getDate() - 1);
  const before = levelSeries(k, [dayKey(prev)])[0], from = before !== null ? before : ser.find(v => v !== null), end = ser[ser.length - 1];
  const trend = !played ? null : end > from ? 'up' : end < from ? 'down' : 'flat';
  return { n: sum[0], first: sum[1], errs: sum[2], last: days[days.length - 1] || null, trend };
}
function lastText(d) {
  if (!d) return 'jamais';
  const n = daysAgo(d);
  return n === 0 ? "aujourd'hui" : n === 1 ? 'hier' : n < 7 ? `il y a ${n} jours` : `${d.slice(8, 10)}/${d.slice(5, 7)}`;
}
/* Résumé de la semaine : les 7 derniers jours comparés aux 7 d'avant.
   Ce qui a progressé (niveau monté, ou presque tout réussi du premier coup), ce qui bloque
   (niveau descendu, moins de la moitié du premier coup, abandons), et les énigmes les plus ratées. */
function weekTotals(days) {
  const t = { n: 0, first: 0, errs: 0, quit: 0, sec: 0, days: 0, skills: {}, types: {} };
  days.forEach(d => {
    const day = prog.stats[d]; if (!day) return;
    let played = false;
    Object.keys(SKILLS).forEach(k => { const r = day[k]; if (!r) return; played = true; const s = t.skills[k] || (t.skills[k] = [0, 0, 0]); s[0] += r[0]; s[1] += r[1]; s[2] += r[2]; t.n += r[0]; t.first += r[1]; t.errs += r[2]; });
    Object.entries(day.types || {}).forEach(([k, r]) => { played = true; const s = t.types[k] || (t.types[k] = [0, 0, 0, 0]); r.forEach((v, i) => { s[i] += v; }); t.quit += r[3]; });
    t.sec += day.sec || 0;
    if (played || day.sec >= 60) t.days++;
  });
  return t;
}
function weekSummary() {
  const days = curveDays('7'), start = dayDate(days[0]), prev = [];
  for (let i = 7; i >= 1; i--) { const x = new Date(start); x.setDate(start.getDate() - i); prev.push(dayKey(x)); }
  const w = weekTotals(days), p = weekTotals(prev), good = [], bad = [];
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
  Object.entries(SKILLS).forEach(([k, sk]) => {
    const s = w.skills[k], ser = levelSeries(k, days), before = levelSeries(k, prev)[6];
    const from = before !== null ? before : ser.find(v => v !== null), to = ser[6];
    const quits = Object.entries(w.types).filter(([t]) => TYPE_SKILL[t] === k).reduce((a, [, r]) => a + r[3], 0);
    if (!s && !quits) return;
    if (to > from) good.push({ k, text: `${sk.name} : niveau ${from} → ${to}` });
    else if (s && s[0] >= 5 && pct(s[1], s[0]) >= 80) good.push({ k, text: `${sk.name} : ${pct(s[1], s[0])} % du premier coup` });
    if (to < from) bad.push({ k, text: `${sk.name} : niveau ${from} → ${to}` });
    else if (s && s[0] >= 3 && pct(s[1], s[0]) < 50) bad.push({ k, text: `${sk.name} : ${pct(s[1], s[0])} % du premier coup` });
    else if (quits >= 2) bad.push({ k, text: `${sk.name} : abandonné ${quits} fois` });
  });
  // Les plus ratées : erreurs par énigme, un abandon compte pour 2 erreurs ; au moins 2 énigmes.
  const missed = Object.entries(w.types).map(([t, r]) => ({ t, n: r[0] + r[3], errs: r[2], quit: r[3], score: (r[2] + 2 * r[3]) / (r[0] + r[3]) }))
    .filter(x => x.n >= 2 && x.score >= .5).sort((a, b) => b.score - a.score || b.n - a.n).slice(0, 3);
  return { days, w, p, good, bad, missed };
}
const durText = s => { const m = Math.round(s / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`; };
const plural = (n, one, many = one + 's') => `${n} ${n > 1 ? many : one}`;
// Le résumé en phrases (repris tel quel par la page parents de la Switch).
function weekLines() {
  const S = weekSummary(), { w, p } = S, d0 = S.days[0], since = `${d0.slice(8, 10)}/${d0.slice(5, 7)}`, head = [];
  if (!w.n && !w.quit && w.sec < 60) head.push(`Pas encore joué du ${since} à aujourd'hui.`);
  else {
    head.push(`Du ${since} à aujourd'hui : joué ${plural(w.days, 'jour')} sur 7` + (w.sec >= 60 ? `, ${durText(w.sec)} de jeu` : '')
      + `, ${plural(w.n, 'énigme réussie', 'énigmes réussies')}` + (w.n ? `, dont ${Math.round(w.first / w.n * 100)} % du premier coup` : '') + '.');
    if (p.n) head.push(w.n > p.n ? `C'est ${w.n - p.n} de plus que la semaine d'avant (${p.n}).` : w.n < p.n ? `C'est ${p.n - w.n} de moins que la semaine d'avant (${p.n}).` : "Autant que la semaine d'avant.");
  }
  const missed = S.missed.map(x => { const e = x.errs / x.n; return `${TYPE_NAMES[x.t]} : ${e.toFixed(1).replace('.', ',')} erreur${e >= 2 ? 's' : ''} par énigme` + (x.quit ? `, ${plural(x.quit, 'abandon')}` : ''); });
  const b = S.bad[0], tip = b ? `Idée : faire ensemble quelques énigmes « ${SKILLS[b.k].name} », ou baisser ce niveau d'un cran.` : '';
  return { head, good: S.good.map(x => x.text), bad: S.bad.map(x => x.text), missed, tip };
}
function renderWeek() {
  const W = weekLines(), esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const list = (arr, tag, none) => arr.length ? `<${tag}>${arr.map(t => `<li>${esc(t)}</li>`).join('')}</${tag}>` : `<p class="none">${none}</p>`;
  $('weekSum').innerHTML = `<p class="week-head">${W.head.map(esc).join(' ')}</p><div class="week-cols">`
    + `<div class="week-box good"><h4>Ce qui a progressé</h4>${list(W.good, 'ul', 'Rien de marquant cette semaine.')}</div>`
    + `<div class="week-box bad"><h4>Ce qui bloque</h4>${list(W.bad, 'ul', 'Rien ne bloque.')}</div>`
    + `<div class="week-box"><h4>Les énigmes les plus ratées</h4>${list(W.missed, 'ol', 'Aucune énigme vraiment ratée.')}</div></div>`
    + (W.tip ? `<p class="week-tip">${esc(W.tip)}</p>` : '');
}
const TREND = { up: ['up', '↗ monte'], down: ['down', '↘ descend'], flat: ['', '→ stable'] };
function renderStats() {
  const rows = Object.entries(SKILLS).map(([k, sk]) => {
    const st = skillStats(k), none = !st.n;
    const tr = st.trend ? `<td class="${TREND[st.trend][0]}">${TREND[st.trend][1]}</td>` : '<td class="none">pas joué</td>';
    return `<tr><td>${sk.name}</td><td>${prog.skills[k].lvl}</td><td>${st.n}</td>`
      + (none ? '<td class="none">–</td><td class="none">–</td>' : `<td>${Math.round(st.first / st.n * 100)} %</td><td>${(st.errs / st.n).toFixed(1).replace('.', ',')}</td>`)
      + `<td${none ? ' class="none"' : ''}>${lastText(st.last)}</td>${tr}</tr>`;
  }).join('');
  $('statTable').innerHTML = '<thead><tr><th>Compétence</th><th>Niveau</th><th>Énigmes</th><th>Du premier coup</th><th>Erreurs par énigme</th><th>Dernière fois</th><th>Sur 7 jours</th></tr></thead><tbody>' + rows + '</tbody>';
  const sel = $('curveSkill');
  sel.innerHTML = '<option value="all">Toutes les compétences</option>' + Object.entries(SKILLS).map(([k, sk]) => `<option value="${k}">${sk.name}</option>`).join('');
  sel.value = curveSkill;
  const tabs = $('curveRange'); tabs.innerHTML = '';
  CURVE_RANGES.forEach(([v, label]) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.setAttribute('aria-pressed', v === curveRange);
    b.onclick = () => { curveRange = v; renderStats(); };
    tabs.appendChild(b);
  });
  requestAnimationFrame(drawCurve);
}
$('curveSkill').onchange = e => { curveSkill = e.target.value; renderStats(); };
// La courbe : le niveau de 1 à 10 en hauteur, les jours en largeur. Seules les compétences déjà jouées sont tracées.
function drawCurve() {
  const cv2 = $('curve'), w = cv2.clientWidth || 600, h = cv2.clientHeight || 240, r = Math.min(2, window.devicePixelRatio || 1);
  cv2.width = Math.round(w * r); cv2.height = Math.round(h * r);
  const c = cv2.getContext('2d'); c.setTransform(r, 0, 0, r, 0, 0); c.clearRect(0, 0, w, h);
  const days = curveDays(curveRange), L0 = 30, R0 = 12, T0 = 12, B0 = 26;
  const X = i => L0 + (w - L0 - R0) * i / (days.length - 1), Y = v => T0 + (h - T0 - B0) * (MAX_LVL - v) / (MAX_LVL - 1);
  c.font = '700 12px Andika, sans-serif'; c.fillStyle = '#4b5d50'; c.textAlign = 'right'; c.textBaseline = 'middle';
  for (let v = 1; v <= MAX_LVL; v++) {
    c.strokeStyle = v === 1 || v === MAX_LVL || v === 5 ? '#d8cfb8' : '#efe8d6'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(L0, Y(v)); c.lineTo(w - R0, Y(v)); c.stroke();
    if (v === 1 || v % 3 === 1 || v === MAX_LVL) c.fillText(v, L0 - 8, Y(v));
  }
  c.textAlign = 'center'; c.textBaseline = 'top';
  const step = Math.max(1, Math.ceil(days.length / Math.max(2, Math.floor((w - L0) / 70))));
  days.forEach((d, i) => { if ((days.length - 1 - i) % step === 0) c.fillText(i === days.length - 1 ? "auj." : `${d.slice(8, 10)}/${d.slice(5, 7)}`, X(i), h - B0 + 8); });
  const keys = (curveSkill === 'all' ? Object.keys(SKILLS) : [curveSkill]).map(k => [k, levelSeries(k, days)]).filter(([, ser]) => ser.some(v => v !== null));
  const one = keys.length === 1;
  keys.forEach(([k, ser]) => {
    c.strokeStyle = c.fillStyle = CURVE_COLORS[k]; c.lineWidth = one ? 4 : 2.5; c.lineJoin = 'round'; c.beginPath();
    let on = false;
    ser.forEach((v, i) => { if (v === null) { on = false; return; } c[on ? 'lineTo' : 'moveTo'](X(i), Y(v)); on = true; });
    c.stroke();
    if (one || days.length <= 31) ser.forEach((v, i) => { const d = days[i]; if (v !== null && prog.stats[d] && prog.stats[d][k]) { c.beginPath(); c.arc(X(i), Y(v), one ? 4.5 : 3, 0, Math.PI * 2); c.fill(); } });
  });
  if (!keys.length) { c.fillStyle = '#4b5d50'; c.font = '700 16px Andika, sans-serif'; c.textBaseline = 'middle'; c.fillText('Pas encore d’énigme sur cette période.', (L0 + w - R0) / 2, (T0 + h - B0) / 2); }
  const label = keys.length ? keys.map(([k, ser]) => `${SKILLS[k].name} : niveau ${ser[ser.length - 1]}`).join(', ') : 'aucune donnée';
  cv2.setAttribute('aria-label', `Courbe du niveau sur ${CURVE_RANGES.find(x => x[0] === curveRange)[1]}. ${label}.`);
  $('curveLegend').innerHTML = keys.map(([k]) => `<span><i style="background:${CURVE_COLORS[k]}"></i>${SKILLS[k].name}</span>`).join('');
}
window.addEventListener('resize', () => { if (!$('parents').hidden) drawCurve(); });
function renderSkills() {
  const el = $('skillList'); el.innerHTML = '';
  Object.entries(SKILLS).forEach(([k, sk]) => {
    const v = prog.skills[k].lvl, row = document.createElement('div'); row.className = 'skill';
    row.innerHTML = `<span class="nm">${sk.name}</span><span class="bar" aria-hidden="true"><i style="width:${v * 10}%"></i></span><b aria-label="Niveau ${v} sur 10">${v}</b>`;
    [['−', -1, 'Baisser'], ['+', 1, 'Monter']].forEach(([t, d, verb]) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.setAttribute('aria-label', `${verb} le niveau : ${sk.name}`);
      b.disabled = d < 0 ? v <= 1 : v >= MAX_LVL;
      b.onclick = () => { const s2 = prog.skills[k]; s2.lvl = clamp(s2.lvl + d, 1, MAX_LVL); s2.ok = s2.bad = 0; save(); renderParents(); };
      row.appendChild(b);
    });
    el.appendChild(row);
  });
}
$('calcForm').onsubmit = e => {
  e.preventDefault();
  const bad = [];
  $('calcIn').value.split(/[,;]+/).map(s => s.trim()).filter(Boolean).forEach(s => {
    const c = parseCalc(s);
    if (!c) bad.push(s); else if (!custom.calcs.includes(c.key)) custom.calcs.push(c.key);
  });
  $('calcErr').textContent = bad.length ? `Pas compris : ${bad.join(', ')}. Écrivez par exemple 5x5, 12+8, 20-7 ou 18:3, avec un résultat entier.` : '';
  $('calcIn').value = bad.join(', ');
  saveCustom(); renderParents();
};
$('wordForm').onsubmit = e => {
  e.preventDefault();
  const bad = [];
  $('wordIn').value.split(/[\s,;]+/).filter(Boolean).forEach(s => {
    const w = s.toUpperCase();
    if (!WORD_RE.test(w)) bad.push(s); else if (!custom.words.includes(w)) custom.words.push(w);
  });
  $('wordErr').textContent = bad.length ? `Pas compris : ${bad.join(', ')}. Un mot, c'est seulement des lettres, de 2 à 12 lettres.` : '';
  $('wordIn').value = bad.join(' ');
  saveCustom(); renderParents();
};
/* Code de sauvegarde : la progression en base64, pour passer d'un appareil à l'autre.
   La voix, le son et les commandes sur téléphone restent ceux de l'appareil. */
const CODE_PREFIX = 'DINO2-';
// light : code court (DINO3-) pour le QR code de la Switch, voir exportShort.
function exportCode(light = false) {
  if (light) return exportShort();
  const { voice: _v, sound: _s, music: _m, touch: _t, ...data } = prog;
  return CODE_PREFIX + btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(data))));
}
/* Code court DINO3- : une centaine de caractères, pour un QR code facile à lire.
   Sans les statistiques ni l'endroit en cours. Des champs séparés par des points, toujours dans le même ordre :
   animal, niveau et difficulté ; temps ; pour chaque monde, endroits ouverts puis un caractère par endroit
   (œufs, étoiles, médaille) ; niveau de chaque compétence ; trésors ; fossiles ; couleurs achetées ;
   couleur choisie ; pouvoirs ; clés et morceaux de carte ; accessoires achetés ; accessoire porté ; nom. */
const SHORT_PREFIX = 'DINO3-', B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const bitsTo64 = bits => { let o = ''; for (let i = 0; i < bits.length; i += 6) o += B64[parseInt(bits.slice(i, i + 6).padEnd(6, '0'), 2)]; return o; };
const bitsFrom64 = (str, n) => [...str].map(ch => Math.max(0, B64.indexOf(ch)).toString(2).padStart(6, '0')).join('').padEnd(n, '0').slice(0, n);
const DIFFS = ['petit', 'grand', 'expert'], WORLD_KEYS = () => Object.keys(WORLDS);
const fossilKeys = () => WORLD_KEYS().flatMap(k => WORLDS[k].map((d, i) => `${k}-${i}`));
function exportShort(p = prog, name = slots.names[slots.cur]) {
  const b = p.bag, f = [];
  f.push([Math.max(0, [...ORDER, 'final'].indexOf(p.world)), DIFFS.indexOf(p.diff), p.hard].join(''));
  f.push(p.time.toString(36));
  WORLD_KEYS().forEach(k => { const w = p.worlds[k]; f.push(w.unlocked.toString(36) + w.eggs.map((e, i) => B64[e * 16 + w.stars[i] * 4 + w.medals[i]]).join('')); });
  f.push(Object.keys(SKILLS).map(k => p.skills[k].lvl.toString(36)).join(''));
  f.push(b.n.toString(36));
  f.push(bitsTo64(fossilKeys().map(k => b.fossils[k] ? 1 : 0).join('')));
  f.push(bitsTo64(ORDER.flatMap(w => SKINS[w].map(x => b.owned[`${w}:${x.id}`] ? 1 : 0)).join('')));
  f.push(ORDER.map(w => Math.max(0, ['base', ...SKINS[w].map(x => x.id)].indexOf(b.skin[w]))).join(''));
  f.push(Object.keys(POWERS).map(k => B64[Math.min(63, b.power[k])]).join(''));
  f.push(bitsTo64(ORDER.map(w => b.keys[w] ? 1 : 0).join('') + ORDER.map(w => b.maps[w] ? 1 : 0).join('')));
  f.push(bitsTo64(ACCESSORIES.map(a => b.accOwned[a.id] ? 1 : 0).join('')));
  f.push(ORDER.map(w => Math.max(0, ['', ...ACCESSORIES.map(a => a.id)].indexOf(b.acc[w] || ''))).join(''));
  f.push(encodeURIComponent(name || ''));
  return SHORT_PREFIX + f.join('.');
}
// Relit un code court ; cleanProg vérifie ensuite chaque valeur.
function decodeShort(c) {
  const f = c.slice(SHORT_PREFIX.length).split('.'), wk = WORLD_KEYS();
  if (f.length < 12 + wk.length) return null;   // 2 + un par monde + 10
  let i = 0; const nx = () => f[i++] || '';
  const h = nx(), p = { version: SAVE_VERSION, world: [...ORDER, 'final'][+h[0]] || 'rex', diff: DIFFS[+h[1]] || 'petit', hard: +h[2] || 0, time: parseInt(nx(), 36) || 0, worlds: {}, skills: {}, run: null };
  wk.forEach(k => {
    const t = nx(), v = [...t.slice(1)].map(ch => Math.max(0, B64.indexOf(ch)));
    p.worlds[k] = { unlocked: parseInt(t[0], 36) || 1, eggs: v.map(x => x >> 4), stars: v.map(x => (x >> 2) & 3), medals: v.map(x => x & 3) };
  });
  const sk = nx(); Object.keys(SKILLS).forEach((k, j) => { p.skills[k] = { lvl: parseInt(sk[j], 36) || 1 }; });
  const b = p.bag = { n: parseInt(nx(), 36) || 0, fossils: {}, owned: {}, skin: {}, power: {}, keys: {}, maps: {}, accOwned: {}, acc: {} };
  const fk = fossilKeys(), fb = bitsFrom64(nx(), fk.length); fk.forEach((k, j) => { if (fb[j] === '1') b.fossils[k] = true; });
  const sks = ORDER.flatMap(w => SKINS[w].map(x => `${w}:${x.id}`)), ob = bitsFrom64(nx(), sks.length); sks.forEach((k, j) => { if (ob[j] === '1') b.owned[k] = true; });
  const sc = nx(); ORDER.forEach((w, j) => { b.skin[w] = ['base', ...SKINS[w].map(x => x.id)][+sc[j]] || 'base'; });
  const pw = nx(); Object.keys(POWERS).forEach((k, j) => { b.power[k] = Math.max(0, B64.indexOf(pw[j] || 'A')); });
  const km = bitsFrom64(nx(), ORDER.length * 2); ORDER.forEach((w, j) => { if (km[j] === '1') b.keys[w] = true; if (km[ORDER.length + j] === '1') b.maps[w] = true; });
  const ab = bitsFrom64(nx(), ACCESSORIES.length); ACCESSORIES.forEach((a, j) => { if (ab[j] === '1') b.accOwned[a.id] = true; });
  const ac = nx(); ORDER.forEach((w, j) => { b.acc[w] = ['', ...ACCESSORIES.map(a => a.id)][+ac[j]] || ''; });
  let name = f.slice(i).join('.'); try { name = decodeURIComponent(name); } catch (e) {}
  p.name = name;
  return p;
}
// Lit un code de sauvegarde (complet DINO2- ou court DINO3-) : la partie, ou null s'il n'est pas valide.
function decodeCode(code) {
  const c = String(code || '').replace(/\s+/g, '');
  if (c.startsWith(SHORT_PREFIX)) { try { return decodeShort(c); } catch (e) { return null; } }
  if (!c.startsWith(CODE_PREFIX)) return null;
  try {
    const bytes = Uint8Array.from(atob(c.slice(CODE_PREFIX.length)), ch => ch.charCodeAt(0));
    const s = JSON.parse(new TextDecoder().decode(bytes));
    return s && typeof s === 'object' && s.worlds ? s : null;
  } catch (e) { return null; }
}
function importCode(code) {
  const s = decodeCode(code);
  if (!s) return false;
  prog = cleanProg({ ...s, ...devicePrefs() }); applySkins(); save();
  return true;
}
// Une partie arrive de la Switch : le QR code ouvre ce jeu avec le code après le # de l'adresse.
let incoming = null;
// (la Switch n'a pas d'adresse : globalThis.location peut manquer)
if (typeof location !== 'undefined' && typeof location.hash === 'string' && /^#DINO[23]-/.test(location.hash)) {
  incoming = decodeCode(location.hash.slice(1));
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
}
// La Switch attend une partie (QR code « Recevoir du téléphone ») : son adresse sur le Wi-Fi de la maison.
let sendTo = null;
if (typeof location !== 'undefined' && typeof location.hash === 'string') {
  const m = location.hash.match(/^#SEND-(\d{1,3}(?:\.\d{1,3}){3}):(\d{2,5})$/);
  if (m) { sendTo = m[1] + ':' + m[2]; try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} }
}
// Envoyer la partie n : on ouvre la petite page de la Switch avec le code après le # ; elle le lui transmet.
function switchUrl(n) {
  const p = n === slots.cur ? prog : cleanProg(readSlot(n));
  return `http://${sendTo}/#${exportShort(p, slots.names[n])}`;
}
function sendToSwitch(n) { location.href = switchUrl(n); }
// Mettre la partie de la Switch dans une place (vide, ou à la place d'une partie, après confirmation)
function slotImport(n, s) {
  if (slots.names[slots.cur]) save();
  slots.cur = n; slots.names[n] = String(s.name || '').trim().slice(0, 16) || 'Switch'; writeSlots();
  prog = cleanProg({ ...s, ...devicePrefs() }); applySkins(); save();
}
$('saveCopy').onclick = () => {
  const done = () => { $('loadOk').textContent = 'Code copié.'; $('loadOk').hidden = false; };
  $('saveCode').select();
  if (navigator.clipboard) navigator.clipboard.writeText($('saveCode').value).then(done, () => { try { document.execCommand('copy'); done(); } catch (e) {} });
  else { try { document.execCommand('copy'); done(); } catch (e) {} }
};
$('loadForm').onsubmit = e => {
  e.preventDefault();
  const v = $('loadIn').value.trim(); if (!v) return;
  const ok = importCode(v);
  $('loadErr').textContent = ok ? '' : "Ce code n'est pas valide. Vérifiez qu'il commence par DINO2- et qu'il est complet.";
  $('loadOk').textContent = 'Progression chargée.'; $('loadOk').hidden = !ok;
  if (ok) { $('loadIn').value = ''; renderParents(); }
};
let gateAns = 0;
$('parentsBtn').onclick = () => {
  const a = rand(6, 9), b = rand(6, 9); gateAns = a * b;
  $('gateQ').textContent = `Pour entrer, répondez : combien font ${a} × ${b} ?`;
  $('gateIn').value = ''; $('gateErr').textContent = '';
  $('gate').hidden = false; $('gateIn').focus();
};
$('gateForm').onsubmit = e => {
  e.preventDefault();
  if (+$('gateIn').value === gateAns) { $('gate').hidden = true; $('loadErr').textContent = ''; $('loadOk').hidden = true; renderParents(); $('parents').hidden = false; }
  else $('gateErr').textContent = "Ce n'est pas la bonne réponse.";
};
$('gateBack').onclick = () => { $('gate').hidden = true; };
$('parentsClose').onclick = () => { $('parents').hidden = true; renderMenu(); };
$('resetStats').onclick = () => {
  const b = $('resetStats');
  if (b.dataset.sure !== '1') { b.dataset.sure = '1'; b.textContent = 'Oui, tout remettre à zéro'; return; }
  delete b.dataset.sure; b.textContent = 'Remettre à zéro';
  resetStats(); renderParents();
  $('resetOk').textContent = 'Statistiques remises à zéro.'; $('resetOk').hidden = false;
};

