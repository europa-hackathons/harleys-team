// Starter: a twinkling background, a title screen, and a PLAY button that leads to "time to design".
// The Team decides everything else (2D or 3D, score, timers...). Replace freely.

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const titleScreen = document.getElementById('title-screen');
const designScreen = document.getElementById('design-screen');

const stars = Array.from({ length: 140 }, () => ({
  x: Math.random(), y: Math.random(), size: Math.random() * 2.5 + 0.5,
  speed: Math.random() * 0.02 + 0.005, phase: Math.random() * Math.PI * 2,
}));

function resize() {
  canvas.width = innerWidth * devicePixelRatio;
  canvas.height = innerHeight * devicePixelRatio;
}
addEventListener('resize', resize);
resize();

function draw(time) {
  const w = canvas.width, h = canvas.height;
  ctx.fillStyle = '#120a2e';
  ctx.fillRect(0, 0, w, h);
  for (const s of stars) {
    s.y = (s.y + s.speed * 0.016) % 1;
    const twinkle = 0.5 + 0.5 * Math.sin(time / 400 + s.phase);
    ctx.globalAlpha = 0.3 + 0.7 * twinkle;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(s.x * w, s.y * h, s.size * devicePixelRatio, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

// Every game keeps a window.game with a `state`, so tools/shot.py and the Helper's tab check can see it running.
window.game = { state: 'title' };

document.getElementById('play').addEventListener('click', () => {
  titleScreen.classList.add('hidden');
  designScreen.classList.remove('hidden');
  window.game.state = 'design';
});
document.getElementById('back').addEventListener('click', () => {
  designScreen.classList.add('hidden');
  titleScreen.classList.remove('hidden');
  window.game.state = 'title';
});
