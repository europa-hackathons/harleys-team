// Candy land building blocks: unicorns, candy, jelly blobs, rainbows, the track and sparkles.
// Everything is made from simple three.js shapes (no image files).
import * as THREE from 'three';

export const LANES = [-2.2, 0, 2.2];

export const COLORS = {
  pink: '#ff7eb9', mint: '#5ce1b0', lemon: '#ffe45c', sky: '#6ccfff',
  lilac: '#c39bff', white: '#ffffff', orange: '#ffab5c', red: '#ff6b6b',
};
export const RAINBOW = [COLORS.red, COLORS.orange, COLORS.lemon, COLORS.mint, COLORS.sky, COLORS.lilac];
export const CANDY_COLORS = [COLORS.pink, COLORS.lemon, COLORS.sky, COLORS.mint, COLORS.lilac, COLORS.orange];

const matCache = new Map();
export function mat(color) {
  if (!matCache.has(color)) matCache.set(color, new THREE.MeshToonMaterial({ color }));
  return matCache.get(color);
}

// ---------- Unicorn ----------

const torsoGeo = new THREE.CapsuleGeometry(0.42, 0.9, 6, 12);
const neckGeo = new THREE.CapsuleGeometry(0.24, 0.5, 4, 10);
const skullGeo = new THREE.BoxGeometry(0.46, 0.46, 0.75);
const muzzleGeo = new THREE.BoxGeometry(0.44, 0.3, 0.22);
const hornGeo = new THREE.ConeGeometry(0.09, 0.55, 10);
const earGeo = new THREE.ConeGeometry(0.07, 0.2, 6);
const eyeGeo = new THREE.SphereGeometry(0.06, 8, 6);
const fluffGeo = new THREE.SphereGeometry(0.15, 10, 8);
const legGeo = new THREE.CylinderGeometry(0.1, 0.09, 0.8, 8);
const hoofGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.12, 8);

export function makeUnicorn({ body, mane, muzzle = '#ffd0e6', horn = COLORS.lemon, hooves = COLORS.lilac }) {
  const root = new THREE.Group();
  const rig = new THREE.Group();
  root.add(rig);
  const bodyMat = mat(body);

  const torso = new THREE.Mesh(torsoGeo, bodyMat);
  torso.rotation.x = Math.PI / 2;
  torso.position.y = 1.05;
  rig.add(torso);

  const neck = new THREE.Mesh(neckGeo, bodyMat);
  neck.position.set(0, 1.45, -0.62);
  neck.rotation.x = -0.5;
  rig.add(neck);

  const head = new THREE.Group();
  head.position.set(0, 1.85, -0.95);
  rig.add(head);
  head.add(new THREE.Mesh(skullGeo, bodyMat));
  const snout = new THREE.Mesh(muzzleGeo, mat(muzzle));
  snout.position.set(0, -0.08, -0.33);
  head.add(snout);
  const hornMesh = new THREE.Mesh(hornGeo, mat(horn));
  hornMesh.position.set(0, 0.45, -0.12);
  hornMesh.rotation.x = -0.35;
  head.add(hornMesh);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(earGeo, bodyMat);
    ear.position.set(side * 0.15, 0.3, 0.2);
    head.add(ear);
    const eye = new THREE.Mesh(eyeGeo, mat('#2b1640'));
    eye.position.set(side * 0.235, 0.08, -0.1);
    head.add(eye);
  }

  // Rainbow mane down the neck, and a fluffy tail.
  for (let i = 0; i < 6; i++) {
    const f = i / 5;
    const puff = new THREE.Mesh(fluffGeo, mat(mane[i % mane.length]));
    puff.position.set(0, 2.1 - f * 0.75, -0.72 + f * 0.55);
    rig.add(puff);
  }
  for (let i = 0; i < 4; i++) {
    const puff = new THREE.Mesh(fluffGeo, mat(mane[i % mane.length]));
    puff.position.set(0, 1.2 - i * 0.12, 0.85 + i * 0.14);
    puff.scale.setScalar(1.2 - i * 0.1);
    rig.add(puff);
  }

  // Legs swing from the hip: front-left, front-right, back-left, back-right.
  const legs = [];
  for (const [x, z] of [[-0.25, -0.45], [0.25, -0.45], [-0.25, 0.5], [0.25, 0.5]]) {
    const hip = new THREE.Group();
    hip.position.set(x, 0.85, z);
    const leg = new THREE.Mesh(legGeo, bodyMat);
    leg.position.y = -0.4;
    hip.add(leg);
    const hoof = new THREE.Mesh(hoofGeo, mat(hooves));
    hoof.position.y = -0.78;
    hip.add(hoof);
    rig.add(hip);
    legs.push(hip);
  }

  return { root, rig, head, legs };
}

