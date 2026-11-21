// Pixel effects on the 256x144 picture: rocket flames, star bursts, sparkles and pop-up words.
import { COLORS } from './scene.js';
import { blitCentre, blitAt } from './sprite.js';

const bits = [];
// fx.hd = true when the drawn HD effect animations are in (main.js): then the chunky code-made flame, water,
// leaf, bubble, lava-sizzle and wind particles are left out (the HD trails, impacts and status loops replace them).
// fx.skyBolt = the HD Zeus sky-bolt animation (effects/manifest.json "zeus-sky-bolt"): when it is in, every bolt()
// plays it instead of the code-drawn zig-zag.
export const fx = { hd: false, skyBolt: null };
const words = [];
const anims = [];
const bolts = [];
const ZAP_COLORS = ['#ffffff', '#fff4c2', '#ffd23f'];

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
// dir = 1 when the glove flies right (flame blows left), -1 when it flies left.
// big = 2 makes the huge FLAME FIST version (more, bigger, longer-lasting puffs).
export function flame(x, y, power = 1, dir = 1, big = 1) {
  if (fx.hd) return;
  for (let i = 0; i < 3 * big; i++) {
    bits.push({ kind: 'flame', x, y: y + (Math.random() * 4 - 2) * big, vx: dir * (-30 - Math.random() * 50 * power), vy: (Math.random() * 16 - 8) * big,
      age: 0, life: (0.18 + Math.random() * 0.14) * big, size: (3 + Math.random() * 2) * big });
  }
}

