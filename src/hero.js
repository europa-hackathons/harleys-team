// Our flying hero: built from simple shapes, flies with the arrow keys, zips along web lines.
import * as THREE from 'three';
import { TOWN_HALF } from './town.js';
import { loadModel } from './models.js';

const COLORS = {
  suit: '#1FA39A', cape: '#F2635F', gloves: '#B57EDC', goggles: '#FFD45C',
  hair: '#6B3E26', skin: '#E8B48A', web: '#4FE3E0',
};

export const CRUISE_HEIGHT = 13;
export const MAX_HEIGHT = CRUISE_HEIGHT * 3;
const CLIMB_SPEED = 11;     // units per second going up (W) or down (S)
const TURN_SPEED = 2.4;     // radians per second
const FAST = 17, BACK = -6, DRIFT = 3;
// On the ground: walking is much slower than flying.
const WALK = 3.6, WALK_BACK = -2, WALK_TURN = 2.2;
const STRIDE = 3.3;      // leg swing per unit walked (short legs take quick steps)
const HERO_SCALE = 0.75; // about door-and-a-bit tall (doors are 1.6)
const FEET = 1.3 * HERO_SCALE;  // from her middle (root) down to her boot soles when standing up
const STEP = 0.6;        // she can step up onto things this high; taller things block her
const BODY_RADIUS = 0.35; // how close her middle gets to a wall, lamp post or tree trunk

const lit = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });

function part(geometry, color, x, y, z, parent, extra) {
  const mesh = new THREE.Mesh(geometry, lit(color, extra));
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

const ball = (r, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);

// A mitten glove: puffy cuff, round palm and a little thumb. dir is +1 (points up) or -1 (points down).
function mitten(parent, y, dir) {
  part(new THREE.CylinderGeometry(0.15, 0.13, 0.12, 8), COLORS.gloves, 0, y - dir * 0.08, 0, parent);
  const palm = part(ball(0.15), COLORS.gloves, 0, y + dir * 0.06, 0, parent);
  palm.scale.set(1, 1.2, 0.75);
  part(ball(0.065, 8, 6), COLORS.gloves, 0.12, y + dir * 0.02, 0.04, parent);
  return palm;
}

// A cape that is narrow at the shoulders, wide at the hem, curled round her back and a bit wavy.
function capeGeometry() {
  const W = 1.15, H = 1.35;
  const geo = new THREE.PlaneGeometry(W, H, 6, 6);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = 0.5 - p.getY(i) / H;             // 0 at the collar, 1 at the hem
    const u = p.getX(i) / (W / 2);              // -1 .. 1 across
    const x = u * (0.34 + 0.5 * t);             // fans out toward the hem
    const z = (1 - u * u) * -0.18 + 0.12 * Math.sin(t * 5 + u * 2) * t; // curls round her, ripples lower down
    p.setXYZ(i, x, -t * H, z);
  }
  geo.computeVertexNormals();
  return geo;
}

// The sculpted hero comes in colour sections (see src/models.js). Her model's own +x is her front
// (it is turned -90 degrees to face +z in the game), y is up, +z is her right side, and she is
// 1 unit tall, feet at y = -0.5.
// Tripo's paint is a bit rosy on her face, so a few face triangles land in the coral cape section:
// coral above NECK_Y goes back to skin. The coral at her back is both her cape AND the skin of her
// back, so it stays in place as a teal back patch while a copy of it flaps as the cape.
// The coral in front of BACK_X is the cape's ties at her collar; they stay put.
const NECK_Y = 0.16;
const BACK_X = 0.06;
const CAPE_PIVOT = new THREE.Vector3(-0.03, 0.13, 0); // top of her back, where the cape hangs from
const EYES = { x: 0.135, y: 0.25, z: 0.05, r: 0.02 };  // her eyes are too small for the sculpt: simple shapes behind the goggles
// Her right arm (sleeve + glove) swings from the shoulder to reach out in front while flying forward.
// The left arm is the mirror image; both swing a little when she walks.
const SHOULDER = new THREE.Vector3(0.04, 0.04, 0.11);
const LEFT_SHOULDER = new THREE.Vector3(0.04, 0.04, -0.11);
const isRightArm = (x, y, z) => z > 0.12 && y > -0.2 && y < 0.075;
const isLeftArm = (x, y, z) => isRightArm(x, y, -z);
const SHOULDER_CAP = 0.045; // arm triangles this close to the shoulder also stay put, so no hole opens
const FIST = new THREE.Vector3(0.07, -0.13, 0.25); // middle of her glove, where the web shoots from
const REACH = { up: 1.85, forward: 0.3 };          // how far her arm swings (radians) when reaching
// Her legs swing from hip pivots when she walks. Below HIP_Y and between her hands, triangles on her
// right side (+z) are her right leg, the rest her left leg. Bits close to the hip stay put (no holes).
const HIP_Y = -0.19;
const HIPS = [new THREE.Vector3(0.04, -0.17, -0.065), new THREE.Vector3(0.04, -0.17, 0.065)]; // left, right
const isLeg = (x, y, z) => y < HIP_Y && Math.abs(z) < 0.2;
const HIP_CAP = 0.035;

