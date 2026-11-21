// The arena: night sky, cheering crowd silhouettes, ring posts, ropes and floor.
// Everything is drawn with whole-pixel rectangles on the small 256x144 picture, so it stays crisp.
// (256x144 makes the sprite art pixels match the game pixels and scales evenly to 1280x720.)

export const W = 256, H = 144;
export const FLOOR_Y = 112;
const ROPES = [72, 84, 96];
export const COLORS = {
  navy: '#0f2347', crowd: '#1e5a7a', crowdBack: '#173f63', ring: '#e0485a', ringDark: '#a8304a',
  rope: '#f4e4c4', floor: '#17aeb0', floorDark: '#0f7f8a', apron: '#0b5566', outline: '#0b1226', sparkle: '#ffd23f',
};

// Filled circle made of rectangles (no blurry edges).
export function disc(g, cx, cy, r) {
  for (let dy = -r; dy <= r; dy++) {
    const dx = Math.floor(Math.sqrt(r * r - dy * dy));
    g.fillRect(Math.round(cx - dx), Math.round(cy + dy), dx * 2 + 1, 1);
  }
}

// The crowd: two rows of fans. Fixed layout so it doesn't jump around between games.
const fans = [];
{
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let x = -4; x < W + 16; x += 22) fans.push({ x: x + rnd() * 6, y: 34, back: true, arms: rnd() < 0.5, phase: rnd() * 6 });
  for (let x = 6; x < W + 16; x += 25) fans.push({ x: x + rnd() * 6, y: 56, back: false, arms: rnd() < 0.4, phase: rnd() * 6 });
}

function drawFan(g, f, bob, armsUp) {
  const x = Math.round(f.x), y = Math.round(f.y - bob);
  g.fillStyle = f.back ? COLORS.crowdBack : COLORS.crowd;
  disc(g, x, y - 8, 6);                 // head
  g.fillRect(x - 10, y, 21, 26);        // body
  g.fillRect(x - 8, y - 2, 17, 2);
  if (armsUp) {                         // cheering arms
    g.fillRect(x - 15, y - 14, 4, 16);
    g.fillRect(x + 12, y - 14, 4, 16);
    g.fillRect(x - 17, y - 18, 5, 4);
    g.fillRect(x + 13, y - 18, 5, 4);
  }
  g.fillStyle = COLORS.navy;            // happy face
  g.fillRect(x - 3, y - 10, 2, 2);
  g.fillRect(x + 2, y - 10, 2, 2);
  g.fillRect(x - 2, y - 5, 5, 1);
  g.fillRect(x - 3, y - 6, 1, 1);
  g.fillRect(x + 3, y - 6, 1, 1);
}

// excite 0..1: how hard the crowd is cheering (goes up after a hit).
export function drawArena(g, time, excite = 0) {
  g.fillStyle = COLORS.navy;
  g.fillRect(0, 0, W, H);

  for (const f of fans) {
    const bob = Math.max(0, Math.sin(time * (3 + excite * 9) + f.phase)) * (1 + excite * 3);
    drawFan(g, f, Math.round(bob), f.arms || excite > 0.5);
  }
  // a dark band behind the ring so the boxers stand out from the crowd
  g.fillStyle = COLORS.navy;
  g.fillRect(0, 78, W, FLOOR_Y - 78);
  drawRing(g);
}

// The ring itself: ropes, corner posts, floor and apron. look = other colours for the floor (each place has its own).
export const RING_LOOK = { floor: COLORS.floor, floorDark: COLORS.floorDark, apron: COLORS.apron, post: COLORS.ring, postDark: COLORS.ringDark, rope: COLORS.rope };
export function drawRing(g, look = RING_LOOK) {
  // ropes: cream with a dark outline
  for (const ry of ROPES) {
    g.fillStyle = COLORS.outline; g.fillRect(6, ry - 1, W - 12, 5);
    g.fillStyle = look.rope; g.fillRect(6, ry, W - 12, 3);
  }
  // corner posts
  for (const px of [0, W - 8]) {
    g.fillStyle = COLORS.outline; g.fillRect(px - 1, 62, 10, FLOOR_Y - 60);
    g.fillStyle = look.post; g.fillRect(px, 63, 8, FLOOR_Y - 62);
    g.fillStyle = look.postDark; g.fillRect(px + 6, 63, 2, FLOOR_Y - 62);
    g.fillStyle = look.rope;
    for (const ry of ROPES) g.fillRect(px + 1, ry, 6, 2);
  }
  // floor and apron
  g.fillStyle = COLORS.outline; g.fillRect(0, FLOOR_Y - 1, W, 1);
  g.fillStyle = look.floor; g.fillRect(0, FLOOR_Y, W, 22);
  g.fillStyle = look.floorDark; g.fillRect(0, FLOOR_Y + 19, W, 3);
  g.fillStyle = COLORS.outline; g.fillRect(0, FLOOR_Y + 22, W, 1);
  g.fillStyle = look.apron; g.fillRect(0, FLOOR_Y + 23, W, H - FLOOR_Y - 23);
}

// Flat dark oval under a boxer's feet.
export function drawShadow(g, cx, y, w) {
  g.fillStyle = 'rgba(11, 18, 38, 0.35)';
  g.fillRect(Math.round(cx - w / 2), y, w, 3);
  g.fillRect(Math.round(cx - w / 2 + 3), y + 3, w - 6, 1);
}

// Pixel digits (3x5) for the timer and health number, with a dark outline.
const DIGITS = {
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001',
  5: '111100111001111', 6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111',
  '/': '001001010100100', P: '111101111100100',
};
export function drawNumber(g, text, x, y, color, size = 1, align = 'left') {
  const chars = [...String(text)];
  const step = 4 * size;
  let left = align === 'center' ? x - (chars.length * step - size) / 2 : align === 'right' ? x - (chars.length * step - size) : x;
  left = Math.round(left);
  for (const pass of [COLORS.outline, color]) {
    g.fillStyle = pass;
    chars.forEach((ch, i) => {
      const bits = DIGITS[ch];
      if (!bits) return;
      for (let p = 0; p < 15; p++) {
        if (bits[p] !== '1') continue;
        const px = left + i * step + (p % 3) * size, py = y + Math.floor(p / 3) * size;
        if (pass === COLORS.outline) g.fillRect(px - 1, py - 1, size + 2, size + 2);
        else g.fillRect(px, py, size, size);
      }
    });
  }
}
