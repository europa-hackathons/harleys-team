// Look-check screens for the art (testing only, from the console or tools/shot.py / tools/live.py):
//   game.debug.qa('zeus')            every pose, facing right (top row) and left (bottom row), with guide lines
//   game.debug.qa('zeus', 'onion')   all poses stacked on the same feet: jumps in size or feet show at once
//   game.debug.record(12, 0.06)      grab 12 frames of the real game, one every 0.06 s ...
//   game.debug.contact()             ... then show them side by side (take the screenshot after this)
// Nothing here changes the game.
import { W, H, COLORS, drawNumber } from './scene.js';
import { drawFacing, contentBox, lw, lh } from './sprite.js';

// (idle 0 / idle 1 = the breathing pair; recovery = the glove clicking back on after a punch)
const ORDER = [['idle', 0], ['idle', 1], ['punch', 0], ['recovery', 0], ['special', 0], ['hit', 0], ['duck', 0], ['guard', 0], ['victory', 0]];
const poseList = (poses, name) => poses[name] || poses.idle;

function label(g, text, x, y, color = COLORS.rope, size = 4) {
  g.font = `bold ${size}px "Trebuchet MS", sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'top';
  g.fillStyle = COLORS.outline; g.fillText(text, x + 0.3, y + 0.3);
  g.fillStyle = color; g.fillText(text, x, y);
}
function hline(g, y, color, x0 = 0, x1 = W) {
  g.fillStyle = color; g.fillRect(x0, y - 0.15, x1 - x0, 0.3);
}

// guide = { feet, head, body, arm, launch, hitDepth } in game pixels above the feet / from the boxer's middle
export function drawPoseSheet(g, boxer, guide, mode = 'sheet', time = 0) {
  g.fillStyle = '#1b2440'; g.fillRect(0, 0, W, H);
  if (mode === 'onion') { drawOnion(g, boxer, guide, time); return; }
  const s = 0.5, colW = W / ORDER.length;
  label(g, `${boxer.name}  ${boxer.hd ? 'HD' : 'OLD ART'}  (top: facing right, bottom: facing left)`, W / 2, 1, boxer.hd ? '#8ff0e6' : '#ff7a7a', 5);
  for (const [row, feet] of [[0, 66], [1, 132]]) {
    // guide lines: feet (white), head-punch height (red), arm/launch height (yellow), body-punch height (blue)
    hline(g, feet, '#ffffff');
    hline(g, feet - guide.head * s, '#ff5a5a');
    hline(g, feet - guide.arm * s, '#ffd23f');
    hline(g, feet - guide.body * s, '#5cc4f5');
    ORDER.forEach(([name, i], c) => {
      const list = poseList(boxer.poses[row], name);
      const f = list[Math.min(i, list.length - 1)], cx = colW * c + colW / 2;
      // the 64x72 game box the hit checks use
      g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 0.25;
      g.strokeRect(cx - 32 * s, feet - 69 * s, 64 * s, 72 * s);
      drawFacing(g, f, cx, feet, 1, s);
      // the drawn part of the frame, and the anchor
      const b = contentBox(f);
      g.strokeStyle = 'rgba(143,240,230,0.7)';
      g.strokeRect(cx + (b.x - f.ax) * s, feet + (b.y - f.ay) * s, b.w * s, b.h * s);
      g.fillStyle = '#ff3df2'; g.fillRect(cx - 0.6, feet - 0.6, 1.2, 1.2);
      // where the rocket glove leaves the arm on a punch (from the boxer's middle)
      if (name === 'punch' || name === 'special') {
        const lx = cx + (row ? -1 : 1) * guide.launch * s;
        g.fillStyle = '#ffd23f'; g.fillRect(lx - 0.3, feet - guide.arm * s - 3, 0.6, 6);
      }
      if (row === 0) label(g, name === 'idle' ? `idle${i + 1}` : name, cx, feet + 1);
      const top = Math.round(f.ay - b.y), wide = Math.round(b.w);
      label(g, `${wide}x${top}`, cx, feet + (row ? -72 * s - 5 : 5), '#9ab');
    });
  }
}

function drawOnion(g, boxer, guide, time) {
  label(g, `${boxer.name} onion: all poses on the same feet  (left: facing right, right: facing left)`, W / 2, 1, '#8ff0e6', 5);
  const feet = 128;
  hline(g, feet, '#ffffff');
  hline(g, feet - guide.head, '#ff5a5a');
  hline(g, feet - guide.arm, '#ffd23f');
  hline(g, feet - guide.body, '#5cc4f5');
  for (const [row, cx] of [[0, 64], [1, 192]]) {
    g.globalAlpha = 0.28;
    for (const [name, i] of ORDER) {
      const list = poseList(boxer.poses[row], name);
      drawFacing(g, list[Math.min(i, list.length - 1)], cx, feet);
    }
    g.globalAlpha = 1;
    // the pose that is "live" cycles, so a contact sheet / screenshot shows one solid on top
    const [name, i] = ORDER[Math.floor(time * 1.5) % ORDER.length];
    const list = poseList(boxer.poses[row], name);
    drawFacing(g, list[Math.min(i, list.length - 1)], cx, feet);
    label(g, name, cx, 10, '#ffd23f', 5);
    g.fillStyle = '#ff3df2'; g.fillRect(cx - 0.6, feet - 0.6, 1.2, 1.2);
  }
}

// ---------- recording real frames into a contact sheet ----------
export function makeRecorder() {
  let rec = null;
  return {
    get active() { return !!rec && rec.frames.length < rec.n; },
    get frames() { return rec ? rec.frames.length : 0; },
    // n frames, one every `every` seconds; region = [x, y, w, h] in game pixels (default: everything)
    start(n = 12, every = 0.06, region = [0, 0, W, H]) { rec = { n, every, t: every, frames: [], region }; },
    // call once a frame after the screen is drawn
    grab(canvas, view, dt) {
      if (!rec || rec.frames.length >= rec.n) return;
      rec.t += dt;
      if (rec.t < rec.every) return;
      rec.t = 0;
      const [rx, ry, rw, rh] = rec.region, k = view.w / W;
      const c = document.createElement('canvas');
      c.width = Math.round(rw * k); c.height = Math.round(rh * k);
      c.getContext('2d').drawImage(canvas, view.x + rx * k, view.y + ry * k, rw * k, rh * k, 0, 0, c.width, c.height);
      c.time = rec.frames.length * rec.every;
      rec.frames.push(c);
    },
    // draws the recorded frames in a grid on the screen canvas
    draw(ctx, canvas) {
      ctx.fillStyle = '#1b2440'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (!rec || !rec.frames.length) return;
      const n = rec.frames.length, a = rec.frames[0].width / rec.frames[0].height;
      let best = 1, bestW = 0;
      for (let cols = 1; cols <= n; cols++) {   // the column count that makes the frames biggest
        const w = Math.min(canvas.width / cols, (canvas.height / Math.ceil(n / cols)) * a);
        if (w > bestW) { bestW = w; best = cols; }
      }
      const rows = Math.ceil(n / best), w = Math.min(canvas.width / best, (canvas.height / rows) * a), h = w / a;
      ctx.imageSmoothingEnabled = true;
      rec.frames.forEach((c, i) => {
        const x = (i % best) * w, y = Math.floor(i / best) * h;
        ctx.drawImage(c, x + 1, y + 1, w - 2, h - 2);
        ctx.fillStyle = '#ffd23f'; ctx.font = `bold ${Math.max(10, Math.round(h / 14))}px sans-serif`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText(`${i}`, x + 4, y + 3);
      });
    },
  };
}
export { lw, lh, drawNumber };
