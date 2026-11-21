// The racers, built from simple faceted shapes (low-poly toy look, no textures).
// All face -Z (away from the camera), belly down, arms spread in a breaststroke pose.
//   const kitten = makeKitten();  scene.add(kitten);
//   kitten.userData.stroke();            // start one swim-stroke animation
//   kitten.userData.animate(dt, time);   // every frame
import * as THREE from 'three';

export const COLORS = {
  sky: '#4FB3F6', cloud: '#F4F7FB', kitten: '#F28C28', pony: '#F6EAD2',
  purple: '#9B5BD6', red: '#D9443A', grass: '#6CC24A',
  piglet: '#F4A6B8', bunny: '#F2F2F5', puppy: '#A8703F', robot: '#9FB7D1',
};

const mats = new Map();
export function mat(color) {
  if (!mats.has(color)) mats.set(color, new THREE.MeshLambertMaterial({ color, flatShading: true }));
  return mats.get(color);
}

const blobGeo = new THREE.IcosahedronGeometry(1, 1);
/** A faceted ball: blob('#fff', [x,y,z], [sx,sy,sz]) */
export function blob(color, pos = [0, 0, 0], scale = [1, 1, 1]) {
  const m = new THREE.Mesh(blobGeo, mat(color));
  m.position.set(...pos);
  m.scale.set(...scale);
  return m;
}

function box(color, size, pos) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(...size), mat(color));
  m.position.set(...pos);
  return m;
}

// Two little shiny eyes on the front of a head (front = -Z). x = half the gap between them.
function eyes(g, x, y, z, size = 0.13) {
  for (const side of [-1, 1]) {
    g.add(blob('#23324A', [side * x, y, z], [size, size * 1.2, size * 0.6]));
    g.add(blob('#FFFFFF', [side * x + 0.04, y + 0.05, z - size * 0.45], [size * 0.35, size * 0.35, size * 0.2]));
  }
}

function cone(color, r, h, pos, rotZ = 0) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 4), mat(color));
  m.position.set(...pos);
  m.rotation.z = rotZ;
  return m;
}

// A limb hangs from a pivot so it can swing. side = +1 right, -1 left.
function arm(side, color, pawColor, shoulder) {
  const pivot = new THREE.Group();
  pivot.position.set(side * shoulder[0], shoulder[1], shoulder[2]);
  pivot.add(blob(color, [side * 0.75, 0, 0], [0.75, 0.3, 0.3]));
  pivot.add(blob(pawColor, [side * 1.45, 0, 0], [0.3, 0.24, 0.3]));
  return pivot;
}
function leg(side, color, footColor, hip, padColor) {
  const pivot = new THREE.Group();
  pivot.position.set(side * hip[0], hip[1], hip[2]);
  pivot.add(blob(color, [0, 0, 0.6], [0.3, 0.3, 0.75]));
  pivot.add(blob(footColor, [0, 0, 1.35], [0.3, 0.3, 0.3]));
  if (padColor) pivot.add(blob(padColor, [0, -0.02, 1.62], [0.14, 0.14, 0.06]));
  return pivot;
}

function rig(group, arms, legs, tail) {
  let strokeT = 1;           // 0..1 through one stroke; 1 = resting
  group.userData.stroke = () => { strokeT = 0; };
  group.userData.animate = (dt, time) => {
    strokeT = Math.min(1, strokeT + dt / 0.55);
    // Breaststroke: arms reach forward, then pull out and back; legs do a frog kick.
    const s = Math.sin(strokeT * Math.PI);
    const armYaw = strokeT < 1 ? 0.7 - 1.3 * strokeT : 0.15 * Math.sin(time * 2);
    const legYaw = 0.5 * s;
    arms.forEach((a, i) => {
      const side = i === 0 ? 1 : -1;
      a.rotation.y = side * armYaw;
      a.rotation.z = side * 0.25 * s;
    });
    legs.forEach((l, i) => { l.rotation.y = (i === 0 ? 1 : -1) * legYaw; });
    tail.rotation.y = 0.3 * Math.sin(time * 3);
  };
}

