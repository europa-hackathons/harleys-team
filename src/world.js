// The sky world: lights, puffy clouds, the route of cloud rings, the farm on a cloud, bananas and mud.
// The race goes from z = 0 toward negative z; the farm's finish line is at z = -TRACK_LENGTH.
import * as THREE from 'three';
import { COLORS, mat, blob } from './animals.js';

export const TRACK_LENGTH = 1000;
export const RING_RADIUS = 7;

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

/** A ring of cloud lumps, standing up so racers swim through it. The lumps overlap into one puffy rim. */
export function makeRing(radius = RING_RADIUS) {
  const g = new THREE.Group();
  const n = Math.round(radius * 4.4);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const s = 1.05 + (i % 3) * 0.14;
    g.add(blob(COLORS.cloud, [Math.cos(a) * radius, Math.sin(a) * radius, (i % 2) * 0.3], [s, s, s * 0.85]));
  }
  return g;
}

/** Each ring is nudged off the route's middle (up/down, left/right) so the next openings peek out. */
function ringOffset(i) {
  return new THREE.Vector2(Math.sin(i * 2.3 + 0.6) * 7, Math.cos(i * 1.9 + 0.4) * 4.5);
}

export function buildRoute(scene) {
  const rings = [];
  let i = 0;
  for (let z = -26; z > -TRACK_LENGTH + 30; z -= 45, i++) {
    const c = pathCentre(z).add(ringOffset(i));
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
    let y = c.y + (Math.random() - 0.4) * 22;
    if (z > -220 && side > 0) y = c.y - 4 - Math.random() * 12;   // keep the view to the farm (up and right) clear
    cloud.position.set(c.x + side * (16 + Math.random() * 25), y, z);
    scene.add(cloud);
    if (Math.random() < 0.5) {
      const low = makeCloud(3 + Math.random() * 3);
      low.position.set(c.x + (Math.random() - 0.5) * 50, c.y - 18 - Math.random() * 10, z);
      scene.add(low);
    }
  }
  return rings;
}

/** The farm on its cloud island: a red barn with a peaked roof and white trim, round trees, a fence,
 *  on a flat green island with cloud puffs underneath. It ignores fog, and updateFarm() makes it
 *  look big and high up on the horizon from the very start, so the racers always see their goal. */
