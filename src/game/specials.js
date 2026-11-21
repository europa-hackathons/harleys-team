// SPECIAL MOVES: every boxer has a SUPER meter that fills as they deal damage. When it is full it flashes
// "SUPER READY!" and the NEXT punch (high or low, keys or camera) is that boxer's special. Then it empties.
// All the numbers are here so they are easy to tune.
import { COLORS } from './scene.js';
import { splash, flame, leaves, bubbles, zap } from './effects.js';

export const SUPER = {
  full: 300,                                                  // damage dealt to fill the meter
  slow: { time: 3, walk: 0.45, glove: 0.6, cooldown: 0.6 },   // WATER: 3 s of slower walking, slower fists, a pause between punches
  flameBonus: 50,                                             // FLAME: extra damage on top of the normal hit
  tangle: 2,                                                  // IVY: seconds you can't duck
  poison: { time: 5, perSecond: 20 },                         // POISON: 20 health a second for 5 s (never below 1)
  storm: [90, 80, 80], stormGap: 0.25,                        // ZEUS: 3 lightning bolts, 250 in total, this far apart (s)
};

// Which special each boxer has, its name, and the word that pops over the target.
export const SPECIALS = {
  teal: { kind: 'water', name: 'WATER FIST!', status: 'SLOW!', color: '#5cc4f5' },
  orange: { kind: 'flame', name: 'FLAME FIST!', status: 'MEGA BURN!', color: '#ff9f2e' },
  green: { kind: 'ivy', name: 'IVY FIST!', status: 'TANGLED!', color: '#64be52' },
  purple: { kind: 'poison', name: 'POISON FIST!', status: 'POISONED!', color: '#c47fef' },
  zeus: { kind: 'storm', name: 'THUNDER STORM!', status: 'STORM!', color: '#ffd23f' },
};

// The trail behind a flying special glove (call every frame while it flies). x, y = the back of the glove.
export function specialTrail(kind, x, y, dir) {
  if (kind === 'water') splash(x, y, dir);
  else if (kind === 'flame') flame(x, y, 1.6, dir, 1.5);
  else if (kind === 'ivy') leaves(x, y, dir);
  else if (kind === 'poison') { bubbles(x, y, dir); if (Math.random() < 0.6) bubbles(x, y, dir); }
  else if (kind === 'storm') { zap(x, y, dir); zap(x, y - 6, dir); zap(x, y + 6, dir); }
}

// The ivy vine shooting out from the arm (x0) to the glove (x1), wiggling, with leaves.
export function drawVine(g, x0, x1, y, time) {
  const n = Math.abs(x1 - x0), d = Math.sign(x1 - x0) || 1;
  for (const [color, grow] of [[COLORS.outline, 1], ['#64be52', 0]]) {
    g.fillStyle = color;
    for (let i = 0; i <= n; i++) {
      const vy = Math.round(y + Math.sin(i * 0.35 - time * 14) * 2);
      g.fillRect(Math.round(x0 + i * d) - grow, vy - grow, 1 + grow * 2, 2 + grow * 2);
    }
  }
  for (let i = 4; i < n; i += 7) {
    const vy = Math.round(y + Math.sin(i * 0.35 - time * 14) * 2), lx = Math.round(x0 + i * d), up = (i / 7) % 2 < 1 ? -3 : 3;
    g.fillStyle = COLORS.outline; g.fillRect(lx - 1, vy + up - 1, 4, 4);
    g.fillStyle = '#bbf183'; g.fillRect(lx, vy + up, 2, 2);
  }
}

// Green ivy wrapped around a TANGLED boxer's legs. cx = middle of the boxer, footY = bottom of the feet.
export function drawIvy(g, cx, footY, time) {
  const wob = Math.sin(time * 6) * 0.6;
  const at = (i, s) => Math.round(cx + Math.sin(i * 0.3 + s * 1.57 + wob) * 12);
  for (const [color, wide] of [[COLORS.outline, 1], ['#347346', 0]]) {
    g.fillStyle = color;
    for (let i = 0; i < 22; i++) for (const s of [1, -1]) g.fillRect(at(i, s) - wide, footY - i - wide, 2 + wide * 2, 1 + wide * 2);
  }
  for (let i = 3; i < 22; i += 6) {
    for (const s of [1, -1]) {
      const x = at(i, s), y = footY - i;
      g.fillStyle = COLORS.outline; g.fillRect(x - 1, y - 2, 5, 4);
      g.fillStyle = '#64be52'; g.fillRect(x, y - 1, 3, 2);
      g.fillStyle = '#bbf183'; g.fillRect(x, y - 1, 1, 1);
    }
  }
}

// A copy of a picture tinted with a colour (POISON makes the boxer a bit purple).
const scratch = document.createElement('canvas');
const sg = scratch.getContext('2d');
export function tinted(img, color, amount) {
  scratch.width = img.width; scratch.height = img.height;
  sg.globalCompositeOperation = 'source-over';
  sg.globalAlpha = 1;
  sg.drawImage(img, 0, 0);
  sg.globalCompositeOperation = 'source-atop';
  sg.globalAlpha = amount;
  sg.fillStyle = color;
  sg.fillRect(0, 0, img.width, img.height);
  sg.globalAlpha = 1;
  sg.globalCompositeOperation = 'source-over';
  return scratch;
}

// The SUPER meter: a thin bar that fills in the boxer's colour and flashes when full.
// fromRight = it fills from the right end (the right-hand boxer's bar, which empties toward the middle).
export function drawSuperMeter(g, f, x, y, w, time, fromRight = false) {
  const h = 3, ready = f.super >= SUPER.full;
  const flash = Math.floor(time * 8) % 2;
  if (ready) { g.fillStyle = flash ? f.boxer.light : f.boxer.color; g.fillRect(x - 2, y - 2, w + 4, h + 4); }
  g.fillStyle = COLORS.outline; g.fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle = '#2a2140'; g.fillRect(x, y, w, h);
  const fill = Math.round((w * Math.min(f.super, SUPER.full)) / SUPER.full);
  const fx = fromRight ? x + w - fill : x;
  g.fillStyle = ready && flash ? '#ffffff' : f.boxer.color; g.fillRect(fx, y, fill, h);
  g.fillStyle = f.boxer.light; g.fillRect(fx, y, fill, 1);
  if (ready) {
    g.font = 'bold 8px "Trebuchet MS", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'top';
    const tx = Math.round(x + w / 2), ty = y + h + 3 + (flash ? 0 : 1);
    g.fillStyle = COLORS.outline;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) g.fillText('SUPER READY!', tx + dx, ty + dy);
    g.fillStyle = flash ? '#ffffff' : f.boxer.light;
    g.fillText('SUPER READY!', tx, ty);
  }
}
