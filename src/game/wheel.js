// The boxer WHEEL: a big pixel-art wheel that spins, slows down tick-tick-tick past the pegs and stops
// under the pointer at the top. Then the boxer you got pops up in the middle (the reveal).
// Slice sizes match the chances in roster.js, so ZEUS (rare, ZEUS_CHANCE) is a small lightning-yellow slice.
import { COLORS, disc } from './scene.js';
import { BOXERS, pickBoxer } from './roster.js';
import { sfx } from './sfx.js';

export const WHEEL = {
  cx: 128, cy: 80, r: 54,   // centre and radius on the 256x144 picture
  pegs: 20,                 // rim pegs: one tick sound each time the pointer passes one
  spinTime: 4.2,            // seconds from the push to the stop
  turns: 5,                 // whole turns before it settles
  idleSpeed: 0.4,           // slow turn while waiting for a spin (radians per second)
};
const TAU = Math.PI * 2;
const POINTER = -Math.PI / 2;   // the pointer sits at the top
const BOLT = ['..##', '.##.', '####', '.##.', '##..', '#...'];

// slice ranges in wheel angles (0..TAU), in BOXERS order
const SLICES = [];
{
  let a = 0;
  for (const b of BOXERS) { const w = (b.chance / 100) * TAU; SLICES.push({ b, a0: a, a1: a + w }); a += w; }
}
const sliceAt = (u) => SLICES.find((s) => u >= s.a0 && u < s.a1) || SLICES[SLICES.length - 1];
const wrap = (a) => ((a % TAU) + TAU) % TAU;
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

export function makeWheel(roster) {
  const size = WHEEL.r * 2 + 1;
  const face = document.createElement('canvas');
  face.width = face.height = size;
  const fg = face.getContext('2d');
  const img = fg.createImageData(size, size);
  const shades = SLICES.map((s) => ({ main: rgb(s.b.color), light: rgb(s.b.light), dark: rgb(s.b.dark) }));
  const OUT = rgb(COLORS.outline), RIM = rgb(COLORS.ring), RIM_DARK = rgb(COLORS.ringDark);

  let w = { phase: 'ready', rot: 0, t: 0, from: 0, total: 0, result: null, peg: 0, flick: 0, blocked: null };
  const GREY = { main: [118, 118, 132], light: [150, 150, 164], dark: [88, 88, 102] };

  // Paints the wheel face for the current turn, one pixel at a time (crisp pixel art at any angle).
  function paint(time) {
    const d = img.data, R = WHEEL.r;
    const sparkle = Math.floor(time * 12);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - R, dy = y - R, dist = Math.hypot(dx, dy), i = (y * size + x) * 4;
        if (dist > R + 0.5) { d[i + 3] = 0; continue; }
        let c;
        if (dist > R - 1) c = OUT;
        else if (dist > R - 5) c = dist > R - 2 ? RIM_DARK : RIM;
        else if (dist > R - 6) c = OUT;
        else {
          const u = wrap(Math.atan2(dy, dx) - w.rot);
          const k = SLICES.indexOf(sliceAt(u)), s = SLICES[k], sh = s.b.id === w.blocked ? GREY : shades[k];
          const edge = Math.min(u - s.a0, s.a1 - u) * dist;
          if (edge < 0.9) c = OUT;
          else if (s.b.id === 'zeus') c = (x * 7 + y * 3 + sparkle) % 5 === 0 && sh !== GREY ? [255, 255, 255] : sh.main;
          else c = dist > R - 10 ? sh.light : dist < 14 ? sh.dark : sh.main;
        }
        d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
      }
    }
    fg.putImageData(img, 0, 0);
  }

  // a big red X over a boxer who can't be picked this spin
  function crossOut(g, x, y, s) {
    for (const [color, wide] of [[COLORS.outline, 3], ['#e0485a', 1]]) {
      g.fillStyle = color;
      for (let i = -s; i <= s; i++) { g.fillRect(x + i - (wide >> 1), y + i - (wide >> 1), wide, wide); g.fillRect(x + i - (wide >> 1), y - i - (wide >> 1), wide, wide); }
    }
  }

  function stampBolt(g, x, y) {
    for (const [color, o] of [[COLORS.outline, 1], [COLORS.sparkle, 0]]) {
      g.fillStyle = color;
      BOLT.forEach((row, dy) => [...row].forEach((ch, dx) => { if (ch === '#') g.fillRect(x + dx - 2 + o, y + dy - 3 + o, 1, 1); }));
    }
  }

  return {
    get phase() { return w.phase; },
    get result() { return w.result; },

    // blocked = a boxer id greyed out for this spin (P1's boxer when P2 spins), or nothing
    reset(blocked = null) { w = { ...w, phase: 'ready', t: 0, result: null, blocked }; },

    // Push the wheel. force = a boxer id to land on (testing). Returns false if it's already spinning.
    spin(force) {
      if (w.phase !== 'ready') return false;
      const b = pickBoxer(force, w.blocked);
      const s = SLICES.find((sl) => sl.b === b);
      const width = s.a1 - s.a0;
      const u = s.a0 + width * (b.id === 'zeus' ? 0.5 : 0.2 + Math.random() * 0.6);   // somewhere inside the slice
      const goal = POINTER - u;                                                        // wheel turn that puts u under the pointer
      w = { ...w, phase: 'spinning', t: 0, from: w.rot, total: wrap(goal - w.rot) + TAU * WHEEL.turns, result: b };
      sfx.whoosh();
      return true;
    },

    // Returns the boxer once, on the frame the wheel stops; otherwise null.
    update(dt) {
      w.flick = Math.max(0, w.flick - dt);
      if (w.phase === 'ready') { w.rot += WHEEL.idleSpeed * dt; return null; }
      if (w.phase !== 'spinning') return null;
      w.t += dt;
      const k = Math.min(1, w.t / WHEEL.spinTime);
      w.rot = w.from + w.total * (1 - (1 - k) ** 4);   // fast at first, then slower and slower
      const peg = Math.floor(w.rot / (TAU / WHEEL.pegs));
      if (peg !== w.peg) { w.peg = peg; w.flick = 0.07; sfx.tick(); }
      if (k >= 1) { w.phase = 'stopped'; return w.result; }
      return null;
    },

    draw(g, time) {
      const { cx, cy, r } = WHEEL;
      paint(time);
      // shadow, then the face
      g.fillStyle = 'rgba(11, 18, 38, 0.6)';
      disc(g, cx + 3, cy + 4, r);
      g.drawImage(face, cx - r, cy - r);
      // boxer heads in the big slices, always upright
      for (const s of SLICES) {
        if (s.b.id === 'zeus') continue;
        const a = (s.a0 + s.a1) / 2 + w.rot, head = roster[s.b.id].head;
        const hx = Math.round(cx + Math.cos(a) * r * 0.55), hy = Math.round(cy + Math.sin(a) * r * 0.55);
        if (s.b.id === w.blocked) { g.filter = 'grayscale(1) brightness(0.75)'; g.drawImage(head, hx - (head.width >> 1), hy - (head.height >> 1)); g.filter = 'none'; crossOut(g, hx, hy, 11); }
        else g.drawImage(head, hx - (head.width >> 1), hy - (head.height >> 1));
      }
      // ZEUS: a lightning bolt sign just outside the rim, glinting
      const zs = SLICES.find((s) => s.b.id === 'zeus');
      const za = (zs.a0 + zs.a1) / 2 + w.rot;
      const bx = Math.round(cx + Math.cos(za) * (r + 6)), by = Math.round(cy + Math.sin(za) * (r + 6));
      stampBolt(g, bx, by);
      if (w.blocked === 'zeus') crossOut(g, bx, by, 5);
      // rim pegs
      for (let i = 0; i < WHEEL.pegs; i++) {
        const a = (i / WHEEL.pegs) * TAU + w.rot;
        const px = Math.round(cx + Math.cos(a) * (r - 3)), py = Math.round(cy + Math.sin(a) * (r - 3));
        g.fillStyle = COLORS.outline; g.fillRect(px - 1, py - 1, 3, 3);
        g.fillStyle = COLORS.rope; g.fillRect(px, py, 1, 1);
      }
      // hub
      g.fillStyle = COLORS.outline; disc(g, cx, cy, 8);
      g.fillStyle = COLORS.rope; disc(g, cx, cy, 7);
      g.fillStyle = COLORS.sparkle; disc(g, cx, cy, 4);
      // pointer at the top, flicking sideways at each peg
      const px = cx + (w.flick > 0 ? -2 : 0), top = cy - r - 9;
      for (const [color, grow] of [[COLORS.outline, 1], [COLORS.sparkle, 0]]) {
        g.fillStyle = color;
        for (let row = 0; row < 12; row++) {
          const half = Math.max(0, Math.round((12 - row) / 2)) + grow;
          g.fillRect(px - half, top + row - grow, half * 2 + 1, 1);
        }
      }
      g.fillStyle = '#ffffff'; g.fillRect(px - 3, top + 1, 2, 3);
    },
  };
}