export function makeKitten() {
  const g = new THREE.Group();
  const O = COLORS.kitten, dark = '#C9661A', W = '#FFFFFF', pink = '#F7A8C8';
  g.add(blob(O, [0, 0, 0], [0.9, 0.75, 1.3]));
  for (const z of [-0.4, 0.1, 0.6]) g.add(blob(dark, [0, 0.66, z], [0.6, 0.12, 0.13]));
  g.add(blob(O, [0, 0.5, -1.25], [0.8, 0.72, 0.72]));                  // head
  g.add(cone(O, 0.3, 0.55, [0.42, 1.25, -1.2], -0.3));                  // ears
  g.add(cone(O, 0.3, 0.55, [-0.42, 1.25, -1.2], 0.3));
  g.add(blob(dark, [0, 1.0, -1.0], [0.35, 0.1, 0.3]));                  // head stripe
  eyes(g, 0.3, 0.62, -1.88);
  g.add(blob(pink, [0, 0.4, -1.95], [0.1, 0.08, 0.06]));                // nose
  const arms = [arm(1, O, W, [0.6, 0.1, -0.7]), arm(-1, O, W, [0.6, 0.1, -0.7])];
  const legs = [leg(1, O, W, [0.4, -0.2, 0.8], pink), leg(-1, O, W, [0.4, -0.2, 0.8], pink)];
  const tail = new THREE.Group();
  tail.position.set(0, 0.2, 1.1);
  [0, 1, 2, 3].forEach((i) => tail.add(blob(i % 2 ? dark : O, [0, i * 0.18, 0.3 + i * 0.38], [0.2, 0.2, 0.26])));
  g.add(...arms, ...legs, tail);
  rig(g, arms, legs, tail);
  return g;
}

export function makePony() {
  const g = new THREE.Group();
  const C = COLORS.pony, P = COLORS.purple;
  g.add(blob(C, [0, 0, 0], [0.95, 0.8, 1.45]));
  g.add(blob(C, [0, 0.55, -1.15], [0.45, 0.55, 0.5]));                 // neck
  g.add(blob(C, [0, 0.95, -1.5], [0.6, 0.62, 0.65]));                  // head
  g.add(blob(C, [0, 0.75, -2.05], [0.42, 0.38, 0.45]));                // snout
  eyes(g, 0.32, 1.1, -2.03);
  g.add(cone(C, 0.2, 0.5, [0.35, 1.6, -1.4], -0.25));                   // ears
  g.add(cone(C, 0.2, 0.5, [-0.35, 1.6, -1.4], 0.25));
  g.add(blob(P, [0, 1.5, -1.35], [0.35, 0.3, 0.45]));                  // mane: top, back of head, falling right
  g.add(blob(P, [0.15, 1.1, -0.9], [0.4, 0.45, 0.5]));
  g.add(blob(P, [0.45, 0.75, -0.75], [0.3, 0.55, 0.45]));
  const arms = [arm(1, C, P, [0.65, 0.1, -0.8]), arm(-1, C, P, [0.65, 0.1, -0.8])];
  const legs = [leg(1, C, P, [0.45, -0.2, 0.9]), leg(-1, C, P, [0.45, -0.2, 0.9])];
  const tail = new THREE.Group();
  tail.position.set(0, 0.35, 1.3);
  tail.add(blob(P, [0, 0.1, 0.4], [0.35, 0.35, 0.5]));
  tail.add(blob(P, [0.15, -0.15, 1.0], [0.4, 0.4, 0.55]));
  tail.add(blob(P, [0.3, -0.5, 1.45], [0.3, 0.35, 0.4]));
  g.add(...arms, ...legs, tail);
  rig(g, arms, legs, tail);
  return g;
}

export function makePiglet() {
  const g = new THREE.Group();
  const P = COLORS.piglet, dark = '#E27D97';
  g.add(blob(P, [0, 0, 0], [1.0, 0.82, 1.3]));
  g.add(blob(P, [0, 0.45, -1.2], [0.8, 0.74, 0.72]));                  // head
  const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 0.3, 8), mat(dark));
  snout.rotation.x = Math.PI / 2;
  snout.position.set(0, 0.3, -1.95);
  g.add(snout);
  g.add(blob('#B85671', [0.12, 0.3, -2.1], [0.06, 0.1, 0.04]));        // nostrils
  g.add(blob('#B85671', [-0.12, 0.3, -2.1], [0.06, 0.1, 0.04]));
  eyes(g, 0.32, 0.72, -1.8);
  g.add(cone(dark, 0.26, 0.45, [0.45, 1.15, -1.25], -0.6));            // ears
  g.add(cone(dark, 0.26, 0.45, [-0.45, 1.15, -1.25], 0.6));
  const arms = [arm(1, P, dark, [0.65, 0.1, -0.7]), arm(-1, P, dark, [0.65, 0.1, -0.7])];
  const legs = [leg(1, P, dark, [0.42, -0.2, 0.8]), leg(-1, P, dark, [0.42, -0.2, 0.8])];
  const tail = new THREE.Group();                                       // curly tail
  tail.position.set(0, 0.35, 1.25);
  const curl = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.07, 6, 10, Math.PI * 1.6), mat(dark));
  curl.position.set(0, 0.15, 0.2);
  curl.rotation.y = Math.PI / 2;
  tail.add(curl);
  g.add(...arms, ...legs, tail);
  rig(g, arms, legs, tail);
  return g;
}

