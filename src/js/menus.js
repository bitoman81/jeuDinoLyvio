/* ---------- L'écran des parties ---------- */
let slotAsk = -1, slotNaming = -1;   // partie à effacer (on demande confirmation), place libre qu'on nomme
function showParties() {
  showMenu(); $('menu').hidden = true; $('parties').hidden = false;
  slotAsk = slotNaming = -1; renderParties();
}
function leaveParties() { $('parties').hidden = true; showMenu(); }
let slotPut = -1;   // place où l'on demande à remplacer une partie par celle de la Switch
function renderParties() {
  const list = $('slotList'); list.innerHTML = '';
  $('incomingText').hidden = !incoming && !sendTo;
  if (incoming) $('incomingText').textContent = `Une partie arrive de la Switch${incoming.name ? ' : ' + incoming.name : ''}. Choisis où la mettre.`;
  else if (sendTo) $('incomingText').textContent = 'La Switch attend une partie. Choisis celle à lui envoyer (le téléphone et la Switch doivent être sur le même Wi-Fi).';
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const btn = (cls, text, fn) => { const b = el('button', cls, text); b.type = 'button'; b.onclick = fn; return b; };
  for (let n = 0; n < SLOT_MAX; n++) {
    const sum = slotSummary(n), card = el('div', 'slot');
    // La partie de la Switch : « Mettre ici » (une place prise demande d'abord)
    const put = () => { audio(); slotImport(n, incoming); incoming = null; slotPut = -1; leaveParties(); say('La partie de la Switch est arrivée !'); };
    if (incoming && slotPut === n) {
      card.appendChild(el('h2', '', sum ? sum.name : 'Place libre'));
      card.appendChild(el('p', 'err', `Remplacer la partie de ${sum.name} par celle de la Switch ? Elle sera perdue.`));
      const row = el('div', 'row');
      row.appendChild(btn('btn', 'Oui, remplacer', put));
      row.appendChild(btn('btn primary', 'Non', () => { slotPut = -1; renderParties(); }));
      card.appendChild(row); list.appendChild(card); continue;
    }
    if (incoming) card.appendChild(btn('btn primary', 'Mettre ici la partie de la Switch', () => { if (sum) { slotPut = n; renderParties(); } else put(); }));
    else if (sendTo && sum) card.appendChild(btn('btn primary', 'Envoyer vers la Switch', () => { audio(); sendToSwitch(n); }));
    if (sum) {
      if (sum.cur) card.classList.add('cur');
      card.appendChild(el('h2', '', sum.name));
      const ul = el('ul');
      [`Temps de jeu : ${sum.time}`, `Œufs : ${sum.eggs} sur ${sum.eggsMax}`, `Trésors : ${sum.treasures}`, `Fossiles : ${sum.fossils}`,
        `Animal : ${sum.animal}`, sum.date ? `Dernière fois : ${sum.date}` : ''].filter(Boolean).forEach(t => ul.appendChild(el('li', '', t)));
      card.appendChild(ul);
      if (slotAsk === n) {
        card.appendChild(el('p', 'err', `Effacer la partie de ${sum.name} ? Tout sera perdu.`));
        const row = el('div', 'row');
        row.appendChild(btn('btn', 'Oui, effacer', () => { slotErase(n); slotAsk = -1; renderParties(); }));
        row.appendChild(btn('btn primary', 'Non', () => { slotAsk = -1; renderParties(); }));
        card.appendChild(row);
      } else {
        card.appendChild(btn('btn primary', 'Jouer', () => { audio(); slotPlay(n); leaveParties(); }));
        card.appendChild(btn('ghost', 'Effacer cette partie', () => { slotAsk = n; slotNaming = -1; renderParties(); }));
      }
    } else if (slotNaming === n) {
      card.classList.add('empty');
      card.appendChild(el('h2', '', 'Nouvelle partie'));
      const f = el('form', 'field'), inp = el('input');
      inp.maxLength = 16; inp.placeholder = 'Ton prénom'; inp.setAttribute('aria-label', 'Nom de la partie'); inp.autocomplete = 'off';
      f.appendChild(inp); f.appendChild(el('button', 'btn primary', 'Commencer'));
      f.onsubmit = e => { e.preventDefault(); audio(); slotNew(n, inp.value); leaveParties(); };
      card.appendChild(f);
      card.appendChild(btn('ghost', 'Annuler', () => { slotNaming = -1; renderParties(); }));
      setTimeout(() => inp.focus && inp.focus(), 0);
    } else {
      card.classList.add('empty');
      card.appendChild(btn('btn', 'Nouvelle partie', () => { slotNaming = n; slotAsk = -1; renderParties(); }));
    }
    list.appendChild(card);
  }
}
$('partiesBtn').onclick = () => showParties();
initStore();

