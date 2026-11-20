// Rooftop Rescue: fly over the night town and rescue the townsfolk waving on chimneys.
// Title screen -> 90-second round -> happy end screen -> play again.
import * as THREE from 'three';
import { buildTown } from './town.js';
import { createHero, CRUISE_HEIGHT, MAX_HEIGHT } from './hero.js';
import { createTownsfolk } from './townsfolk.js';
import { createEffects } from './effects.js';

const ROUND_SECONDS = 90;

const canvas = document.getElementById('stage');
const titleScreen = document.getElementById('title-screen');
const endScreen = document.getElementById('end-screen');
const hud = document.getElementById('hud');
const rescuedText = document.getElementById('rescued');
const timerText = document.getElementById('timer');
const endScore = document.getElementById('end-score');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 600);

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const { chimneys, floorAt } = buildTown(scene);
const hero = createHero(scene, floorAt);
const effects = createEffects(scene, camera, document.getElementById('fx-layer'));
const townsfolk = createTownsfolk(scene, chimneys, effects);

// A yellow arrow above the hero that points to the nearest person who needs help.
const arrowGeo = new THREE.ConeGeometry(0.45, 1.3, 4);
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
function shootWeb() {
  if (hero.zipping) return;
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
  }
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
  endScore.textContent = `You rescued ${rescued} ${rescued === 1 ? 'person' : 'people'}!`;
  hud.classList.add('hidden');
  endScreen.classList.remove('hidden');
}

document.getElementById('play').addEventListener('click', startRound);
document.getElementById('play-again').addEventListener('click', startRound);

// --- Camera ---
const camTarget = new THREE.Vector3();
const camLook = new THREE.Vector3();
function desiredCamera() {
  const p = hero.root.position, f = hero.forward;
  // Higher up, the camera pulls back and looks down a bit more so the town stays easy to read.
  const high = THREE.MathUtils.clamp((p.y - CRUISE_HEIGHT) / (MAX_HEIGHT - CRUISE_HEIGHT), 0, 1);
  const back = 8 + 6 * high, up = 4 + 4 * high;
  camTarget.set(p.x - f.x * back, p.y + up, p.z - f.z * back);
  camLook.set(p.x + f.x * 8, p.y - 1 - 4 * high, p.z + f.z * 8);
}
function snapCamera() {
  desiredCamera();
  camera.position.copy(camTarget);
  camera.lookAt(camLook);
}
const smoothLook = new THREE.Vector3();

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

    desiredCamera();
    const k = 1 - Math.exp(-dt * 4);
    camera.position.lerp(camTarget, k);
    smoothLook.lerp(camLook, k);
    camera.lookAt(smoothLook);

    // Point the helper arrow at the nearest person waiting.
    const target = townsfolk.nearestWaiting(hero.root.position);
    arrow.visible = state === 'playing' && !!target;
    if (target) {
      arrow.position.copy(hero.root.position).add(new THREE.Vector3(0, 2.6, 0));
      const t = target.group.position;
      arrow.lookAt(t.x, arrow.position.y, t.z);
      arrow.scale.setScalar(1 + Math.sin(clock.elapsedTime * 6) * 0.15);
    }
  }

  effects.update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
smoothLook.set(0, 4, 0);
requestAnimationFrame(frame);
