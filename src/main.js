// Unicorn Candy Race: race a rival unicorn through candy land for 60 seconds. Most candy wins!
// Left/Right switch lanes, Up jumps. Rainbows make you ZOOM. Jelly blobs slow you down.
import * as THREE from 'three';
import {
  LANES, COLORS, RAINBOW, CANDY_COLORS,
  makeUnicorn, animateUnicorn, makeCandy, makeJelly, makeRainbow, makeTrack, makeSparkles,
} from './world.js';

const RACE_SECONDS = 60;
const START_SPEED = 18;
const END_SPEED = 24; // the race slowly speeds up
const BOOST_SPEED = 36;
const SLOW_SPEED = 8;
const BOOST_TIME = 3;
const SLOW_TIME = 1;
const SPAWN_Z = -95;
const GONE_Z = 10;
const ROW_GAP = 13;
const GRAVITY = 26;
const JUMP_SPEED = 9.5;
const IDLE_SPEED = 7; // gentle scrolling behind the title and end screens

// ---------- Page bits ----------

const $ = (id) => document.getElementById(id);
const titleScreen = $('title-screen');
const endScreen = $('end-screen');
const hud = $('hud');
const callout = $('callout');
const youCount = $('you-count');
const rivalCount = $('rival-count');
const timeLeftEl = $('time-left');

function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

function shout(text) {
  callout.textContent = text;
  callout.classList.remove('pop');
  void callout.offsetWidth; // restart the animation
  callout.classList.add('pop');
}