/* ---------- Fin de niveau ---------- */
// Toutes les espèces tiennent dans x de -48 à 40 et y de -14 à 46.
function babyCanvas(sp, w, h) {
  const c = document.createElement('canvas'); const r = 2;
  c.width = w * r; c.height = h * r; const x = c.getContext('2d'); x.scale(r, r);
  const s = Math.min(w / 90, h / 62);
  drawDino(x, sp, w / 2 + 4 * s, h - 2 * s, 1, 1, false, false, s);
  return c;
}
function levelDone() {
  state = 'done'; clearKeys(); SFX.yay();
  const levels = WORLDS[L.world], w = prog.worlds[L.world], i = L.i, d = levels[i], sp = world();
  // Étoiles de l'endroit : la moyenne des 3 pierres (une pierre reprise d'une ancienne sauvegarde compte 2).
  const stars = clamp(Math.round(L.gates.reduce((a, g) => a + (g.stars || 2), 0) / L.gates.length), 1, 3);
  w.eggs[i] = 3; w.stars[i] = Math.max(w.stars[i], stars);
  const newMedal = w.medals[i] < L.hard + 1; w.medals[i] = Math.max(w.medals[i], L.hard + 1);
  if (!d.bonus) w.unlocked = Math.min(regularCount(L.world), Math.max(w.unlocked, i + 2));
  // Fin d'un endroit secret : un morceau de la carte au trésor.
  const gotMap = d.bonus && !prog.bag.maps[L.world];
  if (gotMap) prog.bag.maps[L.world] = true;
  prog.run = null; save();
  $('doneStars').innerHTML = starsHtml(stars); $('doneStars').setAttribute('aria-label', `${stars} étoile${stars > 1 ? 's' : ''} sur 3`);
  const finale = L.world === 'final' && i === levels.length - 1, lastLevel = L.world !== 'final' && i === regularCount(L.world) - 1;
  let text = finale ? `Tu as traversé toute l'île secrète ! Les quatre familles sont réunies.`
    : lastLevel ? `Tu as retrouvé tous les œufs ! Tu as aussi ramassé ${fruitCount} ${sp.item}.`
    : `Tu as retrouvé les 3 œufs de ${d.name.toLowerCase()} et ramassé ${fruitCount} ${sp.item}.`;
  text += ` Ton sac : ${prog.bag.n} trésor${prog.bag.n > 1 ? 's' : ''}.` + (L.gotFossil ? ' Et un fossile pour ton album !' : '');
  if (newMedal) text += ` Médaille ${HARD[L.hard].medal} (${HARD[L.hard].name}) !` + (L.hard < 2 ? ` Tu peux maintenant le refaire en ${HARD[L.hard + 1].name}.` : '');
  if (L.gotKey) text += " Avec la clé dorée, tu peux ouvrir l'endroit secret !";
  if (gotMap) text += allMaps() ? " Et voilà le dernier morceau de la carte : l'île secrète est ouverte !" : ' Et un morceau de la carte au trésor !';
  $('doneText').textContent = text;
  $('doneNext').hidden = !canPlay(L.world, i + 1);
  $('doneNext').textContent = levels[i + 1] && levels[i + 1].bonus ? "L'endroit secret" : 'Endroit suivant';
  const h = $('hatch'); h.innerHTML = '';
  if (gotMap) { const m = document.createElement('div'); m.className = 'h map'; m.innerHTML = mapSvg(prog.bag.maps); h.appendChild(m); }
  // Au bout de l'île, un bébé de chaque famille.
  const babies = finale ? ORDER.map(k => SPECIES[k]) : [sp, sp, sp];
  babies.forEach((b, k) => {
    const el = document.createElement('div'); el.className = 'h'; el.innerHTML = EGG_SVG('egg-big'); h.appendChild(el);
    setTimeout(() => { el.innerHTML = ''; el.appendChild(babyCanvas(b, 96, 84)); SFX.key(); }, 900 + k * 600);
  });
  say(finale ? "Bravo ! Tu as traversé l'île secrète. Les quatre familles de dinosaures sont réunies !"
    : gotMap ? (allMaps() ? "Bravo ! Tu as les quatre morceaux de la carte. L'île secrète est ouverte !" : 'Bravo ! Tu as trouvé un morceau de la carte au trésor !')
    : lastLevel ? `Bravo ! Tu as retrouvé tous les œufs. La famille ${sp.spoken.replace(/^Le /, 'du ')} est réunie !` : 'Bravo ! Regarde, les bébés sont nés !');
  $('done').hidden = false;
}
// Carte au trésor en 4 morceaux, un par animal ; les morceaux manquants sont en pointillés.
function mapSvg(maps) {
  const pos = { rex: [4, 4], trike: [52, 4], ptero: [4, 40], plesio: [52, 40] };
  const pieces = ORDER.map(k => maps[k]
    ? `<rect x="${pos[k][0]}" y="${pos[k][1]}" width="44" height="32" rx="3" fill="#f4e0a8" stroke="#1d2b22" stroke-width="2.5"/>`
    : `<rect x="${pos[k][0]}" y="${pos[k][1]}" width="44" height="32" rx="3" fill="none" stroke="#8a7a5a" stroke-width="2" stroke-dasharray="4 3"/>`).join('');
  const all = ORDER.every(k => maps[k]);
  return `<svg viewBox="0 0 100 76" class="map-i" aria-hidden="true">${pieces}`
    + (maps.rex ? '<path d="M14 26q8-14 20-6t12-10" fill="none" stroke="#a0692e" stroke-width="2" stroke-dasharray="3 3"/><circle cx="14" cy="26" r="3" fill="#3fa34d"/>' : '')
    + (maps.trike ? '<path d="M56 10q14 4 18 14t18 4" fill="none" stroke="#a0692e" stroke-width="2" stroke-dasharray="3 3"/><path d="M78 12l4 5 4-5z" fill="#3fa34d"/>' : '')
    + (maps.ptero ? '<path d="M10 50q10 16 24 8t12 8" fill="none" stroke="#a0692e" stroke-width="2" stroke-dasharray="3 3"/><path d="M22 46l4-6 4 6z" fill="#7a5238"/>' : '')
    + (maps.plesio ? '<path d="M56 54q10-8 20 2" fill="none" stroke="#2f8fd8" stroke-width="3"/><path d="M80 56l8 8M88 56l-8 8" stroke="#e5483b" stroke-width="3.5" stroke-linecap="round"/>' : '')
    + (all ? '<circle cx="50" cy="38" r="9" fill="#ffd23a" stroke="#1d2b22" stroke-width="2"/>' : '') + '</svg>';
}
$('doneMenu').onclick = () => showMenu();
$('doneNext').onclick = () => { $('done').hidden = true; startLevel(L.world, L.i + 1); };

