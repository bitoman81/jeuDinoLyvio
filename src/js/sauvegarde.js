/* ---------- Outils ---------- */
const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const srand = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = (v, n) => ((v % n) + n) % n;
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* ---------- Compétences ----------
   Chaque compétence a son niveau, de 1 à 10. Le niveau choisi dans le menu donne le point de départ. */
const SKILLS = {
  count: { name: 'Compter', up: 'pour compter' },
  add: { name: 'Additions', up: 'en additions' },
  sub: { name: 'Soustractions', up: 'en soustractions' },
  mult: { name: 'Multiplications', up: 'en multiplications' },
  compare: { name: 'Comparer', up: 'pour comparer' },
  suite: { name: 'Suites de couleurs', up: 'avec les suites de couleurs' },
  lettres: { name: 'Lettres', up: 'avec les lettres' },
  mots: { name: 'Écrire les mots', up: 'pour écrire les mots' },
  lire: { name: 'Lire des mots', up: 'pour lire' },
  heure: { name: "Lire l'heure", up: "pour lire l'heure" },
  logique: { name: 'Logique et jeux', up: 'en logique' },
};
const SKILL_START = { petit: 1, grand: 4, expert: 7 }, MAX_LVL = 10;
const TYPE_SKILL = { count: 'count', add: 'add', sub: 'sub', mult: 'mult', compare: 'compare', sequence: 'suite', first: 'lettres', missing: 'lettres', hangman: 'mots', order: 'mots',
  numseq: 'suite', parity: 'count', coins: 'add', clock: 'heure', intrus: 'logique', wordpic: 'lire',
  maze: 'logique', slide: 'logique', memory: 'logique', sudoku: 'logique', ombres: 'logique', dots: 'count', pieces: 'logique', symetrie: 'logique' };
// Le nom de chaque énigme pour le résumé de la semaine (parents : les calculs et les mots des parents).
const TYPE_NAMES = { count: 'Compter les œufs', add: 'Additions', sub: 'Soustractions', mult: 'Multiplications', compare: 'Plus ou moins',
  sequence: 'Suites de couleurs', first: 'Première lettre', missing: 'Lettre qui manque', hangman: 'Écrire un mot', order: "Lettres dans l'ordre",
  numseq: 'Suites de nombres', parity: 'Pair ou impair', coins: 'Compter les pièces', clock: "Lire l'heure", intrus: "Trouver l'intrus", wordpic: 'Lire un mot',
  maze: 'Labyrinthe', slide: 'Taquin', memory: 'Jeu de mémoire', sudoku: 'Sudoku', ombres: 'Les ombres', dots: 'Relier les points', pieces: 'Puzzle',
  symetrie: 'Miroir', parents: 'Vos calculs et vos mots' };

/* ---------- Sauvegarde ----------
   v2 ajoute la partie en cours (prog.run) pour reprendre là où on s'est arrêté.
   On lit la v1 si la v2 n'existe pas encore, sans l'effacer. */
