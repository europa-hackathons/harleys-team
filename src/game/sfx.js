// Tiny made-up sound effects with Web Audio (no files needed). They play through src/kit/sound.js's
// audio engine, so the mute (M key, sound button) covers them and a phone only has one audio engine.
import { sound } from '../kit/sound.js';

// Kept for older callers: muting now happens in sound.js for everything.
export function muteBleeps() {}

// Call from a click or key press: browsers keep sound off until the player does something.
export function wakeSound() { sound.unlock(); }

function tone({ type = 'square', from = 440, to = from, time = 0.15, volume = 0.15, delay = 0 }) {
  const e = sound.engine();
  if (!e) return;
  const ac = e.ctx;
  const t = ac.currentTime + delay;
  const osc = ac.createOscillator(), gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + time);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + time);
  osc.connect(gain).connect(e.out);
  osc.start(t);
  osc.stop(t + time + 0.02);
}

function noise(time = 0.2, volume = 0.12, freq = 900) {
  const e = sound.engine();
  if (!e) return;
  const ac = e.ctx;
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * time), ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ac.createBufferSource(), gain = ac.createGain(), filter = ac.createBiquadFilter();
  filter.type = 'bandpass'; filter.frequency.value = freq;
  gain.gain.value = volume;
  src.buffer = buf;
  src.connect(filter).connect(gain).connect(e.out);
  src.start();
}

export const sfx = {
  whoosh: () => { noise(0.25, 0.18); tone({ type: 'sawtooth', from: 180, to: 520, time: 0.2, volume: 0.05 }); },
  pow: () => { tone({ from: 300, to: 60, time: 0.18, volume: 0.2 }); noise(0.12, 0.25); },
  boing: () => { tone({ type: 'sine', from: 200, to: 600, time: 0.12, volume: 0.25 }); tone({ type: 'sine', from: 600, to: 250, time: 0.25, volume: 0.2, delay: 0.12 }); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone({ from: f, time: 0.2, volume: 0.12, delay: i * 0.12 })),
  // the sumo finish: whistling down, the big FLOMP, and a little hop
  whistle: () => tone({ type: 'sine', from: 1600, to: 260, time: 0.85, volume: 0.12, delay: 0.2 }),
  thump: () => { tone({ type: 'triangle', from: 140, to: 40, time: 0.4, volume: 0.4 }); noise(0.35, 0.3); },
  hop: () => tone({ type: 'sine', from: 300, to: 700, time: 0.15, volume: 0.15 }),
  // the wheel: a click for each peg, a fanfare for the boxer you got, and THUNDER for Zeus
  tick: () => tone({ from: 1700, to: 1100, time: 0.035, volume: 0.08 }),
  reveal: () => [392, 523, 659, 784].forEach((f, i) => tone({ type: 'triangle', from: f, time: 0.25, volume: 0.15, delay: i * 0.09 })),
  thunder: () => { noise(1.4, 0.5, 160); noise(0.25, 0.35, 2200); tone({ type: 'triangle', from: 110, to: 30, time: 1.1, volume: 0.4 }); },
  zap: () => { tone({ type: 'sawtooth', from: 1500, to: 120, time: 0.18, volume: 0.12 }); noise(0.2, 0.3, 3000); },
  bell: () => [0, 0.25].forEach((d) => tone({ type: 'triangle', from: 1200, to: 1150, time: 0.5, volume: 0.15, delay: d })),
};
