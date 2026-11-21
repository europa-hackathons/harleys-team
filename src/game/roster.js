// The boxers on the WHEEL: what they look like, how likely each is, and who has a special power.
// Every boxer's frames are kept facing RIGHT; poses[1] is the same set mirrored for the right-hand side.
// Real sprites: player-boxer / opponent-boxer (teal, orange), boxer-green, boxer-purple, zeus-boxer, boss-boxer
// (6 frames: idle, idle2, punch, hit-wobble, duck, special). HD sheets add guard and recovery. Any missing sheet falls back to a recolour of teal.
import { duckPose, gloveOffPose, orangeGlove, mirror, swapColours } from './poses.js';
import { lw, lh, withMeta, blankLike } from './sprite.js';
import { SPECIALS } from './specials.js';

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
// The level-5 BOSS, KANG (named by the Team; 1 player): not on the wheel. A wind ninja with an orange scarf and WIND STORM fists.
export const BOSS = { id: 'boss', name: 'KANG', sv: 'KANG', color: '#f28a2e', light: '#ffd08a', dark: '#1e2a4a', chance: 0 };

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
const recolour = (frame, b) => swapColours(frame, Object.fromEntries(Object.entries(TEAL_SHADES).map(([k, v]) => [k, rgb(b[v])])));

const SHEETS = { green: ['boxer-green', 'green-glove'], purple: ['boxer-purple', 'purple-glove'], zeus: ['zeus-boxer', 'zeus-glove'], boss: ['boss-boxer', 'boss-glove'] };
export const POSES = ['idle', 'punch', 'hit', 'duck', 'guard', 'special', 'victory'];
// On the first pixel-art frames (64x72 game pixels) the feet stand on row 69 and the glove's front tip is at 46, 12.
const OLD_FEET = [32, 69], OLD_GLOVE_TIP = [46, 12];

// The first pixel-art poses for a boxer, facing right. Every pose is a list of frames (an animation).
function oldPoses(b, art, teal) {
  if (b.id === 'teal') return teal;
  if (b.id === 'orange') {
    // the orange art faces left: turn it round to face right like everyone else
    const [O_IDLE, O_IDLE2, O_GUARD, O_HIT] = art['opponent-boxer'];
    const [O_PUNCH, O_DUCK] = art['opponent-extra'] || [];
    return { idle: [mirror(O_IDLE), mirror(O_IDLE2)], punch: [mirror(O_PUNCH || gloveOffPose(O_IDLE))], hit: [mirror(O_HIT)],
      duck: [mirror(O_DUCK || duckPose(O_IDLE))], guard: [mirror(O_GUARD)], special: [mirror(O_IDLE)] };
  }
  const f = art[SHEETS[b.id][0]];
  if (f && f.length >= 5) return { idle: [f[0], f[1]], punch: [f[2]], hit: [f[3]], duck: [f[4]], guard: [f[0]], special: [f[5] || f[0]] };
  const rc = (fr) => recolour(fr, b);
  return Object.fromEntries(Object.entries(teal).map(([k, v]) => [k, v.map(rc)]));
}
function oldGlove(b, art) {
  const teal = art['rocket-glove'];
  if (b.id === 'teal') return teal;
  if (b.id === 'orange') return art['opponent-glove'] ? art['opponent-glove'].map(mirror) : teal.map(orangeGlove);
  return art[SHEETS[b.id][1]] || teal.map((fr) => recolour(fr, b));
}

