// Little townsfolk stuck INSIDE chimneys: they stand in the chimney, visible from the waist up,
// arms over the rim, waving for help. New ones pop up like a jack-in-the-box. Fly close to rescue them!
import * as THREE from 'three';
import { loadModel } from './models.js';

const SHIRTS = ['#FF8C42', '#5BC0EB', '#9BC53D', '#FDE74C', '#E55934', '#C08DFF', '#FF6FA5'];
const SKIN = ['#F2C9A0', '#D9A066', '#A86B3C', '#7A4B2A', '#FFDBB8'];
const HATS = ['#3D5A80', '#8E4A2B', '#2A9D8F', '#E76F51', '#6D597A'];
const THANKS = ['THANK YOU!', 'THANK YOU!', 'MY HERO!', 'THANK YOU SO MUCH!', 'YAY! THANK YOU!'];
const WANTED = 7;           // how many people wait for help at once
const RESCUE_RADIUS = 4.5;  // how close (sideways) the hero must fly
const SINK = 0.4;           // how far below the chimney rim a waiting person stands (waist at the rim)
const POP_SECONDS = 0.7;    // the springy pop up out of the chimney
const STAGGER = 0.25;       // at the start of a round, people pop up one after another

// Springy overshoot: 0 -> 1, wobbling past 1 a few times before settling.
function springOut(t) {
  if (t >= 1) return 1;
  return 1 - Math.exp(-6 * t) * Math.cos(t * 13);
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const lit = (color) => new THREE.MeshLambertMaterial({ color, flatShading: true });

const helpTexture = (() => {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(4, 4, 120, 44, 20);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(54, 46); ctx.lineTo(64, 62); ctx.lineTo(74, 46);
  ctx.fill();
  ctx.fillStyle = '#4B2A8C';
  ctx.font = 'bold 30px Trebuchet MS, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('HELP!', 64, 37);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
})();

// ---- The sculpted 3D townsperson (assets/models/townsperson.glb), like assets/concepts/townsperson-model.png.
// It is loaded once and "baked": every colour section is flattened into person space (feet at y = 0,
// face toward +z), and his right arm (on his -x side) is cut off onto a shoulder pivot so it can wave.
// Every person shares the same baked geometry and materials, so 7 of them stay cheap.
// Until it loads (or if it fails) the simple-shape people below are used.
const SCULPT_HEIGHT = 2.1;   // person units (the whole person is scaled 1.5): about as tall as the simple one
const SCULPT_FEET_Y = -0.53; // feet this far down, so his waist (vest bottom, y 0.8) sits at the chimney rim
const SHOULDER = new THREE.Vector3(-0.24, 1.3, 0);       // his right shoulder
// His arm slopes out from the shoulder to the hand (x -0.66 at y 0.75); keep his side and hip out of it.
const isRightArm = (x, y, z) => y > 0.6 && y < 1.4 && x < Math.min(-0.26, -0.24 - (1.3 - y) * 0.76 + 0.17);
const SHOULDER_CAP = 0.06; // arm triangles this close to the shoulder stay on the body, so no hole opens
const ARM_REST = 0.5;  // the sculpt's arm already hangs out; straight up would hide the hand behind his cap
let sculpt = null; // { body: [{geometry, material}], arm: [{geometry, material}] }

// Splits one non-indexed geometry's triangles in two by a test on each triangle's middle point.
function splitTriangles(geo, test) {
  const p = geo.attributes.position;
  const yes = [], no = [];
  for (let i = 0; i < p.count; i += 3) {
    const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3;
    const cy = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
    const cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
    const out = test(cx, cy, cz) ? yes : no;
    for (let k = 0; k < 3; k++) out.push(p.getX(i + k), p.getY(i + k), p.getZ(i + k));
  }
  const make = (arr) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    g.computeVertexNormals();
    return g;
  };
  return [make(yes), make(no)];
}

function bakeSculpt(model) {
  model.updateMatrixWorld(true);
  const body = [], arm = [];
  model.traverse((o) => {
    if (!o.isMesh) return;
    const geo = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrixWorld);
    const near = (x, y, z) => Math.hypot(x - SHOULDER.x, y - SHOULDER.y, z - SHOULDER.z) < SHOULDER_CAP;
    const [onArm, rest] = splitTriangles(geo, (x, y, z) => isRightArm(x, y, z) && !near(x, y, z));
    rest.translate(0, SCULPT_FEET_Y, 0);
    if (rest.attributes.position.count) body.push({ geometry: rest, material: o.material });
    if (onArm.attributes.position.count) {
      onArm.translate(-SHOULDER.x, -SHOULDER.y, -SHOULDER.z); // around the shoulder pivot
      arm.push({ geometry: onArm, material: o.material });
    }
  });
  return { body, arm };
}

