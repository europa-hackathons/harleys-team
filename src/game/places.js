// The PLACES the fights happen in: one per level, and a random one in 2 players.
// Real backgrounds come from the Drawing Friend (assets/art/bg-<n>-<id>.png, 256x144 game pixels, registered
// in sprites.json). Until a picture exists, a code-drawn stand-in in the same pixel style is used.
// The real pictures are whole scenes (floor included), so nothing is drawn over them.
import { W, H, COLORS, FLOOR_Y, disc, drawArena, drawRing } from './scene.js';
import { blit } from './sprite.js';

export const PLACES = {
  arena: { name: 'ARENA', sv: 'ARENAN', icon: '🏟️', art: 'bg-1-arena' },
  apartment: { name: 'THE APARTMENT', sv: 'LÄGENHETEN', icon: '🛋️', art: 'bg-2-apartment' },
  jungle: { name: 'THE JUNGLE', sv: 'DJUNGELN', icon: '🌴', art: 'bg-3-jungle' },
  volcano: { name: 'THE VOLCANO', sv: 'VULKANEN', icon: '🌋', art: 'bg-4-volcano' },
  space: { name: 'OUTER SPACE', sv: 'RYMDEN', icon: '🚀', art: 'bg-5-space' },
  cliffside: { name: 'THE CLIFFSIDE', sv: 'KLIPPAN', icon: '🏔️', art: 'bg-6-cliffside', artOnly: true },   // 2 players only, once its art exists
};

// Places 2 players can get at random (a place marked artOnly joins only when its picture has landed).
export function randomPlace(art) {
  const ids = Object.keys(PLACES).filter((id) => !PLACES[id].artOnly || hasPicture(id, art));
  return ids[Math.floor(Math.random() * ids.length)];
}

// Ring colours for each stand-in place.
const LOOKS = {
  apartment: { floor: '#c98a4b', floorDark: '#8a5a2b', apron: '#5a3a2a', post: '#e0485a', postDark: '#a8304a', rope: '#f4e4c4' },
  jungle: { floor: '#8a6a3a', floorDark: '#5e4426', apron: '#2f4a22', post: '#64be52', postDark: '#347346', rope: '#e8d08a' },
  volcano: { floor: '#5a4a52', floorDark: '#3a2e36', apron: '#2a1a22', post: '#ff7a2e', postDark: '#b0402a', rope: '#ffd23f' },
  space: { floor: '#6b6f9a', floorDark: '#474a72', apron: '#22244a', post: '#aa65d9', postDark: '#694393', rope: '#bfe8ff' },
  cliffside: { floor: '#9a8a6a', floorDark: '#6a5c44', apron: '#3a4a5a', post: '#e0485a', postDark: '#a8304a', rope: '#f4e4c4' },
};

// Draws the place. time = seconds (for twinkles, embers), excite = how hard the arena crowd cheers.
export function drawPlace(g, id, art, time, excite = 0) {
  const p = PLACES[id] || PLACES.arena;
  // HD place picture (a whole scene, ring included) first, then the first pixel-art one
  const hd = art.hd?.world?.[id];
  if (hd) { drawCover(g, hd.img); return; }
  const pic = art[p.art];
  if (pic) { blit(g, pic[0], 0, 0, W, H); return; }
  if (!LOOKS[id]) { drawArena(g, time, excite); return; }
  g.drawImage(still(id), 0, 0);
  MOVING[id]?.(g, time);
  drawRing(g, LOOKS[id]);
}

// A whole-scene picture stretched over the 256x144 game (smooth when shrunk, crisp when blown up).
function drawCover(g, img) {
  const t = g.getTransform(), shrink = img.width / (W * t.a);
  g.imageSmoothingEnabled = shrink > 1.05;
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, W, H);
  g.imageSmoothingEnabled = false;
}
// true when this place has a whole-scene picture (no code-drawn ring on top)
export const hasPicture = (id, art) => !!(art.hd?.world?.[id] || art[(PLACES[id] || PLACES.arena).art]);

