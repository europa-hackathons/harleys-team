// The two racing unicorns, drawn with plain canvas shapes (no image files).
// They face right. The origin is the ground under the middle of the body; 1 unit is about 1 pixel.

const TAU = Math.PI * 2;
const OUT = '#4b2350'; // cartoon outline colour

export const PLAYER_LOOK = {
  body: '#fff3e2', shade: '#efd6c2', mane: '#ff4f9a', maneHi: '#ffa6d1',
  hoof: '#ff4f9a', muzzle: '#ffe3e8', eye: '#7a2050', mark: 'hearts',
};
export const RIVAL_LOOK = {
  body: '#b9f2cf', shade: '#8fd7ad', mane: '#22b468', maneHi: '#8bedb4',
  hoof: '#21985c', muzzle: '#d6fae4', eye: '#1d6b45', mark: 'star',
};

// A puffy, scalloped hair shape: round bumps along the outer points, then straight back along the inner points.
function scallops(ctx, pts, bump) {
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    // Push the control point outwards (to the right of the direction of travel).
    ctx.quadraticCurveTo((ax + bx) / 2 - ((by - ay) / len) * bump, (ay + by) / 2 + ((bx - ax) / len) * bump, bx, by);
  }
}

function puffy(ctx, outer, inner, bump, fill, hi) {
  ctx.beginPath();
  ctx.moveTo(outer[0][0], outer[0][1]);
  scallops(ctx, outer, bump);
  for (const [x, y] of inner) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = fill;
  ctx.fill();
  if (hi) {
    // A shiny streak following the outer edge, a little way inside.
    const all = [...outer, ...inner];
    const cx = all.reduce((a, q) => a + q[0], 0) / all.length;
    const cy = all.reduce((a, q) => a + q[1], 0) / all.length;
    const inside = outer.slice(1, -1).map(([x, y]) => [x + (cx - x) * 0.38, y + (cy - y) * 0.38]);
    ctx.beginPath();
    ctx.moveTo(inside[0][0], inside[0][1]);
    scallops(ctx, inside, bump * 0.6);
    ctx.strokeStyle = hi;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}

function leg(ctx, hx, hy, a, b, color, hoof) {
  const kx = hx + Math.sin(a) * 24;
  const ky = hy + Math.cos(a) * 24;
  const fx = kx + Math.sin(b) * 25;
  const fy = ky + Math.cos(b) * 25;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(kx, ky);
  ctx.lineTo(fx, fy);
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 16;
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = 10.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(kx + (fx - kx) * 0.72, ky + (fy - ky) * 0.72);
  ctx.lineTo(fx, fy);
  ctx.strokeStyle = hoof;
  ctx.stroke();
}

export function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.7, y - s * 1.2, x, y - s * 0.4);
  ctx.bezierCurveTo(x + s * 0.7, y - s * 1.2, x + s * 1.4, y - s * 0.1, x, y + s * 0.9);
  ctx.closePath();
}

