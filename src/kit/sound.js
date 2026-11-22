// Sound effects and looping music from mp3 files, with Web Audio (sounds can overlap, no lag).
//   import { sound } from './kit/sound.js';
//   sound.play('coin');                          // assets/audio/coin.mp3, one-shot
//   sound.play('coin', { volume: 0.6, pitch: 1.2 });   // pitch 1.2 = 20 % higher, nice for variety
//   sound.music('theme');                        // loops; another sound.music(...) crossfades to it
//   sound.music('theme', { intro: 'theme-intro', introSeconds: 6.4, loopEnd: 32 })
//        // plays theme-intro first (only the first time), then the loop starts exactly introSeconds in;
//        // loopEnd (seconds) trims a tail off the loop. Both are timed on the audio clock, so a later
//        // sound.music/stopMusic cancels them cleanly (no leftover timers).
//   sound.stopMusic();
//   sound.toggleMute();                          // or sound.muted = true
//   sound.preload('coin', 'jump');               // optional: fetch early so the first play isn't late
//   sound.unlock();                              // call inside a click/tap handler to start the audio engine
//   sound.engine();                              // { ctx, out } for code-made bleeps (shares the mute), or null
// A name is a file in assets/audio without .mp3; a path ending in .mp3 is used as-is (relative to the page).
// Browsers stay silent until the player clicks, taps or presses a key, so the audio engine starts on
// that first input (e.g. the PLAY button). Music asked for before then starts on it; sound effects
// from before it are skipped. A missing file plays nothing and warns once: the game never breaks over a sound.

let ctx = null, master, musicBus;
let muted = false;
let current = null;      // { name, source, gain } of the music playing now
let wanted = null;       // { name, volume, fadeSeconds, intro, introSeconds, loopEnd } of the music asked for last
const introsPlayed = new Set();   // an intro plays once per page visit
const files = new Map();     // name -> Promise<ArrayBuffer | null>
const decoded = new Map();   // name -> Promise<AudioBuffer | null>
const warned = new Set();

// Must run inside a real click, tap or key press (browsers only allow sound to start there).
function unlock() {
  if (!ctx) {
    try { ctx = new AudioContext(); } catch { return; }
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.connect(master);
    // a silent blip started inside the tap: older iPhones only wake the audio this way
    const blip = ctx.createBufferSource();
    blip.buffer = ctx.createBuffer(1, 1, 22050);
    blip.connect(ctx.destination);
    blip.start();
  }
  if (ctx.state !== 'running') ctx.resume().catch(() => {});   // can be refused; the next tap tries again
  if (wanted && current?.name !== wanted.name) startMusic(wanted);
}
for (const type of ['pointerdown', 'pointerup', 'click', 'keydown', 'touchstart', 'touchend']) addEventListener(type, unlock, { capture: true });
// Back to the tab (or the phone woke up): resume if the browser paused the audio. If it says no, the next tap does it.
document.addEventListener('visibilitychange', () => {
  if (ctx && !document.hidden && ctx.state !== 'running') ctx.resume().catch(() => {});
});

function url(name) {
  return name.endsWith('.mp3') ? new URL(name, document.baseURI).href
    : new URL(`../../assets/audio/${name}.mp3`, import.meta.url).href;
}

function warn(name, err) {
  if (!warned.has(name)) { warned.add(name); console.warn(`sound: "${name}" not loaded (${err.message})`); }
  return null;
}

function fetchFile(name) {
  if (!files.has(name)) {
    files.set(name, fetch(url(name))
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer(); })
      .catch((err) => warn(name, err)));
  }
  return files.get(name);
}

function load(name) {   // needs the audio engine (after the first input)
  if (!decoded.has(name)) {
    decoded.set(name, fetchFile(name).then((data) => data && ctx.decodeAudioData(data.slice(0)))
      .catch((err) => warn(name, err)));
  }
  return decoded.get(name);
}

function fade(gain, to, seconds) {
  const now = ctx.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(to, now + seconds);
}

function startMusic(want) {
  const withIntro = want.intro && !introsPlayed.has(want.intro);
  Promise.all([load(want.name), withIntro ? load(want.intro) : null]).then(([buffer, introBuffer]) => {
    if (!buffer || wanted !== want || current?.name === want.name) return;
    if (current) stopCurrent(want.fadeSeconds);
    const gain = ctx.createGain();
    gain.connect(musicBus);
    const sources = [];
    const add = (buf, out = gain) => { const s = ctx.createBufferSource(); s.buffer = buf; s.connect(out); sources.push(s); return s; };
    let at = ctx.currentTime;
    if (introBuffer && !introsPlayed.has(want.intro)) {
      introsPlayed.add(want.intro);
      const introGain = ctx.createGain();
      introGain.connect(gain);
      const intro = add(introBuffer, introGain);
      intro.start(at);
      at += Math.min(want.introSeconds ?? introBuffer.duration, introBuffer.duration);
      // the loop comes in on the beat while the intro's last chord rings out under it
      introGain.gain.setValueAtTime(1, at);
      introGain.gain.linearRampToValueAtTime(0, at + 0.6);
      intro.stop(at + 0.65);
    }
    const source = add(buffer);
    source.loop = true;
    if (want.loopEnd && want.loopEnd < buffer.duration) source.loopEnd = want.loopEnd;
    source.start(at);
    gain.gain.value = 0;
    fade(gain, want.volume, sources.length > 1 ? 0.05 : want.fadeSeconds);
    current = { name: want.name, sources, gain };
  });
}

function stopCurrent(fadeSeconds) {
  const { sources, gain } = current;
  current = null;
  fade(gain, 0, fadeSeconds);
  for (const s of sources) s.stop(ctx.currentTime + fadeSeconds + 0.05);   // also cancels a loop not started yet
}

export const sound = {
  preload(...names) { names.forEach((n) => (ctx ? load(n) : fetchFile(n))); },

  play(name, { volume = 1, pitch = 1 } = {}) {
    if (!ctx) { fetchFile(name); return; }
    load(name).then((buffer) => {
      if (!buffer || ctx.state !== 'running') return;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = pitch;
      const gain = ctx.createGain();
      gain.gain.value = volume;
      source.connect(gain).connect(master);
      source.start();
    });
  },

  unlock,
  engine() { return ctx && ctx.state === 'running' ? { ctx, out: master } : null; },
  get running() { return ctx?.state === 'running'; },

  music(name, { volume = 0.5, fadeSeconds = 1, intro = null, introSeconds = null, loopEnd = null } = {}) {
    wanted = { name, volume, fadeSeconds, intro, introSeconds, loopEnd };
    if (!ctx) { fetchFile(name); return; }
    if (current?.name === name) fade(current.gain, volume, fadeSeconds);
    else startMusic(wanted);
  },

  stopMusic(fadeSeconds = 0.5) {
    wanted = null;
    if (current) stopCurrent(fadeSeconds);
  },

  get muted() { return muted; },
  set muted(on) {
    muted = !!on;
    if (master) { master.gain.cancelScheduledValues(0); master.gain.value = muted ? 0 : 1; }
  },
  toggleMute() { sound.muted = !muted; return muted; },

  get musicPlaying() { return current?.name ?? null; },
};
