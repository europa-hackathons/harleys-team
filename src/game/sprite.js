// Sprite frames that keep their full drawn detail.
// The game still thinks in its small 256x144 "game pixels" (all positions, hit checks and speeds), but the
// screen is drawn many real pixels per game pixel (see RENDER in main.js). So a frame is kept at its NATIVE
// size (every pixel the Drawing Friend drew) and carries its size in game pixels:
//   frame.lw, frame.lh  = width/height in game pixels (how big it is in the game)
//   frame.ax, frame.ay  = its anchor in game pixels from its top-left: for a boxer, the point on the floor
//                         between the feet; for a glove, the front tip at mid height; for effects, the middle.
// Always draw frames with these helpers, never with drawImage(frame, x, y) (that would draw native pixels
// as game pixels, several times too big).

export const lw = (f) => f.lw ?? f.width;
export const lh = (f) => f.lh ?? f.height;

// Cut one frame out of a sheet. px = native pixels per game pixel. anchor = [x, y] in native pixels from the
// frame's top-left (default: bottom middle).
export function cutFrame(img, x, y, w, h, px = 1, anchor = null) {
  const c = document.createElement('canvas');
  c.width = Math.round(w); c.height = Math.round(h);
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(img, x, y, w, h, 0, 0, c.width, c.height);
  return withMeta(c, { lw: w / px, lh: h / px, ax: (anchor ? anchor[0] : w / 2) / px, ay: (anchor ? anchor[1] : h) / px });
}

export function withMeta(c, m) { return Object.assign(c, m); }
// copies size + anchor (+ any extra fields such as tip) from one frame onto a new canvas
export function sameMeta(c, from) {
  return Object.assign(c, { lw: lw(from), lh: lh(from), ax: from.ax ?? lw(from) / 2, ay: from.ay ?? lh(from), tip: from.tip, mid: from.mid, src: from.src });
}

// A blank canvas the same native size as frame (same game size and anchor too).
export function blankLike(frame) {
  const c = document.createElement('canvas');
  c.width = frame.width; c.height = frame.height;
  return sameMeta(c, frame);
}

// Flipped left-to-right; the anchor flips with it, so a boxer still stands on the same spot.
export function mirrorFrame(frame) {
  const c = blankLike(frame);
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.translate(c.width, 0); g.scale(-1, 1);
  g.drawImage(frame, 0, 0);
  c.ax = lw(frame) - (frame.ax ?? lw(frame) / 2);
  if (frame.tip) c.tip = [lw(frame) - frame.tip[0], frame.tip[1]];
  c.flipped = !frame.flipped;
  return c;
}

// Native pixels per real screen pixel for this draw: above 1 the frame is being shrunk, so smooth it;
// otherwise keep crisp nearest-neighbour pixels.
function setSmoothing(g, frame, w) {
  const t = g.getTransform();
  const screenW = Math.abs(w * Math.hypot(t.a, t.b));
  const shrink = frame.width / Math.max(1e-6, screenW);
  g.imageSmoothingEnabled = shrink > 1.05;
  if (g.imageSmoothingEnabled) g.imageSmoothingQuality = 'high';
}

// Snap a game-pixel coordinate to a whole real pixel of the current drawing surface, so art pixels stay sharp.
function snap(g, v, axis) {
  const t = g.getTransform();
  const s = axis ? t.d : t.a;
  if (!s) return v;
  return Math.round(v * s) / s;
}

// Draw a frame with its top-left at x, y (game pixels), at its game size (or w x h game pixels).
export function blit(g, frame, x, y, w = lw(frame), h = lh(frame)) {
  setSmoothing(g, frame, w);
  g.drawImage(frame, snap(g, x, 0), snap(g, y, 1), w, h);
  g.imageSmoothingEnabled = false;
}

// Draw a frame so its anchor lands on x, y. scale = extra size (1 = normal).
export function blitAt(g, frame, x, y, scale = 1) {
  const ax = frame.ax ?? lw(frame) / 2, ay = frame.ay ?? lh(frame);
  blit(g, frame, x - ax * scale, y - ay * scale, lw(frame) * scale, lh(frame) * scale);
}

// Draw a frame centred on x, y.
export function blitCentre(g, frame, x, y, scale = 1) {
  const w = lw(frame) * scale, h = lh(frame) * scale;
  blit(g, frame, x - w / 2, y - h / 2, w, h);
}

// Draw a frame so its point (px, py) in game pixels from its top-left (default: its anchor) lands on x, y.
// facing -1 mirrors it around that point (no mirrored copy needed). scale = extra size.
export function drawFacing(g, frame, x, y, facing = 1, scale = 1, px = frame.ax ?? lw(frame) / 2, py = frame.ay ?? lh(frame)) {
  const w = lw(frame) * scale, h = lh(frame) * scale;
  if (facing > 0) { blit(g, frame, x - px * scale, y - py * scale, w, h); return; }
  g.save();
  g.translate(snap(g, x, 0), snap(g, y, 1));
  g.scale(-1, 1);
  blit(g, frame, -px * scale, -py * scale, w, h);
  g.restore();
}

const scratch = document.createElement('canvas');
const sg = scratch.getContext('2d', { willReadFrequently: true });
// The drawn part of a frame (non-see-through pixels), in game pixels from its top-left: { x, y, w, h }.
// Worked out once per frame and remembered. Used to put name tags and dizzy stars on the real head.
export function contentBox(frame) {
  if (frame.box) return frame.box;
  // read the pixels through one shared scratch canvas (reading a drawing canvas back is slow)
  scratch.width = frame.width; scratch.height = frame.height;
  sg.clearRect(0, 0, frame.width, frame.height);
  sg.drawImage(frame, 0, 0);
  const d = sg.getImageData(0, 0, frame.width, frame.height).data;
  let x0 = frame.width, y0 = frame.height, x1 = -1, y1 = -1;
  for (let y = 0; y < frame.height; y++) {
    for (let x = 0; x < frame.width; x++) {
      if (d[(y * frame.width + x) * 4 + 3] < 40) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  const k = frame.width / lw(frame);
  frame.box = x1 < 0 ? { x: 0, y: 0, w: lw(frame), h: lh(frame) } : { x: x0 / k, y: y0 / k, w: (x1 - x0 + 1) / k, h: (y1 - y0 + 1) / k };
  return frame.box;
}
