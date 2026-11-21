// Sound effects and looping music from mp3 files, with Web Audio (sounds can overlap, no lag).
//   import { sound } from './kit/sound.js';
//   sound.play('coin');                          // assets/audio/coin.mp3, one-shot
//   sound.play('coin', { volume: 0.6, pitch: 1.2 });   // pitch 1.2 = 20 % higher, nice for variety
//   sound.music('theme');                        // loops; another sound.music(...) crossfades to it
//   sound.stopMusic();
//   sound.toggleMute();                          // or sound.muted = true
//   sound.preload('coin', 'jump');               // optional: fetch early so the first play isn't late
// A name is a file in assets/audio without .mp3; a path ending in .mp3 is used as-is (relative to the page).
// Browsers stay silent until the player clicks, taps or presses a key, so the audio engine starts on
// that first input (e.g. the PLAY button). Music asked for before then starts on it; sound effects
// from before it are skipped. A missing file plays nothing and warns once: the game never breaks over a sound.

let ctx = null, master, musicBus;
let muted = false;
let current = null;      // { name, source, gain } of the music playing now
let wanted = null;       // { name, volume, fadeSeconds } of the music asked for last
const files = new Map();     // name -> Promise<ArrayBuffer | null>
const decoded = new Map();   // name -> Promise<AudioBuffer | null>
const warned = new Set();

function unlock() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.connect(master);
  }
  if (ctx.state !== 'running') ctx.resume();
  if (wanted && current?.name !== wanted.name) startMusic(wanted);
}
for (const type of ['pointerdown', 'keydown', 'touchstart']) addEventListener(type, unlock, { capture: true });

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
  load(want.name).then((buffer) => {
    if (!buffer || wanted !== want || current?.name === want.name) return;
    if (current) stopCurrent(want.fadeSeconds);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    source.connect(gain).connect(musicBus);
    source.start();
    fade(gain, want.volume, want.fadeSeconds);
    current = { name: want.name, source, gain };
  });
}

function stopCurrent(fadeSeconds) {
  const { source, gain } = current;
  current = null;
  fade(gain, 0, fadeSeconds);
  source.stop(ctx.currentTime + fadeSeconds + 0.05);
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

  music(name, { volume = 0.5, fadeSeconds = 1 } = {}) {
    wanted = { name, volume, fadeSeconds };
    if (!ctx) { fetchFile(name); return; }
    if (current?.name === name) fade(current.gain, volume, fadeSeconds);
    else startMusic(wanted);
  },

  stopMusic(fadeSeconds = 0.5) {
    wanted = null;
    if (current) stopCurrent(fadeSeconds);
  },

  get muted() { return muted; },
  set muted(on) { muted = !!on; if (master) master.gain.value = muted ? 0 : 1; },
  toggleMute() { sound.muted = !muted; return muted; },

  get musicPlaying() { return current?.name ?? null; },
};
