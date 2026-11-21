// Turns the webcam into two punch buttons: a sudden burst of movement in the UPPER zone = head punch,
// in the LOWER zone = body punch. Uses src/kit/webcam.js (motion only, nothing is saved or sent anywhere).
import { startWebcam } from '../kit/webcam.js';

// Easy-to-tune numbers. Zones are 0..1 of the player's REGION of the mirrored picture
// (the whole picture for 1 player; later each half for 2 players).
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

// One player's body in one region of the camera picture: { x0, y0, x1, y1 } as 0..1 of the picture.
// Each frame (after cam.update()) call tracker.update(dt): returns 'head' or 'body' on a punch, else null.
// tracker.walkX is 0..1 where the player stands inside the region (null until they've moved).
export function trackBody(cam, region = { x0: 0, y0: 0, x1: 1, y1: 1 }) {
  const rw = region.x1 - region.x0, rh = region.y1 - region.y0;
  const inRegion = (z) => cam.zone(region.x0 + z.x0 * rw, region.y0 + z.y0 * rh, region.x0 + z.x1 * rw, region.y0 + z.y1 * rh);
  const calm = { head: 0, body: 0 };   // average movement in each zone when nobody punches
  const level = { head: 0, body: 0 };
  let wait = 0, flash = 0, flashZone = null;
  let follow = null, walkX = null, hold = 0;   // smoothed movement middle, and the walk position it gives

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

  return {
    region, level,
    get walkX() { return walkX; },
    update(dt) {
      wait = Math.max(0, wait - dt);
      flash = Math.max(0, flash - dt);
      hold = Math.max(0, hold - dt);
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
      if (!best || wait > 0) return null;
      const other = level[best === 'head' ? 'body' : 'head'];
      if (level[best] < other * PUNCH.standOut) return null;   // whole body moving = walking, not punching
      wait = PUNCH.cooldown; hold = WALK.punchPause; flash = 0.3; flashZone = best;
      return best;
    },
    // Outlines this player's punch zones on a camera picture drawn at x, y, w, h.
    drawZones(ctx, x, y, w, h) {
      ctx.save();
      ctx.lineWidth = Math.max(2, w / 80);
      ctx.font = `bold ${Math.round(h / 9)}px "Trebuchet MS", sans-serif`;
      ctx.textBaseline = 'top';
      for (const name of ['head', 'body']) {
        const z = PUNCH[name], lit = flash > 0 && flashZone === name;
        const zx = x + (region.x0 + z.x0 * rw) * w, zy = y + (region.y0 + z.y0 * rh) * h;
        const zw = (z.x1 - z.x0) * rw * w, zh = (z.y1 - z.y0) * rh * h;
        ctx.strokeStyle = lit ? '#ffd23f' : '#f4e4c4';
        ctx.setLineDash(lit ? [] : [w / 30, w / 40]);
        ctx.strokeRect(zx, zy, zw, zh);
        // movement meter along the bottom of the zone
        ctx.fillStyle = lit ? '#ffd23f' : '#1fb8b0';
        ctx.fillRect(zx, zy + zh - h / 20, Math.min(1, level[name] / PUNCH.threshold) * zw, h / 20);
        ctx.fillStyle = lit ? '#ffd23f' : '#f4e4c4';
        ctx.fillText(name === 'head' ? 'HEAD 100' : 'BODY 50', zx + 4, zy + 3);
      }
      ctx.restore();
    },
  };
}

// One player using the whole camera picture.
export async function startPunchCam() {
  const cam = await startWebcam();
  const body = trackBody(cam);
  return {
    cam, body, level: body.level,
    get walkX() { return body.walkX; },
    // Call every frame; returns 'head' or 'body' on the frame a punch is seen, otherwise null.
    update(dt) { cam.update(); return body.update(dt); },
    // Small mirrored camera picture with the punch zones outlined, at full screen resolution.
    draw(ctx, x, y, w, h) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      cam.draw(ctx, x, y, w, h);
      ctx.globalAlpha = 1;
      ctx.lineWidth = Math.max(2, w / 80);
      ctx.strokeStyle = '#0b1226';
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
      body.drawZones(ctx, x, y, w, h);
    },
  };
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