export function buildFarm(scene) {
  const farm = new THREE.Group();
  const add = (mesh) => { farm.add(mesh); return mesh; };
  const box = (color, size, pos, rot = [0, 0, 0]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...size), mat(color));
    m.position.set(...pos);
    m.rotation.set(...rot);
    return add(m);
  };
  // Cloud puffs underneath + flattened grass island on top
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    add(blob(COLORS.cloud, [Math.cos(a) * 14, -2.6 - (i % 2) * 0.8, Math.sin(a) * 9.5], [5.2, 3, 4.6]));
  }
  add(blob(COLORS.cloud, [0, -4.5, 0], [13, 3.8, 9]));
  add(blob(COLORS.cloud, [-6, -6, 2], [6, 3, 5]));
  add(blob(COLORS.cloud, [7, -6.2, -1], [6.5, 3, 5]));
  const grass = add(new THREE.Mesh(new THREE.CylinderGeometry(16, 14.5, 1.6, 12), mat(COLORS.grass)));
  grass.scale.z = 0.7;
  grass.position.y = -0.3;
  // Barn: red box, peaked roof, white trim
  const W = 8, H = 6, D = 6, front = D / 2;
  box(COLORS.red, [W, H, D], [0, H / 2 + 0.5, 0]);
  const roofY = H + 0.5;
  const RISE = 3.6, HALF = W / 2 + 0.5;    // roof height and half-width at the eaves
  const roof = add(new THREE.Mesh(new THREE.CylinderGeometry(1, 1, D + 0.6, 3), mat('#8A4A3E')));
  roof.rotation.x = -Math.PI / 2;           // triangle prism, point up, ridge running front to back
  roof.scale.set(HALF / 0.866, 1, RISE / 1.5);
  roof.position.set(0, roofY + RISE / 3, 0);
  // red gable triangle at the front, framed by white roof trim
  const gable = add(new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.3, 3), mat(COLORS.red)));
  gable.rotation.x = -Math.PI / 2;
  gable.scale.set((HALF - 0.6) / 0.866, 1, (RISE - 0.45) / 1.5);
  gable.position.set(0, roofY + (RISE - 0.45) / 3, front + 0.2);
  const slope = Math.atan2(RISE, HALF), len = Math.hypot(RISE, HALF) + 0.3;
  box('#FFFFFF', [len, 0.45, 0.35], [-HALF / 2, roofY + RISE / 2, front + 0.35], [0, 0, slope]);
  box('#FFFFFF', [len, 0.45, 0.35], [HALF / 2, roofY + RISE / 2, front + 0.35], [0, 0, -slope]);
  for (const x of [-W / 2, W / 2]) box('#FFFFFF', [0.45, H, 0.35], [x, H / 2 + 0.5, front + 0.1]);  // corner trim
  box('#FFFFFF', [W + 0.4, 0.4, 0.35], [0, roofY, front + 0.1]);                                    // eave trim
  box('#FFFFFF', [2.8, 3.8, 0.2], [0, 2.4, front + 0.05]);                                          // door frame
  box(COLORS.red, [2.3, 3.4, 0.25], [0, 2.3, front + 0.1]);
  box('#FFFFFF', [0.25, 4.0, 0.3], [0, 2.3, front + 0.2], [0, 0, 0.6]);                             // door X
  box('#FFFFFF', [0.25, 4.0, 0.3], [0, 2.3, front + 0.2], [0, 0, -0.6]);
  for (const x of [-2.7, 2.7]) {                                                                   // windows
    box('#FFFFFF', [1.5, 1.5, 0.2], [x, 4.6, front + 0.05]);
    box('#6FC3F7', [1.1, 1.1, 0.25], [x, 4.6, front + 0.08]);
  }
  box('#FFFFFF', [1.2, 1.2, 0.2], [0, roofY + 1.1, front + 0.4]);                                   // loft window
  // Round low-poly trees
  for (const [x, z, s] of [[-11, -1, 1.1], [11, 0, 1], [-13, 3.5, 0.75]]) {
    box('#8A5A3B', [0.8 * s, 3 * s, 0.8 * s], [x, 1.5 * s, z]);
    add(blob(COLORS.grass, [x, 4.2 * s, z], [2.4 * s, 2.2 * s, 2.4 * s]));
    add(blob('#58A83C', [x + 0.9 * s, 5.2 * s, z + 0.4], [1.5 * s, 1.4 * s, 1.5 * s]));
  }
  // White fence at the front
  for (let x = -12; x <= 12; x += 2) if (Math.abs(x) > 4) box('#FFFFFF', [0.3, 1.4, 0.3], [x, 1.1, 6.5]);
  box('#FFFFFF', [9, 0.25, 0.2], [-8.5, 1.4, 6.5]);
  box('#FFFFFF', [9, 0.25, 0.2], [8.5, 1.4, 6.5]);

  farm.traverse((o) => {
    if (o.isMesh) { o.material = o.material.clone(); o.material.fog = false; }
  });
  const c = pathCentre(-TRACK_LENGTH);
  farm.userData.home = new THREE.Vector3(c.x, c.y - 1, -TRACK_LENGTH - 20);
  farm.position.copy(farm.userData.home);
  farm.scale.setScalar(FARM_SCALE);
  scene.add(farm);
  return farm;
}

const FARM_SCALE = 1.4;       // its real size, when the racers arrive
const FARM_NEAR = 140;        // closer than this it is just its real size
/** Far away the farm is shown bigger and higher, so it reads as a goal on the horizon.
 *  It shrinks smoothly to its real size and place as the racers get close. */
export function updateFarm(farm, camera) {
  const home = farm.userData.home;
  const dist = Math.max(0, camera.position.z - home.z);
  const grow = Math.max(1, Math.pow(dist / FARM_NEAR, 0.85));
  farm.scale.setScalar(FARM_SCALE * grow);
  const lift = (grow - 1) / grow;            // 0 near, towards 1 far away
  farm.position.set(home.x + dist * 0.55 * lift, home.y + dist * 0.22 * lift, home.z);
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
