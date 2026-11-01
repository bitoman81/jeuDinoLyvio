/* ---------- Énigmes ---------- */
const pz = { card: $('pzCard'), title: $('pzTitle'), visual: $('pzVisual'), choices: $('pzChoices') };
let currentGate = null, currentSay = '', pzLocked = false;
const BRAVO = ['Bravo !', 'Super !', 'Génial !', 'Bien joué !', 'Formidable !'];
const isExpert = () => prog.diff === 'expert';
const lv = k => prog.skills[k].lvl;
// Paliers par niveau de compétence (index 0 = niveau 1). Petit démarre au niveau 1, Grand au 4, Expert au 7.
const TIER = {
  countMax: [5, 6, 8, 10, 12, 14, 16, 18, 20, 20],
  add: [[1, 3, 1, 2], [1, 4, 1, 3], [2, 5, 1, 3], [2, 6, 1, 4], [3, 8, 2, 5], [4, 10, 2, 7], [6, 15, 3, 10], [8, 20, 5, 12], [10, 30, 5, 20], [15, 50, 10, 30]],
  subMax: [5, 6, 8, 10, 12, 15, 20, 30, 50, 100],
  multMax: [3, 4, 5, 6, 7, 8, 10, 10, 10, 10],
  cmpMax: [5, 6, 8, 10, 12, 15, 20, 30, 50, 100],
};
const tier = (key, k) => TIER[key][k - 1];
const nChoices = k => k <= 3 ? 3 : 4;
let pzType = null, pzErrs = 0, pzSkill = null, pzStars = 0, pzKey = null, pzId = 0;
// Énigmes de jeu : les étoiles viennent du nombre de coups (ou des erreurs), calculé par l'énigme.
function gameDone(errs, win) { pzErrs = errs; solved(win); }
window.addEventListener('keydown', e => { if (state === 'puzzle' && pzKey && !pzLocked && !pzWaiting() && pzKey(e.code)) e.preventDefault(); });
// Un sac de mots par palier : un mot ne revient pas avant que tous les autres soient sortis.
// Niveaux 1 à 3 : mots courts ; 4 à 6 : jusqu'à 6 lettres ; 7 et plus : tous les mots.
const wordBags = {};
function pickWord(k = lv('mots')) {
  const key = k <= 3 ? 1 : k <= 6 ? 2 : 3;
  if (!wordBags[key] || !wordBags[key].length) wordBags[key] = shuffle(key === 1 ? WORDS_PETIT : key === 2 ? WORDS_GRAND.filter(w => w.length <= 6) : WORDS_GRAND);
  return wordBags[key].pop();
}
function otherLetters(not, n) { return shuffle('ABCDEFGILMNOPRSTUV'.split('').filter(l => !not.includes(l))).slice(0, n); }
function numberChoices(ans, min, max, n = 3) {
  const set = new Set([ans]);
  for (const v of shuffle([ans - 1, ans + 1, ans - 2, ans + 2, ans - 3, ans + 3].filter(v => v >= min && v <= max))) { if (set.size >= n) break; set.add(v); }
  while (set.size < n) set.add(rand(min, max));
  return shuffle([...set]);
}
function confetti() {
  const cols = ['#ffb238', '#3f9a4f', '#e5483b', '#2f7fe0', '#b23a7a'];
  for (let i = 0; i < 24; i++) {
    const c = document.createElement('span'); c.className = 'confetti';
    c.style.left = (5 + Math.random() * 90) + '%'; c.style.background = pick(cols);
    c.style.animationDelay = (Math.random() * .3) + 's';
    pz.card.appendChild(c); setTimeout(() => c.remove(), 1700);
  }
}
/* Difficulté évolutive : 3 réussites du premier coup de suite font monter la compétence d'un cran,
   2 énigmes de suite avec au moins 2 erreurs la font descendre d'un cran (sans le dire). */
function learn(k, errs) {
  if (!k) return '';
  const s = prog.skills[k];
  if (errs === 0) {
    s.bad = 0;
    if (++s.ok >= 3) { s.ok = 0; if (s.lvl < MAX_LVL) { s.lvl++; return `Tu progresses ${SKILLS[k].up} !`; } }
    return '';
  }
  s.ok = 0;
  if (errs < 2) { s.bad = 0; return ''; }
  if (++s.bad >= 2) { s.bad = 0; if (s.lvl > 1) s.lvl--; }
  return '';
}
/* Statistiques pour les parents : un résumé par jour et par compétence,
   [énigmes réussies, dont du premier coup, erreurs, niveau en fin de journée]. */
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const statDay = () => prog.stats[today()] || (prog.stats[today()] = {});
function record(k, errs) {
  if (!k) return;
  const day = statDay(), r = day[k] || (day[k] = [0, 0, 0, 0]);
  r[0]++; if (!errs) r[1]++; r[2] += errs; r[3] = prog.skills[k].lvl;
}
// Par type d'énigme, pour retrouver les énigmes les plus ratées : réussie, ou abandonnée (quit).
function recordType(t, errs, quit) {
  if (!t || !TYPE_NAMES[t]) return;
  const day = statDay(), T = day.types || (day.types = {}), r = T[t] || (T[t] = [0, 0, 0, 0]);
  if (quit) r[3]++; else { r[0]++; if (!errs) r[1]++; }
  r[2] += errs;
}
function solved(extra = '') {
  pzLocked = true; SFX.yay(); confetti(); $('pzHelp').hidden = true;
  pzStars = pzErrs === 0 ? 3 : pzErrs === 1 ? 2 : 1;
  const up = learn(pzSkill, pzErrs);
  record(pzSkill, pzErrs); recordType(pzType, pzErrs, false); pzType = null;
  const st = document.createElement('div'); st.className = 'pz-stars'; st.innerHTML = starsHtml(pzStars);
  st.setAttribute('role', 'img'); st.setAttribute('aria-label', `${pzStars} étoile${pzStars > 1 ? 's' : ''} sur 3`);
  pz.choices.appendChild(st);
  say((extra ? extra + ' ' : '') + pick(BRAVO) + (up ? ' ' + up : ''));
  setTimeout(() => closePuzzle(true), up ? 2800 : 1600);
}
const OOPS = ['Presque ! Essaie encore.', 'Oups, essaie encore !', 'Regarde bien, tu vas trouver !'];
// Énigmes de mots : après une erreur, on redit le mot (les images ne suffisent pas toujours à un petit).
const sayWord = w => ` Le mot ${w.toLowerCase()}.`;
function oops(btn, errs, hintFn, msg) {
  pzErrs++; SFX.no(); btn.classList.add('bad'); btn.disabled = true;
  say(msg || pick(OOPS));
  if (hintFn) hintFn(errs);
}
/* Aide payée avec les trésors du sac : enlever une mauvaise réponse (2 étoiles au plus),
   ou montrer la bonne réponse (1 étoile, l'énigme compte comme difficile).
   Pour les mots (pzHelp.give) : donner une lettre, ou faire briller les lettres une à une. */
