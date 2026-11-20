// Background scenery outside the town (like the concept picture): green meadows and rolling hills
// with pine trees, a winding river with shimmering water and an arched stone bridge, a church on a
// hilltop with pointy towers and glowing windows, a windmill with turning sails, a tall round tower
// and a row of bigger houses. Scenery only: nothing here is inside the play area (the town plus a margin).
// Everything still is merged into a few meshes, one per colour.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLOW_MATERIALS, TOWN_HALF } from './town.js';

const COLORS = {
  meadow: '#557049',
  hill: ['#667B51', '#7E9A5B', '#728A5A'],
  pine: ['#4E6B45', '#5E7349', '#46603F'],
  trunk: '#7A5238',
  water: '#3E6FA8',
  bank: '#8C7F6E',
  stone: '#B8A79F',
  stoneDark: '#9C8B86',
  wall: '#E8D6BE',
  wallGrey: '#C9B8B0',
  roof: '#B8405E',
  spire: '#8E3A5E',
  window: '#FFD45C',
  wood: '#6B4A3A',
  sail: '#EFE3D0',
};

const KEEP_OUT = TOWN_HALF + 12; // nothing taller than the ground closer than this (on x or z)

const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  plane: new THREE.PlaneGeometry(1, 1),
  prism: new THREE.CylinderGeometry(1, 1, 1, 3),
  mound: new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), // a low-poly dome, top at y = 1
  cone6: new THREE.ConeGeometry(1, 1, 6),
  spire4: new THREE.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4),
  spire8: new THREE.ConeGeometry(1, 1, 8),
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 8),
  trunk: new THREE.CylinderGeometry(0.25, 0.3, 1, 5),
  round: new THREE.CircleGeometry(1, 8),
};

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function mat(parent, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
  const local = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  );
  return parent ? parent.clone().multiply(local) : local;
}

// Collects transformed geometries by colour, then merges them into one mesh per colour.
class Batcher {
  constructor() { this.buckets = new Map(); }
  add(geometry, color, matrix, glow = false) {
    const key = (glow ? 'glow:' : 'lit:') + color;
    if (!this.buckets.has(key)) this.buckets.set(key, { color, glow, list: [] });
    let g = geometry.clone().applyMatrix4(matrix);
    if (g.index) g = g.toNonIndexed();
    g.clearGroups();
    this.buckets.get(key).list.push(g);
  }
  build(parent) {
    for (const { color, glow, list } of this.buckets.values()) {
      const merged = mergeGeometries(list);
      merged.computeVertexNormals();
      const material = glow
        ? new THREE.MeshBasicMaterial({ color })
        : new THREE.MeshLambertMaterial({ color, flatShading: true });
      if (glow) GLOW_MATERIALS.push(material); // the sky switches these on at night
      const mesh = new THREE.Mesh(merged, material);
      mesh.receiveShadow = !glow;
      parent.add(mesh);
      list.forEach((g) => g.dispose());
    }
  }
}

// A matrix that stands at (x, y, z) and turns its local -z toward the town centre.
function facingTown(x, y, z, s = 1) {
  return mat(null, x, y, z, s, s, s, 0, Math.atan2(x, z), 0);
}

// --- River: winds along the far (+z) side of town, past the start view ---
const riverZ = (x) => 90 + 6 * Math.sin(x / 25);
const riverSlope = (x) => (6 / 25) * Math.cos(x / 25);
const RIVER_HALF_WIDTH = 5;

