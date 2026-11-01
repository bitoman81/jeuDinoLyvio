document.documentElement.lang = 'fr';

/* ---------- Constantes ---------- */
const T = 48, ROWS = 10, VIEW_H = ROWS * T, GROUND = 8;
const SPEED = 4.2, JUMP = -13.6, GRAV = 0.6, BOUNCE = -17.5;

/* ---------- Espèces : chacune a son mode de jeu ---------- */
const SPECIES = {
  rex: { name: 'T-Rex', spoken: 'Le tyrannosaure', mode: 'platform', label: 'Saute de plateforme en plateforme', item: 'fruits', act: 'Saute', actLabel: 'Sauter', draw: drawRex,
    pal: { dark: '#4d4a24', body: '#7d7a3c', belly: '#d2c493' } },
  trike: { name: 'Tricératops', spoken: 'Le tricératops', mode: 'topdown', label: 'Explore la plaine, vue du ciel', item: 'fruits', act: 'Fonce', actLabel: 'Foncer', draw: drawTrike,
    pal: { dark: '#5b4f3a', body: '#8f7e5e', belly: '#d6c8a6', frill: '#b8642f', frillDark: '#7a3b1a' } },
  ptero: { name: 'Ptérodactyle', spoken: 'Le ptérodactyle', mode: 'shmup', label: 'Vole et lance des graines', item: 'fruits', act: 'Graine', actLabel: 'Lancer une graine', draw: drawPtero,
    pal: { dark: '#6b3f2e', body: '#b0674a', belly: '#ecc7a8', wing: '#c98a62', crest: '#d9452f' } },
  plesio: { name: 'Plésiosaure', spoken: 'Le plésiosaure', mode: 'swim', label: 'Nage au fond de la mer', item: 'perles', act: 'Vite', actLabel: 'Nager plus vite', draw: drawPlesio,
    pal: { dark: '#2f5d6b', body: '#4f8a9c', belly: '#cfe3e0' } },
};
const ORDER = ['rex', 'trike', 'ptero', 'plesio'];
// Couleurs à acheter dans la boutique du nid (les autres teintes de l'animal restent celles d'origine).
const SKINS = {
  rex: [{ id: 'foret', name: 'Vert forêt', price: 15, pal: { dark: '#2f5a2a', body: '#4f8f3c', belly: '#cfe3a8' } }, { id: 'ocean', name: 'Bleu océan', price: 25, pal: { dark: '#24456b', body: '#3f72a8', belly: '#c8dcef' } }, { id: 'lave', name: 'Rouge lave', price: 40, pal: { dark: '#6b2a24', body: '#b0483c', belly: '#f0c8a8' } }],
  trike: [{ id: 'menthe', name: 'Menthe', price: 15, pal: { dark: '#2f6b5a', body: '#4fa88f', belly: '#cfeee3' } }, { id: 'prune', name: 'Prune', price: 25, pal: { dark: '#4a2f5a', body: '#7a4f8f', belly: '#e3cfe9', frill: '#e0a526', frillDark: '#8a5a10' } }, { id: 'or', name: 'Doré', price: 40, pal: { dark: '#7a5a1a', body: '#c9a23a', belly: '#f4e3a8', frill: '#e5483b', frillDark: '#7a1a10' } }],
  ptero: [{ id: 'ciel', name: 'Bleu ciel', price: 15, pal: { dark: '#2f4f6b', body: '#5a8fc0', belly: '#d6e8f6', wing: '#7fb0de', crest: '#ffb238' } }, { id: 'nuit', name: 'Nuit', price: 25, pal: { dark: '#1f2240', body: '#3a3f7a', belly: '#c8c8ec', wing: '#5a5fa8', crest: '#ffd23a' } }, { id: 'flamant', name: 'Flamant rose', price: 40, pal: { dark: '#8a3a5a', body: '#e07aa0', belly: '#fbe0ea', wing: '#f29ab8', crest: '#b23a7a' } }],
  plesio: [{ id: 'corail', name: 'Corail', price: 15, pal: { dark: '#8a4a3a', body: '#e0806a', belly: '#fbe0d6' } }, { id: 'algue', name: 'Algue', price: 25, pal: { dark: '#2f5a2a', body: '#5a9a4a', belly: '#d6efc8' } }, { id: 'perle', name: 'Nacre', price: 40, pal: { dark: '#6a6a8a', body: '#b8b8d8', belly: '#f6f3ff' } }],
};
const POWERS = {
  magnet: { name: 'Aimant', price: 12, text: 'attire les fruits et les perles proches' },
  shield: { name: 'Bouclier', price: 12, text: 'protège des cailloux, des méduses et des ennemis', modes: ['shmup', 'swim'] },
  jump2: { name: 'Double saut', price: 15, text: 'T-Rex : sauter une deuxième fois en l’air', modes: ['platform'] },
  charge: { name: 'Grande charge', price: 15, text: 'tricératops : foncer plus loin et plus vite', modes: ['topdown'] },
  triple: { name: 'Graine triple', price: 15, text: 'ptérodactyle : trois graines d’un coup', modes: ['shmup'] },
  fin: { name: 'Super nageoire', price: 15, text: 'plésiosaure : nager vite plus longtemps', modes: ['swim'] },
};
// Accessoires : achetés une fois, chaque animal porte celui qu'on lui choisit (dessiné sur sa tête).
const ACCESSORIES = [
  { id: 'fleur', name: 'Fleur', price: 10 }, { id: 'casquette', name: 'Casquette', price: 15 },
  { id: 'lunettes', name: 'Lunettes de soleil', price: 20 }, { id: 'pirate', name: 'Chapeau de pirate', price: 30 },
  { id: 'couronne', name: 'Couronne', price: 50 },
];
// Dans le dessin de chaque animal vu de côté : le haut de la tête [x, y] et l'œil [x, y].
const HEAD = { rex: [23, 1, 21, 5], trike: [22, 12, 23, 18], ptero: [20, 11, 20, 15], plesio: [30, 3, 31, 6] };
const HELP_CUT = 5, HELP_HINT = 10;
// Applique la couleur choisie à chaque animal.
function applySkins() {
  ORDER.forEach(w => {
    const sp = SPECIES[w]; sp.base = sp.base || sp.pal;
    const sk = SKINS[w].find(x => x.id === prog.bag.skin[w]);
    sp.pal = sk ? { ...sp.base, ...sk.pal } : sp.base;
    sp.key = w; sp.acc = prog.bag.acc[w] || '';
  });
}

