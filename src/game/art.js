// Loads the pixel-art sprite sheets from assets/art/ (made by the Drawing Friend; read-only for us).
// sprites.json says each sheet's frame size, frame count and how much it was blown up (scale).
// Frames come back shrunk to their true pixel size, so 1 art pixel = 1 game pixel.
const BASE = new URL('../../assets/art/', import.meta.url);

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

// Returns { name: [frameCanvas, ...] } for every sheet in sprites.json. A sheet that won't load is left
// out (the game then uses its code-drawn stand-in), so new art can be registered before it lands.
export async function loadArt() {
  const info = await (await fetch(new URL('sprites.json', BASE))).json();
  const out = {};
  await Promise.all(Object.entries(info).map(async ([file, s]) => {
    let img;
    try { img = await loadImage(new URL(file, BASE)); } catch { console.warn(`art missing: ${file}`); return; }
    const w = Math.round(s.frameWidth / s.scale), h = Math.round(s.frameHeight / s.scale);
    out[file.replace('.png', '')] = Array.from({ length: s.frameCount }, (_, i) => {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      // sample the middle of each big art pixel
      g.drawImage(img, i * s.frameWidth, 0, s.frameWidth, s.frameHeight, 0, 0, w, h);
      return c;
    });
  }));
  return out;
}