// Splits a mesh's triangles in two by a test on each triangle's middle point (x, y, z).
function splitMesh(mesh, keepTest) {
  const geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
  const p = geo.attributes.position;
  const keep = [], move = [];
  for (let i = 0; i < p.count; i += 3) {
    const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3;
    const cy = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
    const cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
    const out = keepTest(cx, cy, cz) ? keep : move;
    for (let k = 0; k < 3; k++) out.push(p.getX(i + k), p.getY(i + k), p.getZ(i + k));
  }
  const make = (arr) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    g.computeVertexNormals();
    return g;
  };
  return [make(keep), make(move)];
}

// A new mesh placed exactly like `like`, added to `parent` (moved by -origin when that is a pivot).
function twin(geometry, material, like, parent = like.parent, origin = null) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(like.position); mesh.quaternion.copy(like.quaternion); mesh.scale.copy(like.scale);
  if (origin) mesh.position.sub(origin);
  parent.add(mesh);
  return mesh;
}

// Joins the triangles of two non-indexed geometries into one.
function mergeTriangles(a, b) {
  const pa = a.attributes.position.array, pb = b.attributes.position.array;
  const all = new Float32Array(pa.length + pb.length);
  all.set(pa); all.set(pb, pa.length);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(all, 3));
  g.computeVertexNormals();
  return g;
}

// Moves the triangles that pass `test` (from every section but the cape) onto a new pivot at `point`.
// Those within `cap` of the pivot also stay behind, so no hole opens when the part swings.
function splitOntoPivot(sections, skip, inner, point, test, cap) {
  const pivot = new THREE.Group();
  pivot.position.copy(point);
  inner.add(pivot);
  for (const [color, meshes] of Object.entries(sections)) {
    if (color === skip) continue;
    for (const mesh of meshes) {
      const [body, moved] = splitMesh(mesh, (x, y, z) => !test(x, y, z));
      if (!moved.attributes.position.count) continue;
      const [stay] = splitMesh({ geometry: moved }, (x, y, z) => Math.hypot(x - point.x, y - point.y, z - point.z) < cap);
      mesh.geometry = mergeTriangles(body, stay);
      twin(moved, mesh.material, mesh, pivot, point);
    }
  }
  return pivot;
}

