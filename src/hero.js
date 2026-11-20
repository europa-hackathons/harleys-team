// Our flying hero: built from simple shapes, flies with the arrow keys, zips along web lines.
import * as THREE from 'three';
import { TOWN_HALF } from './town.js';

const COLORS = {
  suit: '#1FA39A', cape: '#F2635F', gloves: '#B57EDC', goggles: '#FFD45C',
  hair: '#6B3E26', skin: '#E8B48A', web: '#4FE3E0',
};

export const CRUISE_HEIGHT = 13;
const TURN_SPEED = 2.4;     // radians per second
const FAST = 17, BACK = -6, DRIFT = 3;

const lit = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });

function part(geometry, color, x, y, z, parent, extra) {
  const mesh = new THREE.Mesh(geometry, lit(color, extra));
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

// Builds the figure standing up (face toward +z), then tips it forward to fly.
function buildFigure() {
  const body = new THREE.Group();
  const limb = new THREE.CylinderGeometry(0.15, 0.13, 0.85, 6);

  // Legs and boots.
  for (const sx of [-0.16, 0.16]) {
    part(limb, COLORS.suit, sx, -0.55, 0, body);
    part(new THREE.CylinderGeometry(0.17, 0.18, 0.4, 6), COLORS.gloves, sx, -1.05, 0.02, body);
    part(new THREE.CylinderGeometry(0.18, 0.18, 0.07, 6), COLORS.goggles, sx, -0.85, 0.02, body);
  }
  // Body and belt.
  part(new THREE.CapsuleGeometry(0.3, 0.45, 2, 6), COLORS.suit, 0, 0.12, 0, body);
  part(new THREE.CylinderGeometry(0.33, 0.33, 0.1, 8), COLORS.goggles, 0, -0.14, 0, body);

  // Head, hair, bun, goggles.
  part(new THREE.IcosahedronGeometry(0.28, 1), COLORS.skin, 0, 0.75, 0.02, body);
  part(new THREE.IcosahedronGeometry(0.3, 1), COLORS.hair, 0, 0.82, -0.07, body);
  part(new THREE.IcosahedronGeometry(0.2, 1), COLORS.hair, 0, 0.95, -0.3, body);
  part(new THREE.CylinderGeometry(0.31, 0.31, 0.08, 10, 1, true), COLORS.goggles, 0, 0.76, 0, body, { side: THREE.DoubleSide });
  part(new THREE.BoxGeometry(0.46, 0.14, 0.1), COLORS.goggles, 0, 0.77, 0.27, body);

  // Right arm reaches forward (up, before tipping); left arm by her side.
  const reach = new THREE.Group();
  reach.position.set(0.36, 0.42, 0);
  reach.rotation.z = -0.25;
  part(limb, COLORS.suit, 0, 0.42, 0, reach);
  const hand = part(new THREE.IcosahedronGeometry(0.17, 0), COLORS.gloves, 0, 0.9, 0, reach);
  body.add(reach);
  const side = new THREE.Group();
  side.position.set(-0.36, 0.42, 0);
  side.rotation.z = -0.25;
  part(limb, COLORS.suit, 0, -0.42, 0, side);
  part(new THREE.IcosahedronGeometry(0.17, 0), COLORS.gloves, 0, -0.9, 0, side);
  body.add(side);

  // Cape hangs from the shoulders and flaps.
  const capePivot = new THREE.Group();
  capePivot.position.set(0, 0.45, -0.3);
  const capeGeo = new THREE.PlaneGeometry(0.95, 1.6, 1, 1);
  capeGeo.translate(0, -0.8, 0);
  capeGeo.rotateY(Math.PI); // lit side faces away from her back, so we see it from behind
  part(capeGeo, COLORS.cape, 0, 0, 0, capePivot, { side: THREE.DoubleSide });
  body.add(capePivot);

  return { body, hand, capePivot };
}

export function createHero(scene) {
  const root = new THREE.Group();
  const bank = new THREE.Group();
  const { body, hand, capePivot } = buildFigure();
  body.rotation.x = 1.3; // tip forward: head points where she flies
  body.scale.setScalar(1.6);
  bank.add(body);
  root.add(bank);
  scene.add(root);

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
    zip: null,      // { from, to, t, duration }
    webTimer: 0,
    time: 0,
    forward: new THREE.Vector3(0, 0, 1),

    reset() {
      root.position.set(0, CRUISE_HEIGHT, -TOWN_HALF + 4);
      this.yaw = 0; this.speed = 0; this.zip = null; this.webTimer = 0;
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

      if (this.zip) {
        const z = this.zip;
        z.t = Math.min(1, z.t + dt / z.duration);
        const e = 1 - (1 - z.t) * (1 - z.t); // ease out
        root.position.lerpVectors(z.from, z.to, e);
        root.position.y -= Math.sin(z.t * Math.PI) * 2.5; // swing dip
        const dx = z.to.x - z.from.x, dz = z.to.z - z.from.z;
        if (dx * dx + dz * dz > 0.01) this.yaw = lerpAngle(this.yaw, Math.atan2(dx, dz), 1 - Math.exp(-dt * 10));
        if (z.t >= 1) { this.zip = null; this.speed = 9; this.webTimer = 0.15; }
      } else {
        this.yaw += turn * TURN_SPEED * dt;
        const want = keys.ArrowUp ? FAST : keys.ArrowDown ? BACK : DRIFT;
        this.speed += (want - this.speed) * (1 - Math.exp(-dt * 3));
        this.forward.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
        root.position.addScaledVector(this.forward, this.speed * dt);
        root.position.y += (CRUISE_HEIGHT - root.position.y) * (1 - Math.exp(-dt * 1.5));
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
      capePivot.rotation.x = 0.15 + Math.min(this.speed, 15) * 0.015 + Math.sin(this.time * 12) * 0.12;

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
