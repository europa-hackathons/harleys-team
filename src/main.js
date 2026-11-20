// Unicorn Candy Race: a side-view race through candy land at night, 60 seconds. Most candy wins!
// Up jumps (to grab floating candy and hop over jelly). Left/Right move your unicorn back and forward.
// Rainbows make you ZOOM. Jelly blobs go "Boing!" and slow you down.
import {
  layout, drawSky, drawScenery, drawTrack, drawForeground, drawCandy, drawJelly, drawRainbowPickup,
  particles, rainbowSparkles, randomCandyLook, JELLY_COLORS, RAINBOW, pick, rand,
} from './world.js';
import { drawUnicorn, PLAYER_LOOK, RIVAL_LOOK } from './unicorn.js';

const RACE_SECONDS = 60;
const START_SPEED = 300; // units per second the world scrolls by
const END_SPEED = 370; // the race slowly speeds up
const BOOST_SPEED = 640;
const SLOW_SPEED = 130;
const IDLE_SPEED = 170; // gentle running behind the title and end screens
const BOOST_TIME = 3;
const SLOW_TIME = 0.8;
const GRAVITY = 1650;
const JUMP_SPEED = 620; // jumps about 116 units high and lasts 0.75 s
const MOVE_SPEED = 260; // how fast Left/Right move your unicorn along the track
const RIVAL_MOVE = 170;
const PLAYER_SIZE = 1.1;
const RIVAL_SIZE = 0.95;
// How good the rival is (0 to 1).
const RIVAL_JELLY_SKILL = 0.8;
const RIVAL_CANDY_SKILL = 0.75;

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

// ---------- Screen ----------

const canvas = $('stage');
const ctx = canvas.getContext('2d');
let W = 800;
let H = 600;
let pxScale = 1;
let L = layout(W, H);
let minX = 90;
let maxX = 480;

function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  const scale = Math.min(innerHeight / 600, innerWidth / 760);
  W = innerWidth / scale;
  H = innerHeight / scale;
  pxScale = scale * dpr;
  L = layout(W, H);
  minX = 90;
  maxX = Math.min(W * 0.62, W - 230);
}
addEventListener('resize', resize);
resize();

// ---------- Runners ----------

function makeRunner(look, size) {
  return { look, size, x: 0, y: 0, vy: 0, slow: 0, boost: 0, candy: 0, phase: 0, goal: 0, think: 0 };
}
const player = makeRunner(PLAYER_LOOK, PLAYER_SIZE);
const rival = makeRunner(RIVAL_LOOK, RIVAL_SIZE);

function placeRunners() {
  player.x = W * 0.3;
  rival.x = W * 0.5;
}
placeRunners();

function resetRunner(r, x) {
  Object.assign(r, { x, y: 0, vy: 0, slow: 0, boost: 0, candy: 0, goal: x, think: 1 });
}

// ---------- Race state ----------

let state = 'title'; // title | countdown | race | end
let timeLeft = RACE_SECONDS;
let countdown = 0;
let speed = IDLE_SPEED;
let scroll = 0;
let nextPattern = 0;
let patternsSinceRainbow = 0;
let items = [];
let trail = [];
let t = 0;
const keys = { left: false, right: false };
const speedLines = Array.from({ length: 22 }, () => ({ x: rand(0, 1200), y: rand(0, 1), len: rand(60, 160) }));

function addItem(kind, x, h) {
  items.push({
    kind, x, h, taken: false, bumped: new Set(), rivalDecided: false, squish: 0, spin: Math.random() * 6,
    look: kind === 'candy' ? randomCandyLook() : kind === 'jelly' ? pick(JELLY_COLORS) : null,
  });
}

// Each pattern is placed starting at x and returns how wide it is.
const PATTERNS = {
  lowLine(x) {
    for (let i = 0; i < 5; i++) addItem('candy', x + i * 50, 55);
    return 200;
  },
  highArc(x) {
    [60, 150, 180, 150, 60].forEach((h, i) => addItem('candy', x + i * 46, h));
    return 184;
  },
  jellyHop(x) {
    addItem('candy', x, 55);
    addItem('candy', x + 50, 55);
    addItem('jelly', x + 190, 0);
    [140, 180, 140].forEach((h, i) => addItem('candy', x + 140 + i * 50, h));
    return 240;
  },
  doubleJelly(x) {
    addItem('jelly', x, 0);
    addItem('candy', x, 160);
    addItem('candy', x + 140, 55);
    addItem('jelly', x + 280, 0);
    addItem('candy', x + 280, 160);
    return 280;
  },
  mixed(x) {
    for (let i = 0; i < 3; i++) addItem('candy', x + i * 50, 55);
    [150, 175, 150].forEach((h, i) => addItem('candy', x + 230 + i * 46, h));
    return 322;
  },
  rainbow(x) {
    addItem('rainbow', x, 165);
    for (let i = 0; i < 4; i++) addItem('candy', x + 200 + i * 50, 55);
    return 350;
  },
};

