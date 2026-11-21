// Rocket-punch boxing: punch at the webcam (or press a key) and your glove rockets across the ring.
// Head punch = 100 damage, body punch = 50. The opponent has 1000 health; 0 = YOU WIN.
// The game is drawn on a small 256x144 picture and scaled up with big crisp pixels.
import { keys } from './kit/input.js';
import { startLoop } from './kit/loop.js';
import { roundTimer } from './kit/timer.js';
import { W, H, COLORS, drawArena, drawShadow, drawNumber } from './game/scene.js';
import { loadArt } from './game/art.js';
import { flame, starBurst, popWord, playFrames, drawEffects, drawDizzy, clearEffects } from './game/effects.js';
import { sfx, wakeSound } from './game/sfx.js';
import { startPunchCam, cameraTrouble } from './game/punch-cam.js';

// Rules: the Team's win rule plus first-version guesses, all easy to change.
export const RULES = {
  health: 1000,
  damage: { head: 100, body: 50 },
  roundSeconds: 75,        // guess
  gloveSpeed: 330,         // pixels per second, flying out
  returnSpeed: 260,        // flying back
  guardOpen: [1.4, 2.8],   // guess: seconds the opponent stays open (random between)
  guardUp: [0.7, 1.3],     // guess: seconds the guard stays up (it blocks HEAD punches only)
};

// Where things are on the 256x144 picture (boxer frames are 64x72).
const PLAYER_X = 14, OPP_X = 178, BOXER_Y = 54;
const LAUNCH_TIP = PLAYER_X + 78;           // the glove's front edge when it leaves the arm
const HIT_TIP = OPP_X + 18;                 // ...and when it reaches the opponent
const ARM_Y = BOXER_Y + 33;                 // height of the punching arm: the glove leaves from here
const AIM_Y = { head: BOXER_Y + 20, body: BOXER_Y + 41 };
const GLOVE_TIP = 46, GLOVE_MID = 12;       // front edge and middle height inside the rocket-glove frame

// ---------- pictures ----------
const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const pixels = document.createElement('canvas');
pixels.width = W; pixels.height = H;
const g = pixels.getContext('2d');

const art = await loadArt();
const [P_IDLE, P_IDLE2, P_PUNCH] = art['player-boxer'];
const [O_IDLE, O_IDLE2, O_GUARD, O_HIT] = art['opponent-boxer'];

let view = { x: 0, y: 0, w: W, h: H };
function resize() {
  canvas.width = innerWidth * devicePixelRatio;
  canvas.height = innerHeight * devicePixelRatio;
  let s = Math.min(canvas.width / W, canvas.height / H);
  if (s >= 2) s = Math.floor(s);                       // whole-number scale = even pixels
  view = { w: W * s, h: H * s, x: Math.round((canvas.width - W * s) / 2), y: Math.round((canvas.height - H * s) / 2) };
}
addEventListener('resize', resize);
resize();

// ---------- screens ----------
const screens = {};
for (const el of document.querySelectorAll('.screen')) screens[el.id] = el;
const hint = document.getElementById('hint');
function show(id) {
  for (const [name, el] of Object.entries(screens)) el.classList.toggle('hidden', name !== id);
  hint.classList.toggle('hidden', id !== null);
}
function setHint() {
  hint.textContent = punchCam
    ? 'Punch high = HEAD 👊  low = BODY  (or ⬆️ / SPACE)'
    : '⬆️ or W = HEAD punch 👊  SPACE or ⬇️ = BODY punch';
}

// ---------- game state ----------
const game = window.game = {
  state: 'title', health: RULES.health, hits: 0, camera: 'off', rules: RULES,
  punch: (aim = 'body') => fire(aim),   // handy for testing: window.game.punch('head')
};
let punchCam = null;
let glove = { mode: 'home', aim: 'body', x: 0, y: 0, vx: 0, vy: 0 };
let guard = { up: false, t: 2 };
let wobble = 0, excite = 0, endTimer = 0, time = 0;

const timer = roundTimer(RULES.roundSeconds, { onEnd: () => finish('timeup') });
// for checks from the console: game.debug.guard.up = true; game.debug.timer.reset(3)
game.debug = { get guard() { return guard; }, timer };

function rand([a, b]) { return a + Math.random() * (b - a); }

function startRound() {
  wakeSound();
  game.state = 'playing';
  game.health = RULES.health;
  game.hits = 0;
  glove = { mode: 'home', aim: 'body', x: 0, y: 0, vx: 0, vy: 0 };
  guard = { up: false, t: rand(RULES.guardOpen) };
  wobble = 0; excite = 0; endTimer = 0;
  timer.reset();
  clearEffects();
  show(null);
  setHint();
  popWord('FIGHT!', W / 2, 48, COLORS.sparkle, 22);
  sfx.bell();
}