// ---------- special-move trails and status effects ----------
const WATER = ['#ffffff', '#a8e8ff', '#5cc4f5', '#2f86e0'];
const LEAF = ['#bbf183', '#64be52', '#347346'];
const POISON = ['#e5b3ff', '#c47fef', '#aa65d9'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// WATER FIST: a spray of water drops flying off behind the glove (call every frame while it flies).
export function splash(x, y, dir = 1) {
  if (fx.hd) return;
  for (let i = 0; i < 4; i++) {
    bits.push({ kind: 'drop', x: x + Math.random() * 6 - 3, y: y + Math.random() * 8 - 4, vx: dir * (-20 - Math.random() * 50), vy: -50 + Math.random() * 40,
      age: 0, life: 0.35 + Math.random() * 0.25, color: pick(WATER), grav: 300 });
  }
}
// A water drop falling off a DRIPPING WET boxer.
export function drip(x, y) {
  if (fx.hd) return;
  bits.push({ kind: 'drop', x, y, vx: Math.random() * 10 - 5, vy: 5 + Math.random() * 10, age: 0, life: 0.45 + Math.random() * 0.2, color: pick(WATER), grav: 220 });
}
// IVY FIST: little leaves fluttering off the vine.
export function leaves(x, y, dir = 1) {
  if (fx.hd) return;
  bits.push({ kind: 'leaf', x: x + Math.random() * 6 - 3, y: y + Math.random() * 8 - 4, vx: dir * (-10 - Math.random() * 20), vy: 10 + Math.random() * 20,
    age: 0, life: 0.5 + Math.random() * 0.3, color: pick(LEAF) });
}
// POISON: purple cartoon bubbles that float up and pop. dir = 0 for bubbles rising off a poisoned boxer.
export function bubbles(x, y, dir = 1) {
  if (fx.hd) return;
  bits.push({ kind: 'bubble', x: x + Math.random() * 6 - 3, y: y + Math.random() * 8 - 4, vx: dir * (-15 - Math.random() * 25) + Math.random() * 8 - 4, vy: -15 - Math.random() * 20,
    age: 0, life: 0.5 + Math.random() * 0.4, color: pick(POISON), r: Math.random() < 0.4 ? 2 : 1 });
}

// LAVA: little sizzle sparks hopping up off a lava splat.
const SIZZLE = ['#fff4c2', '#ffd23f', '#ff9f2e', '#f0662c'];
export function sizzle(x, y) {
  if (fx.hd) return;
  bits.push({ kind: 'drop', x: x + Math.random() * 4 - 2, y, vx: Math.random() * 30 - 15, vy: -30 - Math.random() * 30, age: 0, life: 0.25 + Math.random() * 0.2, color: pick(SIZZLE), grav: 120 });
}

// WIND STORM (the boss): white and pale-blue gusts swirling off behind the big fist.
const WIND = ['#ffffff', '#bfe8ff', '#8ff0e6'];
export function wind(x, y, dir = 1) {
  if (fx.hd) return;
  for (let i = 0; i < 4; i++) {
    const a = Math.random() * Math.PI * 2;
    bits.push({ kind: 'drop', x: x + Math.cos(a) * 12, y: y + Math.sin(a) * 12, vx: dir * (-30 - Math.random() * 40) - Math.sin(a) * 50, vy: Math.cos(a) * 50,
      age: 0, life: 0.3 + Math.random() * 0.2, color: pick(WIND), grav: 0 });
  }
}

// Crackling lightning sparks behind a THUNDER fist (Zeus): call every frame while it flies.
export function zap(x, y, dir = 1) {
  for (let i = 0; i < 3; i++) {
    bits.push({ kind: 'zap', x: x + Math.random() * 8 - 4, y: y + Math.random() * 10 - 5, vx: dir * (-20 - Math.random() * 40), vy: Math.random() * 30 - 15,
      age: 0, life: 0.12 + Math.random() * 0.15, len: 2 + Math.floor(Math.random() * 3), color: ZAP_COLORS[i] });
  }
}

// A zig-zag lightning bolt from (x0, y0) down to (x1, y1) that crackles for `life` seconds.
export function bolt(x0, y0, x1, y1, life = 0.35) {
  const seq = fx.skyBolt;
  bolts.push({ x0, y0, x1, y1, age: 0, life: seq ? Math.max(life, seq.length / (seq.fps || 20)) : life });
}

// The HD sky bolt: its anchor (bottom middle, where it strikes) on the target, sized so it reaches up to y0 and
// leaning along the line from (x0, y0). The drawn sequence plays once, then its last two frames flicker out.
function drawSkyBolt(g, b, seq) {
  const fps = seq.fps || 20, i = Math.floor(b.age * fps);
  const fr = i < seq.length ? seq[i] : seq[seq.length - 2 + (Math.floor(b.age * 30) % 2)];
  const scale = Math.max(0.6, (b.y1 - b.y0) / fr.lh);
  g.save();
  g.translate(b.x1, b.y1);
  g.rotate(-Math.atan2(b.x1 - b.x0, b.y1 - b.y0));
  blitAt(g, fr, 0, 0, scale);
  g.restore();
}

function line(g, ax, ay, bx, by, size) {
  const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1);
  for (let i = 0; i <= n; i++) {
    g.fillRect(Math.round(ax + ((bx - ax) * i) / n - size / 2), Math.round(ay + ((by - ay) * i) / n - size / 2), size, size);
  }
}