// A sculpted person: { body, arms: [left (unused), right (waves)] } in the same frame as the simple one.
function buildSculptedBody() {
  const body = new THREE.Group();
  for (const s of sculpt.body) body.add(new THREE.Mesh(s.geometry, s.material));
  const pivot = new THREE.Group();
  pivot.position.copy(SHOULDER).y += SCULPT_FEET_Y;
  for (const s of sculpt.arm) pivot.add(new THREE.Mesh(s.geometry, s.material));
  body.add(pivot);
  return { body, arms: [new THREE.Group(), pivot] };
}

function buildSimpleBody() {
  const g = new THREE.Group();
  const shirt = pick(SHIRTS), skin = pick(SKIN), hatColor = pick(HATS);
  const add = (geo, color, y) => { const m = new THREE.Mesh(geo, lit(color)); m.position.y = y; g.add(m); return m; };
  add(new THREE.CylinderGeometry(0.26, 0.26, 0.3, 7), '#3B3355', 0.15);
  add(new THREE.CylinderGeometry(0.28, 0.34, 0.75, 7), shirt, 0.55);
  add(new THREE.IcosahedronGeometry(0.28, 1), skin, 1.15);
  add(new THREE.CylinderGeometry(0.36, 0.36, 0.05, 10), hatColor, 1.33);
  add(new THREE.CylinderGeometry(0.22, 0.25, 0.22, 10), hatColor, 1.45);

  const arms = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.33, 0.85, 0);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.55, 5), lit(shirt));
    arm.position.y = -0.27;
    const hand = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), lit(skin));
    hand.position.y = -0.58;
    pivot.add(arm, hand);
    g.add(pivot);
    arms.push(pivot);
  }
  return { body: g, arms };
}

// Swings the waving (right-hand) arm; `angle` is in the simple person's terms (0 = hanging, ~2.6 = up high).
function setWaveArm(p, angle) {
  if (p.sculpted) p.arms[1].rotation.set(0, 0, -(angle - ARM_REST)); // his right arm is on the -x side
  else p.arms[1].rotation.set(0, 0, angle);
}

// Puts a body (sculpted if it has loaded, else simple shapes) into a person's group.
function dressPerson(p) {
  if (p.body) p.group.remove(p.body);
  const { body, arms } = sculpt ? buildSculptedBody() : buildSimpleBody();
  body.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  p.group.add(body);
  p.body = body;
  p.arms = arms;
  p.sculpted = !!sculpt;
}

function buildPerson() {
  const g = new THREE.Group();
  const help = new THREE.Sprite(new THREE.SpriteMaterial({ map: helpTexture, depthWrite: false, sizeAttenuation: false }));
  help.scale.set(0.06, 0.03, 1); // screen-sized, so far-away people are easy to spot
  help.position.y = 2.4;
  g.add(help);
  g.scale.setScalar(1.5);
  const p = { group: g, help };
  dressPerson(p);
  return p;
}

