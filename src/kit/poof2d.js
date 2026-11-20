// Cartoon "poof": a burst of stars on a 2D canvas. The kid-safe way to make things disappear.
//   poof2d(x, y);   ...each frame, after drawing the scene: drawPoofs(ctx, dt);
const bits = [];
const COLORS = ['#FFD93B', '#FF6B9A', '#4BE3A4', '#6EC6FF', '#FFFFFF'];

export function poof2d(x, y, { count = 18, colors = COLORS, size = 10 } = {}) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, speed = 80 + Math.random() * 160;
    bits.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: 0.6 + Math.random() * 0.4, age: 0,
                size: size * (0.6 + Math.random() * 0.8), color: colors[i % colors.length], spin: Math.random() * 6 });
  }
}

function star(ctx, x, y, r, rot) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r, a = rot + (i * Math.PI) / 5;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

export function drawPoofs(ctx, dt) {
  for (let i = bits.length - 1; i >= 0; i--) {
    const b = bits[i];
    b.age += dt;
    if (b.age >= b.life) { bits.splice(i, 1); continue; }
    b.x += b.vx * dt; b.y += b.vy * dt; b.vx *= 0.94; b.vy *= 0.94;
    ctx.globalAlpha = 1 - b.age / b.life;
    ctx.fillStyle = b.color;
    star(ctx, b.x, b.y, b.size * (1 - 0.5 * b.age / b.life), b.spin * b.age);
  }
  ctx.globalAlpha = 1;
}
