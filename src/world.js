// Candy land, drawn with plain 2D canvas: a twinkly starry night sky, parallax candy scenery,
// the glowing rainbow bridge over the chocolate river, candy, jelly blobs, rainbow pickups and sparkles.
// The view is measured in "units": it is always at least 600 units tall, and everything sits on the bottom edge.
import { starShape } from './unicorn.js';

export const RAINBOW = ['#ff4f7b', '#ff9a3c', '#ffe14d', '#4fe08a', '#4cc3ff', '#a46bff'];
export const CANDY_COLORS = ['#ff6fb5', '#ffe14d', '#5cc8ff', '#5ce1a0', '#c39bff', '#ffab5c'];
const OUT = '#4b2350';
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const hash = (k) => {
  const s = Math.sin(k * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const wrap = (v, m) => ((v % m) + m) % m;

export function layout(W, H) {
  return {
    W, H,
    trackTop: H - 230,
    trackBottom: H - 122,
    backRow: H - 202, // the rival runs here
    itemRow: H - 168, // candy, jelly and rainbows sit on this line
    frontRow: H - 136, // the player runs here
  };
}

// ---------- Pictures drawn once and reused ----------

function sprite(w, h, draw, tint = 0) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * 2);
  c.height = Math.ceil(h * 2);
  const g = c.getContext('2d');
  g.scale(2, 2);
  draw(g, w, h);
  if (tint) {
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = `rgba(36, 18, 92, ${tint})`;
    g.fillRect(0, 0, w, h);
  }
  return { img: c, w, h };
}

function sprinkle(g, x, y, color, angle, len = 7) {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  g.strokeStyle = color;
  g.lineCap = 'round';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(-len / 2, 0);
  g.lineTo(len / 2, 0);
  g.stroke();
  g.restore();
}

function dripEdge(g, x0, x1, y, step, minDrip, maxDrip) {
  // Bottom edge of icing, from right to left, with round drips.
  for (let x = x1; x > x0 - step; x -= step) {
    const d = rand(minDrip, maxDrip);
    g.quadraticCurveTo(x - step * 0.25, y + d * 1.2, x - step * 0.5, y + d * 0.2);
    g.quadraticCurveTo(x - step * 0.75, y - 2, x - step, y);
  }
}

function mountainSprite(tint) {
  return sprite(320, 210, (g, w, h) => {
    const m = new Path2D();
    m.moveTo(0, h);
    m.quadraticCurveTo(w * 0.22, h * 0.45, w * 0.42, h * 0.12);
    m.quadraticCurveTo(w * 0.5, -h * 0.02, w * 0.58, h * 0.12);
    m.quadraticCurveTo(w * 0.78, h * 0.45, w, h);
    m.closePath();
    const choc = g.createLinearGradient(0, 0, 0, h);
    choc.addColorStop(0, '#9a5a34');
    choc.addColorStop(1, '#5a2e1a');
    g.fillStyle = choc;
    g.fill(m);
    g.save();
    g.clip(m);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(w, 0);
    g.lineTo(w, h * 0.4);
    dripEdge(g, 0, w, h * 0.4, 26, 6, 26);
    g.closePath();
    g.fillStyle = '#fff2fa';
    g.fill();
    for (let i = 0; i < 26; i++) {
      sprinkle(g, rand(w * 0.3, w * 0.7), rand(h * 0.08, h * 0.4), pick(RAINBOW), rand(0, TAU), 6);
    }
    g.restore();
    g.strokeStyle = 'rgba(75, 35, 80, 0.6)';
    g.lineWidth = 3;
    g.stroke(m);
  }, tint);
}

function hillSprite(color, tint) {
  return sprite(300, 130, (g, w, h) => {
    const m = new Path2D();
    m.moveTo(0, h);
    m.bezierCurveTo(w * 0.05, h * 0.05, w * 0.95, h * 0.05, w, h);
    m.closePath();
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.25, color);
    grad.addColorStop(1, color);
    g.fillStyle = grad;
    g.fill(m);
    g.save();
    g.clip(m);
    // Little gumdrops along the top and sugar dots all over.
    for (let i = 0; i < 9; i++) {
      const x = w * (0.12 + i * 0.095);
      const y = h * 0.28 + Math.abs(i - 4) * 7;
      g.fillStyle = pick(CANDY_COLORS);
      g.beginPath();
      g.ellipse(x, y, 13, 15, 0, Math.PI, 0);
      g.lineTo(x + 13, y + 6);
      g.lineTo(x - 13, y + 6);
      g.fill();
    }
    g.fillStyle = 'rgba(255, 255, 255, 0.55)';
    for (let i = 0; i < 90; i++) {
      g.beginPath();
      g.arc(rand(0, w), rand(h * 0.15, h), rand(0.8, 2), 0, TAU);
      g.fill();
    }
    g.restore();
  }, tint);
}

