// The night town: houses, chimneys, trees, lamps, sky, stars and moon.
// Everything static is merged into a few meshes (one per colour) so it stays fast.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loadModel } from './models.js';

export const PALETTE = {
  sky: '#4B2A8C',
  roof: ['#B8405E', '#AA3A56', '#C24A66'],
  walls: ['#C9B8B0', '#E8D6BE', '#D6C2B6', '#C9B8B0'],
  chimney: '#C9B8B0',
  chimneyCap: '#B3A29C',
  chimneyHole: '#2A1C38',
  window: '#FFD45C',
  windowFrame: '#6B4636',
  door: '#6B4A3A',
  ground: '#806C91', // the streets: dusty mauve
  grass: '#56684F', // muted sage lawns
  paving: ['#94809F', '#897592'], // flat paving stones along the curbs
  tree: ['#667B51', '#5E7349', '#728A5A'],
  trunk: '#7A5238',
  lampPost: '#2E2A3A',
  crate: '#9A6A44',
  crateEdge: '#C08A5A',
  mountain: ['#4A3485', '#3A2470'], // front row, back row
};

export const TOWN_HALF = 66; // the town spans -66..66 on x and z
// Where the warm side light shines from at night (the sky moves it toward the sun at sunset and sunrise).
export const NIGHT_KEY_POSITION = new THREE.Vector3(55, 70, -40);

// The glowing window and lamp materials, so the sky can switch them on at night.
export const GLOW_MATERIALS = [];
// See-through glows (the soft light pools under the streetlamps): the sky fades their opacity
// with the lights. Each keeps its night-time opacity in userData.nightOpacity.
export const NIGHT_GLOW_MATERIALS = [];

// Collects transformed geometries by material, then merges them.
class Batcher {
  constructor() { this.buckets = new Map(); }
  add(geometry, color, matrix, glow = false) {
    const key = (glow ? 'glow:' : 'lit:') + color;
    if (!this.buckets.has(key)) this.buckets.set(key, { color, glow, list: [] });
    let g = geometry.clone().applyMatrix4(matrix);
    if (g.index) g = g.toNonIndexed();
    this.buckets.get(key).list.push(g);
  }
  build(parent) {
    for (const { color, glow, list } of this.buckets.values()) {
      const merged = mergeGeometries(list);
      merged.computeVertexNormals();
      const material = glow
        ? new THREE.MeshBasicMaterial({ color })
        : new THREE.MeshLambertMaterial({ color, flatShading: true });
      if (glow) GLOW_MATERIALS.push(material);
      const mesh = new THREE.Mesh(merged, material);
      // Everything solid casts and catches the sun and moon shadows (glowing glass doesn't need to).
      mesh.castShadow = mesh.receiveShadow = !glow;
      parent.add(mesh);
      list.forEach((g) => g.dispose());
    }
  }
}

const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  plane: new THREE.PlaneGeometry(1, 1),
  prism: new THREE.CylinderGeometry(1, 1, 1, 3),
  trunk: new THREE.CylinderGeometry(0.25, 0.3, 1, 6),
  ball: new THREE.IcosahedronGeometry(1, 1),
  peak: new THREE.ConeGeometry(1, 1, 5),
  lid: new THREE.ConeGeometry(0.75, 1, 4, 1).rotateY(Math.PI / 4),
};

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Makes a matrix: house transform * local placement.
function mat(parentMatrix, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
  const local = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  );
  return parentMatrix ? parentMatrix.clone().multiply(local) : local;
}

// A big glowing window with a frame cross (four panes) and a sill, just in front of the glass.
function addWindow(b, house, x, y, z, rot, ww, wh) {
  b.add(GEO.plane, PALETTE.window, mat(house, x, y, z, ww, wh, 1, 0, rot, 0), true);
  const ox = Math.sin(rot) * 0.05, oz = Math.cos(rot) * 0.05;
  b.add(GEO.box, PALETTE.windowFrame, mat(house, x + ox, y, z + oz, 0.12, wh, 0.08, 0, rot, 0));
  b.add(GEO.box, PALETTE.windowFrame, mat(house, x + ox, y, z + oz, ww, 0.12, 0.08, 0, rot, 0));
  b.add(GEO.box, PALETTE.windowFrame, mat(house, x + ox * 2, y - wh / 2 - 0.06, z + oz * 2, ww + 0.3, 0.14, 0.2, 0, rot, 0));
}

