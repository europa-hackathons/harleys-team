// A camera that stays behind and above a target and smoothly turns with it (third-person view).
//   const cam = followCamera(camera, hero, { distance: 6, height: 3 });   ...each frame: cam.update(dt);
// "Behind" is opposite the way the target faces. three.js objects face +Z by default; if a model faces
// -Z instead, pass { faces: -1 }. Change settings later with cam.settings.distance = 9, etc.
import * as THREE from 'three';

export function followCamera(camera, target, options = {}) {
  const settings = { distance: 6, height: 3, lookHeight: 1, smooth: 6, faces: 1, ...options };
  const want = new THREE.Vector3();
  const look = new THREE.Vector3();
  const place = () => {
    const yaw = target.rotation.y, back = -settings.distance * settings.faces;
    want.set(Math.sin(yaw) * back, settings.height, Math.cos(yaw) * back).add(target.position);
    look.copy(target.position);
    look.y += settings.lookHeight;
  };
  place();
  camera.position.copy(want);
  camera.lookAt(look);
  return {
    settings,
    update(dt) {
      place();
      camera.position.lerp(want, 1 - Math.exp(-settings.smooth * dt));
      camera.lookAt(look);
    },
  };
}
