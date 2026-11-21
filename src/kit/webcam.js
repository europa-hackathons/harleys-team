// Webcam motion controls: no libraries, just frame-differencing on a tiny copy of the camera picture.
//   const cam = await startWebcam();          // asks for the camera (needs https or localhost)
//   each frame: cam.update();
//   cam.motion                                 // 0..1, how much of the whole picture moved
//   cam.zone(0, 0, 0.5, 1)                     // 0..1 movement inside a box (x0, y0, x1, y1 as 0..1 of the screen)
//   cam.grid(3, 3)                             // movement per cell, row by row
//   cam.centroid                               // {x, y} 0..1 middle of the movement, or null when still
//   cam.draw(ctx, 0, 0, w, h)                  // draws the (mirrored) camera picture on a 2D canvas
// Coordinates are as seen on screen: with mirror on (default), the player's raised right hand is on the right.
// On failure it throws an Error with .reason: 'insecure' | 'unsupported' | 'denied' | 'no-camera' | 'busy' | 'other'.
export async function startWebcam({ width = 160, height = 120, mirror = true, threshold = 28, minPixels = 20 } = {}) {
  if (!window.isSecureContext) throw webcamError('insecure', 'The camera only works on https:// or localhost pages.');
  if (!navigator.mediaDevices?.getUserMedia) throw webcamError('unsupported', 'This browser has no camera support.');

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false });
  } catch (e) {
    const reason = { NotAllowedError: 'denied', SecurityError: 'denied', NotFoundError: 'no-camera', OverconstrainedError: 'no-camera', NotReadableError: 'busy', AbortError: 'busy' }[e.name] || 'other';
    throw webcamError(reason, `${e.name}: ${e.message}`);
  }

  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  await video.play();

  const small = document.createElement('canvas');
  small.width = width;
  small.height = height;
  const sctx = small.getContext('2d', { willReadFrequently: true });
  const n = width * height;
  let prev = null;
  const moved = new Uint8Array(n); // 1 where the pixel changed since the last update
  let movedCount = 0;

  const cam = {
    video, stream, width, height, mirror,
    motion: 0,
    centroid: null,
    frames: 0,
    update() {
      if (video.readyState < 2) return;
      sctx.save();
      if (mirror) { sctx.translate(width, 0); sctx.scale(-1, 1); }
      sctx.drawImage(video, 0, 0, width, height);
      sctx.restore();
      const px = sctx.getImageData(0, 0, width, height).data;
      const gray = new Uint8Array(n);
      for (let i = 0, j = 0; i < n; i++, j += 4) gray[i] = (px[j] * 77 + px[j + 1] * 150 + px[j + 2] * 29) >> 8;
      movedCount = 0;
      let sx = 0, sy = 0;
      if (prev) {
        for (let i = 0; i < n; i++) {
          const m = Math.abs(gray[i] - prev[i]) > threshold ? 1 : 0;
          moved[i] = m;
          if (m) { movedCount++; sx += i % width; sy += (i / width) | 0; }
        }
      }
      prev = gray;
      cam.frames++;
      cam.motion = movedCount / n;
      cam.centroid = movedCount >= minPixels ? { x: sx / movedCount / width, y: sy / movedCount / height } : null;
    },
    zone(x0, y0, x1, y1) {
      const cx0 = Math.max(0, Math.floor(x0 * width)), cx1 = Math.min(width, Math.ceil(x1 * width));
      const cy0 = Math.max(0, Math.floor(y0 * height)), cy1 = Math.min(height, Math.ceil(y1 * height));
      let count = 0;
      for (let y = cy0; y < cy1; y++) for (let x = cx0; x < cx1; x++) count += moved[y * width + x];
      const area = (cx1 - cx0) * (cy1 - cy0);
      return area > 0 ? count / area : 0;
    },
    grid(cols, rows) {
      const out = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push(cam.zone(c / cols, r / rows, (c + 1) / cols, (r + 1) / rows));
      return out;
    },
    draw(ctx, x = 0, y = 0, w = ctx.canvas.width, h = ctx.canvas.height) {
      ctx.save();
      if (mirror) { ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.drawImage(video, 0, 0, w, h); }
      else ctx.drawImage(video, x, y, w, h);
      ctx.restore();
    },
    stop() { stream.getTracks().forEach((t) => t.stop()); },
  };
  return cam;
}

function webcamError(reason, message) {
  const e = new Error(message);
  e.reason = reason;
  return e;
}