export function createTownsfolk(scene, chimneys, effects) {
  const people = [];
  let respawnTimers = [];

  // Swap in the sculpted townsperson once it has loaded; the simple-shape people stay if it fails.
  loadModel('townsperson', { height: SCULPT_HEIGHT, rotationY: -Math.PI / 2 }).then((model) => {
    sculpt = bakeSculpt(model);
    for (const p of people) dressPerson(p);
  }).catch((e) => console.warn('Sculpted townsperson did not load, keeping the simple ones.', e));

  function spawn(awayFrom, delay = 0) {
    const options = chimneys.filter((c) => !c.person && c.pos.distanceTo(awayFrom) > 25);
    if (!options.length) return;
    const chimney = pick(options);
    const p = buildPerson();
    p.group.position.copy(chimney.pos);
    p.group.position.y -= 3; // hidden down inside the chimney until the pop
    p.group.visible = false;
    p.group.rotation.order = 'YXZ'; // turn to face the hero, then lean toward her
    p.chimney = chimney;
    p.state = 'popping';
    p.timer = -delay;
    p.wave = Math.random() * 10;
    chimney.person = p;
    scene.add(p.group);
    people.push(p);
  }

  function reset(heroPos) {
    for (const p of people) { scene.remove(p.group); p.chimney.person = null; }
    people.length = 0;
    respawnTimers = [];
    for (let i = 0; i < WANTED; i++) spawn(heroPos, i * STAGGER);
  }

  // Returns how many people were rescued this frame.
  function update(dt, heroPos, playing) {
    let rescued = 0;
    for (let i = people.length - 1; i >= 0; i--) {
      const p = people[i];
      const g = p.group;
      p.timer += dt;
      p.wave += dt;
      g.rotation.y = Math.atan2(heroPos.x - g.position.x, heroPos.z - g.position.z); // look at the hero
      const rim = p.chimney.pos.y;

      if (p.state === 'popping') {
        if (p.timer < 0) continue; // still waiting for their turn to pop up
        if (!g.visible) {
          // Boing! A little puff of sparkles out of the chimney.
          g.visible = true;
          effects.burst(p.chimney.pos.clone().add(new THREE.Vector3(0, 0.6, 0)), ['dust', 'dust', 'sparkle', 'star', 'dust'], 16, 4);
        }
        const t = p.timer / POP_SECONDS;
        g.position.y = rim - SINK - 2.6 * (1 - springOut(t));
        g.scale.set(1.5 * (1 + 0.15 * (1 - springOut(t))), 1.5, 1.5 * (1 + 0.15 * (1 - springOut(t))));
        p.arms[0].rotation.set(0, 0, -2.8); // arms up as they spring out
        setWaveArm(p, 2.8);
        p.help.visible = false;
        if (t >= 1) { p.state = 'waiting'; g.scale.setScalar(1.5); p.help.visible = true; }
      } else if (p.state === 'waiting') {
        // One arm resting over the rim in front, the other waving big above the cap.
        g.rotation.x = 0.12;
        p.arms[0].rotation.set(-0.65, 0, -0.3);
        setWaveArm(p, 2.6 + Math.sin(p.wave * 9) * 0.5);
        g.position.y = rim - SINK + Math.abs(Math.sin(p.wave * 4)) * 0.08;
        p.help.position.y = 2.4 + Math.sin(p.wave * 3) * 0.1;

        const dx = heroPos.x - g.position.x, dz = heroPos.z - g.position.z;
        const dy = heroPos.y - rim;
        if (playing && dx * dx + dz * dz < RESCUE_RADIUS * RESCUE_RADIUS && dy > -3 && dy < 8) {
          p.state = 'cheering';
          p.timer = 0;
          p.help.visible = false;
          rescued++;
          const top = p.chimney.pos.clone().add(new THREE.Vector3(0, 3, 0));
          effects.say(pick(THANKS), top);
          effects.burst(top, ['heart', 'star', 'heart', 'star', 'sparkle'], 26, 8);
        }
      } else {
        // Cheering: they spring up out of the chimney, both arms up in a V, happy hops, then poof!
        g.rotation.x = 0;
        p.arms[0].rotation.set(0, 0, -2.6 - Math.sin(p.timer * 14) * 0.3);
        setWaveArm(p, 2.6 + Math.sin(p.timer * 14) * 0.3);
        g.position.y = rim - SINK + 1.0 * springOut(Math.min(p.timer / 0.5, 1)) + Math.abs(Math.sin(p.timer * 8)) * 0.5;
        if (p.timer > 1.3) {
          effects.burst(g.position.clone().add(new THREE.Vector3(0, 1.5, 0)), ['sparkle', 'cyanSparkle', 'star'], 20, 5);
          scene.remove(g);
          p.chimney.person = null;
          people.splice(i, 1);
          respawnTimers.push(0.8);
        }
      }
    }
    for (let i = respawnTimers.length - 1; i >= 0; i--) {
      respawnTimers[i] -= dt;
      if (respawnTimers[i] <= 0) { respawnTimers.splice(i, 1); spawn(heroPos); }
    }
    return rescued;
  }

  function nearestWaiting(pos) {
    let best = null, bestD = Infinity;
    for (const p of people) {
      if (p.state !== 'waiting') continue;
      const d = p.group.position.distanceToSquared(pos);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  return { reset, update, nearestWaiting };
}