// --- Houses ---
// The town's houses are three sculpted variants (assets/models/house2..4.glb, made from
// assets/concepts/house-model-2..4.png), drawn with one InstancedMesh per colour section per variant.
// Their shapes for landing and walking come from a height map measured from each model (below), so
// the gameplay is ready at once; until the models load (or if they fail) simple-shape houses of the
// same size stand in.
//
// Height maps: N x N cells over the model's footprint (x-major, then z), each a letter of HMAP_ABC
// (0..63) times rim/63 = the highest roof, porch or chimney point there, in model units above the
// ground. Measured with the cap block on top of the chimney taken off, so people can stand in it.
const HMAP_ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const HOUSE_VARIANTS = [
  { // one storey, tall lavender chimney with brick knobs
    name: 'house2', scale: 10,
    min: [-0.2906, -0.5, -0.3317], max: [0.2906, 0.4374, 0.3317], rim: 0.4374, chim: [-0.0391, 0.1888, 0.0822], N: 24,
    h: 'XYacegikmoqqpnmkigfdbZYWXYacegikmoqqpnmkigfdbaYWXYacegikmoqqpnmkihfdbaYWXYacegikmoqqpnmkihfdbaYWXYacegikmoqqpnmkihfdcaYWXYacegikmoqqpnmkjhfdcaYWXYacegikmoqqpnmkjhfdcaYWXYacegikmoqqpnm1//////YWXYacegikmoqqpnm1//////YWXYacegikmoqqpnm1//////YWXYacegikmoqqpnmk//////YWXYacegikmoqqpnmk//////tWXYacegikmoqqpnmk//////tWXYacegikmoqqpnmk//////tWXYacegikmoqqpnmkjhfdcaYWXYacegikmoqqpnmkjhfdcaYWXYacegikmoqqpnmkjhfdcaYWXYacegikmoqqpnmkihfdcaYWXYacegikmoqqpnmkihfdbaYWXYacegikmoqqpnmkihfdbaYWXYacegikmoqqpnmkihfdbaYWXYacegikmoqqpnmkigfdbaYWXYacegikmoqqpnmkigfdbaYWXYacegikmoqqpnmkigfdbaYW',
    // simple-shape stand-in: wall box [x0, x1, z0, z1], eave and ridge height above the ground, ridge direction
    body: [-0.257, 0.246, -0.293, 0.285], eave: 0.32, ridge: 0.6, ridgeAlongX: true,
  },
  { // two storeys
    name: 'house3', scale: 11,
    min: [-0.2476, -0.5, -0.2769], max: [0.2476, 0.4472, 0.2769], rim: 0.4472, chim: [-0.0166, 0.1918, 0.0763], N: 24,
    h: 'deghjklnoqrttsqpnmkjhgeddeghjklnoqrttsqpnmkjhgeddeghjklnoqrttsqpnmkjhgeddeghjklnoqrttsqpnmkjhgeddeghjklnoqrttsqpnmkjhgeddeghjklnoqrttsqpnmkjhgeddeghjklnoqrttsqpnmkjhgeddeghjklnoqrttsqpn///////deghjklnoqrttsqpn///////deghjklnoqrttsqpn///////deghjklnoqrttsqpn///////deghjklnoqrttsqpn///////deghjklnoqrttsqpn///////deghjklnoqrttsqpn///////deghjklnoqrttsqpn///////deghjklnoqrttsqpnmkjhgeddeghjklnoqrttsqpnmkjhgeddeghjklnoqrttsqpnmkjhgeddeghjklnoqrttsqpnmkjhgeddeghjklnoqrttsqpnmkjhgeddeghjklnoqrttsqpnmkjhgeddeghjklnoqrttsqpnmkjhgeddeghjklnoqrttsqpnmkjhgeddeghjklnoqrttsqpnmkjhged',
    body: [-0.226, 0.226, -0.248, 0.26], eave: 0.42, ridge: 0.66, ridgeAlongX: true,
  },
  { // cottage with a front porch
    name: 'house4', scale: 8.5,
    min: [-0.3787, -0.4961, -0.5], max: [0.3787, 0.4295, 0.5], rim: 0.4295, chim: [0.001, 0.2798, 0.092], N: 24,
    h: 'abbbbbbbbbbbbbbbbbbbbbaXbhjjjjjjjjjjjjjjjjjigdaYbikkkkkkkkkkkkkkkkkjgdaXbikkkkkkkkkkkkkkkkkjgdaXcikkkkkkkkkkkkkkkkkifcZXcjkkkkkkkkkkkkkkkkkifcZXcjlllllllllllllllljhecZXcjlllllllllllllllljgebZXcjlllllllllllllllligebZXcjlllllllllllllll////bZXcjllllllllllllll7////bZXcijjjjjjjjjjjjjj7////bZXchiiiiiiiiiiiiii7////bZXcggggggggggggggg7////aZXceeeeeeeeeeeeeee7////aZXcddddddddddddddddddcbaZXbbbbbbbbbbbbbbbbbbbbbaYXZZZZZZZZZZZZZZZZZZZZZZYXYYYYYYYYYYYYYYYYYYYYYYXWWWWWWWWWWWXZaaZYWWWWWWWWAAAAAAAAAVXZabaYWUAAAAAAAAAAAAAAAVXZabaYWUAAAAAAAAAAAAAAAVXZabaYWUAAAAAAAAAAAAAAAAACCCCCAAAAAAAA',
    body: [-0.351, 0.2, -0.459, 0.459], eave: 0.36, ridge: 0.54, ridgeAlongX: false,
  },
];
// The models' painted shade colours fold back into their base colour (walls, roof, chimney).
const HOUSE_COLORS = {
  walls: '#E9A989', roof: '#B8405E', chimney: '#C495B0', window: '#FFD45C', door: '#A8443F', frame: '#7A5038',
};
const HOUSE_RECOLOR = {
  '#B9765E': HOUSE_COLORS.walls, '#8A2E48': HOUSE_COLORS.roof, '#8E6A86': HOUSE_COLORS.chimney,
  '#E08A3A': HOUSE_COLORS.frame, // the orange window frames become wood brown
};
// The Team's wish "mix some colours": each house gets one of these soft wall colours
// (peach, cream, light blue, mint), never the same as the house to the left or behind it.
const WALL_COLORS = ['#E9A989', '#F2E3C6', '#BFD3E6', '#C6E3CF'];
// The soft amber halo around each glowing window at night: colour, size (times the window), strength.
const HALO = { color: '#FFA24D', size: 1.8, opacity: 0.3 };

