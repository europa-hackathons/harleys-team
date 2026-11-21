// makeRenderer: a three.js WebGLRenderer that survives a preview tab opening hidden.
//
//   const renderer = await makeRenderer({ canvasId: 'stage', antialias: true });
//   const renderer = await makeRenderer();   // no canvasId: three.js makes the canvas, you append renderer.domElement
//
// A tab that loads while hidden (the T3 preview opens new tabs that way) can't create a WebGL
// context yet, and `new THREE.WebGLRenderer()` throws. This retries when the tab becomes visible,
// and every 500 ms for about 20 s. A canvas that failed once can stay broken, so with a canvasId
// it swaps in a fresh <canvas> with the same id and classes before each retry.
// Always make the game's renderer through this; tools/check.py flags a bare WebGLRenderer in src/.
import * as THREE from 'three';

export function makeRenderer({ canvasId, ...options } = {}) {
  const tryMake = () => {
    try {
      const canvas = canvasId ? document.getElementById(canvasId) : undefined;
      return new THREE.WebGLRenderer(canvas ? { ...options, canvas } : options);
    } catch (err) {
      const old = canvasId && document.getElementById(canvasId);
      if (old) {
        const fresh = document.createElement('canvas');
        fresh.id = old.id;
        fresh.className = old.className;
        old.replaceWith(fresh);
      }
      return null;
    }
  };

  const first = tryMake();
  if (first) return Promise.resolve(first);
  console.warn('3D is not ready yet (hidden tab?); retrying when the tab is visible.');
  return new Promise((resolve) => {
    let tries = 0;
    const attempt = () => {
      const r = tryMake();
      if (!r) return;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      resolve(r);
    };
    const onVisible = () => { if (document.visibilityState === 'visible') attempt(); };
    const timer = setInterval(() => { if (++tries >= 40) clearInterval(timer); else attempt(); }, 500);
    document.addEventListener('visibilitychange', onVisible);
  });
}
