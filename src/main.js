// Sky Swim Race: two players pick a racer each on the pick screen, then sky-swim through cloud rings to the farm on a cloud.
import * as THREE from 'three';
import { keys } from './kit/input.js';
import { startLoop } from './kit/loop.js';
import { hud } from './kit/hud.js';
import { poof3d, updatePoofs } from './kit/poof3d.js';
import { ROSTER, makeJet } from './animals.js';
import { createPickScreen } from './pick.js';
import { setupSky, buildRoute, buildFarm, pathCentre, makeBanana, makeMud, TRACK_LENGTH, RING_RADIUS } from './world.js';

// ---- Tuning (change freely) ----
const STROKE_PUSH = 5.5;      // speed added by one swim stroke
const DRAG = 1.1;             // how fast the glide slows down
const MAX_SPEED = 26;
const GLIDE_SPEED = 1.5;      // slowest drift
const RING_PUSH = 5;          // swimming through a ring gives a little push
const BOOST_SPEED = 14, BOOST_TIME = 1.5;
const COOLDOWN = { boost: 5, banana: 3, mud: 3 };
const STEER_X = 9, STEER_Y = 7;
const ROOM_X = 9, ROOM_Y = 6; // how far from the route's middle you can swim
const HIT_RADIUS = 1.8;