// Unpack the height maps and work out each variant's centre (the model is centred on it when loaded),
// rim height and highest roof point (not counting the chimney).
for (const v of HOUSE_VARIANTS) {
  v.cx = (v.min[0] + v.max[0]) / 2;
  v.cz = (v.min[2] + v.max[2]) / 2;
  v.rimH = v.rim - v.min[1];
  v.heights = Float32Array.from(v.h, (ch) => (HMAP_ABC.indexOf(ch) / 63) * v.rimH);
  v.roofTop = 0;
  for (let i = 0; i < v.N; i++) {
    for (let j = 0; j < v.N; j++) {
      const nx = v.min[0] + (i + 0.5) / v.N * (v.max[0] - v.min[0]), nz = v.min[2] + (j + 0.5) / v.N * (v.max[2] - v.min[2]);
      if (Math.abs(nx - v.chim[0]) < v.chim[2] && Math.abs(nz - v.chim[1]) < v.chim[2]) continue;
      v.roofTop = Math.max(v.roofTop, v.heights[i * v.N + j]);
    }
  }
}

// How high the house is at a point in its own model units (x, z relative to its centre), 0 outside.
function houseHeight(v, lx, lz) {
  const i = Math.floor((lx + v.cx - v.min[0]) / (v.max[0] - v.min[0]) * v.N);
  const j = Math.floor((lz + v.cz - v.min[2]) / (v.max[2] - v.min[2]) * v.N);
  if (i < 0 || j < 0 || i >= v.N || j >= v.N) return 0;
  return v.heights[i * v.N + j];
}

