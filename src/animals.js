// The two racers, built from simple faceted shapes (low-poly toy look, no textures).
// Both face -Z (away from the camera), belly down, arms spread in a breaststroke pose.
//   const kitten = makeKitten();  scene.add(kitten);
//   kitten.userData.stroke();            // start one swim-stroke animation
//   kitten.userData.animate(dt, time);   // every frame
import * as THREE from 'three';

export const COLORS = {
  sky: '#4FB3F6', cloud: '#F4F7FB', kitten: '#F28C28', pony: '#F6EAD2',
  purple: '#9B5BD6', red: '#D9443A', grass: '#6CC24A',
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