export function animateUnicorn(u, t, pace, airborne) {
  const amount = Math.min(1, pace / 8);
  u.legs.forEach((hip, i) => {
    if (airborne) {
      hip.rotation.x = i < 2 ? 0.8 : -0.8;
    } else {
      const phase = i === 0 || i === 3 ? 0 : Math.PI;
      hip.rotation.x = Math.sin(t * pace + phase) * 0.8 * amount;
    }
  });
  u.rig.position.y = airborne ? 0 : Math.abs(Math.sin(t * pace)) * 0.12 * amount;
  u.head.rotation.x = Math.sin(t * pace * 2) * 0.06 * amount;
}

// ---------- Pickups and obstacles ----------

const candyBallGeo = new THREE.SphereGeometry(0.32, 16, 12);
const candyEndGeo = new THREE.ConeGeometry(0.2, 0.3, 8);

export function makeCandy(color) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(candyBallGeo, mat(color)));
  for (const side of [-1, 1]) {
    const end = new THREE.Mesh(candyEndGeo, mat(COLORS.white));
    end.position.x = side * 0.42;
    end.rotation.z = side * Math.PI / 2; // tip points back to the candy
    g.add(end);
  }
  return g;
}

const jellyGeo = new THREE.SphereGeometry(0.85, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2);
const jellyEyeGeo = new THREE.SphereGeometry(0.13, 10, 8);
const pupilGeo = new THREE.SphereGeometry(0.065, 8, 6);
const jellyMats = [COLORS.mint, COLORS.pink, COLORS.orange].map(
  (color) => new THREE.MeshToonMaterial({ color, transparent: true, opacity: 0.85 }),
);

export function makeJelly() {
  const g = new THREE.Group();
  const blob = new THREE.Group(); // squishes as one
  g.add(blob);
  const dome = new THREE.Mesh(jellyGeo, jellyMats[Math.floor(Math.random() * jellyMats.length)]);
  dome.scale.y = 0.85;
  blob.add(dome);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(jellyEyeGeo, mat(COLORS.white));
    eye.position.set(side * 0.25, 0.42, 0.62);
    blob.add(eye);
    const pupil = new THREE.Mesh(pupilGeo, mat('#2b1640'));
    pupil.position.set(side * 0.25, 0.42, 0.74);
    blob.add(pupil);
  }
  g.userData.blob = blob;
  return g;
}

const cloudGeo = new THREE.SphereGeometry(0.28, 12, 10);

export function makeRainbow() {
  const g = new THREE.Group();
  RAINBOW.forEach((color, i) => {
    const band = new THREE.Mesh(new THREE.TorusGeometry(1.0 - i * 0.11, 0.065, 8, 28, Math.PI), mat(color));
    g.add(band);
  });
  for (const side of [-1, 1]) {
    for (const [dx, dy] of [[0, 0], [0.22, 0.08], [-0.2, 0.05]]) {
      const puff = new THREE.Mesh(cloudGeo, mat(COLORS.white));
      puff.position.set(side * 0.78 + dx, dy, 0.05);
      g.add(puff);
    }
  }
  g.scale.setScalar(0.9);
  return g;
}

// ---------- Track and scenery (everything scrolls toward the camera and loops) ----------

const NEAR_Z = 12;
const FAR_Z = -110;
const SPAN = NEAR_Z - FAR_Z;

const stickGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.6, 8);
const popGeo = new THREE.CylinderGeometry(0.9, 0.9, 0.2, 24);
const gumdropGeo = new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
const dashGeo = new THREE.BoxGeometry(0.14, 0.03, 1.6);
const postGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.6, 10);

function makeLollipop() {
  const g = new THREE.Group();
  const stick = new THREE.Mesh(stickGeo, mat(COLORS.white));
  stick.position.y = 1.3;
  g.add(stick);
  const colors = [CANDY_COLORS[Math.floor(Math.random() * CANDY_COLORS.length)], COLORS.white, COLORS.pink];
  colors.forEach((color, i) => {
    const disc = new THREE.Mesh(popGeo, mat(color));
    disc.rotation.x = Math.PI / 2;
    disc.position.set(0, 3.2, i * 0.11);
    disc.scale.setScalar(1 - i * 0.3);
    g.add(disc);
  });
  return g;
}