function lollipopSprite(color, tint) {
  return sprite(130, 240, (g, w) => {
    const cx = w / 2;
    // Chocolate trunk.
    g.fillStyle = '#8a4f2a';
    g.strokeStyle = OUT;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(cx - 8, 238);
    g.quadraticCurveTo(cx - 4, 160, cx - 6, 100);
    g.lineTo(cx + 6, 100);
    g.quadraticCurveTo(cx + 4, 160, cx + 10, 238);
    g.closePath();
    g.fill();
    g.stroke();
    // Swirly top.
    const r = 56;
    const cy = 62;
    g.beginPath();
    g.arc(cx, cy, r, 0, TAU);
    g.fillStyle = color;
    g.fill();
    g.save();
    g.clip();
    g.strokeStyle = '#fff6fb';
    g.lineWidth = 9;
    g.lineCap = 'round';
    g.beginPath();
    for (let a = 0; a < TAU * 3.2; a += 0.08) {
      const rr = (a / (TAU * 3.2)) * r;
      g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    g.stroke();
    g.fillStyle = 'rgba(255, 255, 255, 0.35)';
    g.beginPath();
    g.ellipse(cx - 20, cy - 24, 16, 9, -0.6, 0, TAU);
    g.fill();
    g.restore();
    g.beginPath();
    g.arc(cx, cy, r, 0, TAU);
    g.lineWidth = 3.5;
    g.strokeStyle = OUT;
    g.stroke();
  }, tint);
}

function bushSprite(color, tint) {
  return sprite(150, 90, (g) => {
    const puffs = [[30, 62, 28], [62, 44, 34], [100, 50, 30], [124, 66, 22], [76, 70, 26]];
    g.fillStyle = OUT;
    for (const [x, y, r] of puffs) {
      g.beginPath();
      g.arc(x, y, r + 2.5, 0, TAU);
      g.fill();
    }
    g.fillStyle = color;
    for (const [x, y, r] of puffs) {
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fill();
    }
    g.fillStyle = 'rgba(255, 255, 255, 0.4)';
    for (const [x, y, r] of puffs) {
      g.beginPath();
      g.arc(x - r * 0.3, y - r * 0.35, r * 0.35, 0, TAU);
      g.fill();
    }
  }, tint);
}

function gumdropSprite(color) {
  return sprite(120, 110, (g, w, h) => {
    const m = new Path2D();
    m.moveTo(6, h - 4);
    m.bezierCurveTo(4, 10, w - 4, 10, w - 6, h - 4);
    m.quadraticCurveTo(w / 2, h + 4, 6, h - 4);
    g.fillStyle = color;
    g.fill(m);
    g.save();
    g.clip(m);
    for (let i = 0; i < 140; i++) {
      g.fillStyle = Math.random() < 0.6 ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.12)';
      g.beginPath();
      g.arc(rand(0, w), rand(0, h), rand(0.8, 2.2), 0, TAU);
      g.fill();
    }
    g.fillStyle = 'rgba(255, 255, 255, 0.4)';
    g.beginPath();
    g.ellipse(w * 0.34, h * 0.32, 14, 22, -0.4, 0, TAU);
    g.fill();
    g.restore();
    g.strokeStyle = OUT;
    g.lineWidth = 3.5;
    g.stroke(m);
  });
}

