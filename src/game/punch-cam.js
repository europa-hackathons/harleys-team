// Turns the webcam into two punch buttons: a sudden burst of movement in the UPPER zone = head punch,
// in the LOWER zone = body punch. Uses src/kit/webcam.js (motion only, nothing is saved or sent anywhere).
import { startWebcam } from '../kit/webcam.js';

// Easy-to-tune numbers. Zones are in the mirrored picture, 0..1 of its width/height.
export const PUNCH = {
  head: { x0: 0.2, y0: 0.08, x1: 0.8, y1: 0.42 },
  body: { x0: 0.2, y0: 0.48, x1: 0.8, y1: 0.85 },
  threshold: 0.1,     // how much of a zone must move at once (0..1)
  overCalm: 2.5,      // ...and this many times more than that zone's usual background wiggle
  cooldown: 0.6,      // seconds before the next punch counts
};

export async function startPunchCam() {
  const cam = await startWebcam();
  const calm = { head: 0, body: 0 };   // average movement in each zone when nobody punches
  let wait = 0;
  let flash = 0, flashZone = null;     // for drawing: a zone lights up after a punch
  const level = { head: 0, body: 0 };
  const zoneLevel = (z) => cam.zone(z.x0, z.y0, z.x1, z.y1);

  return {
    cam, level,
    // Call every frame; returns 'head' or 'body' on the frame a punch is seen, otherwise null.
    update(dt) {
      cam.update();
      wait = Math.max(0, wait - dt);
      flash = Math.max(0, flash - dt);
      let best = null;
      for (const name of ['head', 'body']) {
        level[name] = zoneLevel(PUNCH[name]);
        const strong = level[name] > PUNCH.threshold && level[name] > calm[name] * PUNCH.overCalm;
        if (strong && (!best || level[name] > level[best])) best = name;
        calm[name] = calm[name] * 0.95 + Math.min(level[name], PUNCH.threshold) * 0.05;
      }
      if (!best || wait > 0) return null;
      wait = PUNCH.cooldown; flash = 0.3; flashZone = best;
      return best;
    },
    // Small mirrored camera picture with both punch zones outlined, at full screen resolution.
    draw(ctx, x, y, w, h) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      cam.draw(ctx, x, y, w, h);
      ctx.globalAlpha = 1;
      ctx.lineWidth = Math.max(2, w / 80);
      ctx.strokeStyle = '#0b1226';
      ctx.strokeRect(x, y, w, h);
      ctx.font = `bold ${Math.round(h / 9)}px "Trebuchet MS", sans-serif`;
      ctx.textBaseline = 'top';
      for (const name of ['head', 'body']) {
        const z = PUNCH[name], lit = flash > 0 && flashZone === name;
        const zx = x + z.x0 * w, zy = y + z.y0 * h, zw = (z.x1 - z.x0) * w, zh = (z.y1 - z.y0) * h;
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
