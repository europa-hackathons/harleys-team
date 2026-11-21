// Sky Swim Race: two players pick a racer each on the pick screen, then sky-swim through cloud rings to the farm on a cloud.
import * as THREE from 'three';
import { keys } from './kit/input.js';
import { startLoop } from './kit/loop.js';
import { makeRenderer } from './kit/renderer.js';
import { hud } from './kit/hud.js';
import { poof3d, updatePoofs } from './kit/poof3d.js';
import { ROSTER, makeJet } from './animals.js';
import { createPickScreen } from './pick.js';
import { makeMarker, updateMarker } from './marker.js';
import { setupSky, buildRoute, buildFarm, updateFarm, pathCentre, makeBanana, makeMud, TRACK_LENGTH, RING_RADIUS } from './world.js';

// ---- Tuning (change freely) ----
const STROKE_PUSH = 5.5;      // speed added by one swim stroke
const DRAG = 1.1;             // how fast the glide slows down
const MAX_SPEED = 26;
const GLIDE_SPEED = 1.5;      // slowest drift
const RING_PUSH = 5;          // swimming through a ring gives a little push
const BOOST_SPEED = 14, BOOST_TIME = 1.5;
const COOLDOWN = { boost: 5, banana: 3, mud: 3 };
const STEER_X = 9, STEER_Y = 7;
const ROOM_X = 12, ROOM_Y = 8; // how far from the route's middle you can swim
const HIT_RADIUS = 1.8;
// Catch-up help: the racer behind swims faster, more the further behind (the leader is never slowed).
const CATCHUP_START = 4;      // behind by less than this: no help
const CATCHUP_FULL = 40;      // behind by this much or more: full help
const CATCHUP_MAX = 0.3;      // full help = +30% forward speed
// Steering helper: a soft drift toward the middle of the next cloud ring. The player's steering always wins.
const ASSIST_RANGE = 60;      // starts helping when the next ring is this close
const ASSIST_PULL = 3.0;      // how strongly it pulls toward the ring's middle when the ring is very close
const ASSIST_INSIDE = 2.5;    // once you're this close to your lane's spot in the ring it stops pulling
const ASSIST_LANE = 2.5;      // P1 aims a bit left of the ring's middle, P2 a bit right, so they don't bunch up
const ASSIST_MAX = 6;         // the pull is never faster than this (player steering is 9 / 7)
const ASSIST_WHEN_STEERING = 0.5;  // while you steer on an axis, the helper only does this much on it