function moonSprite() {
  const moon = sprite(80, 80, (g) => {
    g.fillStyle = '#fff4c9';
    g.beginPath();
    g.arc(40, 40, 30, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(240, 210, 140, 0.5)';
    for (const [x, y, r] of [[28, 50, 5], [36, 30, 3.5], [22, 36, 3]]) {
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fill();
    }
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    g.arc(56, 30, 27, 0, TAU);
    g.fill();
  });
  return sprite(200, 200, (g) => {
    const glow = g.createRadialGradient(100, 100, 10, 100, 100, 100);
    glow.addColorStop(0, 'rgba(255, 240, 200, 0.45)');
    glow.addColorStop(1, 'rgba(255, 240, 200, 0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, 200, 200);
    g.drawImage(moon.img, 60, 60, 80, 80);
  });
}

function candySprite(color, kind) {
  return sprite(64, 64, (g) => {
    const glow = g.createRadialGradient(32, 32, 4, 32, 32, 32);
    glow.addColorStop(0, color);
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    g.globalAlpha = 0.55;
    g.fillStyle = glow;
    g.fillRect(0, 0, 64, 64);
    g.globalAlpha = 1;
    g.strokeStyle = OUT;
    g.lineWidth = 2.5;
    g.lineJoin = 'round';
    if (kind === 'wrap') {
      for (const side of [-1, 1]) {
        g.beginPath();
        g.moveTo(32 + side * 10, 32);
        g.lineTo(32 + side * 25, 21);
        g.lineTo(32 + side * 22, 27);
        g.lineTo(32 + side * 26, 32);
        g.lineTo(32 + side * 22, 37);
        g.lineTo(32 + side * 25, 43);
        g.closePath();
        g.fillStyle = color;
        g.fill();
        g.stroke();
      }
      g.beginPath();
      g.ellipse(32, 32, 14, 11, 0, 0, TAU);
      g.fillStyle = color;
      g.fill();
      g.stroke();
      g.save();
      g.clip();
      g.strokeStyle = 'rgba(255,255,255,0.75)';
      g.lineWidth = 3.5;
      for (const x of [-8, 0, 8]) {
        g.beginPath();
        g.moveTo(32 + x - 6, 20);
        g.lineTo(32 + x + 6, 44);
        g.stroke();
      }
      g.restore();
    } else {
      g.beginPath();
      g.arc(32, 32, 14, 0, TAU);
      g.fillStyle = color;
      g.fill();
      g.save();
      g.clip();
      g.strokeStyle = '#fff';
      g.lineWidth = 3.5;
      g.beginPath();
      for (let a = 0; a < TAU * 2.4; a += 0.15) {
        const rr = (a / (TAU * 2.4)) * 14;
        g.lineTo(32 + Math.cos(a) * rr, 32 + Math.sin(a) * rr);
      }
      g.stroke();
      g.restore();
      g.beginPath();
      g.arc(32, 32, 14, 0, TAU);
      g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.beginPath();
    g.ellipse(27, 26, 4, 2.5, -0.5, 0, TAU);
    g.fill();
  });
}

function rainbowPickupSprite() {
  return sprite(120, 90, (g) => {
    const glow = g.createRadialGradient(60, 52, 6, 60, 52, 60);
    glow.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    glow.addColorStop(0.4, 'rgba(255, 170, 240, 0.45)');
    glow.addColorStop(1, 'rgba(255, 170, 240, 0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, 120, 90);
    g.lineCap = 'butt';
    g.strokeStyle = OUT;
    g.lineWidth = 30;
    g.beginPath();
    g.arc(60, 62, 25, Math.PI, 0);
    g.stroke();
    RAINBOW.forEach((c, i) => {
      g.strokeStyle = c;
      g.lineWidth = 4.6;
      g.beginPath();
      g.arc(60, 62, 37 - i * 4.4, Math.PI, 0);
      g.stroke();
    });
    for (const x of [23, 97]) {
      g.fillStyle = OUT;
      for (const [dx, dy, r] of [[-9, 2, 9], [0, -4, 11], [10, 2, 9]]) {
        g.beginPath();
        g.arc(x + dx, 66 + dy, r + 2, 0, TAU);
        g.fill();
      }
      g.fillStyle = '#ffffff';
      for (const [dx, dy, r] of [[-9, 2, 9], [0, -4, 11], [10, 2, 9]]) {
        g.beginPath();
        g.arc(x + dx, 66 + dy, r, 0, TAU);
        g.fill();
      }
    }
  });
}

// ---------- Scenery layers (made once, scroll at different speeds) ----------

function makeLayer(period, count, makeItem) {
  const items = [];
  for (let i = 0; i < count; i++) items.push(makeItem(i, (i + rand(0.1, 0.9)) * (period / count)));
  return { period, items };
}

const HILL_COLORS = ['#ff9fd0', '#9ff0c8', '#fff09a', '#d3b8ff', '#ffc49a', '#a8e4ff'];
const mountainSprites = [mountainSprite(0.42), mountainSprite(0.42), mountainSprite(0.42)];
const hillSprites = HILL_COLORS.map((c) => hillSprite(c, 0.3));
const lollipopSprites = ['#ff5ca8', '#ffab5c', '#a46bff', '#4cc3ff', '#ff4f7b'].map((c) => lollipopSprite(c, 0.14));
const bushSprites = ['#ffb3dc', '#ffc8e6', '#d7c2ff'].map((c) => bushSprite(c, 0.18));
const gumdropSprites = ['#ff5ca8', '#ffd23b', '#4fe08a', '#a46bff', '#ff9a3c'].map(gumdropSprite);
const moon = moonSprite();

const mountains = makeLayer(1500, 5, (i, x) => ({ x, s: mountainSprites[i % 3], k: rand(0.8, 1.15) }));
const hills = makeLayer(1440, 9, (i, x) => ({ x, s: hillSprites[i % hillSprites.length], k: rand(0.75, 1.15) }));
const trees = makeLayer(1700, 9, (i, x) => (i % 3 === 2
  ? { x, s: pick(bushSprites), k: rand(0.8, 1.1), bush: true }
  : { x, s: lollipopSprites[i % lollipopSprites.length], k: rand(0.72, 1) }));
const front = makeLayer(1600, 3, (i, x) => ({ x, s: gumdropSprites[i % gumdropSprites.length], k: rand(0.85, 1.15) }));

function drawLayer(ctx, layer, scroll, W, baseY) {
  const off = wrap(scroll, layer.period);
  for (let k = -1; k * layer.period - off < W + 400; k++) {
    for (const it of layer.items) {
      const w = it.s.w * it.k;
      const h = it.s.h * it.k;
      const x = it.x + k * layer.period - off;
      if (x + w < -40 || x - w > W + 40) continue;
      ctx.drawImage(it.s.img, x - w / 2, baseY - h + (it.bush ? 8 : 0), w, h);
    }
  }
}

// ---------- Sky ----------

const stars = Array.from({ length: 230 }, () => ({
  x: Math.random(), y: Math.random() ** 1.3, r: 0.6 + Math.random() ** 4 * 2.6,
  ph: Math.random() * TAU, sp: rand(1, 4), c: pick(['#ffffff', '#ffffff', '#fff3b0', '#cfe6ff', '#ffd1f2']),
}));
let shooting = null;
let nextShooting = 2.5;

let skyCache = { h: 0, grad: null };
function skyGradient(ctx, L) {
  if (skyCache.h !== L.trackTop) {
    const g = ctx.createLinearGradient(0, 0, 0, L.trackTop);
    g.addColorStop(0, '#070726');
    g.addColorStop(0.45, '#1d1258');
    g.addColorStop(0.78, '#4b2788');
    g.addColorStop(1, '#b0509f');
    skyCache = { h: L.trackTop, grad: g };
  }
  return skyCache.grad;
}

export function drawSky(ctx, L, t, dt, scroll) {
  const { W } = L;
  ctx.fillStyle = skyGradient(ctx, L);
  ctx.fillRect(0, 0, W, L.H);

  const starH = L.trackTop - 90;
  for (const s of stars) {
    const x = wrap(s.x * (W + 40) - scroll * 0.01, W + 40) - 20;
    const y = s.y * starH;
    const a = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph));
    ctx.globalAlpha = a;
    ctx.fillStyle = s.c;
    if (s.r > 1.7) {
      starPath4(ctx, x, y, s.r * (2 + a * 1.6));
      ctx.fill();
    } else {
      ctx.fillRect(x - s.r / 2, y - s.r / 2, s.r, s.r);
    }
  }
  ctx.globalAlpha = 1;

  ctx.drawImage(moon.img, W - 230, 8, 200, 200);

  // A shooting star now and then.
  nextShooting -= dt;
  if (!shooting && nextShooting <= 0) {
    shooting = { x: rand(W * 0.35, W + 50), y: rand(10, starH * 0.5), vx: -rand(600, 800), vy: rand(200, 300), life: 1 };
    nextShooting = rand(4, 9);
  }
  if (shooting) {
    const s = shooting;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.life -= dt * 1.1;
    const tx = s.x - s.vx * 0.16;
    const ty = s.y - s.vy * 0.16;
    const g = ctx.createLinearGradient(s.x, s.y, tx, ty);
    g.addColorStop(0, `rgba(255, 255, 255, ${Math.max(0, s.life)})`);
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.strokeStyle = g;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.globalAlpha = Math.max(0, s.life);
    ctx.fillStyle = '#fff';
    starPath4(ctx, s.x, s.y, 7);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (s.life <= 0 || s.y > starH) shooting = null;
  }
}

export function starPath4(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.closePath();
}

export function drawScenery(ctx, L, scroll) {
  drawLayer(ctx, mountains, scroll * 0.05, L.W, L.trackTop - 30);
  ctx.fillStyle = '#6f3f8a';
  ctx.fillRect(0, L.trackTop - 30, L.W, 40);
  drawLayer(ctx, hills, scroll * 0.14, L.W, L.trackTop + 8);
  drawLayer(ctx, trees, scroll * 0.35, L.W, L.trackTop + 10);
}

export function drawForeground(ctx, L, scroll) {
  drawLayer(ctx, front, scroll * 1.35, L.W, L.H + 30);
}

// ---------- The super glowing rainbow bridge ----------

export function drawTrack(ctx, L, scroll, t, pxScale, zoom) {
  const { W, trackTop: top, trackBottom: bot } = L;
  const pulse = 0.5 + 0.5 * Math.sin(t * 3);

  // Soft glow rising off the rainbow.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const glowH = 110 + zoom * 40;
  const glow = ctx.createLinearGradient(0, top - glowH, 0, top + 4);
  glow.addColorStop(0, 'rgba(255, 120, 220, 0)');
  glow.addColorStop(0.6, `rgba(255, 140, 230, ${0.16 + pulse * 0.08 + zoom * 0.15})`);
  glow.addColorStop(1, `rgba(255, 230, 250, ${0.45 + pulse * 0.15 + zoom * 0.2})`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, top - glowH, W, glowH + 4);
  ctx.restore();

  // Stripes, with a blurry glow around the whole band.
  const n = RAINBOW.length;
  const h = (bot - top) / n;
  ctx.save();
  ctx.shadowColor = zoom > 0 ? '#fff0ff' : '#ff9df0';
  ctx.shadowBlur = (30 + pulse * 14 + zoom * 30) * pxScale;
  ctx.fillStyle = RAINBOW[0];
  ctx.fillRect(-20, top, W + 40, bot - top);
  ctx.restore();
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = RAINBOW[i];
    ctx.fillRect(0, top + i * h, W, h + 0.6);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(0, top + i * h + 1, W, h * 0.35);
  }

  // Shiny dashes that rush past, so you can feel the speed.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineCap = 'round';
  ctx.lineWidth = 3;
  const gap = 90;
  const first = Math.floor(scroll / gap);
  for (let k = first; k * gap - scroll < W + 60; k++) {
    const x = k * gap - scroll;
    const row = Math.floor(hash(k) * n);
    const len = 20 + hash(k + 0.5) * 40;
    ctx.beginPath();
    ctx.moveTo(x, top + row * h + h * 0.5);
    ctx.lineTo(x + len, top + row * h + h * 0.5);
    ctx.stroke();
  }
  // A big shimmer of light sweeping along the rainbow.
  const sweepW = 260;
  const sx = wrap(t * 420, W + sweepW * 3) - sweepW * 1.5;
  const sweep = ctx.createLinearGradient(sx - sweepW / 2, 0, sx + sweepW / 2, 0);
  sweep.addColorStop(0, 'rgba(255,255,255,0)');
  sweep.addColorStop(0.5, `rgba(255,255,255,${0.35 + zoom * 0.25})`);
  sweep.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sweep;
  ctx.fillRect(sx - sweepW / 2, top, sweepW, bot - top);
  // Bright top edge.
  ctx.fillStyle = `rgba(255, 255, 255, ${0.6 + pulse * 0.3})`;
  ctx.fillRect(0, top - 1.5, W, 3);
  ctx.restore();

  drawBridge(ctx, L, scroll, t);
}

function drawBridge(ctx, L, scroll, t) {
  const { W, H, trackBottom: bot } = L;
  const riverTop = H - 40;

  // Cake side of the bridge.
  const cake = ctx.createLinearGradient(0, bot, 0, H);
  cake.addColorStop(0, '#c98450');
  cake.addColorStop(1, '#7a4122');
  ctx.fillStyle = cake;
  ctx.fillRect(0, bot, W, H - bot);

  // Candy-cane arches with the chocolate river showing underneath.
  const archGap = 250;
  const r = 58;
  const archY = riverTop + 14;
  const first = Math.floor((scroll - r * 2) / archGap);
  for (let k = first; k * archGap - scroll < W + r * 2; k++) {
    const cx = k * archGap - scroll + archGap / 2;
    ctx.fillStyle = '#3a1b0d';
    ctx.beginPath();
    ctx.arc(cx, archY, r, Math.PI, 0);
    ctx.lineTo(cx + r, H);
    ctx.lineTo(cx - r, H);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - r - 7, H);
    ctx.lineTo(cx - r - 7, archY);
    ctx.arc(cx, archY, r + 7, Math.PI, 0);
    ctx.lineTo(cx + r + 7, H);
    ctx.lineCap = 'butt';
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 19;
    ctx.stroke();
    ctx.strokeStyle = '#fff4f8';
    ctx.lineWidth = 13;
    ctx.stroke();
    ctx.setLineDash([11, 11]);
    ctx.lineDashOffset = 0;
    ctx.strokeStyle = '#ff4f8a';
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // White icing with drips and sprinkles along the edge of the rainbow.
  const step = 30;
  ctx.fillStyle = '#fff4fb';
  ctx.beginPath();
  ctx.moveTo(-step, bot - 3);
  const k0 = Math.floor(scroll / step) - 1;
  const kEnd = k0 + Math.ceil(W / step) + 3;
  for (let k = k0; k <= kEnd; k++) ctx.lineTo(k * step - scroll, bot - 3);
  for (let k = kEnd; k >= k0; k--) {
    const x = k * step - scroll;
    const d = 8 + hash(k) * 16;
    ctx.quadraticCurveTo(x - step * 0.25, bot + 10 + d, x - step * 0.5, bot + 10);
    ctx.quadraticCurveTo(x - step * 0.75, bot + 7, x - step, bot + 10);
  }
  ctx.closePath();
  ctx.fill();
  const sGap = 17;
  for (let k = Math.floor(scroll / sGap); k * sGap - scroll < W + 10; k++) {
    const x = k * sGap - scroll;
    sprinkle(ctx, x, bot + 2 + hash(k + 3) * 7, RAINBOW[Math.floor(hash(k) * RAINBOW.length)], hash(k + 7) * TAU, 7);
  }

  // Chocolate river, flowing a little faster than the bridge.
  const flow = scroll * 1.15 + t * 40;
  ctx.fillStyle = '#6b3519';
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W + 20; x += 20) ctx.lineTo(x, riverTop + Math.sin((x + flow) * 0.03) * 4);
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(200, 130, 80, 0.7)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  const wGap = 70;
  for (let k = Math.floor(flow / wGap); k * wGap - flow < W + 40; k++) {
    const x = k * wGap - flow;
    const y = riverTop + 12 + hash(k) * 22;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 12, y - 5, x + 26, y);
    ctx.stroke();
  }
}