// Builds { id: boxer } with ready-to-draw poses for both sides (poses[0] faces right, poses[1] left), the
// rocket-glove frames (facing right), the reveal picture for the wheel, and a head picture (portrait).
// HD art (art.hd.characters) is used wherever it exists; b.hd says whether this boxer has it.
export function buildRoster(art) {
  const [P_IDLE, P_IDLE2, P_PUNCH, P_HIT] = art['player-boxer'];
  const [P_DUCK] = art['player-extra'] || [];
  const old = (fr) => Object.assign(fr, { ax: OLD_FEET[0], ay: OLD_FEET[1] });
  for (const sheet of ['player-boxer', 'player-extra', 'opponent-boxer', 'opponent-extra', ...Object.values(SHEETS).map((s) => s[0])]) (art[sheet] || []).forEach(old);
  for (const sheet of ['rocket-glove', 'opponent-glove', ...Object.values(SHEETS).map((s) => s[1])]) (art[sheet] || []).forEach((fr) => { fr.tip = OLD_GLOVE_TIP; });
  const teal = { idle: [P_IDLE, P_IDLE2], punch: [P_PUNCH], hit: [P_HIT], duck: [P_DUCK || old(duckPose(P_IDLE))], guard: [P_IDLE], special: [P_IDLE] };

  const roster = {};
  for (const b of [...BOXERS, BOSS]) {
    const hd = art.hd?.characters?.[b.id];
    let right, glove, head;
    if (hd && hd.poses.idle) {
      const turn = (list) => (hd.facing < 0 ? list.map(mirror) : list);
      right = Object.fromEntries(Object.entries(hd.poses).map(([k, v]) => [k, turn(v)]));
      // the HD sheets' "special" is the triumphant glove-up pose: it is the VICTORY pose. A special punch flies
      // from the launch pose (front glove gone) unless the sheet has its own "special-punch".
      if (!right.victory && right.special) right.victory = right.special;
      right.special = right.superpunch || right.punch;
      glove = hd.glove ? turn(hd.glove) : hdGlove(b, art) || oldGlove(b, art);
      head = hd.portrait ? fit(turn([hd.portrait])[0], 36, 30) : autoHead(right.idle[0]);
    } else {
      right = oldPoses(b, art, teal);
      glove = oldGlove(b, art);
      head = crop(right.idle[0], 6, 2, 34, 26);
    }
    // any pose the art doesn't have yet falls back to a near one
    right.idle ||= right.guard;
    right.guard ||= [right.idle[0]];
    right.punch ||= right.idle;
    right.hit ||= right.idle;
    right.duck ||= [duckPose(right.idle[0])];
    right.special ||= right.punch;
    right.victory ||= right.special;
    // after a punch, the arm still out as the rocket glove clicks back on (HD "recovery"); old art: idle
    right.recovery ||= [right.idle[0]];
    // idle1 + idle2 are a breathing pair (same legs, only the upper body moves): main.js swaps them on the beat
    const left = Object.fromEntries(Object.entries(right).map(([k, v]) => [k, v.map(mirror)]));
    // mirrored breathing starts on the other frame so the two boxers don't bob in step
    if (left.idle.length === 2) left.idle.reverse();
    roster[b.id] = { ...b, hd: !!hd, poses: [right, left], glove, reveal: right.victory[0] || right.special[0], head };
  }
  return roster;
}

// The HD rocket glove of a boxer's element (effects/manifest.json "glove-water" ...): drawn knuckles right,
// so its front tip is its right edge at its anchor height.
function hdGlove(b, art) {
  const list = art.hd?.effects?.[`glove-${SPECIALS[b.id]?.kind}`];
  if (!list) return null;
  for (const fr of list) fr.tip ||= [lw(fr), fr.ay ?? lh(fr) / 2];
  return list;
}

// A copy of part of a frame (x, y, w, h in game pixels).
function crop(frame, x, y, w, h) {
  const k = frame.width / lw(frame);
  const c = document.createElement('canvas');
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext('2d').drawImage(frame, x * k, y * k, w * k, h * k, 0, 0, c.width, c.height);
  return withMeta(c, { lw: w, lh: h, ax: w / 2, ay: h / 2 });
}
// The same picture, shown at most maxW x maxH game pixels.
function fit(frame, maxW, maxH) {
  const s = Math.min(maxW / lw(frame), maxH / lh(frame));
  const c = blankLike(frame);
  c.getContext('2d').drawImage(frame, 0, 0);
  return withMeta(c, { lw: lw(frame) * s, lh: lh(frame) * s, ax: (lw(frame) * s) / 2, ay: (lh(frame) * s) / 2 });
}
// No portrait in the manifest: a square around the top of the drawn boxer (hair, laurel and beard included).
function autoHead(frame) {
  const sc = document.createElement('canvas');
  sc.width = frame.width; sc.height = frame.height;
  const g = sc.getContext('2d', { willReadFrequently: true });
  g.drawImage(frame, 0, 0);
  const d = g.getImageData(0, 0, frame.width, frame.height).data;
  let top = frame.height, left = frame.width, right = 0, bottom = 0;
  for (let y = 0; y < frame.height; y++) for (let x = 0; x < frame.width; x++) {
    if (d[(y * frame.width + x) * 4 + 3] < 40) continue;
    if (y < top) top = y; if (y > bottom) bottom = y; if (x < left) left = x; if (x > right) right = x;
  }
  const k = frame.width / lw(frame);
  const size = Math.min(right - left, (bottom - top) * 0.42);
  // the head sits toward the back of a boxer facing right: centre on the top row's middle
  let rowL = frame.width, rowR = 0;
  for (let y = top; y < top + size; y++) for (let x = 0; x < frame.width; x++) if (d[(y * frame.width + x) * 4 + 3] >= 40) { rowL = Math.min(rowL, x); rowR = Math.max(rowR, x); }
  const cx = (rowL + rowR) / 2;
  return fit(crop(frame, (cx - size / 2) / k, top / k, size / k, size / k), 34, 30);
}
