/* ---------- Version Switch (nx.js) : un petit DOM ----------
   nx.js n'a pas de HTML : seulement l'écran (screen) et son canvas. Le code du jeu, lui, manipule des
   éléments HTML (menus, énigmes, HUD). Ces éléments n'affichent rien, mais ils gardent ce que le jeu y
   met : innerHTML devient un petit arbre d'éléments (classes, data-*, styles, onclick), que l'on peut
   chercher avec querySelector(All). La version Switch relit cet arbre pour dessiner les énigmes à l'écran
   et renvoie les clics aux éléments : le code du jeu tourne ainsi sans changement.
   Le canvas « game » du jeu est le vrai écran de la Switch (1280 x 720).
   Pas de console.log ici : dans nx.js, il fait repasser l'écran en mode texte. */
// `window` et `document` sont déclarés dans ce module : le code du jeu, qui suit dans le même module,
// les utilise à la place des globales (cela marche aussi dans Chrome, pour les tests sur ordinateur).
const window = globalThis;
if (typeof globalThis.devicePixelRatio !== 'number') globalThis.devicePixelRatio = 1;
if (typeof globalThis.addEventListener !== 'function') { globalThis.addEventListener = () => {}; globalThis.removeEventListener = () => {}; }
if (!globalThis.performance) globalThis.performance = { now: () => Date.now() };
if (typeof globalThis.matchMedia !== 'function') globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {} });

// Contexte de dessin qui ne dessine rien (pour les petits canvas des menus HTML)
const NOOP = new Proxy(function () {}, {
  get: (t, k) => k === Symbol.toPrimitive ? () => 0 : k === 'then' ? undefined : NOOP,
  apply: () => NOOP, set: () => true,
});

const SW_W = screen.width, SW_H = screen.height;
const swRect = () => ({ left: 0, top: 0, x: 0, y: 0, width: SW_W, height: SW_H, right: SW_W, bottom: SW_H });

