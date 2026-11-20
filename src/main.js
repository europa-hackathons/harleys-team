// Rooftop Rescue: fly over the night town and rescue the townsfolk waving on chimneys.
// Title screen -> 60-second round (one night, sunset to sunrise) -> happy end screen -> play again.
import * as THREE from 'three';
import { buildTown } from './town.js';
import { createHero, CRUISE_HEIGHT, MAX_HEIGHT } from './hero.js';
import { createTownsfolk } from './townsfolk.js';
import { createEffects } from './effects.js';
import { createSky } from './sky.js';
import { createClouds } from './clouds.js';
import { createTraffic } from './traffic.js';

const ROUND_SECONDS = 60;

const canvas = document.getElementById('stage');
const titleScreen = document.getElementById('title-screen');
const endScreen = document.getElementById('end-screen');
const hud = document.getElementById('hud');
const rescuedText = document.getElementById('rescued');
const timerText = document.getElementById('timer');
const endScore = document.getElementById('end-score');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 600);

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const { chimneys, floorAt, surfaceAt, solidAt, blocksCamera, skyParts } = buildTown(scene);
const sky = createSky(scene, skyParts);
const effects = createEffects(scene, camera, document.getElementById('fx-layer'));
// Touchdown: a little puff of dust and sparkles round her boots.
const onLand = (feet) => effects.burst(feet.add(new THREE.Vector3(0, 0.3, 0)), ['dust', 'dust', 'dust', 'sparkle'], 14, 3);
const hero = createHero(scene, floorAt, { surfaceAt, solidAt, onLand });
const townsfolk = createTownsfolk(scene, chimneys, effects);
const clouds = createClouds(scene, effects);
const traffic = createTraffic(scene);

// A yellow arrow above the hero that points to the nearest person who needs help.
const arrowGeo = new THREE.ConeGeometry(0.3, 0.9, 4);
arrowGeo.rotateX(Math.PI / 2);
const arrow = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: '#FFD45C' }));
scene.add(arrow);

// --- Keyboard ---
const keys = {};
addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (e.code === 'Space' && !e.repeat && state === 'playing') shootWeb();
  keys[e.code] = true;
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

// Space: web to the best chimney in front. People waiting for help count extra.
// On the ground it zips her up to a chimney too; with no chimney in front she just takes off.
function shootWeb() {
  if (hero.zipping || hero.mode === 'landing') return;
  const pos = hero.root.position, fwd = hero.forward;
  let best = null, bestScore = Infinity;
  const to = new THREE.Vector3();
  for (const c of chimneys) {
    to.subVectors(c.pos, pos).setY(0);
    const dist = to.length();
    if (dist < 4 || dist > 45) continue;
    const angle = Math.acos(THREE.MathUtils.clamp(to.dot(fwd) / dist, -1, 1));
    if (angle > 1.1) continue;
    const waiting = c.person && c.person.state === 'waiting';
    const score = dist + angle * 25 - (waiting ? 25 : 0);
    if (score < bestScore) { bestScore = score; best = c; }
  }
  if (best) {
    hero.shootWeb(best.pos);
    effects.burst(best.pos, ['cyanSparkle'], 6, 3);
  } else if (hero.onGround) hero.takeOff();
}

// --- Game flow ---
let state = 'title';
let rescued = 0;
let timeLeft = ROUND_SECONDS;

function startRound() {
  rescued = 0;
  timeLeft = ROUND_SECONDS;
  hero.reset();
  effects.clear();
  clouds.clear();
  townsfolk.reset(hero.root.position);
  snapCamera();
  rescuedText.textContent = '0';
  timerText.textContent = String(ROUND_SECONDS);
  titleScreen.classList.add('hidden');
  endScreen.classList.add('hidden');
  hud.classList.remove('hidden');
  state = 'playing';
  canvas.focus();
}

function endRound() {
  state = 'ended';
  endScore.textContent = `The sun is up! You rescued ${rescued} ${rescued === 1 ? 'person' : 'people'}!`;
  hud.classList.add('hidden');
  endScreen.classList.remove('hidden');
}

document.getElementById('play').addEventListener('click', startRound);
document.getElementById('play-again').addEventListener('click', startRound);

