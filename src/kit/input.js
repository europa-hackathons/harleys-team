// Keyboard state for games. startLoop() calls keys.endFrame() for you at the end of every frame.
const held = new Set();
const pressedNow = new Set();

addEventListener('keydown', (e) => {
  if (!held.has(e.code)) pressedNow.add(e.code);
  held.add(e.code);
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();   // stop the page scrolling
});
addEventListener('keyup', (e) => held.delete(e.code));
addEventListener('blur', () => held.clear());

export const keys = {
  /** true while the key is down, e.g. held('ArrowLeft'), held('KeyW'), held('Space') */
  held: (code) => held.has(code),
  /** true only in the frame the key went down: good for jumps and shots */
  pressed: (code) => pressedNow.has(code),
  /** arrows or WASD as numbers: x is -1 left / +1 right, y is -1 up / +1 down (screen directions) */
  axis() {
    const x = (held.has('ArrowRight') || held.has('KeyD') ? 1 : 0) - (held.has('ArrowLeft') || held.has('KeyA') ? 1 : 0);
    const y = (held.has('ArrowDown') || held.has('KeyS') ? 1 : 0) - (held.has('ArrowUp') || held.has('KeyW') ? 1 : 0);
    return { x, y };
  },
  endFrame: () => pressedNow.clear(),
};
