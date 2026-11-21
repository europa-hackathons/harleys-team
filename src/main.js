// Rocket-punch boxing: punch at the webcam (or press a key) and your glove rockets across the ring.
// Head punch = 100 damage, body punch = 50. Every boxer has 1000 health; 0 = knocked out.
// 2 PLAYERS (default): teal (left half of the camera) fights orange (right half); duck to dodge HIGH fists.
// 1 PLAYER: teal against the orange computer boxer, which raises its guard but doesn't punch back.
// Before each fight a big WHEEL picks your boxer (2 players: P1 spins, then P2). ZEUS (1%) has THUNDER fists: 150 damage.
// Testing: ?zeus=1 in the URL, or hold Z while spinning, always lands on Zeus.
// The game is drawn on a small 256x144 picture and scaled up with big crisp pixels.
import { keys } from './kit/input.js';
import { startLoop } from './kit/loop.js';
import { roundTimer } from './kit/timer.js';
import { W, H, COLORS, drawArena, drawShadow, drawNumber } from './game/scene.js';
import { loadArt } from './game/art.js';
import { flame, zap, bolt, starBurst, popWord, playFrames, drawEffects, drawDizzy, clearEffects } from './game/effects.js';
import { sfx, wakeSound } from './game/sfx.js';
import { startPunchCam, cameraTrouble, DUCK } from './game/punch-cam.js';
import { DUCK_DROP } from './game/poses.js';
import { makeSumoFinish, SUMO } from './game/sumo-finish.js';
import { buildRoster } from './game/roster.js';
import { makeWheel, drawReveal } from './game/wheel.js';

// Rules: the Team's win rule plus first-version guesses, all easy to change.
export const RULES = {
  health: 1000,
  damage: { head: 100, body: 50 },
  thunderDamage: 150,      // Zeus's thunder fist, head or body (a duck still dodges a high one)
  roundSeconds: 75,        // guess (1 player only; 2 players fight until someone is knocked out)
  gloveSpeed: 330,         // pixels per second, flying out
  returnSpeed: 260,        // flying back
  guardOpen: [1.4, 2.8],   // guess: seconds the computer boxer stays open (random between)
  guardUp: [0.7, 1.3],     // guess: seconds its guard stays up (it blocks HEAD punches only)
  walkSpeed: 70,           // pixels per second the boxer walks (keys, and catching up with your body on the webcam)
  duckTime: DUCK.hold,     // seconds a duck lasts (tune it in DUCK in src/game/punch-cam.js)
};

// Where things are on the 256x144 picture (boxer frames are 64x72).
const BOXER_Y = 54;
const START_X = [14, 178];
// how far each boxer can walk: 1 player = the orange computer stands still; 2 players = each in their own half
const RANGE = { 1: [[4, 60], [178, 178]], 2: [[4, 60], [132, 188]] };
const LAUNCH_OFFSET = 78;                   // the glove's front edge, from the boxer's back edge, when it leaves the arm
const HIT_DEPTH = 18;                       // the glove hits this far into the other boxer's frame
const ARM_Y = BOXER_Y + 33;                 // height of the punching arm: the glove leaves from here
const AIM_Y = { head: BOXER_Y + 20, body: BOXER_Y + 41 };
const GLOVE_TIP = 46, GLOVE_MID = 12;       // front edge and middle height inside the rocket-glove frame