// A flat ribbon following the river line, `half` wide on each side. u runs along the river.
function ribbon(half, y) {
  const pos = [], uv = [], idx = [];
  let along = 0, prev = null;
  for (let x = -190, i = 0; x <= 190; x += 5, i++) {
    const z = riverZ(x), t = new THREE.Vector2(1, riverSlope(x)).normalize();
    const w = half * (1 + 0.12 * Math.sin(x / 13));
    if (prev) along += Math.hypot(x - prev.x, z - prev.z);
    prev = { x, z };
    pos.push(x + t.y * w, y, z - t.x * w, x - t.y * w, y, z + t.x * w);
    uv.push(along / 14, 0, along / 14, 1);
    if (i) idx.push(i * 2 - 2, i * 2 - 1, i * 2, i * 2 - 1, i * 2 + 1, i * 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Light streaks on dark: used as the water's glow map, slowly drifting so the water shimmers.
function shimmerTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 128, 64);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(200, 225, 255, ${rand(0.35, 0.9)})`;
    ctx.fillRect(rand(0, 128), rand(4, 60), rand(6, 22), rand(1, 2.5));
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function addRiver(scene) {
  const bank = new THREE.Mesh(ribbon(RIVER_HALF_WIDTH + 1.3, 0.03), new THREE.MeshLambertMaterial({ color: COLORS.bank }));
  bank.receiveShadow = true;
  scene.add(bank);
  const tex = shimmerTexture();
  const water = new THREE.Mesh(ribbon(RIVER_HALF_WIDTH, 0.06), new THREE.MeshPhongMaterial({
    color: COLORS.water, specular: '#FFE6C0', shininess: 80,
    emissive: '#A8D0FF', emissiveMap: tex, emissiveIntensity: 0.55,
  }));
  water.receiveShadow = true;
  // The shimmer drifts downstream (no extra hook needed in the game loop).
  water.onBeforeRender = () => {
    const t = performance.now() / 1000;
    tex.offset.set(t * 0.05, Math.sin(t * 0.7) * 0.03);
  };
  scene.add(water);
}

// An arched stone bridge across the river, with a humpback deck and low walls along the sides.
function addBridge(b, x) {
  const z = riverZ(x);
  const m = mat(null, x, 0, z, 1, 1, 1, 0, -Math.atan(riverSlope(x)), 0); // spans the river along local z
  const SPAN = 11, TOP = 4.6, END = 0.3;
  const R = (SPAN * SPAN + (TOP - END) ** 2) / (2 * (TOP - END));
  const yc = TOP - R;
  const deckY = (s) => (Math.abs(s) <= SPAN ? yc + Math.sqrt(R * R - s * s) : END);

  // Side profile (s along the bridge, y up): flat bottom with a round arch cut out, humped top.
  const shape = new THREE.Shape();
  const ARCH = 4.4, BASE = -0.5;
  shape.moveTo(-SPAN - 1, BASE);
  shape.lineTo(-ARCH, BASE);
  for (let k = 1; k < 12; k++) {
    const a = Math.PI - (k / 12) * Math.PI;
    shape.lineTo(Math.cos(a) * ARCH, BASE + Math.sin(a) * (ARCH - 0.6));
  }
  shape.lineTo(ARCH, BASE);
  shape.lineTo(SPAN + 1, BASE);
  for (let k = 0; k <= 12; k++) {
    const s = SPAN + 1 - (k / 12) * (SPAN * 2 + 2);
    shape.lineTo(s, deckY(s));
  }
  const body = new THREE.ExtrudeGeometry(shape, { depth: 4, bevelEnabled: false });
  body.translate(0, 0, -2).rotateY(-Math.PI / 2);
  b.add(body, COLORS.stone, m);
  body.dispose();

  // Low walls on both sides, following the hump.
  const N = 10, phi = Math.asin(SPAN / R);
  for (let k = 0; k < N; k++) {
    const a = -phi + ((k + 0.5) / N) * phi * 2;
    const s = R * Math.sin(a), y = deckY(s);
    const len = (R * phi * 2) / N + 0.15;
    for (const side of [-1, 1]) b.add(GEO.box, COLORS.stoneDark, mat(m, side * 1.85, y + 0.35, s, 0.35, 0.7, len, a, 0, 0));
  }
  // Chunky posts at the four ends.
  for (const s of [-SPAN - 0.5, SPAN + 0.5]) for (const side of [-1, 1]) b.add(GEO.box, COLORS.stoneDark, mat(m, side * 1.85, 0.6, s, 0.6, 1.2, 0.6));
}

// --- Hills and pine trees ---
function addPine(b, x, y, z, s = rand(1.2, 2)) {
  const g = pick(COLORS.pine);
  b.add(GEO.trunk, COLORS.trunk, mat(null, x, y + 0.4 * s, z, s, s * 0.9, s));
  b.add(GEO.cone6, g, mat(null, x, y + 2.0 * s, z, 1.4 * s, 2.4 * s, 1.4 * s, 0, rand(0, 1), 0));
  b.add(GEO.cone6, g, mat(null, x, y + 3.1 * s, z, 1.0 * s, 2.0 * s, 1.0 * s, 0, rand(0, 1), 0));
}

// A rolling hill (a low-poly dome sunk into the meadow), with a cluster of pines on it.
function addHill(b, h, pines = true) {
  b.add(GEO.mound, h.color || pick(COLORS.hill), mat(null, h.x, 0, h.z, h.r, h.h, h.r * rand(0.85, 1.1), 0, rand(0, 6), 0));
  if (!pines) return;
  const n = 3 + Math.floor(Math.random() * 6);
  const a0 = rand(0, Math.PI * 2);
  for (let i = 0; i < n; i++) {
    const a = a0 + rand(-0.9, 0.9), d = rand(0.15, 0.7) * h.r;
    addPine(b, h.x + Math.cos(a) * d, hillY(h, d), h.z + Math.sin(a) * d);
  }
}
const hillTop = (h) => h.h;
// Roughly the hill's height at distance d from its middle (a little low, so things sink in).
const hillY = (h, d) => h.h * Math.sqrt(Math.max(0, 1 - (d / h.r) ** 2)) * 0.85;

// --- Buildings ---
function glowWindow(b, m, x, y, z, w, hgt, rot = 0) {
  b.add(GEO.plane, COLORS.window, mat(m, x, y, z, w, hgt, 1, 0, rot, 0), true);
}

// A little church/castle: nave with a red roof, a square front tower with a pointy spire,
// a round tower with a cone roof, a small turret, and glowing windows. Faces the town.
function addChurch(b, x, y, z) {
  const m = facingTown(x, y, z, 1.5);
  b.add(GEO.box, COLORS.stoneDark, mat(m, 0, -3.5, 1, 13, 8, 20)); // foundation sunk into the hilltop
  // Nave
  const w = 7, h = 6, d = 13;
  b.add(GEO.box, COLORS.wall, mat(m, 0, h / 2, 2, w, h, d));
  const r = w / 1.732;
  b.add(GEO.prism, COLORS.roof, mat(m, 0, h + 0.5 * r * 0.9, 2, r * 1.12, d + 0.6, r * 0.9, -Math.PI / 2, 0, 0));
  for (const side of [-1, 1]) for (const k of [-1, 0, 1]) {
    glowWindow(b, m, side * (w / 2 + 0.03), 3.4, 2 + k * 3.6, 1.0, 2.2, side * Math.PI / 2);
  }
  // Front tower with a tall 4-sided spire, a door and stacked windows.
  const tw = 4.4, th = 13;
  b.add(GEO.box, COLORS.wallGrey, mat(m, 0, th / 2, -d / 2 + 1, tw, th, tw));
  b.add(GEO.box, COLORS.stoneDark, mat(m, 0, th + 0.3, -d / 2 + 1, tw + 0.6, 0.6, tw + 0.6));
  b.add(GEO.spire4, COLORS.spire, mat(m, 0, th + 0.6 + 4.5, -d / 2 + 1, tw * 0.75, 9, tw * 0.75));
  b.add(GEO.box, COLORS.window, mat(m, 0, th + 9.6, -d / 2 + 1, 0.35, 0.35, 0.35), true); // a little gold knob
  const front = -d / 2 + 1 - tw / 2 - 0.03;
  b.add(GEO.box, COLORS.wood, mat(m, 0, 1.2, front, 1.6, 2.4, 0.1));
  glowWindow(b, m, 0, 5.2, front, 1.1, 1.8, Math.PI);
  b.add(GEO.round, COLORS.window, mat(m, 0, 9.4, front, 0.9, 0.9, 1, 0, Math.PI, 0), true);
  // Round tower at the back corner with a cone roof.
  const rx = w / 2 + 0.6, rz = d / 2 + 2.2, rh = 10;
  b.add(GEO.cyl8, COLORS.wallGrey, mat(m, rx, rh / 2, rz, 2, rh, 2));
  b.add(GEO.spire8, COLORS.spire, mat(m, rx, rh + 3, rz, 2.6, 6, 2.6));
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    glowWindow(b, m, rx + Math.sin(a) * 2.02, 7, rz + Math.cos(a) * 2.02, 0.6, 1.1, a);
  }
  // Small turret on the other back corner.
  b.add(GEO.cyl8, COLORS.wallGrey, mat(m, -rx + 0.3, 3.5, rz - 0.6, 1.2, 7, 1.2));
  b.add(GEO.spire8, COLORS.spire, mat(m, -rx + 0.3, 8.6, rz - 0.6, 1.6, 3.4, 1.6));
}

// A windmill: a tapered round body, a red cap, a door, glowing windows, and four sails that turn.
function addWindmill(b, scene, x, y, z) {
  const m = facingTown(x, y, z, 1.4);
  b.add(GEO.box, COLORS.stoneDark, mat(m, 0, -1, 0, 6, 2.4, 6));
  b.add(new THREE.CylinderGeometry(2.1, 3, 10, 8), COLORS.wall, mat(m, 0, 5, 0, 1, 1, 1));
  b.add(GEO.spire8, COLORS.roof, mat(m, 0, 11.5, 0, 2.7, 3, 2.7));
  b.add(GEO.box, COLORS.wood, mat(m, 0, 1.1, -2.85, 1.3, 2.2, 0.3, -0.08, 0, 0));
  glowWindow(b, m, 0, 5.5, -2.62, 0.8, 1.1, Math.PI);
  glowWindow(b, m, 0, 8.4, -2.32, 0.7, 0.9, Math.PI);

  // Sails: one merged mesh that spins round its hub (front of the cap, facing the town).
  const parts = [];
  const hubGeo = new THREE.BoxGeometry(0.8, 0.8, 1.2);
  parts.push(hubGeo);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    const arm = new THREE.BoxGeometry(0.3, 7.5, 0.2).translate(0, 3.9, 0).rotateZ(a);
    const sail = new THREE.BoxGeometry(1.7, 5.8, 0.1).translate(0.95, 4.6, -0.05).rotateZ(a);
    parts.push(arm, sail);
  }
  const sailGeo = mergeGeometries(parts.map((g) => g.toNonIndexed()));
  parts.forEach((g) => g.dispose());
  const sails = new THREE.Mesh(sailGeo, new THREE.MeshLambertMaterial({ color: COLORS.sail, flatShading: true }));
  const hub = new THREE.Vector3(0, 10.4, -2.9).applyMatrix4(m);
  sails.position.copy(hub);
  sails.rotation.y = Math.atan2(x, z);
  sails.scale.setScalar(1.4);
  sails.rotation.order = 'YXZ';
  sails.onBeforeRender = () => { sails.rotation.z = performance.now() / 1000 * 0.6; };
  scene.add(sails);
}

// A tall round stone tower with a red cone roof and a spiral of glowing windows.
function addTower(b, x, z) {
  const m = facingTown(x, 0, z, 1.3);
  const h = 22;
  b.add(GEO.cyl8, COLORS.wallGrey, mat(m, 0, h / 2, 0, 3, h, 3));
  b.add(GEO.cyl8, COLORS.stoneDark, mat(m, 0, 1, 0, 3.4, 2, 3.4));
  b.add(GEO.cyl8, COLORS.stoneDark, mat(m, 0, h + 0.4, 0, 3.6, 0.8, 3.6));
  b.add(GEO.spire8, COLORS.roof, mat(m, 0, h + 0.8 + 3.5, 0, 4.2, 7, 4.2));
  for (let k = 0; k < 6; k++) {
    const a = Math.PI + (k - 2.5) * 0.7;
    glowWindow(b, m, Math.sin(a) * 3.02, 4 + k * 3.2, Math.cos(a) * 3.02, 0.8, 1.3, a);
  }
  b.add(GEO.box, COLORS.wood, mat(m, 0, 1.2, -3.0, 1.4, 2.4, 0.3));
}

// A row of bigger, taller town houses along the far river bank, windows facing the water.
function addHouseRow(b, x0, x1) {
  const walls = ['#E8D6BE', '#D6C2B6', '#C9B8B0', '#E2C6B8'];
  let x = x0;
  while (x < x1) {
    const w = rand(5.5, 7), d = 7, h = rand(9, 13), z = riverZ(x) + 15;
    const m = mat(null, x + w / 2, 0, z, 1, 1, 1, 0, Math.PI, 0); // front (local +z) faces the river
    b.add(GEO.box, pick(walls), mat(m, 0, h / 2, 0, w, h, d));
    const r = w / 1.732;
    b.add(GEO.prism, COLORS.roof, mat(m, 0, h + 0.5 * r * 0.95, 0, r * 1.12, d + 0.6, r * 0.95, -Math.PI / 2, 0, 0));
    for (let row = 0; row < 3; row++) for (const c of [-1, 1]) {
      if (Math.random() < 0.8) glowWindow(b, m, c * w * 0.24, 2.6 + row * (h - 3.5) / 2.5, d / 2 + 0.03, 1.1, 1.4);
    }
    b.add(GEO.box, COLORS.wood, mat(m, 0, 1.1, d / 2 + 0.04, 1.2, 2.2, 0.1));
    x += w + rand(0.1, 0.6);
  }
}

export function createScenery(scene) {
  const b = new Batcher();

  // A green meadow all round the town (the town ground keeps its own colour).
  const meadow = new THREE.Shape();
  meadow.absarc(0, 0, 235, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  const H = TOWN_HALF + 4;
  hole.moveTo(-H, -H); hole.lineTo(H, -H); hole.lineTo(H, H); hole.lineTo(-H, H); hole.lineTo(-H, -H);
  meadow.holes.push(hole);
  const meadowGeo = new THREE.ShapeGeometry(meadow, 24).rotateX(-Math.PI / 2);
  b.add(meadowGeo, COLORS.meadow, mat(null, 0, 0.01, 0, 1, 1, 1));
  meadowGeo.dispose();

  addRiver(scene);
  addBridge(b, 15);

  // Special spots: their own hills (or flat ground), kept clear of the random hills.
  const church = { x: -75, z: 128, r: 21, h: 11, color: COLORS.hill[1] };
  const mill = { x: 112, z: -50, r: 16, h: 7 };
  const tower = { x: 116, z: 40 };
  const houseRow = { x0: 34, x1: 72 };
  addHill(b, church, false);
  addChurch(b, church.x, hillTop(church), church.z);
  for (const a of [0.4, 2.2, 3.6]) addPine(b, church.x + Math.cos(a) * 16, hillY(church, 16), church.z + Math.sin(a) * 16, rand(1.3, 1.8));
  addHill(b, mill, false);
  addWindmill(b, scene, mill.x, hillTop(mill), mill.z);
  addTower(b, tower.x, tower.z);
  addHouseRow(b, houseRow.x0, houseRow.x1);

  const clear = [
    { x: church.x, z: church.z, r: church.r + 4 },
    { x: mill.x, z: mill.z, r: mill.r + 4 },
    { x: tower.x, z: tower.z, r: 10 },
    { x: 53, z: riverZ(53) + 15, r: 26 },
    { x: 15, z: riverZ(15), r: 16 },
  ];

  // Rolling hills all round, outside the play area and in front of the mountains, off the river.
  const hills = [];
  for (let tries = 0; tries < 600 && hills.length < 26; tries++) {
    const r = rand(13, 24), x = rand(-150, 150), z = rand(-150, 150);
    if (Math.max(Math.abs(x), Math.abs(z)) - r < KEEP_OUT) continue;
    if (Math.hypot(x, z) + r * 0.4 > 165) continue;
    if (Math.abs(z - riverZ(x)) < r + 8) continue;
    if (clear.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + r)) continue;
    if (hills.some((o) => Math.hypot(x - o.x, z - o.z) < (o.r + r) * 0.6)) continue;
    hills.push({ x, z, r, h: rand(5, 12) });
  }
  hills.forEach((h) => addHill(b, h));

  // A few pine clusters on the flat meadow and along the river banks.
  for (let n = 0, tries = 0; n < 14 && tries < 300; tries++) {
    const x = rand(-170, 170), z = rand(-170, 170);
    if (Math.max(Math.abs(x), Math.abs(z)) < KEEP_OUT || Math.hypot(x, z) > 170) continue;
    if (Math.abs(z - riverZ(x)) < RIVER_HALF_WIDTH + 4) continue;
    if (clear.some((c) => Math.hypot(x - c.x, z - c.z) < c.r)) continue;
    if (hills.some((o) => Math.hypot(x - o.x, z - o.z) < o.r)) continue;
    n++;
    for (let k = 0, m = 2 + Math.floor(Math.random() * 3); k < m; k++) addPine(b, x + rand(-4, 4), 0, z + rand(-4, 4));
  }

  const group = new THREE.Group();
  group.name = 'scenery';
  b.build(group);
  scene.add(group);
  return group;
}
