// Extra boxer poses made in code from the Drawing Friend's frames (assets/art has no duck or orange punch frame).
import { COLORS } from './scene.js';

export const DUCK_DROP = 14;     // how many pixels a ducking boxer's head and body go down
const WAIST = 46;                // rows above this are the head and body; below are the legs

// Ducking: the top half of the boxer slides down, the legs squash into a deep crouch.
export function duckPose(frame) {
  const c = document.createElement('canvas');
  c.width = frame.width; c.height = frame.height;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const legs = frame.height - WAIST;
  const squashed = legs - DUCK_DROP;
  // legs: squashed and a bit wider (bent knees), then the body on top
  g.drawImage(frame, 0, WAIST, frame.width, legs, -3, WAIST + DUCK_DROP, frame.width + 6, squashed);
  g.drawImage(frame, 0, 0, frame.width, WAIST + 2, 0, DUCK_DROP, frame.width, WAIST + 2);
  return c;
}

// The orange boxer's punch: its idle frame with the front glove taken off (the glove is the one flying),
// leaving a short arm with a cuff, like the teal boxer's punch frame.
export function gloveOffPose(frame) {
  const c = document.createElement('canvas');
  c.width = frame.width; c.height = frame.height;
  const g = c.getContext('2d');
  g.drawImage(frame, 0, 0);
  g.clearRect(12, 24, 12, 12);   // the front glove (x 12..23, y 24..35 on the 64x72 frame)
  // a stubby cuff on the end of the forearm, pointing forward (left)
  g.fillStyle = COLORS.outline; g.fillRect(17, 30, 7, 6);
  g.fillStyle = '#f0662c'; g.fillRect(18, 31, 5, 4);
  g.fillStyle = '#f4e4c4'; g.fillRect(22, 31, 1, 4);
  return c;
}

// The rocket-glove art is teal; the orange boxer's copy swaps teal pixels for orange ones (flame stays).
// teal colour on the glove art -> orange colour (from the orange boxer's own gloves)
const TEAL_TO_ORANGE = { '31,184,176': [240, 102, 44], '30,90,122': [168, 58, 30], '141,231,203': [255, 176, 122] };
export function orangeGlove(frame) {
  const c = document.createElement('canvas');
  c.width = frame.width; c.height = frame.height;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(frame, 0, 0);
  const img = g.getImageData(0, 0, c.width, c.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const to = TEAL_TO_ORANGE[`${d[i]},${d[i + 1]},${d[i + 2]}`];
    if (to) [d[i], d[i + 1], d[i + 2]] = to;
  }
  g.putImageData(img, 0, 0);
  return c;
}