// ---------- the stand-ins: a still picture made once, plus a few moving bits ----------
const stills = {};
function still(id) {
  if (stills[id]) return stills[id];
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  PAINT[id](g);
  return (stills[id] = c);
}
const rect = (g, color, x, y, w, h) => { g.fillStyle = color; g.fillRect(x, y, w, h); };
// sky in flat bands, top to bottom
function bands(g, colors, bottom = FLOOR_Y) {
  const h = Math.ceil(bottom / colors.length);
  colors.forEach((c, i) => rect(g, c, 0, i * h, W, h + 1));
}
function seeded(seed) { return () => ((seed = (seed * 9301 + 49297) % 233280) / 233280); }

const PAINT = {
  // a cosy city apartment at night: windows with the skyline, a sofa, lamps
  apartment(g) {
    bands(g, ['#4a3550', '#55405c']);
    rect(g, '#3a2a40', 0, 72, W, FLOOR_Y - 72);                      // skirting wall
    for (const wx of [24, 104, 184]) {                                // windows
      rect(g, COLORS.outline, wx - 2, 10, 52, 46);
      rect(g, '#0f2347', wx, 12, 48, 42);
      const rnd = seeded(wx);
      for (let b = 0; b < 6; b++) {                                   // skyline
        const bw = 6 + Math.floor(rnd() * 6), bh = 10 + Math.floor(rnd() * 20), bx = wx + b * 8;
        rect(g, '#1e3a63', bx, 54 - bh, Math.min(bw, wx + 48 - bx), bh);
        for (let y = 54 - bh + 2; y < 52; y += 4) for (let x = bx + 1; x < Math.min(bx + bw, wx + 47); x += 3) if (rnd() < 0.45) rect(g, '#ffd23f', x, y, 1, 2);
      }
      rect(g, '#f4e4c4', wx + 23, 12, 2, 42); rect(g, '#f4e4c4', wx, 32, 48, 2);   // window frame
      rect(g, '#b04a5a', wx - 6, 8, 6, 52); rect(g, '#b04a5a', wx + 48, 8, 6, 52); // curtains
    }
    rect(g, COLORS.outline, 74, 52, 4, 26); rect(g, '#d8b070', 75, 52, 2, 26);   // lamp stands
    rect(g, COLORS.outline, 178, 52, 4, 26); rect(g, '#d8b070', 179, 52, 2, 26);
    for (const lx of [76, 180]) { rect(g, COLORS.outline, lx - 8, 40, 18, 13); rect(g, '#ffe27a', lx - 7, 41, 16, 11); }
    rect(g, COLORS.outline, 96, 58, 66, 20);                          // sofa
    rect(g, '#1e5a7a', 97, 59, 64, 8); rect(g, '#2a7aa0', 97, 67, 64, 10);
    rect(g, '#1e5a7a', 97, 62, 6, 15); rect(g, '#1e5a7a', 155, 62, 6, 15);
    rect(g, '#ffd23f', 112, 63, 8, 5); rect(g, '#e0485a', 138, 63, 8, 5); // cushions
  },
  jungle(g) {
    bands(g, ['#2f7a5a', '#3a8f5a', '#4aa060', '#2f6a40']);
    const rnd = seeded(11);
    for (let i = 0; i < 9; i++) {                                     // tree trunks
      const x = Math.floor(rnd() * W), w = 6 + Math.floor(rnd() * 6);
      rect(g, COLORS.outline, x - 1, 0, w + 2, FLOOR_Y); rect(g, '#6a4a2a', x, 0, w, FLOOR_Y); rect(g, '#8a6a3a', x + 1, 0, 2, FLOOR_Y);
    }
    for (let i = 0; i < 26; i++) {                                    // leaf clumps
      const x = rnd() * W, y = rnd() * 40, r = 8 + Math.floor(rnd() * 8);
      g.fillStyle = COLORS.outline; disc(g, x, y, r + 1);
      g.fillStyle = i % 3 ? '#347346' : '#64be52'; disc(g, x, y, r);
      g.fillStyle = '#bbf183'; disc(g, x - r / 3, y - r / 3, 2);
    }
    for (let i = 0; i < 12; i++) {                                    // bushes behind the ring
      const x = i * 24 + rnd() * 10, r = 10 + Math.floor(rnd() * 6);
      g.fillStyle = COLORS.outline; disc(g, x, 80, r + 1);
      g.fillStyle = i % 2 ? '#347346' : '#2a5e38'; disc(g, x, 80, r);
    }
    rect(g, '#2a5e38', 0, 84, W, FLOOR_Y - 84);
  },
  volcano(g) {
    bands(g, ['#2a0f1e', '#4a1426', '#7a2026', '#a8302a']);
    g.fillStyle = '#3a1a1e';                                          // the volcano
    for (let y = 20; y < FLOOR_Y; y++) { const half = 14 + (y - 20) * 1.3; g.fillRect(Math.round(128 - half), y, Math.round(half * 2), 1); }
    rect(g, '#ff7a2e', 116, 20, 24, 4); rect(g, '#ffd23f', 120, 20, 16, 2);   // glowing top
    for (const [x0, dx] of [[124, -1], [132, 1]]) {                   // lava rivers
      g.fillStyle = '#ff7a2e';
      for (let y = 24; y < 78; y++) g.fillRect(Math.round(x0 + dx * (y - 24) * 0.7 + Math.sin(y * 0.3) * 2), y, 3, 1);
    }
    for (const x of [30, 210]) {                                      // dark rocks
      g.fillStyle = COLORS.outline; disc(g, x, 82, 20);
      g.fillStyle = '#2a1a22'; disc(g, x, 82, 19);
    }
    rect(g, '#2a1a22', 0, 82, W, FLOOR_Y - 82);
  },
  space(g) {
    bands(g, ['#070b1e', '#0b1230', '#101a40']);
    const rnd = seeded(5);
    for (let i = 0; i < 60; i++) rect(g, rnd() < 0.3 ? '#ffd23f' : '#ffffff', Math.floor(rnd() * W), Math.floor(rnd() * 90), 1, 1);
    g.fillStyle = COLORS.outline; disc(g, 200, 34, 19);               // ringed planet
    g.fillStyle = '#aa65d9'; disc(g, 200, 34, 18);
    g.fillStyle = '#e5b3ff'; disc(g, 194, 28, 5);
    rect(g, COLORS.outline, 172, 36, 56, 4); rect(g, '#ffd23f', 173, 37, 54, 2);
    g.fillStyle = COLORS.outline; disc(g, 46, 30, 11);                // moon
    g.fillStyle = '#c8c8d8'; disc(g, 46, 30, 10);
    g.fillStyle = '#9a9ab0'; disc(g, 42, 27, 3); disc(g, 50, 34, 2);
    g.fillStyle = COLORS.outline; disc(g, 128, 150, 70);              // the little planet the ring stands on
    g.fillStyle = '#3a3e6a'; disc(g, 128, 150, 69);
  },
  cliffside(g) {
    bands(g, ['#7fc8f0', '#9fd8f5', '#bfe8ff']);
    g.fillStyle = '#6a7a8a';
    for (let x = 0; x < W; x++) { const h = 30 + Math.sin(x * 0.05) * 10 + Math.sin(x * 0.13) * 6; g.fillRect(x, Math.round(FLOOR_Y - h), 1, Math.round(h)); }
  },
};

// The moving bits drawn over the still picture.
const MOVING = {
  volcano(g, time) {   // embers floating up
    for (let i = 0; i < 14; i++) {
      const x = (i * 37 + Math.sin(time + i) * 6) % W, y = FLOOR_Y - ((time * (14 + i * 2) + i * 23) % FLOOR_Y);
      rect(g, i % 3 ? '#ff9f2e' : '#ffd23f', Math.round(x), Math.round(y), 1, 1);
    }
  },
  space(g, time) {     // twinkling big stars
    for (let i = 0; i < 8; i++) {
      if (Math.floor(time * 3 + i * 1.7) % 3 === 0) continue;
      const x = (i * 61 + 13) % W, y = (i * 23 + 7) % 70;
      rect(g, '#ffffff', x - 1, y, 3, 1); rect(g, '#ffffff', x, y - 1, 1, 3);
    }
  },
  jungle(g, time) {    // fireflies
    for (let i = 0; i < 6; i++) {
      if (Math.floor(time * 2 + i) % 4 === 0) continue;
      rect(g, '#ffd23f', Math.round((i * 47 + Math.sin(time + i) * 10) % W), Math.round(40 + Math.cos(time * 0.7 + i) * 14 + i * 3), 1, 1);
    }
  },
};
