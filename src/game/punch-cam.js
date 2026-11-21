// Turns the webcam into punch buttons. Each player STANDS near the OUTER edge of the camera picture and
// punches TOWARD THE MIDDLE: a fist reaching into the HIGH box = head punch, into the LOW box = body punch.
// Moving around in the "stand here" area walks your boxer and can never fire a punch.
// With 2 players the mirrored picture is cut in half: left half = player 1 (teal), right half = player 2
// (orange); their punch boxes sit next to the yellow middle line. With 1 player you stand on the LEFT and
// punch toward the RIGHT (toward the computer boxer). In 2 players, dropping your head fast in the
// stand area = DUCK.
// Uses src/kit/webcam.js (motion only, nothing is saved or sent anywhere).
import { startWebcam } from '../kit/webcam.js';

// ============ ALL THE TUNING NUMBERS ============
// Boxes are 0..1 of the player's REGION (each half for 2 players, the whole picture for 1 player), but
// sideways they count from the OUTER edge: x = 0 is the outer edge (where you stand), x = 1 is the INNER
// edge (the middle line in 2 players, the right edge in 1 player). y = 0 is the top, y = 1 the bottom.
export const TUNE = {
  zones: {
    stand: { x0: 0.0, y0: 0.0, x1: 0.55, y1: 1.0 },   // "stand here": walking + ducking are read here only
    high: { x0: 0.64, y0: 0.08, x1: 0.97, y1: 0.42 },  // fist into here = HIGH (head) punch
    low: { x0: 0.64, y0: 0.50, x1: 0.97, y1: 0.85 },   // fist into here = LOW (body) punch
  },
  punch: {
    threshold: 0.08,    // how much of a punch box must move at once (0..1); lower = easier punches
    overCalm: 2.5,      // ...and this many times more than that box's usual background wiggle
    cooldown: 0.6,      // seconds before the next punch counts
    standOut: 1.5,      // one box must move this many times more than the other (a whole body moving in = no punch)
    maxStand: 0.4,      // if the whole stand area flashes (lights, camera adjusting) there's no punch
  },
  // Walking: the middle of the movement in the STAND area, slowly smoothed, says where you stand.
  walk: {
    edge0: 0.15, edge1: 0.85, // where in the stand area counts as the far left / far right of the ring
    smooth: 0.05,           // how fast the walk follows the movement each frame (small = calm, no jitter)
    deadZone: 0.08,         // ignore wiggles smaller than this
    minMotion: 0.012,       // less movement than this in the stand area = standing still, keep the spot
    maxMotion: 0.35,        // a whole-area flash (lights, camera adjusting) doesn't move you
    punchPause: 0.4,        // seconds the walk stops listening after a punch or duck
    strips: 12,             // the stand area is cut into this many columns to find the middle of the movement
  },
  // Ducking (2 players only): the TOP EDGE of the movement in the stand area (the highest moving row,
  // usually your head) drops quickly. A coloured line across the stand area shows that top edge.
  duck: {
    hold: 1.0,          // seconds the boxer stays down after a duck is seen (game side, also for keys)
    rows: 16,           // the stand area is cut into this many rows to find the top edge of the movement
    rowMin: 0.05,       // a row counts as moving when this much of it moves (0..1)
    window: 0.6,        // seconds of history: the drop must happen within this time
    drop: 0.10,         // the top edge must fall at least this far (0..1 of the picture height)...
    startTop: 0.6,      // ...starting from above this height (your head was up)
    settle: 0.15,       // seconds: "now" = the lowest top edge seen this recently (you stop moving once down)
    minMotion: 0.010,   // average movement in the stand area over the window (lower = easier ducks)
    cooldown: 0.9,      // seconds before another duck counts
    afterPunch: 0.3,    // no duck this soon after a punch (the punching shoulder moves too)
    punchAfter: 0.5,    // no punch this soon after a duck (coming back up shakes things)
  },
  // GET READY (before each camera fight): a stand box turns green with a tick when someone moves in it.
  ready: {
    motion: 0.012,      // this much movement in the stand area = someone is standing there
    hold: 0.7,          // seconds the box stays green after the last movement (standing still is OK)
    startAfter: 1.0,    // seconds every stand box must be green before the fight starts by itself
  },
};
// Short names (src/main.js reads DUCK.hold).
export const PUNCH = TUNE.punch, WALK = TUNE.walk, DUCK = TUNE.duck, ZONES = TUNE.zones, READY = TUNE.ready;

