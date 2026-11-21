// Turns the webcam into punch buttons: a sudden burst of movement in the UPPER zone = head punch,
// in the LOWER zone = body punch. With 2 players the mirrored picture is cut in half: left half = player 1
// (teal), right half = player 2 (orange), and each half can also DUCK.
// Uses src/kit/webcam.js (motion only, nothing is saved or sent anywhere).
import { startWebcam } from '../kit/webcam.js';

// Easy-to-tune numbers. Zones are 0..1 of the player's REGION of the mirrored picture
// (the whole picture for 1 player; each half for 2 players).
export const PUNCH = {
  head: { x0: 0.2, y0: 0.08, x1: 0.8, y1: 0.42 },
  body: { x0: 0.2, y0: 0.48, x1: 0.8, y1: 0.85 },
  threshold: 0.1,     // how much of a zone must move at once (0..1)
  overCalm: 2.5,      // ...and this many times more than that zone's usual background wiggle
  cooldown: 0.6,      // seconds before the next punch counts
  standOut: 1.6,      // a punch zone must move this many times more than the other zone (walking moves both)
};

// Walking: the middle of the movement in the region, slowly smoothed, says where you stand (0 = left, 1 = right).
export const WALK = {
  edge0: 0.2, edge1: 0.8, // where in the region counts as the far left / far right of the ring
  smooth: 0.06,           // how fast the walk follows the movement each frame (small = calm, no jitter)
  deadZone: 0.06,         // ignore wiggles smaller than this
  minMotion: 0.01,        // less movement than this in the region = standing still, keep the spot
  maxMotion: 0.35,        // a whole-region flash (lights, camera adjusting) doesn't move you
  punchPause: 0.35,       // seconds the walk stops listening after a punch, so punching arms don't drag you along
  strips: 16,             // the region is cut into this many columns to find the middle of the movement
};

// Ducking (2 players only), motion only: the TOP EDGE of the movement (the highest row that moves,
// usually your head) suddenly drops a long way while lots of the region is moving.
export const DUCK = {
  hold: 0.8,          // seconds the boxer stays down after a duck is seen (game side, also for keys)
  rows: 12,           // the region is cut into this many rows to find the top edge of the movement
  rowMin: 0.08,       // a row counts as moving when this much of it moves (0..1)
  window: 0.4,        // seconds of history: the drop must happen within this time
  drop: 0.2,          // the top edge must fall at least this far (0..1 of the region height)...
  startTop: 0.45,     // ...starting from above this height (your head was up)
  minMotion: 0.04,    // average movement in the region over the window (a duck moves a lot of you)
  cooldown: 1.2,      // seconds before another duck counts
  afterPunch: 0.45,   // no duck this soon after a punch (the punch arm also moves the top edge)
  punchAfter: 0.5,    // no punch this soon after a duck (coming back up looks like a punch)
};

