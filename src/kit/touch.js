// Are two things close enough to touch? Works with {x, y}, {x, y, z} or three.js objects (uses .position).
export function touching(a, b, radius) {
  const p = a.position ?? a, q = b.position ?? b;
  const dx = p.x - q.x, dy = p.y - q.y, dz = (p.z ?? 0) - (q.z ?? 0);
  return dx * dx + dy * dy + dz * dz <= radius * radius;
}