export function starShape(ctx, x, y, r, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = rot + (i * Math.PI) / 5;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

// pose: { phase, moving, air, t, wind?, wobble? }
export function drawUnicorn(ctx, look, pose) {
  const { phase: p, moving, air, t } = pose;
  const wind = pose.wind ?? (moving ? 1 : 0.3);
  const bob = air ? 0 : moving ? -Math.abs(Math.sin(p)) * 5 : Math.sin(t * 2) * 1.2;
  const wave = (k) => Math.sin(t * 9 + k) * 4 * wind;

  ctx.save();
  ctx.translate(0, bob);
  if (pose.wobble) ctx.rotate(pose.wobble);

  // Leg angles (radians from straight down, + is forward): [upper, lower].
  let legs;
  if (air) {
    legs = { ff: [1.05, -0.3], fn: [0.8, -0.7], bf: [-0.95, -0.4], bn: [-1.15, -0.7] };
  } else if (moving) {
    const s = (o) => Math.sin(p + o);
    const fold = (o) => -Math.max(0, Math.sin(p + o + 1.4)) * 1.3;
    legs = {
      fn: [0.6 * s(0), 0.6 * s(0) + fold(0)],
      ff: [0.6 * s(0.7), 0.6 * s(0.7) + fold(0.7)],
      bn: [0.6 * s(Math.PI), 0.6 * s(Math.PI) + Math.max(0, s(Math.PI - 1.2)) * 0.8],
      bf: [0.6 * s(Math.PI + 0.7), 0.6 * s(Math.PI + 0.7) + Math.max(0, s(Math.PI - 0.5)) * 0.8],
    };
  } else {
    legs = { fn: [0.05, 0.05], ff: [-0.08, -0.08], bn: [-0.05, -0.05], bf: [0.1, 0.1] };
  }

  // Tail (behind everything), streaming back in the wind.
  const w = wind * 10;
  puffy(ctx,
    [[-34, -70], [-50 - w * 0.5, -84 + wave(0)], [-68 - w, -88 + wave(1)], [-86 - w, -80 + wave(2)], [-97 - w, -64 + wave(3)],
      [-94 - w, -46 + wave(4)], [-80 - w, -33 + wave(5)], [-60 - w * 0.6, -30 + wave(6)]],
    [[-50, -50], [-38, -56]],
    6, look.mane, look.maneHi);

  // Far legs (a little darker).
  leg(ctx, 22, -48, legs.ff[0], legs.ff[1], look.shade, look.hoof);
  leg(ctx, -22, -48, legs.bf[0], legs.bf[1], look.shade, look.hoof);

  // Body, neck and head as one outlined shape.
  const body = new Path2D();
  body.ellipse(0, -58, 39, 25, 0, 0, TAU);
  const neck = new Path2D();
  neck.moveTo(10, -76);
  neck.quadraticCurveTo(24, -100, 34, -118);
  neck.lineTo(58, -104);
  neck.quadraticCurveTo(44, -86, 36, -50);
  neck.closePath();
  const head = new Path2D();
  head.ellipse(48, -112, 23, 19, 0.25, 0, TAU);
  const muzzle = new Path2D();
  muzzle.ellipse(68, -100, 14, 11.5, 0.3, 0, TAU);

  // Ear behind the head.
  ctx.beginPath();
  ctx.moveTo(34, -122);
  ctx.lineTo(36, -146);
  ctx.lineTo(49, -128);
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.fillStyle = look.body;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(38, -126);
  ctx.lineTo(39, -139);
  ctx.lineTo(45, -128);
  ctx.fillStyle = look.muzzle;
  ctx.fill();

  ctx.strokeStyle = OUT;
  ctx.lineWidth = 6;
  for (const part of [body, neck, head, muzzle]) ctx.stroke(part);
  ctx.fillStyle = look.body;
  for (const part of [body, neck, head]) ctx.fill(part);
  ctx.fillStyle = look.muzzle;
  ctx.fill(muzzle);

  // Soft belly shade.
  ctx.save();
  ctx.clip(body);
  ctx.fillStyle = look.shade;
  ctx.beginPath();
  ctx.ellipse(2, -36, 40, 12, 0, 0, TAU);
  ctx.fill();
  ctx.restore();

  // Near legs.
  leg(ctx, 24, -46, legs.fn[0], legs.fn[1], look.body, look.hoof);
  leg(ctx, -20, -46, legs.bn[0], legs.bn[1], look.body, look.hoof);

  // Flank marks.
  if (look.mark === 'hearts') {
    ctx.fillStyle = '#ff6fae';
    heartPath(ctx, -14, -62, 8);
    ctx.fill();
    heartPath(ctx, -2, -52, 5.5);
    ctx.fill();
    heartPath(ctx, -23, -50, 4);
    ctx.fill();
  } else {
    starShape(ctx, -12, -60, 12, -Math.PI / 2 + 0.2);
    ctx.fillStyle = '#ffe14d';
    ctx.strokeStyle = '#e8a10e';
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
    starShape(ctx, 1, -71, 4);
    ctx.fill();
  }

  // Big flowing mane down the back of the neck.
  puffy(ctx,
    [[44, -132], [32, -141 + wave(0) * 0.5], [17, -138 + wave(1)], [4 - w * 0.5, -126 + wave(2)], [-6 - w, -111 + wave(3)],
      [-12 - w, -94 + wave(4)], [-9 - w, -79 + wave(5)], [2, -70]],
    [[12, -76], [22, -94], [30, -110], [40, -124]],
    6, look.mane, look.maneHi);

  // Face.
  ctx.fillStyle = '#ff8fb8';
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.ellipse(56, -100, 6, 3.8, 0.3, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#2b0f30';
  ctx.beginPath();
  ctx.ellipse(55, -115, 6, 8, 0.12, 0, TAU);
  ctx.fill();
  ctx.fillStyle = look.eye;
  ctx.beginPath();
  ctx.ellipse(55.6, -113, 4, 5, 0.12, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(57, -117.5, 2.4, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(54, -110.5, 1.1, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#2b0f30';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(59, -121);
  ctx.lineTo(63, -125);
  ctx.moveTo(61, -118);
  ctx.lineTo(66, -120);
  ctx.stroke();
  ctx.fillStyle = OUT;
  ctx.beginPath();
  ctx.ellipse(76, -103, 1.6, 2.4, 0.3, 0, TAU);
  ctx.fill();
  // Happy open smile.
  ctx.beginPath();
  ctx.moveTo(63, -96);
  ctx.quadraticCurveTo(70, -88, 77, -95);
  ctx.quadraticCurveTo(70, -93, 63, -96);
  ctx.fillStyle = '#c2335f';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = OUT;
  ctx.stroke();

  // Golden horn with a soft glow.
  const glow = ctx.createRadialGradient(56, -150, 0, 56, -150, 24);
  glow.addColorStop(0, 'rgba(255, 236, 140, 0.75)');
  glow.addColorStop(1, 'rgba(255, 236, 140, 0)');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = glow;
  ctx.fillRect(32, -174, 48, 48);
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(40, -126);
  ctx.lineTo(60, -164);
  ctx.lineTo(52, -122);
  ctx.closePath();
  const gold = ctx.createLinearGradient(40, -126, 60, -164);
  gold.addColorStop(0, '#ffb703');
  gold.addColorStop(1, '#fff1a0');
  ctx.fillStyle = gold;
  ctx.strokeStyle = OUT;
  ctx.lineWidth = 2.5;
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#d98a00';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (const k of [0.25, 0.5, 0.72]) {
    const cx = 46 + (60 - 46) * k;
    const cy = -124 + (-164 + 124) * k;
    const hw = 5.5 * (1 - k);
    ctx.moveTo(cx - hw, cy + 1);
    ctx.lineTo(cx + hw, cy - 3);
  }
  ctx.stroke();

  // A curly forelock over the forehead.
  puffy(ctx, [[36, -128], [48, -132], [58, -122 + wave(5) * 0.3], [52, -116]], [[44, -122]], 4, look.mane);

  ctx.restore();
}