/* ---------- Menu ---------- */
function showMenu() {
  if (state === 'play' || state === 'puzzle') autosave();
  state = 'menu'; clearKeys(); $('app').classList.remove('playing');
  ['hud', 'puzzle', 'done', 'keysHint'].forEach(id => $(id).hidden = true);
  $('menu').hidden = false;
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  renderMenu();
}
function renderMenu() {
  if (prog.world === 'final' && !allMaps()) prog.world = 'rex';
  const pickEl = $('dinoPick'); pickEl.innerHTML = '';
  ORDER.forEach(k => {
    const d = SPECIES[k];
    const b = document.createElement('button'); b.setAttribute('aria-pressed', k === prog.world);
    b.appendChild(babyCanvas(d, 150, 110));
    b.appendChild(document.createTextNode(d.name));
    const sm = document.createElement('small'); sm.textContent = d.label; b.appendChild(sm);
    b.onclick = () => { audio(); prog.world = k; save(); say(`${d.spoken} ! ${d.label}.`); renderMenu(); };
    pickEl.appendChild(b);
  });
  // L'île secrète : ouverte avec les 4 morceaux de la carte au trésor.
  const nMaps = ORDER.filter(k => prog.bag.maps[k]).length, open = allMaps();
  const fb = document.createElement('button'); fb.className = 'island' + (open ? '' : ' locked'); fb.setAttribute('aria-pressed', prog.world === 'final');
  fb.innerHTML = `${mapSvg(prog.bag.maps)}L'île secrète<small>${open ? 'Les 4 animaux ensemble' : `${nMaps} morceau${nMaps > 1 ? 'x' : ''} de carte sur 4`}</small>`;
  fb.setAttribute('aria-label', open ? "L'île secrète, les 4 animaux ensemble" : `L'île secrète, pas encore ouverte : ${nMaps} morceau${nMaps > 1 ? 'x' : ''} de carte sur 4`);
  fb.onclick = () => {
    audio();
    if (!open) { say("Pour aller sur l'île secrète, il faut les 4 morceaux de la carte. Chaque animal a un endroit secret qui s'ouvre avec sa clé dorée."); return; }
    prog.world = 'final'; save(); say("L'île secrète ! Les quatre animaux partent ensemble à l'aventure."); renderMenu();
  };
  pickEl.appendChild(fb);
  const isle = prog.world === 'final';
  $('diffPetit').setAttribute('aria-pressed', prog.diff === 'petit');
  $('diffGrand').setAttribute('aria-pressed', prog.diff === 'grand');
  $('diffExpert').setAttribute('aria-pressed', prog.diff === 'expert');
  $('touchStick').setAttribute('aria-pressed', prog.touch !== 'tap');
  $('touchTap').setAttribute('aria-pressed', prog.touch === 'tap');
  renderContinue();
  renderShop();
  const sp = SPECIES[prog.world], levels = WORLDS[prog.world], w = prog.worlds[prog.world];
  $('worldTitle').textContent = isle ? "L'île secrète" : `L'aventure du ${sp.name}`;
  // Difficulté des endroits : Simple, Normal, Compliqué (voir HARD)
  const hs = $('hardSel'); hs.innerHTML = '';
  HARD.forEach((H, h) => {
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-pressed', prog.hard === h);
    b.innerHTML = `${MEDAL_SVG(h, true)} ${H.name}`; b.onclick = () => { audio(); prog.hard = h; save(); say(H.name); renderMenu(); };
    hs.appendChild(b);
  });
  $('hardText').textContent = HARD[prog.hard].text + (prog.hard ? ` Un endroit s'y joue après sa médaille ${HARD[prog.hard - 1].medal}.` : '');
  const lv = $('levels'); lv.innerHTML = '';
  levels.forEach((d, i) => {
    const b = document.createElement('button'); b.className = 'lvl' + (d.bonus ? ' bonus' : '');
    const locked = !canPlay(prog.world, i), name = d.bonus && locked ? 'Endroit secret' : d.name; b.disabled = locked;
    b.innerHTML = `<b>${d.bonus ? IC.key : i + 1}</b><span class="nm">${name}</span><span class="eg">${locked ? IC.lock : [0, 1, 2].map(k => EGG_SVG('egg-i' + (k < w.eggs[i] ? '' : ' off'))).join('')}</span>${!locked && w.stars[i] ? `<span class="st">${starsHtml(w.stars[i])}</span>` : ''}`
      + (locked ? '' : `<span class="md">${[0, 1, 2].map(h => MEDAL_SVG(h, w.medals[i] > h)).join('')}</span>`)
      + (!locked && hardFor(prog.world, i) < prog.hard ? `<span class="hl">Se joue en ${HARD[hardFor(prog.world, i)].name}</span>` : '');
    b.setAttribute('aria-label', locked ? (d.bonus ? 'Endroit secret : il faut la clé dorée' : `${d.name}, pas encore ouvert`) : `${d.name}, ${w.eggs[i]} œufs sur 3` + (w.stars[i] ? `, ${w.stars[i]} étoiles sur 3` : '')
      + `, ${w.medals[i]} médaille${w.medals[i] > 1 ? 's' : ''} sur 3, se joue en ${HARD[hardFor(prog.world, i)].name}`);
    b.onclick = () => { audio(); startLevel(prog.world, i); };
    lv.appendChild(b);
  });
  const total = w.eggs.reduce((a, b) => a + b, 0), slots = levels.length * 3;
  $('nestTitle').textContent = isle ? "Le nid de l'île secrète" : `Le nid du ${sp.name}`;
  $('nestText').textContent = total ? `${total} bébé${total > 1 ? 's sont nés' : ' est né'} sur ${slots}.` : 'Les bébés apparaîtront ici quand tu trouveras les œufs.';
  const n = $('nest'); n.innerHTML = '';
  for (let k = 0; k < slots; k++) {
    const s = document.createElement('div'); s.className = 'slot';
    if ((k % 3) < w.eggs[Math.floor(k / 3)]) s.appendChild(babyCanvas(levelSp(prog.world, Math.floor(k / 3)), 64, 56)); else s.innerHTML = '<span class="empty"></span>';
    n.appendChild(s);
  }
  setSoundIcons();
}
const FOSSIL_SVG = (() => {
  let d = ''; for (let a = 0; a < Math.PI * 5; a += .25) { const r = 15 * (1 - a / (Math.PI * 5.3)); d += `${a ? 'L' : 'M'}${(22 + Math.cos(a) * r).toFixed(1)} ${(22 + Math.sin(a) * r).toFixed(1)}`; }
  return `<svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="18" fill="#d9c9a3" stroke="#1d2b22" stroke-width="3"/><path d="${d}" fill="none" stroke="#1d2b22" stroke-width="2"/></svg>`;
})();
function shopItem(html, label, pressed, disabled, onclick) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'it'; b.innerHTML = html;
  b.setAttribute('aria-label', label); if (pressed !== null) b.setAttribute('aria-pressed', pressed); b.disabled = disabled; b.onclick = onclick;
  return b;
}
function buy(price, fn, msg) { if (prog.bag.n < price) return; audio(); prog.bag.n -= price; fn(); SFX.yay(); say(msg); save(); renderMenu(); }
function renderShop() {
  const n = prog.bag.n, w = prog.world, sp = SPECIES[w], tre = '<span class="tre"></span>';
  $('bagText').textContent = `Tu as ${n} trésor${n > 1 ? 's' : ''}. Chaque fruit et chaque perle que tu ramasses va dans ton sac.`;
  const pw = $('shopPowers'); pw.innerHTML = '';
  Object.entries(POWERS).forEach(([k, po]) => {
    const have = prog.bag.power[k];
    pw.appendChild(shopItem(`${IC[k]}${po.name}<small>${po.text}</small><small>Tu en as ${have}</small><span class="price">${tre} ${po.price}</span>`,
      `Acheter : ${po.name}, ${po.price} trésors. Tu en as ${have}.`, null, n < po.price,
      () => buy(po.price, () => { prog.bag.power[k]++; }, `${po.name} ! Il servira au prochain endroit.`)));
  });
  const sk = $('shopSkins'); sk.innerHTML = '';
  // Sur l'île secrète, les couleurs se choisissent depuis chaque animal.
  $('skinTitle').hidden = sk.hidden = !sp;
  if (sp) $('skinTitle').textContent = `Les couleurs du ${sp.name}`;
  if (sp) [{ id: 'base', name: "Couleur d'origine", price: 0, pal: {} }, ...SKINS[w]].forEach(x => {
    const owned = x.id === 'base' || prog.bag.owned[`${w}:${x.id}`], on = prog.bag.skin[w] === x.id;
    const it = shopItem(`${x.name}<span class="price">${on ? 'Choisi' : owned ? 'Mettre' : `${tre} ${x.price}`}</span>`,
      on ? `${x.name}, choisi` : owned ? `Mettre : ${x.name}` : `Acheter : ${x.name}, ${x.price} trésors`, on, !owned && n < x.price,
      () => {
        if (owned) { audio(); prog.bag.skin[w] = x.id; applySkins(); save(); say(x.name); renderMenu(); return; }
        buy(x.price, () => { prog.bag.owned[`${w}:${x.id}`] = true; prog.bag.skin[w] = x.id; applySkins(); }, `Nouvelle couleur : ${x.name} !`);
      });
    it.prepend(babyCanvas({ ...sp, pal: { ...sp.base, ...x.pal } }, 120, 84));
    sk.appendChild(it);
  });
  // Accessoires de l'animal choisi (sur l'île secrète, on les choisit depuis chaque animal)
  const ac = $('shopAcc'); ac.innerHTML = '';
  $('accTitle').hidden = $('accText').hidden = ac.hidden = !sp;
  if (sp) [{ id: '', name: 'Sans accessoire', price: 0 }, ...ACCESSORIES].forEach(x => {
    const owned = !x.id || prog.bag.accOwned[x.id], on = (prog.bag.acc[w] || '') === x.id;
    const it = shopItem(`${x.name}<span class="price">${on ? 'Choisi' : owned ? 'Mettre' : `${tre} ${x.price}`}</span>`,
      on ? `${x.name}, choisi` : owned ? `Mettre : ${x.name}` : `Acheter : ${x.name}, ${x.price} trésors`, on, !owned && n < x.price,
      () => {
        if (owned) { audio(); prog.bag.acc[w] = x.id; applySkins(); save(); say(x.name); renderMenu(); return; }
        buy(x.price, () => { prog.bag.accOwned[x.id] = true; prog.bag.acc[w] = x.id; applySkins(); }, `Nouvel accessoire : ${x.name} !`);
      });
    it.prepend(babyCanvas({ ...sp, acc: x.id }, 120, 84));
    ac.appendChild(it);
  });
  const fl = $('fossilList'); fl.innerHTML = '';
  let found = 0, total = 0;
  Object.keys(WORLDS).forEach(k => WORLDS[k].forEach((d, i) => {
    const got = !!prog.bag.fossils[`${k}-${i}`]; total++; if (got) found++;
    const el = document.createElement('div'); el.className = 'fos' + (got ? '' : ' off');
    el.innerHTML = `${FOSSIL_SVG}<span>${got ? d.name : '?'}</span>`; el.setAttribute('aria-label', got ? `Fossile trouvé : ${d.name}` : 'Fossile pas encore trouvé');
    fl.appendChild(el);
  }));
  $('fossilText').textContent = `${found} fossile${found > 1 ? 's' : ''} sur ${total}. Chaque endroit en cache un : il brille !`;
}
function renderContinue() {
  const r = prog.run, btn = $('continueBtn');
  btn.hidden = !r; if (!r) return;
  const sp = levelSp(r.world, r.i), d = WORLDS[r.world][r.i];
  btn.innerHTML = `<span>Continuer<small>${sp.name}, ${d.name}</small></span><span class="eg">${[0, 1, 2].map(k => EGG_SVG('egg-i' + (k < r.gates.length ? '' : ' off'))).join('')}</span>`;
  btn.prepend(babyCanvas(sp, 96, 70));
  btn.setAttribute('aria-label', `Continuer la partie : ${sp.name}, ${d.name}, ${r.gates.length} œufs sur 3`);
}
$('continueBtn').onclick = () => { const r = prog.run; if (!r) return; audio(); prog.world = r.world; startLevel(r.world, r.i, r); };
// Changer de niveau dans le menu remet toutes les compétences à son point de départ.
function setDiff(d, label) {
  audio();
  if (prog.diff !== d) { prog.diff = d; Object.values(prog.skills).forEach(sk => { sk.lvl = SKILL_START[d]; sk.ok = sk.bad = 0; }); save(); }
  say(label); renderMenu();
}
$('diffPetit').onclick = () => setDiff('petit', 'Petit');
$('diffGrand').onclick = () => setDiff('grand', 'Grand');
$('diffExpert').onclick = () => setDiff('expert', 'Expert');
$('touchStick').onclick = () => { audio(); prog.touch = 'stick'; save(); say('Joystick'); renderMenu(); };
$('touchTap').onclick = () => { audio(); prog.touch = 'tap'; save(); say("Toucher l'écran"); renderMenu(); };
$('menuSound').onclick = () => { audio(); toggleSound(); };
$('menuMusic').onclick = () => { audio(); toggleMusic(); };
$('btnSound').onclick = () => { audio(); toggleSound(); $('btnSound').blur(); };
$('btnHome').innerHTML = IC.home;
$('btnHome').onclick = () => showMenu();

