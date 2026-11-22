// Rocket-punch boxing: punch at the webcam (or press a key) and your glove rockets across the ring.
// Head punch = 100 damage, body punch = 50. Every boxer has 1000 health; 0 = knocked out.
// 2 PLAYERS (default): teal (left half of the camera) fights orange (right half); duck to dodge HIGH fists.
// 1 PLAYER: 5 LEVELS against the computer (src/game/levels.js), each in a new place and harder: more health,
// more guarding, and faster rocket fists back (duck the HIGH ones; level 1 is gentle). Level 5 is the BOSS.
// Beat a level -> "LEVEL 2!"; the sumo lands on you -> GAME OVER; beat level 5 -> CHAMPION!
// Testing: ?level=3 in the URL starts 1 player at level 3; game.debug.level(5) jumps straight into a level.
// Before each fight a big WHEEL picks your boxer (2 players: P1 spins, then P2). ZEUS (rare: ZEUS_CHANCE in src/game/roster.js) has THUNDER fists: 150 damage.
// Testing: ?zeus=1 in the URL, or hold Z while spinning, always lands on Zeus.
// SUPER meter: dealing damage fills it (full at 300, see src/game/specials.js); then the next punch is your SPECIAL.
// Testing: game.fillSuper(0) fills P1's meter.
// GET READY (camera play only): before each fight a BIG camera picture shows each player's STAND HERE box;
// it turns green with a tick when someone moves in it. All boxes green for READY.startAfter s (or SPACE / click) = FIGHT.
// The game thinks in a small 256x144 picture ("game pixels": positions, hits, speeds), but it is DRAWN at screen
// resolution (RENDER below), so the art keeps all its detail: the place on a BACK layer, everything else on a front
// layer, so during a fight the camera picture can sit between them (behind the boxers).
import { keys } from './kit/input.js';
import { startLoop } from './kit/loop.js';
import { roundTimer } from './kit/timer.js';
import { W, H, COLORS, drawArena, drawShadow, drawNumber } from './game/scene.js';
import { PLACES, drawPlace, randomPlace, hasPicture } from './game/places.js';
import { blit, drawFacing, contentBox, lw, lh } from './game/sprite.js';
import { LEVELS, foeFor } from './game/levels.js';
import { loadArt } from './game/art.js';
import { flame, zap, bolt, starBurst, popWord, playFrames, drawEffects, drawDizzy, clearEffects, drip, bubbles, sizzle, fx, drawWord } from './game/effects.js';
import { SUPER, SPECIALS, specialTrail, drawVine, drawIvy, tinted, drawSuperMeter, drawSwirl, drawLava } from './game/specials.js';
import { sfx, wakeSound } from './game/sfx.js';
import { sound } from './kit/sound.js';
import { startPunchCam, trackBody, DUCK, READY } from './game/punch-cam.js';
import { DUCK_DROP } from './game/poses.js';
import { makeSumoFinish, SUMO } from './game/sumo-finish.js';
import { buildRoster, ZEUS_CHANCE } from './game/roster.js';
import { makeWheel, drawReveal } from './game/wheel.js';
import { drawPoseSheet, makeRecorder } from './game/qa.js';
import { t, boxerName, placeName, applyPage, toggleLang, onLangChange } from './game/i18n.js';

// Real sound effects (assets/audio/*.mp3) on top of the code-made bleeps: one per special, and SUPER READY.
// Volume and a little random pitch for each; M mutes everything.
const SPECIAL_SOUND = { water: 'special-water', flame: 'special-flame', ivy: 'special-ivy', poison: 'special-poison', storm: 'special-thunder', wind: 'special-wind' };
const SOUND_VOLUME = { special: 0.9, superReady: 0.7 };
const varied = (volume) => ({ volume, pitch: 0.92 + Math.random() * 0.16 });
sound.preload(...Object.values(SPECIAL_SOUND), 'super-ready');
// FIGHT MUSIC: each place has its own looping track (assets/audio/music-<place>.mp3), quieter than the effects.
// It starts when the fight starts and fades out on the end screens.
const MUSIC = { arena: 'music-arena', apartment: 'music-apartment', jungle: 'music-jungle', volcano: 'music-volcano', space: 'music-space', cliffside: 'music-arena' };
const MUSIC_VOLUME = 0.35;
const fightMusic = () => sound.music(MUSIC[game.place] || MUSIC.arena, { volume: MUSIC_VOLUME, fadeSeconds: 0.8 });
const stopFightMusic = () => sound.stopMusic(1.2);
// TITLE MUSIC: a short opening sting (music-intro, once per visit) flowing into the title loop (music-title,
// 150 BPM: the loop comes in 16 beats = 6.4 s into the sting and loops its 20 bars = 32 s). It plays on the
// title, camera, wheel and place screens, and the fight music crossfades over it. Browsers stay silent until the
// first tap, click or key, so it starts then (sound.js); see assets/audio/title-music-prompts.txt.
const titleMusic = () => sound.music('music-title', { volume: 0.4, fadeSeconds: 0.8, intro: 'music-intro', introSeconds: 6.4, loopEnd: 32 });
titleMusic();

