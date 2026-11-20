// Loads a Tripo game mesh (assets/models/<name>.glb) and shades it like the rest of the game:
// flat-shaded Lambert triangles in Style Lock palette colours, no textures.
//
//   import { loadModel } from './models.js';
//   const chimney = await loadModel('chimney', { color: '#C9B8B0', height: 3 });
//   scene.add(chimney);
//
// Always keep the hand-built shape as a fallback: if loading fails, loadModel rejects
// and the caller keeps using the primitive version, so the game never breaks.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const cache = new Map();

/**
 * @param {string} name       file name in assets/models, without .glb
 * @param {object} [opts]
 * @param {string|string[]} [opts.color]  one palette colour, or one per mesh in file order
 * @param {number} [opts.height]          scale so the model is this tall (world units)
 * @param {number} [opts.rotationY]       turn to face the game's forward direction (radians)
 * @returns {Promise<THREE.Group>} a group whose origin sits at the model's feet, centred
 */
export async function loadModel(name, { color = '#ffffff', height, rotationY = 0 } = {}) {
  if (!cache.has(name)) cache.set(name, loader.loadAsync(new URL(`../assets/models/${name}.glb`, import.meta.url).href));
  const gltf = await cache.get(name);
  const model = gltf.scene.clone(true);

  const colors = Array.isArray(color) ? color : [color];
  let i = 0;
  model.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.material = new THREE.MeshLambertMaterial({ color: colors[Math.min(i, colors.length - 1)], flatShading: true });
    i++;
  });

  model.rotation.y = rotationY;
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  if (height && size.y > 0) model.scale.multiplyScalar(height / size.y);

  box.setFromObject(model);
  const centre = box.getCenter(new THREE.Vector3());
  model.position.sub(new THREE.Vector3(centre.x, box.min.y, centre.z));

  const group = new THREE.Group();
  group.add(model);
  return group;
}
