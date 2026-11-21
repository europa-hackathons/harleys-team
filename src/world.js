// The sky world: lights, puffy clouds, the route of cloud rings, the farm on a cloud, bananas and mud.
// The race goes from z = 0 toward negative z; the farm's finish line is at z = -TRACK_LENGTH.
import * as THREE from 'three';
import { COLORS, mat, blob } from './animals.js';

export const TRACK_LENGTH = 1000;
export const RING_RADIUS = 4.2;

/** Where the middle of the route is at depth z: it gently weaves left/right and up/down. */
export function pathCentre(z) {
  const d = -z;
  const fade = Math.min(1, d / 120);   // straight at the start
  return new THREE.Vector2(Math.sin(d * 0.012) * 7 * fade, Math.sin(d * 0.017 + 1) * 3.5 * fade);
}

export function setupSky(scene) {
  scene.background = new THREE.Color(COLORS.sky);
  scene.fog = new THREE.Fog(COLORS.sky, 80, 330);
  scene.add(new THREE.HemisphereLight('#FFFFFF', '#9FC9E8', 2.2));
  const sun = new THREE.DirectionalLight('#FFF6E5', 1.6);
  sun.position.set(6, 12, 8);
  scene.add(sun);
}

/** A puffy cloud: a clump of faceted balls. */
export function makeCloud(size = 1, lumps = 6) {
  const g = new THREE.Group();
  for (let i = 0; i < lumps; i++) {
    const r = size * (0.6 + Math.random() * 0.5) * (i === 0 ? 1.3 : 1);
    const x = (i === 0 ? 0 : (Math.random() - 0.5) * 3.2) * size;
    g.add(blob(COLORS.cloud, [x, Math.random() * 0.4 * size, (Math.random() - 0.5) * size], [r * 1.2, r * 0.8, r]));
  }
  return g;
}

/** A ring of little cloud lumps, standing up so racers swim through it. */
export function makeRing(radius = RING_RADIUS) {
  const g = new THREE.Group();
  const n = 16;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const s = 0.75 + (i % 3) * 0.12;
    g.add(blob(COLORS.cloud, [Math.cos(a) * radius, Math.sin(a) * radius, 0], [s, s, s * 0.8]));
  }
  return g;
}

export function buildRoute(scene) {
  const rings = [];
  for (let z = -60; z > -TRACK_LENGTH + 30; z -= 55) {
    const c = pathCentre(z);
    const ring = makeRing();
    ring.position.set(c.x, c.y, z);
    scene.add(ring);
    rings.push(ring);
  }
  // Decoration clouds on both sides and below, all the way to the farm.
  for (let z = 20; z > -TRACK_LENGTH - 60; z -= 14) {
    const c = pathCentre(z);
    const side = Math.random() < 0.5 ? -1 : 1;
    const cloud = makeCloud(1.5 + Math.random() * 2.5);
    cloud.position.set(c.x + side * (16 + Math.random() * 25), c.y + (Math.random() - 0.4) * 22, z);
    scene.add(cloud);
    if (Math.random() < 0.5) {
      const low = makeCloud(3 + Math.random() * 3);
      low.position.set(c.x + (Math.random() - 0.5) * 50, c.y - 18 - Math.random() * 10, z);
      scene.add(low);
    }
  }
  return rings;
}

/** The farm on its cloud island. It ignores fog so it can be seen far away, like a goal on the horizon. */
export function buildFarm(scene) {
  const farm = new THREE.Group();
  const add = (mesh) => { farm.add(mesh); return mesh; };
  const box = (color, size, pos) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...size), mat(color));
    m.position.set(...pos);
    return add(m);
  };
  // Cloud base + grass top
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    add(blob(COLORS.cloud, [Math.cos(a) * 13, -2.5, Math.sin(a) * 9], [5, 3, 4.5]));
  }
  add(blob(COLORS.cloud, [0, -4, 0], [12, 3.5, 8]));
  const grass = add(new THREE.Mesh(new THREE.CylinderGeometry(15, 13, 2, 10), mat(COLORS.grass)));
  grass.scale.z = 0.7;
  grass.position.y = -0.5;
  // Barn
  box(COLORS.red, [8, 6, 6], [0, 3.5, 0]);
  const roof = add(new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 6.6, 3), mat('#7A4A3A')));
  roof.rotation.x = -Math.PI / 2;        // triangle prism, point up, ridge running front to back
  roof.position.set(0, 8.1, 0);
  roof.scale.set(1, 1, 0.7);
  box('#FFFFFF', [2.6, 3.6, 0.2], [0, 2.3, 3.05]);                         // door (faces the racers)
  box(COLORS.red, [2.2, 3.2, 0.25], [0, 2.3, 3.1]);
  box('#FFFFFF', [1.4, 1.4, 0.2], [-2.6, 4.6, 3.05]);                      // windows
  box('#FFFFFF', [1.4, 1.4, 0.2], [2.6, 4.6, 3.05]);
  // Trees and fence
  for (const x of [-10, 10]) {
    box('#8A5A3B', [0.8, 3, 0.8], [x, 1.8, 0]);
    add(blob(COLORS.grass, [x, 4.5, 0], [2.2, 2, 2.2]));
    add(blob('#58A83C', [x + 0.8, 5.5, 0.4], [1.4, 1.3, 1.4]));
  }
  for (let x = -12; x <= 12; x += 2) if (Math.abs(x) > 4) box('#FFFFFF', [0.3, 1.4, 0.3], [x, 1.1, 5.5]);
  box('#FFFFFF', [9, 0.25, 0.2], [-8.5, 1.4, 5.5]);
  box('#FFFFFF', [9, 0.25, 0.2], [8.5, 1.4, 5.5]);

  farm.traverse((o) => {
    if (o.isMesh) { o.material = o.material.clone(); o.material.fog = false; }
  });
  const c = pathCentre(-TRACK_LENGTH);
  farm.scale.setScalar(1.4);
  farm.position.set(c.x, c.y - 1, -TRACK_LENGTH - 20);
  scene.add(farm);
  return farm;
}

/** Banana: a little curved bunch of yellow lumps with a brown tip. */
export function makeBanana() {
  const g = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const a = -0.9 + i * 0.45;
    g.add(blob('#FFD93B', [Math.sin(a) * 0.8, -Math.cos(a) * 0.5 + 0.5, 0], [0.32, 0.32, 0.32]));
  }
  g.add(blob('#6B4A2B', [Math.sin(1.0) * 0.85, 0.3, 0], [0.13, 0.13, 0.13]));
  g.scale.setScalar(1.8);
  return g;
}

/** Mud: a sticky brown splat. */
export function makeMud() {
  const g = new THREE.Group();
  g.add(blob('#7B4B2A', [0, 0, 0], [1.2, 0.9, 1]));
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.add(blob(i % 2 ? '#5E3A20' : '#8E5A33', [Math.cos(a) * 1.0, Math.sin(a) * 0.8, 0.2], [0.5, 0.5, 0.5]));
  }
  g.scale.setScalar(1.3);
  return g;
}