// Rules: the Team's win rule plus first-version guesses, all easy to change.
export const RULES = {
  health: 1000,
  damage: { head: 100, body: 50 },
  thunderDamage: 150,      // Zeus's thunder fist, head or body (a duck still dodges a high one)
  // 1 player: round time, the computer's health, guard and punching are per level in src/game/levels.js
  // (2 players fight until someone is knocked out)
  gloveSpeed: 330,         // pixels per second, flying out
  returnSpeed: 260,        // flying back
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
const GLOVE_TIP = 46, GLOVE_MID = 12;
const RECOVER_TIME = 0.2;                   // seconds of the recovery pose after the glove clicks back on (looks only)
const IDLE_FPS = 1.8;                       // breathing: idle1 <-> idle2 swaps a second
const WIND_FX_TIME = 1.2;                   // seconds the WIND STORM swirl spins round the boxer it hit (looks only)       // front edge and middle height inside the rocket-glove frame

// Keys for each player in each mode.
const CONTROLS = {
  1: [{ head: ['ArrowUp', 'KeyW'], body: ['Space', 'ArrowDown', 'KeyS'], duck: ['KeyX', 'ShiftLeft', 'ShiftRight'], left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'] }],
  2: [
    { head: ['KeyW'], body: ['KeyS'], duck: ['KeyX'], left: ['KeyA'], right: ['KeyD'] },
    { head: ['ArrowUp'], body: ['ArrowDown'], duck: ['ShiftRight', 'Slash'], left: ['ArrowLeft'], right: ['ArrowRight'] },
  ],
};
const anyPressed = (codes) => codes.some((c) => keys.pressed(c));
const anyHeld = (codes) => codes.some((c) => keys.held(c));

// ---------- pictures ----------
const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const pixels = document.createElement('canvas');
const g = pixels.getContext('2d');
const back = document.createElement('canvas');   // the place (background) layer
const gb = back.getContext('2d');
// RENDER.scale = real pixels per game pixel on the two layers: the screen's own scale (so nothing is blown up
// twice), at least RENDER.min so small windows still keep detail, at most RENDER.max to stay fast.
const RENDER = { min: 4, max: 8, scale: 4 };

const art = await loadArt();
// every boxer on the wheel, with poses for both sides and rocket gloves facing right (flipped when flying left)
const roster = buildRoster(art);
const wheel = makeWheel(roster, art.hd.ui['wheel-rim-hub']?.[0]);   // (the HD rim and hub, if drawn)
const FORCE_ZEUS = new URLSearchParams(location.search).get('zeus') === '1';
const HD_FX = art.hd.effects;
fx.skyBolt = HD_FX['zeus-sky-bolt'] || null;   // Zeus's lightning: the drawn HD bolt (effects.js bolt())
fx.hd = ['water', 'flame', 'ivy', 'poison', 'storm', 'wind'].every((k) => HD_FX[`${k}-trail`] && HD_FX[`${k}-impact`] && HD_FX[`${k}-status`]);
const sumoHD = art.hd.characters.sumo?.poses;
// HD: falls, belly-flops, stands up (recovery) as he hops off, then sits and waves (sittingWave)
const sumo = makeSumoFinish(sumoHD?.fall && sumoHD.flop && sumoHD.sit ? [sumoHD.fall[0], sumoHD.flop[0], (sumoHD.recovery || sumoHD.sit)[0], sumoHD.sit[0]] : art['sumo'], HD_FX.dust || HD_FX['sumo-dust'] || art['sumo-dust']);
const HIT_STARS = HD_FX['hit-stars'] || HD_FX.stars || HD_FX['stars-burst'] || HD_FX.impact || art['stars-burst'];

let view = { x: 0, y: 0, w: W, h: H };
function resize() {
  canvas.width = innerWidth * devicePixelRatio;
  canvas.height = innerHeight * devicePixelRatio;
  let s = Math.min(canvas.width / W, canvas.height / H);
  if (s >= 2) s = Math.floor(s);                       // whole-number scale = even pixels
  view = { w: W * s, h: H * s, x: Math.round((canvas.width - W * s) / 2), y: Math.round((canvas.height - H * s) / 2) };
  RENDER.scale = Math.max(RENDER.min, Math.min(RENDER.max, Math.ceil(s - 0.01)));
  for (const c of [pixels, back]) { c.width = W * RENDER.scale; c.height = H * RENDER.scale; }
  for (const c of [g, gb]) { c.setTransform(RENDER.scale, 0, 0, RENDER.scale, 0, 0); c.imageSmoothingEnabled = false; }
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
  hint.textContent = t(`hint${punchCam ? 'Cam' : 'Keys'}${game.mode}`);
}
function setMode(n) {
  game.mode = n;
  for (const el of document.querySelectorAll('.keys')) el.textContent = t(`keys${n}`);
  if (punchCam && punchCam.players !== n) punchCam.setPlayers(n);
}

// ---------- game state ----------
function makeFighter(side) {
  return { side, dir: side ? -1 : 1, x: START_X[side], minX: 0, maxX: 0, health: RULES.health, maxHealth: RULES.health, hits: 0, damage: 0, headHits: 0, bodyHits: 0,
    glove: { mode: 'home', aim: 'body', x: 0, y: 0, vx: 0, vy: 0 }, wobble: 0, duck: 0, walking: 0, boxer: roster[side ? 'orange' : 'teal'],
    super: 0, specials: 0,                      // SUPER meter (damage dealt toward the next special) and special hits landed
    slow: 0, tangle: 0, poison: 0, poisonT: 0, poisonBy: null, cooldown: 0,
    lava: 0, lavaT: 0, lavaBy: null, splats: [],
    recover: 0,                                 // seconds left of the after-punch pose (the glove clicking back on; looks only)
    windFx: 0, stormFx: 0 };                    // seconds left of the WIND STORM / THUNDER STORM swirl round this boxer (looks only)   // LAVA from the FLAME FIST: seconds left, next burn, splats on the body   // seconds left of each special's effect on this boxer
}
const fighters = [makeFighter(0), makeFighter(1)];
const [teal, orange] = fighters;

const game = window.game = {
  state: 'title', mode: 2, winner: null, loser: null, camera: 'off', rules: RULES, fighters,
  level: 1, place: 'arena',                                        // 1 player: the level (1..5); the place of this fight
  picks: ['teal', 'orange'],                                       // boxer ids from the wheel, P1 and P2
  spin: () => doSpin(),                                            // like a click on the wheel
  get wheel() { return wheel.phase; },
  get health() { return orange.health; },   // 1 player: the opponent's health
  get hits() { return teal.hits; },
  punch: (aim = 'body', who = 0) => fire(fighters[who], aim),   // handy for testing: game.punch('head', 1)
  duck: (who = 0) => startDuck(fighters[who]),                   // game.duck(1)
  get sumo() { return sumo.active ? sumo.time : null; },          // seconds into the sumo finish, or null
  fillSuper: (who = 0) => { fighters[who].super = SUPER.full; },  // testing: game.fillSuper(1)
};
let punchCam = null;
let guard = { up: false, t: 2 };
let ai = { t: 99, warn: 0, aim: 'head', combo: null };   // the computer's next punch: t = seconds to wait, warn = "!" showing, combo = aim of a quick follow-up
let nextT = 0;                              // seconds the LEVEL screen has shown
const STATS = ['damage', 'hits', 'headHits', 'bodyHits', 'specials'];
let run = {};                               // 1 player: your totals from the levels already beaten
const clearRun = () => { run = Object.fromEntries(STATS.map((k) => [k, 0])); };
clearRun();
let excite = 0, time = 0;
let shakeT = 0, flashT = 0;      // thunder: screen shake and white flash (seconds left)
let spin = { who: 0, t: 0, boxer: null };
let strikes = [];               // ZEUS's thunder storm: bolts still to come { t, target, attacker, dmg }

const timer = roundTimer(LEVELS[0].seconds, { onEnd: () => finish(null) });
const URL_LEVEL = clampLevel(Number(new URLSearchParams(location.search).get('level')) || 1);
function clampLevel(n) { return Math.max(1, Math.min(LEVELS.length, Math.round(n) || 1)); }
const lvl = () => LEVELS[game.level - 1];
// for checks from the console: game.debug.guard.up = true; game.debug.timer.reset(3)
game.debug = { get guard() { return guard; }, get cam() { return punchCam; }, timer, fighters, roster, forceZeus: FORCE_ZEUS };
// skip the wheel for checks: game.debug.fight('green', 'purple')
game.debug.fight = (p1 = 'teal', p2 = 'orange') => { game.picks = [p1, p2]; startRound(); };
// jump straight into a 1-player level (keeps your boxer, or teal): game.debug.level(5)
game.debug.level = (n = 1) => { setMode(1); clearRun(); game.level = clampLevel(n); game.picks = [game.picks[0] || 'teal', null]; startRound(); };
game.debug.ai = () => ai;
// the wheel for checks: game.debug.wheel.hold(1.2) holds it at a turn; .layout() says where each head is drawn
game.debug.wheel = wheel;
// look checks for the art (src/game/qa.js): game.debug.qa('zeus') / game.debug.qa('zeus', 'onion');
// game.debug.record(12, 0.06) then game.debug.contact() shows 12 real frames side by side
const recorder = makeRecorder();
let qa = null;
game.debug.qa = (id = 'teal', mode = 'sheet') => { qa = { id, mode }; game.state = 'qa'; show(null); hint.classList.add('hidden'); };
game.debug.record = (n, every, region) => recorder.start(n, every, region);
game.debug.contact = () => { game.state = 'contact'; show(null); hint.classList.add('hidden'); };
game.debug.recording = () => recorder.active;
game.debug.render = () => ({ scale: RENDER.scale, layer: [pixels.width, pixels.height], view, hd: Object.fromEntries(Object.values(roster).map((b) => [b.id, b.hd])),
  places: Object.keys(art.hd.world), effects: Object.keys(HD_FX).length });

function rand([a, b]) { return a + Math.random() * (b - a); }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const launchTip = (f) => (f.dir > 0 ? f.x + LAUNCH_OFFSET : f.x + 64 - LAUNCH_OFFSET);
const hitTip = (target, dir) => (dir > 0 ? target.x + HIT_DEPTH : target.x + 64 - HIT_DEPTH);

function startRound() {
  wakeSound();
  game.state = 'playing';
  game.winner = null; game.loser = null;
  sumo.stop();
  if (game.mode === 1) {
    game.picks[1] = foeFor(game.level, game.picks[0]);
    game.place = lvl().place;
  } else if (!readyPlace) game.place = randomPlace(art);
  readyPlace = false;
  resetFighters();
  if (game.mode === 1) {
    orange.health = orange.maxHealth = lvl().health;
    timer.reset(lvl().seconds);
  }
  guard = { up: false, t: game.mode === 1 ? rand(lvl().guardOpen) : 99 };
  ai = { t: game.mode === 1 && lvl().attack ? rand(lvl().attack) + 1.5 : 99, warn: 0, aim: 'head', combo: null };   // (+1.5 s while FIGHT! shows)
  excite = 0;
  strikes = [];
  clearEffects();
  show(null);
  setHint();
  if (game.mode === 1) popWord(game.level === LEVELS.length ? t('boss', { name: boxerName(roster.boss) }) : t('levelN', { n: game.level }), W / 2, 42, COLORS.rope, 14);
  popWord(t('fight'), W / 2, game.mode === 1 ? 62 : 48, COLORS.sparkle, 22);
  sfx.bell();
  fightMusic();
}

// Everyone back to the start: full health, empty meters, boxers from game.picks.
function resetFighters() {
  for (const f of fighters) {
    Object.assign(f, makeFighter(f.side));
    [f.minX, f.maxX] = RANGE[game.mode][f.side];
    f.boxer = roster[game.picks[f.side]] || f.boxer;
  }
}

// ---------- GET READY (camera play only) ----------
// After the wheel / LEVEL screen: a big camera picture shows where to stand. Keyboard play goes straight to the fight.
const readyHelp = document.getElementById('ready-help');
let readyT = 0, readyAll = 0, readyPlace = false;
function beginFight() {
  if (!punchCam) { startRound(); return; }
  game.state = 'ready';
  game.winner = null; game.loser = null;
  sumo.stop();
  if (game.mode === 1) { game.picks[1] = foeFor(game.level, game.picks[0]); game.place = lvl().place; }
  else { if (!readyPlace) game.place = randomPlace(art); readyPlace = true; }
  resetFighters();
  clearEffects();
  readyT = 0; readyAll = 0;
  readyHelp.dataset.text = '';
  show('ready-screen');
}
function readyGo() { if (game.state === 'ready' && readyT > 0.4) startRound(); }
document.getElementById('ready-screen').addEventListener('pointerdown', readyGo);
// every frame on GET READY: starts by itself once every stand box has been green for READY.startAfter seconds
function updateReady(dt) {
  readyT += dt;
  const bodies = camBodies();
  const here = bodies.filter((b) => b.here).length, all = bodies.length > 0 && here === bodies.length;
  readyAll = all ? readyAll + dt : 0;
  const text = all ? t('readyGo') : t(`readyBox${game.mode}`, { n: here });
  if (readyHelp.dataset.text !== text) { readyHelp.dataset.text = text; readyHelp.textContent = text; }
  if (readyAll >= READY.startAfter && readyT > 0.4) startRound();
}

// ---------- 2 players: the random place reveal ----------
// A quick slot machine: the places flicker past (slowing down), then land on this fight's place with a fanfare.
// Click, SPACE or a punch skips ahead. Then GET READY (camera) or straight into the fight (keys).
const REVEAL = { spin: 1.0, hold: 0.7 };   // seconds of flickering, then seconds showing the place it landed on
const revealPlace = document.getElementById('reveal-place');
let reveal = { t: 0, shown: null, next: 0, landed: false };
function startPlaceReveal() {
  game.state = 'reveal';
  game.place = randomPlace(art);
  readyPlace = true;                       // GET READY / the fight keep this place
  reveal = { t: 0, shown: null, next: 0, landed: false };
  clearEffects();
  show('reveal-screen');
  revealPlace.classList.remove('landed');
}
function revealText(id, landed = false) {
  const p = PLACES[id];
  revealPlace.textContent = landed ? `🎲 ${placeName(p)}! ${p.icon}` : `${p.icon} ${placeName(p)}`;
}
function updateReveal(dt) {
  reveal.t += dt;
  if (!reveal.landed) {
    reveal.next -= dt;
    if (reveal.next <= 0) {
      // the next place in the slot machine (never the same twice in a row), ticking slower and slower
      const ids = Object.keys(PLACES).filter((id) => id !== reveal.shown && (!PLACES[id].artOnly || hasPicture(id, art)));
      reveal.shown = ids[Math.floor(Math.random() * ids.length)];
      revealText(reveal.shown);
      reveal.next = 0.06 + 0.16 * (reveal.t / REVEAL.spin);
      sfx.tick();
    }
    if (reveal.t >= REVEAL.spin) landReveal();
  } else if (reveal.t >= REVEAL.spin + REVEAL.hold) beginFight();
}
function landReveal() {
  reveal.landed = true; reveal.t = Math.max(reveal.t, REVEAL.spin);
  reveal.shown = game.place;
  revealText(game.place, true);
  revealPlace.classList.add('landed');
  sfx.reveal();
  starBurst(W / 2, H / 2, 20);
}
function skipReveal() {
  if (game.state !== 'reveal') return;
  if (!reveal.landed) landReveal();
  else if (reveal.t > REVEAL.spin + 0.25) beginFight();
}
document.getElementById('reveal-screen').addEventListener('pointerdown', skipReveal);

// ---------- the wheel ----------
const wheelTitle = document.getElementById('wheel-title'), wheelHelp = document.getElementById('wheel-help');
const SIDE_COLOR = ['#1fb8b0', '#f0662c'];
function startWheel() {
  wakeSound();
  game.state = 'wheel';
  game.winner = null; game.loser = null;
  sumo.stop();
  titleMusic();   // the title loop goes on under the wheel (or comes back after a fight) until the fight music takes over
  game.picks = [null, null];          // 1 player: the computer boxer comes from the level
  game.level = URL_LEVEL;
  clearRun();
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
    wheelTitle.innerHTML = `${who}${t('spin')}`;
    wheelHelp.textContent = t(punchCam ? 'spinHelpCam' : 'spinHelp');
  } else if (wheel.phase === 'spinning') {
    wheelHelp.textContent = '🎡 ...';
  } else if (b.thunder) {
    wheelTitle.innerHTML = `⚡ ZEUS! ⚡<span class="en">${who}${t('zeusGot', { n: ZEUS_CHANCE })}</span>`;
    wheelHelp.textContent = t('zeusHelp');
  } else {
    wheelTitle.innerHTML = `${who || t('youGot')}<span style="color:${b.color}">${boxerName(b)}!</span>`;
    wheelHelp.textContent = t('goOn');
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
  // P2 can't get the same boxer as P1: that slice is greyed out on P2's spin
  if (game.mode === 2 && spin.who === 0) { spin = { who: 1, t: 0, boxer: null }; wheel.reset(game.picks[0]); wheelText(); }
  else if (game.mode === 2) startPlaceReveal();
  else beginFight();
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

// Who has a SUPER meter: both players in 2 players; in 1 player you, and the computer from the levels with special: true.
const hasMeter = (f) => game.mode === 2 || f.side === 0 || lvl().special;

function fire(f, aim) {
  if (game.state !== 'playing' || f.glove.mode !== 'home' || f.duck > 0 || f.cooldown > 0) return;
  const x = launchTip(f);
  // a full SUPER meter turns this punch into the special, and empties
  const sp = hasMeter(f) && f.super >= SUPER.full ? SPECIALS[f.boxer.id] : null;
  f.glove = { mode: 'out', aim, x, from: x, y: ARM_Y, vx: 0, vy: 0, dodged: false, special: sp && sp.kind };
  if (sp) {
    f.super = 0;
    sound.play(SPECIAL_SOUND[sp.kind], varied(SOUND_VOLUME.special));
    popWord(t(sp.kind), f.x + 32, BOXER_Y - 2, sp.color, 12);
    sfx.reveal();
  }
  sfx.whoosh();
}

function startDuck(f) {
  if (game.state !== 'playing' || (game.mode === 1 && f.side === 1)) return;   // the computer doesn't duck
  if (f.tangle > 0) {   // IVY: tangled legs can't duck
    if (f.duck <= 0 && f.wobble <= 0 && Math.random() < 0.3) popWord(t('tangled'), f.x + 32, BOXER_Y + 40, '#64be52', 9);
    return;
  }
  f.duck = Math.max(f.duck, RULES.duckTime);
}

// A special hit lands on foe: its extra effect. Returns the damage to deal now.
function specialHit(f, foe, kind, dmg, x, y) {
  const sp = SPECIALS[f.boxer.id];
  f.specials++;
  popWord(t(`${sp.kind}Hit`), foe.x + 32, BOXER_Y - 4, sp.color, 12);
  if (kind === 'water') {
    foe.slow = SUPER.slow.time;
    for (let i = 0; i < 20; i++) drip(x + Math.random() * 20 - 10, y + Math.random() * 10 - 5);
  } else if (kind === 'flame') {
    for (let i = 0; i < 6; i++) flame(x, y + Math.random() * 16 - 8, 2, -f.dir, 1.5);
    starBurst(x, y, 16);
    // LAVA: glowing splats stick to the target and burn a little every second
    foe.lava = SUPER.lava.time; foe.lavaT = 1; foe.lavaBy = f;
    foe.splats = Array.from({ length: 4 }, (_, i) => ({ dx: 22 + Math.random() * 20, dy: 26 + i * 8 + Math.random() * 4, r: 2 + (i % 2) }));
    popWord(t('lava'), foe.x + 32, BOXER_Y + 12, '#ff7a2e', 11);
    return dmg + SUPER.flameBonus;
  } else if (kind === 'ivy') {
    foe.tangle = SUPER.tangle; foe.duck = 0;
  } else if (kind === 'poison') {
    foe.poison = SUPER.poison.time; foe.poisonT = 1; foe.poisonBy = f;
    for (let i = 0; i < 10; i++) bubbles(x, y, 0);
  } else if (kind === 'wind') {
    // WIND STORM: one huge gust of a punch
    starBurst(x, y, 18);
    shakeT = 0.35;
    foe.windFx = WIND_FX_TIME;
    return SUPER.wind;
  } else if (kind === 'storm') {
    // THUNDER STORM: 3 bolts from the sky, one after another (the first one right now)
    SUPER.storm.forEach((d, i) => strikes.push({ t: i * SUPER.stormGap, target: foe, attacker: f, dmg: d }));
    foe.stormFx = SUPER.storm.length * SUPER.stormGap + 0.6;
    return 0;
  }
  return dmg;
}

// One bolt of the thunder storm hits.
function strike(s) {
  const foe = s.target, x = foe.x + 32 + Math.random() * 16 - 8;
  bolt(x + Math.random() * 30 - 15, 0, x, BOXER_Y + 30, 0.4);
  bolt(x + Math.random() * 30 - 15, 0, x, BOXER_Y + 30, 0.3);
  starBurst(x, BOXER_Y + 30, 12);
  flashT = 0.25; shakeT = 0.45;
  sfx.zap(); sfx.thunder();
  popWord(`-${s.dmg}`, x, BOXER_Y + 14, '#ffffff', 11);
  s.attacker.damage += s.dmg;
  foe.health = Math.max(0, foe.health - s.dmg);
  foe.wobble = 0.5; foe.duck = 0; excite = 1;
  if (foe.health === 0) finish(s.attacker);
}

// winner: the fighter who won, or null when time ran out (1 player)
function finish(winner) {
  if (game.state !== 'playing') return;
  game.state = winner ? 'win' : 'timeup';
  game.winner = winner ? (game.mode === 1 ? (winner.side ? 'computer' : 'player') : winner.side ? 'orange' : 'teal') : null;
  // the loser: whoever was knocked out, or the player when time runs out (1 player)
  const loser = winner ? fighters[1 - winner.side] : teal;
  game.loser = loser.side ? 'orange' : 'teal';
  ai.warn = 0;
  if (winner) { sfx.win(); starBurst(loser.x + 32, BOXER_Y + 16, 20); }
  else { sfx.bell(); popWord(t('time'), W / 2, 48, COLORS.rope, 22); }
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
    ? [[teal, `P1 · ${boxerName(teal.boxer)}`], [orange, `P2 · ${boxerName(orange.boxer)}`]]
    : [[teal, `${t('you')} · ${boxerName(teal.boxer)}`]];
  return who.map(([fighter, name]) => {
    // 1 player: your numbers for the whole run, all levels so far
    const f = game.mode === 1 ? { side: 0, ...Object.fromEntries(STATS.map((k) => [k, run[k] + fighter[k]])) } : fighter;
    const color = f.side ? 'orange' : 'teal';
    const crown = game.winner === color || (game.winner === 'player' && !f.side) ? ' 🏆' : '';
    return `<div class="score-card ${color}"><h3>${name}${crown}</h3>
      <dl>${STATS.map((k) => `<dt>${t(k)}</dt><dd>${f[k]}</dd>`).join('')}</dl></div>`;
  }).join('');
}

function showEndScreen() {
  stopFightMusic();
  if (game.mode === 1) {
    if (game.winner !== 'player') showGameOver();
    else if (game.level < LEVELS.length) showNextLevel();
    else showChampion();
    return;
  }
  document.getElementById('win-scores').innerHTML = scoreCards();
  const title = document.getElementById('win-title'), sub = document.getElementById('win-sub');
  title.className = 'title win';
  if (game.winner === 'teal' || game.winner === 'orange') {
    const w = game.winner === 'teal' ? teal : orange, n = w.side + 1;
    title.style.color = w.boxer.color;
    title.textContent = t('winTitle', { n, name: boxerName(w.boxer) });
    sub.textContent = t('winSub', { n, side: t(w.side ? 'right' : 'left') });
  }
  show('win-screen');
}

// ---------- 1 player: levels ----------
// "LEVEL 2!": the new place with the next opponent standing in the ring. Punch, click or SPACE to fight.
function showNextLevel() {
  for (const k of STATS) run[k] += teal[k];
  game.level++;
  game.state = 'next-level';
  game.winner = null; game.loser = null;
  game.picks[1] = foeFor(game.level, game.picks[0]);
  game.place = lvl().place;
  resetFighters();
  clearEffects();
  nextT = 0;
  const p = PLACES[game.place], foe = roster[game.picks[1]], boss = game.level === LEVELS.length;
  document.getElementById('level-title').textContent = t(boss ? 'bossLevelTitle' : 'levelTitle', { n: game.level, name: boxerName(foe) });
  document.getElementById('level-place').textContent = `${p.icon} ${placeName(p)}`;
  document.getElementById('level-foe').innerHTML = boss
    ? `⚠️ <span style="color:#ffd08a">${t('theBoss', { name: boxerName(foe) })}</span> 🌪️`
    : `vs <span style="color:${foe.color}">${boxerName(foe)}</span> · ❤️ ${lvl().health}`;
  show('level-screen');
  sfx.reveal();
}
function goNextLevel() { if (game.state === 'next-level' && nextT > 0.8) beginFight(); }

function showGameOver() {
  game.state = 'gameover';
  const timeUp = !game.winner;
  const vs = game.level === LEVELS.length ? ` · vs ${boxerName(roster.boss)}` : '';
  document.getElementById('over-sub').textContent = `${timeUp ? `${t('time')} ⏰ ` : ''}${t('atLevel', { n: game.level })}${vs}`;
  document.getElementById('over-scores').innerHTML = scoreCards();
  show('gameover-screen');
}

function showChampion() {
  game.state = 'champion';
  document.getElementById('champ-scores').innerHTML = scoreCards();
  show('champion-screen');
  sfx.win();
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
    const CAM_TROUBLE = { denied: 'camDenied', 'no-camera': 'camMissing', busy: 'camBusy', insecure: 'camInsecure', unsupported: 'camUnsupported' };
    document.getElementById('camera-trouble').textContent = t(CAM_TROUBLE[e.reason] || 'camOther');
    show('camera-failed-screen');
  }
}

// 1 player: our own tracker on the whole camera picture that also sees DUCKS (the computer punches back).
// The punch boxes are the same as punch-cam's 1-player ones.
let soloCam = null;
function camUpdate(dt) {
  if (!punchCam) return [];
  const moves = punchCam.update(dt);
  if (game.mode !== 1) return moves;
  if (!soloCam || soloCam.cam !== punchCam.cam) soloCam = { cam: punchCam.cam, body: trackBody(punchCam.cam, undefined, { duck: true, color: SIDE_COLOR[0], inner: 'right' }) };
  return [soloCam.body.update(dt)];
}
const camBodies = () => (game.mode === 1 && soloCam ? [soloCam.body] : punchCam.bodies);

function play(mode) {
  wakeSound();
  setMode(mode);
  if (game.camera === 'off') askCamera();
  else startWheel();
}
document.getElementById('play').addEventListener('click', () => play(2));
document.getElementById('play-1p').addEventListener('click', () => play(1));
for (const id of ['skip-camera', 'play-keys', 'again-win', 'again-over', 'again-champ']) {
  document.getElementById(id).addEventListener('click', startWheel);
}
document.getElementById('level-screen').addEventListener('pointerdown', goNextLevel);
for (const id of ['menu', 'menu-over', 'menu-champ']) {
  document.getElementById(id).addEventListener('click', () => { game.state = 'title'; sumo.stop(); titleMusic(); show('title-screen'); });
}
// SOUND BUTTON: a small speaker in the title's corner. It shows sound as off until the browser's audio has been
// woken by a tap (any tap does that); then a tap on it mutes or unmutes everything. M does the same anywhere.
const soundButton = document.getElementById('sound-toggle');
let soundWoken = false;   // has a tap or key (not on the button) woken the audio yet?
function showSound() {
  const on = soundWoken && !sound.muted;
  soundButton.textContent = on ? '🔊' : '🔇';
  soundButton.setAttribute('aria-pressed', String(on));
  soundButton.setAttribute('aria-label', t('soundButton'));
  soundButton.title = t(on ? 'soundOn' : 'soundOff');
}
for (const type of ['pointerdown', 'keydown']) {
  addEventListener(type, (e) => { if (!soundWoken && e.target !== soundButton) { soundWoken = true; showSound(); } });
}
soundButton.addEventListener('click', () => {
  sound.unlock();
  if (soundWoken && !sound.muted) sound.muted = true;   // it showed ON: switch off
  else { soundWoken = true; sound.muted = false; }       // it showed OFF: switch on (also the very first tap)
  showSound();
});
showSound();
setMode(2);
// LANGUAGE: one language at a time; the title-screen button switches it (src/game/i18n.js)
applyPage();
document.getElementById('lang').addEventListener('click', toggleLang);
onLangChange(() => { setMode(game.mode); setHint(); showSound(); });

// ---------- update ----------
function update(dt, now) {
  time = now;
  const ctrls = CONTROLS[game.mode];
  if (keys.pressed('KeyM')) {   // mute / unmute everything
    sound.toggleMute();
    showSound();
    popWord(t(sound.muted ? 'soundOff' : 'soundOn'), W / 2, 100, COLORS.rope, 10);
  }
  if (game.state === 'playing') {
    ctrls.forEach((c, i) => {
      const f = fighters[i];
      if (anyPressed(c.duck)) startDuck(f);
      if (f.duck > 0 && anyHeld(c.duck)) f.duck = Math.max(f.duck, 0.1);   // holding the key keeps you down
      if (anyPressed(c.head)) fire(f, 'head');
      else if (anyPressed(c.body)) fire(f, 'body');
    });
  } else if (game.state === 'ready') {
    if (keys.pressed('Space') || keys.pressed('Enter') || ctrls.some((c) => anyPressed(c.head) || anyPressed(c.body))) readyGo();
  } else if (game.state === 'reveal') {
    if (keys.pressed('Space') || keys.pressed('Enter') || ctrls.some((c) => anyPressed(c.head) || anyPressed(c.body))) skipReveal();
  } else if (game.state === 'next-level') {
    nextT += dt;
    if (keys.pressed('Space') || keys.pressed('Enter') || ctrls.some((c) => anyPressed(c.head) || anyPressed(c.body))) goNextLevel();
  } else if (game.state === 'wheel') {
    const c = ctrls[spin.who] || ctrls[0];
    if (keys.pressed('Space') || keys.pressed('Enter') || anyPressed(c.head) || anyPressed(c.body)) doSpin();
  } else if (keys.pressed('Enter') && (game.state === 'camera' || game.state === 'camera-failed')) {
    startWheel();
  } else if (game.state === 'camera' || game.state === 'camera-failed') {
    if (ctrls.some((c) => anyPressed(c.head) || anyPressed(c.body))) startWheel();
  }
  const camMoves = camUpdate(dt);
  if (game.state === 'ready') updateReady(dt);
  if (game.state === 'reveal') updateReveal(dt);
  camMoves.forEach((move, i) => {
    if (game.state === 'next-level') { if (move === 'head' || move === 'body') goNextLevel(); }
    else if (game.state === 'wheel') { if ((move === 'head' || move === 'body') && (i === spin.who || game.mode === 1)) doSpin(); }
    else if (game.state === 'ready') { /* GET READY: punches don't count yet */ }
    else if (game.state === 'reveal') { if (move === 'head' || move === 'body') skipReveal(); }
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
    ctrls.forEach((c, i) => walk(fighters[i], dt, c, punchCam && camBodies()[i]));
    if (game.mode === 1) {
      timer.update(dt);
      computer(dt);
    }
  }
  if (game.state === 'win' || game.state === 'timeup') {
    if (sumo.active && sumo.update(dt)) { sumo.stop(); showEndScreen(); }
    if (game.state === 'win' && game.winner !== 'computer' && Math.random() < dt * 3) starBurst(30 + Math.random() * 196, 16 + Math.random() * 50, 8);
  }
  for (const f of fighters) {
    f.wobble = Math.max(0, f.wobble - dt);
    f.duck = Math.max(0, f.duck - dt);
    f.cooldown = Math.max(0, f.cooldown - dt);
    f.recover = Math.max(0, f.recover - dt);
    f.windFx = Math.max(0, f.windFx - dt);
    f.stormFx = Math.max(0, f.stormFx - dt);
    f.slow = Math.max(0, f.slow - dt);
    f.tangle = Math.max(0, f.tangle - dt);
    if (f.poison > 0) {
      f.poison = Math.max(0, f.poison - dt);
      f.poisonT -= dt;
      // POISON: a little health every second, but never the last bit (a real punch has to finish them)
      if (f.poisonT <= 0 && game.state === 'playing') {
        f.poisonT += 1;
        const dmg = Math.min(SUPER.poison.perSecond, f.health - 1);
        if (dmg > 0) {
          f.health -= dmg;
          if (f.poisonBy) f.poisonBy.damage += dmg;
          popWord(`-${dmg}`, f.x + 32 + Math.random() * 10 - 5, BOXER_Y + 22, '#e5b3ff', 9);
        }
      }
    }
  }
  // LAVA: like poison, a little every second, never the last bit
  for (const f of fighters) {
    if (f.lava <= 0) continue;
    f.lava = Math.max(0, f.lava - dt);
    f.lavaT -= dt;
    if (f.lavaT <= 0 && game.state === 'playing') {
      f.lavaT += 1;
      const dmg = Math.min(SUPER.lava.perSecond, f.health - 1);
      if (dmg > 0) {
        f.health -= dmg;
        if (f.lavaBy) f.lavaBy.damage += dmg;
        popWord(`-${dmg}`, f.x + 32 + Math.random() * 10 - 5, BOXER_Y + 30, '#ff9f2e', 9);
      }
    }
  }
  // ZEUS's thunder storm: the bolts still to come
  if (game.state === 'playing') {
    for (const s of strikes) { s.t -= dt; if (s.t <= 0 && game.state === 'playing') strike(s); }
    strikes = strikes.filter((s) => s.t > 0);
  } else strikes = [];
  if (game.state === 'champion' && Math.random() < dt * 8) starBurst(10 + Math.random() * 236, 10 + Math.random() * 110, 10);
  excite = Math.max(game.state === 'win' || game.state === 'champion' ? 1 : 0, excite - dt * 0.7);

  for (const f of fighters) moveGlove(f, dt);
  draw(dt);
}

// The computer boxer (1 player): raises and drops its guard, and fires rocket fists back (gently on level 1).
// Before each punch a "!" flashes over its head for lvl().warn seconds, so you have time to duck a HIGH one.
// Its punch clock keeps running while it wobbles from your hits (it only waits for the wobble to end before its
// "!"), so punching it a lot doesn't stop it punching back. Sometimes a quick second punch follows the other way.
function computer(dt) {
  const L = lvl(), f = orange;
  if (ai.warn > 0) {
    ai.warn -= dt;
    if (ai.warn <= 0) {
      ai.warn = 0;
      const went = f.glove.mode === 'home' && f.cooldown <= 0;
      fire(f, ai.aim);
      // a quick follow-up the other way (high <-> low), or the usual wait; if the fist couldn't go, try again soon
      const combo = went && !ai.combo && Math.random() < (L.combo || 0);
      ai.t = !went ? 0.2 : combo ? rand(L.comboGap || [0.3, 0.5]) : rand(L.attack);
      ai.combo = combo ? (ai.aim === 'head' ? 'body' : 'head') : null;
    }
    return;
  }
  if (L.attack && f.glove.mode === 'home') ai.t -= dt * (f.slow > 0 ? SUPER.slow.glove : 1);   // WATER: a wet computer punches less often too
  if (f.wobble > 0) return;
  guard.t -= dt;
  if (guard.t <= 0) { guard.up = !guard.up; guard.t = rand(guard.up ? L.guardUp : L.guardOpen); }
  if (!L.attack || f.glove.mode !== 'home' || f.cooldown > 0 || ai.t > 0) return;
  // fair play: no punch while you're tangled in IVY and can't duck (no unavoidable head punches)
  if (teal.tangle > 0) return;
  ai.warn = L.warn;
  ai.aim = ai.combo || (Math.random() < L.high ? 'head' : 'body');
  guard.up = false; guard.t = rand(L.guardOpen);
}

// Walk a boxer: keys walk it; on the webcam it walks toward where that player's body is.
function walk(f, dt, c, tracker) {
  const keyDir = (anyHeld(c.right) ? 1 : 0) - (anyHeld(c.left) ? 1 : 0);
  const step = RULES.walkSpeed * dt * (f.slow > 0 ? SUPER.slow.walk : 1);   // WATER: dripping wet = slower
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
  const slowK = f.slow > 0 ? SUPER.slow.glove : 1;   // WATER: slower fists too
  if (gl.mode === 'out') {
    gl.x += d * RULES.gloveSpeed * slowK * dt;
    const tip = hitTip(foe, d);
    if (gl.dodged) gl.y = Math.max(BOXER_Y + 2, gl.y - 60 * dt);   // sails up over the ducking boxer
    else {
      // steer from arm height up to the head or down to the body during the first part of the flight
      const span = clamp(Math.abs(tip - gl.from) * 0.6, 10, 45);
      const k = clamp(Math.abs(gl.x - gl.from) / span, 0, 1);
      gl.y = ARM_Y + (AIM_Y[gl.aim] - ARM_Y) * k * (2 - k);
    }
    // sparks off the back of the flying glove (an HD glove has its own drawn jet instead of the pixel flame)
    const back = gl.x - d * gloveLen(f) * (BIG_FIST[gl.special] ? 2 : 1);
    if (gl.special) specialTrail(gl.special, back, gl.y, d);
    else if (fxOf(f, 'trail')) { if (f.boxer.thunder && Math.random() < 0.25) zap(back, gl.y, d); }
    else if (f.boxer.thunder) zap(gl.x - d * 44, gl.y, d);
    else flame(gl.x - d * 40, gl.y, 1, d);
    const reached = d > 0 ? gl.x >= tip : gl.x <= tip;
    if (reached && !gl.dodged && game.state === 'playing') {
      if (gl.aim === 'head' && foe.duck > 0) {
        gl.dodged = true;
        popWord(t('dodge'), foe.x + 32, BOXER_Y + 8, COLORS.rope, 11);
        sfx.whoosh();
      } else if (game.mode === 1 && f.side === 0 && gl.aim === 'head' && guard.up && foe.wobble <= 0 && !f.boxer.thunder && !gl.special) {
        gl.mode = 'bounce'; gl.vy = -120;
        popWord(t('boing'), tip - 4 * d, gl.y - 14, COLORS.rope, 11);
        sfx.boing();
      } else {
        const thunder = f.boxer.thunder;
        let dmg = thunder ? RULES.thunderDamage : RULES.damage[gl.aim];
        if (gl.special) dmg = specialHit(f, foe, gl.special, dmg, tip, gl.y);
        else if (hasMeter(f)) {   // normal hits charge the SUPER meter
          const was = f.super;
          f.super = Math.min(SUPER.full, f.super + dmg);
          if (was < SUPER.full && f.super >= SUPER.full) sound.play('super-ready', varied(SOUND_VOLUME.superReady));
        }
        f.hits++; f.damage += dmg;
        if (gl.aim === 'head') f.headHits++; else f.bodyHits++;
        foe.health = Math.max(0, foe.health - dmg);
        playFrames(HIT_STARS, tip + 2 * d, gl.y);
        if (gl.special && fxOf(f, 'impact')) playFrames(fxOf(f, 'impact'), tip, gl.y, 12, 1.4);
        starBurst(tip, gl.y, gl.aim === 'head' ? 12 : 7);
        popWord(t(thunder ? 'zap' : gl.special === 'wind' ? 'whoosh' : gl.aim === 'head' ? 'pow' : 'bam'), tip - 10 * d, gl.y - 16, COLORS.sparkle, thunder ? 15 : 12);
        if (dmg) popWord(`-${dmg}`, tip + 26 * d, gl.y - 6, thunder ? '#ffffff' : COLORS.rope, thunder ? 11 : 9);
        if (thunder) {
          // THUNDER: a lightning bolt from the sky onto the target, a white flash and a shake
          bolt(tip + 6 * d, 0, tip, gl.y, 0.4);
          bolt(tip - 20 * d, 0, tip, gl.y, 0.3);
          flashT = 0.18; shakeT = 0.35;
          sfx.zap(); sfx.thunder();
        } else sfx.pow();
        foe.wobble = 0.5; foe.duck = 0; excite = 1;
        if (game.mode === 1 && f.side === 0) guard = { up: false, t: rand(lvl().guardOpen) };
        gl.mode = 'back';
        if (foe.health === 0) finish(f);
      }
    } else if (gl.x > W + 50 || gl.x < -50) gl.mode = 'back';
  } else if (gl.mode === 'back' || gl.mode === 'bounce') {
    gl.x -= d * RULES.returnSpeed * slowK * dt;
    if (gl.mode === 'bounce') { gl.y += gl.vy * dt; gl.vy += 500 * dt; gl.y = Math.min(gl.y, ARM_Y); }
    else gl.y += (ARM_Y - gl.y) * Math.min(1, dt * 4);
    if (d > 0 ? gl.x <= launchTip(f) : gl.x >= launchTip(f)) {
      gl.mode = 'home'; f.recover = RECOVER_TIME;   // the glove is back on the arm: the recovery pose, then idle
      if (f.slow > 0) f.cooldown = SUPER.slow.cooldown;
    }
  }
}

// ---------- drawing ----------
const FEET_Y = BOXER_Y + 69;                // the floor line the boxers stand on

// Health bar. side 0 = you / P1 (top-left), side 1 = the computer / P2 (top-right).
// With the camera on, the bars are shorter so the bigger camera picture fits between them.
const hudW = () => (punchCam ? 50 : 70);
function drawHealth(f) {
  const w = hudW(), h = 6, y = 6;
  const x = f.side ? W - 22 - w : 22;
  const fillC = f.boxer.color, lightC = f.boxer.light;
  g.fillStyle = COLORS.outline; g.fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle = '#3a1d2a'; g.fillRect(x, y, w, h);
  const fill = Math.round((w * f.health) / f.maxHealth);
  // the bar empties toward the middle of the screen
  const fx = f.side ? x + w - fill : x;
  g.fillStyle = fillC; g.fillRect(fx, y, fill, h);
  g.fillStyle = lightC; g.fillRect(fx, y, fill, 2);
  g.fillStyle = f.boxer.dark; g.fillRect(fx, y + h - 1, fill, 1);                     // shade along the bottom
  g.fillStyle = 'rgba(255, 255, 255, 0.75)'; g.fillRect(fx + 1, y + 0.5, Math.max(0, fill - 2), 0.5);   // shine
  drawNumber(g, f.health, f.side ? x + w : x, y + h + 3, COLORS.rope, 1, f.side ? 'right' : 'left');
  // the boxer's portrait as a label, on the outside end of the bar, in a frame of their colour
  const size = 15, lx = f.side ? x + w + 3 : x - 3 - size, ly = y - 4;
  g.fillStyle = COLORS.outline; g.fillRect(lx - 1, ly - 1, size + 2, size + 2);
  g.fillStyle = f.boxer.dark; g.fillRect(lx, ly, size, size);
  const head = f.boxer.head, s = Math.min(size / lw(head), size / lh(head));
  g.save(); g.beginPath(); g.rect(lx, ly, size, size); g.clip();
  drawFacing(g, head, lx + size / 2, ly + size / 2, f.side ? -1 : 1, s, lw(head) / 2, lh(head) / 2);
  g.restore();
  g.strokeStyle = f.boxer.color; g.lineWidth = 0.5; g.strokeRect(lx + 0.25, ly + 0.25, size - 0.5, size - 0.5);
}

// Which pose a boxer shows right now (only reads the game state; changes nothing).
function poseOf(f) {
  const lost = game.loser === (f.side ? 'orange' : 'teal');
  if (lost || f.wobble > 0) return 'hit';
  if (f.duck > 0) return 'duck';
  if (f.glove.mode !== 'home') return f.glove.special ? 'special' : 'punch';   // (the glove is off the arm)
  if (f.recover > 0 && game.state === 'playing') return 'recovery';
  if (game.state === 'win' && game.loser && (!sumo.active || sumo.time > SUMO.sitUp)) return 'victory';
  if (game.mode === 1 && f.side === 1 && guard.up && game.state === 'playing' && ai.warn <= 0) return 'guard';
  return 'idle';
}
// The frame of a pose: idle breathes (idle1 <-> idle2) on the beat; the others play once from when they began,
// then hold the last frame.
function frameOf(list, f, name) {
  if (list.length === 1) return list[0];
  if (name === 'idle') return list[Math.floor(time * IDLE_FPS + f.side * 0.5) % list.length];
  const fps = list.fps || list[0].fps || 12;
  return list[Math.min(list.length - 1, Math.floor(f.poseT * fps))];
}

function drawFighter(f, dt) {
  const p = f.boxer.poses[f.side];
  const lost = game.loser === (f.side ? 'orange' : 'teal');
  const name = poseOf(f);
  if (name !== f.poseName) { f.poseName = name; f.poseT = 0; } else f.poseT += dt;
  const pose = frameOf(p[name], f, name);
  // x, y = the top-left of the boxer's 64x72 game box (hits, effects); cx, feet = where it stands
  let x = f.x, y = BOXER_Y;
  const squash = lost ? sumo.squash() : null;
  const hop = f.walking > 0 ? -(Math.floor(time * 10) % 2) : 0;
  if (lost) { y += squash ? 0 : 3; x += squash ? 0 : Math.sin(time * 6) * 2; }
  else if (f.wobble > 0) x += Math.sin(f.wobble * 40) * 2 * (f.wobble / 0.5) - 3 * f.dir;
  else if (name === 'duck' || name === 'guard') { /* planted */ }
  else if (game.mode === 1 && f.side === 1 && ai.warn > 0 && game.state === 'playing') x += Math.floor(time * 20) % 2;   // winding up a punch
  else y += hop;
  const cx = x + 32, feet = y + 69;
  const box = contentBox(pose), headTop = feet - pose.ay + box.y;    // the top of the drawn head
  if (squash) {
    // flattened like a pancake by the sumo (cartoon!), stretched around the feet
    g.save(); g.translate(cx, feet); g.scale(squash.sx, squash.sy);
    drawFacing(g, pose, 0, 0); g.restore();
    if (squash.sy < 0.5) return;
  } else {
    const img = f.poison > 0 && !lost ? tinted(pose, '#b05cf0', 0.3) : pose;
    drawFacing(g, img, cx, feet);
  }
  const top = squash ? feet - (feet - headTop) * squash.sy : headTop;
  if (!lost && game.state === 'playing') drawStatus(f, x, y);
  // 2 players: a P1 / P2 tag over each head, so two of the same boxer can be told apart
  if (game.mode === 2 && !lost) {
    const ty = Math.round(top - 10), tx = Math.round(cx);
    drawNumber(g, `P${f.side + 1}`, tx, ty, SIDE_COLOR[f.side], 1, 'center');
    g.fillStyle = SIDE_COLOR[f.side]; g.fillRect(tx - 1, ty + 6, 3, 1); g.fillRect(tx, ty + 7, 1, 1);
  }
  if (lost || f.wobble > 0) drawDizzy(g, cx + (f.side ? 2 : -2), top + 3, time);
}

// SUPER READY: a gold aura spinning behind a boxer whose next punch is the special (HD art only).
function drawAura(f) {
  const aura = HD_FX['super-ready'];
  if (!aura || game.state !== 'playing' || !hasMeter(f) || f.super < SUPER.full) return;
  const duckY = f.duck > 0 ? DUCK_DROP : 0;
  drawFacing(g, fxFrame(aura, time), f.x + 32, BOXER_Y + 36 + duckY, 1, 1.45);
}

// The specials' effects on a boxer: wet drops, ivy round the legs, poison bubbles; HD status loops on top.
const STATUS = [['slow', 'water', 0.5, 1.1], ['lava', 'flame', 0.62, 1.0], ['tangle', 'ivy', 0.9, 1.1], ['poison', 'poison', 0.4, 1.1],
  ['stormFx', 'storm', 0.5, 1.1], ['windFx', 'wind', 0.5, 1.25]];
function drawStatus(f, x, y) {
  const duckY = f.duck > 0 ? DUCK_DROP : 0;
  for (const [key, el, at, scale] of STATUS) {
    const list = HD_FX[`${el}-status`];
    if (!list || f[key] <= 0) continue;
    g.globalAlpha = Math.min(1, f[key] * 2) * 0.9;
    drawFacing(g, fxFrame(list, time + at), x + 32, y + duckY + 72 * at, f.dir, scale);
    g.globalAlpha = 1;
  }
  if (f.slow > 0 && Math.random() < 0.6) drip(x + 18 + Math.random() * 28, y + 6 + duckY + Math.random() * 30);
  if (f.poison > 0 && Math.random() < 0.25) bubbles(x + 20 + Math.random() * 24, y + 4 + duckY + Math.random() * 20, 0);
  if (f.tangle > 0 && !fx.hd) drawIvy(g, Math.round(x + 32), Math.round(y + 70), time);
  if (f.lava > 0 && !fx.hd) {
    // mirrored for the boxer facing left, so the splats sit on the body either way
    const splats = f.side ? f.splats.map((s) => ({ ...s, dx: 64 - s.dx })) : f.splats;
    drawLava(g, x, y + duckY, splats, time, Math.min(1, f.lava));
    if (Math.random() < 0.35) { const s = splats[Math.floor(Math.random() * splats.length)]; sizzle(x + s.dx, y + duckY + s.dy - s.r); }
  }
}

const BIG_FIST = { flame: true, wind: true };
// The HD effect animations of a boxer's element (water, flame, ivy, poison, storm, wind): kind = trail, impact, status.
const elementOf = (boxer) => SPECIALS[boxer.id]?.kind;
const fxOf = (f, kind) => HD_FX[`${elementOf(f.boxer)}-${kind}`];
const fxFrame = (list, t) => list[(list.loop === false ? Math.min(list.length - 1, Math.floor(t * list.fps)) : Math.floor(t * (list.fps || 12)) % list.length)];
// how long the flying glove is, front to back (game pixels)
const gloveLen = (f) => { const img = f.boxer.glove[0]; return img.tip ? img.tip[0] - 2 : 44; };
function drawGlove(f) {
  const gl = f.glove;
  if (gl.mode === 'home') return;
  const frames = f.boxer.glove;
  const img = frames[Math.floor(time * (frames.fps || 12)) % frames.length];
  const [tx, ty] = img.tip || [GLOVE_TIP, GLOVE_MID];   // the glove's front tip, at mid height, in its frame
  const big = gl.mode === 'out' && BIG_FIST[gl.special] ? 2 : 1, len = gloveLen(f) * big;
  const y = gl.y;
  const trail = fxOf(f, 'trail');
  if (gl.mode === 'out' && gl.special === 'ivy' && !trail) drawVine(g, launchTip(f) - f.dir * len, gl.x - f.dir * len, gl.y, time);
  // the drawn jet behind the glove (HD): its attach point sits on the back of the glove. It never reaches back
  // past the empty wrist cuff, so it doesn't cover the boxer.
  if (trail) {
    const out = gl.mode === 'out', dir = out ? f.dir : -f.dir, backX = out ? gl.x - f.dir * len : gl.x - f.dir * (tx - 2) + f.dir * len;
    const cuff = f.x + 32 + f.dir * 26;
    g.save(); g.beginPath();
    g.rect(f.dir > 0 ? cuff : -50, 0, f.dir > 0 ? W + 50 - cuff : cuff + 50, H); g.clip();
    const k = (gl.special ? 1.5 : 1) * (out ? 1 : 0.7), frame = fxFrame(trail, time + f.side * 0.13);
    drawFacing(g, frame, backX, y, dir, k);
    // IVY FIST: the vine reaches all the way back to the arm: more of the leafy trail behind the first one
    if (out && gl.special === 'ivy') for (let bx = backX - f.dir * lw(frame) * k * 0.8; (bx - cuff) * f.dir > 0; bx -= f.dir * lw(frame) * k * 0.8) drawFacing(g, frame, bx, y, dir, k);
    g.restore();
  }
  if (gl.mode === 'out' && BIG_FIST[gl.special]) {
    // the FLAME FIST and WIND STORM: a glove twice as big (the wind one in a swirl)
    if (gl.special === 'wind' && !fx.hd) drawSwirl(g, gl.x - f.dir * 46, gl.y, time);
    drawFacing(g, img, gl.x, y, f.dir, 2, tx, ty);
  } else if (gl.mode === 'out') drawFacing(g, img, gl.x, y, f.dir, 1, tx, ty);
  // flying home: turn the rocket around so the flame points at the other boxer
  else drawFacing(g, img, gl.x - f.dir * (tx - 2), y, -f.dir, 1, tx, ty);
}

// Text with a dark outline on the small picture, centred at x, y.
function label(text, x, y, color, size) {
  drawWord(g, text, Math.round(x), Math.round(y), color, size);
}

function drawWheelScene(dt) {
  drawPlace(g, 'arena', art, time, 0.4);
  g.fillStyle = 'rgba(11, 18, 38, 0.55)';
  g.fillRect(0, 0, W, H);
  if (wheel.phase === 'stopped') drawReveal(g, spin.boxer, spin.t, time);
  else wheel.draw(g, time);
  // the boxers already picked, in the bottom corners
  game.picks.forEach((id, i) => {
    if (!id || (game.mode === 1 && i === 1) || (i === spin.who && wheel.phase === 'stopped')) return;
    const head = roster[id].head, x = i ? W - lw(head) - 6 : 6, y = H - lh(head) - 6;
    blit(g, head, x, y);
    drawNumber(g, `P${i + 1}`, x + lw(head) / 2, y - 7, SIDE_COLOR[i], 1, 'center');
  });
  drawEffects(g, dt);
}

let lastDt = 0;
function draw(dt) {
  lastDt = dt;
  if (game.state === 'contact') { recorder.draw(ctx, canvas); return; }
  if (game.state === 'qa') {
    g.clearRect(0, 0, W, H);
    drawPoseSheet(g, roster[qa.id], { head: FEET_Y - AIM_Y.head, body: FEET_Y - AIM_Y.body, arm: FEET_Y - ARM_Y, launch: LAUNCH_OFFSET - 32 }, qa.mode, time);
    present(false);
    return;
  }
  if (game.state === 'wheel') { drawWheelScene(dt); present(false); return; }
  if (game.state === 'reveal') {
    drawPlace(g, reveal.shown || game.place, art, time, 0.5);
    if (!reveal.landed) { g.fillStyle = 'rgba(11, 18, 38, 0.35)'; g.fillRect(0, 0, W, H); }
    drawEffects(g, dt);
    present(false);
    return;
  }
  drawPlace(gb, game.place, art, time, excite);
  g.clearRect(0, 0, W, H);
  if (game.state === 'ready') { present(); return; }
  for (const f of fighters) drawShadow(g, Math.round(f.x) + 32, 121, f.duck > 0 ? 46 : 40);
  sumo.drawShadow(g);
  for (const f of fighters) drawAura(f);
  for (const f of fighters) drawFighter(f, dt);
  for (const f of fighters) drawGlove(f);
  sumo.draw(g, time);

  drawEffects(g, dt);
  if (game.state === 'playing' || game.state === 'win' || game.state === 'timeup') {
    drawHealth(teal); drawHealth(orange);
    // the boss's name under its health bar
    if (orange.boxer.id === 'boss') label(boxerName(orange.boxer), W - 28 - hudW() / 2, 17, orange.boxer.light, 7);
    drawSuperMeter(g, teal, 22, 24, hudW(), time);
    if (hasMeter(orange)) drawSuperMeter(g, orange, W - 22 - hudW(), 24, hudW(), time, true);
    if (game.mode === 1) {
      // the timer and level: top middle, or under your bars when the camera picture is there
      const tx = punchCam ? 22 + hudW() / 2 : W / 2, ty = punchCam ? 38 : 5;
      drawNumber(g, Math.ceil(timer.left), tx, ty, timer.left <= 10 ? COLORS.sparkle : COLORS.rope, 2, 'center');
      label(game.level === LEVELS.length ? boxerName(roster.boss) : t('levelN', { n: game.level }), tx, ty + 16, COLORS.rope, 7);
    }
  }
  // the computer is about to punch: "!" over its head, and "DUCK!" over you when the punch will be HIGH
  if (game.state === 'playing' && ai.warn > 0) {
    const blink = Math.floor(time * 10) % 2;
    label('!', orange.x + 32, BOXER_Y - 6 - blink, COLORS.sparkle, 16);
    if (ai.aim === 'head') label(t('duck'), teal.x + 32, BOXER_Y - 4 - blink, blink ? '#ffffff' : COLORS.sparkle, 11);
  }

  present();
}

// Scale the small picture up onto the screen (with any shake and thunder flash), plus the camera picture.
// layered = the place is on the back layer, so the camera picture goes between it and the boxers.
function present(layered = true) {
  if (flashT > 0) {
    g.fillStyle = `rgba(255, 255, 235, ${Math.min(1, flashT / 0.2) * 0.85})`;
    g.fillRect(0, 0, W, H);
  }
  ctx.fillStyle = COLORS.navy;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // the layers are drawn at RENDER.scale; only smooth them if the screen needs them shrunk
  ctx.imageSmoothingEnabled = pixels.width > view.w;
  ctx.imageSmoothingQuality = 'high';
  const shake = sumo.shake(), px = view.w / W;
  if (shakeT > 0) {
    const p = Math.min(1, shakeT / 0.4) * 4;
    shake.x += Math.round((Math.random() * 2 - 1) * p); shake.y += Math.round((Math.random() * 2 - 1) * p);
  }
  const sx = view.x + shake.x * px, sy = view.y + shake.y * px;
  if (game.state === 'ready') { drawReadyCamera(sx, sy); return; }
  if (layered) ctx.drawImage(back, sx, sy, view.w, view.h);
  // the players' own mirrored camera picture, top middle: big and BEHIND the boxers during a fight;
  // on the wheel small in the top-left, on top, so the title stays readable
  if (punchCam && layered) drawCamera(view.x + view.w * 0.285, view.y + view.h * 0.015, view.w * 0.43);
  ctx.drawImage(pixels, sx, sy, view.w, view.h);
  if (punchCam && !layered) drawCamera(view.x + view.w * 0.012, view.y + view.h * 0.02, view.w * 0.18);
  recorder.grab(canvas, view, lastDt);
}

// The camera picture (4:3) at x, y, w wide, with each player's stand box in their boxer's colour.
function drawCamera(cx, cy, cw, opts) {
  const ch = cw * 0.75;
  camBodies().forEach((b, i) => { b.color = fighters[i].boxer.color; });
  if (game.mode === 1 && soloCam) {
    // 1 player: the camera picture with our own (duck-seeing) tracker's boxes
    ctx.save();
    ctx.globalAlpha = 0.85; soloCam.cam.draw(ctx, cx, cy, cw, ch); ctx.globalAlpha = 1;
    ctx.lineWidth = Math.max(2, cw / 80); ctx.strokeStyle = COLORS.outline; ctx.strokeRect(cx, cy, cw, ch);
    ctx.restore();
    soloCam.body.drawZones(ctx, cx, cy, cw, ch, true, opts);
  } else punchCam.draw(ctx, cx, cy, cw, ch, opts);
}

// GET READY: the place dimmed, and the camera picture as big as fits between the title and the help line.
function drawReadyCamera(sx, sy) {
  ctx.drawImage(back, sx, sy, view.w, view.h);
  ctx.fillStyle = 'rgba(11, 18, 38, 0.6)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const top = canvas.height * 0.13, room = canvas.height * 0.76;
  const cw = Math.min(canvas.width * 0.94, room / 0.75);
  drawCamera((canvas.width - cw) / 2, top + (room - cw * 0.75) / 2, cw, { big: true });
}

startLoop(update);