function bump(el) {
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

// ---------- 3D world ----------

const canvas = $('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xffd6ec, 45, 105);

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
let baseFov = 60;

scene.add(new THREE.HemisphereLight(0xffffff, 0xffb3d9, 1.8));
const sun = new THREE.DirectionalLight(0xffffff, 1.8);
sun.position.set(4, 10, 6);
scene.add(sun);

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  baseFov = camera.aspect < 1 ? 85 : 60; // tall screens need a wider view to see all lanes
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const track = makeTrack();
scene.add(track.group);
const sparkles = makeSparkles(scene);

function makeRunner(look, lane) {
  const u = makeUnicorn(look);
  scene.add(u.root);
  return { u, lane, x: LANES[lane], y: 0, vy: 0, z: 0, slow: 0, boost: 0, candy: 0, think: 0 };
}

const player = makeRunner({ body: COLORS.white, mane: RAINBOW }, 1);
const rival = makeRunner(
  { body: COLORS.lilac, mane: [COLORS.mint, COLORS.sky, COLORS.white], muzzle: '#e3d1ff', horn: COLORS.mint, hooves: COLORS.sky },
  2,
);

// ---------- Race state ----------

let state = 'title'; // title | countdown | race | end
let timeLeft = RACE_SECONDS;
let countdown = 0;
let speed = IDLE_SPEED;
let distance = 0;
let nextRow = 0;
let lastRainbowRow = -99;
let rowCount = 0;
let items = [];
let t = 0;

function addItem(kind, lane, z, y) {
  const mesh = kind === 'candy'
    ? makeCandy(CANDY_COLORS[Math.floor(Math.random() * CANDY_COLORS.length)])
    : kind === 'jelly' ? makeJelly() : makeRainbow();
  mesh.position.set(LANES[lane], y, z);
  scene.add(mesh);
  items.push({ kind, lane, z, y, mesh, taken: false, bumped: new Set(), rivalDecided: false, spin: Math.random() * 6 });
}

function candyLine(lane, z, count) {
  for (let i = 0; i < count; i++) addItem('candy', lane, z - i * 2.2, 0.8);
}

function otherLane(lane) {
  return (lane + 1 + Math.floor(Math.random() * 2)) % 3;
}

function spawnRow(z) {
  rowCount++;
  const lane = Math.floor(Math.random() * 3);
  const r = Math.random();
  if (r < 0.12 && rowCount - lastRainbowRow > 8) {
    lastRainbowRow = rowCount;
    addItem('rainbow', lane, z, 0.6);
    candyLine(otherLane(lane), z, 3);
  } else if (r < 0.4) {
    // A jelly blob, with bonus candy floating above it for brave jumpers.
    addItem('jelly', lane, z, 0);
    addItem('candy', lane, z + 1.4, 2.3);
    addItem('candy', lane, z, 2.7);
    addItem('candy', lane, z - 1.4, 2.3);
    if (Math.random() < 0.6) candyLine(otherLane(lane), z, 3);
  } else if (r < 0.75) {
    candyLine(lane, z, 5);
  } else {
    const second = otherLane(lane);
    candyLine(lane, z, 3);
    candyLine(second, z - 4, 3);
  }
}

function clearItems() {
  for (const item of items) scene.remove(item.mesh);
  items = [];
}

function resetRunner(r, lane) {
  r.lane = lane;
  r.x = LANES[lane];
  r.y = 0; r.vy = 0; r.z = 0; r.slow = 0; r.boost = 0; r.candy = 0; r.think = 0.5;
}

function startRace() {
  clearItems();
  resetRunner(player, 1);
  resetRunner(rival, 0);
  timeLeft = RACE_SECONDS;
  countdown = 3;
  speed = 0;
  distance = 0;
  rowCount = 0;
  lastRainbowRow = -99;
  for (let z = -22; z >= SPAWN_Z; z -= ROW_GAP) spawnRow(z);
  nextRow = ROW_GAP; // the next row arrives one gap after the last pre-placed one
  state = 'countdown';
  hide(titleScreen);
  hide(endScreen);
  show(hud);
  updateHud(true);
  shout('3');
}

function endRace() {
  state = 'end';
  clearItems();
  document.body.classList.remove('zoom');
  const you = player.candy;
  const them = rival.candy;
  $('result').textContent = you > them ? 'You win! 🎉' : you < them ? 'Rival wins!' : "It's a tie!";
  $('final-you').textContent = you;
  $('final-rival').textContent = them;
  hide(hud);
  show(endScreen);
  if (you >= them) {
    for (let i = 0; i < 4; i++) sparkles.emit(player.x, 2, 0, { count: 25, spread: 8, up: 6, life: 1.4, scale: 1.4 });
  }
}

let shownYou = -1;
let shownRival = -1;
let shownTime = -1;
function updateHud(force = false) {
  if (force || shownYou !== player.candy) {
    if (!force) bump(youCount.parentElement);
    youCount.textContent = shownYou = player.candy;
  }
  if (force || shownRival !== rival.candy) {
    if (!force) bump(rivalCount.parentElement);
    rivalCount.textContent = shownRival = rival.candy;
  }
  const secs = Math.max(0, Math.ceil(timeLeft));
  if (force || secs !== shownTime) {
    timeLeftEl.textContent = shownTime = secs;
    timeLeftEl.parentElement.classList.toggle('hurry', secs <= 10);
  }
}

// ---------- Controls ----------

function steer(dir) {
  if (state !== 'race') return;
  player.lane = Math.max(0, Math.min(2, player.lane + dir));
}

function jump(r) {
  if (r.y > 0.001) return;
  r.vy = JUMP_SPEED;
}

addEventListener('keydown', (e) => {
  const key = e.key;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(key)) e.preventDefault();
  if (state === 'title' || state === 'end') {
    if (key === 'Enter' || key === ' ') startRace();
    return;
  }
  if (e.repeat) return;
  if (key === 'ArrowLeft' || key === 'a' || key === 'A') steer(-1);
  if (key === 'ArrowRight' || key === 'd' || key === 'D') steer(1);
  if ((key === 'ArrowUp' || key === ' ' || key === 'w' || key === 'W') && state === 'race') jump(player);
});

// Swipe or tap on touch screens: swipe left/right to steer, swipe up or tap to jump.
let touchStart = null;
canvas.addEventListener('pointerdown', (e) => { touchStart = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerup', (e) => {
  if (!touchStart || state !== 'race') return;
  const dx = e.clientX - touchStart.x;
  const dy = e.clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) steer(Math.sign(dx));
  else jump(player);
});

