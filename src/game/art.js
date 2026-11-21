// Loads the art made by the Drawing Friend (read-only for us).
// 1. The first pixel-art sheets in assets/art/ (sprites.json: frame size, frame count, how much each art pixel
//    was blown up = scale). Frames are kept at full size and carry their game size (see sprite.js).
// 2. The HD art in assets/art/hd/ (see hd.js), which replaces the first sheets wherever it exists.
import { cutFrame } from './sprite.js';
import { loadHD } from './hd.js';

const BASE = new URL('../../assets/art/', import.meta.url);

export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

// Returns { name: [frame, ...] } for every sheet in sprites.json, plus art.hd (null when there is no HD art yet).
// A sheet that won't load is left out (the game then uses its code-drawn stand-in).
export async function loadArt() {
  const info = await (await fetch(new URL('sprites.json', BASE))).json();
  const out = {};
  await Promise.all(Object.entries(info).map(async ([file, s]) => {
    let img;
    try { img = await loadImage(new URL(file, BASE)); } catch { console.warn(`art missing: ${file}`); return; }
    out[file.replace('.png', '')] = Array.from({ length: s.frameCount }, (_, i) =>
      cutFrame(img, i * s.frameWidth, 0, s.frameWidth, s.frameHeight, s.scale));
  }));
  out.hd = await loadHD();
  return out;
}