export function makeBunny() {
  const g = new THREE.Group();
  const W = COLORS.bunny, grey = '#C9CAD6', pink = '#F7A8C8';
  g.add(blob(W, [0, 0, 0], [0.88, 0.75, 1.25]));
  g.add(blob(W, [0, 0.5, -1.2], [0.72, 0.68, 0.68]));                  // head
  g.add(blob(W, [0, 0.3, -1.75], [0.36, 0.26, 0.2]));                  // cheeks
  g.add(blob(pink, [0, 0.45, -1.88], [0.1, 0.08, 0.06]));              // nose
  eyes(g, 0.3, 0.68, -1.8);
  for (const side of [-1, 1]) {                                         // long ears, pink inside
    const ear = new THREE.Group();
    ear.position.set(side * 0.28, 1.05, -1.15);
    ear.rotation.z = -side * 0.22;
    ear.rotation.x = 0.25;
    ear.add(blob(W, [0, 0.7, 0], [0.22, 0.8, 0.12]));
    ear.add(blob(pink, [0, 0.7, -0.07], [0.12, 0.62, 0.07]));
    g.add(ear);
  }
  const arms = [arm(1, W, grey, [0.6, 0.1, -0.7]), arm(-1, W, grey, [0.6, 0.1, -0.7])];
  const legs = [leg(1, W, grey, [0.4, -0.2, 0.8], pink), leg(-1, W, grey, [0.4, -0.2, 0.8], pink)];
  const tail = new THREE.Group();                                       // fluffy pom-pom tail
  tail.position.set(0, 0.3, 1.2);
  tail.add(blob('#FFFFFF', [0, 0.1, 0.15], [0.42, 0.42, 0.42]));
  g.add(...arms, ...legs, tail);
  rig(g, arms, legs, tail);
  return g;
}

export function makePuppy() {
  const g = new THREE.Group();
  const B = COLORS.puppy, dark = '#6B4226', light = '#E2B886';
  g.add(blob(B, [0, 0, 0], [0.9, 0.78, 1.32]));
  g.add(blob(light, [0, -0.35, -0.2], [0.6, 0.45, 0.9]));               // tummy patch
  g.add(blob(B, [0, 0.5, -1.25], [0.75, 0.7, 0.72]));                   // head
  g.add(blob(light, [0, 0.3, -1.9], [0.4, 0.3, 0.35]));                 // muzzle
  g.add(blob('#23324A', [0, 0.45, -2.2], [0.14, 0.11, 0.08]));          // nose
  eyes(g, 0.3, 0.72, -1.86);
  for (const side of [-1, 1]) {                                         // floppy ears hang down
    g.add(blob(dark, [side * 0.72, 0.4, -1.15], [0.2, 0.55, 0.32]));
  }
  g.add(blob(dark, [0.35, 0.62, 0.2], [0.35, 0.2, 0.4]));               // back spot
  const arms = [arm(1, B, light, [0.6, 0.1, -0.7]), arm(-1, B, light, [0.6, 0.1, -0.7])];
  const legs = [leg(1, B, light, [0.4, -0.2, 0.8]), leg(-1, B, light, [0.4, -0.2, 0.8])];
  const tail = new THREE.Group();                                       // waggy tail
  tail.position.set(0, 0.4, 1.2);
  const stick = blob(B, [0, 0.25, 0.25], [0.16, 0.16, 0.4]);
  stick.rotation.x = -0.6;
  tail.add(stick, blob(light, [0, 0.45, 0.6], [0.17, 0.17, 0.17]));
  g.add(...arms, ...legs, tail);
  rig(g, arms, legs, tail);
  return g;
}

// A boxy limb for the robot, hanging from a pivot like arm()/leg().
function robotArm(side, color, handColor, shoulder) {
  const pivot = new THREE.Group();
  pivot.position.set(side * shoulder[0], shoulder[1], shoulder[2]);
  pivot.add(box(color, [1.0, 0.36, 0.36], [side * 0.6, 0, 0]));
  pivot.add(box(handColor, [0.42, 0.44, 0.44], [side * 1.3, 0, 0]));
  return pivot;
}
function robotLeg(side, color, footColor, hip) {
  const pivot = new THREE.Group();
  pivot.position.set(side * hip[0], hip[1], hip[2]);
  pivot.add(box(color, [0.38, 0.38, 1.0], [0, 0, 0.55]));
  pivot.add(box(footColor, [0.46, 0.4, 0.46], [0, 0, 1.25]));
  return pivot;
}