function spawnPattern(x) {
  patternsSinceRainbow++;
  let name;
  if (patternsSinceRainbow > 6 && Math.random() < 0.35) {
    name = 'rainbow';
    patternsSinceRainbow = 0;
  } else {
    name = pick(['lowLine', 'highArc', 'jellyHop', 'jellyHop', 'doubleJelly', 'mixed', 'highArc']);
  }
  return PATTERNS[name](x);
}

function startRace() {
  items = [];
  trail = [];
  particles.list.length = 0;
  resetRunner(player, W * 0.3);
  resetRunner(rival, W * 0.42);
  timeLeft = RACE_SECONDS;
  countdown = 3;
  speed = 0;
  patternsSinceRainbow = 0;
  // Fill the track ahead of the runners, then keep adding more as it scrolls.
  let x = W * 0.75;
  while (x < W + 200) x += spawnPattern(x) + rand(240, 340);
  nextPattern = x;
  state = 'countdown';
  hide(titleScreen);
  hide(endScreen);
  show(hud);
  updateHud(true);
  shout('3');
}

function endRace() {
  state = 'end';
  items = [];
  keys.left = keys.right = false;
  document.body.classList.remove('zoom');
  const you = player.candy;
  const them = rival.candy;
  $('result').textContent = you > them ? 'You win! 🎉' : you < them ? 'Rival wins!' : "It's a tie!";
  $('final-you').textContent = you;
  $('final-rival').textContent = them;
  hide(hud);
  show(endScreen);
  if (you >= them) {
    for (let i = 0; i < 6; i++) particles.emit(rand(W * 0.1, W * 0.9), rand(80, 300), { count: 24, spread: 220, up: 60, life: 1.6, size: 10 });
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
  if (key === 'ArrowLeft') keys.left = true;
  if (key === 'ArrowRight') keys.right = true;
  if (key === 'ArrowUp' && !e.repeat && state === 'race') jump(player);
});
addEventListener('keyup', (e) => {
  if (e.key === 'ArrowLeft') keys.left = false;
  if (e.key === 'ArrowRight') keys.right = false;
});
addEventListener('blur', () => { keys.left = keys.right = false; });

// Touch screens: tap to jump, swipe left or right to move.
let touchStart = null;
canvas.addEventListener('pointerdown', (e) => { touchStart = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerup', (e) => {
  if (!touchStart || state !== 'race') return;
  const dx = e.clientX - touchStart.x;
  const dy = e.clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) player.x += Math.sign(dx) * 100;
  else jump(player);
});

$('play').addEventListener('click', (e) => { e.currentTarget.blur(); startRace(); });
$('again').addEventListener('click', (e) => { e.currentTarget.blur(); startRace(); });

// ---------- Rival brain ----------

function rivalThink(dt) {
  rival.think -= dt;
  if (rival.think <= 0) {
    rival.think = rand(1.2, 2.4);
    const lead = rival.candy - player.candy;
    if (lead <= -3 && Math.random() < 0.6) rival.goal = maxX + 30; // dash ahead to catch up
    else if (lead >= 5) rival.goal = rand(minX + 40, W * 0.4); // feeling lazy
    else if (Math.random() < 0.3) rival.goal = maxX + 30;
    else rival.goal = rand(W * 0.3, maxX);
  }
  // Jump over jelly and up to high candy (most of the time).
  const cx = rival.x + 6;
  for (const it of items) {
    if (it.rivalDecided || it.taken || it.kind === 'rainbow') continue;
    const d = it.x - cx;
    if (d < 0) continue;
    if (it.kind === 'jelly' && d <= speed * 0.36 + 10) {
      it.rivalDecided = true;
      if (Math.random() < RIVAL_JELLY_SKILL) jump(rival);
    } else if (it.kind === 'candy' && it.h > 125 && d <= speed * 0.28 + 20) {
      it.rivalDecided = true;
      if (Math.random() < RIVAL_CANDY_SKILL) jump(rival);
    }
  }
}

// ---------- Hits ----------

function itemY(h) { return L.itemRow - h; }

