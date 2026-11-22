// The boxer WHEEL: a big pixel-art wheel that spins, slows down tick-tick-tick past the pegs and stops
// under the pointer at the top. Then the boxer you got pops up in the middle (the reveal).
// Slice sizes match the chances in roster.js, so ZEUS (rare, ZEUS_CHANCE) is a small lightning-yellow slice.
// Every boxer's head is fitted inside its own slice, however thin (see layout()).
import { COLORS, disc } from './scene.js';
import { BOXERS, pickBoxer } from './roster.js';
import { sfx } from './sfx.js';
import { blit, blitCentre, lw, lh } from './sprite.js';

export const WHEEL = {
  cx: 128, cy: 80, r: 54,   // centre and radius on the 256x144 picture
  pegs: 20,                 // rim pegs: one tick sound each time the pointer passes one
  spinTime: 4.2,            // seconds from the push to the stop
  turns: 5,                 // whole turns before it settles
  idleSpeed: 0.4,           // slow turn while waiting for a spin (radians per second)
};
const TAU = Math.PI * 2;
const POINTER = -Math.PI / 2;   // the pointer sits at the top

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
const HEAD_PAD = 1.2;     // game pixels kept clear between a head and its slice's edges, the rim and the hub
const HEAD_MAX = 1.1;     // a head is never drawn bigger than this times its portrait size

// The smallest circle round a picture's drawn (non-see-through) pixels, in game pixels from its top-left:
// { x, y, r }. Heads stay upright while the wheel turns, so this circle is what has to fit in the slice.
const circles = new WeakMap();
function headCircle(img) {
  if (circles.has(img)) return circles.get(img);
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data, k = img.width / lw(img), pts = [];
  const step = Math.max(1, Math.round(k / 2));
  for (let y = 0; y < c.height; y += step) for (let x = 0; x < c.width; x += step) {
    if (d[(y * c.width + x) * 4 + 3] < 40) continue;
    // all four corners of the pixel block, so the circle covers whole pixels
    for (const [ox, oy] of [[0, 0], [step, 0], [0, step], [step, step]]) pts.push([(x + ox) / k, (y + oy) / k]);
  }
  let out = { x: lw(img) / 2, y: lh(img) / 2, r: Math.hypot(lw(img), lh(img)) / 2 };
  if (pts.length) {
    // walk the centre toward the farthest point a little less each time (Badoiu-Clarkson): close to the smallest circle
    let [px, py] = pts[0];
    for (let i = 1; i <= 400; i++) {
      let far = pts[0], best = -1;
      for (const q of pts) { const dd = (q[0] - px) ** 2 + (q[1] - py) ** 2; if (dd > best) { best = dd; far = q; } }
      px += (far[0] - px) / (i + 1); py += (far[1] - py) / (i + 1);
    }
    let r = 0;
    for (const q of pts) r = Math.max(r, Math.hypot(q[0] - px, q[1] - py));
    out = { x: px, y: py, r };
  }
  circles.set(img, out);
  return out;
}

// The biggest circle that fits inside a ring slice (from hub to opening, half-angle `half`), keeping `pad`
// clear of every edge: { rc (its distance from the wheel's middle), rho (its radius) }.
function sliceCircle(half, hub, open, pad) {
  const side = Math.sin(Math.min(half, Math.PI / 2));
  let best = { rc: (hub + open) / 2, rho: 0 };
  for (let i = 0; i <= 400; i++) {
    const rc = hub + ((open - hub) * i) / 400;
    const rho = Math.min(open - pad - rc, rc - hub - pad, half >= Math.PI / 2 ? Infinity : rc * side - pad);
    if (rho > best.rho) best = { rc, rho };
  }
  return best;
}
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

  let w = { phase: 'ready', rot: 0, t: 0, from: 0, total: 0, result: null, peg: 0, flick: 0, blocked: null, hold: false };

  // Where each boxer's head goes: as big as fits inside its own slice (ZEUS's thin one too), worked out once.
  // The head's circle sits on the slice's middle line at rc from the wheel's middle.
  const open = rim ? RIM_OPEN : WHEEL.r - 6, hub = rim ? HUB_R : 8;
  const heads = SLICES.map((s) => {
    const img = roster[s.b.id].head, c = headCircle(img), fit = sliceCircle((s.a1 - s.a0) / 2, hub, open, HEAD_PAD);
    const scale = Math.min(HEAD_MAX, fit.rho / c.r);
    return { id: s.b.id, img, c, scale, rc: fit.rc, mid: (s.a0 + s.a1) / 2 };
  });
  // the heads for a wheel turn: { id, img, x, y, w, h } (top-left and size in game pixels), cx/cy = the circle's middle
  function layout(rot = w.rot) {
    return heads.map((h) => {
      const a = h.mid + rot, cx = WHEEL.cx + Math.cos(a) * h.rc, cy = WHEEL.cy + Math.sin(a) * h.rc;
      return { id: h.id, img: h.img, x: cx - h.c.x * h.scale, y: cy - h.c.y * h.scale, w: lw(h.img) * h.scale, h: lh(h.img) * h.scale, cx, cy, r: h.c.r * h.scale };
    });
  }
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

  return {
    get phase() { return w.phase; },
    get result() { return w.result; },

    // blocked = a boxer id greyed out for this spin (P1's boxer when P2 spins), or nothing
    reset(blocked = null) { w = { ...w, phase: 'ready', t: 0, result: null, blocked }; },

    layout,
    // testing: hold the wheel still at this turn (radians), or let it turn again with hold(null)
    hold(rot) { w.hold = rot !== null && rot !== undefined; if (w.hold) w.rot = rot; },
    get rot() { return w.rot; },

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
      if (w.phase === 'ready') { if (!w.hold) w.rot += WHEEL.idleSpeed * dt; return null; }
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
      // every boxer's head, upright, fitted inside its own slice (layout above)
      for (const h of layout()) {
        if (h.id === w.blocked) {
          g.filter = 'grayscale(1) brightness(0.75)'; blit(g, h.img, h.x, h.y, h.w, h.h); g.filter = 'none';
          crossOut(g, Math.round(h.cx), Math.round(h.cy), Math.max(4, Math.round(h.r * 0.7)));
        } else blit(g, h.img, h.x, h.y, h.w, h.h);
      }
      if (rim) {
        // HD: the rim and hub turn with the face, so their lights sweep past the pointer
        g.save(); g.translate(cx, cy); g.rotate(w.rot);
        blitCentre(g, rim, 0, 0);
        g.restore();
        drawPointer(g, cx, cy - lw(rim) / 2 - 3);
        return;
      }
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