// Simple-shape stand-in for a variant: walls, gable, two roof slabs, a chimney with a rim and a dark
// opening, four-pane golden windows and a door. `house` is the house matrix (already scaled by s).
const ROOF_THICK = 0.3, EAVE = 0.55, GABLE_OVERHANG = 0.35;
function addSimpleHouse(b, house, v, s, wallColor) {
  // Work in world-sized units, in a frame where the ridge runs along z.
  const turn = v.ridgeAlongX ? Math.PI / 2 : 0;
  const frame = house.clone().multiply(new THREE.Matrix4().makeScale(1 / s, 1 / s, 1 / s)).multiply(new THREE.Matrix4().makeRotationY(turn));
  const toFrame = (nx, nz) => { // model units -> this frame (undoing the quarter turn)
    const x = (nx - v.cx) * s, z = (nz - v.cz) * s;
    return v.ridgeAlongX ? [-z, x] : [x, z];
  };
  const [bx0, bz0] = toFrame(v.body[0], v.body[2]), [bx1, bz1] = toFrame(v.body[1], v.body[3]);
  const m = frame.clone().multiply(new THREE.Matrix4().makeTranslation((bx0 + bx1) / 2, 0, (bz0 + bz1) / 2));
  const w = Math.abs(bx1 - bx0), d = Math.abs(bz1 - bz0), h = v.eave * s, apex = (v.ridge - v.eave) * s;
  const wall = wallColor, roof = HOUSE_COLORS.roof;

  b.add(GEO.box, wall, mat(m, 0, h / 2, 0, w, h, d));
  const r = w / 1.732, sy = apex / (1.5 * r);
  b.add(GEO.prism, wall, mat(m, 0, h + 0.5 * r * sy, 0, r, d, r * sy, -Math.PI / 2, 0, 0));
  const half = w / 2, slope = Math.hypot(half, apex), theta = Math.atan2(apex, half);
  const c = Math.cos(theta), sn = Math.sin(theta), ridge = 0.12, shift = (EAVE - ridge) / 2;
  for (const side of [-1, 1]) {
    const mx = side * (half / 2 + c * shift + sn * ROOF_THICK / 2);
    const my = h + apex / 2 - sn * shift + c * ROOF_THICK / 2;
    b.add(GEO.box, roof, mat(m, mx, my, 0, slope + EAVE + ridge, ROOF_THICK, d + GABLE_OVERHANG * 2, 0, 0, -side * theta));
  }
  const [cx, cz] = toFrame(v.chim[0], v.chim[1]);
  const top = v.rimH * s, cw = v.chim[2] * s * 2;
  b.add(GEO.box, HOUSE_COLORS.chimney, mat(frame, cx, (top - 0.4) / 2, cz, cw * 0.8, top - 0.4, cw * 0.8));
  b.add(GEO.box, HOUSE_COLORS.chimney, mat(frame, cx, top - 0.2, cz, cw, 0.4, cw));
  b.add(GEO.box, PALETTE.chimneyHole, mat(frame, cx, top + 0.01, cz, cw * 0.7, 0.04, cw * 0.7));

  const ww = 1.25, wh = 1.45, wy = Math.max(h * 0.55, 1.75);
  for (const [fx, fz, rot, halfDepth] of [[0, 1, 0, d / 2], [0, -1, Math.PI, d / 2], [1, 0, Math.PI / 2, w / 2], [-1, 0, -Math.PI / 2, w / 2]]) {
    const span = fx ? d : w;
    const slots = fz ? [-span * 0.29, span * 0.29] : [-span * 0.22, span * 0.22];
    for (const sl of slots) addWindow(b, m, fx ? fx * (halfDepth + 0.02) : sl, wy, fz ? fz * (halfDepth + 0.02) : sl, rot, ww, wh);
  }
  b.add(GEO.box, PALETTE.door, mat(m, 0, 0.85, d / 2 + 0.03, 1.0, 1.7, 0.1));
}

// Picks a variant for each lot: random-ish but fixed (the same town every time), never the same as the
// house to the left or behind it. Also a quarter turn (so a front or a side faces a street) and a size wobble.
function hash(i, j, k) {
  const n = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453;
  return n - Math.floor(n);
}
const lotVariants = new Map();
function lotVariant(i, j) {
  const taken = [lotVariants.get(`${i - 1},${j}`), lotVariants.get(`${i},${j - 1}`)];
  const options = HOUSE_VARIANTS.map((_, k) => k).filter((k) => !taken.includes(k));
  const v = options[Math.floor(hash(i, j, 1) * options.length)];
  lotVariants.set(`${i},${j}`, v);
  return v;
}
const lotWalls = new Map();
function lotWall(i, j) {
  const taken = [lotWalls.get(`${i - 1},${j}`), lotWalls.get(`${i},${j - 1}`)];
  const options = WALL_COLORS.filter((c) => !taken.includes(c));
  const c = options[Math.floor(hash(i, j, 4) * options.length)];
  lotWalls.set(`${i},${j}`, c);
  return c;
}

// Places a house on a lot: its stand-in shapes, its chimney (where townsfolk stand) and its shape
// for landing and walking.
function addHouse(b, i, j, x, z, chimneys, houses) {
  const vi = lotVariant(i, j), v = HOUSE_VARIANTS[vi];
  const ry = Math.floor(hash(i, j, 2) * 4) * Math.PI / 2;
  const s = v.scale * (0.94 + hash(i, j, 3) * 0.1);
  const matrix = mat(null, x, 0, z, s, s, s, 0, ry, 0);
  const wall = lotWall(i, j);
  addSimpleHouse(b, matrix, v, s, wall);
  const pos = new THREE.Vector3(v.chim[0] - v.cx, v.rimH, v.chim[1] - v.cz).applyMatrix4(matrix);
  chimneys.push({ pos, person: null });
  const reach = Math.max(v.max[0] - v.min[0], v.max[2] - v.min[2]) * s * 0.75;
  houses.push({ v: vi, wall: new THREE.Color(wall), x, z, s, ry, cos: Math.cos(ry), sin: Math.sin(ry), matrix, half: reach, top: v.roofTop * s });
}

