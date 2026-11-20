// The game loop: calls update(dt, time) every frame. dt is in seconds and capped, so a slow frame
// (or coming back to the tab) never makes things jump through walls. Pauses while the tab is hidden.
import { keys } from './input.js';

export function startLoop(update, { maxDt = 1 / 20 } = {}) {
  let last = performance.now();
  let running = true;
  function frame(now) {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, maxDt);
    last = now;
    if (!document.hidden) update(dt, now / 1000);
    keys.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return { stop: () => { running = false; } };
}
