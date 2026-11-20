// Traffic on the streets: one long chunky town bus and a few small toy cars.
// They drive along the street grid between the house lots and turn at the corners.
// Scenery only: no crashing, and the hero ignores them.
import * as THREE from 'three';
import { GLOW_MATERIALS } from './town.js';

// Houses sit on lots every 12 units (-60..60); the streets run halfway between them.
const SPACING = 12;
const STREETS = []; // street centre lines, same on x and z: -66, -54, ... 66
for (let k = -6; k <= 5; k++) STREETS.push(k * SPACING + SPACING / 2);
const LANE = 0.75; // drive on the right of the centre line
const CAR_COLORS = ['#1FA39A', '#B57EDC', '#FFD45C', '#4FE3E0', '#B8405E'];
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  wheel: new THREE.CylinderGeometry(1, 1, 1, 10).rotateZ(Math.PI / 2),
};
const MATS = {};
const lit = (color) => (MATS[color] ||= new THREE.MeshLambertMaterial({ color, flatShading: true }));

// Headlights and bus windows glow like the house windows (the sky fades GLOW_MATERIALS day/night).
const headMat = new THREE.MeshBasicMaterial({ color: '#FFD45C' });
GLOW_MATERIALS.push(headMat);
const windowMat = new THREE.MeshBasicMaterial({ color: '#FFD45C' });
GLOW_MATERIALS.push(windowMat);
// Tail lights: red, faded from the same day/night signal.
const tailMat = new THREE.MeshBasicMaterial({ color: '#FF4D5E' });
const TAIL_OFF = new THREE.Color('#6A3446'), TAIL_ON = new THREE.Color('#FF4D5E');
const GLOW_OFF = new THREE.Color('#5C5784'), GLOW_ON = new THREE.Color('#FFD45C');

function part(group, geo, mat, x, y, z, sx, sy, sz) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = m.receiveShadow = !m.material.isMeshBasicMaterial; // glowing lights don't need shadows
  group.add(m);
  return m;
}

// A vehicle faces +z. len: length, wid: width.
function makeVehicle(scene, { bus, color }) {
  const g = new THREE.Group();
  const len = bus ? 5.2 : 2.3, wid = bus ? 1.45 : 1.15;
  const wheels = [];
  const wr = bus ? 0.38 : 0.3;
  for (const wz of bus ? [-len * 0.32, len * 0.32] : [-len * 0.3, len * 0.3]) {
    for (const s of [-1, 1]) wheels.push(part(g, GEO.wheel, lit('#2E2346'), s * wid * 0.48, wr, wz, 0.25, wr, wr));
  }
  if (bus) {
    part(g, GEO.box, lit(color), 0, wr + 1.0, 0, wid, 1.7, len);
    part(g, GEO.box, lit('#FFFFFF'), 0, wr + 1.9, 0, wid * 0.92, 0.12, len * 0.94); // roof stripe
    // A row of windows down each side, plus the windscreen.
    for (const s of [-1, 1]) {
      for (let i = 0; i < 5; i++) part(g, GEO.box, windowMat, s * (wid / 2 + 0.01), wr + 1.35, -len * 0.38 + i * len * 0.17, 0.04, 0.55, 0.62);
    }
    part(g, GEO.box, windowMat, 0, wr + 1.35, len / 2 + 0.01, wid * 0.8, 0.6, 0.04);
  } else {
    part(g, GEO.box, lit(color), 0, wr + 0.35, 0, wid, 0.6, len);
    part(g, GEO.box, lit('#E8E0F4'), 0, wr + 0.85, -len * 0.08, wid * 0.85, 0.45, len * 0.5); // cabin with glass
    part(g, GEO.box, lit(color), 0, wr + 1.1, -len * 0.08, wid * 0.9, 0.1, len * 0.52); // roof
  }
  const ly = bus ? wr + 0.55 : wr + 0.4;
  for (const s of [-1, 1]) {
    part(g, GEO.box, headMat, s * wid * 0.32, ly, len / 2 + 0.02, 0.28, 0.2, 0.06);
    part(g, GEO.box, tailMat, s * wid * 0.35, ly, -len / 2 - 0.02, 0.24, 0.16, 0.06);
  }
  scene.add(g);
  return { group: g, wheels, wr, speed: bus ? 4.5 : 6 + Math.random() * 1.5 };
}

const pickInt = (n) => Math.floor(Math.random() * n);

export function createTraffic(scene) {
  const vehicles = [makeVehicle(scene, { bus: true, color: '#F2635F' })];
  for (let i = 0; i < 5; i++) vehicles.push(makeVehicle(scene, { bus: false, color: CAR_COLORS[i] }));

  // Each vehicle drives from corner (ix, iz) to the next corner in direction dir.
  function chooseDir(v) {
    const options = DIRS.filter(([dx, dz]) => {
      const nx = v.ix + dx, nz = v.iz + dz;
      if (nx < 0 || nz < 0 || nx >= STREETS.length || nz >= STREETS.length) return false;
      return !(v.dir && dx === -v.dir[0] && dz === -v.dir[1]); // no U-turns
    });
    return options[pickInt(options.length)];
  }
  for (const v of vehicles) {
    v.ix = pickInt(STREETS.length); v.iz = pickInt(STREETS.length);
    v.dir = null;
    v.dir = chooseDir(v);
    v.prevRight = new THREE.Vector3(-v.dir[1], 0, v.dir[0]);
    v.t = Math.random() * SPACING; // distance travelled along this block
    v.yaw = Math.atan2(v.dir[0], v.dir[1]);
  }

  const right = new THREE.Vector3(), lane = new THREE.Vector3();
  let tailOn = 1;
  function update(dt) {
    // Tail lights follow the same day/night glow as the headlights.
    const c = headMat.color;
    tailOn = THREE.MathUtils.clamp((c.r - GLOW_OFF.r) / (GLOW_ON.r - GLOW_OFF.r), 0, 1);
    tailMat.color.copy(TAIL_OFF).lerp(TAIL_ON, tailOn);

    for (const v of vehicles) {
      v.t += v.speed * dt;
      if (v.t >= SPACING) {
        v.t -= SPACING;
        v.ix += v.dir[0]; v.iz += v.dir[1];
        v.prevRight.set(-v.dir[1], 0, v.dir[0]);
        v.dir = chooseDir(v);
      }
      const [dx, dz] = v.dir;
      // Right-hand side of travel (facing +z, right is -x in three.js world).
      right.set(-dz, 0, dx);
      // Ease the lane shift after a turn, so corners look smooth.
      const ease = Math.min(v.t / 3, 1);
      lane.copy(v.prevRight).lerp(right, ease).multiplyScalar(LANE);
      v.group.position.set(STREETS[v.ix] + dx * v.t + lane.x, 0, STREETS[v.iz] + dz * v.t + lane.z);
      // Turn smoothly towards the driving direction.
      const want = Math.atan2(dx, dz);
      let diff = want - v.yaw;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      v.yaw += diff * (1 - Math.exp(-dt * 8));
      v.group.rotation.y = v.yaw;
      for (const w of v.wheels) w.rotation.x += (v.speed * dt) / v.wr;
    }
  }

  return { update, vehicles };
}