const CONTROLS = [
  { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', swim: ['Space'], boost: 'KeyB', banana: 'KeyN', mud: 'KeyM' },
  { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', swim: ['ShiftLeft', 'KeyZ'], boost: 'Digit1', banana: 'Digit2', mud: 'Digit3' },
];

// ---- Scene ----
const renderer = await makeRenderer({ canvasId: 'stage', antialias: true });   // survives a hidden preview tab
const canvas = renderer.domElement;
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
const farm = buildFarm(scene);

const racers = [{ startX: -2.5 }, { startX: 2.5 }].map((r, i) => ({ ...r, controls: CONTROLS[i], index: i }));

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
racers.forEach((r) => { r.marker = makeMarker(r.index); scene.add(r.marker); });
racers.forEach((r, i) => setRacer(r, ROSTER[i].id));

function resetRacer(r) {
  Object.assign(r, { speed: 0, vx: 0, vy: 0, ax: 0, ay: 0, catchUp: 1, ringsHit: 0, boostT: 0, spinT: 0, stuckT: 0, nextRing: 0, finished: false,
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
  countdown = 3;
  snapCamera = true;
  hud.banner('3', 900);
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
function updateRacer(r, dt, time, canMove, leadZ) {
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
  // Catch-up help (eased so it fades in softly)
  const behind = THREE.MathUtils.clamp((p.z - leadZ - CATCHUP_START) / (CATCHUP_FULL - CATCHUP_START), 0, 1);
  r.catchUp = 1 + CATCHUP_MAX * behind * behind * (3 - 2 * behind);
  forward *= r.catchUp;

  // Steering helper: drift softly toward the middle of the next ring ahead; stronger as it gets close.
  let wantAx = 0, wantAy = 0;
  const aim = rings[r.nextRing];
  const ahead = aim ? p.z - aim.position.z : Infinity;
  if (canMove && r.stuckT <= 0 && ahead > 0 && ahead < ASSIST_RANGE) {
    const near = 1 - ahead / ASSIST_RANGE;
    const ox = aim.position.x + (r.index ? ASSIST_LANE : -ASSIST_LANE) - p.x, oy = aim.position.y - p.y, off = Math.hypot(ox, oy);
    const pull = ASSIST_PULL * near * near * Math.max(0, off - ASSIST_INSIDE) / (off || 1);   // ease in
    wantAx = THREE.MathUtils.clamp(ox * pull, -ASSIST_MAX, ASSIST_MAX) * (sx ? ASSIST_WHEN_STEERING : 1);
    wantAy = THREE.MathUtils.clamp(oy * pull, -ASSIST_MAX, ASSIST_MAX) * (sy ? ASSIST_WHEN_STEERING : 1);
  }
  r.ax += (wantAx - r.ax) * Math.min(1, dt * 3);
  r.ay += (wantAy - r.ay) * Math.min(1, dt * 3);

  const prevZ = p.z;
  p.x += (r.vx + r.ax) * dt;
  p.y += (r.vy + r.ay) * dt;
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
      r.ringsHit++;
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
  r.marker.visible = state !== 'title';
  updateMarker(r.marker, p, camera, time);
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

// ---- Camera: one shared chase camera close behind both racers ----
// It sits behind the racer at the back and looks ahead past both. It starts close and backs off
// (higher and further) only as far as needed for BOTH racers, with their markers, to fit inside the
// safe part of the screen (clear of the progress bar at the top and the power panels at the bottom).
const CAM_BACK = 7.8;         // how far behind the back racer when they are close together
const CAM_UP = 2.7;           // how high above them
const CAM_LOOK_AHEAD = 12;    // how far ahead of the back racer it looks (at least)
const CAM_LOOK_UP = -0.4;     // look a bit above the racers so they sit in the lower half
const CAM_MAX_BACK = 120;     // never further back than this
const CAM_FOCUS_GAP = 40;     // racers this far apart (or more): the camera leans most toward the one behind
const SAFE_X = 0.8, SAFE_TOP = 0.72, SAFE_BOTTOM = -0.62;   // safe screen area (-1..1 both ways)
const camPos = new THREE.Vector3(0, 4, 12);
const camLook = new THREE.Vector3(0, 1, -10);
const wantPos = new THREE.Vector3(), wantLook = new THREE.Vector3();
const probe = new THREE.PerspectiveCamera();
const fitPts = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
const ndc = new THREE.Vector3();
let snapCamera = false;       // jump straight into place (at the start of a race)
const focus = new THREE.Vector3();
function poseCamera(back, a, b, outPos, outLook) {
  const rear = a.z > b.z ? a : b, front = rear === a ? b : a;
  // Side to side and up/down, follow the middle of the two racers; when one is far behind,
  // lean toward that one (the leader is far ahead and easy to spot by their marker).
  const w = 0.5 + 0.35 * Math.min(1, (rear.z - front.z) / CAM_FOCUS_GAP);
  focus.lerpVectors(front, rear, w);
  const extra = back - CAM_BACK;
  outPos.set(focus.x, focus.y + CAM_UP + extra * 0.12, rear.z + back);
  outLook.set(focus.x, focus.y + CAM_LOOK_UP, Math.min(rear.z - CAM_LOOK_AHEAD, (rear.z + front.z) / 2 - 4));
}
function fits(pos, look) {
  probe.position.copy(pos);
  probe.lookAt(look);
  probe.updateMatrixWorld();
  for (const q of fitPts) {
    ndc.copy(q).applyMatrix4(probe.matrixWorldInverse);
    if (ndc.z > -2) return false;                       // too close or behind the camera
    ndc.applyMatrix4(probe.projectionMatrix);
    if (Math.abs(ndc.x) > SAFE_X || ndc.y > SAFE_TOP || ndc.y < SAFE_BOTTOM) return false;
  }
  return true;
}
function updateCamera(dt, time) {
  const [a, b] = racers.map((r) => r.model.position);
  if (state === 'title') {
    wantPos.set(Math.sin(time * 0.3) * 3, 3 + Math.sin(time * 0.2), 10);
    wantLook.set(0, 1, -12);
  } else {
    probe.fov = camera.fov; probe.aspect = camera.aspect; probe.near = camera.near; probe.far = camera.far;
    probe.updateProjectionMatrix();
    // each racer's body (a bit below) and their marker (above)
    fitPts[0].copy(a).y -= 1.3; fitPts[1].copy(a).y += 3;
    fitPts[2].copy(b).y -= 1.3; fitPts[3].copy(b).y += 3;
    const side = a.x < b.x ? -1.5 : 1.5;                 // the racers' width, on the outside
    fitPts[0].x += side; fitPts[2].x -= side;
    for (let back = CAM_BACK; back <= CAM_MAX_BACK; back += 1) {
      poseCamera(back, a, b, wantPos, wantLook);
      if (fits(wantPos, wantLook)) break;
    }
  }
  const k = snapCamera ? 1 : 1 - Math.exp(-4 * dt);
  snapCamera = false;
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
    if (now !== before) hud.banner(now > 0 ? String(now) : 'GO! ☁️', now > 0 ? 900 : 1000);
    if (countdown <= 0) state = 'race';
  }
  const canMove = state === 'race';
  const leadZ = Math.min(...racers.map((r) => r.model.position.z));
  for (const r of racers) updateRacer(r, dt, time, canMove, leadZ);
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
  updateFarm(farm, camera);
  updateHud();
  if (draw) renderer.render(scene, camera);
}
startLoop((dt, time) => tick(Math.max(0, dt), time));   // (the first frame can report a tiny negative dt)

// For tools/shot.py and testing: window.game.startRace(), window.game.racers
// window.game.pickAndRace(['piglet', 'robot']) skips the pick screen.
window.game = {
  startRace, openPick, racers, tick, keys, camera, get state() { return state; },
  pickAndRace(ids) { racers.forEach((r, i) => setRacer(r, ids[i], ids[0] === ids[1])); showRacerIcons(); pick.hide(); startRace(); },
};