const HINTS = {
  platform: '<span class="kb">Flèches ou Q / D pour marcher, Espace pour sauter</span><span class="touch stick">Pouce gauche pour marcher, bouton Saute pour sauter</span>',
  topdown: '<span class="kb">Flèches ou Z Q S D pour marcher, Espace pour foncer, ou clique là où tu veux aller</span><span class="touch stick">Pouce gauche pour marcher, bouton Fonce pour casser les cailloux</span><span class="touch tap">Touche l\'écran là où tu veux aller</span>',
  shmup: '<span class="kb">Flèches ou Z Q S D pour voler, Espace pour une graine de plus</span><span class="touch stick">Pouce gauche pour voler, les graines partent toutes seules</span><span class="touch tap">Touche l\'écran pour voler, les graines partent toutes seules</span>',
  swim: '<span class="kb">Flèches ou Z Q S D pour nager, Espace pour aller plus vite, ou clique là où tu veux aller</span><span class="touch stick">Pouce gauche pour nager, bouton Vite pour accélérer</span><span class="touch tap">Touche l\'écran là où tu veux nager</span>',
};
/* ---------- Partie en cours : sauvegarde automatique ----------
   Chaque pierre ouverte est un point de passage. On enregistre aussi chaque objet,
   toutes les 10 secondes, et quand on quitte la page (indispensable sur téléphone). */