// Finds the separate windows in a model's window section (triangles that touch belong to one window)
// and returns, for each, a halo placement just in front of it: a matrix in model units that turns a
// 1x1 plane to face out of the window, HALO.size times the window's size.
const HALO_DIRS = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]].map((d) => new THREE.Vector3(...d));
function windowHalos(geo) {
  const pos = geo.attributes.position.array, tris = pos.length / 9;
  const parent = Int32Array.from({ length: tris }, (_, t) => t);
  const find = (t) => { while (parent[t] !== t) t = parent[t] = parent[parent[t]]; return t; };
  const seen = new Map();
  for (let t = 0; t < tris; t++) {
    for (let k = 0; k < 3; k++) {
      const o = t * 9 + k * 3;
      const key = Math.round(pos[o] * 2e3) + ',' + Math.round(pos[o + 1] * 2e3) + ',' + Math.round(pos[o + 2] * 2e3);
      if (seen.has(key)) parent[find(t)] = find(seen.get(key)); else seen.set(key, t);
    }
  }
  const groups = new Map(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let t = 0; t < tris; t++) {
    const r = find(t);
    if (!groups.has(r)) groups.set(r, { box: new THREE.Box3(), facing: [0, 0, 0, 0, 0] });
    const g = groups.get(r);
    a.fromArray(pos, t * 9); b.fromArray(pos, t * 9 + 3); c.fromArray(pos, t * 9 + 6);
    g.box.expandByPoint(a).expandByPoint(b).expandByPoint(c);
    const n = b.sub(a).cross(c.sub(a)); // points out of the face, as long as twice its area
    HALO_DIRS.forEach((d, k) => { g.facing[k] += Math.max(0, n.dot(d)); });
  }
  const out = [], size = new THREE.Vector3(), centre = new THREE.Vector3(), forward = new THREE.Vector3(0, 0, 1);
  for (const g of groups.values()) {
    const k = g.facing.indexOf(Math.max(...g.facing)), d = HALO_DIRS[k];
    g.box.getSize(size); g.box.getCenter(centre);
    const across = k < 2 ? Math.max(size.y, size.z) : k < 4 ? Math.max(size.x, size.y) : Math.max(size.x, size.z);
    if (across < 0.02) continue; // a stray speck, not a window
    centre.addScaledVector(d, Math.abs(size.dot(d)) / 2 + 0.004);
    const q = new THREE.Quaternion().setFromUnitVectors(forward, d);
    out.push(new THREE.Matrix4().compose(centre.clone(), q, new THREE.Vector3().setScalar(across * HALO.size)));
  }
  return out;
}

function haloTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255, 255, 255, 1)');
  g.addColorStop(0.4, 'rgba(255, 255, 255, 0.6)');
  g.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// One soft amber card per window per house (all in one instanced mesh), glowing on the wall around
// the window at night; the sky fades it out by day, like the lamp pools.
function buildHalos(halos) {
  const material = new THREE.MeshBasicMaterial({
    color: HALO.color, map: haloTexture(), transparent: true, opacity: HALO.opacity,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  material.userData.nightOpacity = HALO.opacity;
  NIGHT_GLOW_MATERIALS.push(material);
  const count = halos.reduce((n, h) => n + h.list.length, 0);
  const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), material, count);
  const m = new THREE.Matrix4();
  let k = 0;
  for (const { w, list } of halos) for (const h of list) mesh.setMatrixAt(k++, m.multiplyMatrices(h.matrix, w));
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  return mesh;
}

// Flat paving stones in two soft mauves, staggered in a row along each edge of a lawn (centre x, z, size).
function addPaving(b, x, z, size) {
  const W = 0.55, L = 0.95, GAP = 0.12, edge = size / 2 + W / 2 + 0.05;
  for (let side = 0; side < 4; side++) {
    const alongX = side < 2, sign = side % 2 ? 1 : -1;
    const n = Math.floor((alongX ? size + W * 2 : size) / (L + GAP)); // the x rows cover the corners
    for (let k = 0; k < n; k++) {
      const t = (k - (n - 1) / 2) * (L + GAP);
      const out = edge + (k % 2 ? 0.08 : -0.08), y = 0.03 + (k % 2) * 0.004;
      const px = alongX ? x + t : x + sign * out, pz = alongX ? z + sign * out : z + t;
      b.add(GEO.plane, PALETTE.paving[(k + side) % 2], mat(null, px, y, pz, alongX ? L : W, alongX ? W : L, 1, -Math.PI / 2, 0, 0));
    }
  }
}

