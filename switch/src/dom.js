/* ---------- Version Switch (nx.js) : un faux DOM ----------
   nx.js n'a pas de HTML : seulement l'écran (screen) et son canvas. Le code du jeu, lui, manipule des
   éléments HTML (menus, énigmes, HUD). Ces éléments factices acceptent tout sans rien afficher : ainsi
   le code du jeu tourne sans changement, et la version Switch dessine elle-même ce qu'il faut à l'écran.
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

function fakeEl(tag = 'div') {
  const set = new Set();
  return {
    tagName: String(tag).toUpperCase(), style: { setProperty() {}, removeProperty() {} }, dataset: {},
    hidden: false, disabled: false, textContent: '', innerHTML: '', value: '', className: '', children: [], childNodes: [],
    classList: {
      add: (...c) => c.forEach(x => set.add(x)), remove: (...c) => c.forEach(x => set.delete(x)),
      toggle: (c, on) => { on = on === undefined ? !set.has(c) : !!on; if (on) set.add(c); else set.delete(c); return on; },
      contains: c => set.has(c),
    },
    setAttribute() {}, getAttribute: () => null, removeAttribute() {}, hasAttribute: () => false,
    addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true,
    appendChild: c => c, append() {}, prepend() {}, remove() {}, insertBefore: c => c, replaceChildren() {},
    querySelector: () => null, querySelectorAll: () => [], closest: () => null,
    focus() {}, blur() {}, click() {}, select() {}, scrollIntoView() {}, add() {}, options: [],
    getBoundingClientRect: swRect, getContext: () => NOOP,
    setPointerCapture() {}, releasePointerCapture() {},
  };
}

// Le canvas du jeu : le vrai écran. On garde ses écouteurs de doigt pour leur envoyer le tactile.
const swCanvasListeners = {};
const swGameCanvas = Object.assign(fakeEl('canvas'), {
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

const swEls = {};
const document = ({
  getElementById: id => id === 'game' ? swGameCanvas : (swEls[id] = swEls[id] || fakeEl()),
  createElement: fakeEl, createTextNode: () => fakeEl('#text'),
  querySelector: () => null, querySelectorAll: () => [],
  addEventListener() {}, removeEventListener() {},
  documentElement: fakeEl('html'), body: fakeEl('body'), visibilityState: 'visible', execCommand: () => false,
});
