// The night town: houses, chimneys, trees, lamps, sky, stars and moon.
// Everything static is merged into a few meshes (one per colour) so it stays fast.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const PALETTE = {
  sky: '#4B2A8C',
  roof: ['#B8405E', '#9E3550', '#C4566E'],
  walls: ['#C9B8B0', '#E3C7A8', '#D8AFA4', '#BFA9CC'],
  chimney: '#C9B8B0',
  chimneyCap: '#9C8A86',
  window: '#FFD45C',
  door: '#6B4A3A',
  ground: '#5B4C7E',
  grass: '#4F6E57',
  tree: ['#5E8A55', '#6F9A5F', '#4F7A4A'],
  trunk: '#7A5238',
  lampPost: '#2E2346',
  mountain: '#3A2470',
};

export const TOWN_HALF = 66; // the town spans -66..66 on x and z

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
      const mesh = new THREE.Mesh(merged, material);
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
  blob: new THREE.IcosahedronGeometry(1, 0),
  ball: new THREE.IcosahedronGeometry(1, 1),
  cone: new THREE.ConeGeometry(1, 1, 7),
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

function addHouse(b, x, z, chimneys, roofs) {
  const w = rand(5, 7), d = rand(5, 7), h = rand(3, 5.5);
  const ry = Math.floor(Math.random() * 4) * Math.PI / 2;
  const house = mat(null, x, 0, z, 1, 1, 1, 0, ry, 0);
  const wall = pick(PALETTE.walls), roof = pick(PALETTE.roof);

  b.add(GEO.box, wall, mat(house, 0, h / 2, 0, w, h, d));

  // Triangular roof: a 3-sided cylinder lying along local z, one edge pointing up.
  const r = (w * 1.12) / 1.732;
  const sy = rand(0.5, 0.8);
  const apex = 1.5 * r * sy;
  b.add(GEO.prism, roof, mat(house, 0, h + 0.5 * r * sy, 0, r, d * 1.12, r * sy, -Math.PI / 2, 0, 0));

  // Chimney on one roof slope.
  const side = Math.random() < 0.5 ? -1 : 1;
  const cx = side * w * 0.25, cz = rand(-d * 0.25, d * 0.25);
  const top = h + apex * 0.55 + rand(1.6, 3.2);
  const ch = top - h;
  b.add(GEO.box, PALETTE.chimney, mat(house, cx, h + ch / 2, cz, 1.2, ch, 1.2));
  b.add(GEO.box, PALETTE.chimneyCap, mat(house, cx, top + 0.15, cz, 1.6, 0.3, 1.6));
  const worldTop = new THREE.Vector3(cx, top + 0.3, cz).applyMatrix4(house);
  chimneys.push({ pos: worldTop, person: null });
  roofs.push({ x, z, half: Math.max(w, d) * 0.56, top: h + apex });

  // Glowing windows on all four sides, and a door at the front.
  const ww = 0.9, wh = 1.0, wy = h * 0.55;
  for (const [fx, fz, rot, half] of [[0, 1, 0, d / 2], [0, -1, Math.PI, d / 2], [1, 0, Math.PI / 2, w / 2], [-1, 0, -Math.PI / 2, w / 2]]) {
    const span = fx ? d : w;
    const slots = fz === 1 ? [-span * 0.27, span * 0.27] : span > 5.8 ? [-span * 0.22, span * 0.22] : [0];
    for (const s of slots) {
      const px = fx ? fx * (half + 0.02) : s, pz = fz ? fz * (half + 0.02) : s;
      b.add(GEO.plane, PALETTE.window, mat(house, px, wy, pz, ww, wh, 1, 0, rot, 0), true);
    }
  }
  b.add(GEO.box, PALETTE.door, mat(house, 0, 0.8, d / 2 + 0.03, 1.0, 1.6, 0.1));
}

function addTree(b, x, z) {
  const s = rand(1.2, 1.9);
  b.add(GEO.trunk, PALETTE.trunk, mat(null, x, s * 0.6, z, 1, s * 1.2, 1));
  b.add(GEO.blob, pick(PALETTE.tree), mat(null, x, s * 1.2 + s * 0.8, z, s, s, s, rand(0, 3), rand(0, 3), 0));
}

function addLamp(b, x, z) {
  b.add(GEO.trunk, PALETTE.lampPost, mat(null, x, 1.6, z, 0.45, 3.2, 0.45));
  b.add(GEO.ball, PALETTE.window, mat(null, x, 3.4, z, 0.35, 0.45, 0.35), true);
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
  scene.fog = new THREE.Fog('#5E3A9E', 60, 230);

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

  const hemi = new THREE.HemisphereLight('#B9A0FF', '#3A2A5C', 1.6);
  scene.add(hemi);
  const moonLight = new THREE.DirectionalLight('#FFE7C4', 1.4);
  moonLight.position.set(-40, 80, -30);
  scene.add(moonLight);

  const b = new Batcher();
  const chimneys = [];
  const roofs = []; // { x, z, half, top }: a square around each house and its highest roof point

  b.add(GEO.plane, PALETTE.ground, mat(null, 0, 0, 0, 600, 600, 1, -Math.PI / 2, 0, 0));

  const spacing = 12;
  for (let i = -5; i <= 5; i++) {
    for (let j = -5; j <= 5; j++) {
      const x = i * spacing + rand(-1, 1), z = j * spacing + rand(-1, 1);
      b.add(GEO.plane, PALETTE.grass, mat(null, x, 0.02, z, 9, 9, 1, -Math.PI / 2, 0, 0));
      if (Math.random() < 0.82) addHouse(b, x, z, chimneys, roofs);
      else { addTree(b, x - 2, z - 1); addTree(b, x + 2, z + 1.5); }
      if (Math.random() < 0.3) addTree(b, x + 5.5, z + 5.5);
      if ((i + j) % 3 === 0) addLamp(b, x - 6, z + 6);
    }
  }

  // Low-poly mountains all around the edge.
  for (let k = 0; k < 22; k++) {
    const a = (k / 22) * Math.PI * 2 + rand(-0.1, 0.1), dist = rand(170, 200);
    const s = rand(35, 60), hgt = rand(30, 60);
    b.add(GEO.cone, PALETTE.mountain, mat(null, Math.cos(a) * dist, hgt / 2, Math.sin(a) * dist, s, hgt, s, 0, rand(0, 3), 0));
  }

  b.build(scene);

  // The lowest the hero may fly at a spot: 2 above any roof or chimney there, and above the trees.
  function floorAt(px, pz) {
    let floor = 7;
    for (const r of roofs) {
      if (Math.abs(px - r.x) < r.half + 1 && Math.abs(pz - r.z) < r.half + 1) floor = Math.max(floor, r.top + 2);
    }
    for (const c of chimneys) {
      const dx = px - c.pos.x, dz = pz - c.pos.z;
      if (dx * dx + dz * dz < 4) floor = Math.max(floor, c.pos.y + 1.7);
    }
    return floor;
  }
  return { chimneys, floorAt, skyParts: { stars, moon, hemi, keyLight: moonLight } };
}