export function makeRobot() {
  const g = new THREE.Group();
  const S = COLORS.robot, dark = '#6F87A6', light = '#DCE7F2';
  const glow = new THREE.MeshBasicMaterial({ color: '#FFD93B' });
  g.add(box(S, [1.5, 1.2, 2.2], [0, 0, 0]));                            // chunky body
  g.add(box(light, [0.9, 0.1, 1.0], [0, 0.62, 0]));                     // back panel
  g.add(box(dark, [0.7, 0.4, 0.4], [0, 0.15, -1.1]));                   // neck
  g.add(box(S, [1.3, 1.05, 1.05], [0, 0.55, -1.45]));                   // head
  for (const side of [-1, 1]) {                                         // big round eyes
    const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 12), mat('#FFFFFF'));
    eye.rotation.x = Math.PI / 2;
    eye.position.set(side * 0.3, 0.68, -1.99);
    const pupil = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 10), mat('#23324A'));
    pupil.rotation.x = Math.PI / 2;
    pupil.position.set(side * 0.3, 0.68, -2.03);
    g.add(eye, pupil);
  }
  g.add(box('#F7A8C8', [0.4, 0.08, 0.06], [0, 0.3, -1.99]));            // smile
  for (const side of [-1, 1]) g.add(box(dark, [0.12, 0.35, 0.35], [side * 0.7, 0.6, -1.45])); // ear bolts
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6), mat(dark));
  antenna.position.set(0, 1.35, -1.45);
  const bulb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), glow);
  bulb.position.set(0, 1.72, -1.45);
  g.add(antenna, bulb);
  const arms = [robotArm(1, dark, S, [0.75, 0.1, -0.7]), robotArm(-1, dark, S, [0.75, 0.1, -0.7])];
  const legs = [robotLeg(1, dark, S, [0.45, -0.25, 0.9]), robotLeg(-1, dark, S, [0.45, -0.25, 0.9])];
  const tail = new THREE.Group();                                       // little glowing exhaust
  tail.position.set(0, 0.15, 1.1);
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.35, 8), mat(dark));
  pipe.rotation.x = Math.PI / 2;
  pipe.position.z = 0.15;
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 8), glow);
  lamp.rotation.x = Math.PI / 2;
  lamp.position.z = 0.34;
  tail.add(pipe, lamp);
  g.add(...arms, ...legs, tail);
  rig(g, arms, legs, tail);
  const baseAnimate = g.userData.animate;                               // antenna bulb pulses
  g.userData.animate = (dt, time) => {
    baseAnimate(dt, time);
    bulb.scale.setScalar(1 + 0.15 * Math.sin(time * 5));
  };
  return g;
}

/** Everyone you can pick. color = name-label colour; jetZ = how far back the boost jet sits. */
export const ROSTER = [
  { id: 'kitten', name: 'KITTEN', icon: '🐱', color: COLORS.kitten, make: makeKitten, jetZ: 2.2 },
  { id: 'pony', name: 'PONY', icon: '🐴', color: COLORS.purple, make: makePony, jetZ: 2.6 },
  { id: 'piglet', name: 'PIGLET', icon: '🐷', color: '#E27D97', make: makePiglet, jetZ: 2.2 },
  { id: 'bunny', name: 'BUNNY', icon: '🐰', color: '#8E90A6', make: makeBunny, jetZ: 2.2 },
  { id: 'puppy', name: 'PUPPY', icon: '🐶', color: COLORS.puppy, make: makePuppy, jetZ: 2.2 },
  { id: 'robot', name: 'ROBOT', icon: '🤖', color: '#6F87A6', make: makeRobot, jetZ: 2.4 },
];

// Pink laser-jet boost flames out the back. Show with jet.visible = true.
export function makeJet() {
  const jet = new THREE.Group();
  const pink = new THREE.MeshBasicMaterial({ color: '#FF5FC8', transparent: true, opacity: 0.85 });
  const white = new THREE.MeshBasicMaterial({ color: '#FFE3F5' });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.2, 8), pink);
  flame.rotation.x = Math.PI / 2;          // tip points back (+Z)
  flame.position.z = 1.1;
  const core = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.4, 6), white);
  core.rotation.x = Math.PI / 2;
  core.position.z = 0.7;
  jet.add(flame, core);
  for (const x of [-0.55, 0.55]) {
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.5, 6), pink);
    beam.rotation.x = Math.PI / 2;
    beam.position.set(x, 0.1, 1.8);
    jet.add(beam);
  }
  jet.visible = false;
  return jet;
}