const CONTROLS = [
  { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', swim: ['Space'], boost: 'KeyB', banana: 'KeyN', mud: 'KeyM' },
  { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', swim: ['ShiftLeft', 'KeyZ'], boost: 'Digit1', banana: 'Digit2', mud: 'Digit3' },
];

// ---- Scene ----
const canvas = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1500);
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

setupSky(scene);
const rings = buildRoute(scene);
buildFarm(scene);

const racers = [{ startX: -2.6 }, { startX: 2.6 }].map((r, i) => ({ ...r, controls: CONTROLS[i], index: i }));

/** Give a player the racer they picked (an id from ROSTER), swapping the 3D model. */
function setRacer(r, id, sameAsOther) {
  const info = ROSTER.find((x) => x.id === id) ?? ROSTER[r.index];
  if (r.model) scene.remove(r.model);
  r.id = info.id;
  r.icon = info.icon;
  r.name = sameAsOther ? `P${r.index + 1} ${info.name}` : info.name;
  r.model = info.make();
  r.jet = makeJet();
  r.jet.position.z = info.jetZ;
  r.model.add(r.jet);
  scene.add(r.model);
}
racers.forEach((r, i) => setRacer(r, ROSTER[i].id));

function resetRacer(r) {
  Object.assign(r, { speed: 0, vx: 0, vy: 0, boostT: 0, spinT: 0, stuckT: 0, nextRing: 0, finished: false,
    cool: { boost: 0, banana: 0, mud: 0 } });
  r.model.position.set(r.startX, 0, 0);
  r.model.rotation.set(0, 0, 0);
}

// ---- Bananas and mud ----
const items = [];
function dropItem(r, kind) {
  const mesh = kind === 'banana' ? makeBanana() : makeMud();
  mesh.position.copy(r.model.position);
  mesh.position.z += 3.5;
  scene.add(mesh);
  items.push({ kind, mesh, owner: r, safeT: 1.5, baseY: mesh.position.y, age: Math.random() * 6 });
}
function clearItems() {
  for (const it of items) scene.remove(it.mesh);
  items.length = 0;
}

// ---- HUD ----
const progressBar = document.getElementById('progress');
const progressIcons = racers.map((r) => {
  const el = document.createElement('div');
  el.className = 'progress-icon';
  progressBar.append(el);
  return el;
});
const powerPanels = racers.map((r, i) => document.getElementById(`powers-${i + 1}`));
function showRacerIcons() {
  racers.forEach((r, i) => {
    progressIcons[i].textContent = r.icon;
    powerPanels[i].querySelector('.racer-icon').textContent = r.icon;
  });
}

function updateHud() {
  racers.forEach((r, i) => {
    const t = Math.min(1, Math.max(0, -r.model.position.z / TRACK_LENGTH));
    progressIcons[i].style.left = `${t * 100}%`;
    for (const kind of ['boost', 'banana', 'mud']) {
      const el = powerPanels[i].querySelector(`[data-kind="${kind}"]`);
      el.classList.toggle('cooling', r.cool[kind] > 0);
    }
  });
}

// ---- Game state ----
const titleScreen = document.getElementById('title-screen');
const winScreen = document.getElementById('win-screen');
const winText = document.getElementById('win-text');
const gameHud = document.getElementById('game-hud');
let state = 'title';   // title -> pick -> countdown -> race -> won
let countdown = 0;
let confettiT = 0;
let winner = null;

const pick = createPickScreen(renderer, (ids) => {
  racers.forEach((r, i) => setRacer(r, ids[i], ids[0] === ids[1]));
  showRacerIcons();
  pick.hide();
  startRace();
});
function openPick(e) {
  e?.currentTarget?.blur();          // so Space doesn't press the button again
  state = 'pick';
  titleScreen.classList.add('hidden');
  winScreen.classList.add('hidden');
  gameHud.classList.add('hidden');
  hud.banner('');
  pick.show();
}

function startRace() {
  racers.forEach(resetRacer);
  clearItems();
  winner = null;
  state = 'countdown';
  countdown = 3.999;
  titleScreen.classList.add('hidden');
  winScreen.classList.add('hidden');
  gameHud.classList.remove('hidden');
}
document.getElementById('play').addEventListener('click', openPick);
document.getElementById('again').addEventListener('click', openPick);

function win(r) {
  state = 'won';
  winner = r;
  confettiT = 2.5;
  winText.textContent = `${r.name} WINS!`;
  winText.className = r.index === 0 ? 'kitten' : 'pony';
  winScreen.classList.remove('hidden');
  hud.banner('');
}

// ---- Racer update ----
const tmp = new THREE.Vector3();
function updateRacer(r, dt, time, canMove) {
  const c = r.controls, p = r.model.position;
  for (const k of ['boost', 'banana', 'mud']) r.cool[k] = Math.max(0, r.cool[k] - dt);
  r.boostT = Math.max(0, r.boostT - dt);
  r.spinT = Math.max(0, r.spinT - dt);
  r.stuckT = Math.max(0, r.stuckT - dt);

  if (c.swim.some((code) => keys.pressed(code))) {
    r.model.userData.stroke();
    if (canMove && r.stuckT <= 0) r.speed = Math.min(MAX_SPEED, r.speed + STROKE_PUSH * (r.spinT > 0 ? 0.4 : 1));
  }
  if (canMove) {
    if (keys.pressed(c.boost) && r.cool.boost <= 0) { r.boostT = BOOST_TIME; r.cool.boost = COOLDOWN.boost; }
    if (keys.pressed(c.banana) && r.cool.banana <= 0) { dropItem(r, 'banana'); r.cool.banana = COOLDOWN.banana; }
    if (keys.pressed(c.mud) && r.cool.mud <= 0) { dropItem(r, 'mud'); r.cool.mud = COOLDOWN.mud; }
  }

  // Steering (up arrow = swim up)
  const sx = (keys.held(c.right) ? 1 : 0) - (keys.held(c.left) ? 1 : 0);
  const sy = (keys.held(c.up) ? 1 : 0) - (keys.held(c.down) ? 1 : 0);
  const steer = canMove && r.stuckT <= 0 ? 1 : 0;
  r.vx += (sx * STEER_X * steer - r.vx) * Math.min(1, dt * 6);
  r.vy += (sy * STEER_Y * steer - r.vy) * Math.min(1, dt * 6);

  // Forward glide
  r.speed = Math.max(canMove ? GLIDE_SPEED : 0, r.speed * Math.exp(-DRAG * dt));
  let forward = r.speed + (r.boostT > 0 ? BOOST_SPEED : 0);
  if (r.stuckT > 0) forward *= 0.08;
  if (!canMove) forward = 0;

  const prevZ = p.z;
  p.x += r.vx * dt;
  p.y += r.vy * dt;
  p.z -= forward * dt;
  const mid = pathCentre(p.z);
  p.x = THREE.MathUtils.clamp(p.x, mid.x - ROOM_X, mid.x + ROOM_X);
  p.y = THREE.MathUtils.clamp(p.y, mid.y - ROOM_Y, mid.y + ROOM_Y);

  // Cloud rings
  const ring = rings[r.nextRing];
  if (ring && p.z <= ring.position.z && prevZ > ring.position.z) {
    r.nextRing++;
    if (Math.hypot(p.x - ring.position.x, p.y - ring.position.y) < RING_RADIUS - 0.4) {
      r.speed = Math.min(MAX_SPEED + RING_PUSH, r.speed + RING_PUSH);
      poof3d(scene, p, { count: 14, size: 0.25, colors: ['#FFFFFF', '#FFD93B', '#6EC6FF'] });
      ring.userData.flash = 0.4;
    }
  } else if (ring && p.z < ring.position.z) r.nextRing++;

  // Pose: lean into turns, spin when on a banana, wobble when stuck in mud
  const m = r.model;
  m.rotation.z = r.spinT > 0 ? r.spinT * 14 : -r.vx * 0.05;
  m.rotation.x = r.vy * 0.04 + (r.stuckT > 0 ? Math.sin(time * 30) * 0.08 : 0);
  m.rotation.y = r.stuckT > 0 ? Math.sin(time * 25) * 0.1 : 0;
  m.position.y += Math.sin(time * 2 + r.index) * 0.004;   // gentle float
  m.userData.animate(dt, time);

  r.jet.visible = r.boostT > 0;
  if (r.jet.visible) r.jet.scale.set(1, 1, 0.8 + Math.random() * 0.5);

  if (canMove && p.z <= -TRACK_LENGTH && !winner) win(r);
}

function updateItems(dt) {
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    it.safeT -= dt;
    it.age += dt;
    it.mesh.rotation.z = Math.sin(it.age * 2) * 0.4;
    it.mesh.position.y = it.baseY + Math.sin(it.age * 2.5) * 0.25;
    for (const r of racers) {
      if (r === it.owner && it.safeT > 0) continue;
      if (r.model.position.distanceTo(it.mesh.position) > HIT_RADIUS) continue;
      if (it.kind === 'banana') { r.spinT = 1.0; r.speed *= 0.25; r.boostT = 0; }
      else { r.stuckT = 1.3; r.speed = 0; r.boostT = 0; }
      poof3d(scene, it.mesh.position, { colors: it.kind === 'banana' ? ['#FFD93B', '#FFFFFF'] : ['#7B4B2A', '#B07A4F', '#FFFFFF'] });
      scene.remove(it.mesh);
      items.splice(i, 1);
      break;
    }
  }
}