function touch(item, r, isPlayer) {
  const dx = Math.abs(item.x - (r.x + 6));
  if (item.kind === 'candy') {
    if (dx > 46 || item.h < r.y - 14 || item.h > r.y + 128) return;
    if (!isPlayer && r.x < -20) return; // the rival is off screen
    item.taken = true;
    r.candy++;
    const y = itemY(item.h);
    particles.emit(item.x, y, isPlayer
      ? { count: 12, colors: ['#ffffff', '#fff6a8', '#ff8fc8'], spread: 140, up: 60, life: 0.7 }
      : { count: 6, colors: ['#ffffff', '#9ff0c8'], spread: 90, up: 40, life: 0.5, size: 4 });
    if (isPlayer) particles.text(item.x, y - 18, '+1', '#fff6a8');
  } else if (item.kind === 'jelly') {
    if (dx > 50 || r.y > 34 || item.bumped.has(r)) return;
    item.bumped.add(r);
    item.squish = 1;
    r.slow = SLOW_TIME;
    if (isPlayer) {
      r.boost = 0;
      r.x -= 40;
      shout('Boing!');
    }
  } else if (item.kind === 'rainbow' && isPlayer) {
    if (dx > 56 || item.h < r.y - 20 || item.h > r.y + 140) return;
    item.taken = true;
    r.boost = BOOST_TIME;
    r.slow = 0;
    shout('ZOOM!');
    particles.emit(item.x, itemY(item.h), { count: 50, spread: 320, up: 60, life: 1.1, size: 9 });
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

  const racing = state === 'race';
  const ramp = START_SPEED + (END_SPEED - START_SPEED) * (1 - timeLeft / RACE_SECONDS);
  let target = IDLE_SPEED;
  if (state === 'countdown') target = 0;
  if (racing) {
    timeLeft -= dt;
    target = player.slow > 0 ? SLOW_SPEED : player.boost > 0 ? BOOST_SPEED : ramp;
  }
  speed += (target - speed) * Math.min(1, dt * (player.slow > 0 ? 8 : 3));
  const dx = speed * dt;
  scroll += dx;

  // New candy patterns arrive from the right.
  if (racing) {
    nextPattern -= dx;
    while (nextPattern < W + 120) nextPattern += spawnPattern(nextPattern) + rand(240, 340);
    rivalThink(dt);
  }

  // Player: move along the track, ZOOM pushes you forward.
  if (racing) {
    const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    player.x += dir * MOVE_SPEED * dt;
    if (player.boost > 0) player.x += 120 * dt;
    player.x = Math.max(minX, Math.min(maxX, player.x));
  } else if (state !== 'countdown') {
    player.x += (W * 0.3 - player.x) * Math.min(1, dt * 2);
  }

  // Rival: runs at its own speed, so it drifts back while you zoom and pulls ahead while you're slowed.
  if (racing) {
    const rivalSpeed = rival.slow > 0 ? SLOW_SPEED : ramp;
    const steer = Math.max(-RIVAL_MOVE * dt, Math.min(RIVAL_MOVE * dt, rival.goal - rival.x));
    rival.x += steer + (rivalSpeed - speed) * 0.35 * dt;
    rival.x = Math.max(-120, Math.min(maxX + 30, rival.x));
  } else if (state !== 'countdown') {
    rival.x += (W * 0.5 - rival.x) * Math.min(1, dt * 2);
  }

  for (const r of [player, rival]) {
    r.vy -= GRAVITY * dt;
    r.y = Math.max(0, r.y + r.vy * dt);
    if (r.y === 0) r.vy = 0;
    r.slow = Math.max(0, r.slow - dt);
    r.boost = Math.max(0, r.boost - dt);
    if (state !== 'countdown') r.phase += dt * (8 + speed * 0.02);
  }

  // Move candy, jelly and rainbows; check for touches.
  for (const item of items) {
    item.x -= dx;
    item.spin += dt;
    item.squish = Math.max(0, item.squish - dt * 2);
    if (racing && !item.taken) {
      touch(item, player, true);
      if (!item.taken) touch(item, rival, false);
    }
  }
  items = items.filter((item) => !item.taken && item.x > -120);

  // ZOOM: rainbow trail, speed lines and extra sparkles.
  const zooming = racing && player.boost > 0;
  document.body.classList.toggle('zoom', zooming);
  for (const p of trail) p.x -= dx * 0.9;
  if (zooming) {
    trail.push({ x: player.x - 30, y: L.frontRow - player.y - 62 });
    particles.emit(player.x - 20, L.frontRow - player.y - 60, { count: 2, spread: 60, up: 20, life: 0.6, size: 7, drift: 0.5 });
  } else if (trail.length) {
    trail.shift();
  }
  trail = trail.filter((p) => p.x > -60).slice(-40);
  for (const s of speedLines) {
    s.x -= dt * 1800;
    if (s.x + s.len < 0) {
      s.x = W + rand(0, 400);
      s.y = rand(0, 1);
    }
  }

  rainbowSparkles(L, dt, zooming ? 70 : 24);
  particles.update(dt, speed);

  if (racing) {
    updateHud();
    if (timeLeft <= 0) {
      timeLeft = 0;
      updateHud();
      endRace();
    }
  }
}

// ---------- Drawing ----------

function drawRunner(r, rowY) {
  if (r.x < -100) return;
  ctx.save();
  // Shadow on the track.
  ctx.fillStyle = 'rgba(40, 10, 60, 0.35)';
  ctx.beginPath();
  ctx.ellipse(r.x + 4, rowY + 2, 40 * r.size * (1 - Math.min(0.5, r.y / 260)), 7 * r.size, 0, 0, Math.PI * 2);
  ctx.fill();
  // A soft glow while zooming.
  if (r === player && r.boost > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(r.x, rowY - r.y - 70, 10, r.x, rowY - r.y - 70, 110);
    g.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
    g.addColorStop(1, 'rgba(255, 150, 240, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(r.x - 110, rowY - r.y - 180, 220, 220);
    ctx.restore();
  }
  ctx.translate(r.x, rowY - r.y);
  ctx.scale(r.size, r.size);
  drawUnicorn(ctx, r.look, {
    phase: r.phase, t, moving: state !== 'countdown', air: r.y > 4,
    wobble: r.slow > 0 ? Math.sin(t * 30) * 0.08 * (r.slow / SLOW_TIME) : 0,
    wind: r.boost > 0 ? 1.6 : undefined,
  });
  ctx.restore();
}

function drawTrail() {
  if (trail.length < 2) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowBlur = 16 * pxScale;
  RAINBOW.forEach((c, i) => {
    ctx.strokeStyle = c;
    ctx.shadowColor = c;
    ctx.lineWidth = 6;
    ctx.beginPath();
    trail.forEach((p, j) => {
      const y = p.y + (i - 2.5) * 6 + Math.sin(t * 12 + j * 0.5) * 2;
      if (j === 0) ctx.moveTo(p.x, y);
      else ctx.lineTo(p.x, y);
    });
    ctx.stroke();
  });
  ctx.restore();
}

function drawSpeedLines() {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineWidth = 3;
  speedLines.forEach((s, i) => {
    ctx.strokeStyle = i % 3 ? 'rgba(255, 255, 255, 0.5)' : RAINBOW[i % RAINBOW.length];
    const y = 20 + s.y * (L.trackBottom - 40);
    ctx.beginPath();
    ctx.moveTo(s.x, y);
    ctx.lineTo(s.x + s.len, y);
    ctx.stroke();
  });
  ctx.restore();
}

function draw(dt) {
  ctx.setTransform(pxScale, 0, 0, pxScale, 0, 0);
  const zooming = state === 'race' && player.boost > 0;
  drawSky(ctx, L, t, dt, scroll);
  drawScenery(ctx, L, scroll);
  drawTrack(ctx, L, scroll, t, pxScale, zooming ? 1 : 0);

  drawRunner(rival, L.backRow);
  for (const item of items) {
    if (item.x < -80 || item.x > W + 80) continue;
    const y = L.itemRow - item.h;
    if (item.kind === 'candy') drawCandy(ctx, item.x, y + Math.sin(item.spin * 4) * 3, item.look, item.spin);
    else if (item.kind === 'jelly') drawJelly(ctx, item.x, L.itemRow, t + item.spin, item.squish, item.look);
    else drawRainbowPickup(ctx, item.x, y + Math.sin(item.spin * 3) * 5, t);
  }
  drawTrail();
  drawRunner(player, L.frontRow);
  if (zooming) drawSpeedLines();
  particles.draw(ctx);
  drawForeground(ctx, L, scroll);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  draw(dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Handy for testing from the browser console.
window.game = {
  get state() { return state; }, player, rival, startRace, keys, jump: () => jump(player), tick: update,
  get items() { return items; }, get speed() { return speed; },
  get timeLeft() { return timeLeft; }, set timeLeft(v) { timeLeft = v; },
};