const AUTOSAVE_MS = 10000;
let lastAutosave = 0, savedTimer = 0;
function snapshotRun() {
  // Le T-Rex repart du dernier sol sûr, jamais en plein saut ou sur une bûche.
  const pos = L.mode === 'platform' ? L.safe : player;
  prog.run = {
    world: L.world, i: L.i,
    gates: L.gates.filter(g => g.open).map(g => g.k),
    taken: L.items.slice(0, L.baseItems).flatMap((f, k) => f.taken ? [k] : []),
    broken: L.broken.slice(), fruit: fruitCount,
    x: Math.round(pos.x), y: Math.round(pos.y), cam: L.mode === 'shmup' ? Math.round(camX) : null,
    stars: L.gates.map(g => g.stars || 0),
    magnet: !!L.magnet, shield: !!L.shield, pows: Object.keys(POWERS).filter(k => L[k]),
    sw: L.switches.filter(s => s.on).map(s => s.k),
    hard: L.hard,
  };
}
function autosave(show = false) {
  if (L && player && (state === 'play' || state === 'puzzle')) snapshotRun();
  save(); lastAutosave = performance.now();
  if (show) { const el = $('saved'); el.classList.add('show'); clearTimeout(savedTimer); savedTimer = setTimeout(() => el.classList.remove('show'), 1600); }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') autosave(); });
window.addEventListener('pagehide', () => autosave());
function restoreRun(r) {
  L.gates.forEach(g => { if (r.gates.includes(g.k)) { g.open = true; g.anim = 1; g.stars = r.stars[g.k]; } });
  eggsRun = L.gates.filter(g => g.open).length;
  (r.sw || []).forEach(k => { const s = L.switches[k]; if (s) { s.on = true; s.door.open = true; s.door.anim = 1; } });
  r.taken.forEach(k => { if (k < L.baseItems) L.items[k].taken = true; });
  fruitCount = r.fruit;
  if (L.mode === 'topdown') r.broken.forEach(([c, row]) => { if (L.grid[c] && L.grid[c][row] === 3) { L.grid[c][row] = 0; L.broken.push([c, row]); layerDirty(c); } });
  if (r.x === null || r.y === null) return;
  player.x = r.x; player.y = r.y;
  if (L.mode === 'shmup') camX = r.cam || 0;
  else {
    player.x = clamp(player.x, 0, L.cols * T - player.w);
    if (L.safe) L.safe = { x: player.x, y: player.y };
    camX = clamp(player.x - viewW * camLead(), 0, Math.max(0, L.cols * T - viewW));
  }
}
let hintTimer = 0;
function startLevel(worldKey, i, run = null) {
  layerRelease();
  const sp = levelSp(worldKey, i), d = WORLDS[worldKey][i];
  L = { world: worldKey, sp, mode: sp.mode, i, d, gates: [], items: [], broken: [], oy: 0 };
  parts = []; fruitCount = 0; eggsRun = 0; camX = 0; time = 0; cooldown = run ? 90 : 30;
  resize();
  MODES[sp.mode].build(d);
  // Difficulté de l'endroit et ses ennemis (une partie reprise garde sa difficulté)
  L.hard = run ? run.hard : hardFor(worldKey, i);
  L.start = { x: player.x, y: player.y };
  L.foes = makeFoes(d, L.hard);
  L.bossFoe = bossLevel(worldKey, i) ? makeBoss(d, L.hard) : null;
  if (L.bossFoe) L.foes.push(L.bossFoe);
  L.baseItems = L.items.length;
  if (run) restoreRun(run);
  // Un fossile par endroit, tant qu'il n'a pas été trouvé.
  const fi = Math.floor(L.baseItems * .6);
  if (!prog.bag.fossils[`${worldKey}-${i}`] && L.items[fi] && !L.items[fi].taken) L.items[fi].fossil = true;
  // La clé dorée de l'animal, dans un seul endroit, tant qu'elle n'a pas été trouvée.
  const ki = Math.floor(L.baseItems * .3);
  if (d.key && !prog.bag.keys[worldKey] && L.items[ki] && !L.items[ki].taken) L.items[ki].key = true;
  // Pouvoirs : pris dans le sac au début d'un nouvel endroit. Le bouclier ne sert qu'en vol et sous l'eau.
  if (run) Object.keys(POWERS).forEach(k => { L[k] = run.pows.includes(k); });
  else Object.entries(POWERS).forEach(([k, po]) => {
    if (prog.bag.power[k] > 0 && (!po.modes || po.modes.includes(sp.mode))) { prog.bag.power[k]--; L[k] = true; }
  });
  L.oy = MODES[sp.mode].oy();
  $('menu').hidden = true; $('parties').hidden = true; $('done').hidden = true; $('puzzle').hidden = true;
  $('hud').hidden = false; $('hudFruit').textContent = fruitCount; renderHudEggs();
  $('hudPow').innerHTML = Object.keys(POWERS).filter(k => L[k]).map(k => IC[k]).join('');
  $('hudIcon').className = sp.item === 'perles' ? 'pearl' : 'berry';
  const hint = $('keysHint'); hint.innerHTML = HINTS[sp.mode]; hint.className = 'keys ' + sp.mode; hint.hidden = false;
  $('act').textContent = sp.act; $('act').setAttribute('aria-label', sp.actLabel);
  $('app').classList.toggle('tapmode', touchUI && prog.touch === 'tap' && sp.mode !== 'platform');
  $('app').classList.add('playing');
  state = 'play';
  autosave();
  say(run ? `On reprend : ${d.name.toLowerCase()} !` : d.intro + (L.items.some(f => f.key) ? ' Une clé dorée est cachée ici !' : '') + (L.switches.length ? ' Une porte bloque le chemin : appuie sur le gros bouton rouge pour l’ouvrir.' : ''));
  clearTimeout(hintTimer); hintTimer = setTimeout(() => { hint.hidden = true; }, 8000);
}

resize();
setTouchUI(touchUI);
showParties();
requestAnimationFrame(loop);
