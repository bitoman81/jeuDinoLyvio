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

// Sauvegarde : le vrai localStorage de nx.js (mémoire de sauvegarde de la Switch ; le premier accès
// fait choisir un profil). S'il est refusé, le jeu garde la partie en mémoire au lieu de s'arrêter.
const localStorage = (() => {
  const mem = {}; let real;
  const get = () => {
    if (real === undefined) { swBoot('sauvegarde (choix du profil)'); try { real = globalThis.localStorage || null; } catch (e) { real = null; } }
    return real;
  };
  return {
    getItem(k) { try { const r = get(); if (r) { const v = r.getItem(k); return v === undefined ? null : v; } } catch (e) {} return k in mem ? mem[k] : null; },
    setItem(k, v) { mem[k] = String(v); try { const r = get(); if (r) r.setItem(k, String(v)); } catch (e) {} },
    removeItem(k) { delete mem[k]; try { const r = get(); if (r) r.removeItem(k); } catch (e) {} },
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
