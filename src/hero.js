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
// (it is turned -90 degrees to face +z in the game), y is up, and she is 1 unit tall, feet at y = -0.5.
// Tripo's paint is a bit rosy on her face, so a few face triangles land in the coral cape section:
// coral above NECK_Y goes back to skin. What is left of the coral section is the cape.
const NECK_Y = 0.16;
const CAPE_PIVOT = new THREE.Vector3(-0.03, 0.13, 0); // top of her back, where the cape hangs from
const EYES = { x: 0.135, y: 0.25, z: 0.05, r: 0.02 };  // her eyes are too small for the sculpt: simple shapes behind the goggles

// Splits a mesh's triangles in two by a test on each triangle's middle point.
function splitMesh(mesh, keepTest) {
  const geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
  const p = geo.attributes.position;
  const keep = [], move = [];
  for (let i = 0; i < p.count; i += 3) {
    const cy = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
    const out = keepTest(cy) ? keep : move;
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

// Fixes the rosy face and hangs the cape from a pivot so it can flap. Returns the cape pivot.
function setUpSculptedHero(model) {
  const sections = model.userData.sections;
  const capes = sections[COLORS.cape.toUpperCase()] || [];
  const skin = (sections[COLORS.skin.toUpperCase()] || [])[0];
  let pivot = null;
  for (const cape of capes) {
    const [low, high] = splitMesh(cape, (y) => y < NECK_Y);
    cape.geometry = low;
    if (high.attributes.position.count) {
      const face = new THREE.Mesh(high, skin ? skin.material : lit(COLORS.skin));
      face.position.copy(cape.position); face.quaternion.copy(cape.quaternion); face.scale.copy(cape.scale);
      cape.parent.add(face);
    }
    pivot ??= new THREE.Group();
    if (!pivot.parent) { pivot.position.copy(CAPE_PIVOT); cape.parent.add(pivot); }
    pivot.add(cape);
    cape.position.sub(CAPE_PIVOT);
  }
  // Two big brown eyes with a white sparkle, like the concept picture.
  const head = skin?.parent ?? pivot?.parent;
  if (head) for (const side of [-1, 1]) {
    const eye = part(ball(EYES.r), '#3B2A2A', EYES.x, EYES.y, side * EYES.z, head);
    eye.scale.set(0.6, 1.3, 1);
    part(ball(EYES.r * 0.35, 6, 4), '#FFFFFF', EYES.x + EYES.r * 0.5, EYES.y + EYES.r * 0.5, side * EYES.z + EYES.r * 0.3, head);
  }
  return pivot;
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
export function createHero(scene, floorAt = () => 7) {
  const root = new THREE.Group();
  const bank = new THREE.Group();
  const { body, hand, capePivot } = buildFigure();
  body.rotation.x = 1.3; // tip forward: head points where she flies
  body.scale.setScalar(1.6);
  bank.add(body);
  root.add(bank);
  scene.add(root);

  // Swap in the sculpted 3D hero once it has loaded; the simple-shape figure stays if it fails.
  // Her own coral cape section flaps; the web hand anchor stays from the simple figure (invisible).
  let sculptedCape = null;
  loadModel('hero', { height: 2.7, rotationY: -Math.PI / 2 }).then((model) => {
    sculptedCape = setUpSculptedHero(model);
    model.position.y = -1.3;            // feet at the same spot as the simple figure's boots
    const keep = new Set([hand.parent]);
    for (const child of [...body.children]) if (!keep.has(child)) body.remove(child);
    hand.parent.traverse((o) => { if (o.isMesh) o.visible = false; }); // invisible anchor near her hand
    body.add(model);
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
    forward: new THREE.Vector3(0, 0, 1),

    reset() {
      root.position.set(0, CRUISE_HEIGHT, -TOWN_HALF + 4);
      this.yaw = 0; this.speed = 0; this.climb = 0; this.zip = null; this.webTimer = 0;
      web.visible = webEnd.visible = false;
    },

    get zipping() { return !!this.zip; },

    // Start a web-zip toward a point (a chimney top).
    shootWeb(target) {
      const to = target.clone().add(new THREE.Vector3(0, 2.2, 0));
      const dist = root.position.distanceTo(to);
      this.zip = { from: root.position.clone(), to, t: 0, duration: THREE.MathUtils.clamp(dist / 32, 0.35, 1.2), target: target.clone() };
      this.webTimer = 0;
    },

    update(dt, keys) {
      this.time += dt;
      const turn = (keys.ArrowLeft ? 1 : 0) - (keys.ArrowRight ? 1 : 0);
      const upDown = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);

      if (this.zip) {
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
        if (p.y < floor) {
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
      bank.rotation.z += (-turn * 0.5 - bank.rotation.z) * (1 - Math.exp(-dt * 6));
      body.position.y = Math.sin(this.time * 3) * 0.15;
      // Nose up while climbing, nose down while diving.
      const pitch = this.zip ? 0 : -this.climb / CLIMB_SPEED * 0.4;
      body.rotation.x += (1.3 + pitch - body.rotation.x) * (1 - Math.exp(-dt * 6));
      const flap = 0.2 + Math.min(this.speed, 15) * 0.015 + Math.sin(this.time * 12) * 0.12;
      capePivot.rotation.x = flap;
      if (sculptedCape) sculptedCape.rotation.z = -flap; // her model's back is -x, so it swings round z

      // Web line from her hand to the target while zipping (and a blink after).
      const showWeb = this.zip || this.webTimer > 0;
      this.webTimer = Math.max(0, this.webTimer - dt);
      web.visible = webEnd.visible = !!showWeb;
      if (showWeb && (this.zip || this.lastTarget)) {
        const target = this.zip ? this.zip.target : this.lastTarget;
        this.lastTarget = target;
        const start = hand.getWorldPosition(new THREE.Vector3());
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