// Keys for each player in each mode.
const CONTROLS = {
  1: [{ head: ['ArrowUp', 'KeyW'], body: ['Space', 'ArrowDown', 'KeyS'], duck: [], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'] }],
  2: [
    { head: ['KeyW'], body: ['KeyS'], duck: ['KeyX'], left: ['KeyA'], right: ['KeyD'] },
    { head: ['ArrowUp'], body: ['ArrowDown'], duck: ['ShiftRight', 'Slash'], left: ['ArrowLeft'], right: ['ArrowRight'] },
  ],
};
const KEY_TEXT = {
  1: '⬅️ ➡️ / A D = walk · ⬆️ / W = head · SPACE / ⬇️ = body',
  2: 'P1: W high · S low · X duck · A D walk  —  P2: ⬆️ high · ⬇️ low · ⇧ Shift / - duck · ⬅️ ➡️ walk',
};
const anyPressed = (codes) => codes.some((c) => keys.pressed(c));
const anyHeld = (codes) => codes.some((c) => keys.held(c));

// ---------- pictures ----------
const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const pixels = document.createElement('canvas');
pixels.width = W; pixels.height = H;
const g = pixels.getContext('2d');

const art = await loadArt();
// every boxer on the wheel, with poses for both sides and rocket gloves facing right (flipped when flying left)
const roster = buildRoster(art);
const wheel = makeWheel(roster);
const FORCE_ZEUS = new URLSearchParams(location.search).get('zeus') === '1';
const sumo = makeSumoFinish(art['sumo'], art['sumo-dust']);

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
  if (game.mode === 2) {
    hint.textContent = punchCam
      ? 'Stand at the edges 👯  Punch into the HIGH / LOW boxes in the middle 👊  DUCK to dodge!'
      : 'P1: W S X · A D    P2: ⬆️ ⬇️ ⇧ · ⬅️ ➡️    X / ⇧ = DUCK';
  } else {
    hint.textContent = punchCam
      ? 'Stand on the left 🚶  Punch right into the HEAD / BODY boxes 👊'
      : '⬅️ ➡️ walk  ⬆️ / W = HEAD 👊  SPACE / ⬇️ = BODY';
  }
}
function setMode(n) {
  game.mode = n;
  for (const el of document.querySelectorAll('.keys')) el.textContent = KEY_TEXT[n];
  if (punchCam && punchCam.players !== n) punchCam.setPlayers(n);
}

// ---------- game state ----------
function makeFighter(side) {
  return { side, dir: side ? -1 : 1, x: START_X[side], minX: 0, maxX: 0, health: RULES.health, hits: 0, damage: 0, headHits: 0, bodyHits: 0,
    glove: { mode: 'home', aim: 'body', x: 0, y: 0, vx: 0, vy: 0 }, wobble: 0, duck: 0, walking: 0, boxer: roster[side ? 'orange' : 'teal'] };
}
const fighters = [makeFighter(0), makeFighter(1)];
const [teal, orange] = fighters;

const game = window.game = {
  state: 'title', mode: 2, winner: null, loser: null, camera: 'off', rules: RULES, fighters,
  picks: ['teal', 'orange'],                                       // boxer ids from the wheel, P1 and P2
  spin: () => doSpin(),                                            // like a click on the wheel
  get wheel() { return wheel.phase; },
  get health() { return orange.health; },   // 1 player: the opponent's health
  get hits() { return teal.hits; },
  punch: (aim = 'body', who = 0) => fire(fighters[who], aim),   // handy for testing: game.punch('head', 1)
  duck: (who = 0) => startDuck(fighters[who]),                   // game.duck(1)
  get sumo() { return sumo.active ? sumo.time : null; },          // seconds into the sumo finish, or null
};
let punchCam = null;
let guard = { up: false, t: 2 };
let excite = 0, time = 0;
let shakeT = 0, flashT = 0;      // thunder: screen shake and white flash (seconds left)
let spin = { who: 0, t: 0, boxer: null };

const timer = roundTimer(RULES.roundSeconds, { onEnd: () => finish(null) });
// for checks from the console: game.debug.guard.up = true; game.debug.timer.reset(3)
game.debug = { get guard() { return guard; }, get cam() { return punchCam; }, timer, fighters, roster, forceZeus: FORCE_ZEUS };

function rand([a, b]) { return a + Math.random() * (b - a); }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const launchTip = (f) => (f.dir > 0 ? f.x + LAUNCH_OFFSET : f.x + 64 - LAUNCH_OFFSET);
const hitTip = (target, dir) => (dir > 0 ? target.x + HIT_DEPTH : target.x + 64 - HIT_DEPTH);

function startRound() {
  wakeSound();
  game.state = 'playing';
  game.winner = null; game.loser = null;
  sumo.stop();
  for (const f of fighters) {
    Object.assign(f, makeFighter(f.side));
    [f.minX, f.maxX] = RANGE[game.mode][f.side];
    f.boxer = roster[game.picks[f.side]] || f.boxer;
  }
  guard = { up: false, t: rand(RULES.guardOpen) };
  excite = 0;
  timer.reset();
  clearEffects();
  show(null);
  setHint();
  popWord('FIGHT!', W / 2, 48, COLORS.sparkle, 22);
  sfx.bell();
}

// ---------- the wheel ----------
const wheelTitle = document.getElementById('wheel-title'), wheelHelp = document.getElementById('wheel-help');
const SIDE_COLOR = ['#1fb8b0', '#f0662c'];
function startWheel() {
  wakeSound();
  game.state = 'wheel';
  game.winner = null; game.loser = null;
  sumo.stop();
  game.picks = game.mode === 2 ? [null, null] : [null, 'orange'];   // 1 player: the computer stays orange
  spin = { who: 0, t: 0, boxer: null };
  wheel.reset();
  clearEffects();
  show('wheel-screen');
  wheelText();
}
function wheelText() {
  const who = game.mode === 2 ? `<span style="color:${SIDE_COLOR[spin.who]}">P${spin.who + 1}</span> ` : '';
  const b = spin.boxer;
  wheelTitle.classList.toggle('zeus', !!(b && b.thunder));
  if (wheel.phase === 'ready') {
    wheelTitle.innerHTML = `${who}SNURRA! <span class="en">${who}SPIN THE WHEEL!</span>`;
    wheelHelp.textContent = punchCam ? '👊 Punch · SPACE · click to spin!' : 'SPACE · click to spin!';
  } else if (wheel.phase === 'spinning') {
    wheelHelp.textContent = '🎡 ...';
  } else if (b.thunder) {
    wheelTitle.innerHTML = `⚡ ZEUS! ⚡<span class="en">${who || 'YOU '}GOT THE SUPER RARE ONE! (1%)</span>`;
    wheelHelp.textContent = '⚡ Thunder fists: 150 damage! ⚡';
  } else {
    wheelTitle.innerHTML = `${who || 'DU FICK · YOU GOT: '}<span style="color:${b.color}">${b.name}!</span>`;
    wheelHelp.textContent = 'Click · SPACE to go on';
  }
}
function doSpin() {
  if (game.state !== 'wheel') return;
  if (wheel.phase === 'ready') {
    wheel.spin(FORCE_ZEUS || game.debug.forceZeus || keys.held('KeyZ') ? 'zeus' : undefined);
    wheelText();
  } else if (wheel.phase === 'stopped' && spin.t > 1) nextSpinner();
}
function nextSpinner() {
  if (game.mode === 2 && spin.who === 0) { spin = { who: 1, t: 0, boxer: null }; wheel.reset(); wheelText(); }
  else startRound();
}
// the wheel stopped on boxer b
function landed(b) {
  game.picks[spin.who] = b.id;
  spin.boxer = roster[b.id];
  spin.t = 0;
  wheelText();
  if (b.thunder) {
    flashT = 0.6; shakeT = 0.9;
    sfx.thunder();
    for (const x of [60, 128, 196]) bolt(x + Math.random() * 20 - 10, 0, 128 + (x - 128) * 0.3, 70, 0.5);
    starBurst(128, 70, 30);
  } else {
    sfx.reveal();
    starBurst(128, 60, 18);
  }
}
document.getElementById('wheel-screen').addEventListener('pointerdown', doSpin);

function fire(f, aim) {
  if (game.state !== 'playing' || f.glove.mode !== 'home' || f.duck > 0) return;
  if (game.mode === 1 && f.side === 1) return;   // the computer boxer doesn't punch (yet)
  const x = launchTip(f);
  f.glove = { mode: 'out', aim, x, from: x, y: ARM_Y, vx: 0, vy: 0, dodged: false };
  sfx.whoosh();
}

function startDuck(f) {
  if (game.state !== 'playing' || game.mode !== 2) return;
  f.duck = Math.max(f.duck, RULES.duckTime);
}

// winner: the fighter who won, or null when time ran out (1 player)
function finish(winner) {
  if (game.state !== 'playing') return;
  game.state = winner ? 'win' : 'timeup';
  game.winner = winner ? (game.mode === 1 ? 'player' : winner.side ? 'orange' : 'teal') : null;
  // the loser: whoever was knocked out, or the player when time runs out (1 player)
  const loser = winner ? fighters[1 - winner.side] : teal;
  game.loser = loser.side ? 'orange' : 'teal';
  if (winner) { sfx.win(); starBurst(loser.x + 32, BOXER_Y + 16, 20); }
  else { sfx.bell(); popWord('TIME!', W / 2, 48, COLORS.rope, 22); }
  // the Sumo finish: he lands on the loser, then hops toward the middle of the ring
  const cx = loser.x + (loser.side ? 30 : 34);
  sumo.start(cx, cx < W / 2 ? 1 : -1);
}

function skipSumo() {
  if (sumo.active && sumo.time > SUMO.skipAfter) { sumo.stop(); showEndScreen(); }
}
addEventListener('keydown', skipSumo);
canvas.addEventListener('pointerdown', skipSumo);

// Score cards for the results screen: damage dealt, hits, head hits and body hits for each side.
function scoreCards() {
  const who = game.mode === 2
    ? [[teal, `P1 · ${teal.boxer.name}`], [orange, `P2 · ${orange.boxer.name}`]]
    : [[teal, `DU · YOU · ${teal.boxer.name}`]];
  return who.map(([f, name]) => {
    const color = f.side ? 'orange' : 'teal';
    const crown = game.winner === color || (game.winner === 'player' && !f.side) ? ' 🏆' : '';
    return `<div class="score-card ${color}"><h3>${name}${crown}</h3>
      <dl><dt>💥 Skada · Damage</dt><dd>${f.damage}</dd>
      <dt>👊 Träffar · Hits</dt><dd>${f.hits}</dd>
      <dt>🙂 Huvud · Head</dt><dd>${f.headHits}</dd>
      <dt>👕 Kropp · Body</dt><dd>${f.bodyHits}</dd></dl></div>`;
  }).join('');
}

function showEndScreen() {
  if (game.state === 'timeup') {
    document.getElementById('time-hits').textContent = `Sumo got you! 😄 You did ${teal.damage} damage ⭐`;
    document.getElementById('time-scores').innerHTML = scoreCards();
    show('timeup-screen');
    return;
  }
  document.getElementById('win-scores').innerHTML = scoreCards();
  const title = document.getElementById('win-title'), sub = document.getElementById('win-sub');
  title.className = 'title win';
  if (game.winner === 'teal' || game.winner === 'orange') {
    const w = game.winner === 'teal' ? teal : orange, n = w.side + 1;
    title.style.color = w.boxer.color;
    title.textContent = `P${n} ${w.boxer.name} WINS! ⭐`;
    sub.innerHTML = `P${n} vann! <span class="en">Player ${n} (${w.side ? 'right' : 'left'}) wins!</span>`;
  } else { title.style.color = ''; title.textContent = 'YOU WIN! ⭐'; sub.innerHTML = 'Du vann! <span class="en">What a rocket punch!</span>'; }
  show('win-screen');
}

// ---------- camera ----------
async function askCamera() {
  game.state = 'camera';
  game.camera = 'asking';
  show('camera-screen');
  try {
    punchCam = await startPunchCam(game.mode);
    game.camera = 'on';
    if (game.state === 'camera') startWheel();
    else { setHint(); if (game.state === 'wheel') wheelText(); }
  } catch (e) {
    game.camera = 'failed';
    if (game.state !== 'camera') return;      // already playing with keys: just keep going
    game.state = 'camera-failed';
    document.getElementById('camera-trouble').textContent = cameraTrouble(e.reason);
    show('camera-failed-screen');
  }
}

function play(mode) {
  wakeSound();
  setMode(mode);
  if (game.camera === 'off') askCamera();
  else startWheel();
}
document.getElementById('play').addEventListener('click', () => play(2));
document.getElementById('play-1p').addEventListener('click', () => play(1));
for (const id of ['skip-camera', 'play-keys', 'again-win', 'again-time']) {
  document.getElementById(id).addEventListener('click', startWheel);
}
for (const id of ['menu', 'menu-time']) {
  document.getElementById(id).addEventListener('click', () => { game.state = 'title'; sumo.stop(); show('title-screen'); });
}
setMode(2);

// ---------- update ----------
function update(dt, now) {
  time = now;
  const ctrls = CONTROLS[game.mode];
  if (game.state === 'playing') {
    ctrls.forEach((c, i) => {
      const f = fighters[i];
      if (anyPressed(c.duck)) startDuck(f);
      if (f.duck > 0 && anyHeld(c.duck)) f.duck = Math.max(f.duck, 0.1);   // holding the key keeps you down
      if (anyPressed(c.head)) fire(f, 'head');
      else if (anyPressed(c.body)) fire(f, 'body');
    });
  } else if (game.state === 'wheel') {
    const c = ctrls[spin.who] || ctrls[0];
    if (keys.pressed('Space') || keys.pressed('Enter') || anyPressed(c.head) || anyPressed(c.body)) doSpin();
  } else if (keys.pressed('Enter') && (game.state === 'camera' || game.state === 'camera-failed')) {
    startWheel();
  } else if (game.state === 'camera' || game.state === 'camera-failed') {
    if (ctrls.some((c) => anyPressed(c.head) || anyPressed(c.body))) startWheel();
  }
  const camMoves = punchCam ? punchCam.update(dt) : [];
  camMoves.forEach((move, i) => {
    if (game.state === 'wheel') { if ((move === 'head' || move === 'body') && (i === spin.who || game.mode === 1)) doSpin(); }
    else if (move === 'duck') startDuck(fighters[i]);
    else if (move) fire(fighters[i], move);
  });

  if (game.state === 'wheel') {
    const got = wheel.update(dt);
    if (got) landed(got);
    if (wheel.phase === 'stopped') {
      spin.t += dt;
      if (spin.boxer.thunder && Math.random() < dt * 3) bolt(40 + Math.random() * 176, 0, 128 + Math.random() * 40 - 20, 40 + Math.random() * 40, 0.25);
      if (spin.t > (spin.boxer.thunder ? 4.5 : 2.8)) nextSpinner();
    }
  }
  shakeT = Math.max(0, shakeT - dt);
  flashT = Math.max(0, flashT - dt);

  if (game.state === 'playing') {
    ctrls.forEach((c, i) => walk(fighters[i], dt, c, punchCam && punchCam.bodies[i]));
    if (game.mode === 1) {
      timer.update(dt);
      // the computer boxer raises and drops its guard
      if (orange.wobble <= 0) {
        guard.t -= dt;
        if (guard.t <= 0) { guard.up = !guard.up; guard.t = rand(guard.up ? RULES.guardUp : RULES.guardOpen); }
      }
    }
  }
  if (game.state === 'win' || game.state === 'timeup') {
    if (sumo.active && sumo.update(dt)) { sumo.stop(); showEndScreen(); }
    if (game.state === 'win' && Math.random() < dt * 3) starBurst(30 + Math.random() * 196, 16 + Math.random() * 50, 8);
  }
  for (const f of fighters) {
    f.wobble = Math.max(0, f.wobble - dt);
    f.duck = Math.max(0, f.duck - dt);
  }
  excite = Math.max(game.state === 'win' ? 1 : 0, excite - dt * 0.7);

  for (const f of fighters) moveGlove(f, dt);
  draw(dt);
}

// Walk a boxer: keys walk it; on the webcam it walks toward where that player's body is.
function walk(f, dt, c, tracker) {
  const keyDir = (anyHeld(c.right) ? 1 : 0) - (anyHeld(c.left) ? 1 : 0);
  const step = RULES.walkSpeed * dt;
  const before = f.x;
  if (keyDir) f.x += keyDir * step;
  else if (tracker && tracker.walkX !== null) {
    const target = f.minX + tracker.walkX * (f.maxX - f.minX);
    const gap = target - f.x;
    if (Math.abs(gap) > 1) f.x += Math.sign(gap) * Math.min(Math.abs(gap), step);
  }
  f.x = clamp(f.x, f.minX, f.maxX);
  f.walking = Math.abs(f.x - before) > 0.01 ? 0.15 : Math.max(0, f.walking - dt);
}

function moveGlove(f, dt) {
  const gl = f.glove, d = f.dir, foe = fighters[1 - f.side];
  if (gl.mode === 'out') {
    gl.x += d * RULES.gloveSpeed * dt;
    const tip = hitTip(foe, d);
    if (gl.dodged) gl.y = Math.max(BOXER_Y + 2, gl.y - 60 * dt);   // sails up over the ducking boxer
    else {
      // steer from arm height up to the head or down to the body during the first part of the flight
      const span = clamp(Math.abs(tip - gl.from) * 0.6, 10, 45);
      const k = clamp(Math.abs(gl.x - gl.from) / span, 0, 1);
      gl.y = ARM_Y + (AIM_Y[gl.aim] - ARM_Y) * k * (2 - k);
    }
    if (f.boxer.thunder) zap(gl.x - d * 44, gl.y, d);
    else flame(gl.x - d * 40, gl.y, 1, d);
    const reached = d > 0 ? gl.x >= tip : gl.x <= tip;
    if (reached && !gl.dodged && game.state === 'playing') {
      if (gl.aim === 'head' && foe.duck > 0) {
        gl.dodged = true;
        popWord('DODGE!', foe.x + 32, BOXER_Y + 8, COLORS.rope, 11);
        sfx.whoosh();
      } else if (game.mode === 1 && gl.aim === 'head' && guard.up && foe.wobble <= 0 && !f.boxer.thunder) {
        gl.mode = 'bounce'; gl.vy = -120;
        popWord('BOING!', tip - 4 * d, gl.y - 14, COLORS.rope, 11);
        sfx.boing();
      } else {
        const thunder = f.boxer.thunder;
        const dmg = thunder ? RULES.thunderDamage : RULES.damage[gl.aim];
        f.hits++; f.damage += dmg;
        if (gl.aim === 'head') f.headHits++; else f.bodyHits++;
        foe.health = Math.max(0, foe.health - dmg);
        playFrames(art['stars-burst'], tip + 2 * d, gl.y);
        starBurst(tip, gl.y, gl.aim === 'head' ? 12 : 7);
        popWord(thunder ? 'ZAP!' : gl.aim === 'head' ? 'POW!' : 'BAM!', tip - 10 * d, gl.y - 16, COLORS.sparkle, thunder ? 15 : 12);
        popWord(`-${dmg}`, tip + 26 * d, gl.y - 6, thunder ? '#ffffff' : COLORS.rope, thunder ? 11 : 9);
        if (thunder) {
          // THUNDER: a lightning bolt from the sky onto the target, a white flash and a shake
          bolt(tip + 6 * d, 0, tip, gl.y, 0.4);
          bolt(tip - 20 * d, 0, tip, gl.y, 0.3);
          flashT = 0.18; shakeT = 0.35;
          sfx.zap(); sfx.thunder();
        } else sfx.pow();
        foe.wobble = 0.5; foe.duck = 0; excite = 1;
        if (game.mode === 1) guard = { up: false, t: rand(RULES.guardOpen) };
        gl.mode = 'back';
        if (foe.health === 0) finish(f);
      }
    } else if (gl.x > W + 50 || gl.x < -50) gl.mode = 'back';
  } else if (gl.mode === 'back' || gl.mode === 'bounce') {
    gl.x -= d * RULES.returnSpeed * dt;
    if (gl.mode === 'bounce') { gl.y += gl.vy * dt; gl.vy += 500 * dt; gl.y = Math.min(gl.y, ARM_Y); }
    else gl.y += (ARM_Y - gl.y) * Math.min(1, dt * 4);
    if (d > 0 ? gl.x <= launchTip(f) : gl.x >= launchTip(f)) gl.mode = 'home';
  }
}

// ---------- drawing ----------
function put(img, x, y) { g.drawImage(img, Math.round(x), Math.round(y)); }
// a picture facing right (1) or flipped to face left (-1), with its column `anchor` placed at x
function putFacing(img, x, y, facing, anchor) {
  if (facing > 0) { put(img, x - anchor, y); return; }
  g.save();
  g.translate(Math.round(x + anchor), Math.round(y));
  g.scale(-1, 1);
  g.drawImage(img, 0, 0);
  g.restore();
}

// Health bar. side 0 = teal (top-left), side 1 = orange (top-right). In 1 player only orange's is shown.
function drawHealth(f) {
  const w = game.mode === 2 ? 70 : 86, h = 6, y = 6;
  const x = f.side ? (game.mode === 2 ? W - 22 - w : 160) : 22;
  const fillC = f.boxer.color, lightC = f.boxer.light;
  g.fillStyle = COLORS.outline; g.fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle = '#3a1d2a'; g.fillRect(x, y, w, h);
  const fill = Math.round((w * f.health) / RULES.health);
  // the bar empties toward the middle of the screen
  const fx = f.side && game.mode === 2 ? x + w - fill : x;
  g.fillStyle = fillC; g.fillRect(fx, y, fill, h);
  g.fillStyle = lightC; g.fillRect(fx, y, fill, 2);
  drawNumber(g, f.health, f.side ? x + w : x, y + h + 3, COLORS.rope, 1, f.side ? 'right' : 'left');
  // little head as a label, on the outside end of the bar
  const lx = f.side && game.mode === 2 ? x + w + 4 : x - 12;
  g.fillStyle = COLORS.outline; g.fillRect(lx, y - 3, 9, 11);
  g.fillStyle = '#f6c08e'; g.fillRect(lx + 1, y + 1, 7, 6);
  g.fillStyle = f.boxer.dark; g.fillRect(lx + 1, y - 2, 7, 4);
  g.fillStyle = f.boxer.color; g.fillRect(lx + 1, y + 1, 7, 1);
  g.fillStyle = COLORS.outline; g.fillRect(lx + 3, y + 3, 1, 2); g.fillRect(lx + 6, y + 3, 1, 2);
}

function drawFighter(f, breathe) {
  const p = f.boxer.poses[f.side];
  const lost = game.loser === (f.side ? 'orange' : 'teal');
  let x = f.x, y = BOXER_Y, pose = p.idle[breathe];
  const squash = lost ? sumo.squash() : null;
  const hop = f.walking > 0 ? -(Math.floor(time * 10) % 2) : 0;
  if (lost) { pose = p.hit; y += squash ? 0 : 3; x += squash ? 0 : Math.sin(time * 6) * 2; }
  else if (f.wobble > 0) { pose = p.hit; x += Math.sin(f.wobble * 40) * 2 * (f.wobble / 0.5) - 3 * f.dir; }
  else if (f.duck > 0) pose = p.duck[breathe];
  else if (f.glove.mode !== 'home') { pose = p.punch; y += hop; }
  else if (game.mode === 1 && f.side === 1 && guard.up && game.state === 'playing') pose = p.guard;
  else y += hop;
  if (squash) {
    // flattened like a pancake by the sumo (cartoon!), stretched around the feet
    const fx = x + (f.side ? 30 : 34), fy = y + 69;
    g.save(); g.translate(Math.round(fx), fy); g.scale(squash.sx, squash.sy);
    g.drawImage(pose, -(fx - x), -69); g.restore();
    if (squash.sy < 0.5) return;
    y = fy - 69 * squash.sy;
  } else put(pose, x, y);
  // 2 players: a P1 / P2 tag over each head, so two of the same boxer can be told apart
  if (game.mode === 2 && !lost) {
    const ty = y - 7 + (f.duck > 0 && f.wobble <= 0 ? DUCK_DROP : 0), tx = Math.round(x + 32);
    drawNumber(g, `P${f.side + 1}`, tx, ty, SIDE_COLOR[f.side], 1, 'center');
    g.fillStyle = SIDE_COLOR[f.side]; g.fillRect(tx - 1, ty + 6, 3, 1); g.fillRect(tx, ty + 7, 1, 1);
  }
  if (lost || f.wobble > 0) drawDizzy(g, x + (f.side ? 34 : 30), y + 4 + (f.duck > 0 ? DUCK_DROP : 0), time);
}

function drawGlove(f) {
  const gl = f.glove;
  if (gl.mode === 'home') return;
  const frames = f.boxer.glove;
  const img = frames[Math.floor(time * 12) % frames.length];
  if (gl.mode === 'out') putFacing(img, gl.x, gl.y - GLOVE_MID, f.dir, GLOVE_TIP);
  // flying home: turn the rocket around so the flame points at the other boxer
  else putFacing(img, gl.x - f.dir * 44, gl.y - GLOVE_MID, -f.dir, GLOVE_TIP);
}

function drawWheelScene(dt) {
  drawArena(g, time, 0.4);
  g.fillStyle = 'rgba(11, 18, 38, 0.55)';
  g.fillRect(0, 0, W, H);
  if (wheel.phase === 'stopped') drawReveal(g, spin.boxer, spin.t, time);
  else wheel.draw(g, time);
  // the boxers already picked, in the bottom corners
  game.picks.forEach((id, i) => {
    if (!id || (game.mode === 1 && i === 1) || (i === spin.who && wheel.phase === 'stopped')) return;
    const head = roster[id].head, x = i ? W - head.width - 6 : 6, y = H - head.height - 6;
    g.drawImage(head, x, y);
    drawNumber(g, `P${i + 1}`, x + head.width / 2, y - 7, SIDE_COLOR[i], 1, 'center');
  });
  drawEffects(g, dt);
}

function draw(dt) {
  if (game.state === 'wheel') { drawWheelScene(dt); present(); return; }
  drawArena(g, time, excite);
  for (const f of fighters) drawShadow(g, Math.round(f.x) + 32, 121, f.duck > 0 ? 46 : 40);
  sumo.drawShadow(g);
  const breathe = Math.floor(time * 2.5) % 2;
  for (const f of fighters) drawFighter(f, breathe);
  for (const f of fighters) drawGlove(f);
  sumo.draw(g, time);

  drawEffects(g, dt);
  if (game.state === 'playing' || game.state === 'win' || game.state === 'timeup') {
    if (game.mode === 2) { drawHealth(teal); drawHealth(orange); }
    else {
      drawHealth(orange);
      drawNumber(g, Math.ceil(timer.left), W / 2, 5, timer.left <= 10 ? COLORS.sparkle : COLORS.rope, 2, 'center');
    }
  }

  present();
}

// Scale the small picture up onto the screen (with any shake and thunder flash), plus the camera picture.
function present() {
  if (flashT > 0) {
    g.fillStyle = `rgba(255, 255, 235, ${Math.min(1, flashT / 0.2) * 0.85})`;
    g.fillRect(0, 0, W, H);
  }
  ctx.fillStyle = COLORS.navy;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  const shake = sumo.shake(), px = view.w / W;
  if (shakeT > 0) {
    const p = Math.min(1, shakeT / 0.4) * 4;
    shake.x += Math.round((Math.random() * 2 - 1) * p); shake.y += Math.round((Math.random() * 2 - 1) * p);
  }
  ctx.drawImage(pixels, view.x + shake.x * px, view.y + shake.y * px, view.w, view.h);

  // the players' own mirrored camera picture: top-left for 1 player, top-middle (both halves) for 2;
  // on the wheel it sits small in the top-left so the title stays readable
  if (punchCam) {
    const onWheel = game.state === 'wheel';
    const cw = view.w * (onWheel ? 0.18 : game.mode === 2 ? 0.27 : 0.2), ch = cw * 0.75;
    const cx = game.mode === 2 && !onWheel ? view.x + (view.w - cw) / 2 : view.x + view.w * 0.012;
    punchCam.draw(ctx, cx, view.y + view.h * 0.02, cw, ch);
  }
}

startLoop(update);
