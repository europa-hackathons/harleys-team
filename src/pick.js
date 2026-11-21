// The pick screen: all racers stand in a row on little clouds; each player moves a coloured cursor and confirms.
//   const pick = createPickScreen(renderer, (ids) => startCountdown(ids));
//   pick.show();  ...every frame while showing: pick.update(dt, time); pick.render();
import * as THREE from 'three';
import { keys } from './kit/input.js';
import { ROSTER } from './animals.js';
import { setupSky, makeCloud } from './world.js';

const PICK_KEYS = [
  { left: ['ArrowLeft'], right: ['ArrowRight'], ok: ['Space', 'Enter'] },
  { left: ['KeyA'], right: ['KeyD'], ok: ['KeyZ', 'ShiftLeft'] },
];
const SPACING = 4.2;
const SCALE = 0.72;

export function createPickScreen(renderer, onDone) {
  const scene = new THREE.Scene();
  setupSky(scene);
  scene.fog = null;
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);

  for (let i = 0; i < 9; i++) {           // fluffy clouds far behind
    const c = makeCloud(2 + Math.random() * 2);
    c.position.set((i - 4) * 9 + Math.random() * 3, -4 + Math.random() * 10, -30 - Math.random() * 15);
    scene.add(c);
  }

  const slots = ROSTER.map((r, i) => {
    const holder = new THREE.Group();
    holder.position.x = (i - (ROSTER.length - 1) / 2) * SPACING;
    const model = r.make();
    model.scale.setScalar(SCALE);
    holder.add(model);
    const puff = makeCloud(0.75, 5);       // a little cloud to stand on
    puff.position.y = -1.0;
    holder.add(puff);
    scene.add(holder);
    return { racer: r, holder, model, strokeT: Math.random() * 1.2 };
  });

  // HTML: a name label under each racer, with the players' cursors in it.
  const screen = document.getElementById('pick-screen');
  const labelBox = document.getElementById('pick-labels');
  const labels = slots.map((s) => {
    const el = document.createElement('div');
    el.className = 'pick-label';
    el.innerHTML = `<div class="pick-cursors"></div><div class="pick-name" style="--c:${s.racer.color}">${s.racer.icon} ${s.racer.name}</div>`;
    labelBox.append(el);
    return el;
  });
  const status = [document.getElementById('pick-status-1'), document.getElementById('pick-status-2')];

  const players = [{ at: 0, ready: false }, { at: 1, ready: false }];
  let doneT = -1;

  function resize() {
    camera.aspect = innerWidth / innerHeight;
    // Pull the camera back on narrow screens so all racers fit.
    const needWidth = ROSTER.length * SPACING + 1;
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    const dist = Math.max(14, needWidth / 2 / (Math.tan(halfFov) * camera.aspect));
    camera.position.set(0, 2.2, dist);
    camera.lookAt(0, 0.2, 0);
    camera.updateProjectionMatrix();
  }

  function drawLabels() {
    labels.forEach((el, i) => {
      const here = players.map((p, n) => (p.at === i ? n : -1)).filter((n) => n >= 0);
      el.querySelector('.pick-cursors').innerHTML = here
        .map((n) => `<span class="pick-cursor p${n + 1}${players[n].ready ? ' ready' : ''}">▼ P${n + 1}</span>`).join('');
      el.classList.toggle('chosen', here.length > 0);
    });
    status.forEach((el, n) => {
      const p = players[n], r = ROSTER[p.at];
      el.classList.toggle('ready', p.ready);
      el.innerHTML = p.ready
        ? `P${n + 1} READY! ${r.icon}`
        : n === 0 ? 'P1: <b>← →</b> choose, <b>Space</b> ready' : 'P2: <b>A D</b> choose, <b>Z</b> or <b>Shift</b> ready';
    });
  }

  const v = new THREE.Vector3();
  function placeLabels() {
    slots.forEach((s, i) => {
      v.set(s.holder.position.x, -1.7, 0).project(camera);
      labels[i].style.left = `${(v.x * 0.5 + 0.5) * 100}%`;
      labels[i].style.top = `${(-v.y * 0.5 + 0.5) * 100}%`;
    });
  }

  return {
    get showing() { return !screen.classList.contains('hidden'); },
    show() {
      players.forEach((p) => { p.ready = false; });
      doneT = -1;
      screen.classList.remove('hidden');
      resize();
      drawLabels();
    },
    hide() { screen.classList.add('hidden'); },
    update(dt, time) {
      let changed = false;
      players.forEach((p, n) => {
        const k = PICK_KEYS[n];
        if (p.ready) return;
        if (k.left.some(keys.pressed)) { p.at = (p.at + ROSTER.length - 1) % ROSTER.length; changed = true; }
        if (k.right.some(keys.pressed)) { p.at = (p.at + 1) % ROSTER.length; changed = true; }
        if (k.ok.some(keys.pressed)) {
          p.ready = true; changed = true;
          slots[p.at].model.userData.stroke();
        }
      });
      if (changed) drawLabels();
      if (doneT < 0 && players.every((p) => p.ready)) doneT = 0.9;   // a moment to enjoy "READY!"
      if (doneT > 0) {
        doneT -= dt;
        if (doneT <= 0) onDone(players.map((p) => ROSTER[p.at].id));
      }

      slots.forEach((s, i) => {
        const chosen = players.some((p) => p.at === i);
        const ready = players.some((p) => p.at === i && p.ready);
        // Face the camera with a slow sway; chosen racers turn and bounce, and swim now and then.
        s.model.rotation.y = Math.PI + Math.sin(time * 0.8 + i) * (chosen ? 0.9 : 0.35);
        const bounce = chosen ? Math.abs(Math.sin(time * (ready ? 7 : 4))) * 0.35 : Math.sin(time * 1.5 + i) * 0.08;
        s.model.position.y = bounce;
        const want = (chosen ? 1.22 : 1) * SCALE;
        s.model.scale.setScalar(THREE.MathUtils.lerp(s.model.scale.x, want, Math.min(1, dt * 10)));
        s.strokeT -= dt;
        if (s.strokeT <= 0) { s.model.userData.stroke(); s.strokeT = chosen ? 0.6 : 1.5 + Math.random(); }
        s.model.userData.animate(dt, time);
      });
      if (camera.aspect !== innerWidth / innerHeight) resize();
      placeLabels();
    },
    render() { renderer.render(scene, camera); },
  };
}

