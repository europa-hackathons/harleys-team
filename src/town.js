// The night town: houses, chimneys, trees, lamps, sky, stars and moon.
// Everything static is merged into a few meshes (one per colour) so it stays fast.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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
  ground: '#5B4C7E',
  grass: '#4F6E57',
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

// A cozy house: walls, a wall-coloured gable, two red roof slabs with an overhang,
// a chunky chimney with a rim and a dark opening, and big four-pane golden windows.
// The gable ends (with the door) face local +z/-z; ry turns the house a quarter turn at a time,
// so some houses show their gable to the street and some their long roof side.
const ROOF_THICK = 0.3, EAVE = 0.55, GABLE_OVERHANG = 0.35;

function addHouse(b, x, z, chimneys, roofs) {
  const w = rand(4.8, 5.8), d = rand(6, 7.4), h = rand(3, 5.2);
  const ry = Math.floor(Math.random() * 4) * Math.PI / 2;
  const house = mat(null, x, 0, z, 1, 1, 1, 0, ry, 0);
  const wall = pick(PALETTE.walls), roof = pick(PALETTE.roof);

  b.add(GEO.box, wall, mat(house, 0, h / 2, 0, w, h, d));

  // Gable: a 3-sided cylinder lying along local z, one edge up, exactly as wide as the walls.
  const r = w / 1.732;
  const sy = rand(0.6, 0.85);
  const apex = 1.5 * r * sy;
  b.add(GEO.prism, wall, mat(house, 0, h + 0.5 * r * sy, 0, r, d, r * sy, -Math.PI / 2, 0, 0));

  // Two red roof slabs along the slopes, sticking out past the eaves and the gable ends.
  const half = w / 2, slope = Math.hypot(half, apex), theta = Math.atan2(apex, half);
  const c = Math.cos(theta), s = Math.sin(theta);
  const ridge = 0.12; // a little past the ridge so the two slabs meet
  for (const side of [-1, 1]) {
    // Middle of the slab: halfway down the slope, shifted for the overhangs, lifted by half its thickness.
    const shift = (EAVE - ridge) / 2;
    const mx = side * (half / 2 + c * shift + s * ROOF_THICK / 2);
    const my = h + apex / 2 - s * shift + c * ROOF_THICK / 2;
    b.add(GEO.box, roof, mat(house, mx, my, 0, slope + EAVE + ridge, ROOF_THICK, d + GABLE_OVERHANG * 2, 0, 0, -side * theta));
  }

  // Chunky chimney on one slope: shaft, a wider rim, and a dark opening on top.
  const side = Math.random() < 0.5 ? -1 : 1;
  const cx = side * w * 0.24, cz = rand(-d * 0.22, d * 0.22);
  const top = h + apex * 0.55 + rand(1.7, 3.2); // top of the shaft
  const ch = top - h;
  b.add(GEO.box, PALETTE.chimney, mat(house, cx, h + ch / 2, cz, 1.6, ch, 1.6));
  b.add(GEO.box, PALETTE.chimneyCap, mat(house, cx, top + 0.2, cz, 2.1, 0.4, 2.1));
  b.add(GEO.box, PALETTE.chimneyHole, mat(house, cx, top + 0.41, cz, 1.4, 0.04, 1.4));
  const rimTop = top + 0.4;
  const worldTop = new THREE.Vector3(cx, rimTop, cz).applyMatrix4(house);
  chimneys.push({ pos: worldTop, person: null });
  roofs.push({
    x, z, half: Math.max(w, d) / 2 + EAVE + 0.2, top: h + apex + ROOF_THICK / c, ry, w, d, h, apex,
    eaveX: half + EAVE * c, eaveZ: d / 2 + GABLE_OVERHANG, roofLift: ROOF_THICK / c,
    cx, cz, chimneyTop: rimTop,
  });

  // Big glowing windows: two on each gable end (beside the door), two along each long side.
  const ww = 1.25, wh = 1.45, wy = Math.max(h * 0.55, 1.75);
  for (const [fx, fz, rot, halfDepth] of [[0, 1, 0, d / 2], [0, -1, Math.PI, d / 2], [1, 0, Math.PI / 2, w / 2], [-1, 0, -Math.PI / 2, w / 2]]) {
    const span = fx ? d : w;
    const slots = fz ? [-span * 0.29, span * 0.29] : [-span * 0.22, span * 0.22];
    for (const sl of slots) {
      const px = fx ? fx * (halfDepth + 0.02) : sl, pz = fz ? fz * (halfDepth + 0.02) : sl;
      addWindow(b, house, px, wy, pz, rot, ww, wh);
    }
  }
  // A little attic window up in the front gable.
  if (apex > 2.4) addWindow(b, house, 0, h + apex * 0.32, d / 2 + 0.02, 0, 0.8, 0.9);
  b.add(GEO.box, PALETTE.door, mat(house, 0, 0.85, d / 2 + 0.03, 1.0, 1.7, 0.1));
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
  g.addColorStop(0, 'rgba(255, 200, 110, 1)');
  g.addColorStop(0.5, 'rgba(255, 190, 100, 0.45)');
  g.addColorStop(1, 'rgba(255, 180, 90, 0)');
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
  const roofs = []; // one entry per house: its footprint, roof shape and chimney, for flying and walking

  b.add(GEO.plane, PALETTE.ground, mat(null, 0, 0, 0, 600, 600, 1, -Math.PI / 2, 0, 0));

  const spacing = 12;
  for (let i = -5; i <= 5; i++) {
    for (let j = -5; j <= 5; j++) {
      const x = i * spacing + rand(-1, 1), z = j * spacing + rand(-1, 1);
      b.add(GEO.plane, PALETTE.grass, mat(null, x, 0.02, z, 9, 9, 1, -Math.PI / 2, 0, 0));
      if (Math.random() < 0.82) addHouse(b, x, z, chimneys, roofs);
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

  // The lowest the hero may fly at a spot: a little above any roof or chimney there, and above the trees.
  function floorAt(px, pz) {
    let floor = 7;
    for (const r of roofs) {
      if (Math.abs(px - r.x) < r.half + 1 && Math.abs(pz - r.z) < r.half + 1) floor = Math.max(floor, r.top + 1.4);
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
    for (const r of roofs) {
      const dx = px - r.x, dz = pz - r.z;
      if (Math.abs(dx) > r.half + 1 || Math.abs(dz) > r.half + 1) continue;
      // Into the house's own directions (it is turned by ry around y).
      const c = Math.cos(r.ry), s = Math.sin(r.ry);
      const lx = c * dx - s * dz, lz = s * dx + c * dz;
      // The roof slabs (with their overhang), else the flat wall top.
      if (Math.abs(lx) < r.eaveX && Math.abs(lz) < r.eaveZ) top = Math.max(top, r.h + r.apex * (1 - Math.abs(lx) / (r.w / 2)) + r.roofLift);
      else if (Math.abs(lx) < r.w / 2 && Math.abs(lz) < r.d / 2) top = Math.max(top, r.h);
      if (Math.abs(lx - r.cx) < 1.05 && Math.abs(lz - r.cz) < 1.05) top = Math.max(top, r.chimneyTop);
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
