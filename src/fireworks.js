// Sunrise party fireworks and confetti: low-poly sparks in palette colours.
// Rockets whoosh up from the rooftops and burst into balls of sparkles that drift, fall and shrink away.
// Soft and friendly: no flashes, just colour. Everything is drawn with two InstancedMeshes, so it stays smooth.
import * as THREE from 'three';

const COLORS = ['#FFD45C', '#F2635F', '#4FE3E0', '#B57EDC', '#1FA39A', '#FFFFFF'].map((c) => new THREE.Color(c));
const WHITE = new THREE.Color('#FFFFFF');
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// A pool of little flying bits drawn as one InstancedMesh.
function createPool(scene, geometry, material, max) {
  const mesh = new THREE.InstancedMesh(geometry, material, max);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.setColorAt(0, WHITE); // creates the colour buffer
  mesh.count = 0;
  mesh.frustumCulled = false;
  scene.add(mesh);
  const bits = [];
  const dummy = new THREE.Object3D();

  function add(bit) {
    if (bits.length >= max) return;
    bit.life = 0;
    bit.spin = bit.spin || new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    bit.rot = new THREE.Euler(Math.random() * 6, Math.random() * 6, 0);
    bits.push(bit);
  }

  function update(dt) {
    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i];
      b.life += dt;
      if (b.life >= b.maxLife) { bits[i] = bits[bits.length - 1]; bits.pop(); continue; }
      b.vel.y -= b.gravity * dt;
      b.vel.multiplyScalar(Math.exp(-b.drag * dt));
      if (b.flutter) { // confetti sways side to side as it floats down
        b.vel.y = Math.max(b.vel.y, -1.6);
        b.pos.x += Math.sin(b.life * 5 + b.flutter) * dt * 1.2;
      }
      b.pos.addScaledVector(b.vel, dt);
      b.rot.x += b.spin.x * dt; b.rot.y += b.spin.y * dt; b.rot.z += b.spin.z * dt;
    }
    for (let i = 0; i < bits.length; i++) {
      const b = bits[i];
      const k = b.life / b.maxLife;
      let s = b.size * (k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3); // shrink away at the end
      if (b.twinkle && k > 0.5) s *= 0.6 + 0.4 * Math.abs(Math.sin(b.life * 20 + i));
      dummy.position.copy(b.pos);
      dummy.rotation.copy(b.rot);
      dummy.scale.setScalar(Math.max(s, 0.001));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, b.color);
    }
    mesh.count = bits.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }

  return { add, update, clear() { bits.length = 0; mesh.count = 0; } };
}

export function createFireworks(scene) {
  const sparks = createPool(scene, new THREE.OctahedronGeometry(0.22, 0), new THREE.MeshBasicMaterial({ fog: false }), 1200);
  const confetti = createPool(scene,
    new THREE.PlaneGeometry(0.2, 0.34),
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, fog: false }), 500);
  const rockets = [];
  let center = null, radius = 15, timer = 0, nextVolley = 0, volley = 0;

  // A rocket from a rooftop near `at`, rising to a burst point high above.
  function launch(at) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * radius;
    const from = new THREE.Vector3(at.x + Math.cos(a) * r, at.y, at.z + Math.sin(a) * r);
    const to = from.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, 10 + Math.random() * 8, (Math.random() - 0.5) * 4));
    rockets.push({ from, to, pos: from.clone(), t: 0, duration: 0.9 + Math.random() * 0.4, color: pick(COLORS), trail: 0 });
  }

  // Pop! A round ball of sparks in one or two colours, with a few white twinkles.
  function burst(pos, color) {
    const second = Math.random() < 0.5 ? pick(COLORS) : color;
    const n = 70, speed = 7 + Math.random() * 3;
    for (let i = 0; i < n; i++) {
      // Even spread over a sphere (golden-angle spiral).
      const y = 1 - (i + 0.5) / n * 2, rr = Math.sqrt(1 - y * y), th = i * 2.39996;
      const dir = new THREE.Vector3(Math.cos(th) * rr, y, Math.sin(th) * rr);
      const white = i % 6 === 0;
      sparks.add({
        pos: pos.clone(), vel: dir.multiplyScalar(speed * (0.85 + Math.random() * 0.3)),
        gravity: 2.2, drag: 1.6, maxLife: 1.6 + Math.random() * 0.6,
        size: white ? 0.8 : 1.1, color: white ? WHITE : i % 2 ? color : second, twinkle: true,
      });
    }
  }

  // A shower of confetti over a spot (e.g. the cheering crowd).
  function sprinkle(at, count = 60, spread = 10) {
    for (let i = 0; i < count; i++) {
      confetti.add({
        pos: new THREE.Vector3(at.x + (Math.random() - 0.5) * spread, at.y + Math.random() * 3, at.z + (Math.random() - 0.5) * spread),
        vel: new THREE.Vector3((Math.random() - 0.5) * 3, 2 + Math.random() * 4, (Math.random() - 0.5) * 3),
        gravity: 6, drag: 0.6, maxLife: 3 + Math.random() * 1.5, size: 1.3,
        color: pick(COLORS), flutter: Math.random() * 6 + 0.01,
      });
    }
  }

  // Start the show over `at` (a point at rooftop height). Volleys keep coming until clear().
  function start(at, spreadRadius = 15) {
    center = at.clone();
    radius = spreadRadius;
    timer = 0; nextVolley = 0.2; volley = 0;
  }

  function update(dt) {
    if (center) {
      timer += dt;
      if (timer >= nextVolley) {
        // The first few volleys come quickly (2-3 rockets each); then a calmer one every ~1.5 s.
        const n = volley < 4 ? 2 + (volley % 2) : 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < n; i++) launch(center);
        volley++;
        nextVolley = timer + (volley < 4 ? 0.9 : 1.5);
      }
    }
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.t += dt / r.duration;
      const e = 1 - (1 - Math.min(r.t, 1)) ** 2; // fast at first, slowing to the top
      r.pos.lerpVectors(r.from, r.to, e);
      r.trail -= dt;
      if (r.trail <= 0) { // a little sparkly tail behind the rocket
        r.trail = 0.03;
        sparks.add({
          pos: r.pos.clone(), vel: new THREE.Vector3((Math.random() - 0.5), -1, (Math.random() - 0.5)),
          gravity: 1, drag: 2, maxLife: 0.5, size: r.t < 0.05 ? 0.9 : 0.7, color: r.color, twinkle: true,
        });
      }
      if (r.t >= 1) { burst(r.to, r.color); rockets.splice(i, 1); }
    }
    sparks.update(dt);
    confetti.update(dt);
  }

  function clear() {
    center = null;
    rockets.length = 0;
    sparks.clear();
    confetti.clear();
  }

  return { start, sprinkle, update, clear };
}
