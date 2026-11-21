// Extra boxer poses made in code from the Drawing Friend's frames, used only when a drawn pose is missing.
// Frames are full-size (sprite.js); the numbers here are game pixels on the old 64x72 boxer frames.
import { COLORS } from './scene.js';
import { lw, blankLike, mirrorFrame } from './sprite.js';

export const DUCK_DROP = 14;     // how many pixels a ducking boxer's head and body go down
const WAIST = 46;                // rows above this are the head and body; below are the legs

// a blank copy of frame, and its context set up to draw in game pixels
function sameSize(frame) {
  const c = blankLike(frame);
  const g = c.getContext('2d');
  const k = frame.width / lw(frame);
  g.imageSmoothingEnabled = false;
  g.scale(k, k);
  return [c, g, k];
}

// Ducking: the top half of the boxer slides down, the legs squash into a deep crouch.
export function duckPose(frame) {
  const [c, g, k] = sameSize(frame);
  const w = lw(frame), h = frame.height / k;
  const legs = h - WAIST;
  const squashed = legs - DUCK_DROP;
  g.drawImage(frame, 0, WAIST * k, frame.width, legs * k, -3, WAIST + DUCK_DROP, w + 6, squashed);
  g.drawImage(frame, 0, 0, frame.width, (WAIST + 2) * k, 0, DUCK_DROP, w, WAIST + 2);
  return c;
}

// The orange boxer's punch: its idle frame with the front glove taken off (the glove is the one flying).
export function gloveOffPose(frame) {
  const [c, g] = sameSize(frame);
  g.drawImage(frame, 0, 0, lw(frame), frame.height / (frame.width / lw(frame)));
  g.clearRect(12, 24, 12, 12);
  g.fillStyle = COLORS.outline; g.fillRect(17, 30, 7, 6);
  g.fillStyle = '#f0662c'; g.fillRect(18, 31, 5, 4);
  g.fillStyle = '#f4e4c4'; g.fillRect(22, 31, 1, 4);
  return c;
}

// Swap exact colours (`'r,g,b': [r, g, b]`) in a copy of frame.
export function swapColours(frame, map) {
  const c = blankLike(frame);
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(frame, 0, 0);
  const img = g.getImageData(0, 0, c.width, c.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const to = map[`${d[i]},${d[i + 1]},${d[i + 2]}`];
    if (to) [d[i], d[i + 1], d[i + 2]] = to;
  }
  g.putImageData(img, 0, 0);
  return c;
}

// The rocket-glove art is teal; the orange boxer's copy swaps teal pixels for orange ones (flame stays).
const TEAL_TO_ORANGE = { '31,184,176': [240, 102, 44], '30,90,122': [168, 58, 30], '141,231,203': [255, 176, 122] };
export const orangeGlove = (frame) => swapColours(frame, TEAL_TO_ORANGE);

// A frame flipped left-to-right (its anchor flips too).
export const mirror = mirrorFrame;