// --- Camera ---
// Close behind her, a little over her right shoulder (like the concept picture), so her goggles,
// reaching glove and the chimney ahead are on screen together.
const CAM = {
  fly: { back: 3.3, up: 1.25, side: 1.0, ahead: 7, down: 0.9 },
  high: { back: 12, up: 7.5, side: 0.5, ahead: 9, down: 5 },  // at her highest: pulled back to see the town
  walk: { back: 3.0, up: 0.95, side: 0.75, ahead: 5, down: -0.2 },
};
const camTarget = new THREE.Vector3();
const camLook = new THREE.Vector3();
const camFrom = new THREE.Vector3(), camProbe = new THREE.Vector3();
let walkCam = 0; // 0 = flying camera, 1 = walking camera (closer and lower), blended smoothly
let camBlocked = false;
function desiredCamera(dt = 1) {
  const p = hero.root.position, f = hero.forward;
  walkCam += ((hero.mode === 'walk' ? 1 : 0) - walkCam) * (1 - Math.exp(-dt * 2.5));
  // Higher up, the camera pulls back and looks down a bit more so the town stays easy to read.
  const high = THREE.MathUtils.clamp((p.y - CRUISE_HEIGHT) / (MAX_HEIGHT - CRUISE_HEIGHT), 0, 1);
  const h = Math.sqrt(high) * (1 - walkCam); // pulls back early in the climb
  const v = {};
  for (const k in CAM.fly) v[k] = THREE.MathUtils.lerp(THREE.MathUtils.lerp(CAM.fly[k], CAM.high[k], h), CAM.walk[k], walkCam);
  const rx = -f.z, rz = f.x; // her right-hand side
  camTarget.set(p.x - f.x * v.back + rx * v.side, p.y + v.up, p.z - f.z * v.back + rz * v.side);
  camLook.set(p.x + f.x * v.ahead + rx * v.side * 0.5, p.y - v.down, p.z + f.z * v.ahead + rz * v.side * 0.5);

  // Never inside a wall, roof, lamp or tree: if something is between her and the camera,
  // the camera first tries rising over it, and only then slides in toward her.
  camFrom.set(p.x, p.y + 0.5, p.z);
  camBlocked = false;
  const clearUntil = () => {
    for (let i = 1; i <= 10; i++) {
      camProbe.lerpVectors(camFrom, camTarget, i / 10);
      if (blocksCamera(camProbe.x, camProbe.y, camProbe.z)) return i / 10;
    }
    return 1;
  };
  if (clearUntil() < 1) {
    camBlocked = true;
    const baseY = camTarget.y;
    let t = 0;
    for (const lift of [1.2, 2.4]) {
      camTarget.y = baseY + lift;
      t = clearUntil();
      if (t === 1) break;
    }
    if (t < 1) {
      // Still blocked: come in closer, but never right into her head.
      const dist = camFrom.distanceTo(camTarget);
      camTarget.lerpVectors(camFrom, camTarget, Math.max(t - 0.15, Math.min(1, 1.6 / dist)));
    }
    camLook.y -= 0.6; // look down at her a little more from up there
  }
  camTarget.y = Math.max(camTarget.y, surfaceAt(camTarget.x, camTarget.z) + 0.6);
}
// The camera is smoothed RELATIVE to her, so it swings round nicely when she turns
// but never falls behind when she flies fast.
const camOffset = new THREE.Vector3(), lookOffset = new THREE.Vector3(), tmpOffset = new THREE.Vector3();
function snapCamera() {
  desiredCamera();
  camOffset.subVectors(camTarget, hero.root.position);
  lookOffset.subVectors(camLook, hero.root.position);
  camera.position.copy(camTarget);
  camera.lookAt(camLook);
}
const smoothLook = new THREE.Vector3();
const shadowFocus = new THREE.Vector3();

// --- Main loop ---
const clock = new THREE.Clock();
let titleAngle = 0;
townsfolk.reset(hero.root.position);

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);

  if (state === 'title') {
    // Slow tour around the town behind the title.
    titleAngle += dt * 0.08;
    camera.position.set(Math.sin(titleAngle) * 70, 32, Math.cos(titleAngle) * 70);
    camera.lookAt(0, 4, 0);
    townsfolk.update(dt, camera.position, false);
  } else {
    if (state === 'playing') {
      hero.update(dt, keys);
      const n = townsfolk.update(dt, hero.root.position, true);
      if (n) {
        rescued += n;
        rescuedText.textContent = String(rescued);
        rescuedText.parentElement.classList.remove('pop');
        void rescuedText.parentElement.offsetWidth; // restart the pop animation
        rescuedText.parentElement.classList.add('pop');
      }
      timeLeft -= dt;
      timerText.textContent = String(Math.max(0, Math.ceil(timeLeft)));
      timerText.parentElement.classList.toggle('hurry', timeLeft < 10);
      if (timeLeft <= 0) endRound();
    } else {
      hero.update(dt, {});
      townsfolk.update(dt, hero.root.position, false);
    }

    desiredCamera(dt);
    const k = 1 - Math.exp(-dt * 4);
    const hp = hero.root.position;
    camOffset.lerp(tmpOffset.subVectors(camTarget, hp), camBlocked ? 1 - Math.exp(-dt * 14) : k); // dodge walls quickly
    lookOffset.lerp(tmpOffset.subVectors(camLook, hp), k);
    camera.position.copy(hp).add(camOffset);
    smoothLook.copy(hp).add(lookOffset);
    camera.lookAt(smoothLook);

    // Point the helper arrow at the nearest person waiting.
    const target = townsfolk.nearestWaiting(hero.root.position);
    arrow.visible = state === 'playing' && !!target;
    if (target) {
      // Just ahead of her head, so the close camera sees it pointing the way without it blocking the view.
      arrow.position.copy(hero.root.position).addScaledVector(hero.forward, hero.onGround ? 1.2 : 3).y += hero.onGround ? 1.7 : 0.9;
      const t = target.group.position;
      arrow.lookAt(t.x, arrow.position.y, t.z);
      arrow.scale.setScalar(0.8 + Math.sin(clock.elapsedTime * 6) * 0.12);
    }
  }

  // The shadows are sharpest just ahead of her, where the camera looks.
  const focus = state === 'title' ? null : shadowFocus.copy(hero.root.position).addScaledVector(hero.forward, 12);
  sky.update(state === 'title' ? null : timeLeft, ROUND_SECONDS, camera, focus);
  clouds.update(dt, state === 'playing' ? hero.root.position : null, camera);
  traffic.update(dt);
  effects.update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
smoothLook.set(0, 4, 0);
// For building Friends' headless checks: open the game with ?debug to reach these from the console.
if (location.search.includes('debug')) window.game = { hero, camera, townsfolk, keys, surfaceAt, solidAt, blocksCamera, renderer, scene, clouds, traffic, chimneys, setTimeLeft: (t) => { timeLeft = t; } };
requestAnimationFrame(frame);