// One player's body in one region of the camera picture: { x0, y0, x1, y1 } as 0..1 of the picture.
// Each frame (after cam.update()) call tracker.update(dt): returns 'head', 'body' or 'duck', else null.
// tracker.walkX is 0..1 where the player stands inside the region (null until they've moved).
export function trackBody(cam, region = { x0: 0, y0: 0, x1: 1, y1: 1 }, { duck = false, color = '#1fb8b0' } = {}) {
  const rw = region.x1 - region.x0, rh = region.y1 - region.y0;
  const inRegion = (z) => cam.zone(region.x0 + z.x0 * rw, region.y0 + z.y0 * rh, region.x0 + z.x1 * rw, region.y0 + z.y1 * rh);
  const calm = { head: 0, body: 0 };   // average movement in each zone when nobody punches
  const level = { head: 0, body: 0 };
  let wait = 0, flash = 0, flashZone = null;
  let follow = null, walkX = null, hold = 0;   // smoothed movement middle, and the walk position it gives
  let clock = 0, duckWait = 0, sincePunch = 99, duckFlash = 0, top = null;
  const history = [];                          // { t, top, motion } for the duck check
  const counts = { head: 0, body: 0, duck: 0 };

  // middle of the movement across the region (0..1 of the region), or null when it is still
  function middleX() {
    let sum = 0, total = 0;
    for (let i = 0; i < WALK.strips; i++) {
      const m = inRegion({ x0: i / WALK.strips, y0: 0, x1: (i + 1) / WALK.strips, y1: 1 });
      sum += m * (i + 0.5) / WALK.strips; total += m;
    }
    const motion = total / WALK.strips;
    return motion < WALK.minMotion || motion > WALK.maxMotion ? null : sum / total;
  }

  // highest moving row (0 = top of the region, 1 = bottom) or null, and how much of the region moves
  function topEdge() {
    let first = null, total = 0;
    for (let r = 0; r < DUCK.rows; r++) {
      const m = inRegion({ x0: 0.1, y0: r / DUCK.rows, x1: 0.9, y1: (r + 1) / DUCK.rows });
      total += m;
      if (first === null && m > DUCK.rowMin) first = (r + 0.5) / DUCK.rows;
    }
    return { top: first, motion: total / DUCK.rows };
  }

  function seeDuck(dt) {
    clock += dt;
    duckWait = Math.max(0, duckWait - dt);
    const now = topEdge();
    top = now.top;
    history.push({ t: clock, top: now.top, motion: now.motion });
    while (history.length && history[0].t < clock - DUCK.window) history.shift();
    if (duckWait > 0 || sincePunch < DUCK.afterPunch || now.top === null) return false;
    let motion = 0, highest = 1;
    for (const h of history) {
      motion += h.motion;
      if (h.top !== null) highest = Math.min(highest, h.top);
    }
    motion /= history.length;
    if (motion < DUCK.minMotion || highest > DUCK.startTop || now.top - highest < DUCK.drop) return false;
    duckWait = DUCK.cooldown; duckFlash = 0.5; history.length = 0;
    wait = Math.max(wait, DUCK.punchAfter); hold = WALK.punchPause;
    return true;
  }

  return {
    region, level, counts,
    get walkX() { return walkX; },
    update(dt) {
      wait = Math.max(0, wait - dt);
      flash = Math.max(0, flash - dt);
      hold = Math.max(0, hold - dt);
      duckFlash = Math.max(0, duckFlash - dt);
      sincePunch += dt;
      const mx = hold > 0 ? null : middleX();
      if (mx !== null) {
        follow = follow === null ? mx : follow + (mx - follow) * WALK.smooth;
        const spot = Math.max(0, Math.min(1, (follow - WALK.edge0) / (WALK.edge1 - WALK.edge0)));
        if (walkX === null || Math.abs(spot - walkX) > WALK.deadZone) walkX = spot;
      }
      let best = null;
      for (const name of ['head', 'body']) {
        level[name] = inRegion(PUNCH[name]);
        const strong = level[name] > PUNCH.threshold && level[name] > calm[name] * PUNCH.overCalm;
        if (strong && (!best || level[name] > level[best])) best = name;
        calm[name] = calm[name] * 0.95 + Math.min(level[name], PUNCH.threshold) * 0.05;
      }
      if (duck && seeDuck(dt)) { counts.duck++; return 'duck'; }
      if (!best || wait > 0) return null;
      const other = level[best === 'head' ? 'body' : 'head'];
      if (level[best] < other * PUNCH.standOut) return null;   // whole body moving = walking (or ducking), not punching
      wait = PUNCH.cooldown; hold = WALK.punchPause; flash = 0.3; flashZone = best; sincePunch = 0;
      counts[best]++;
      return best;
    },
    // Outlines this player's punch zones on a camera picture drawn at x, y, w, h.
    drawZones(ctx, x, y, w, h, labels = true) {
      ctx.save();
      ctx.lineWidth = Math.max(2, w / 80);
      ctx.font = `bold ${Math.round(h / 10)}px "Trebuchet MS", sans-serif`;
      ctx.textBaseline = 'top';
      for (const name of ['head', 'body']) {
        const z = PUNCH[name], lit = flash > 0 && flashZone === name;
        const zx = x + (region.x0 + z.x0 * rw) * w, zy = y + (region.y0 + z.y0 * rh) * h;
        const zw = (z.x1 - z.x0) * rw * w, zh = (z.y1 - z.y0) * rh * h;
        ctx.strokeStyle = lit ? '#ffd23f' : '#f4e4c4';
        ctx.setLineDash(lit ? [] : [w / 30, w / 40]);
        ctx.strokeRect(zx, zy, zw, zh);
        // movement meter along the bottom of the zone
        ctx.fillStyle = lit ? '#ffd23f' : color;
        ctx.fillRect(zx, zy + zh - h / 20, Math.min(1, level[name] / PUNCH.threshold) * zw, h / 20);
        ctx.fillStyle = lit ? '#ffd23f' : '#f4e4c4';
        if (labels) ctx.fillText(name === 'head' ? 'HEAD 100' : 'BODY 50', zx + 4, zy + 3);
        else ctx.fillText(name === 'head' ? 'HIGH' : 'LOW', zx + 3, zy + 3);
      }
      if (duck) {
        // the top edge of your movement: a little arrow on the region's side; "DUCK!" when a duck is seen
        const rx = x + region.x0 * w, ry = y + region.y0 * h, rhh = rh * h;
        if (top !== null) { ctx.fillStyle = color; ctx.fillRect(rx + 2, ry + top * rhh - 3, w / 40, 6); }
        if (duckFlash > 0) {
          ctx.font = `bold ${Math.round(h / 6)}px "Trebuchet MS", sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = 4; ctx.setLineDash([]); ctx.strokeStyle = '#0b1226';
          ctx.strokeText('DUCK!', rx + rw * w / 2, ry + rhh * 0.5);
          ctx.fillStyle = '#ffd23f';
          ctx.fillText('DUCK!', rx + rw * w / 2, ry + rhh * 0.5);
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
        ? [trackBody(cam, { x0: 0, y0: 0, x1: 0.5, y1: 1 }, { duck: true, color: COLOR[0] }),
           trackBody(cam, { x0: 0.5, y0: 0, x1: 1, y1: 1 }, { duck: true, color: COLOR[1] })]
        : [trackBody(cam, undefined, { color: COLOR[0] })];
    },
    // Call every frame; returns one entry per player: 'head', 'body', 'duck' or null.
    update(dt) { cam.update(); return bodies.map((b) => b.update(dt)); },
    // Small mirrored camera picture with the zones outlined, at full screen resolution.
    draw(ctx, x, y, w, h) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      cam.draw(ctx, x, y, w, h);
      ctx.globalAlpha = 1;
      ctx.lineWidth = Math.max(2, w / 80);
      ctx.strokeStyle = '#0b1226';
      ctx.strokeRect(x, y, w, h);
      if (bodies.length === 2) {
        // divider down the middle, and a coloured P1 / P2 tag in each half
        ctx.fillStyle = '#ffd23f';
        ctx.fillRect(x + w / 2 - Math.max(1, w / 160), y, Math.max(2, w / 80), h);
        ctx.font = `bold ${Math.round(h / 8)}px "Trebuchet MS", sans-serif`;
        ctx.textBaseline = 'bottom';
        for (let i = 0; i < 2; i++) {
          const tx = x + (i ? w - w * 0.13 : w * 0.02), ty = y + h - 3;
          ctx.fillStyle = '#0b1226'; ctx.fillRect(tx - 2, ty - h / 8 - 2, w * 0.11, h / 8 + 4);
          ctx.fillStyle = COLOR[i]; ctx.fillText(`P${i + 1}`, tx + 2, ty + 1);
        }
      }
      ctx.restore();
      for (const b of bodies) b.drawZones(ctx, x, y, w, h, bodies.length === 1);
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