// One player's body in one region of the camera picture: { x0, y0, x1, y1 } as 0..1 of the picture.
// inner = 'right' or 'left': which side of the region faces the middle (where the punch boxes are).
// Each frame (after cam.update()) call tracker.update(dt): returns 'head', 'body' or 'duck', else null.
// tracker.walkX is 0..1 where the player stands (0 = far left, 1 = far right of their stand area), null until they've moved.
// tracker.here is true while someone is moving in the stand area (GET READY). tracker.color can be changed
// (the boxer's colour from the wheel); tag = 'P1' / 'P2' on the stand box, '' for 1 player.
export function trackBody(cam, region = { x0: 0, y0: 0, x1: 1, y1: 1 }, { duck = false, color = '#1fb8b0', inner = 'right', tag = '' } = {}) {
  const rw = region.x1 - region.x0, rh = region.y1 - region.y0;
  // a box in outer→inner coordinates → a box in picture coordinates (0..1)
  const toPic = (z) => ({
    x0: inner === 'right' ? region.x0 + z.x0 * rw : region.x1 - z.x1 * rw,
    x1: inner === 'right' ? region.x0 + z.x1 * rw : region.x1 - z.x0 * rw,
    y0: region.y0 + z.y0 * rh, y1: region.y0 + z.y1 * rh,
  });
  const zoneOf = (p) => cam.zone(p.x0, p.y0, p.x1, p.y1);
  const KEY = { high: 'head', low: 'body' };
  const calm = { high: 0, low: 0 };   // average movement in each punch box when nobody punches
  const level = { high: 0, low: 0, stand: 0 };
  let wait = 0, flash = 0, flashZone = null;
  let follow = null, walkX = null, hold = 0;   // smoothed movement middle, and the walk position it gives
  let clock = 0, duckWait = 0, sincePunch = 99, duckFlash = 0, top = null;
  let seen = 0;                                // seconds the stand box stays "someone is here"
  const history = [];                          // { t, top, motion } for the duck check
  const counts = { head: 0, body: 0, duck: 0 };

  // middle of the movement across the stand area (0..1, left→right of the area), or null when still
  function middleX(s) {
    let sum = 0, total = 0;
    const w = s.x1 - s.x0;
    for (let i = 0; i < WALK.strips; i++) {
      const m = cam.zone(s.x0 + w * i / WALK.strips, s.y0, s.x0 + w * (i + 1) / WALK.strips, s.y1);
      sum += m * (i + 0.5) / WALK.strips; total += m;
    }
    const motion = total / WALK.strips;
    return motion < WALK.minMotion || motion > WALK.maxMotion ? null : sum / total;
  }

  // highest moving row in the stand area (0 = top, 1 = bottom of the region) or null, and how much moves
  function topEdge(s) {
    let first = null, total = 0;
    for (let r = 0; r < DUCK.rows; r++) {
      const m = cam.zone(s.x0, region.y0 + rh * r / DUCK.rows, s.x1, region.y0 + rh * (r + 1) / DUCK.rows);
      total += m;
      if (first === null && m > DUCK.rowMin) first = (r + 0.5) / DUCK.rows;
    }
    return { top: first, motion: total / DUCK.rows };
  }

  function seeDuck(dt, s) {
    clock += dt;
    duckWait = Math.max(0, duckWait - dt);
    const now = topEdge(s);
    top = now.top;
    history.push({ t: clock, top: now.top, motion: now.motion });
    while (history.length && history[0].t < clock - DUCK.window) history.shift();
    if (duckWait > 0 || sincePunch < DUCK.afterPunch) return false;
    let motion = 0, highest = null, latest = null;
    for (const h of history) {
      motion += h.motion;
      if (h.top === null) continue;
      if (h.t >= clock - DUCK.settle) latest = latest === null ? h.top : Math.max(latest, h.top);
      else highest = highest === null ? h.top : Math.min(highest, h.top);
    }
    motion /= history.length;
    if (latest === null || highest === null) return false;
    if (motion < DUCK.minMotion || highest > DUCK.startTop || latest - highest < DUCK.drop) return false;
    duckWait = DUCK.cooldown; duckFlash = 0.6; history.length = 0;
    wait = Math.max(wait, DUCK.punchAfter); hold = WALK.punchPause;
    return true;
  }

  return {
    region, level, counts, color,
    get walkX() { return walkX; },
    get here() { return seen > 0; },
    update(dt) {
      wait = Math.max(0, wait - dt);
      flash = Math.max(0, flash - dt);
      hold = Math.max(0, hold - dt);
      duckFlash = Math.max(0, duckFlash - dt);
      sincePunch += dt;
      const s = toPic(ZONES.stand);
      level.stand = zoneOf(s);
      seen = level.stand > READY.motion && level.stand < PUNCH.maxStand ? READY.hold : Math.max(0, seen - dt);
      const mx = hold > 0 ? null : middleX(s);
      if (mx !== null) {
        follow = follow === null ? mx : follow + (mx - follow) * WALK.smooth;
        const spot = Math.max(0, Math.min(1, (follow - WALK.edge0) / (WALK.edge1 - WALK.edge0)));
        if (walkX === null || Math.abs(spot - walkX) > WALK.deadZone) walkX = spot;
      }
      let best = null;
      for (const name of ['high', 'low']) {
        level[name] = zoneOf(toPic(ZONES[name]));
        const strong = level[name] > PUNCH.threshold && level[name] > calm[name] * PUNCH.overCalm;
        if (strong && (!best || level[name] > level[best])) best = name;
        calm[name] = calm[name] * 0.95 + Math.min(level[name], PUNCH.threshold) * 0.05;
      }
      if (duck && seeDuck(dt, s)) { counts.duck++; return 'duck'; }
      if (!best || wait > 0 || level.stand > PUNCH.maxStand) return null;
      const other = level[best === 'high' ? 'low' : 'high'];
      if (level[best] < other * PUNCH.standOut) return null;   // both boxes moving = a whole body, not a fist
      wait = PUNCH.cooldown; hold = WALK.punchPause; flash = 0.3; flashZone = best; sincePunch = 0;
      counts[KEY[best]]++;
      return KEY[best];
    },
    // Outlines this player's stand area and punch boxes on a camera picture drawn at x, y, w, h.
    // big = the GET READY picture: "P1 STAND HERE" in big letters.
    drawZones(ctx, x, y, w, h, labels = true, { big = false } = {}) {
      const color = this.color, ok = seen > 0;
      ctx.save();
      const line = Math.max(2, w / 120);
      ctx.lineWidth = line;
      ctx.textBaseline = 'top';
      const px = (p) => ({ x: x + p.x0 * w, y: y + p.y0 * h, w: (p.x1 - p.x0) * w, h: (p.y1 - p.y0) * h });
      // stand here: a thick box in the boxer's colour (green with a tick when someone is in it), and a label
      const s = px(toPic(ZONES.stand));
      const boxC = ok ? '#3ddc5a' : color, thick = line * (big ? 3.5 : 2.5);
      ctx.globalAlpha = ok ? 0.28 : 0.16; ctx.fillStyle = boxC; ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.globalAlpha = 1; ctx.lineWidth = thick;
      ctx.strokeStyle = '#0b1226'; ctx.strokeRect(s.x + thick / 2, s.y + thick / 2, s.w - thick, s.h - thick);
      ctx.lineWidth = thick * 0.6; ctx.strokeStyle = boxC;
      ctx.strokeRect(s.x + thick / 2, s.y + thick / 2, s.w - thick, s.h - thick);
      const words = big ? [tag, ok ? 'READY!' : 'STAND', ok ? '' : 'HERE'].filter(Boolean) : [`${tag ? tag + ' ' : ''}STAND`];
      const size = Math.round(Math.max(9, Math.min(h / (big ? 9 : 12), s.w / (big ? 4.2 : 4.5 + tag.length * 0.9))));
      ctx.font = `bold ${size}px "Trebuchet MS", sans-serif`;
      ctx.textAlign = 'center'; ctx.lineJoin = 'round';
      const ty = big ? s.y + s.h * 0.42 - (words.length - 1) * size * 0.55 : s.y + thick * 1.5;   // small: at the top, above the boxers
      words.forEach((word, i) => {
        const wy = ty + i * size * 1.1;
        ctx.lineWidth = Math.max(3, size / 6); ctx.strokeStyle = '#0b1226'; ctx.strokeText(word, s.x + s.w / 2, wy);
        ctx.fillStyle = i === 0 && tag ? (ok ? '#3ddc5a' : color) : '#f4e4c4'; ctx.fillText(word, s.x + s.w / 2, wy);
      });
      if (ok) {
        ctx.font = `${Math.round(size * (big ? 1.6 : 0.9))}px "Segoe UI Emoji", sans-serif`;
        ctx.fillText('✅', s.x + s.w / 2, big ? s.y + s.h * 0.1 : ty + size * 1.1);
      }
      ctx.lineWidth = line;
      ctx.textAlign = 'left';
      for (const name of ['high', 'low']) {
        const z = px(toPic(ZONES[name])), lit = flash > 0 && flashZone === name;
        ctx.fillStyle = lit ? '#ffd23f' : '#0b1226';
        ctx.globalAlpha = lit ? 0.45 : 0.25; ctx.fillRect(z.x, z.y, z.w, z.h); ctx.globalAlpha = 1;
        ctx.strokeStyle = lit ? '#ffd23f' : '#f4e4c4';
        ctx.lineWidth = line * 1.3;
        ctx.strokeRect(z.x, z.y, z.w, z.h);
        // movement meter along the bottom of the box
        ctx.fillStyle = lit ? '#ffd23f' : color;
        ctx.fillRect(z.x, z.y + z.h - h / 24, Math.min(1, level[name] / PUNCH.threshold) * z.w, h / 24);
        const text = labels ? (name === 'high' ? 'HEAD' : 'BODY') : (name === 'high' ? 'HIGH' : 'LOW');
        ctx.font = `bold ${Math.round(Math.max(8, Math.min(h / 10, z.w / 3.2)))}px "Trebuchet MS", sans-serif`;
        ctx.fillStyle = lit ? '#ffd23f' : '#f4e4c4';
        ctx.fillText(text, z.x + 3, z.y + 3);
      }
      if (duck) {
        // the top edge of your movement: a line across the stand area; "DUCK!" when a duck is seen
        if (top !== null) {
          ctx.fillStyle = duckFlash > 0 ? '#ffd23f' : color;
          ctx.fillRect(s.x, y + (region.y0 + top * rh) * h - 2, s.w, 4);
        }
        if (duckFlash > 0) {
          ctx.globalAlpha = 0.35; ctx.fillStyle = '#ffd23f'; ctx.fillRect(s.x, s.y, s.w, s.h); ctx.globalAlpha = 1;
          ctx.font = `bold ${Math.round(Math.min(h / 6, s.w / 3.2))}px "Trebuchet MS", sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = 4; ctx.strokeStyle = '#0b1226';
          ctx.strokeText('DUCK!', s.x + s.w / 2, s.y + s.h * 0.4);
          ctx.fillStyle = '#ffd23f';
          ctx.fillText('DUCK!', s.x + s.w / 2, s.y + s.h * 0.4);
        }
      }
      ctx.restore();
    },
  };
}

const COLOR = ['#1fb8b0', '#f0662c'];

// Starts the camera. players = 1 (the whole picture) or 2 (left half = player 1, right half = player 2).
export async function startPunchCam(players = 1) {
  const cam = await startWebcam();
  let bodies = [];
  const pc = {
    cam,
    get bodies() { return bodies; },
    get players() { return bodies.length; },
    setPlayers(n) {
      bodies = n === 2
        ? [trackBody(cam, { x0: 0, y0: 0, x1: 0.5, y1: 1 }, { duck: true, color: COLOR[0], inner: 'right', tag: 'P1' }),
           trackBody(cam, { x0: 0.5, y0: 0, x1: 1, y1: 1 }, { duck: true, color: COLOR[1], inner: 'left', tag: 'P2' })]
        : [trackBody(cam, undefined, { color: COLOR[0], inner: 'right' })];
    },
    // Call every frame; returns one entry per player: 'head', 'body', 'duck' or null.
    update(dt) { cam.update(); return bodies.map((b) => b.update(dt)); },
    // Mirrored camera picture with the zones outlined, at full screen resolution. opts.big = GET READY labels.
    draw(ctx, x, y, w, h, opts) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      cam.draw(ctx, x, y, w, h);
      ctx.globalAlpha = 1;
      ctx.lineWidth = Math.max(2, w / 80);
      ctx.strokeStyle = '#0b1226';
      ctx.strokeRect(x, y, w, h);
      if (bodies.length === 2) {
        // divider down the middle (each player's P1 / P2 tag is on their stand box)
        ctx.fillStyle = '#ffd23f';
        ctx.fillRect(x + w / 2 - Math.max(1, w / 160), y, Math.max(2, w / 80), h);
      }
      ctx.restore();
      for (const b of bodies) b.drawZones(ctx, x, y, w, h, bodies.length === 1, opts);
    },
  };
  pc.setPlayers(players);
  return pc;
}

// Kid-friendly words for each way the camera can fail (error.reason from src/kit/webcam.js).
export function cameraTrouble(reason) {
  return {
    denied: 'The camera said no. Ask a grown-up to click the 📷 in the address bar.',
    'no-camera': 'We can\'t find a camera on this computer.',
    busy: 'Another app is using the camera. Close it and try again.',
    insecure: 'The camera only works on the published game page.',
    unsupported: 'This browser can\'t use the camera.',
  }[reason] || 'The camera didn\'t start.';
}
