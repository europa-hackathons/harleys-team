// A round timer. Call .update(dt) each frame; onTick gets the whole seconds left, only when that number changes.
//   const timer = roundTimer(60, { onTick: (s) => hud.set('time', `⏱ ${s}`, 'top-right'), onEnd: gameOver });
export function roundTimer(seconds, { onTick = () => {}, onEnd = () => {} } = {}) {
  let left = seconds, shown = -1, done = false;
  return {
    get left() { return left; },
    get done() { return done; },
    update(dt) {
      if (done) return;
      left = Math.max(0, left - dt);
      const whole = Math.ceil(left);
      if (whole !== shown) { shown = whole; onTick(whole); }
      if (left === 0) { done = true; onEnd(); }
    },
    reset(newSeconds = seconds) { left = newSeconds; shown = -1; done = false; },
  };
}
