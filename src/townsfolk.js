// Little townsfolk waving for help on chimney tops. Fly close to rescue them!
import * as THREE from 'three';

const SHIRTS = ['#FF8C42', '#5BC0EB', '#9BC53D', '#FDE74C', '#E55934', '#C08DFF', '#FF6FA5'];
const SKIN = ['#F2C9A0', '#D9A066', '#A86B3C', '#7A4B2A', '#FFDBB8'];
const HATS = ['#3D5A80', '#8E4A2B', '#2A9D8F', '#E76F51', '#6D597A'];
const THANKS = ['THANK YOU!', 'THANK YOU!', 'MY HERO!', 'THANK YOU SO MUCH!', 'YAY! THANK YOU!'];
const WANTED = 7;           // how many people wait for help at once
const RESCUE_RADIUS = 4.5;  // how close (sideways) the hero must fly

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

function buildPerson() {
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

  const help = new THREE.Sprite(new THREE.SpriteMaterial({ map: helpTexture, depthWrite: false, sizeAttenuation: false }));
  help.scale.set(0.06, 0.03, 1); // screen-sized, so far-away people are easy to spot
  help.position.y = 2.4;
  g.add(help);

  g.scale.setScalar(1.5);
  return { group: g, arms, help };
}

export function createTownsfolk(scene, chimneys, effects) {
  const people = [];
  let respawnTimers = [];

  function spawn(awayFrom) {
    const options = chimneys.filter((c) => !c.person && c.pos.distanceTo(awayFrom) > 25);
    if (!options.length) return;
    const chimney = pick(options);
    const p = buildPerson();
    p.group.position.copy(chimney.pos);
    p.chimney = chimney;
    p.state = 'waiting';
    p.timer = Math.random() * 10;
    chimney.person = p;
    scene.add(p.group);
    people.push(p);
  }

  function reset(heroPos) {
    for (const p of people) { scene.remove(p.group); p.chimney.person = null; }
    people.length = 0;
    respawnTimers = [];
    for (let i = 0; i < WANTED; i++) spawn(heroPos);
  }

  // Returns how many people were rescued this frame.
  function update(dt, heroPos, playing) {
    let rescued = 0;
    for (let i = people.length - 1; i >= 0; i--) {
      const p = people[i];
      const g = p.group;
      p.timer += dt;
      g.rotation.y = Math.atan2(heroPos.x - g.position.x, heroPos.z - g.position.z); // look at the hero

      if (p.state === 'waiting') {
        p.arms[0].rotation.z = -0.2;
        p.arms[1].rotation.z = 2.6 + Math.sin(p.timer * 9) * 0.5; // big wave
        g.position.y = p.chimney.pos.y + Math.abs(Math.sin(p.timer * 4)) * 0.25;
        p.help.position.y = 2.4 + Math.sin(p.timer * 3) * 0.1;

        const dx = heroPos.x - g.position.x, dz = heroPos.z - g.position.z;
        const dy = heroPos.y - g.position.y;
        if (playing && dx * dx + dz * dz < RESCUE_RADIUS * RESCUE_RADIUS && dy > -3 && dy < 8) {
          p.state = 'cheering';
          p.timer = 0;
          p.help.visible = false;
          rescued++;
          const top = g.position.clone().add(new THREE.Vector3(0, 3, 0));
          effects.say(pick(THANKS), top);
          effects.burst(top, ['heart', 'star', 'heart', 'star', 'sparkle'], 26, 8);
        }
      } else {
        // Cheering: both arms up, happy jumps, then poof!
        p.arms[0].rotation.z = -2.7 - Math.sin(p.timer * 14) * 0.3;
        p.arms[1].rotation.z = 2.7 + Math.sin(p.timer * 14) * 0.3;
        g.position.y = p.chimney.pos.y + Math.abs(Math.sin(p.timer * 8)) * 0.9;
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