// Swaps the stand-in houses for the sculpted ones once all three models have loaded.
async function buildSculptedHouses(scene, houses, standIn, standInGlows) {
  const models = await Promise.all(HOUSE_VARIANTS.map((v) => loadModel(v.name, { recolor: HOUSE_RECOLOR })));
  const materials = {};
  const materialFor = (color) => {
    if (materials[color]) return materials[color];
    const glow = color === HOUSE_COLORS.window;
    const m = glow ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshLambertMaterial({ color, flatShading: true });
    if (glow) GLOW_MATERIALS.push(m); // the sky lights the windows up at night
    return (materials[color] = m);
  };
  const wallMaterial = new THREE.MeshLambertMaterial({ color: '#FFFFFF', flatShading: true });
  const halos = []; // { w: one window's halo placement in model units, list: the houses that have it }
  const group = new THREE.Group();
  HOUSE_VARIANTS.forEach((v, vi) => {
    const list = houses.filter((h) => h.v === vi);
    if (!list.length) return;
    const model = models[vi];
    model.updateMatrixWorld(true);
    const capLine = v.rimH - 0.01; // the little cap block on the chimney top comes off: people stand there
    for (const [color, meshes] of Object.entries(model.userData.sections)) {
      const parts = meshes.map((mesh) => {
        let g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
        if (g.index) g = g.toNonIndexed();
        const src = g.attributes.position.array, keep = [];
        for (let t = 0; t < src.length; t += 9) {
          if (color !== HOUSE_COLORS.chimney && Math.min(src[t + 1], src[t + 4], src[t + 7]) >= capLine) continue;
          for (let k = 0; k < 9; k++) keep.push(src[t + k]);
        }
        g.dispose();
        const out = new THREE.BufferGeometry();
        out.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3));
        return out;
      });
      const geo = mergeGeometries(parts);
      parts.forEach((g) => g.dispose());
      geo.computeVertexNormals();
      const isWall = color === HOUSE_COLORS.walls;
      // The walls are white, tinted per house with its own wall colour.
      const mesh = new THREE.InstancedMesh(geo, isWall ? wallMaterial : materialFor(color), list.length);
      list.forEach((h, k) => {
        mesh.setMatrixAt(k, h.matrix);
        if (isWall) mesh.setColorAt(k, h.wall);
      });
      if (color === HOUSE_COLORS.window) for (const w of windowHalos(geo)) halos.push({ w, list });
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.frustumCulled = false; // the instances spread over the whole town
      group.add(mesh);
    }
  });
  // A dark opening inside each chimney rim.
  const holes = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: PALETTE.chimneyHole }), houses.length);
  houses.forEach((h, k) => {
    const v = HOUSE_VARIANTS[h.v];
    holes.setMatrixAt(k, h.matrix.clone().multiply(mat(null, v.chim[0] - v.cx, v.rimH - 0.03, v.chim[1] - v.cz, v.chim[2] * 1.3, 1, v.chim[2] * 1.3)));
  });
  holes.frustumCulled = false;
  holes.receiveShadow = true;
  group.add(holes);
  group.add(buildHalos(halos));

  scene.add(group);
  scene.remove(standIn);
  for (const m of standInGlows) GLOW_MATERIALS.splice(GLOW_MATERIALS.indexOf(m), 1);
  standIn.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
}

// Small solid things on the ground (lamp posts, tree trunks, crates): x, z, radius, top height,
// and crown radius/bottom for trees. They block her walking and the walking camera.
const obstacles = [];

// A round, faceted tree on a short trunk.
function addTree(b, x, z, s = rand(1.2, 1.9)) {
  obstacles.push({ x, z, r: 0.3 * s, top: s * 2.9, crown: s, crownBottom: s * 1.0 });
  b.add(GEO.trunk, PALETTE.trunk, mat(null, x, s * 0.6, z, s * 0.8, s * 1.2, s * 0.8));
  b.add(GEO.ball, pick(PALETTE.tree), mat(null, x, s * 1.95, z, s, s * 0.95, s, rand(0, 3), rand(0, 3), 0));
}

// A wooden crate with lighter edges and a cross on the front.
function addCrate(b, x, z, ry) {
  const s = 0.75, m = mat(null, x, s / 2, z, 1, 1, 1, 0, ry, 0);
  obstacles.push({ x, z, r: 0.5, top: s });
  b.add(GEO.box, PALETTE.crate, mat(m, 0, 0, 0, s, s, s));
  for (const k of [-1, 1]) {
    b.add(GEO.box, PALETTE.crateEdge, mat(m, k * (s / 2 - 0.05), 0, s / 2 + 0.01, 0.1, s, 0.06));
    b.add(GEO.box, PALETTE.crateEdge, mat(m, 0, k * (s / 2 - 0.05), s / 2 + 0.01, s, 0.1, 0.06));
    b.add(GEO.box, PALETTE.crateEdge, mat(m, 0, 0, s / 2 + 0.01, s * 1.25, 0.08, 0.05, 0, 0, k * Math.PI / 4));
  }
}