// ---------- Things on the track ----------

const candySprites = CANDY_COLORS.flatMap((c) => [candySprite(c, 'wrap'), candySprite(c, 'swirl')]);
const rainbowPickup = rainbowPickupSprite();
export const JELLY_COLORS = [['#7df07a', '#3fbf4a'], ['#ff8fd0', '#e0479e'], ['#7fd8ff', '#3a9fd8']];

export function randomCandyLook() {
  return Math.floor(Math.random() * candySprites.length);
}

export function drawCandy(ctx, x, y, look, spin) {
  const s = candySprites[look];
  const sq = 0.75 + 0.25 * Math.abs(Math.cos(spin * 2));
  ctx.drawImage(s.img, x - (s.w / 2) * sq, y - s.h / 2, s.w * sq, s.h);
}

export function drawJelly(ctx, x, y, t, squish, colors) {
  const wob = Math.sin(t * 6) * 0.05 + squish * Math.sin(t * 30) * 0.3;
  const w = 28 * (1 + wob + squish * 0.25);
  const h = 38 * (1 - wob - squish * 0.3);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(x, y - h * 0.4, 4, x, y - h * 0.4, 46);
  glow.addColorStop(0, colors[0]);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = glow;
  ctx.fillRect(x - 46, y - h * 0.4 - 46, 92, 92);
  ctx.restore();

  ctx.beginPath();
  ctx.moveTo(x - w, y);
  ctx.bezierCurveTo(x - w, y - h * 1.32, x + w, y - h * 1.32, x + w, y);
  ctx.quadraticCurveTo(x, y + 5, x - w, y);
  ctx.closePath();
  const gel = ctx.createLinearGradient(0, y - h, 0, y);
  gel.addColorStop(0, colors[0]);
  gel.addColorStop(1, colors[1]);
  ctx.fillStyle = gel;
  ctx.globalAlpha = 0.92;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.beginPath();
  ctx.ellipse(x - w * 0.4, y - h * 0.65, 5, 8, -0.5, 0, TAU);
  ctx.fill();
  // Cute face.
  ctx.fillStyle = '#2b1640';
  for (const ex of [-8, 8]) {
    ctx.beginPath();
    ctx.ellipse(x + ex, y - h * 0.5, 3.2, 4.2, 0, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#fff';
  for (const ex of [-7, 9]) {
    ctx.beginPath();
    ctx.arc(x + ex, y - h * 0.5 - 1.5, 1.2, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = '#2b1640';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y - h * 0.32, 4, 0.2, Math.PI - 0.2);
  ctx.stroke();
}

export function drawRainbowPickup(ctx, x, y, t) {
  const s = rainbowPickup;
  const k = 1 + Math.sin(t * 5) * 0.08;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const halo = ctx.createRadialGradient(x, y, 5, x, y, 75);
  halo.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
  halo.addColorStop(0.5, 'rgba(255, 150, 240, 0.25)');
  halo.addColorStop(1, 'rgba(120, 150, 255, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(x - 75, y - 75, 150, 150);
  ctx.restore();
  ctx.drawImage(s.img, x - (s.w / 2) * k, y - s.h * 0.62 * k, s.w * k, s.h * k);
  // Sparkles circling round it.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const a = t * 2.5 + (i * TAU) / 5;
    ctx.fillStyle = RAINBOW[i];
    starPath4(ctx, x + Math.cos(a) * 58, y - 6 + Math.sin(a) * 34, 6 + 3 * Math.sin(t * 8 + i));
    ctx.fill();
  }
  ctx.restore();
}

// ---------- Sparkles ----------

export const particles = {
  list: [],
  emit(x, y, { count = 10, colors = ['#ffffff', ...RAINBOW], spread = 120, up = 80, life = 0.8, size = 6, drift = 0 } = {}) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const sp = Math.random() * spread;
      this.list.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - up, drift,
        life: life * rand(0.6, 1.2), max: life, size: size * rand(0.5, 1.2), color: pick(colors), spin: Math.random() * TAU,
      });
    }
  },
  text(x, y, text, color) {
    this.list.push({ x, y, vx: 0, vy: -70, drift: 0, grav: 0, life: 0.8, max: 0.8, size: 0, color, text });
  },
  update(dt, speed) {
    for (const p of this.list) {
      p.x += (p.vx - speed * p.drift) * dt;
      p.y += p.vy * dt;
      p.vy += (p.grav ?? 60) * dt;
      p.life -= dt;
      p.spin += dt * 4;
    }
    this.list = this.list.filter((p) => p.life > 0);
  },
  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.list) {
      if (p.text) continue;
      const a = Math.min(1, p.life / (p.max * 0.5));
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      starPath4(ctx, p.x, p.y, p.size * (0.7 + 0.3 * Math.sin(p.spin)));
      ctx.fill();
    }
    ctx.restore();
    ctx.font = 'bold 26px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 5;
    ctx.strokeStyle = OUT;
    for (const p of this.list) {
      if (!p.text) continue;
      ctx.globalAlpha = Math.min(1, p.life / 0.3);
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  },
};

// Sparkles that drift up off the rainbow all the time.
export function rainbowSparkles(L, dt, rate) {
  let n = rate * dt;
  while (n > 0) {
    if (Math.random() < n) {
      particles.list.push({
        x: rand(0, L.W + 100), y: rand(L.trackTop - 4, L.trackBottom - 8), vx: rand(-20, 20), vy: rand(-70, -25),
        drift: 0.4, grav: 0, life: rand(0.8, 1.8), max: 1.4, size: rand(2.5, 6), color: pick(['#ffffff', '#fff6a8', ...RAINBOW]),
        spin: Math.random() * TAU,
      });
    }
    n -= 1;
  }
}

export { OUT, pick, rand };