let pzHelp = null;
function renderHelp() {
  const c = pzHelp; $('pzHelp').hidden = !c || pzLocked;
  if (!c) return;
  const n = prog.bag.n, word = !!c.give, wrong = word ? [] : c.btns.filter(b => !b.disabled && !c.good.includes(b));
  const [cut, hint] = c.labels || (word ? ['Donner une lettre', 'Montrer les lettres'] : ['Enlever une réponse', 'Montrer la réponse']);
  $('helpHint').innerHTML = `${hint} <span class="tre"></span> ${HELP_HINT}`;
  $('helpHint').disabled = n < HELP_HINT || c.hinted;
  $('helpHint').setAttribute('aria-label', `${hint}, ${HELP_HINT} trésors`);
  $('helpCut').innerHTML = `${cut} <span class="tre"></span> ${HELP_CUT}`;
  $('helpCut').disabled = n < HELP_CUT || c.hinted || (word ? c.left() < 2 : wrong.length < 2);
  $('helpCut').setAttribute('aria-label', `${cut}, ${HELP_CUT} trésors`);
}
$('helpHint').onclick = () => {
  const c = pzHelp; if (!c || pzLocked || c.hinted || prog.bag.n < HELP_HINT) return;
  prog.bag.n -= HELP_HINT; c.hinted = true; pzErrs = Math.max(pzErrs, 2);
  if (c.give) { c.glow(); say(c.glowSay || 'Appuie sur la lettre qui brille !'); }
  else { c.good.forEach(g => g.classList.add('hint')); say('Regarde la réponse qui brille !'); }
  SFX.key(); save(); renderHelp();
};
$('helpCut').onclick = () => {
  const c = pzHelp; if (!c || pzLocked || prog.bag.n < HELP_CUT) return;
  if (c.give) {
    if (c.left() < 2) return;
    prog.bag.n -= HELP_CUT; pzErrs = Math.max(pzErrs, 1); c.give(); save(); renderHelp(); return;
  }
  const wrong = c.btns.filter(b => !b.disabled && !c.good.includes(b)); if (wrong.length < 2) return;
  prog.bag.n -= HELP_CUT; pzErrs = Math.max(pzErrs, 1);
  const b = pick(wrong); b.disabled = true; b.classList.add('gone'); SFX.pop(); save(); renderHelp();
};
// Mots : toutes les 2 erreurs depuis la dernière bonne lettre, le jeu offre une lettre.
const FREE_LETTER = 2;
function choicePuzzle(o) {
  pz.title.textContent = o.title; pz.visual.innerHTML = o.visual; pz.choices.innerHTML = '';
  let errs = 0; const good = [], btns = [];
  pzHelp = { good, btns, hinted: false };
  o.choices.forEach(ch => {
    const b = document.createElement('button');
    b.className = 'choice'; b.innerHTML = ch.html;
    if (ch.label) b.setAttribute('aria-label', ch.label);
    if (ch.ok) good.push(b);
    b.onclick = () => {
      if (pzLocked || b.disabled) return;
      if (ch.ok) { b.classList.add('good'); solved(o.win); }
      else { errs++; oops(b, errs, n => { if (n >= 2) good.forEach(g => g.classList.add('hint')); }, o.again ? pick(OOPS) + o.again : undefined); renderHelp(); }
    };
    pz.choices.appendChild(b); btns.push(b);
  });
  renderHelp();
  currentSay = o.say; say(o.say);
}
const PUZZLES = {
  mult() {
    const k = lv('mult'), tables = custom.tables.length ? custom.tables : [2, 3, 4, 5, 10];
    const a = pick(tables), b = rand(1, tier('multMax', k)), ans = a * b, n = nChoices(k);
    const [x, y] = Math.random() < .5 ? [a, b] : [b, a];
    const set = new Set([ans]);
    for (const v of shuffle([a * (b + 1), a * (b - 1), (a + 1) * b, ans + 1, ans + 2, ans - 1])) { if (set.size >= n) break; if (v > 0) set.add(v); }
    for (let v = ans + 3; set.size < n; v++) set.add(v);
    // Petits produits : on montre x paquets de y œufs pour aider à compter.
    const visual = ans <= 24 && k <= 6 ? `<div class="group" style="max-width:520px">${Array.from({ length: x }, () => `<span class="grp">${Array(y).fill(EGG_SVG('mini')).join('')}</span>`).join('')}</div>` : '';
    choicePuzzle({
      title: `${x} × ${y} = ?`, say: `Combien font ${x} fois ${y} ?`, visual,
      choices: shuffle([...set]).map(v => ({ html: v, ok: v === ans })), win: `${x} fois ${y} égale ${ans} !`,
    });
  },
  sub() {
    const k = lv('sub'), max = tier('subMax', k), a = rand(Math.max(3, Math.ceil(max / 2)), max), b = rand(1, a - 1), s = a - b;
    // Aux premiers niveaux, on voit les œufs qui partent.
    const visual = k <= 4 ? `<div class="group" style="max-width:320px">${Array.from({ length: a }, (_, i) => EGG_SVG('mini' + (i >= s ? ' off' : ''))).join('')}</div>` : '';
    choicePuzzle({
      title: `${a} − ${b} = ?`, say: `Combien font ${a} moins ${b} ?`, visual,
      choices: numberChoices(s, 0, a, nChoices(k)).map(v => ({ html: v, ok: v === s })), win: `${a} moins ${b} égale ${s} !`,
    });
  },
  count() {
    const k = lv('count'), max = tier('countMax', k), n = rand(Math.max(1, max - 6), max);
    choicePuzzle({
      title: "Combien d'œufs ?", say: "Compte les œufs. Combien y en a-t-il ?",
      visual: `<div class="group" style="max-width:320px">${Array(n).fill(EGG_SVG('mini')).join('')}</div>`,
      choices: numberChoices(n, 1, max + 2, nChoices(k)).map(v => ({ html: v, ok: v === n })), win: `Il y a ${n} œufs !`,
    });
  },
  add() {
    const k = lv('add'), [a0, a1, b0, b1] = tier('add', k), a = rand(a0, a1), b = rand(b0, b1), s = a + b;
    choicePuzzle({
      title: `${a} + ${b} = ?`, say: `Combien font ${a} plus ${b} ?`,
      visual: k <= 5 ? `<div class="group">${Array(a).fill(BONE_SVG).join('')}</div><span>+</span><div class="group">${Array(b).fill(BONE_SVG).join('')}</div>` : '',
      choices: numberChoices(s, Math.max(1, s - 6), s + 6, nChoices(k)).map(v => ({ html: v, ok: v === s })), win: `${a} plus ${b} égale ${s} !`,
    });
  },
  compare() {
    const k = lv('compare'), max = tier('cmpMax', k), a = rand(1, max);
    let b; do { b = rand(1, max); } while (Math.abs(a - b) < (k <= 2 ? 2 : 1));
    const plus = Math.random() < .6, ans = plus ? Math.max(a, b) : Math.min(a, b), other = ans === a ? b : a;
    // Petits nombres : des tas de feuilles. Plus loin : les nombres écrits.
    if (max <= 12) {
      const g = n => `<div class="group" style="max-width:${k <= 2 ? 150 : 200}px">${Array(n).fill(LEAF_SVG).join('')}</div>`;
      choicePuzzle({
        title: plus ? 'Où y a-t-il le plus de feuilles ?' : 'Où y a-t-il le moins de feuilles ?',
        say: plus ? "Touche le tas où il y a le plus de feuilles." : "Touche le tas où il y a le moins de feuilles.",
        visual: '',
        choices: [a, b].map(n => ({ html: g(n), ok: n === ans, label: n + ' feuilles' })),
      });
      return;
    }
    choicePuzzle({
      title: plus ? 'Quel nombre est le plus grand ?' : 'Quel nombre est le plus petit ?',
      say: plus ? 'Touche le nombre le plus grand.' : 'Touche le nombre le plus petit.',
      visual: '',
      choices: [a, b].map(n => ({ html: n, ok: n === ans })),
      win: `${ans} est plus ${plus ? 'grand' : 'petit'} que ${other} !`,
    });
  },
  sequence() {
    const k = lv('suite'), [A, B, C, D] = shuffle(COLORS);
    const pats = k <= 2 ? [[A, B]] : k <= 5 ? [[A, B, C], [A, A, B]] : k <= 7 ? [[A, B, C], [A, A, B], [A, B, B]] : [[A, B, C, D], [A, A, B, B], [A, B, B, C]];
    const pat = pick(pats), len = k <= 2 ? 5 : pat.length * 2 + (k === 6 || k === 7 ? 1 : 0);
    const seq = Array.from({ length: len }, (_, i) => pat[i % pat.length]);
    const ans = pat[len % pat.length];
    const opts = shuffle([ans, ...shuffle(COLORS.filter(c => c !== ans)).slice(0, (k <= 5 ? 3 : 4) - 1)]);
    choicePuzzle({
      title: 'Quelle couleur vient après ?', say: 'Regarde les couleurs. Quelle couleur vient après ?',
      visual: seq.map(c => `<span class="dot" style="background:${c.c}"></span>`).join('') + '<span class="dot q">?</span>',
      choices: opts.map(c => ({ html: `<span class="dot" style="background:${c.c}"></span><small>${c.n}</small>`, ok: c === ans, label: c.n })),
      win: `C'est ${ans.n} !`,
    });
  },
  first(w = pickWord(lv('lettres'))) {
    const k = lv('lettres'), l = w[0], n = k <= 4 ? 3 : k <= 7 ? 4 : 5;
    choicePuzzle({
      title: 'Par quelle lettre ça commence ?', say: `Par quelle lettre commence le mot ${w.toLowerCase()} ?`,
      visual: pic(w),
      choices: shuffle([l, ...otherLetters(w, n - 1)]).map(v => ({ html: v, ok: v === l })), win: `${w.toLowerCase()} commence par ${letterName(l)} !`, again: sayWord(w),
    });
  },
  missing(w = pickWord(lv('lettres'))) {
    const k = lv('lettres'), idx = rand(0, w.length - 1), l = w[idx], n = k <= 4 ? 3 : k <= 7 ? 4 : 5;
    choicePuzzle({
      title: 'Quelle lettre manque ?', say: `Quelle lettre manque dans le mot ${w.toLowerCase()} ?`,
      visual: pic(w) + `<div class="word">${[...w].map((ch, i) => i === idx ? '<span class="gap">?</span>' : `<span>${ch}</span>`).join('')}</div>`,
      choices: shuffle([l, ...otherLetters(w, n - 1)]).map(v => ({ html: v, ok: v === l })), win: `Le mot ${w.toLowerCase()} !`, again: sayWord(w),
    });
  },
  hangman(w = pickWord()) {
    const k = lv('mots'), letters = [...w], found = letters.map(() => false);
    const uniq = [...new Set(letters)];
    const pool = shuffle([...uniq, ...otherLetters(w, Math.max(2, (k <= 3 ? 8 : k <= 6 ? 10 : 12) - uniq.length))]);
    pz.title.textContent = 'Le mot caché'; pz.choices.innerHTML = '';
    const draw = () => { pz.visual.innerHTML = pic(w) + `<div class="word">${letters.map((ch, i) => `<span>${found[i] ? ch : ''}</span>`).join('')}</div>`; };
    draw();
    let errs = 0, miss = 0; const btns = {};
    const next = () => letters.find((ch, i) => !found[i]);
    const glow = () => { Object.values(btns).forEach(x => x.classList.remove('hint')); const l = next(); if (l) btns[l].classList.add('hint'); };
    // Une bonne lettre, trouvée ou offerte
    const take = (l, given) => {
      const b = btns[l]; miss = 0;
      letters.forEach((ch, i) => { if (ch === l) found[i] = true; });
      b.classList.remove('hint'); b.classList.add('good'); b.disabled = true; SFX.key(); draw();
      if (found.every(Boolean)) { solved(`Tu as écrit ${w.toLowerCase()} !`); return; }
      say(given ? `Je te donne la lettre ${letterName(l)}.` + sayWord(w) : letterName(l));
      if (pzHelp.hinted) glow();
      renderHelp();
    };
    pzHelp = { hinted: false, give: () => take(next(), true), glow, left: () => new Set(letters.filter((ch, i) => !found[i])).size };
    pool.forEach(l => {
      const b = document.createElement('button'); b.className = 'choice key'; b.textContent = l; btns[l] = b;
      b.onclick = () => {
        if (pzLocked || b.disabled) return;
        if (letters.includes(l)) take(l);
        else {
          errs++; miss++;
          oops(b, errs, null, miss >= FREE_LETTER ? ' ' : pick(OOPS) + sayWord(w));
          if (miss >= FREE_LETTER) take(next(), true);
        }
      };
      pz.choices.appendChild(b);
    });
    renderHelp();
    // Le mot est toujours dit : l'image aide, mais ne suffit pas toujours.
    currentSay = `Écris le mot ${w.toLowerCase()}.` + (ICON[w] ? " Regarde bien l'image !" : ''); say(currentSay);
  },
  order(w = pickWord()) {
    const letters = [...w];
    let mixed, tries = 0; do { mixed = shuffle(letters); } while (mixed.join('') === w && ++tries < 20);
    pz.title.textContent = "Remets les lettres dans l'ordre"; pz.choices.innerHTML = '';
    const slots = letters.map(() => '');
    const draw = () => { pz.visual.innerHTML = pic(w) + `<div class="word">${slots.map(s => `<span>${s}</span>`).join('')}</div>`; };
    draw();
    let pos = 0, miss = 0; const btns = [];
    const nextBtn = () => btns.find(x => !x.classList.contains('gone') && x.textContent === letters[pos]);
    const glow = () => { btns.forEach(x => x.classList.remove('hint')); const nb = nextBtn(); if (nb) nb.classList.add('hint'); };
    // Une bonne lettre posée, trouvée ou offerte
    const take = (b, given) => {
      slots[pos] = letters[pos]; pos++; miss = 0; b.classList.add('gone'); btns.forEach(x => x.classList.remove('hint')); SFX.key(); draw();
      if (pos === letters.length) { solved(`Tu as écrit ${w.toLowerCase()} !`); return; }
      if (given) say(`Je te donne la lettre ${letterName(letters[pos - 1])}.` + sayWord(w));
      if (pzHelp.hinted) glow();
      renderHelp();
    };
    pzHelp = { hinted: false, give: () => take(nextBtn(), true), glow, left: () => letters.length - pos };
    mixed.forEach(l => {
      const b = document.createElement('button'); b.className = 'choice key'; b.textContent = l; btns.push(b);
      b.onclick = () => {
        if (pzLocked || b.classList.contains('gone')) return;
        if (l === letters[pos]) take(b);
        else {
          miss++; pzErrs++; SFX.no(); b.classList.remove('bad'); void b.offsetWidth; b.classList.add('bad');
          setTimeout(() => b.classList.remove('bad'), 450);
          if (miss >= FREE_LETTER) take(nextBtn(), true); else say('Essaie une autre lettre.' + sayWord(w));
        }
      };
      pz.choices.appendChild(b);
    });
    renderHelp();
    currentSay = `Remets les lettres dans l'ordre pour écrire le mot ${w.toLowerCase()}.`; say(currentSay);
  },
  // Suite de nombres : le pas grandit avec le niveau, et peut descendre.
  numseq() {
    const k = lv('suite'), steps = [[1], [1], [1, 2], [2], [2, 5], [2, 5, 10], [2, 3, 5, 10, -1], [3, 4, 5, 10, -2], [3, 4, 6, -2, -5], [4, 6, 7, 9, -3]][k - 1];
    const st = pick(steps), len = k <= 3 ? 4 : 5, lo = st < 0 ? -st * len : 0;
    const a = rand(lo, lo + (k <= 2 ? 3 : k * 4)), seq = Array.from({ length: len }, (_, i) => a + st * i), ans = a + st * len;
    choicePuzzle({
      title: 'Quel nombre vient après ?', say: 'Regarde les nombres. Quel nombre vient après ?',
      visual: seq.map(v => `<span class="num">${v}</span>`).join('') + '<span class="num q">?</span>',
      choices: numberChoices(ans, Math.max(0, ans - 6), ans + 6, nChoices(k)).map(v => ({ html: v, ok: v === ans })), win: `C'est ${ans} !`,
    });
  },
  // Pair ou impair : les œufs rangés par deux, l'œuf tout seul donne la réponse.
  parity() {
    const k = lv('count'), n = rand(2, k <= 6 ? 12 : 20), even = n % 2 === 0;
    const eggs = k <= 7
      ? Array.from({ length: Math.ceil(n / 2) }, (_, i) => `<span class="grp">${EGG_SVG('mini')}${2 * i + 1 < n ? EGG_SVG('mini') : ''}</span>`).join('')
      : Array(n).fill(EGG_SVG('mini')).join('');
    choicePuzzle({
      title: `${n} : pair ou impair ?`, say: `${n}, est-ce un nombre pair ou impair ? Range les œufs par deux : s'il en reste un tout seul, c'est impair.`,
      visual: `<div class="group" style="max-width:360px">${eggs}</div>`,
      choices: [{ html: `Pair<small>aucun œuf tout seul</small>`, ok: even, label: 'Pair' }, { html: `Impair<small>un œuf tout seul</small>`, ok: !even, label: 'Impair' }],
      win: `${n} est ${even ? 'pair' : 'impair'} !`,
    });
  },
  // Pièces d'euro : d'abord des pièces de 1 €, puis 2 €, puis les centimes.
  coins() {
    const k = lv('add'), kinds = k <= 2 ? [100] : k <= 6 ? [100, 200] : k <= 8 ? [50, 100, 200] : [10, 20, 50, 100, 200];
    const list = Array.from({ length: rand(2, k <= 4 ? 4 : 6) }, () => pick(kinds)).sort((a, b) => b - a), sum = list.reduce((a, b) => a + b, 0);
    const step = Math.min(...kinds), n = nChoices(k), set = new Set([sum]);
    for (const d of shuffle([step, -step, 100, -100, 2 * step, -2 * step, 200])) { if (set.size >= n) break; if (sum + d > 0) set.add(sum + d); }
    for (let v = sum + 300; set.size < n; v += 100) set.add(v);
    choicePuzzle({
      title: 'Combien ça fait ?', say: 'Compte les pièces. Combien ça fait en tout ?',
      visual: `<div class="group" style="max-width:380px">${list.map(coinSvg).join('')}</div>`,
      choices: shuffle([...set]).map(v => ({ html: euros(v), ok: v === sum, label: eurosSaid(v) })), win: `Ça fait ${eurosSaid(sum)} !`,
    });
  },
  // Lire l'heure : heures pleines, puis demi-heures, puis quarts d'heure.
  clock() {
    const k = lv('heure'), mins = k <= 4 ? [0] : k <= 7 ? [0, 30] : [0, 15, 30, 45], n = nChoices(k);
    const h = rand(1, 12), m = pick(mins), ans = h * 60 + m, set = new Set([ans]);
    while (set.size < n) set.add(pick([h % 12 + 1, (h + 10) % 12 + 1, rand(1, 12)]) * 60 + pick(mins));
    choicePuzzle({
      title: 'Quelle heure est-il ?', say: "Regarde l'horloge. Quelle heure est-il ? La petite aiguille montre les heures.",
      visual: clockSvg(h, m),
      choices: shuffle([...set]).map(v => ({ html: hourText(v), ok: v === ans, label: hourSaid(v) })), win: `Il est ${hourSaid(ans)} !`,
    });
  },
  // L'intrus : d'abord très différent, puis une seule différence, puis il faut ignorer les couleurs.
  intrus() {
    const k = lv('logique'), n = k <= 6 ? 4 : 5, sh = shuffle(Object.keys(SHAPES)), cols = shuffle(COLORS);
    const size = () => k >= 9 ? pick([.7, .85, 1]) : 1;
    let items, odd;
    if (k <= 3) { items = Array.from({ length: n - 1 }, () => ({ sh: sh[0], c: cols[0], s: 1 })); odd = { sh: sh[1], c: cols[1], s: 1 }; }
    else if (k <= 6) { items = Array.from({ length: n - 1 }, () => ({ sh: sh[0], c: cols[0], s: 1 })); odd = Math.random() < .5 ? { sh: sh[1], c: cols[0], s: 1 } : { sh: sh[0], c: cols[1], s: 1 }; }
    else { items = Array.from({ length: n - 1 }, (_, i) => ({ sh: sh[0], c: cols[i % 4], s: size() })); odd = { sh: sh[1], c: pick(COLORS), s: size() }; }
    choicePuzzle({
      title: "Lequel n'est pas comme les autres ?", say: "Trouve celui qui n'est pas comme les autres.", visual: '',
      choices: shuffle([...items, { ...odd, ok: true }]).map(it => ({ html: shapeSvg(it.sh, it.c.c, it.s), ok: !!it.ok, label: shapeName(it.sh, it.c) })),
      win: "Tu as trouvé l'intrus !",
    });
  },
  // Lire : quel mot écrit va avec l'image ? Plus loin, les mots proposés se ressemblent.
  wordpic() {
    const k = lv('lire'), all = Object.keys(ICON), pool = k <= 3 ? all.filter(w => w.length <= 4) : all, w = pick(pool), n = nChoices(k);
    const sim = x => (x[0] === w[0] ? 2 : 0) + (Math.abs(x.length - w.length) <= 1 ? 1 : 0);
    let others = shuffle(pool.filter(x => x !== w));
    if (k >= 6) others.sort((a, b) => sim(b) - sim(a));
    choicePuzzle({
      title: "Quel mot va avec l'image ?", say: "Lis les mots. Lequel va avec l'image ?",
      visual: `<svg viewBox="0 0 100 100" class="pic" aria-hidden="true">${ICON[w]}</svg>`,
      choices: shuffle([w, ...others.slice(0, n - 1)]).map(x => ({ html: `<span class="wd">${x}</span>`, ok: x === w, label: x.toLowerCase() })),
      win: `C'est écrit ${w.toLowerCase()} !`,
    });
  },
  // Labyrinthe : guider le bébé dino jusqu'à l'œuf. Étoiles selon le nombre de pas.
  maze() {
    const k = lv('logique'), n = [5, 5, 6, 6, 7, 7, 8, 8, 9, 9][k - 1], D = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    // Labyrinthe creusé au hasard : un seul chemin entre deux cases. open[c][i] : passage vers le haut, la droite, le bas, la gauche.
    const open = Array.from({ length: n * n }, () => [false, false, false, false]), seen = new Set([0]), stack = [0];
    while (stack.length) {
      const c = stack[stack.length - 1], x = c % n, y = (c / n) | 0;
      const nb = D.map((d, i) => [i, x + d[0], y + d[1]]).filter(([, a, b]) => a >= 0 && b >= 0 && a < n && b < n && !seen.has(b * n + a));
      if (!nb.length) { stack.pop(); continue; }
      const [i, a, b] = pick(nb), c2 = b * n + a;
      open[c][i] = open[c2][(i + 2) % 4] = true; seen.add(c2); stack.push(c2);
    }
    const goal = n * n - 1, dist = new Map([[0, 0]]), q = [0];
    while (q.length) { const c = q.shift(); D.forEach((d, i) => { const c2 = c + d[0] + d[1] * n; if (open[c][i] && !dist.has(c2)) { dist.set(c2, dist.get(c) + 1); q.push(c2); } }); }
    const best = dist.get(goal);
    let pos = 0, moves = 0;
    const draw = () => {
      let walls = `M${n * 10} 0V${n * 10}H0`, cells = '';
      for (let c = 0; c < n * n; c++) {
        const x = (c % n) * 10, y = ((c / n) | 0) * 10;
        if (!open[c][0]) walls += `M${x} ${y}h10`;
        if (!open[c][3]) walls += `M${x} ${y}v10`;
        cells += `<rect x="${x}" y="${y}" width="10" height="10" fill="transparent" data-c="${c}"/>`;
      }
      const px = (pos % n) * 10 + 5, py = ((pos / n) | 0) * 10 + 5, gx = (goal % n) * 10 + 5, gy = ((goal / n) | 0) * 10 + 5;
      pz.visual.innerHTML = `<svg viewBox="-1 -1 ${n * 10 + 2} ${n * 10 + 2}" class="maze" role="img" aria-label="Labyrinthe"><rect x="0" y="0" width="${n * 10}" height="${n * 10}" fill="#fff"/>${cells}<path d="${walls}" stroke="#1d2b22" stroke-width="1.4" stroke-linecap="round" fill="none" pointer-events="none"/><ellipse cx="${gx}" cy="${gy}" rx="2.6" ry="3.3" fill="#fff4dc" stroke="#1d2b22" stroke-width=".8" pointer-events="none"/><g pointer-events="none"><circle cx="${px}" cy="${py}" r="3.4" fill="#5cb85c" stroke="#1d2b22" stroke-width=".8"/><circle cx="${px + 1.2}" cy="${py - .8}" r=".7" fill="#1d2b22"/></g></svg>`;
      pz.visual.querySelector('svg').onclick = e => { const c = +e.target.dataset.c; const i = D.findIndex(d => pos % n + d[0] === c % n && ((pos / n) | 0) + d[1] === ((c / n) | 0)); if (i >= 0) go(i); };
    };
    const go = i => {
      if (pzLocked) return;
      if (!open[pos][i]) { SFX.bonk(); return; }
      pos += D[i][0] + D[i][1] * n; moves++; SFX.key(); draw();
      if (pos === goal) gameDone(moves <= best + 2 ? 0 : moves <= best * 2 ? 1 : 2, "Tu as trouvé l'œuf !");
    };
    pz.title.textContent = 'Le labyrinthe'; pz.choices.innerHTML = '';
    draw();
    [['←', 3, 'Gauche'], ['↑', 0, 'Haut'], ['↓', 2, 'Bas'], ['→', 1, 'Droite']].forEach(([t, i, lab]) => {
      const b = document.createElement('button'); b.className = 'choice key arrow'; b.textContent = t; b.setAttribute('aria-label', lab);
      b.onclick = () => go(i); pz.choices.appendChild(b);
    });
    pzKey = code => { const i = { ArrowUp: 0, KeyW: 0, KeyZ: 0, ArrowRight: 1, KeyD: 1, ArrowDown: 2, KeyS: 2, ArrowLeft: 3, KeyA: 3, KeyQ: 3 }[code]; if (i === undefined) return false; go(i); return true; };
    currentSay = "Aide le bébé dino à rejoindre l'œuf. Utilise les flèches, ou touche la case à côté de lui."; say(currentSay);
  },
  // Taquin : faire glisser les nombres pour les ranger. 2 x 2 au début, puis 3 x 3 de plus en plus mélangé.
  slide() {
    const k = lv('logique'), n = k <= 2 ? 2 : 3, S = n === 2 ? 6 : 6 + k * 3, last = n * n - 1;
    const nbrs = e => [e - n, e + n, e % n ? e - 1 : -1, (e + 1) % n ? e + 1 : -1].filter(c => c >= 0 && c <= last);
    const done = () => b.every((v, i) => v === (i === last ? 0 : i + 1));
    let b, moves = 0;
    do {
      b = [...Array(last).keys()].map(i => i + 1).concat(0);
      let prev = -1;
      for (let s = 0; s < S; s++) { const e = b.indexOf(0), c = pick(nbrs(e).filter(x => x !== prev)); [b[e], b[c]] = [b[c], b[e]]; prev = e; }
    } while (done());
    const cols = ['#e5483b', '#2f7fe0', '#e0a526', '#3fa34d', '#b23a7a', '#ff8a2a', '#5a4c9a', '#1f8a8a'];
    const draw = () => {
      pz.visual.innerHTML = `<div class="slide" style="grid-template-columns:repeat(${n},var(--t))">${b.map((v, i) => v ? `<button type="button" data-i="${i}" style="background:${cols[v - 1]}">${v}</button>` : `<span class="empty"></span>`).join('')}</div>`;
      pz.visual.querySelectorAll('.slide button').forEach(el => { el.onclick = () => tap(+el.dataset.i); });
    };
    const tap = i => {
      if (pzLocked) return;
      const e = b.indexOf(0);
      if (!nbrs(e).includes(i)) { SFX.no(); return; }
      [b[e], b[i]] = [b[i], b[e]]; moves++; SFX.key(); draw();
      if (done()) gameDone(moves <= S + 2 ? 0 : moves <= S * 2 + 4 ? 1 : 2, 'Tout est bien rangé !');
    };
    pz.title.textContent = "Range les nombres dans l'ordre"; pz.choices.innerHTML = '';
    draw();
    currentSay = `Touche un nombre à côté de la case vide pour le faire glisser. Range-les de 1 à ${last}.`; say(currentSay);
  },
  // Mémoire : retrouver les paires d'images.
  memory() {
    const k = lv('logique'), pairs = k <= 2 ? 3 : k <= 5 ? 4 : k <= 8 ? 6 : 8, id = pzId;
    const faces = shuffle(Object.keys(ICON)).slice(0, pairs), cards = shuffle([...faces, ...faces]);
    let up = [], found = 0, misses = 0, busy = false;
    pz.title.textContent = 'Le jeu de mémoire'; pz.visual.innerHTML = ''; pz.choices.innerHTML = '';
    const els = cards.map((w, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'mcard'; b.setAttribute('aria-label', `Carte ${i + 1}`);
      b.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true">${ICON[w]}</svg>`;
      b.onclick = () => flip(i); pz.choices.appendChild(b); return b;
    });
    const flip = i => {
      const b = els[i];
      if (pzLocked || busy || b.classList.contains('up')) return;
      b.classList.add('up'); b.setAttribute('aria-label', cards[i].toLowerCase()); SFX.key(); up.push(i);
      if (up.length < 2) return;
      const [a, c] = up; up = [];
      if (cards[a] === cards[c]) {
        els[a].classList.add('done'); els[c].classList.add('done');
        if (++found === pairs) gameDone(misses <= pairs ? 0 : misses <= pairs * 2 ? 1 : 2, 'Tu as trouvé toutes les paires !');
        else say(cards[a].toLowerCase());
        return;
      }
      misses++; busy = true;
      setTimeout(() => { if (id !== pzId) return; [a, c].forEach(j => { els[j].classList.remove('up'); els[j].setAttribute('aria-label', `Carte ${j + 1}`); }); busy = false; }, 900);
    };
    currentSay = 'Retourne deux cartes. Si elles sont pareilles, elles restent. Trouve toutes les paires !'; say(currentSay);
  },
  // Relier les points dans l'ordre, puis de 2 en 2 et de 5 en 5.
  dots() {
    const k = lv('count'), max = k <= 2 ? 5 : k <= 4 ? 9 : k <= 6 ? 10 : 12, step = k <= 6 ? 1 : k <= 8 ? 2 : 5;
    const [name, pts] = pick(Object.values(DOT_SHAPES).filter(([, p]) => p.length <= max));
    const nums = pts.map((_, i) => step * (i + 1));
    let next = 0, misses = 0;
    const draw = () => {
      const done = next === pts.length, line = pts.slice(0, next).map(p => p.join(',')).join(' ');
      const shape = done ? `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="#ffd23a" stroke="#1d2b22" stroke-width="2" stroke-linejoin="round"/>` : `<polyline points="${line}" fill="none" stroke="#1d2b22" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
      const dots = pts.map(([x, y], i) => `<g data-i="${i}"><circle cx="${x}" cy="${y}" r="8" fill="transparent"/><circle cx="${x}" cy="${y}" r="4" fill="${i < next ? '#1d2b22' : i === next && misses >= 2 ? '#ffb238' : '#2f7fe0'}" stroke="#1d2b22" stroke-width="1"/><text x="${x}" y="${y - 5}" text-anchor="middle" font-size="7" font-family="Lilita One, sans-serif" fill="#1d2b22">${nums[i]}</text></g>`).join('');
      pz.visual.innerHTML = `<svg viewBox="0 0 100 100" class="dots" role="img" aria-label="Points à relier">${shape}${dots}</svg>`;
      pz.visual.querySelectorAll('g[data-i]').forEach(g => { g.onclick = () => tap(+g.dataset.i); });
    };
    const tap = i => {
      if (pzLocked || i < next) return;
      if (i !== next) { pzErrs++; misses++; SFX.no(); say(`Cherche le ${nums[next]}.`); draw(); return; }
      next++; misses = 0; SFX.key(); draw();
      if (next === pts.length) gameDone(pzErrs, `C'est ${name} !`);
    };
    pz.title.textContent = "Relie les points dans l'ordre"; pz.choices.innerHTML = '';
    draw();
    currentSay = step === 1 ? "Touche les points dans l'ordre : 1, 2, 3…" : `Touche les points en comptant de ${step} en ${step} : ${step}, ${step * 2}, ${step * 3}…`; say(currentSay);
  },
  // Sudoku 4 x 4 avec des formes : chaque ligne, colonne et carré a les 4 formes une seule fois.
  sudoku() {
    const k = lv('logique'), holes = k <= 4 ? 3 : k <= 6 ? 4 : k <= 8 ? 6 : 8;
    const base = [[0, 1, 2, 3], [2, 3, 0, 1], [1, 0, 3, 2], [3, 2, 1, 0]];
    const ord = () => { const [a, b] = shuffle([[0, 1], [2, 3]]); return [...shuffle(a), ...shuffle(b)]; };
    const rows = ord(), cols = ord(), sym = shuffle([0, 1, 2, 3]);
    const sol = rows.flatMap(r => cols.map(c => sym[base[r][c]]));
    const grid = sol.slice();
    // On creuse des trous en gardant une seule solution possible.
    const count = (g, lim = 2) => {
      const i = g.indexOf(-1); if (i < 0) return 1;
      let n = 0;
      for (let v = 0; v < 4 && n < lim; v++) {
        const r = (i / 4) | 0, c = i % 4, br = r - r % 2, bc = c - c % 2;
        if (g.some((x, j) => x === v && ((j / 4 | 0) === r || j % 4 === c || ((j / 4 | 0) - (j / 4 | 0) % 2 === br && j % 4 - j % 4 % 2 === bc)))) continue;
        g[i] = v; n += count(g, lim - n); g[i] = -1;
      }
      return n;
    };
    for (const i of shuffle([...Array(16).keys()])) {
      if (grid.filter(v => v < 0).length >= holes) break;
      const keep = grid[i]; grid[i] = -1;
      if (count(grid.slice()) !== 1) grid[i] = keep;
    }
    const given = grid.map(v => v >= 0), SYM = [['rond', COLORS[0]], ['carre', COLORS[1]], ['triangle', COLORS[2]], ['etoile', COLORS[3]]];
    let sel = grid.indexOf(-1);
    const draw = () => {
      pz.visual.innerHTML = `<div class="sdk">${grid.map((v, i) => `<button type="button" data-i="${i}" class="${given[i] ? 'given' : ''}${i === sel ? ' sel' : ''}${i % 4 === 1 ? ' br' : ''}${(i / 4 | 0) === 1 ? ' bb' : ''}" aria-label="${v >= 0 ? shapeName(...SYM[v]) : 'case vide'}"${given[i] ? ' disabled' : ''}>${v >= 0 ? shapeSvg(SYM[v][0], SYM[v][1].c) : ''}</button>`).join('')}</div>`;
      pz.visual.querySelectorAll('.sdk button:not(.given)').forEach(el => { el.onclick = () => { if (grid[+el.dataset.i] < 0) { sel = +el.dataset.i; draw(); } }; });
    };
    const place = v => {
      if (pzLocked || sel < 0) return;
      if (sol[sel] !== v) {
        pzErrs++; SFX.no(); say(pick(['Cette forme est déjà dans la ligne, la colonne ou le carré. Essaie une autre !', 'Regarde bien la ligne et la colonne.']));
        const el = pz.visual.querySelector(`[data-i="${sel}"]`); el.classList.remove('bad'); void el.offsetWidth; el.classList.add('bad');
        return;
      }
      grid[sel] = v; SFX.key();
      sel = grid.indexOf(-1); draw();
      if (sel < 0) gameDone(pzErrs, 'La grille est pleine !');
    };
    pz.title.textContent = 'Le sudoku des formes'; pz.choices.innerHTML = '';
    draw();
    SYM.forEach(([sh, c], v) => {
      const b = document.createElement('button'); b.className = 'choice key'; b.innerHTML = shapeSvg(sh, c.c); b.setAttribute('aria-label', shapeName(sh, c));
      b.onclick = () => place(v); pz.choices.appendChild(b);
    });
    currentSay = "Touche une case vide, puis la bonne forme. Chaque ligne, chaque colonne et chaque carré a les 4 formes, une seule fois."; say(currentSay);
  },
  // Ombres : quelle ombre va avec l'image ? Plus loin, certaines ombres sont retournées.
  ombres() {
    // (les 4 couleurs sont la même tache de peinture : leurs ombres seraient pareilles)
    const k = lv('logique'), all = Object.keys(ICON).filter(w => !['ROUGE', 'JAUNE', 'VIOLET', 'BLANC'].includes(w)), w = pick(all), n = nChoices(k);
    choicePuzzle({
      title: 'Quelle est son ombre ?', say: "Trouve l'ombre de l'image.",
      visual: `<svg viewBox="0 0 100 100" class="pic" aria-hidden="true">${ICON[w]}</svg>`,
      choices: shuffle([w, ...shuffle(all.filter(x => x !== w)).slice(0, n - 1)]).map(x => ({ html: `<svg viewBox="0 0 100 100" class="shadow${k >= 7 && Math.random() < .5 ? ' flip' : ''}" aria-hidden="true">${ICON[x]}</svg>`, ok: x === w, label: 'ombre ' + x.toLowerCase() })),
      win: "C'est la bonne ombre !",
    });
  },
  /* Puzzle à pièces : remettre les morceaux d'une image à leur place. 4 pièces, puis 6, puis 9,
     puis des pièces tournées (on touche une pièce choisie pour la tourner). On touche une pièce, puis sa place.
     Aide : 5 trésors pour poser une pièce, 10 pour faire briller la pièce et sa place ; une pièce offerte après 2 erreurs. */
  pieces() {
    const k = lv('logique'), [cols, rows] = k <= 3 ? [2, 2] : k <= 6 ? [3, 2] : [3, 3], turn = k >= 9, n = cols * rows;
    const w = pick(Object.keys(ICON).filter(x => x !== 'LUNE')), pw = 100 / cols, ph = 100 / rows;
    const placed = Array(n).fill(false), rot = Array.from({ length: n }, () => turn && Math.random() < .6 ? pick([90, 180, 270]) : 0);
    const order = shuffle([...Array(n).keys()]);
    let sel = -1, miss = 0;
    const left = () => placed.filter(x => !x).length;
    const target = () => sel >= 0 ? sel : order.find(i => !placed[i]);
    const piece = i => `<svg viewBox="${(i % cols) * pw} ${((i / cols) | 0) * ph} ${pw} ${ph}" preserveAspectRatio="none" aria-hidden="true">${ICON[w]}</svg>`;
    const draw = () => {
      const glow = pzHelp && pzHelp.hinted ? target() : -1;
      pz.visual.innerHTML = `<div class="jig" style="--c:${cols};--r:${rows}"><div class="board">${k <= 5 ? `<svg viewBox="0 0 100 100" preserveAspectRatio="none" class="ghost-img" aria-hidden="true">${ICON[w]}</svg>` : ''}${placed.map((p, i) => `<button type="button" class="slot${i === glow ? ' hint' : ''}" data-s="${i}" aria-label="${p ? 'Pièce posée' : `Place ${i + 1}`}">${p ? piece(i) : ''}</button>`).join('')}</div>`
        + `<div class="tray">${order.filter(i => !placed[i]).map(i => `<button type="button" class="pc${i === sel ? ' sel' : ''}${i === glow ? ' hint' : ''}" data-p="${i}" aria-label="Pièce" style="--rot:${rot[i]}deg">${piece(i)}</button>`).join('')}</div></div>`;
      pz.visual.querySelectorAll('.pc').forEach(el => { el.onclick = () => choose(+el.dataset.p); });
      pz.visual.querySelectorAll('.slot').forEach(el => { el.onclick = () => drop(+el.dataset.s, el); });
    };
    const put = (i, given) => {
      placed[i] = true; rot[i] = 0; sel = -1; miss = 0; SFX.key(); draw();
      if (!left()) { gameDone(pzErrs, `Le dessin est complet : ${w.toLowerCase()} !`); return; }
      if (given) say('Je te pose une pièce.');
      renderHelp();
    };
    const choose = i => {
      if (pzLocked) return;
      if (i === sel && turn) { rot[i] = (rot[i] + 90) % 360; SFX.pop(); }
      else { sel = i; SFX.key(); }
      draw();
    };
    const drop = (s, el) => {
      if (pzLocked || placed[s]) return;
      if (sel < 0) { say("Choisis d'abord une pièce."); return; }
      if (s === sel && !rot[sel]) { put(sel); return; }
      pzErrs++; miss++; SFX.no(); el.classList.remove('bad'); void el.offsetWidth; el.classList.add('bad');
      if (miss >= 2) { put(target(), true); return; }
      say(s === sel ? 'Bonne place ! Mais la pièce est tournée : touche-la pour la tourner.' : 'Pas ici. Regarde bien le dessin.');
    };
    pzHelp = { hinted: false, give: () => put(target(), true), glow: draw, left, labels: ['Poser une pièce', 'Montrer la place'], glowSay: 'Regarde la pièce et sa place qui brillent !' };
    pz.title.textContent = 'Le puzzle'; pz.choices.innerHTML = '';
    draw(); renderHelp();
    currentSay = 'Touche une pièce, puis touche sa place pour refaire le dessin.' + (turn ? ' Si une pièce est tournée, touche-la encore pour la tourner.' : ''); say(currentSay);
  },
  /* Symétrie : colorier l'autre moitié du dessin, comme dans un miroir. Grille plus grande avec le niveau,
     puis deux couleurs. Une case mauvaise ne se colorie pas. Aide : 5 trésors pour colorier une case,
     10 pour faire briller les cases à colorier ; une case offerte après 2 erreurs. */
  symetrie() {
    const k = lv('logique'), [half, rows] = k <= 3 ? [2, 4] : k <= 6 ? [3, 5] : [4, 6], cols = half * 2;
    const pal = k >= 8 ? shuffle(COLORS).slice(0, 2) : [pick(COLORS)];
    const side = Array.from({ length: rows * half }, () => Math.random() < .4 ? pick(pal) : null);
    while (side.filter(Boolean).length < Math.max(3, rows - 1)) side[rand(0, side.length - 1)] = pick(pal);
    pal.forEach(c => { if (!side.includes(c)) side[side.findIndex(v => v !== null && side.filter(x => x === v).length > 1)] = c; });
    const goal = Array(rows * cols).fill(null);
    side.forEach((v, j) => { const r = (j / half) | 0, c = j % half; goal[r * cols + c] = v; goal[r * cols + cols - 1 - c] = v; });
    const cur = goal.map((v, i) => i % cols < half ? v : null);
    let color = pal[0], miss = 0;
    const todo = () => goal.flatMap((v, i) => v && !cur[i] ? [i] : []);
    const draw = () => {
      const glow = pzHelp && pzHelp.hinted ? new Set(todo()) : new Set();
      pz.visual.innerHTML = `<div class="sym" style="grid-template-columns:repeat(${cols},var(--q))">${cur.map((v, i) => `<button type="button" data-i="${i}" class="${i % cols < half ? 'given' : ''}${i % cols === half ? ' mid' : ''}${glow.has(i) ? ' hint' : ''}" style="${v ? `background:${v.c}` : ''}" aria-label="${v ? 'case ' + v.f : 'case blanche'}"${i % cols < half ? ' disabled' : ''}></button>`).join('')}</div>`;
      pz.visual.querySelectorAll('.sym button:not(.given)').forEach(el => { el.onclick = () => tap(+el.dataset.i, el); });
    };
    const fill = (i, given) => {
      cur[i] = goal[i]; miss = 0; SFX.key(); draw();
      if (!todo().length) { gameDone(pzErrs, 'Les deux côtés sont pareils !'); return; }
      if (given) say("Je t'en colorie une.");
      renderHelp();
    };
    const tap = (i, el) => {
      if (pzLocked || cur[i]) return;
      if (goal[i] === color) { fill(i); return; }
      pzErrs++; miss++; SFX.no(); el.classList.remove('bad'); void el.offsetWidth; el.classList.add('bad');
      if (miss >= 2) { fill(todo()[0], true); return; }
      say(goal[i] ? `Pas cette couleur ici : prends le ${goal[i].n}.` : "Cette case reste blanche. Regarde l'autre côté, comme dans un miroir.");
    };
    pzHelp = { hinted: false, give: () => fill(todo()[0], true), glow: draw, left: () => todo().length, labels: ['Colorier une case', 'Montrer les cases'], glowSay: 'Regarde les cases qui brillent !' };
    pz.title.textContent = 'Le miroir'; pz.choices.innerHTML = '';
    if (pal.length > 1) pal.forEach(c => {
      const b = document.createElement('button'); b.className = 'choice key'; b.innerHTML = `<span class="dot" style="background:${c.c}"></span>`; b.setAttribute('aria-label', c.n);
      b.setAttribute('aria-pressed', c === color);
      b.onclick = () => { color = c; pz.choices.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); say(c.n); };
      pz.choices.appendChild(b);
    });
    draw(); renderHelp();
    currentSay = "Colorie l'autre moitié du dessin, comme dans un miroir." + (pal.length > 1 ? ' Choisis la couleur en bas, puis touche les cases.' : ' Touche les cases à colorier.'); say(currentSay);
  },
};