/* ---------- Niveaux ---------- */
const WORLDS = {
  rex: [
    { name: 'La clairière', intro: "La clairière. Avance et saute ! Touche les pierres magiques pour libérer les œufs.",
      sky: ['#9fdcf0', '#e6f7ef'], dirt: '#8a5a2b', dirtDark: '#6e4520', grass: '#4caf50', grassDark: '#2f8a3d', far: '#9cc9b4', mid: '#6fae7c', near: '#3f7f4f',
      puzzles: ['count', 'first', 'sequence'], len: 64, start: 2, nest: 60,
      ground: [[0, 15], [17, 32], [34, 64]], plats: [[6, 5, 3], [21, 5, 3], [25, 3, 2]],
      fruits: [[7, 4], [8, 4], [21, 4], [22, 4], [23, 4], [25, 2], [26, 2], [40, 2], [44, 7], [45, 7], [46, 7]],
      stones: [12, 29, 48], mush: [40], movers: [] },
    { name: 'La rivière', intro: "La rivière. Attention à l'eau, saute bien !",
      sky: ['#8fd0f2', '#dff3fb'], dirt: '#8a5a2b', dirtDark: '#6e4520', grass: '#58b85a', grassDark: '#2f8a3d', far: '#a2c8d8', mid: '#74b28a', near: '#3d7f55',
      puzzles: ['add', 'missing', 'count'], len: 72, start: 2, nest: 68,
      ground: [[0, 12], [15, 27], [31, 44], [47, 58], [61, 72]], plats: [[5, 5, 3], [28, 6, 2], [36, 5, 3], [40, 3, 2], [52, 5, 2], [58, 6, 3]],
      fruits: [[5, 4], [6, 4], [7, 4], [19, 2], [28, 5], [29, 5], [36, 4], [37, 4], [40, 2], [41, 2], [52, 4], [59, 5]],
      stones: [9, 24, 55], mush: [19], movers: [] },
    { name: 'Les fougères géantes', intro: "Les fougères géantes. Monte sur la bûche qui bouge !",
      sky: ['#a8e0c0', '#eaf7e3'], dirt: '#7d5230', dirtDark: '#5f3d22', grass: '#46a24f', grassDark: '#277a35', far: '#93c2a0', mid: '#5f9f6c', near: '#2f6b40',
      puzzles: ['compare', 'hangman', 'add'], len: 78, start: 2, nest: 74,
      ground: [[0, 14], [16, 24], [33, 46], [49, 62], [66, 78]], plats: [[5, 5, 3], [9, 3, 2], [38, 5, 3], [53, 5, 2], [56, 3, 2], [63, 6, 2]],
      fruits: [[9, 2], [10, 2], [27, 4], [28, 4], [38, 4], [39, 4], [40, 4], [36, 2], [56, 2], [57, 2], [63, 5], [70, 7]],
      stones: [12, 43, 59], mush: [36], movers: [{ x: 27, row: 6, w: 3, amp: 3, speed: 1.2 }], switches: [[56, 3, 61]] },
    { name: 'Le volcan', intro: "Le volcan. La maman t'attend au bout du chemin !", volcano: true, key: true,
      sky: ['#f6b37a', '#fde3c4'], dirt: '#5b3b2a', dirtDark: '#432a1d', grass: '#7aa33a', grassDark: '#557a22', far: '#c98a6a', mid: '#8f7a52', near: '#4f5a2e',
      puzzles: ['missing', 'order', 'hangman'], len: 84, start: 2, nest: 80,
      ground: [[0, 12], [14, 22], [31, 40], [43, 52], [60, 70], [73, 84]], plats: [[5, 5, 3], [34, 5, 2], [37, 3, 2], [46, 5, 3], [64, 5, 3]],
      fruits: [[16, 2], [17, 2], [5, 4], [6, 4], [26, 5], [34, 4], [37, 2], [38, 2], [46, 4], [47, 4], [55, 5], [64, 4], [65, 4], [78, 7]],
      stones: [10, 49, 67], mush: [16], movers: [{ x: 24.5, row: 6, w: 3, amp: 2.5, speed: 1.3 }, { x: 54.5, row: 6, w: 3, amp: 2, speed: 1.6 }] },
    { name: 'Le marais', intro: "Le marais. Les rondins tombent dans l'eau : ne reste pas dessus trop longtemps !",
      sky: ['#b9d6b0', '#e8f0d8'], dirt: '#6b5a3a', dirtDark: '#4f422a', grass: '#7a9a3a', grassDark: '#55702a', far: '#a3b896', mid: '#7a9670', near: '#4a6a44',
      puzzles: ['count', 'order', 'add'], len: 80, start: 2, nest: 76,
      ground: [[0, 13], [16, 25], [32, 41], [44, 54], [62, 72], [75, 80]], plats: [[5, 5, 3], [47, 5, 3]],
      fruits: [[5, 4], [6, 4], [7, 4], [20, 2], [27, 6], [28, 6], [38, 7], [47, 4], [48, 4], [49, 4], [56, 6], [59, 5], [60, 5], [69, 7], [73, 6]],
      stones: [10, 36, 66], mush: [20], movers: [], falls: [[27, 7, 2], [56, 7, 2], [59, 6, 2]] },
    { name: 'La nuit', intro: "La nuit. Les lucioles t'éclairent. Saute sur la bûche et sur les rondins !", night: true,
      sky: ['#1c2350', '#46407a'], dirt: '#4a3a3a', dirtDark: '#33282a', grass: '#3f7a5a', grassDark: '#2a5a40', far: '#3a3f6a', mid: '#2f3a5a', near: '#1f2a40',
      puzzles: ['compare', 'hangman', 'missing'], len: 88, start: 2, nest: 84,
      ground: [[0, 12], [15, 23], [30, 38], [41, 50], [58, 66], [69, 78], [81, 88]], plats: [[5, 5, 3], [33, 5, 3], [61, 5, 2]],
      fruits: [[5, 4], [6, 4], [7, 4], [19, 2], [21, 7], [26, 5], [27, 5], [33, 4], [34, 4], [35, 4], [47, 7], [52, 6], [55, 5], [61, 4], [62, 4], [72, 7], [80, 6]],
      stones: [9, 45, 74], mush: [19], movers: [{ x: 25, row: 6, w: 3, amp: 1.5, speed: 1.4 }], falls: [[52, 7, 2], [55, 6, 2]], switches: [[61, 5, 64]] },
    { name: 'La grotte secrète', bonus: true, cave: true, intro: "La grotte secrète ! Elle est pleine de trésors. Ramasse tout ce que tu peux !",
      sky: ['#2a2238', '#4a3a52'], dirt: '#5a4a5a', dirtDark: '#3f3242', grass: '#8a7aa8', grassDark: '#5f5080', far: '#3a3048', mid: '#4a3d5a', near: '#5a4a6a',
      puzzles: ['sequence', 'add', 'hangman'], len: 70, start: 2, nest: 66,
      ground: [[0, 20], [23, 45], [48, 70]], plats: [[5, 5, 3], [14, 5, 3], [27, 6, 3], [31, 4, 2], [38, 5, 3], [52, 5, 3], [60, 5, 2]],
      fruits: [[3, 7], [5, 4], [6, 4], [7, 4], [14, 4], [15, 4], [16, 4], [18, 7], [21, 6], [25, 2], [26, 3], [27, 5], [28, 5], [29, 5], [31, 3], [32, 3], [38, 4], [39, 4], [40, 4], [42, 7], [43, 7], [46, 6], [52, 4], [53, 4], [54, 4], [60, 4], [61, 4], [64, 7]],
      stones: [11, 35, 56], mush: [25], movers: [] },
  ],
  trike: [
    { name: 'La prairie', intro: "La prairie. Promène-toi dans l'herbe. Fonce dans les petits cailloux pour les casser !",
      seed: 11, len: 60, density: .10, rivers: [], small: 4, fruits: 14, gates: [14, 30, 45], nest: 56,
      grass: '#8fcf6a', grass2: '#7aba57', edge: '#2f6b3a', puzzles: ['count', 'first', 'compare'] },
    { name: 'La rivière aux fleurs', intro: "La rivière aux fleurs. Passe sur les ponts pour traverser l'eau.",
      seed: 23, len: 70, density: .15, rivers: [23, 50], small: 5, fruits: 16, gates: [15, 36, 60], nest: 66,
      grass: '#86c766', grass2: '#73b254', edge: '#2a6034', puzzles: ['add', 'missing', 'sequence'] },
    { name: 'La forêt profonde', intro: "La forêt profonde. Trouve le chemin entre les arbres !",
      seed: 37, len: 80, density: .22, rivers: [20, 42, 64], small: 6, fruits: 18, gates: [12, 31, 54], nest: 76, switches: [[35, -2, 38]],
      grass: '#6fae55', grass2: '#5e9a48', edge: '#1f4a2a', puzzles: ['compare', 'hangman', 'order'] },
    { name: 'Le désert', intro: "Le désert. Il fait chaud ! Fais le tour des cactus.", cactus: true, key: true,
      seed: 41, len: 80, density: .14, rivers: [38], small: 8, fruits: 18, gates: [14, 30, 56], nest: 76,
      grass: '#ead39a', grass2: '#dcc07c', edge: '#a8814a', puzzles: ['count', 'add', 'compare'] },
    { name: 'La neige', intro: "La neige. La rivière est gelée : ça glisse !", frozen: true, snowy: true,
      seed: 53, len: 84, density: .16, rivers: [22, 46, 66], small: 6, fruits: 18, gates: [13, 34, 57], nest: 80,
      grass: '#eef4f8', grass2: '#d6e2ec', edge: '#7f97ad', tree: ['#2f5a4a', '#3f7a5f', '#e8f2f8'], puzzles: ['sequence', 'missing', 'add'] },
    { name: 'Le canyon', intro: "Le canyon. Beaucoup de rochers ! Fonce pour casser les petits cailloux.",
      seed: 67, len: 90, density: .26, rivers: [28, 60], small: 10, fruits: 20, gates: [14, 44, 74], nest: 86, switches: [[49, 2, 52]],
      grass: '#d9a070', grass2: '#c98a5a', edge: '#7a4a2a', tree: ['#5a7a3a', '#6f9a45', '#8fbf5a'], puzzles: ['compare', 'order', 'hangman'] },
    { name: 'Le jardin secret', bonus: true, intro: "Le jardin secret ! Il y a des fruits partout.",
      seed: 77, len: 60, density: .06, rivers: [30], small: 3, fruits: 40, gates: [12, 26, 44], nest: 56,
      grass: '#9ad87a', grass2: '#86c766', edge: '#3a7a3a', puzzles: ['first', 'count', 'sequence'] },
  ],
  ptero: [
    { name: 'Au-dessus des arbres', intro: "Au-dessus des arbres. Vole, et lance des graines sur les cailloux volants !",
      seed: 5, len: 5000, speed: 1.8, rocks: .7, sky: ['#8fd3f4', '#e8f7ff'], far: '#a9cbb8', ground: '#3f8a4c', puzzles: ['sequence', 'count', 'first'] },
    { name: 'Dans les nuages', intro: "Dans les nuages. Il y a plus de cailloux, ouvre l'œil !",
      seed: 9, len: 6000, speed: 2.1, rocks: .85, sky: ['#aebff0', '#f3f0ff'], far: '#b7b9d6', ground: '#ffffff', clouds: true, puzzles: ['add', 'missing', 'compare'] },
    { name: 'Le ciel du volcan', intro: "Le ciel du volcan. Vole jusqu'au nid sur la falaise !", volcano: true,
      seed: 14, len: 7000, speed: 2.4, rocks: 1, switches: [[4140, 110, 4400]], sky: ['#f6a46f', '#fde0bf'], far: '#c98a6a', ground: '#4f3a2e', puzzles: ['hangman', 'add', 'order'] },
    { name: 'Le coucher de soleil', intro: "Le coucher de soleil. Le vent souffle, tiens bon !", key: true, sunset: true,
      seed: 19, len: 7000, speed: 2.2, rocks: .9, wind: 1.2, sky: ['#f08a5a', '#fcd9a0'], far: '#b0708a', ground: '#5a3a4a', puzzles: ['count', 'missing', 'sequence'] },
    { name: "L'orage", intro: "L'orage. Il pleut et le vent pousse fort. Courage !", storm: true,
      seed: 27, len: 7500, speed: 2.3, rocks: .95, wind: 1.8, sky: ['#5a6478', '#a8b0c0'], far: '#6a7088', ground: '#3a4a5a', clouds: true, puzzles: ['add', 'compare', 'hangman'] },
    { name: 'Les montagnes enneigées', intro: "Les montagnes enneigées. Vole jusqu'au nid, tout en haut !",
      seed: 33, len: 8000, speed: 2.5, rocks: 1.05, wind: 1, switches: [[4740, 380, 5000]], sky: ['#9fc8ec', '#eef6fc'], far: '#d8e4f0', ground: '#f4f8fc', puzzles: ['order', 'add', 'missing'] },
    { name: "L'arc-en-ciel", bonus: true, rainbow: true, intro: "L'arc-en-ciel secret ! Plein de fruits et presque pas de cailloux.",
      seed: 44, len: 5000, speed: 1.8, rocks: .8, rockRate: .2, sky: ['#9fdcf8', '#f4fbff'], far: '#b8d8c8', ground: '#5aa85a', puzzles: ['first', 'count', 'compare'] },
  ],
  plesio: [
    { name: 'Le lagon', intro: "Le lagon. Nage partout et ramasse les perles. Attention aux méduses !",
      seed: 3, len: 60, pillars: .10, jelly: 3, gates: [14, 30, 46], nest: 55, water: ['#5cc3e6', '#1d6a9a'], rock: '#5f6f86', sand: '#e2cf98', puzzles: ['count', 'first', 'sequence'] },
    { name: "La forêt d'algues", intro: "La forêt d'algues. Glisse entre les rochers !",
      seed: 8, len: 70, pillars: .18, jelly: 5, gates: [15, 35, 55], nest: 65, water: ['#3fa7c9', '#155277'], rock: '#4f5f74', sand: '#d8c38f', puzzles: ['compare', 'missing', 'add'] },
    { name: 'La grotte sous-marine', intro: "La grotte sous-marine. Il fait sombre, reste près des perles !", cave: true,
      seed: 21, len: 78, pillars: .22, jelly: 7, gates: [14, 34, 56], nest: 73, switches: [[42, 0, 45]], water: ['#2a6f95', '#0b2a45'], rock: '#3e4658', sand: '#b9a77a', puzzles: ['order', 'hangman', 'count'] },
    { name: 'Le récif de corail', intro: "Le récif de corail. Les courants te poussent : suis les bulles !", key: true,
      seed: 31, len: 72, pillars: .14, jelly: 4, gates: [14, 34, 54], nest: 67, water: ['#4fd0d8', '#1a7a9a'], rock: '#c8705a', sand: '#f0dca8',
      currents: [[20, 26, 0, -1], [40, 46, 0, 1], [58, 62, 1, 0]], puzzles: ['count', 'add', 'missing'] },
    { name: "L'épave", intro: "L'épave. Un vieux bateau dort au fond de la mer. Attention aux courants !", wreck: 38,
      seed: 45, len: 80, pillars: .18, jelly: 6, gates: [14, 30, 58], nest: 75, water: ['#3a8fb0', '#123e5c'], rock: '#4f5a6a', sand: '#cdb88a',
      currents: [[20, 25, 0, 1], [44, 50, -1, 0], [64, 70, 0, -1]], puzzles: ['compare', 'hangman', 'order'] },
    { name: 'Les grands fonds', intro: "Les grands fonds. Il fait noir, mais les perles brillent !", deep: true,
      seed: 59, len: 86, pillars: .22, jelly: 8, gates: [14, 40, 64], nest: 81, switches: [[44, 0, 47]], water: ['#1f4f78', '#06142a'], rock: '#2f3648', sand: '#8a8070',
      currents: [[24, 30, 0, -1], [50, 56, 0, 1], [70, 76, 1, 0]], puzzles: ['sequence', 'add', 'hangman'] },
    { name: 'La baie aux perles', bonus: true, intro: "La baie aux perles ! Il y en a partout.", pearls: 2,
      seed: 66, len: 60, pillars: .06, jelly: 2, gates: [12, 28, 44], nest: 55, water: ['#6cd4f0', '#2a8ab8'], rock: '#6f7f96', sand: '#f0e0b0', puzzles: ['first', 'count', 'compare'] },
  ],
  // Le monde final : les 4 animaux à la suite, sur l'île de la carte au trésor.
  final: [
    { sp: 'rex', name: "La plage de l'île", intro: "L'île secrète ! Le T-Rex commence l'aventure sur la plage.",
      sky: ['#7fd6f0', '#e6fbff'], dirt: '#c9a46a', dirtDark: '#a8844f', grass: '#5cc06a', grassDark: '#3a9a4a', far: '#8fcfc0', mid: '#5fb08a', near: '#2f8a5a',
      puzzles: ['count', 'add', 'first'], len: 84, start: 2, nest: 80,
      ground: [[0, 14], [17, 26], [33, 42], [45, 54], [62, 70], [73, 84]], plats: [[5, 5, 3], [48, 5, 3]],
      fruits: [[5, 4], [6, 4], [7, 4], [21, 2], [23, 7], [29, 5], [30, 5], [40, 7], [48, 4], [49, 4], [50, 4], [56, 6], [59, 5], [60, 5], [68, 7], [77, 7]],
      stones: [10, 38, 66], mush: [21], movers: [{ x: 28, row: 6, w: 3, amp: 1.5, speed: 1.3 }], falls: [[56, 7, 2], [59, 6, 2]] },
    { sp: 'trike', name: "La jungle de l'île", intro: "Le tricératops traverse la jungle de l'île. Fonce !",
      seed: 88, len: 80, density: .18, rivers: [24, 52], small: 7, fruits: 20, gates: [14, 38, 64], nest: 76,
      grass: '#7ac85a', grass2: '#62b048', edge: '#1f5a2a', tree: ['#1f6a3a', '#2f8a4a', '#4fb05a'], puzzles: ['compare', 'missing', 'sequence'] },
    { sp: 'ptero', name: "Le ciel de l'île", intro: "Le ptérodactyle survole l'île. Le volcan fume au loin !", volcano: true,
      seed: 99, len: 7000, speed: 2.2, rocks: .9, wind: .8, sky: ['#7fc8f4', '#fdf0d8'], far: '#8fae9a', ground: '#2f8a5a', puzzles: ['add', 'order', 'count'] },
    { sp: 'plesio', name: "Le lagon de l'île", intro: "Le plésiosaure nage jusqu'au trésor. Toutes les familles t'attendent !",
      seed: 101, len: 76, pillars: .16, jelly: 5, gates: [14, 34, 56], nest: 71, water: ['#5ad8e6', '#1a6a9a'], rock: '#7a6f8a', sand: '#f4e4b0',
      currents: [[22, 28, 0, -1], [44, 50, 1, 0]], puzzles: ['hangman', 'compare', 'add'] },
  ],
};
// Les endroits secrets (bonus) s'ouvrent avec la clé dorée ; les autres, l'un après l'autre.
const regularCount = wk => WORLDS[wk].filter(d => !d.bonus).length;
const levelSp = (wk, i) => SPECIES[WORLDS[wk][i].sp || wk];
const allMaps = () => ORDER.every(k => prog.bag.maps[k]);
function canPlay(wk, i) {
  const d = WORLDS[wk][i];
  if (!d) return false;
  if (wk === 'final' && !allMaps()) return false;
  return d.bonus ? !!prog.bag.keys[wk] : i < prog.worlds[wk].unlocked;
}

