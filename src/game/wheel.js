// The boxer WHEEL: a big pixel-art wheel that spins, slows down tick-tick-tick past the pegs and stops
// under the pointer at the top. Then the boxer you got pops up in the middle (the reveal).
// Slice sizes match the chances in roster.js, so ZEUS (rare, ZEUS_CHANCE) is a small lightning-yellow slice.
import { COLORS, disc } from './scene.js';
import { BOXERS, pickBoxer } from './roster.js';
import { sfx } from './sfx.js';
import { blit, blitCentre, blitAt, lw, lh } from './sprite.js';
import { fx } from './effects.js';

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

// rim = the HD rim-and-hub picture (assets/art/hd/ui "wheel-rim-hub", 114x114 game pixels, opening radius 45,
// hub radius 9): drawn over the painted face, turning with it. Without it the code-drawn rim, pegs and hub are used.
const RIM_OPEN = 44.5, HUB_R = 9.3;
export function makeWheel(roster, rim = null) {
  // the face is painted FACE_RES real pixels per game pixel, so it stays sharp on the big screen
  const FACE_RES = 3;
  const size = (WHEEL.r * 2 + 1) * FACE_RES;
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
    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        const x = (px + 0.5) / FACE_RES - 0.5, y = (py + 0.5) / FACE_RES - 0.5;   // in game pixels
        const dx = x - R, dy = y - R, dist = Math.hypot(dx, dy), i = (py * size + px) * 4;
        if (dist > R + 0.5) { d[i + 3] = 0; continue; }
        let c;
        if (dist > R - 1) c = OUT;
        else if (dist > R - 5) c = dist > R - 2 ? RIM_DARK : RIM;
        else if (dist > R - 6) c = OUT;
        else {
          const u = wrap(Math.atan2(dy, dx) - w.rot);
          const k = SLICES.indexOf(sliceAt(u)), s = SLICES[k], sh = s.b.id === w.blocked ? GREY : shades[k];
          const edge = Math.min(u - s.a0, s.a1 - u) * dist;
          if (edge < 0.6) c = OUT;
          else if (s.b.id === 'zeus') c = (Math.floor(x) * 7 + Math.floor(y) * 3 + sparkle) % 5 === 0 && sh !== GREY ? [255, 255, 255] : sh.main;
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
      disc(g, cx + 3, cy + 4, rim ? Math.round(lw(rim) / 2) : r);
      g.drawImage(face, cx - r, cy - r, WHEEL.r * 2 + 1, WHEEL.r * 2 + 1);
      // the heads sit in the middle of the band you can see (between the hub and the rim's opening)
      const headR = rim ? (RIM_OPEN + HUB_R) / 2 : r * 0.55;
      // boxer heads in the big slices, always upright
      for (const s of SLICES) {
        if (s.b.id === 'zeus') continue;
        const a = (s.a0 + s.a1) / 2 + w.rot, head = roster[s.b.id].head;
        const hx = Math.round(cx + Math.cos(a) * headR), hy = Math.round(cy + Math.sin(a) * headR);
        if (s.b.id === w.blocked) { g.filter = 'grayscale(1) brightness(0.75)'; blitCentre(g, head, hx, hy); g.filter = 'none'; crossOut(g, hx, hy, 11); }
        else blitCentre(g, head, hx, hy);
      }
      // ZEUS: a lightning bolt sign just outside the rim, glinting
      const zs = SLICES.find((s) => s.b.id === 'zeus');
      const za = (zs.a0 + zs.a1) / 2 + w.rot;
      if (rim) {
        // HD: the drawn sky bolt inside ZEUS's thin slice (flickering through its frames), then the rim and hub,
        // turning with the face so its lights sweep past the pointer
        const zr = RIM_OPEN - 10, zx = Math.round(cx + Math.cos(za) * zr), zy = Math.round(cy + Math.sin(za) * zr);
        const seq = fx.skyBolt;
        if (seq) { const fr = seq[Math.floor(time * 6) % seq.length]; blitAt(g, fr, zx, zy + fr.lh * 0.17, 0.34); }
        if (w.blocked === 'zeus') crossOut(g, zx, zy, 5);
        g.save(); g.translate(cx, cy); g.rotate(w.rot);
        blitCentre(g, rim, 0, 0);
        g.restore();
        drawPointer(g, cx, cy - lw(rim) / 2 - 3);
        return;
      }
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
      drawPointer(g, cx, cy - r - 9);
    },
  };

  // pointer at the top, flicking sideways at each peg
  function drawPointer(g, cx, top) {
    const px = cx + (w.flick > 0 ? -2 : 0);
      for (const [color, grow] of [[COLORS.outline, 1], [COLORS.sparkle, 0]]) {
        g.fillStyle = color;
        for (let row = 0; row < 12; row++) {
          const half = Math.max(0, Math.round((12 - row) / 2)) + grow;
          g.fillRect(px - half, top + row - grow, half * 2 + 1, 1);
        }
      }
      g.fillStyle = '#ffffff'; g.fillRect(px - 3, top + 1, 2, 3);
  }
}

// The reveal: rays spinning behind the boxer you got, who pops up big in the middle.
// t = seconds since the wheel stopped.
export function drawReveal(g, boxer, t, time) {
  const { cx, cy } = WHEEL;
  g.fillStyle = 'rgba(11, 18, 38, 0.72)';
  g.fillRect(0, 0, 256, 144);
  // sun rays: wedges drawn at screen resolution, with a hole in the middle
  const color = boxer.thunder ? (Math.floor(time * 10) % 2 ? '#fff4c2' : COLORS.sparkle) : boxer.color;
  const count = 12, spin = time * (boxer.thunder ? 1.6 : 0.6), wedge = (TAU / count) * 0.45;
  g.save();
  g.globalAlpha = 150 / 255;
  g.fillStyle = color;
  g.beginPath();
  for (let i = 0; i < count; i++) {
    const a0 = spin + (i * TAU) / count;
    g.moveTo(cx + Math.cos(a0) * 20, cy + Math.sin(a0) * 20);
    g.arc(cx, cy, 320, a0, a0 + wedge);
    g.arc(cx, cy, 20, a0 + wedge, a0, true);
    g.closePath();
  }
  g.fill();
  g.restore();
  // the boxer pops up with a springy overshoot
  const k = Math.min(1, t / 0.35);
  const pop = k < 1 ? k * 1.25 : 1 + 0.08 * Math.exp(-(t - 0.35) * 6) * Math.sin((t - 0.35) * 25);
  const img = boxer.reveal;
  // a 72-pixel-tall boxer shows 1.5x as big; taller HD art is fitted to the same height
  const s = (108 / Math.max(lh(img), 1)) * pop, h = lh(img) * s, wd = lw(img) * s;
  if (h > 0) blit(g, img, cx - wd / 2, cy + 52 - h, wd, h);
}