// A streetlamp: square foot, thin post, glowing box lantern under a dark pointed cap,
// and a soft amber pool of light on the ground beneath.
const lampPools = [];
function addLamp(b, x, z) {
  obstacles.push({ x, z, r: 0.4, top: 4.9 });
  b.add(GEO.box, PALETTE.lampPost, mat(null, x, 0.15, z, 0.7, 0.3, 0.7));
  b.add(GEO.trunk, PALETTE.lampPost, mat(null, x, 1.8, z, 0.4, 3.2, 0.4));
  b.add(GEO.box, PALETTE.lampPost, mat(null, x, 3.42, z, 0.6, 0.12, 0.6));
  b.add(GEO.box, PALETTE.window, mat(null, x, 3.85, z, 0.55, 0.75, 0.55), true);
  b.add(GEO.lid, PALETTE.lampPost, mat(null, x, 4.48, z, 1, 0.5, 1));
  b.add(GEO.box, PALETTE.lampPost, mat(null, x, 4.78, z, 0.12, 0.12, 0.12));
  lampPools.push(new THREE.CircleGeometry(3.2, 16).rotateX(-Math.PI / 2).translate(x, 0.06, z));
}

function poolTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255, 183, 121, 1)'); // peach #FFB779
  g.addColorStop(0.5, 'rgba(255, 183, 121, 0.45)');
  g.addColorStop(1, 'rgba(255, 183, 121, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildLampPools(scene) {
  if (!lampPools.length) return;
  const material = new THREE.MeshBasicMaterial({
    map: poolTexture(), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  material.userData.nightOpacity = 0.55;
  NIGHT_GLOW_MATERIALS.push(material);
  const mesh = new THREE.Mesh(mergeGeometries(lampPools), material);
  mesh.renderOrder = 1;
  scene.add(mesh);
  lampPools.forEach((g) => g.dispose());
  lampPools.length = 0;
}

// Tiny far-away houses clustered at the foot of the mountains (decoration only).
function addFarHouses(b, angle, dist) {
  const n = 3 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) {
    const a = angle + rand(-0.09, 0.09), r = dist + rand(-6, 6);
    const w = rand(2.4, 3.4), d = rand(2.6, 3.6), h = rand(1.8, 3);
    const m = mat(null, Math.cos(a) * r, 0, Math.sin(a) * r, 1, 1, 1, 0, rand(0, Math.PI), 0);
    const rr = w / 1.732;
    b.add(GEO.box, pick(PALETTE.walls), mat(m, 0, h / 2, 0, w, h, d));
    b.add(GEO.prism, pick(PALETTE.roof), mat(m, 0, h + 0.5 * rr * 0.8, 0, rr * 1.15, d * 1.1, rr * 0.8, -Math.PI / 2, 0, 0));
    b.add(GEO.plane, PALETTE.window, mat(m, 0, h * 0.5, d / 2 + 0.03, 0.7, 0.8, 1), true);
  }
}

function makeSkyTexture() {
  const c = document.createElement('canvas');
  c.width = 2; c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#22104F');
  g.addColorStop(0.55, PALETTE.sky);
  g.addColorStop(1, '#7A4FB8');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function addSky(scene) {
  scene.background = makeSkyTexture();
  scene.fog = new THREE.Fog('#70509A', 85, 300);

  const count = 700, pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2, phi = rand(0.05, 1.35);
    pos[i * 3] = Math.cos(theta) * Math.sin(phi) * 300;
    pos[i * 3 + 1] = Math.cos(phi) * 300;
    pos[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * 300;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#FFF4D0', size: 2, sizeAttenuation: false, fog: false }));
  scene.add(stars);

  const moon = new THREE.Mesh(new THREE.IcosahedronGeometry(14, 2), new THREE.MeshBasicMaterial({ color: '#FFE9A8', fog: false }));
  moon.position.set(-90, 110, -230);
  scene.add(moon);
  return { stars, moon };
}

export function buildTown(scene) {
  const { stars, moon } = addSky(scene);

  // Soft lavender fill from the sky and a warm light from one side, so roofs and faces keep their colour at night.
  const hemi = new THREE.HemisphereLight('#D4C5F1', '#735274', 1.5);
  scene.add(hemi);
  const moonLight = new THREE.DirectionalLight('#FFE0AF', 1.7);
  moonLight.position.copy(NIGHT_KEY_POSITION);
  scene.add(moonLight);

  const b = new Batcher();
  const chimneys = [];
  const houses = []; // one entry per house: variant, place, turn and size, for drawing, flying and walking
  const hb = new Batcher(); // the simple-shape stand-in houses

  b.add(GEO.plane, PALETTE.ground, mat(null, 0, 0, 0, 600, 600, 1, -Math.PI / 2, 0, 0));

  const spacing = 12;
  for (let i = -5; i <= 5; i++) {
    for (let j = -5; j <= 5; j++) {
      const x = i * spacing + rand(-1, 1), z = j * spacing + rand(-1, 1);
      b.add(GEO.plane, PALETTE.grass, mat(null, x, 0.02, z, 9, 9, 1, -Math.PI / 2, 0, 0));
      addPaving(b, x, z, 9);
      if (Math.random() < 0.82) addHouse(hb, i, j, x, z, chimneys, houses);
      else { addTree(b, x - 2, z - 1); addTree(b, x + 2, z + 1.5); }
      if (Math.random() < 0.3) addTree(b, x + 4, z - 4.1, rand(0.8, 1.1));
      // Streetlamps on the plot corners, some with a little tree and a crate beside them.
      if ((i + j) % 3 === 0) {
        addLamp(b, x - 4.1, z + 4.1);
        if (Math.random() < 0.5) addTree(b, x - 2.4, z + 4.3, rand(0.75, 0.95));
        if (Math.random() < 0.45) addCrate(b, x - 4.3, z + 2.9, rand(-0.4, 0.4));
      }
    }
  }

  // Low-poly mountains all around the edge: two staggered rows of broad, low peaks,
  // with tiny houses clustered at their feet. Lots of open sky above for the stars.
  const PEAKS = 20;
  for (let row = 0; row < 2; row++) {
    for (let k = 0; k < PEAKS; k++) {
      const a = ((k + row * 0.5) / PEAKS) * Math.PI * 2 + rand(-0.06, 0.06);
      const dist = row ? rand(225, 245) : rand(180, 195);
      const s = row ? rand(48, 66) : rand(36, 50), hgt = row ? rand(24, 34) : rand(14, 24);
      b.add(GEO.peak, PALETTE.mountain[row], mat(null, Math.cos(a) * dist, hgt / 2, Math.sin(a) * dist, s, hgt, s * 0.8, 0, rand(0, 3), 0));
      if (!row && Math.random() < 0.6) addFarHouses(b, a + rand(-0.08, 0.08), dist - s * 0.95);
    }
  }

  b.build(scene);
  buildLampPools(scene);
  const standIn = new THREE.Group();
  const glowsBefore = GLOW_MATERIALS.length;
  hb.build(standIn);
  scene.add(standIn);
  const standInGlows = GLOW_MATERIALS.slice(glowsBefore);
  buildSculptedHouses(scene, houses, standIn, standInGlows)
    .catch((err) => console.warn('Sculpted houses did not load; keeping the simple ones.', err));

  // The lowest the hero may fly at a spot: a little above any roof or chimney there, and above the trees.
  function floorAt(px, pz) {
    let floor = 7;
    for (const h of houses) {
      if (Math.abs(px - h.x) < h.half + 1 && Math.abs(pz - h.z) < h.half + 1) floor = Math.max(floor, h.top + 1.4);
    }
    for (const c of chimneys) {
      const dx = px - c.pos.x, dz = pz - c.pos.z;
      if (dx * dx + dz * dz < 4) floor = Math.max(floor, c.pos.y + 1.3);
    }
    return floor;
  }

  // The height of whatever she would stand on at a spot: the ground (0), a sloping roof, a wall top
  // or a chimney top. Used for landing and walking.
  function surfaceAt(px, pz) {
    let top = 0;
    for (const h of houses) {
      const dx = px - h.x, dz = pz - h.z;
      if (Math.abs(dx) > h.half || Math.abs(dz) > h.half) continue;
      // Into the house's own directions (turned by ry around y, scaled by s), then its height map.
      const lx = (h.cos * dx - h.sin * dz) / h.s, lz = (h.sin * dx + h.cos * dz) / h.s;
      top = Math.max(top, houseHeight(HOUSE_VARIANTS[h.v], lx, lz) * h.s);
    }
    return top;
  }

  // Like surfaceAt, but lamp posts, tree trunks and crates count too: for walking into things.
  function solidAt(px, pz) {
    let top = surfaceAt(px, pz);
    for (const o of obstacles) {
      const dx = px - o.x, dz = pz - o.z;
      if (dx * dx + dz * dz < o.r * o.r) top = Math.max(top, o.top);
    }
    return top;
  }

  // Would a camera at (x, y, z) be inside something? Houses, lamps, tree trunks and crowns.
  function blocksCamera(px, py, pz) {
    if (surfaceAt(px, pz) > py - 0.4) return true;
    for (const o of obstacles) {
      const dx = px - o.x, dz = pz - o.z, d2 = dx * dx + dz * dz;
      if (d2 < (o.r + 0.4) ** 2 && py < o.top + 0.3) return true;
      if (o.crown && py > o.crownBottom - 0.3 && py < o.top + 0.3 && d2 < (o.crown + 0.3) ** 2) return true;
    }
    return false;
  }
  return { chimneys, floorAt, surfaceAt, solidAt, blocksCamera, skyParts: { stars, moon, hemi, keyLight: moonLight } };
}