// The reveal: rays spinning behind the boxer you got, who pops up big in the middle.
// t = seconds since the wheel stopped.
const rays = document.createElement('canvas');
rays.width = 256; rays.height = 144;
const rg = rays.getContext('2d');
const rayImg = rg.createImageData(256, 144);

export function drawReveal(g, boxer, t, time) {
  const { cx, cy } = WHEEL;
  g.fillStyle = 'rgba(11, 18, 38, 0.72)';
  g.fillRect(0, 0, 256, 144);
  // sun rays, crisp pixel by pixel
  const color = rgb(boxer.thunder ? (Math.floor(time * 10) % 2 ? '#fff4c2' : COLORS.sparkle) : boxer.color);
  const count = 12, spin = time * (boxer.thunder ? 1.6 : 0.6), d = rayImg.data;
  for (let y = 0; y < 144; y++) {
    for (let x = 0; x < 256; x++) {
      const i = (y * 256 + x) * 4, dx = x - cx, dy = y - cy;
      const on = dx * dx + dy * dy > 400 && wrap(Math.atan2(dy, dx) - spin) / TAU * count % 1 < 0.45;
      d[i] = color[0]; d[i + 1] = color[1]; d[i + 2] = color[2]; d[i + 3] = on ? 150 : 0;
    }
  }
  rg.putImageData(rayImg, 0, 0);
  g.drawImage(rays, 0, 0);
  // the boxer pops up with a springy overshoot
  const k = Math.min(1, t / 0.35);
  const pop = k < 1 ? k * 1.25 : 1 + 0.08 * Math.exp(-(t - 0.35) * 6) * Math.sin((t - 0.35) * 25);
  const img = boxer.reveal;
  const h = Math.round(img.height * 1.5 * pop), wd = Math.round(img.width * 1.5 * pop);
  if (h > 0) {
    g.imageSmoothingEnabled = false;
    g.drawImage(img, Math.round(cx - wd / 2), Math.round(cy + 52 - h), wd, h);
  }
}