$('play').addEventListener('click', (e) => { e.currentTarget.blur(); startRace(); });
$('again').addEventListener('click', (e) => { e.currentTarget.blur(); startRace(); });

// ---------- Rival brain ----------

function rivalThink(dt) {
  rival.think -= dt;
  if (rival.think <= 0) {
    rival.think = 0.35 + Math.random() * 0.3;
    if (Math.random() < 0.8) {
      const scores = [0, 0, 0];
      for (const it of items) {
        if (it.taken || it.z > rival.z || it.z < rival.z - 28) continue;
        const near = 1 - (rival.z - it.z) / 28;
        if (it.kind === 'candy') scores[it.lane] += near * (it.y > 1.5 ? 0.3 : 1);
        if (it.kind === 'jelly' && it.z > rival.z - 10) scores[it.lane] -= 2;
      }
      if (Math.abs(rival.z - player.z) < 1.5) scores[player.lane] -= 1.5; // try not to bump into the player
      scores[rival.lane] += 0.2; // a little lazy about changing lanes
      const best = scores.indexOf(Math.max(...scores));
      rival.lane += Math.sign(best - rival.lane);
    }
  }
  // Jump over jelly blobs (most of the time).
  for (const it of items) {
    if (it.kind !== 'jelly' || it.rivalDecided || it.lane !== rival.lane) continue;
    if (it.z > rival.z - 3.5 && it.z < rival.z - 1.2) {
      it.rivalDecided = true;
      if (Math.random() < 0.75) jump(rival);
    }
  }
}

// ---------- Hits ----------

function touch(item, r, prevZ, isPlayer) {
  if (Math.abs(LANES[item.lane] - r.x) > 0.9) return;
  if (!(item.z >= r.z - 0.7 && prevZ <= r.z + 0.7)) return;
  if (item.kind === 'candy') {
    if (!isPlayer && rival.z > 2.5) return; // rival is left behind while you zoom
    if (Math.abs(r.y + 0.9 - item.y) > 1.2) return;
    item.taken = true;
    r.candy++;
    sparkles.emit(item.mesh.position.x, item.y, r.z, {
      count: isPlayer ? 10 : 5, colors: isPlayer ? [COLORS.lemon, COLORS.pink, COLORS.white] : [COLORS.lilac, COLORS.white],
    });
  } else if (item.kind === 'jelly') {
    if (r.y > 0.7 || item.bumped.has(r)) return;
    item.bumped.add(r);
    item.squish = 1;
    r.slow = SLOW_TIME;
    if (isPlayer) {
      r.boost = 0;
      shout('Boing!');
    }
  } else if (item.kind === 'rainbow' && isPlayer) {
    item.taken = true;
    r.boost = BOOST_TIME;
    r.slow = 0;
    shout('ZOOM!');
    sparkles.emit(r.x, 1.5, 0, { count: 30, spread: 7, up: 5, life: 1, scale: 1.3 });
  }
}

// ---------- Main loop ----------