// Fixes the rosy face, hangs the cape from a pivot so it can flap, puts her arms on shoulder pivots
// (the right one reaches forward) and her legs on hip pivots so she can walk.
// Returns { cape, arm, leftArm, legs, fist } (empty if something is missing).
function setUpSculptedHero(model) {
  const sections = model.userData.sections;
  const coral = COLORS.cape.toUpperCase();
  const capes = sections[coral] || [];
  const skin = (sections[COLORS.skin.toUpperCase()] || [])[0];
  const suit = (sections[COLORS.suit.toUpperCase()] || [])[0];
  const inner = (capes[0] || skin)?.parent;
  if (!inner) return {};
  const pivotAt = (point) => { const g = new THREE.Group(); g.position.copy(point); inner.add(g); return g; };
  const suitMat = suit ? suit.material : lit(COLORS.suit);

  // Her arms: sleeve and glove triangles move onto shoulder pivots, each with a round teal shoulder.
  const arm = splitOntoPivot(sections, coral, inner, SHOULDER, isRightArm, SHOULDER_CAP);
  const leftArm = splitOntoPivot(sections, coral, inner, LEFT_SHOULDER, isLeftArm, SHOULDER_CAP);
  for (const a of [arm, leftArm]) part(ball(0.042), COLORS.suit, 0, 0, 0, a).material = suitMat;
  const fist = new THREE.Object3D();
  fist.position.copy(FIST).sub(SHOULDER);
  arm.add(fist);

  // The cape: face bits go back to skin, collar ties stay, her back gets a teal patch,
  // and a copy of the back coral, a hair bigger, flaps from the pivot.
  let cape = null;
  for (const mesh of capes.slice()) {
    const [low, high] = splitMesh(mesh, (x, y) => y < NECK_Y);
    if (high.attributes.position.count) twin(high, skin ? skin.material : lit(COLORS.skin), mesh);
    const [back, ties] = splitMesh({ geometry: low }, (x) => x < BACK_X);
    mesh.geometry = ties;
    twin(back, suit ? suit.material : lit(COLORS.suit), mesh);
    if (!cape) { cape = pivotAt(CAPE_PIVOT); cape.scale.setScalar(1.05); }
    mesh.material.side = THREE.DoubleSide;
    capes.push(twin(back.clone(), mesh.material, mesh, cape, CAPE_PIVOT));
  }

  // Her legs (after the cape, so the teal back patch below her hips walks along with them).
  // The new back patch is not in `sections` yet, so look at every mesh straight inside `inner`.
  const legSections = { all: inner.children.filter((o) => o.isMesh) };
  const legs = HIPS.map((hip) => {
    const side = Math.sign(hip.z);
    const leg = splitOntoPivot(legSections, null, inner, hip, (x, y, z) => isLeg(x, y, z) && Math.sign(z || 1) === side, HIP_CAP);
    part(ball(0.05), COLORS.suit, 0, -0.01, 0, leg).material = suitMat; // round hip, hides the cut
    return leg;
  });

  // Two big brown eyes with a white sparkle, like the concept picture.
  for (const side of [-1, 1]) {
    const eye = part(ball(EYES.r), '#3B2A2A', EYES.x, EYES.y, side * EYES.z, inner);
    eye.scale.set(0.6, 1.3, 1);
    part(ball(EYES.r * 0.35, 6, 4), '#FFFFFF', EYES.x + EYES.r * 0.5, EYES.y + EYES.r * 0.5, side * EYES.z + EYES.r * 0.3, inner);
  }
  return { cape, arm, leftArm, legs, fist };
}