function makeGumdrop() {
  const g = new THREE.Mesh(gumdropGeo, mat(CANDY_COLORS[Math.floor(Math.random() * CANDY_COLORS.length)]));
  const size = 0.8 + Math.random() * 1.8;
  g.scale.set(size, size * 1.3, size);
  return g;
}

function placeScenery(obj) {
  const side = Math.random() < 0.5 ? -1 : 1;
  obj.position.x = side * (5.5 + Math.random() * 16);
}

export function makeTrack() {
  const group = new THREE.Group();
  const loopers = [];
  const addLooper = (obj, reroll) => {
    obj.userData.reroll = reroll;
    group.add(obj);
    loopers.push(obj);
  };

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, SPAN + 60), mat('#a6f0cf'));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.03, (NEAR_Z + FAR_Z) / 2 - 20);
  group.add(ground);

  LANES.forEach((x, i) => {
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(2.2, SPAN + 20), mat(i === 1 ? '#ffc4e1' : '#ffa8d2'));
    lane.rotation.x = -Math.PI / 2;
    lane.position.set(x, 0, (NEAR_Z + FAR_Z) / 2);
    group.add(lane);
  });

  for (let z = FAR_Z; z < NEAR_Z; z += 4) {
    for (const x of [-1.1, 1.1]) {
      const dash = new THREE.Mesh(dashGeo, mat(COLORS.white));
      dash.position.set(x, 0.02, z);
      addLooper(dash);
    }
  }

  // Candy-cane fence posts along both edges.
  let flip = false;
  for (let z = FAR_Z; z < NEAR_Z; z += 1.5) {
    flip = !flip;
    for (const x of [-3.6, 3.6]) {
      const post = new THREE.Mesh(postGeo, mat(flip ? '#ff5c8a' : COLORS.white));
      post.position.set(x, 0.3, z);
      addLooper(post);
    }
  }

  for (let i = 0; i < 40; i++) {
    const obj = Math.random() < 0.5 ? makeLollipop() : makeGumdrop();
    placeScenery(obj);
    obj.position.z = FAR_Z + Math.random() * SPAN;
    addLooper(obj, placeScenery);
  }

  return {
    group,
    update(dz) {
      for (const obj of loopers) {
        obj.position.z += dz;
        if (obj.position.z > NEAR_Z) {
          obj.position.z -= SPAN;
          obj.userData.reroll?.(obj);
        }
      }
    },
  };
}

// ---------- Sparkles: little stars that burst out and fade ----------

function starShape(outer, inner, points = 5) {
  const shape = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  return shape;
}

export function makeSparkles(scene, size = 220) {
  const geo = new THREE.ShapeGeometry(starShape(0.2, 0.09));
  const mats = new Map();
  const matFor = (color) => {
    if (!mats.has(color)) mats.set(color, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    return mats.get(color);
  };
  const pool = Array.from({ length: size }, () => {
    const mesh = new THREE.Mesh(geo, matFor(COLORS.white));
    mesh.visible = false;
    scene.add(mesh);
    return { mesh, life: 0, max: 1, scale: 1, vel: new THREE.Vector3() };
  });
  let next = 0;

  return {
    emit(x, y, z, { count = 10, colors = RAINBOW, spread = 4, up = 3, life = 0.7, scale = 1 } = {}) {
      for (let i = 0; i < count; i++) {
        const p = pool[next];
        next = (next + 1) % size;
        p.mesh.material = matFor(colors[Math.floor(Math.random() * colors.length)]);
        p.mesh.position.set(x, y, z);
        p.vel.set((Math.random() - 0.5) * spread, Math.random() * up + up * 0.3, (Math.random() - 0.5) * spread);
        p.life = p.max = life * (0.6 + Math.random() * 0.6);
        p.scale = scale;
        p.mesh.visible = true;
      }
    },
    update(dt, dz) {
      for (const p of pool) {
        if (p.life <= 0) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.mesh.visible = false;
          continue;
        }
        p.vel.y -= 6 * dt;
        p.mesh.position.addScaledVector(p.vel, dt);
        p.mesh.position.z += dz;
        p.mesh.scale.setScalar(p.scale * (p.life / p.max));
        p.mesh.rotation.z += dt * 6;
      }
    },
  };
}