function fire(aim) {
  if (game.state !== 'playing' || glove.mode !== 'home') return;
  glove = { mode: 'out', aim, x: LAUNCH_TIP, y: ARM_Y, vx: RULES.gloveSpeed, vy: 0 };
  sfx.whoosh();
}

function finish(result) {
  if (game.state !== 'playing') return;
  game.state = result;          // 'win' or 'timeup'
  endTimer = result === 'win' ? 1.4 : 0.6;
  if (result === 'win') { sfx.win(); starBurst(OPP_X + 32, BOXER_Y + 16, 30); }
  else { sfx.bell(); popWord('TIME!', W / 2, 48, COLORS.rope, 22); }
}

// ---------- camera ----------
async function askCamera() {
  game.state = 'camera';
  game.camera = 'asking';
  show('camera-screen');
  try {
    punchCam = await startPunchCam();
    game.camera = 'on';
    if (game.state === 'camera') startRound();
    else setHint();
  } catch (e) {
    game.camera = 'failed';
    if (game.state !== 'camera') return;      // already playing with keys: just keep going
    game.state = 'camera-failed';
    document.getElementById('camera-trouble').textContent = cameraTrouble(e.reason);
    show('camera-failed-screen');
  }
}

document.getElementById('play').addEventListener('click', () => {
  wakeSound();
  if (game.camera === 'off') askCamera();
  else startRound();
});
for (const id of ['skip-camera', 'play-keys', 'again-win', 'again-time']) {
  document.getElementById(id).addEventListener('click', startRound);
}

// ---------- update ----------
function update(dt, now) {
  time = now;
  const head = keys.pressed('ArrowUp') || keys.pressed('KeyW');
  const body = keys.pressed('Space') || keys.pressed('ArrowDown') || keys.pressed('KeyS');
  if (game.state === 'playing') {
    if (head) fire('head');
    else if (body) fire('body');
  } else if ((head || body || keys.pressed('Enter')) && (game.state === 'camera' || game.state === 'camera-failed')) {
    startRound();
  }
  const camPunch = punchCam && punchCam.update(dt);
  if (camPunch) fire(camPunch);

  if (game.state === 'playing') {
    timer.update(dt);
    // the opponent raises and drops its guard
    if (wobble <= 0) {
      guard.t -= dt;
      if (guard.t <= 0) { guard.up = !guard.up; guard.t = rand(guard.up ? RULES.guardUp : RULES.guardOpen); }
    }
  }
  if (game.state === 'win' || game.state === 'timeup') {
    if (endTimer > 0 && (endTimer -= dt) <= 0) {
      const done = RULES.health - game.health;
      document.getElementById('time-hits').textContent = `You did ${done} damage with ${game.hits} ${game.hits === 1 ? 'hit' : 'hits'}! ⭐`;
      show(game.state === 'win' ? 'win-screen' : 'timeup-screen');
    }
    if (game.state === 'win' && Math.random() < dt * 3) starBurst(30 + Math.random() * 196, 16 + Math.random() * 50, 8);
  }
  wobble = Math.max(0, wobble - dt);
  excite = Math.max(game.state === 'win' ? 1 : 0, excite - dt * 0.7);

  moveGlove(dt);
  draw(dt);
}

function moveGlove(dt) {
  if (glove.mode === 'out') {
    glove.x += glove.vx * dt;
    // steer from arm height up to the head or down to the body during the first part of the flight
    const k = Math.min(1, (glove.x - LAUNCH_TIP) / 45);
    glove.y = ARM_Y + (AIM_Y[glove.aim] - ARM_Y) * k * (2 - k);
    flame(glove.x - 40, glove.y);
    if (glove.x >= HIT_TIP && game.state === 'playing') {
      if (glove.aim === 'head' && guard.up && wobble <= 0) {
        glove.mode = 'bounce'; glove.vx = -RULES.returnSpeed; glove.vy = -120;
        popWord('BOING!', HIT_TIP - 4, glove.y - 14, COLORS.rope, 11);
        sfx.boing();
      } else {
        const dmg = RULES.damage[glove.aim];
        game.hits++;
        game.health = Math.max(0, game.health - dmg);
        playFrames(art['stars-burst'], HIT_TIP + 2, glove.y);
        starBurst(HIT_TIP, glove.y, glove.aim === 'head' ? 12 : 7);
        popWord(glove.aim === 'head' ? 'POW!' : 'BAM!', HIT_TIP - 10, glove.y - 16, COLORS.sparkle, 12);
        popWord(`-${dmg}`, HIT_TIP + 26, glove.y - 6, COLORS.rope, 9);
        sfx.pow();
        wobble = 0.5; excite = 1;
        guard = { up: false, t: rand(RULES.guardOpen) };
        glove.mode = 'back'; glove.vx = -RULES.returnSpeed;
        if (game.health === 0) finish('win');
      }
    } else if (glove.x > W + 50) { glove.mode = 'back'; glove.vx = -RULES.returnSpeed; }
  } else if (glove.mode === 'back' || glove.mode === 'bounce') {
    glove.x += glove.vx * dt;
    if (glove.mode === 'bounce') { glove.y += glove.vy * dt; glove.vy += 500 * dt; glove.y = Math.min(glove.y, ARM_Y); }
    else glove.y += (ARM_Y - glove.y) * Math.min(1, dt * 4);
    if (glove.x <= LAUNCH_TIP) glove.mode = 'home';
  }
}