function drawBolt(g, b) {
  const n = 7, pts = [[b.x0, b.y0]];
  for (let i = 1; i < n; i++) {
    const k = i / n;
    pts.push([b.x0 + (b.x1 - b.x0) * k + (Math.random() * 12 - 6), b.y0 + (b.y1 - b.y0) * k]);
  }
  pts.push([b.x1, b.y1]);
  for (const [size, color] of [[5, COLORS.outline], [3, COLORS.sparkle], [1, '#ffffff']]) {
    g.fillStyle = color;
    for (let i = 1; i < pts.length; i++) line(g, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], size);
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
export function playFrames(frames, x, y, fps = 14, scale = 1) {
  anims.push({ frames, x, y, fps: frames.fps || fps, age: 0, scale });
}

export function clearEffects() { bits.length = 0; words.length = 0; anims.length = 0; bolts.length = 0; }

export function drawEffects(g, dt) {
  for (let i = anims.length - 1; i >= 0; i--) {
    const a = anims[i];
    a.age += dt;
    const f = Math.floor(a.age * a.fps);
    if (f >= a.frames.length) { anims.splice(i, 1); continue; }
    const fr = a.frames[f];
    if (fr.hd) blitAt(g, fr, a.x, a.y, a.scale); else blitCentre(g, fr, a.x, a.y, a.scale);
  }
  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i];
    b.age += dt;
    if (b.age >= b.life) { bolts.splice(i, 1); continue; }
    if (fx.skyBolt) drawSkyBolt(g, b, fx.skyBolt);
    else if (b.age < b.life * 0.6 || Math.floor(b.age * 30) % 2) drawBolt(g, b);   // flickers out
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
    } else if (b.kind === 'drop') {
      b.vy += b.grav * dt;
      g.fillStyle = b.color;
      g.fillRect(Math.round(b.x), Math.round(b.y), 1, 2);
    } else if (b.kind === 'leaf') {
      b.vx += Math.sin(b.age * 12) * 60 * dt;
      g.fillStyle = COLORS.outline; g.fillRect(Math.round(b.x), Math.round(b.y) + 1, 2, 2);
      g.fillStyle = b.color; g.fillRect(Math.round(b.x), Math.round(b.y), 2, 2);
    } else if (b.kind === 'bubble') {
      const x = Math.round(b.x), y = Math.round(b.y), r = b.r;
      if (k > 0.85) { g.fillStyle = b.color; g.fillRect(x - r - 1, y, 1, 1); g.fillRect(x + r + 1, y, 1, 1); g.fillRect(x, y - r - 1, 1, 1); continue; }   // pop!
      g.fillStyle = b.color;
      g.fillRect(x - r, y - r - 1, r * 2 + 1, 1); g.fillRect(x - r, y + r + 1, r * 2 + 1, 1);
      g.fillRect(x - r - 1, y - r, 1, r * 2 + 1); g.fillRect(x + r + 1, y - r, 1, r * 2 + 1);
      g.fillStyle = '#ffffff'; g.fillRect(x - r, y - r, 1, 1);
    } else if (b.kind === 'zap') {
      g.fillStyle = b.color;
      const up = Math.random() < 0.5;
      g.fillRect(Math.round(b.x), Math.round(b.y), up ? 1 : b.len, up ? b.len : 1);
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
    drawWord(g, w.text, Math.round(w.x), y, w.color, size);
  }
}

// Little stars spinning around a dizzy head.
export function drawDizzy(g, cx, cy, time) {
  for (let i = 0; i < 3; i++) {
    const a = time * 5 + (i * Math.PI * 2) / 3;
    stamp(g, STAR, Math.round(cx + Math.cos(a) * 10), Math.round(cy + Math.sin(a) * 3), COLORS.sparkle);
  }
}

// A chunky arcade word: heavy letters, a thick dark outline with a drop below, and a shine from the top
// (big gold words like FIGHT! get a gold-to-orange fill). Drawn at screen resolution, so the edges are clean.
export function drawWord(g, text, x, y, color, size) {
  g.font = `900 ${size}px "Arial Black", "Trebuchet MS", sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = Math.max(1.2, size * 0.2);
  g.strokeStyle = COLORS.outline;
  g.strokeText(text, x + size * 0.04, y + size * 0.09);   // drop
  g.strokeText(text, x, y);
  let fill = color;
  if (size >= 13) {
    const grad = g.createLinearGradient(0, y - size / 2, 0, y + size / 2);
    grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.18, color);
    grad.addColorStop(0.62, color); grad.addColorStop(1, color === COLORS.sparkle ? '#f07a1a' : shade(color));
    fill = grad;
  }
  g.fillStyle = fill;
  g.fillText(text, x, y);
}
// a darker copy of a #rrggbb colour
function shade(hex) {
  const n = [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * 0.68));
  return `rgb(${n.join(',')})`;
}
