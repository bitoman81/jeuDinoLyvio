/* ---------- Son ---------- */
let actx = null, voice = null;
function audio() {
  if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (actx && actx.state === 'suspended') actx.resume();
  return actx;
}
function tone(f, d, type = 'sine', f2 = null, vol = .15, delay = 0) {
  const a = audio(); if (!a || !prog.sound) return;
  const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + d + .03);
}
const SFX = {
  jump: () => tone(380, .18, 'square', 720, .05),
  fruit: () => { tone(880, .08, 'triangle', null, .12); tone(1320, .12, 'triangle', null, .12, .07); },
  boing: () => tone(180, .35, 'sine', 620, .2),
  no: () => tone(240, .25, 'sawtooth', 160, .05),
  yay: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, .2, 'triangle', null, .14, i * .1)),
  splash: () => { tone(700, .3, 'sine', 120, .12); tone(300, .25, 'triangle', 90, .08, .05); },
  key: () => tone(660, .1, 'triangle', null, .12),
  pop: () => tone(420, .14, 'triangle', 900, .12),
  crack: () => { tone(160, .12, 'square', 70, .08); tone(90, .2, 'triangle', 50, .1, .05); },
  bonk: () => tone(170, .22, 'sine', 90, .16),
};

/* ---------- Voix ---------- */
// Les voix "naturelles" (Edge), Google (Chrome) ou "améliorées" (Apple) passent devant les voix de base.
let voices = [], sayId = 0;
function scoreVoice(v) {
  let s = /^fr[-_]FR/i.test(v.lang) ? 3 : 1;
  if (/natural|neural/i.test(v.name)) s += 10;
  if (/online/i.test(v.name)) s += 6;
  if (/google/i.test(v.name)) s += 5;
  if (/premium|enhanced|amélior/i.test(v.name)) s += 5;
  if (/compact|espeak/i.test(v.name)) s -= 4;
  return s;
}
function loadVoices() {
  try { voices = speechSynthesis.getVoices().filter(v => /^fr/i.test(v.lang)).sort((a, b) => scoreVoice(b) - scoreVoice(a)); } catch (e) { voices = []; }
  voice = voices.find(v => v.name === prog.voice) || voices[0] || null;
  const sel = $('voiceSel'); sel.innerHTML = '';
  if (!voices.length) { sel.add(new Option('Voix française de base')); return; }
  voices.forEach(v => sel.add(new Option(v.name.replace(/^(Microsoft|Google)\s+/, '') + (scoreVoice(v) >= 8 ? ' (naturelle)' : ''), v.name)));
  if (voice) sel.value = voice.name;
}
if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
// Corrections de prononciation pour les voix de synthèse
const SAY_FIX = [[/œufs|oeufs/gi, 'eux'], [/œuf|oeuf/gi, 'euf']];
// Nom des lettres écrit avec de vrais mots qui se prononcent pareil : sinon la voix épelle « èl » (« E accent grave L »).
const LETTER = { A: 'a', B: 'bé', C: 'cé', D: 'dé', E: 'eu', F: 'effe', G: 'gé', H: 'hache', I: 'i', J: 'ji', K: 'ka', L: 'elle', M: 'aime', N: 'haine', O: 'o', P: 'pé', Q: 'cu', R: 'air', S: 'esse', T: 'té', U: 'u', V: 'vé', W: 'double vé', X: 'ixe', Y: 'i grec', Z: 'zède' };
const letterName = l => LETTER[l] || l;
function say(text) {
  if (!prog.sound || !('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    let t = text; SAY_FIX.forEach(([r, s]) => { t = t.replace(r, s); });
    const u = new SpeechSynthesisUtterance(t);
    u.lang = voice ? voice.lang : 'fr-FR'; if (voice) u.voice = voice; u.rate = .95; u.pitch = 1;
    const id = ++sayId;
    setTimeout(() => { if (id === sayId) speechSynthesis.speak(u); }, 50);
  } catch (e) {}
}
const HELLO = "Bonjour ! Je vais t'aider à retrouver les œufs des dinosaures.";
$('voiceSel').onchange = e => { voice = voices.find(v => v.name === e.target.value) || voice; prog.voice = voice ? voice.name : ''; save(); say(HELLO); };
$('voiceTest').onclick = () => { audio(); say(HELLO); };
/* ---------- Musique ----------
   Une petite musique par animal (et une pour le menu), calculée par le jeu : pas de fichier à charger,
   et pas d'oscillateur (la Switch n'en a pas). Chaque morceau est écrit une fois dans un AudioBuffer
   (accords doux, basse, mélodie tirée au sort mais toujours la même), puis rejoué bout à bout.
   Elle joue si le son et la musique sont activés ; la voix et les bruitages passent par-dessus. */
const SONGS = {
  menu: { key: 60, bpm: 88, seed: 3, mel: 12, dens: .55, pad: .9 },
  rex: { key: 67, bpm: 112, seed: 11, mel: 12, dens: .8, pad: .7 },
  trike: { key: 62, bpm: 100, seed: 23, mel: 12, dens: .7, pad: .8 },
  ptero: { key: 65, bpm: 96, seed: 37, mel: 24, dens: .6, pad: 1 },
  plesio: { key: 63, bpm: 76, seed: 41, mel: 12, dens: .45, pad: 1.2 },
};
const MUSIC_VOL = .16;
const SONG_CACHE = {};
// Un morceau de 8 mesures (accords I V vi IV, deux fois), mono, à la fréquence du son de l'appareil.
// Il est calculé petit à petit (quelques notes à chaque image) pour ne pas faire saccader le jeu :
// songJob prépare la liste des notes, songWork en écrit pendant « budget » millisecondes.
const SINE = new Float32Array(2048).map((_, k) => Math.sin(2 * Math.PI * k / 2048));
function songJob(a, name) {
  const S = SONGS[name], rate = a.sampleRate, beat = 60 / S.bpm, n = Math.round(8 * 4 * beat * rate);
  const buf = a.createBuffer(1, n, rate), notes = [];
  let rnd = S.seed; const R = () => { rnd = (rnd * 16807) % 2147483647; return rnd / 2147483647; };
  const MAJ = [0, 2, 4, 5, 7, 9, 11], prog4 = [0, 4, 5, 3];
  const note = (m, t0, dur, vol, wave, att, fall) => notes.push({ m, t0, dur, vol, wave, att, fall });
  const chordTone = (deg, k) => S.key + MAJ[(deg + k * 2) % 7] + 12 * Math.floor((deg + k * 2) / 7);
  let last = S.key + S.mel + 4;
  const melody = [];
  for (let bar = 0; bar < 4; bar++) {
    const deg = prog4[bar];
    for (let b = 0; b < 4; b++) for (let h = 0; h < 2; h++) {
      if (R() > S.dens * (h ? .6 : 1)) continue;
      // Note proche de la précédente, souvent dans l'accord ; gamme pentatonique pour rester doux
      const pool = [0, 1, 2].map(k => chordTone(deg, k) + S.mel).concat([0, 2, 4, 7, 9].map(x => S.key + S.mel + x));
      pool.sort((x, y) => Math.abs(x - last) - Math.abs(y - last));
      last = pool[Math.floor(R() * Math.min(4, pool.length))];
      melody.push([bar, b + h / 2, last]);
    }
  }
  for (let rep = 0; rep < 2; rep++) {
    for (let bar = 0; bar < 4; bar++) {
      const deg = prog4[bar], t = (rep * 4 + bar) * 4 * beat;
      [0, 1, 2].forEach(k => note(chordTone(deg, k) - 12, t, 4 * beat - .3, .045 * S.pad, 'sin', .35, .4));
      note(S.key + MAJ[deg] - 24, t, beat * 1.6, .13, 'tri', .01, .25);
      note(S.key + MAJ[deg] - 24 + 7, t + 2 * beat, beat * 1.6, .1, 'tri', .01, .25);
    }
    // Deuxième fois : la même mélodie, la fin de chaque phrase une note plus haut
    melody.forEach(([bar, b, m]) => note(m + (rep && b >= 3 ? 2 : 0), ((rep * 4 + bar) * 4 + b) * beat, beat * .45, .11, 'tri', .008, .18));
  }
  return { name, buf, out: buf.getChannelData(0), n, rate, notes, k: 0, done: false };
}
// Une note : forme d'onde, enveloppe (attaque, tenue, chute), ajoutée au morceau (ce qui dépasse repart au début)
function songNote(J, { m, t0, dur, vol, wave, att, fall }) {
  const { out, n, rate } = J, step = 440 * Math.pow(2, (m - 69) / 12) / rate;
  const iAtt = Math.max(1, Math.round(att * rate)), iDur = Math.round(dur * rate), len = iDur + Math.round(fall * 3 * rate);
  const decay = Math.exp(-1 / (fall * rate));
  let ph = 0, env = 0, at = Math.round(t0 * rate) % n;
  for (let i = 0; i < len; i++) {
    env = i < iAtt ? i / iAtt : i < iDur ? 1 : env * decay;
    const w = wave === 'tri' ? 1 - 4 * Math.abs(ph - .5) : SINE[(ph * 2048) | 0];
    out[at] += w * vol * env;
    ph += step; if (ph >= 1) ph -= 1;
    if (++at === n) at = 0;
  }
}
function songWork(J, budget) {
  const t0 = performance.now();
  while (J.k < J.notes.length) {
    songNote(J, J.notes[J.k++]);
    if (performance.now() - t0 > budget) return false;
  }
  if (!J.done) {
    let peak = 0; for (let i = 0; i < J.n; i++) peak = Math.max(peak, Math.abs(J.out[i]));
    if (peak > .95) for (let i = 0; i < J.n; i++) J.out[i] *= .95 / peak;
    J.done = true; SONG_CACHE[J.name] = J.buf;
  }
  return true;
}
// Tout de suite (tests) ; dans le jeu, musicTick le fait petit à petit.
function songBuffer(a, name) {
  if (SONG_CACHE[name] && SONG_CACHE[name].sampleRate === a.sampleRate) return SONG_CACHE[name];
  const J = songJob(a, name); songWork(J, Infinity); return J.buf;
}
const music = { theme: '', next: 0, gain: null, srcs: [], job: null };
function musicWanted() {
  if (!prog.sound || !prog.music || document.visibilityState === 'hidden') return '';
  if (L && state !== 'menu') return SONGS[L.sp.key] ? L.sp.key : 'menu';
  return 'menu';
}
function musicStop() {
  const a = actx;
  if (music.gain && a) { try { music.gain.gain.setValueAtTime(0, a.currentTime); } catch (e) {} }
  music.srcs.forEach(src => { try { src.stop(); } catch (e) {} });
  music.srcs = []; music.gain = null; music.theme = '';
}
// Appelé à chaque image : change de morceau si besoin, le calcule petit à petit, puis prépare la suite à l'avance.
function musicTick() {
  const a = actx; if (!a || a.state === 'suspended') return;
  const want = musicWanted();
  if (want !== music.theme) {
    musicStop();
    if (!want) return;
    music.gain = a.createGain(); music.gain.gain.setValueAtTime(MUSIC_VOL, a.currentTime); music.gain.connect(a.destination);
    music.theme = want; music.next = 0;
  }
  if (!music.theme) return;
  const cached = SONG_CACHE[music.theme];
  if (!cached || cached.sampleRate !== a.sampleRate) {
    if (!music.job || music.job.name !== music.theme) music.job = songJob(a, music.theme);
    if (!songWork(music.job, 4)) return;
    music.job = null;
  }
  const buf = SONG_CACHE[music.theme];
  if (!music.next) music.next = a.currentTime + .1;
  if (a.currentTime > music.next - 1.5) {
    const src = a.createBufferSource();
    src.buffer = buf; src.connect(music.gain); src.start(music.next);
    music.srcs = music.srcs.slice(-1).concat(src);
    music.next += buf.duration;
  }
}
function toggleMusic() { prog.music = !prog.music; save(); setSoundIcons(); }
function setSoundIcons() {
  ['btnSound', 'menuSound'].forEach(id => { $(id).innerHTML = prog.sound ? IC.sound : IC.mute; $(id).setAttribute('aria-label', prog.sound ? 'Couper le son' : 'Activer le son'); });
  const mb = $('menuMusic'); mb.innerHTML = prog.music ? IC.music : IC.musicOff; mb.setAttribute('aria-label', prog.music ? 'Couper la musique' : 'Mettre la musique'); mb.setAttribute('aria-pressed', prog.music);
}
function toggleSound() { prog.sound = !prog.sound; save(); setSoundIcons(); if (!prog.sound && 'speechSynthesis' in window) speechSynthesis.cancel(); else say('Le son est activé.'); }

