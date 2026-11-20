// Puffy low-poly clouds drifting above the town, tinted by the sky.
// Fly into one and a rainbow bursts out of it, with a little sparkle.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TOWN_HALF } from './town.js';
import { CRUISE_HEIGHT, MAX_HEIGHT } from './hero.js';

const CLOUD_COUNT = 13;
const WIND = new THREE.Vector3(1.2, 0, 0.4); // slow drift, units per second
const WRAP = TOWN_HALF + 25; // clouds that drift past this come back on the other side
const RAINBOW_SECONDS = 2.2;
const COOLDOWN_SECONDS = 5;
const RAINBOW_COLORS = ['#FF5A5F', '#FF9F43', '#FFD45C', '#7BD66B', '#4FE3E0', '#5B7CFA', '#B57EDC'];

const rand = (a, b) => a + Math.random() * (b - a);
const WHITE = new THREE.Color('#FFFFFF');

// One cloud: a few flattened icosphere puffs merged into one mesh.
function makeCloudGeometry() {
  const parts = [];
  const n = 4 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const r = i === 0 ? 2.6 : rand(1.5, 2.3);
    const g = new THREE.IcosahedronGeometry(r, 1);
    g.scale(1, 0.65, 1);
    const x = i === 0 ? 0 : rand(-3.2, 3.2);
    g.translate(x, rand(0, 0.8) - Math.abs(x) * 0.15, rand(-1.2, 1.2));
    parts.push(g);
  }
  const merged = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());
  merged.computeVertexNormals();
  return merged;
}

// Rainbow stripes: half-rings, biggest (red) outside.
const STRIPE = 0.42;
const STRIPE_GEOS = RAINBOW_COLORS.map((_, i) => new THREE.TorusGeometry(5 - i * STRIPE, STRIPE * 0.55, 5, 24, Math.PI));

function makeRainbow(scene) {
  const group = new THREE.Group();
  const materials = RAINBOW_COLORS.map((color, i) => {
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide, fog: false });
    group.add(new THREE.Mesh(STRIPE_GEOS[i], m));
    return m;
  });
  group.visible = false;
  scene.add(group);
  return { group, materials, life: 0 };
}

export function createClouds(scene, effects) {
  const material = new THREE.MeshLambertMaterial({ color: '#FFFFFF', flatShading: true, emissive: new THREE.Color() });
  const clouds = [];
  for (let i = 0; i < CLOUD_COUNT; i++) {
    const mesh = new THREE.Mesh(makeCloudGeometry(), material);
    const s = rand(1, 1.6);
    mesh.scale.set(s, s, s);
    mesh.rotation.y = rand(0, Math.PI);
    mesh.position.set(rand(-WRAP, WRAP), rand(CRUISE_HEIGHT + 6, MAX_HEIGHT - 4), rand(-WRAP, WRAP));
    mesh.castShadow = true; // a cloud shadow drifting over the roofs
    scene.add(mesh);
    // Touch zone: an ellipsoid around the cloud's middle.
    clouds.push({ mesh, rx: 4.5 * s, ry: 2.2 * s, cooldown: 0, rainbow: null });
  }

  function fire(cloud, camera) {
    if (!cloud.rainbow) cloud.rainbow = makeRainbow(scene);
    const rb = cloud.rainbow;
    rb.life = 0;
    rb.group.visible = true;
    rb.group.position.copy(cloud.mesh.position);
    // Face the camera (stand upright, turned towards it).
    rb.group.lookAt(camera.position.x, rb.group.position.y, camera.position.z);
    cloud.cooldown = COOLDOWN_SECONDS;
    effects.burst(cloud.mesh.position.clone().add(new THREE.Vector3(0, 2, 0)), ['sparkle', 'star', 'sparkle', 'heart'], 16, 7);
  }

  // heroPos: the hero's position, or null when she can't touch clouds (title screen).
  function update(dt, heroPos, camera) {
    // Tint: mostly white, coloured by the sky's fog colour (pink-orange at dusk/dawn, lavender at night).
    if (scene.fog) {
      material.color.copy(WHITE).lerp(scene.fog.color, 0.45);
      material.emissive.copy(scene.fog.color).multiplyScalar(0.35);
    }
    for (const c of clouds) {
      const p = c.mesh.position;
      p.addScaledVector(WIND, dt);
      if (p.x > WRAP) p.x -= WRAP * 2;
      if (p.z > WRAP) p.z -= WRAP * 2;
      c.cooldown = Math.max(0, c.cooldown - dt);
      if (heroPos && c.cooldown === 0) {
        const dx = (heroPos.x - p.x) / c.rx, dy = (heroPos.y - p.y) / c.ry, dz = (heroPos.z - p.z) / c.rx;
        if (dx * dx + dy * dy + dz * dz < 1) fire(c, camera);
      }
      const rb = c.rainbow;
      if (rb && rb.group.visible) {
        rb.life += dt;
        const k = rb.life / RAINBOW_SECONDS;
        // Springy pop out of the cloud, then a gentle rise and fade.
        const t = Math.min(rb.life / 0.45, 1);
        const pop = 1 - Math.pow(1 - t, 3) + Math.sin(t * Math.PI) * 0.25;
        rb.group.scale.setScalar(Math.max(pop, 0.001));
        rb.group.position.copy(p).add(new THREE.Vector3(0, 1 + rb.life * 0.6, 0));
        const fade = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
        for (const m of rb.materials) m.opacity = Math.max(fade, 0);
        if (k >= 1) rb.group.visible = false;
      }
    }
  }

  function clear() {
    for (const c of clouds) { c.cooldown = 0; if (c.rainbow) c.rainbow.group.visible = false; }
  }

  return { update, clear, clouds };
}