/* ---------- Lire du HTML ---------- */
const SW_ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const swDecode = s => s.replace(/&(#\d+|[a-z]+);/g, (m, e) => e[0] === '#' ? String.fromCharCode(+e.slice(1)) : SW_ENT[e] || m);
const swEsc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const SW_VOID = ['br', 'img', 'input', 'hr', 'meta', 'link'];
// Ajoute à `parent` les éléments (SwEl) et les textes ({ t }) décrits par la chaîne html.
function swParseInto(parent, html) {
  const stack = [parent];
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)((?:\s+[\w:-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(String(html)))) {
    const top = stack[stack.length - 1];
    if (m[5] !== undefined) { const t = swDecode(m[5]); if (t.trim()) top.k.push({ t }); continue; }
    if (!m[2]) continue;
    const tag = m[2].toLowerCase();
    if (m[1]) { for (let i = stack.length - 1; i > 0; i--) if (stack[i].tag === tag) { stack.length = i; break; } continue; }
    const el = new SwEl(tag), ar = /([\w:-]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g; let am;
    while ((am = ar.exec(m[3]))) el.a[am[1].toLowerCase() === 'viewbox' ? 'viewBox' : am[1]] = am[2] === undefined ? '' : swDecode(am[2].replace(/^["']|["']$/g, ''));
    el.parentNode = top; top.k.push(el);
    if (!m[4] && !SW_VOID.includes(tag)) stack.push(el);
  }
  return parent;
}
const swTextOf = n => n.t !== undefined ? n.t : (n.k || []).map(swTextOf).join('');
const swHtmlOf = n => n.t !== undefined ? swEsc(n.t)
  : `<${n.tag}${Object.entries(n.a).map(([k, v]) => ` ${k}="${swEsc(v)}"`).join('')}>${SW_VOID.includes(n.tag) ? '' : n.k.map(swHtmlOf).join('') + `</${n.tag}>`}`;

/* ---------- Chercher des éléments (les sélecteurs que le jeu utilise) ----------
   Balise, #id, .classe, [attribut], [attribut="valeur"], :not(...), descendants, et listes « a, b ». */
function swCompound(s) {
  const parts = [], re = /^([a-zA-Z*][\w-]*)|#([\w-]+)|\.([\w-]+)|\[([\w-]+)(?:=["']?([^"'\]]*)["']?)?\]|:not\(([^)]*)\)/g; let m;
  while ((m = re.exec(s)) && m[0]) parts.push(m);
  return el => el.tag && parts.every(m =>
    m[1] ? m[1] === '*' || el.tag === m[1].toLowerCase()
      : m[2] ? el.a.id === m[2]
        : m[3] ? el.classList.contains(m[3])
          : m[4] ? (m[5] === undefined ? m[4] in el.a : el.a[m[4]] === m[5])
            : !swCompound(m[6])(el));
}
function swMatcher(sel) {
  const alts = sel.split(',').map(s => s.trim().split(/\s+/).map(swCompound));
  return el => alts.some(chain => {
    if (!chain[chain.length - 1](el)) return false;
    let i = chain.length - 2, p = el.parentNode;
    while (i >= 0 && p) { if (p.tag && chain[i](p)) i--; p = p.parentNode; }
    return i < 0;
  });
}
// Retire un nœud (élément ou texte) de son parent.
function swDetach(c) { const p = c && c.parentNode; if (p && p.k) { const i = p.k.indexOf(c); if (i >= 0) p.k.splice(i, 1); } if (c) c.parentNode = null; }
function swWalk(n, fn) { (n.k || []).forEach(k => { if (k.tag) { fn(k); swWalk(k, fn); } }); }

/* ---------- Un élément ---------- */
class SwEl {
  constructor(tag = 'div') {
    this.tag = String(tag).toLowerCase(); this.a = {}; this.k = []; this.parentNode = null;
    this.style = { setProperty() {}, removeProperty() {} }; this.hidden = false; this.value = ''; this.type = '';
    this.width = 300; this.height = 150; this.on = {};
  }
  get tagName() { return this.tag.toUpperCase(); }
  get nodeName() { return this.tagName; }
  get nodeType() { return 1; }
  get id() { return this.a.id || ''; } set id(v) { this.a.id = String(v); }
  get className() { return this.a.class || ''; } set className(v) { this.a.class = String(v); }
  get classList() {
    const el = this, get = () => (el.a.class || '').split(/\s+/).filter(Boolean), put = l => { el.a.class = l.join(' '); };
    return {
      add: (...c) => put([...new Set([...get(), ...c])]),
      remove: (...c) => put(get().filter(x => !c.includes(x))),
      toggle: (c, on) => { const has = get().includes(c); on = on === undefined ? !has : !!on; if (on !== has) (on ? put([...get(), c]) : put(get().filter(x => x !== c))); return on; },
      contains: c => get().includes(c),
    };
  }
  get dataset() {
    const a = this.a, key = k => 'data-' + k.replace(/[A-Z]/g, c => '-' + c.toLowerCase());
    return new Proxy({}, { get: (t, k) => typeof k === 'string' ? a[key(k)] : undefined, set: (t, k, v) => { a[key(k)] = String(v); return true; } });
  }
  get disabled() { return 'disabled' in this.a; } set disabled(v) { if (v) this.a.disabled = ''; else delete this.a.disabled; }
  get children() { return this.k.filter(k => k.tag); }
  get childNodes() { return this.k; }
  get firstChild() { return this.k[0] || null; }
  get firstElementChild() { return this.children[0] || null; }
  get textContent() { return swTextOf(this); }
  set textContent(v) { this.k = v === '' || v == null ? [] : [{ t: String(v) }]; }
  get innerText() { return this.textContent; } set innerText(v) { this.textContent = v; }
  get innerHTML() { return this.k.map(swHtmlOf).join(''); }
  set innerHTML(v) { this.k = []; swParseInto(this, v); }
  get outerHTML() { return swHtmlOf(this); }
  get offsetWidth() { return 0; } get offsetHeight() { return 0; }
  setAttribute(k, v) { this.a[k] = String(v); }
  getAttribute(k) { return k in this.a ? this.a[k] : null; }
  removeAttribute(k) { delete this.a[k]; }
  hasAttribute(k) { return k in this.a; }
  toggleAttribute(k, on) { on = on === undefined ? !(k in this.a) : !!on; if (on) this.a[k] = ''; else delete this.a[k]; return on; }
  appendChild(c) { if (c) { swDetach(c); c.parentNode = this; this.k.push(c); } return c; }
  append(...cs) { cs.forEach(c => this.appendChild(typeof c === 'string' ? { t: c } : c)); }
  prepend(...cs) { cs.reverse().forEach(c => { const n = typeof c === 'string' ? { t: c } : c; swDetach(n); n.parentNode = this; this.k.unshift(n); }); }
  insertBefore(c, ref) { swDetach(c); c.parentNode = this; const i = this.k.indexOf(ref); if (i < 0) this.k.push(c); else this.k.splice(i, 0, c); return c; }
  removeChild(c) { const i = this.k.indexOf(c); if (i >= 0) this.k.splice(i, 1); c.parentNode = null; return c; }
  replaceChildren(...cs) { this.k = []; this.append(...cs); }
  remove() { swDetach(this); }
  contains(n) { for (let p = n; p; p = p.parentNode) if (p === this) return true; return false; }
  querySelectorAll(sel) { const m = swMatcher(sel), out = []; swWalk(this, el => { if (m(el)) out.push(el); }); return out; }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  closest(sel) { const m = swMatcher(sel); for (let p = this; p && p.tag; p = p.parentNode) if (m(p)) return p; return null; }
  matches(sel) { return swMatcher(sel)(this); }
  addEventListener(type, fn) { (this.on[type] = this.on[type] || []).push(fn); }
  removeEventListener(type, fn) { this.on[type] = (this.on[type] || []).filter(f => f !== fn); }
  dispatchEvent(e) { (this.on[e.type] || []).forEach(fn => fn(e)); return true; }
  // Un clic : onclick de l'élément, puis les écouteurs « click » de l'élément et de ses parents.
  click() {
    const e = { type: 'click', target: this, currentTarget: this, preventDefault() {}, stopPropagation() { this.stop = true; } };
    if (this.disabled) return;
    if (typeof this.onclick === 'function') this.onclick(e);
    for (let p = this; p && p.tag && !e.stop; p = p.parentNode) { e.currentTarget = p; (p.on.click || []).forEach(fn => fn(e)); }
  }
  focus() {} blur() {} select() {} scrollIntoView() {} setPointerCapture() {} releasePointerCapture() {}
  add() {} get options() { return []; }
  getBoundingClientRect() { return swRect(); }
  getContext() { return NOOP; }
  animate() { return { finished: Promise.resolve(), cancel() {} }; }
}
const fakeEl = tag => new SwEl(tag);

// Le canvas du jeu : le vrai écran. On garde ses écouteurs de doigt pour leur envoyer le tactile.
const swCanvasListeners = {};
const swGameCanvas = Object.assign(new SwEl('canvas'), {
  width: SW_W, height: SW_H,
  getContext: () => screen.getContext('2d'),
  addEventListener: (type, fn) => { (swCanvasListeners[type] = swCanvasListeners[type] || []).push(fn); },
});

// Sauvegarde : un fichier sur la carte SD. On ne touche jamais au localStorage de nx.js : son premier
// accès ouvre le choix du profil dans une boucle `while (!profile)` qui tourne sans fin si le sélecteur
// ne s'affiche pas (écran noir au lancement). Hors Switch (tests sur ordinateur), la partie reste en mémoire.
const SW_SAVE_DIR = 'sdmc:/switch/dino-explorateur/', SW_SAVE = SW_SAVE_DIR + 'sauvegarde.json';
const localStorage = (() => {
  const fs = globalThis.Switch;
  let mem = {};
  try {
    const raw = fs && fs.readFileSync(SW_SAVE);
    const txt = !raw ? '' : typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
    if (txt) mem = JSON.parse(txt) || {};
  } catch (e) { mem = {}; }
  const flush = () => {
    if (!fs) return;
    try { fs.mkdirSync(SW_SAVE_DIR); } catch (e) {}
    try { fs.writeFileSync(SW_SAVE, JSON.stringify(mem)); } catch (e) {}
  };
  return {
    getItem: k => Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null,
    setItem(k, v) { mem[k] = String(v); flush(); },
    removeItem(k) { delete mem[k]; flush(); },
  };
})();

// Les éléments du jeu, par id (créés à la première demande). Le body les contient tous,
// pour que document.querySelectorAll les trouve.
const swEls = {};
const swBody = new SwEl('body');
const document = ({
  getElementById: id => {
    if (id === 'game') return swGameCanvas;
    if (!swEls[id]) { const el = swEls[id] = new SwEl('div'); el.a.id = id; swBody.appendChild(el); }
    return swEls[id];
  },
  createElement: tag => new SwEl(tag), createTextNode: t => ({ t: String(t) }),
  querySelector: sel => swBody.querySelector(sel), querySelectorAll: sel => swBody.querySelectorAll(sel),
  addEventListener() {}, removeEventListener() {},
  documentElement: new SwEl('html'), body: swBody, visibilityState: 'visible', execCommand: () => false,
});