// ---- Camera: one shared chase camera behind both racers ----
const camPos = new THREE.Vector3(0, 4, 12);
const camLook = new THREE.Vector3(0, 1, -10);
const wantPos = new THREE.Vector3(), wantLook = new THREE.Vector3();
function updateCamera(dt, time) {
  const [a, b] = racers.map((r) => r.model.position);
  const mid = tmp.copy(a).add(b).multiplyScalar(0.5);
  const gap = Math.min(30, Math.abs(a.z - b.z) + Math.abs(a.x - b.x) * 0.6);
  if (state === 'title') {
    wantPos.set(Math.sin(time * 0.3) * 3, 3 + Math.sin(time * 0.2), 10);
    wantLook.set(0, 1, -12);
  } else {
    wantPos.set(mid.x, mid.y + 3.5 + gap * 0.12, mid.z + 10 + gap * 0.5);
    wantLook.set(mid.x, mid.y + 1.2, mid.z - 14);
  }
  const k = 1 - Math.exp(-4 * dt);
  camPos.lerp(wantPos, k);
  camLook.lerp(wantLook, k);
  camera.position.copy(camPos);
  camera.lookAt(camLook);
}

// ---- Main loop ----
racers.forEach(resetRacer);
function tick(dt, time, draw = true) {
  if (state === 'pick') {
    pick.update(dt, time);
    if (state === 'pick') {          // (picking may have just started the countdown)
      if (draw) pick.render();
      return;
    }
  }
  if (state === 'countdown') {
    const before = Math.ceil(countdown);
    countdown -= dt;
    const now = Math.ceil(countdown);
    if (now !== before || before === 4) hud.banner(now > 0 ? String(now) : 'SWIM! ☁️', now > 0 ? 900 : 1000);
    if (countdown <= 0) state = 'race';
  }
  const canMove = state === 'race';
  for (const r of racers) updateRacer(r, dt, time, canMove);
  if (canMove) updateItems(dt);

  for (const ring of rings) {
    if (ring.userData.flash > 0) {
      ring.userData.flash -= dt;
      ring.scale.setScalar(1 + ring.userData.flash * 0.5);
    } else ring.scale.setScalar(1);
  }

  if (state === 'won' && confettiT > 0) {
    confettiT -= dt;
    if (Math.random() < dt * 14) {
      const at = winner.model.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 8, 1 + Math.random() * 4, -2 - Math.random() * 4));
      poof3d(scene, at, { count: 24, size: 0.25, speed: 6, colors: ['#FFD93B', '#FF6B9A', '#4BE3A4', '#6EC6FF', '#9B5BD6', '#F28C28'] });
    }
  }
  updatePoofs(dt);
  updateCamera(dt, time);
  updateHud();
  if (draw) renderer.render(scene, camera);
}
startLoop((dt, time) => tick(dt, time));

// For tools/shot.py and testing: window.game.startRace(), window.game.racers
// window.game.pickAndRace(['piglet', 'robot']) skips the pick screen.
window.game = {
  startRace, openPick, racers, tick, keys, get state() { return state; },
  pickAndRace(ids) { racers.forEach((r, i) => setRacer(r, ids[i], ids[0] === ids[1])); showRacerIcons(); pick.hide(); startRace(); },
};