// ---------- drawing ----------
function put(img, x, y) { g.drawImage(img, Math.round(x), Math.round(y)); }

function drawHealth() {
  const x = 160, y = 6, w = 86, h = 6;
  g.fillStyle = COLORS.outline; g.fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle = '#3a1d2a'; g.fillRect(x, y, w, h);
  const fill = Math.round((w * game.health) / RULES.health);
  g.fillStyle = '#f0662c'; g.fillRect(x, y, fill, h);
  g.fillStyle = '#ffb07a'; g.fillRect(x, y, fill, 2);
  drawNumber(g, game.health, x + w, y + h + 3, COLORS.rope, 1, 'right');
  // little orange head as a label
  g.fillStyle = COLORS.outline; g.fillRect(x - 12, y - 3, 9, 11);
  g.fillStyle = '#f6c08e'; g.fillRect(x - 11, y + 1, 7, 6);
  g.fillStyle = '#f0662c'; g.fillRect(x - 11, y - 2, 7, 4);
  g.fillStyle = COLORS.outline; g.fillRect(x - 9, y + 3, 1, 2); g.fillRect(x - 6, y + 3, 1, 2);
}

function draw(dt) {
  drawArena(g, time, excite);
  drawShadow(g, PLAYER_X + 32, 121, 40);
  drawShadow(g, OPP_X + 32, 121, 40);

  // player: two idle frames for breathing, the punch frame while the glove is away
  const breathe = Math.floor(time * 2.5) % 2;
  put(glove.mode === 'home' ? (breathe ? P_IDLE2 : P_IDLE) : P_PUNCH, PLAYER_X, BOXER_Y);

  // opponent: wobbles when hit, guard up or open, dizzy after the knockout
  const won = game.state === 'win';
  let ox = OPP_X, oy = BOXER_Y, pose = breathe ? O_IDLE : O_IDLE2;
  if (won) { pose = O_HIT; oy += 3; ox += Math.sin(time * 6) * 2; }
  else if (wobble > 0) { pose = O_HIT; ox += Math.sin(wobble * 40) * 2 * (wobble / 0.5) + 3; }
  else if (guard.up && game.state === 'playing') pose = O_GUARD;
  put(pose, ox, oy);
  if (won || wobble > 0) drawDizzy(g, ox + 34, oy + 4, time);

  // the flying rocket glove
  if (glove.mode !== 'home') {
    const frames = art['rocket-glove'];
    const img = frames[Math.floor(time * 12) % frames.length];
    if (glove.mode === 'out') put(img, glove.x - GLOVE_TIP, glove.y - GLOVE_MID);
    else {
      // flying home: turn the rocket around so the flame points at the opponent
      g.save();
      g.translate(Math.round(glove.x - GLOVE_TIP + img.width), Math.round(glove.y - GLOVE_MID));
      g.scale(-1, 1);
      g.drawImage(img, 0, 0);
      g.restore();
    }
  }

  drawEffects(g, dt);
  if (game.state === 'playing' || game.state === 'win' || game.state === 'timeup') {
    drawHealth();
    drawNumber(g, Math.ceil(timer.left), W / 2, 5, timer.left <= 10 ? COLORS.sparkle : COLORS.rope, 2, 'center');
  }

  // scale the small picture up onto the screen
  ctx.fillStyle = COLORS.navy;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(pixels, view.x, view.y, view.w, view.h);

  // the player's own mirrored camera picture, top-left
  if (punchCam) {
    const cw = view.w * 0.2, ch = cw * 0.75;
    punchCam.draw(ctx, view.x + view.w * 0.012, view.y + view.h * 0.02, cw, ch);
  }
}

startLoop(update);
