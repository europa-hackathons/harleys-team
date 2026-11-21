// The Sumo finish: when a fight ends, a cartoon sumo wrestler whistles down from the sky,
// belly-flops onto the loser (cartoon squash, puff of dust and stars, nobody gets hurt),
// sits up and waves, and the loser pops back up dizzy. Then the results screen shows.
// Frames: [falling, belly-flop, sitting-waving] (first pixel art), or the HD
// [descending, squash, recovery (standing up), sittingWave]; sumo-dust.png = [small, big, fading].
import { COLORS, drawShadow } from './scene.js';
import { starBurst, popWord, playFrames } from './effects.js';
import { sfx } from './sfx.js';
import { blit, lw, lh } from './sprite.js';

// Timing in seconds (the whole show is about 3 s; a click or key skips it after SKIP_AFTER).
export const SUMO = {
  fallStart: 0.25,   // a short freeze, then he drops
  land: 1.0,         // FLOMP!
  sitUp: 1.85,       // hops off and sits next to the loser, waving
  popUp: 2.0,        // the loser springs back up, dizzy
  end: 3.1,          // results screen
  skipAfter: 0.6,    // ignore clicks/keys this early (players are still punching)
  hop: 42,           // how far he hops off the loser (pixels, toward the middle of the ring)
};

const FEET_Y = 123;
const HD_SIZE = 1.4;         // HD sumo frames are boxer-sized (64x72): he is this much bigger than a boxer         // floor line where the boxers' feet are (BOXER_Y 54 + 69)
const BOTTOM = [64, 68, 65];   // lowest drawn row in each sumo frame
const MID = [48, 48, 48];      // belly middle column in each frame
const ART_FACES = 1;           // the sitting/standing-up sumo art looks to the right (+1)

export function makeSumoFinish(frames, dust) {
  // the first pixel-art frames: belly middle and lowest row as the anchor (HD frames bring their own)
  frames.forEach((f, i) => { if (f.ax === undefined || !f.hd) { f.ax = MID[i]; f.ay = BOTTOM[i]; } });
  let s = null;   // { t, cx, inward, shake, landed, sat, popped }

  return {
    get active() { return !!s && !s.done; },
    get time() { return s ? s.t : 0; },

    // cx: middle of the loser's body; inward: +1 if the middle of the ring is to the right of them
    start(cx, inward) {
      s = { t: 0, cx, inward, shake: 0, landed: false, sat: false, popped: false, done: false };
      sfx.whistle();
    },

    stop() { s = null; },

    // Returns true when the show is over (or skipped).
    update(dt) {
      if (!s || s.done) return !!s;
      s.t += dt;
      s.shake = Math.max(0, s.shake - dt);
      if (!s.landed && s.t >= SUMO.land) {
        s.landed = true; s.shake = 0.4;
        if (dust[0].hd) playFrames(dust, s.cx, FEET_Y + 2, 9, 2.2); else playFrames(dust, s.cx, FEET_Y - 18, 7);
        starBurst(s.cx, FEET_Y - 14, 16);
        popWord('FLOMP!', s.cx, FEET_Y - 52, COLORS.sparkle, 16);
        sfx.thump();
      }
      if (!s.sat && s.t >= SUMO.sitUp) { s.sat = true; sfx.hop(); }
      if (!s.popped && s.t >= SUMO.popUp) { s.popped = true; sfx.boing(); }
      if (s.t >= SUMO.end) s.done = true;
      return s.done;
    },

    // Squash for the loser's picture: { sx, sy } stretch around their feet, or null for normal.
    squash() {
      if (!s || s.t < SUMO.land) return null;
      if (s.t < SUMO.popUp) {
        const k = Math.min(1, (s.t - SUMO.land) / 0.06);   // flattened in a blink
        return { sx: 1 + 0.4 * k, sy: 1 - 0.8 * k };
      }
      const a = s.t - SUMO.popUp;                           // boing back up with a wobble
      const spring = Math.exp(-a * 7) * Math.cos(a * 22);
      return { sx: 1 - 0.25 * spring, sy: 1 + 0.45 * spring };
    },

    // whole game pixels to shift the picture by (screen shake)
    shake() {
      if (!s || s.shake <= 0) return { x: 0, y: 0 };
      const p = s.shake / 0.4 * 4;
      return { x: Math.round((Math.random() * 2 - 1) * p), y: Math.round((Math.random() * 2 - 1) * p) };
    },

    // Shadow under where he will land; call before the boxers are drawn.
    drawShadow(g) {
      if (!s || s.t >= SUMO.land) return;
      const k = Math.min(1, s.t / SUMO.land);
      drawShadow(g, s.cx, FEET_Y - 2, Math.round(6 + 64 * k * k));
    },

    // The sumo himself; call after the boxers so he lands on top.
    draw(g, time) {
      if (!s || s.t < SUMO.fallStart) return;
      const t = s.t;
      let f, x, bottom, sx = 1, sy = 1, face = 1;
      if (t < SUMO.land) {                                  // falling: speeds up as he drops
        const k = (t - SUMO.fallStart) / (SUMO.land - SUMO.fallStart);
        f = 0; x = s.cx; bottom = -10 + (FEET_Y + 2 - -10) * k * k;
        sy = 1 + 0.12 * k; sx = 1 - 0.06 * k;              // stretched by the speed
      } else if (t < SUMO.sitUp) {                          // belly-flop, jiggling
        f = 1; x = s.cx; bottom = FEET_Y + 2;
        const a = t - SUMO.land;
        const j = Math.exp(-a * 6) * Math.cos(a * 30);
        sy = 1 - 0.25 * j; sx = 1 + 0.12 * j;
      } else {                                              // hop off (HD: standing up), then sit and wave
        const a = Math.min(1, (t - SUMO.sitUp) / 0.3);
        f = frames[3] && a < 1 ? 2 : frames.length - 1;
        x = s.cx + s.inward * SUMO.hop * a;
        bottom = FEET_Y + 1 - Math.sin(a * Math.PI) * 16;
        if (a >= 1) bottom -= Math.floor(time * 6) % 2;     // happy wave bob
        face = -s.inward * ART_FACES;                       // he sits beside the loser: turn to wave at them
      }
      const img = frames[f];
      g.save();
      g.translate(Math.round(x), Math.round(bottom));
      g.scale(sx * face, sy);                               // mirrored around his floor anchor
      const k = img.hd ? HD_SIZE : 1;   // the HD sumo is drawn on a boxer-sized frame: show him bigger
      blit(g, img, -img.ax * k, -img.ay * k, lw(img) * k, lh(img) * k);
      g.restore();
    },
  };
}
