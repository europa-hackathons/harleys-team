// Tiny made-up sound effects with Web Audio (no files needed). Swap for real sounds later with src/kit/sound.js.
let ac = null;

// Call from a click or key press: browsers keep sound off until the player does something.
export function wakeSound() {
  if (!ac) { try { ac = new AudioContext(); } catch { return; } }
  if (ac.state !== 'running') ac.resume();
}

function tone({ type = 'square', from = 440, to = from, time = 0.15, volume = 0.15, delay = 0 }) {
  if (!ac || ac.state !== 'running') return;
  const t = ac.currentTime + delay;
  const osc = ac.createOscillator(), gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + time);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + time);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + time + 0.02);
}

function noise(time = 0.2, volume = 0.12) {
  if (!ac || ac.state !== 'running') return;
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * time), ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = ac.createBufferSource(), gain = ac.createGain(), filter = ac.createBiquadFilter();
  filter.type = 'bandpass'; filter.frequency.value = 900;
  gain.gain.value = volume;
  src.buffer = buf;
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start();
}

export const sfx = {
  whoosh: () => { noise(0.25, 0.18); tone({ type: 'sawtooth', from: 180, to: 520, time: 0.2, volume: 0.05 }); },
  pow: () => { tone({ from: 300, to: 60, time: 0.18, volume: 0.2 }); noise(0.12, 0.25); },
  boing: () => { tone({ type: 'sine', from: 200, to: 600, time: 0.12, volume: 0.25 }); tone({ type: 'sine', from: 600, to: 250, time: 0.25, volume: 0.2, delay: 0.12 }); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone({ from: f, time: 0.2, volume: 0.12, delay: i * 0.12 })),
  bell: () => [0, 0.25].forEach((d) => tone({ type: 'triangle', from: 1200, to: 1150, time: 0.5, volume: 0.15, delay: d })),
};
