// Pixel effects on the 256x144 picture: rocket flames, star bursts, sparkles and pop-up words.
import { COLORS } from './scene.js';

const bits = [];
const words = [];
const anims = [];

const STAR = ['..#..', '..#..', '#####', '.###.', '.#.#.'];
const PLUS = ['..#..', '..#..', '#####', '..#..', '..#..'];
const FLAME_COLORS = ['#fff4c2', '#ffd23f', '#ff9f2e', '#f0662c', '#d8423a'];

function stamp(g, shape, x, y, color) {
  g.fillStyle = COLORS.outline;
  shape.forEach((row, dy) => [...row].forEach((ch, dx) => { if (ch === '#') g.fillRect(x + dx - 2 + 1, y + dy - 2 + 1, 1, 1); }));
  g.fillStyle = color;
  shape.forEach((row, dy) => [...row].forEach((ch, dx) => { if (ch === '#') g.fillRect(x + dx - 2, y + dy - 2, 1, 1); }));
}

// A puff of rocket flame behind the flying glove (call every frame while it flies).
export function flame(x, y, power = 1) {
  for (let i = 0; i < 3; i++) {
    bits.push({ kind: 'flame', x, y: y + (Math.random() * 4 - 2), vx: -30 - Math.random() * 50 * power, vy: Math.random() * 16 - 8,
      age: 0, life: 0.18 + Math.random() * 0.14, size: 3 + Math.random() * 2 });
  }
}

// Burst of yellow stars and sparkles (a hit).
export function starBurst(x, y, count = 14) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, s = 40 + Math.random() * 70;
    bits.push({ kind: i % 3 ? 'star' : 'plus', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20,
      age: 0, life: 0.6 + Math.random() * 0.5, color: i % 4 === 0 ? '#ffffff' : COLORS.sparkle });
  }
}

// A word that pops up and floats away: "POW!", "BOING!".
export function popWord(text, x, y, color = COLORS.sparkle, size = 11) {
  words.push({ text, x, y, color, size, age: 0, life: 0.8 });
}

// Plays a row of sprite frames once, centred on (x, y): the hit-stars sheet.
export function playFrames(frames, x, y, fps = 14) {
  anims.push({ frames, x, y, fps, age: 0 });
}

export function clearEffects() { bits.length = 0; words.length = 0; anims.length = 0; }

export function drawEffects(g, dt) {
  for (let i = anims.length - 1; i >= 0; i--) {
    const a = anims[i];
    a.age += dt;
    const f = Math.floor(a.age * a.fps);
    if (f >= a.frames.length) { anims.splice(i, 1); continue; }
    const img = a.frames[f];
    g.drawImage(img, Math.round(a.x - img.width / 2), Math.round(a.y - img.height / 2));
  }
  for (let i = bits.length - 1; i >= 0; i--) {
    const b = bits[i];
    b.age += dt;
    if (b.age >= b.life) { bits.splice(i, 1); continue; }
    b.x += b.vx * dt; b.y += b.vy * dt;
    const k = b.age / b.life;
    if (b.kind === 'flame') {
      const s = Math.max(1, Math.round(b.size * (1 - k)));
      g.fillStyle = FLAME_COLORS[Math.min(FLAME_COLORS.length - 1, Math.floor(k * FLAME_COLORS.length))];
      g.fillRect(Math.round(b.x - s / 2), Math.round(b.y - s / 2), s, s);
    } else {
      b.vx *= 0.92; b.vy = b.vy * 0.92 + 60 * dt;
      if (k > 0.75 && Math.floor(b.age * 20) % 2) continue;   // twinkle before vanishing
      stamp(g, b.kind === 'star' ? STAR : PLUS, Math.round(b.x), Math.round(b.y), b.color);
    }
  }
  for (let i = words.length - 1; i >= 0; i--) {
    const w = words[i];
    w.age += dt;
    if (w.age >= w.life) { words.splice(i, 1); continue; }
    const grow = Math.min(1, w.age / 0.1);
    const size = Math.round(w.size * (0.6 + 0.4 * grow));
    const y = Math.round(w.y - w.age * 18);
    g.font = `bold ${size}px "Trebuchet MS", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = COLORS.outline;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) g.fillText(w.text, Math.round(w.x) + dx, y + dy);
    g.fillStyle = w.color;
    g.fillText(w.text, Math.round(w.x), y);
  }
}

// Little stars spinning around a dizzy head.
export function drawDizzy(g, cx, cy, time) {
  for (let i = 0; i < 3; i++) {
    const a = time * 5 + (i * Math.PI * 2) / 3;
    stamp(g, STAR, Math.round(cx + Math.cos(a) * 10), Math.round(cy + Math.sin(a) * 3), COLORS.sparkle);
  }
}