const KEY = 'dino-explorateur-v2', KEY_V1 = 'dino-explorateur-v1', SAVE_VERSION = 2;
const isInt = v => Number.isInteger(v);
function cleanRun(r) {
  if (!r || !WORLDS[r.world] || !isInt(r.i) || !WORLDS[r.world][r.i]) return null;
  const nums = a => Array.isArray(a) ? a.filter(isInt) : [];
  const num = v => typeof v === 'number' && isFinite(v) ? v : null;
  return {
    world: r.world, i: r.i, gates: nums(r.gates).filter(k => k >= 0 && k < 3), taken: nums(r.taken),
    broken: Array.isArray(r.broken) ? r.broken.filter(b => Array.isArray(b) && isInt(b[0]) && isInt(b[1])) : [],
    fruit: Math.max(0, num(r.fruit) || 0), x: num(r.x), y: num(r.y), cam: num(r.cam),
    stars: [0, 1, 2].map(k => Array.isArray(r.stars) && isInt(r.stars[k]) ? clamp(r.stars[k], 0, 3) : 0),
    magnet: r.magnet === true, shield: r.shield === true, sw: nums(r.sw),
    // Pouvoirs de l'endroit (une ancienne partie n'a que l'aimant et le bouclier)
    pows: Array.isArray(r.pows) ? r.pows.filter(k => POWERS[k]) : ['magnet', 'shield'].filter(k => r[k] === true),
    hard: isInt(r.hard) ? clamp(r.hard, 0, 2) : 0,
  };
}
function cleanProg(s) {
  const p = { version: SAVE_VERSION, world: 'rex', diff: 'petit', sound: true, music: true, voice: '', touch: 'stick', worlds: {}, skills: {}, stats: {}, bag: null, run: null, savedAt: 0 };
  if (s && typeof s === 'object') {
    if (s.eggs && !s.worlds) s.worlds = { rex: { unlocked: s.unlocked || 1, eggs: s.eggs } };
    ['world', 'diff', 'voice', 'savedAt'].forEach(k => { if (s[k] !== undefined) p[k] = s[k]; });
    if (typeof s.sound === 'boolean') p.sound = s.sound;
    if (typeof s.music === 'boolean') p.music = s.music;
    if (s.touch === 'tap') p.touch = 'tap';
    if (s.worlds && typeof s.worlds === 'object') p.worlds = s.worlds;
    if (s.skills && typeof s.skills === 'object') p.skills = s.skills;
    p.run = cleanRun(s.run);
    // Statistiques : 400 jours au plus, compétences connues seulement.
    if (s.stats && typeof s.stats === 'object') Object.keys(s.stats).filter(d => /^\d{4}-\d\d-\d\d$/.test(d)).sort().slice(-400).forEach(d => {
      const day = {};
      const sd = s.stats[d] || {}, ok4 = r => Array.isArray(r) && r.length === 4 && r.every(v => isInt(v) && v >= 0);
      Object.keys(SKILLS).forEach(k => { const r = sd[k]; if (ok4(r)) day[k] = [r[0], Math.min(r[1], r[0]), r[2], clamp(r[3], 1, MAX_LVL)]; });
      // Par type d'énigme : [réussies, dont du premier coup, erreurs, abandons] ; et le temps de jeu du jour en secondes.
      if (sd.types && typeof sd.types === 'object') {
        const t = {};
        Object.keys(TYPE_NAMES).forEach(k => { const r = sd.types[k]; if (ok4(r)) t[k] = [r[0], Math.min(r[1], r[0]), r[2], r[3]]; });
        if (Object.keys(t).length) day.types = t;
      }
      if (isInt(sd.sec) && sd.sec > 0) day.sec = Math.min(sd.sec, 86400);
      if (Object.keys(day).length) p.stats[d] = day;
    });
  }
  Object.keys(WORLDS).forEach(k => {
    const n = WORLDS[k].length, w = p.worlds[k] || {};
    const eggs = Array.from({ length: n }, (_, i) => clamp((w.eggs && w.eggs[i]) || 0, 0, 3));
    // Un endroit terminé ouvre le suivant, même s'il a été ajouté après la sauvegarde.
    const done = eggs.reduce((a, e, i) => e === 3 && !WORLDS[k][i].bonus ? i + 2 : a, 1);
    p.worlds[k] = {
      unlocked: clamp(Math.max(w.unlocked || 1, done), 1, regularCount(k)),
      eggs,
      stars: Array.from({ length: n }, (_, i) => clamp(+(w.stars && w.stars[i]) || 0, 0, 3)),
      // Médailles : 1 bronze (Simple), 2 argent (Normal), 3 or (Compliqué). Un endroit fini avant les médailles compte en Simple.
      medals: Array.from({ length: n }, (_, i) => Array.isArray(w.medals) ? clamp(+w.medals[i] || 0, 0, 3) : eggs[i] === 3 ? 1 : 0),
    };
  });
  if (!WORLDS[p.world]) p.world = 'rex';
  if (!['petit', 'grand', 'expert'].includes(p.diff)) p.diff = 'petit';
  Object.keys(SKILLS).forEach(k => {
    const sk = p.skills[k] || {};
    p.skills[k] = { lvl: isInt(sk.lvl) ? clamp(sk.lvl, 1, MAX_LVL) : SKILL_START[p.diff], ok: isInt(sk.ok) ? clamp(sk.ok, 0, 2) : 0, bad: isInt(sk.bad) ? clamp(sk.bad, 0, 1) : 0 };
  });
  if (typeof p.voice !== 'string') p.voice = '';
  if (!isInt(p.savedAt)) p.savedAt = 0;
  // Temps de jeu en secondes (dans les endroits et les énigmes)
  p.time = s && isInt(s.time) && s.time >= 0 ? s.time : 0;
  // Difficulté des endroits choisie dans le menu (0 Simple, 1 Normal, 2 Compliqué)
  p.hard = s && isInt(s.hard) ? clamp(s.hard, 0, 2) : 0;
  // Le sac : trésors, fossiles trouvés, couleurs achetées et choisies, pouvoirs en réserve.
  const b = s && s.bag && typeof s.bag === 'object' ? s.bag : {};
  p.bag = { n: isInt(b.n) && b.n >= 0 ? b.n : 0, fossils: {}, owned: {}, skin: {}, power: {}, keys: {}, maps: {} };
  // Clé dorée et morceau de carte : un de chaque par animal.
  ORDER.forEach(w => ['keys', 'maps'].forEach(k => { if (b[k] && b[k][w] === true) p.bag[k][w] = true; }));
  if (b.fossils && typeof b.fossils === 'object') Object.keys(b.fossils).forEach(k => { const [w, i] = k.split('-'); if (b.fossils[k] === true && WORLDS[w] && WORLDS[w][+i]) p.bag.fossils[k] = true; });
  if (b.owned && typeof b.owned === 'object') Object.keys(b.owned).forEach(k => { const [w, id] = k.split(':'); if (b.owned[k] === true && SKINS[w] && SKINS[w].some(x => x.id === id)) p.bag.owned[k] = true; });
  ORDER.forEach(w => { const id = b.skin && b.skin[w]; p.bag.skin[w] = id && p.bag.owned[`${w}:${id}`] ? id : 'base'; });
  Object.keys(POWERS).forEach(k => { const v = b.power && b.power[k]; p.bag.power[k] = isInt(v) ? clamp(v, 0, 99) : 0; });
  p.bag.accOwned = {}; p.bag.acc = {};
  ACCESSORIES.forEach(a => { if (b.accOwned && b.accOwned[a.id] === true) p.bag.accOwned[a.id] = true; });
  ORDER.forEach(w => { const id = b.acc && b.acc[w]; p.bag.acc[w] = id && p.bag.accOwned[id] ? id : ''; });
  return p;
}
/* ---------- Les parties : 3 au plus, chacune avec son nom ----------
   La liste (partie choisie, noms) est dans SLOTS_KEY ; chaque partie dans SLOT_KEY(n).
   Une ancienne sauvegarde (v2 ou v1) devient la partie 1, sans être effacée.
   Le son, la voix et les commandes sur téléphone restent ceux de l'appareil. */