// Builds the figure standing up (face toward +z), then tips it forward to fly.
function buildFigure() {
  const body = new THREE.Group();
  const dark = '#2B1E2E', cheek = '#F49A9A', smile = '#8A3B3B';

  // Legs, boots with yellow bands and round toes.
  for (const sx of [-0.15, 0.15]) {
    part(new THREE.CylinderGeometry(0.16, 0.13, 0.75, 8), COLORS.suit, sx, -0.5, 0, body);
    part(new THREE.CylinderGeometry(0.16, 0.18, 0.38, 8), COLORS.gloves, sx, -1.03, 0, body);
    part(new THREE.CylinderGeometry(0.185, 0.185, 0.08, 8), COLORS.goggles, sx, -0.84, 0, body);
    part(ball(0.17), COLORS.gloves, sx, -1.2, 0.06, body).scale.set(1, 0.6, 1.3);
  }

  // Rounded torso, hips and a gold belt with a little star-button emblem.
  part(ball(0.3), COLORS.suit, 0, -0.12, 0, body).scale.set(1.05, 0.8, 0.85);
  part(new THREE.CapsuleGeometry(0.29, 0.38, 4, 10), COLORS.suit, 0, 0.18, 0, body).scale.set(1.08, 1, 0.85);
  part(new THREE.CylinderGeometry(0.315, 0.315, 0.09, 12), COLORS.goggles, 0, -0.06, 0, body).scale.set(1, 1, 0.85);
  const emblem = part(new THREE.CylinderGeometry(0.075, 0.075, 0.04, 6), COLORS.cape, 0, -0.06, 0.27, body);
  emblem.rotation.x = Math.PI / 2;
  // Round shoulders.
  for (const sx of [-0.32, 0.32]) part(ball(0.14), COLORS.suit, sx, 0.4, 0, body);

  // Head: round face with eyes, rosy cheeks and a smile.
  const headY = 0.84;
  part(new THREE.CylinderGeometry(0.1, 0.12, 0.14, 8), COLORS.skin, 0, 0.58, 0, body);
  part(ball(0.32, 14, 10), COLORS.skin, 0, headY, 0.02, body);
  for (const sx of [-0.11, 0.11]) {
    part(ball(0.045, 8, 6), dark, sx, headY + 0.01, 0.315, body).scale.set(0.9, 1.2, 0.6);
    part(ball(0.055, 8, 6), cheek, sx * 1.55, headY - 0.07, 0.27, body).scale.set(1, 0.7, 0.4);
  }
  const grin = part(new THREE.TorusGeometry(0.07, 0.016, 4, 10, Math.PI), smile, 0, headY - 0.08, 0.32, body);
  grin.rotation.z = Math.PI; // a U shape

  // Warm brown hair over the back and top, a side fringe, and a big fluffy bun.
  part(ball(0.34, 14, 10), COLORS.hair, 0, headY + 0.06, -0.07, body);
  part(ball(0.16, 10, 8), COLORS.hair, -0.12, headY + 0.24, 0.12, body).scale.set(1.3, 0.6, 1);
  part(ball(0.13, 10, 8), COLORS.hair, 0.14, headY + 0.25, 0.1, body).scale.set(1.2, 0.6, 1);
  part(ball(0.23, 12, 9), COLORS.hair, 0, headY + 0.34, -0.2, body);
  part(new THREE.TorusGeometry(0.17, 0.035, 6, 12), COLORS.hair, 0, headY + 0.24, -0.15, body).rotation.x = Math.PI / 2 - 0.5;

  // Chunky goggles pushed up on her forehead: strap, two yellow rims, teal lenses.
  const goggles = new THREE.Group();
  goggles.position.set(0, headY + 0.15, 0);
  goggles.rotation.x = -0.5;
  part(new THREE.CylinderGeometry(0.335, 0.335, 0.06, 14, 1, true), COLORS.goggles, 0, 0, -0.03, goggles, { side: THREE.DoubleSide });
  for (const sx of [-0.11, 0.11]) {
    part(new THREE.TorusGeometry(0.085, 0.03, 6, 12), COLORS.goggles, sx, 0.0, 0.27, goggles);
    part(new THREE.CylinderGeometry(0.075, 0.075, 0.03, 12), COLORS.suit, sx, 0.0, 0.26, goggles).rotation.x = Math.PI / 2;
  }
  body.add(goggles);

  // Right arm reaches forward (up, before tipping); left arm by her side.
  const arm = new THREE.CylinderGeometry(0.12, 0.1, 0.6, 8);
  const reach = new THREE.Group();
  reach.position.set(0.34, 0.42, 0);
  reach.rotation.z = -0.25;
  part(arm, COLORS.suit, 0, 0.32, 0, reach);
  const hand = mitten(reach, 0.75, 1);
  body.add(reach);
  const side = new THREE.Group();
  side.position.set(-0.34, 0.42, 0);
  side.rotation.z = -0.25;
  part(arm, COLORS.suit, 0, -0.32, 0, side);
  mitten(side, -0.75, -1);
  body.add(side);

  // Swooshy cape tied at the shoulders, with a little collar; it flaps from the pivot.
  const capePivot = new THREE.Group();
  capePivot.position.set(0, 0.47, -0.2);
  part(capeGeometry(), COLORS.cape, 0, 0, 0, capePivot, { side: THREE.DoubleSide });
  body.add(capePivot);
  const collar = part(new THREE.TorusGeometry(0.22, 0.05, 6, 12, Math.PI), COLORS.cape, 0, 0.5, -0.02, body);
  collar.rotation.set(Math.PI / 2, 0, Math.PI);
  for (const sx of [-0.2, 0.2]) part(ball(0.06, 8, 6), COLORS.goggles, sx * 0.8, 0.52, 0.2, body);

  return { body, hand, capePivot };
}

