// Happy effects: hearts, stars and sparkles that burst out, plus floating words on screen.
import * as THREE from 'three';

function canvasTexture(draw) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  draw(c.getContext('2d'));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function starPath(ctx, cx, cy, outer, inner, points) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 ? inner : outer, a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
}

const TEXTURES = {
  heart: canvasTexture((ctx) => {
    ctx.fillStyle = '#FF6FA5';
    ctx.beginPath();
    ctx.moveTo(32, 56);
    ctx.bezierCurveTo(4, 36, 4, 10, 20, 10);
    ctx.bezierCurveTo(28, 10, 32, 18, 32, 22);
    ctx.bezierCurveTo(32, 18, 36, 10, 44, 10);
    ctx.bezierCurveTo(60, 10, 60, 36, 32, 56);
    ctx.fill();
  }),
  star: canvasTexture((ctx) => {
    ctx.fillStyle = '#FFD45C';
    starPath(ctx, 32, 34, 30, 13, 5);
    ctx.fill();
  }),
  sparkle: canvasTexture((ctx) => {
    ctx.fillStyle = '#FFFFFF';
    starPath(ctx, 32, 32, 30, 5, 4);
    ctx.fill();
  }),
  cyanSparkle: canvasTexture((ctx) => {
    ctx.fillStyle = '#4FE3E0';
    starPath(ctx, 32, 32, 30, 6, 4);
    ctx.fill();
  }),
};

export function createEffects(scene, camera, layer) {
  const particles = [];
  const words = [];

  function burst(position, kinds, count, power = 6) {
    for (let i = 0; i < count; i++) {
      const kind = kinds[i % kinds.length];
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEXTURES[kind], transparent: true, depthWrite: false }));
      sprite.position.copy(position);
      const size = kind === 'sparkle' || kind === 'cyanSparkle' ? 0.8 : 1.2;
      sprite.scale.setScalar(size);
      const a = Math.random() * Math.PI * 2, up = 0.6 + Math.random();
      const v = new THREE.Vector3(Math.cos(a), up, Math.sin(a)).normalize().multiplyScalar(power * (0.5 + Math.random() * 0.7));
      scene.add(sprite);
      particles.push({ sprite, v, life: 0, maxLife: 1.2 + Math.random() * 0.8, size });
    }
  }

  // Floating words, e.g. "THANK YOU!" above a rescued person.
  function say(text, position, className = 'bubble') {
    const el = document.createElement('div');
    el.className = className;
    el.textContent = text;
    layer.appendChild(el);
    words.push({ el, position: position.clone(), life: 0, maxLife: 2 });
  }

  const tmp = new THREE.Vector3();
  function update(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt;
      p.v.y -= 4 * dt;
      p.v.multiplyScalar(1 - dt * 0.8);
      p.sprite.position.addScaledVector(p.v, dt);
      const k = p.life / p.maxLife;
      p.sprite.material.opacity = 1 - k * k;
      p.sprite.scale.setScalar(p.size * (1 + Math.sin(k * Math.PI) * 0.4));
      p.sprite.material.rotation += dt * 2;
      if (p.life >= p.maxLife) {
        scene.remove(p.sprite);
        p.sprite.material.dispose();
        particles.splice(i, 1);
      }
    }
    for (let i = words.length - 1; i >= 0; i--) {
      const w = words[i];
      w.life += dt;
      tmp.copy(w.position).project(camera);
      const behind = tmp.z > 1;
      const x = (tmp.x * 0.5 + 0.5) * innerWidth, y = (-tmp.y * 0.5 + 0.5) * innerHeight - w.life * 40;
      w.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      w.el.style.opacity = behind ? 0 : Math.min(1, (w.maxLife - w.life) * 2);
      if (w.life >= w.maxLife) { w.el.remove(); words.splice(i, 1); }
    }
  }

  function clear() {
    particles.forEach((p) => scene.remove(p.sprite));
    particles.length = 0;
    words.forEach((w) => w.el.remove());
    words.length = 0;
  }

  return { burst, say, update, clear };
}