const SLOTS_KEY = 'dino-explorateur-parties', SLOT_MAX = 3, SLOT_KEY = n => `dino-explorateur-partie${n + 1}`;
let slots = { cur: 0, names: ['', '', ''] };
try {
  const s = JSON.parse(localStorage.getItem(SLOTS_KEY));
  if (s && Array.isArray(s.names)) slots = { cur: isInt(s.cur) ? clamp(s.cur, 0, SLOT_MAX - 1) : 0, names: [0, 1, 2].map(i => typeof s.names[i] === 'string' ? s.names[i].slice(0, 16) : '') };
  else {
    const old = localStorage.getItem(KEY) || localStorage.getItem(KEY_V1);
    if (old) { localStorage.setItem(SLOT_KEY(0), old); slots.names[0] = 'Partie 1'; localStorage.setItem(SLOTS_KEY, JSON.stringify(slots)); }
  }
} catch (e) {}
function writeSlots() { try { localStorage.setItem(SLOTS_KEY, JSON.stringify(slots)); } catch (e) {} }
function readSlot(n) { try { return JSON.parse(localStorage.getItem(SLOT_KEY(n))); } catch (e) { return null; } }
const devicePrefs = () => ({ voice: prog.voice, sound: prog.sound, music: prog.music, touch: prog.touch });
let prog;
prog = cleanProg(slots.names[slots.cur] ? readSlot(slots.cur) : null);
applySkins();
// Sans nom (première partie jamais nommée), la partie prend le nom « Partie N » à sa première sauvegarde.
function save() {
  prog.savedAt = Date.now();
  if (!slots.names[slots.cur]) { slots.names[slots.cur] = `Partie ${slots.cur + 1}`; writeSlots(); }
  try { localStorage.setItem(SLOT_KEY(slots.cur), JSON.stringify(prog)); } catch (e) {}
}
// Résumé d'une partie pour l'écran des parties : null si la place est libre.
function slotSummary(n) {
  if (!slots.names[n]) return null;
  const p = n === slots.cur ? prog : cleanProg(readSlot(n));
  let eggs = 0, eggsMax = 0;
  Object.keys(WORLDS).forEach(k => { eggsMax += WORLDS[k].length * 3; eggs += p.worlds[k].eggs.reduce((a, e) => a + e, 0); });
  const m = Math.floor(p.time / 60), d = p.savedAt ? new Date(p.savedAt) : null;
  return {
    name: slots.names[n], cur: n === slots.cur, eggs, eggsMax, treasures: p.bag.n, fossils: Object.keys(p.bag.fossils).length,
    animal: p.world === 'final' ? "L'île secrète" : SPECIES[p.world].name,
    time: m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`,
    date: d ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` : '',
  };
}
// Jouer une partie existante, en commencer une nouvelle, en effacer une.
function slotPlay(n) {
  if (!slots.names[n]) return;
  if (n !== slots.cur) { save(); slots.cur = n; writeSlots(); prog = cleanProg({ ...readSlot(n), ...devicePrefs() }); applySkins(); }
}
function slotNew(n, name) {
  if (slots.names[slots.cur]) save();
  slots.cur = n; slots.names[n] = String(name || '').trim().slice(0, 16) || `Partie ${n + 1}`; writeSlots();
  prog = cleanProg(devicePrefs()); applySkins(); save();
}
function slotErase(n) {
  try { localStorage.removeItem(SLOT_KEY(n)); } catch (e) {}
  slots.names[n] = '';
  if (n === slots.cur) {
    const other = slots.names.findIndex(x => x);
    if (other >= 0) { slots.cur = other; prog = cleanProg({ ...readSlot(other), ...devicePrefs() }); }
    else prog = cleanProg(devicePrefs());
    applySkins();
  }
  writeSlots();
}
// Remettre à zéro les statistiques de la partie (et le niveau de chaque compétence), sans toucher aux œufs ni au sac.
function resetStats() {
  prog.stats = {};
  Object.values(prog.skills).forEach(sk => { sk.lvl = SKILL_START[prog.diff]; sk.ok = sk.bad = 0; });
  save();
}