function update(dt) {
  t += dt;

  if (state === 'countdown') {
    const before = Math.ceil(countdown);
    countdown -= dt;
    const after = Math.ceil(countdown);
    if (countdown <= 0) {
      state = 'race';
      shout('GO!');
    } else if (after !== before) {
      shout(String(after));
    }
  }

  let target = IDLE_SPEED;
  if (state === 'countdown') target = 0;
  if (state === 'race') {
    timeLeft -= dt;
    const ramp = START_SPEED + (END_SPEED - START_SPEED) * (1 - timeLeft / RACE_SECONDS);
    target = player.slow > 0 ? SLOW_SPEED : player.boost > 0 ? BOOST_SPEED : ramp;
  }
  speed += (target - speed) * Math.min(1, dt * (player.slow > 0 ? 8 : 3));
  const dz = speed * dt;

  track.update(dz);
  sparkles.update(dt, dz);

  if (state === 'race') {
    distance += dz;
    while (distance >= nextRow) {
      spawnRow(SPAWN_Z - (distance - nextRow));
      nextRow += ROW_GAP;
    }
    rivalThink(dt);
  }

  // Runners: slide between lanes, jump, recover.
  for (const r of [player, rival]) {
    r.x += (LANES[r.lane] - r.x) * Math.min(1, dt * 12);
    r.vy -= GRAVITY * dt;
    r.y = Math.max(0, r.y + r.vy * dt);
    if (r.y === 0) r.vy = 0;
    r.slow = Math.max(0, r.slow - dt);
    r.boost = Math.max(0, r.boost - dt);
  }

  // The rival drifts back while you zoom and pulls ahead while you're slowed.
  let rivalTarget = 0;
  if (state === 'race') {
    if (player.boost > 0) rivalTarget += 3.5;
    if (player.slow > 0) rivalTarget -= 4;
    if (rival.slow > 0) rivalTarget += 3;
  }
  rival.z += (Math.max(-6, Math.min(3.5, rivalTarget)) - rival.z) * Math.min(1, dt * 1.5);

  // Move pickups and check for touches.
  for (const item of items) {
    const prevZ = item.z;
    item.z += dz;
    item.mesh.position.z = item.z;
    item.spin += dt;
    if (item.kind === 'candy') {
      item.mesh.rotation.y = item.spin * 3;
      item.mesh.position.y = item.y + Math.sin(item.spin * 4) * 0.1;
    } else if (item.kind === 'rainbow') {
      item.mesh.rotation.y = Math.sin(item.spin * 2) * 0.4;
      item.mesh.position.y = item.y + Math.sin(item.spin * 3) * 0.15;
    } else if (item.kind === 'jelly') {
      item.squish = Math.max(0, (item.squish || 0) - dt * 2);
      const wob = Math.sin(item.spin * 6) * 0.06 + item.squish * Math.sin(item.spin * 30) * 0.25;
      item.mesh.userData.blob.scale.set(1 + wob, 1 - wob, 1 + wob);
    }
    if (state === 'race' && !item.taken) {
      touch(item, player, prevZ, true);
      if (!item.taken) touch(item, rival, prevZ, false);
    }
  }
  items = items.filter((item) => {
    const keep = !item.taken && item.z < GONE_Z;
    if (!keep) scene.remove(item.mesh);
    return keep;
  });

  // Draw the unicorns.
  const running = state === 'countdown' ? 0 : speed * 0.6;
  for (const r of [player, rival]) {
    r.u.root.position.set(r.x, r.y, r.z);
    r.u.root.rotation.z = r.slow > 0 ? Math.sin(t * 30) * 0.12 * r.slow : 0;
    r.u.root.rotation.y = (r.x - LANES[r.lane]) * 0.25;
    animateUnicorn(r.u, t, running, r.y > 0.05);
  }

  // Rainbow ZOOM: sparkly trail, wider view, rainbow frame.
  const zooming = state === 'race' && player.boost > 0;
  document.body.classList.toggle('zoom', zooming);
  if (zooming) sparkles.emit(player.x, player.y + 1.1, 1, { count: 2, spread: 1.5, up: 1, life: 0.5 });

  camera.fov += ((zooming ? baseFov + 14 : baseFov) - camera.fov) * Math.min(1, dt * 4);
  camera.updateProjectionMatrix();
  camera.position.set(player.x * 0.35, 4.2, 7.5);
  camera.lookAt(player.x * 0.5, 1.2, -8);

  if (state === 'race') {
    updateHud();
    if (timeLeft <= 0) {
      timeLeft = 0;
      updateHud();
      endRace();
    }
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Handy for testing from the browser console.
window.game = { get state() { return state; }, player, rival, startRace, get items() { return items; },
  get timeLeft() { return timeLeft; }, set timeLeft(v) { timeLeft = v; } };