// floorAt(x, z) tells her the lowest safe height at a spot (just above roofs and chimneys).
// surfaceAt(x, z) tells her what she would stand on there (ground 0, a roof, a chimney top).
// onLand(feetPosition) is called when she touches down, e.g. for a dust puff.
// solidAt(x, z) is like surfaceAt but also counts lamp posts, tree trunks and crates (for walking).
export function createHero(scene, floorAt = () => 7, { surfaceAt = () => 0, solidAt = surfaceAt, onLand = () => {} } = {}) {
  const root = new THREE.Group();
  const bank = new THREE.Group();
  const { body, hand, capePivot } = buildFigure();
  body.rotation.x = 1.3; // tip forward: head points where she flies
  body.scale.setScalar(HERO_SCALE);
  bank.add(body);
  root.add(bank);
  scene.add(root);
  const castShadows = (obj) => obj.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  castShadows(body);

  // Swap in the sculpted 3D hero once it has loaded; the simple-shape figure stays if it fails.
  // Her own coral cape flaps, her right arm reaches forward, and the web shoots from her fist.
  let sculpted = {};
  let webHand = hand;
  loadModel('hero', { height: 2.7, rotationY: -Math.PI / 2 }).then((model) => {
    sculpted = setUpSculptedHero(model);
    if (sculpted.fist) webHand = sculpted.fist;
    model.position.y = -1.3;            // feet at the same spot as the simple figure's boots
    const keep = new Set([hand.parent]);
    for (const child of [...body.children]) if (!keep.has(child)) body.remove(child);
    hand.parent.traverse((o) => { if (o.isMesh) o.visible = false; }); // invisible anchor near her hand
    body.add(model);
    castShadows(model); // the sculpt, its flapping cape and its arm and leg pieces
  }).catch((e) => console.warn('Sculpted hero did not load, keeping the simple one.', e));

  // The web line: a thin glowing stick plus a blob at the end.
  const webMat = new THREE.MeshBasicMaterial({ color: COLORS.web });
  const webGeo = new THREE.CylinderGeometry(0.07, 0.07, 1, 6);
  webGeo.translate(0, 0.5, 0);
  webGeo.rotateX(Math.PI / 2); // now points along +z from its start
  const web = new THREE.Mesh(webGeo, webMat);
  const webEnd = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 1), webMat);
  web.visible = webEnd.visible = false;
  scene.add(web, webEnd);

  const hero = {
    root,
    yaw: 0,
    speed: 0,
    climb: 0,       // up/down speed
    zip: null,      // { from, to, t, duration }
    webTimer: 0,
    time: 0,
    reach: 0,       // 0 = right arm down, 1 = reaching out in front
    armSwing: 0,
    mode: 'fly',    // 'fly', 'landing' (gently dropping) or 'walk' (on her feet)
    fall: 0,        // falling speed after walking off a roof
    liftoff: 0,     // seconds of soft take-off left (she rises smoothly instead of snapping up)
    stride: 0,      // walk cycle
    forward: new THREE.Vector3(0, 0, 1),

    reset() {
      root.position.set(0, CRUISE_HEIGHT, -TOWN_HALF + 4);
      this.yaw = 0; this.speed = 0; this.climb = 0; this.zip = null; this.webTimer = 0;
      this.mode = 'fly'; this.fall = 0; this.liftoff = 0; this.stride = 0;
      web.visible = webEnd.visible = false;
    },

    get zipping() { return !!this.zip; },
    // True while landing or walking.
    get onGround() { return this.mode !== 'fly'; },

    // W on the ground (or Space with no chimney in front): a little hop back up into the sky.
    takeOff() {
      if (this.mode === 'fly') return;
      this.mode = 'fly';
      this.climb = CLIMB_SPEED * 1.3;
      this.speed = Math.max(this.speed, 2);
      this.liftoff = 0.8;
      this.fall = 0;
    },

    // Steps along the ground; walls and anything taller than a step stop her (she slides along them).
    // Checks her middle and a point BODY_RADIUS ahead, so her nose doesn't poke into walls.
    walkStep(dx, dz) {
      const p = root.position, feet = p.y - FEET;
      const ok = (mx, mz) => {
        const len = Math.hypot(mx, mz);
        if (len < 1e-6) return true;
        const x = p.x + mx, z = p.z + mz;
        return solidAt(x, z) <= feet + STEP && solidAt(x + mx / len * BODY_RADIUS, z + mz / len * BODY_RADIUS) <= feet + STEP;
      };
      if (ok(dx, dz)) { p.x += dx; p.z += dz; }
      else if (ok(dx, 0)) p.x += dx;
      else if (ok(0, dz)) p.z += dz;
    },

    // Start a web-zip toward a point (a chimney top).
    shootWeb(target) {
      const to = target.clone().add(new THREE.Vector3(0, 1.6, 0)); // just above the chimney rim
      const dist = root.position.distanceTo(to);
      this.mode = 'fly'; this.fall = 0; this.liftoff = 0; // also zips her up from the ground
      this.zip = { from: root.position.clone(), to, t: 0, duration: THREE.MathUtils.clamp(dist / 32, 0.35, 1.2), target: target.clone() };
      this.webTimer = 0;
    },

    update(dt, keys) {
      this.time += dt;
      const turn = (keys.ArrowLeft ? 1 : 0) - (keys.ArrowRight ? 1 : 0);
      const upDown = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);

      if (this.mode === 'fly' && keys.KeyS && !this.zip && this.liftoff <= 0) {
        // Holding S at her lowest flying height: time to land.
        const p = root.position;
        const floor = Math.max(floorAt(p.x, p.z), floorAt(p.x + this.forward.x * 4, p.z + this.forward.z * 4));
        if (p.y < floor + 0.3) { this.mode = 'landing'; this.climb = 0; }
      }
      if (this.mode !== 'fly' && keys.KeyW) this.takeOff();

      if (this.mode !== 'fly') {
        const walking = this.mode === 'walk';
        this.yaw += turn * (walking ? WALK_TURN : TURN_SPEED) * dt;
        const want = !walking ? 0 : keys.ArrowUp ? WALK : keys.ArrowDown ? WALK_BACK : 0;
        this.speed += (want - this.speed) * (1 - Math.exp(-dt * (walking ? 8 : 2.5)));
        this.forward.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
        this.walkStep(this.forward.x * this.speed * dt, this.forward.z * this.speed * dt);
        const p = root.position;
        const ground = surfaceAt(p.x, p.z) + FEET;
        if (!walking) {
          // Gently float down onto whatever is under her.
          const drop = THREE.MathUtils.clamp((p.y - ground) * 2.2, 1.5, 9) * dt;
          p.y = Math.max(ground, p.y - drop);
          if (p.y < ground + 0.02) {
            p.y = ground; this.mode = 'walk'; this.fall = 0;
            onLand(new THREE.Vector3(p.x, p.y - FEET, p.z));
          }
        } else if (p.y > ground + 0.01) {
          // Walked off a roof: fall down, with a soft plop at the bottom.
          this.fall += 25 * dt;
          p.y = Math.max(ground, p.y - this.fall * dt);
          if (p.y === ground) { if (this.fall > 8) onLand(new THREE.Vector3(p.x, p.y - FEET, p.z)); this.fall = 0; }
        } else {
          p.y += (ground - p.y) * (1 - Math.exp(-dt * 20)); // stepping up
          this.fall = 0;
        }
        this.stride += this.speed * dt * STRIDE;
      } else if (this.zip) {
        const z = this.zip;
        z.t = Math.min(1, z.t + dt / z.duration);
        const e = 1 - (1 - z.t) * (1 - z.t); // ease out
        root.position.lerpVectors(z.from, z.to, e);
        root.position.y -= Math.sin(z.t * Math.PI) * 2.5; // swing dip
        const dx = z.to.x - z.from.x, dz = z.to.z - z.from.z;
        if (dx * dx + dz * dz > 0.01) this.yaw = lerpAngle(this.yaw, Math.atan2(dx, dz), 1 - Math.exp(-dt * 10));
        if (z.t >= 1) { this.zip = null; this.speed = 9; this.climb = 0; this.webTimer = 0.15; } // keeps her new height
      } else {
        this.yaw += turn * TURN_SPEED * dt;
        const want = keys.ArrowUp ? FAST : keys.ArrowDown ? BACK : DRIFT;
        this.speed += (want - this.speed) * (1 - Math.exp(-dt * 3));
        this.forward.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
        root.position.addScaledVector(this.forward, this.speed * dt);
        // W/S: smooth climb and dive, between just above the roofs and high over the town.
        this.climb += (upDown * CLIMB_SPEED - this.climb) * (1 - Math.exp(-dt * 4));
        root.position.y += this.climb * dt;
        if (root.position.y > MAX_HEIGHT) { root.position.y = MAX_HEIGHT; this.climb = Math.min(this.climb, 0); }
        // Look a little ahead too, so she rises over a house before she reaches it.
        const p = root.position;
        const floor = Math.max(floorAt(p.x, p.z), floorAt(p.x + this.forward.x * 4, p.z + this.forward.z * 4));
        if (this.liftoff > 0) {
          // Just took off from the ground: rise smoothly, but never into a wall or roof.
          this.liftoff -= dt;
          p.y = Math.max(p.y, surfaceAt(p.x, p.z) + FEET);
          if (p.y < floor) this.climb = Math.max(this.climb, CLIMB_SPEED);
        } else if (p.y < floor) {
          p.y += (floor - p.y) * (1 - Math.exp(-dt * 12));
          if (p.y < floor - 1) p.y = floor - 1; // never sink into a roof
          this.climb = Math.max(this.climb, 0);
        }
      }
      this.forward.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));

      // Gently push back if she flies past the edge of town.
      for (const axis of ['x', 'z']) {
        const v = root.position[axis];
        if (Math.abs(v) > TOWN_HALF + 6) root.position[axis] = Math.sign(v) * (TOWN_HALF + 6);
      }

      root.rotation.y = this.yaw;
      const standing = this.mode !== 'fly';
      const ease = (rate) => 1 - Math.exp(-dt * rate);
      // Walking: legs and arms swing, she bobs and waddles a little.
      const walkAmount = this.mode === 'walk' ? Math.min(1, Math.abs(this.speed) / WALK) : 0;
      const swing = Math.sin(this.stride) * 0.6 * walkAmount;
      const waddle = Math.sin(this.stride) * 0.06 * walkAmount;
      bank.rotation.z += ((standing ? waddle : -turn * 0.5) - bank.rotation.z) * ease(standing ? 12 : 6);
      const bob = standing ? Math.abs(Math.cos(this.stride)) * 0.1 * walkAmount : Math.sin(this.time * 3) * 0.15;
      body.position.y += (bob - body.position.y) * ease(15);
      // Nose up while climbing, nose down while diving; upright on her feet.
      const pitch = this.zip ? 0 : -this.climb / CLIMB_SPEED * 0.4;
      body.rotation.x += ((standing ? 0 : 1.3 + pitch) - body.rotation.x) * ease(standing ? 5 : 6);
      const flap = standing
        ? 0.08 + Math.abs(this.speed) * 0.03 + Math.sin(this.time * 5) * 0.04
        : 0.2 + Math.min(this.speed, 15) * 0.015 + Math.sin(this.time * 12) * 0.12;
      capePivot.rotation.x = flap;
      if (sculpted.cape) sculpted.cape.rotation.z = -flap; // her model's back is -x, so it swings round z
      // Hold forward while flying: her right arm eases out in front of her, like a flying superhero.
      this.reach += ((keys.ArrowUp && !this.zip && !standing ? 1 : 0) - this.reach) * ease(7);
      this.armSwing += (swing * 0.6 - this.armSwing) * ease(15);
      if (sculpted.arm) {
        const r = this.reach * this.reach * (3 - 2 * this.reach); // smooth start and stop
        sculpted.arm.rotation.set(0, 0, 0);
        sculpted.arm.rotateX(-REACH.up * r);     // swing up past her head
        sculpted.arm.rotateZ(REACH.forward * r + this.armSwing); // a little toward her front (and walk swing)
      }
      // Her model's front is +x, so turning round z swings a leg or arm forward and back,
      // each arm opposite its leg.
      if (sculpted.leftArm) sculpted.leftArm.rotation.z = -this.armSwing;
      if (sculpted.legs) {
        const [left, right] = sculpted.legs;
        left.rotation.z += (swing - left.rotation.z) * ease(15);
        right.rotation.z += (-swing - right.rotation.z) * ease(15);
      }

      // Web line from her hand to the target while zipping (and a blink after).
      const showWeb = this.zip || this.webTimer > 0;
      this.webTimer = Math.max(0, this.webTimer - dt);
      web.visible = webEnd.visible = !!showWeb;
      if (showWeb && (this.zip || this.lastTarget)) {
        const target = this.zip ? this.zip.target : this.lastTarget;
        this.lastTarget = target;
        const start = webHand.getWorldPosition(new THREE.Vector3());
        web.position.copy(start);
        web.lookAt(target);
        web.scale.set(1, 1, start.distanceTo(target));
        webEnd.position.copy(target);
      }
    },
  };
  hero.reset();
  return hero;
}

function lerpAngle(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