// Énigme écrite par les parents : un calcul ou un mot de leur liste.
function customPuzzle() {
  const kinds = []; if (custom.calcs.length) kinds.push('calc'); if (custom.words.length) kinds.push('word');
  if (pick(kinds) === 'calc') {
    const c = parseCalc(pick(custom.calcs));
    choicePuzzle({
      title: `${c.disp} = ?`, say: `Combien font ${c.spoken} ?`, visual: '',
      choices: numberChoices(c.ans, Math.max(0, c.ans - 6), c.ans + 6).map(k => ({ html: k, ok: k === c.ans })), win: `${c.spoken} égale ${c.ans} !`,
    });
  } else PUZZLES[pick(['hangman', 'missing', 'order'])](pick(custom.words));
}
// Chaque pierre a son type d'énigme ; on tire parmi les énigmes voisines pour varier.
const FAMILY = {
  count: ['count', 'count', 'parity', 'coins', 'dots'],
  add: ['add', 'add', 'coins', 'numseq'],
  compare: ['compare', 'compare', 'intrus', 'clock', 'memory', 'ombres', 'pieces'],
  sequence: ['sequence', 'numseq', 'intrus', 'maze', 'slide', 'sudoku', 'symetrie'],
  first: ['first', 'wordpic'],
  missing: ['missing', 'wordpic'],
  order: ['order', 'wordpic'],
};
const READY = { parity: () => lv('count') >= 5, coins: () => lv('add') >= 2, dots: () => lv('count') >= 2, slide: () => lv('logique') >= 3, sudoku: () => lv('logique') >= 5 };
let lastType = null;
function varyType(type) {
  const pool = (FAMILY[type] || [type]).filter(t => !READY[t] || READY[t]());
  const fresh = pool.filter(t => t !== lastType);
  return pick(fresh.length ? fresh : pool);
}
/* À l'ouverture d'une énigme, l'enfant appuie souvent encore pour sauter, foncer ou nager : pendant
   PZ_WAIT millisecondes, l'énigme ne prend ni le doigt ni les touches (sinon une réponse partait
   au hasard, et la voix du « Oups » coupait le mot de la dictée). */
