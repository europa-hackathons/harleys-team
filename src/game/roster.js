// The boxers on the WHEEL: what they look like, how likely each is, and who has a special power.
// Every boxer's frames are kept facing RIGHT; poses[1] is the same set mirrored for the right-hand side.
// Real sprites: player-boxer / opponent-boxer (teal, orange), boxer-green, boxer-purple, zeus-boxer
// (6 frames: idle, idle2, punch, hit-wobble, duck, special). Any missing sheet falls back to a recolour of teal.
import { duckPose, gloveOffPose, orangeGlove, mirror } from './poses.js';

// chance = percent on the wheel (they add up to 100). ZEUS is the rare one: change ZEUS_CHANCE to tune him;
// the four ordinary boxers share the rest equally.
export const ZEUS_CHANCE = 10;
const SHARE = (100 - ZEUS_CHANCE) / 4;
export const BOXERS = [
  { id: 'teal', name: 'TEAL', sv: 'TURKOS', color: '#1fb8b0', light: '#8ff0e6', dark: '#087c83', chance: SHARE },
  { id: 'orange', name: 'ORANGE', sv: 'ORANGE', color: '#f0662c', light: '#ffb07a', dark: '#ac412b', chance: SHARE },
  { id: 'green', name: 'GREEN', sv: 'GRÖN', color: '#64be52', light: '#bbf183', dark: '#347346', chance: SHARE },
  { id: 'purple', name: 'PURPLE', sv: 'LILA', color: '#aa65d9', light: '#e5b3ff', dark: '#694393', chance: SHARE },
  { id: 'zeus', name: 'ZEUS', sv: 'ZEUS', color: '#ffd23f', light: '#fff4c2', dark: '#c98121', chance: ZEUS_CHANCE, thunder: true },
];

// Picks a boxer by its wheel chance. force = a boxer id to always get (testing: ?zeus=1 or hold Z).
// blocked = a boxer id that can't be picked (P1's boxer, on P2's spin). Landing on it re-picks among the
// ordinary boxers only, so ZEUS always stays at exactly his own ZEUS_CHANCE.
export function pickBoxer(force, blocked) {
  if (force && force !== blocked) return BOXERS.find((b) => b.id === force);
  let r = Math.random() * 100, got = BOXERS[0];
  for (const b of BOXERS) { if ((r -= b.chance) < 0) { got = b; break; } }
  if (got.id !== blocked) return got;
  const rest = BOXERS.filter((b) => b.id !== blocked && !b.thunder);
  return rest[Math.floor(Math.random() * rest.length)];
}

// Fallback recolour of the teal art: teal shades -> the boxer's shades.
const TEAL_SHADES = { '31,184,176': 'color', '8,124,131': 'dark', '132,231,202': 'light', '141,231,203': 'light', '30,90,122': 'dark' };
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
function recolour(frame, b) {
  const c = document.createElement('canvas');
  c.width = frame.width; c.height = frame.height;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(frame, 0, 0);
  const img = g.getImageData(0, 0, c.width, c.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const key = TEAL_SHADES[`${d[i]},${d[i + 1]},${d[i + 2]}`];
    if (key) [d[i], d[i + 1], d[i + 2]] = rgb(b[key]);
  }
  g.putImageData(img, 0, 0);
  return c;
}

const SHEETS = { green: ['boxer-green', 'green-glove'], purple: ['boxer-purple', 'purple-glove'], zeus: ['zeus-boxer', 'zeus-glove'] };

// Builds { id: boxer } with ready-to-draw poses for both sides, the rocket-glove frames (facing right),
// the reveal picture for the wheel, and a small head picture for the wheel slices.
export function buildRoster(art) {
  const [P_IDLE, P_IDLE2, P_PUNCH, P_HIT] = art['player-boxer'];
  const [P_DUCK] = art['player-extra'] || [];
  const teal = { idle: [P_IDLE, P_IDLE2], punch: P_PUNCH, hit: P_HIT, duck: P_DUCK || duckPose(P_IDLE), guard: P_IDLE, special: P_IDLE };
  const tealGlove = art['rocket-glove'];

  const roster = {};
  for (const b of BOXERS) {
    let right, glove;
    if (b.id === 'teal') { right = teal; glove = tealGlove; }
    else if (b.id === 'orange') {
      // the orange art faces left: turn it round to face right like everyone else
      const [O_IDLE, O_IDLE2, O_GUARD, O_HIT] = art['opponent-boxer'];
      const [O_PUNCH, O_DUCK] = art['opponent-extra'] || [];
      right = { idle: [mirror(O_IDLE), mirror(O_IDLE2)], punch: mirror(O_PUNCH || gloveOffPose(O_IDLE)), hit: mirror(O_HIT),
        duck: mirror(O_DUCK || duckPose(O_IDLE)), guard: mirror(O_GUARD), special: mirror(O_IDLE) };
      glove = art['opponent-glove'] ? art['opponent-glove'].map(mirror) : tealGlove.map(orangeGlove);
    } else {
      const [sheet, gloveSheet] = SHEETS[b.id];
      const f = art[sheet];
      if (f && f.length >= 5) right = { idle: [f[0], f[1]], punch: f[2], hit: f[3], duck: f[4], guard: f[0], special: f[5] || f[0] };
      else {
        const rc = (fr) => recolour(fr, b);
        right = { idle: teal.idle.map(rc), punch: rc(teal.punch), hit: rc(teal.hit), duck: rc(teal.duck), guard: rc(teal.guard), special: rc(teal.idle[0]) };
      }
      glove = art[gloveSheet] || tealGlove.map((fr) => recolour(fr, b));
    }
    const left = { idle: [mirror(right.idle[1]), mirror(right.idle[0])], punch: mirror(right.punch), hit: mirror(right.hit),
      duck: mirror(right.duck), guard: mirror(right.guard), special: mirror(right.special) };
    const toSide = (p) => ({ ...p, duck: [p.duck, p.duck] });
    roster[b.id] = { ...b, poses: [toSide(right), toSide(left)], glove, reveal: right.special, head: crop(right.idle[0], 6, 2, 34, 26) };
  }
  return roster;
}

function crop(frame, x, y, w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(frame, x, y, w, h, 0, 0, w, h);
  return c;
}