const PZ_WAIT = 900;
let pzWaitUntil = 0, pzWaitTimer = 0;
const pzWaiting = () => performance.now() < pzWaitUntil;
function openPuzzle(g) {
  pzWaitUntil = performance.now() + PZ_WAIT; $('puzzle').classList.add('wait');
  clearTimeout(pzWaitTimer); pzWaitTimer = setTimeout(() => $('puzzle').classList.remove('wait'), PZ_WAIT);
  state = 'puzzle'; currentGate = g; pzLocked = false; currentWord = null; pzErrs = 0; pzSkill = null; pzType = null; pzKey = null; pzId++; pzHelp = null; $('pzHelp').hidden = true; clearKeys();
  $('puzzle').hidden = false;
  let type = g.type;
  if (type === 'order' && lv('mots') <= 2) type = 'first';
  if (isExpert()) {
    if ((custom.calcs.length || custom.words.length) && Math.random() < .6) { pzType = 'parents'; customPuzzle(); return; }
    type = { count: 'mult', compare: 'sub', first: 'missing' }[type] || type;
  }
  type = lastType = varyType(type);
  pzSkill = TYPE_SKILL[type]; pzType = type;
  PUZZLES[type]();
}
function closePuzzle(win) {
  $('puzzle').hidden = true;
  const g = currentGate; currentGate = null;
  if (g && g.boss) { bossPuzzleDone(g.boss, win); cooldown = 45; state = 'play'; return; }
  if (win && g) {
    g.open = true; g.anim = 0; g.stars = pzStars; eggsRun++;
    const w = prog.worlds[L.world]; w.eggs[L.i] = Math.max(w.eggs[L.i], eggsRun); autosave(true);
    renderHudEggs(eggsRun - 1);
    const gx = g.x + g.w / 2;
    for (let i = 0; i < 16; i++) parts.push({ x: gx, y: g.eggY + (Math.random() - .5) * 60, vx: (Math.random() - .5) * 7, vy: -Math.random() * 6, life: 50, col: pick(['#7a6f9b', '#665c88', '#39c9a8']), r: 4 + Math.random() * 4 });
    parts.push({ egg: true, x: gx, y: g.eggY, vx: 0, vy: -3, g: -.02, life: 60 });
  } else if (g) {
    player.x -= 40;
  }
  cooldown = 45; state = 'play';
}
$('pzSpeak').innerHTML = IC.sound;
$('pzSpeak').onclick = () => say(currentSay);
pz.visual.addEventListener('click', e => { if (e.target.closest('[data-say]') && currentWord) say(currentWord.toLowerCase()); });
$('pzBack').onclick = () => { if (!pzLocked) { if ('speechSynthesis' in window) speechSynthesis.cancel(); recordType(pzType, pzErrs, true); pzType = null; closePuzzle(false); } };

