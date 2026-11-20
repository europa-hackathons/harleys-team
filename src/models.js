// Loads a Tripo game mesh (assets/models/<name>.glb) and shades it like the rest of the game:
// flat-shaded Lambert triangles in Style Lock palette colours, no textures.
//
// Models made by tools/tripo_model.py come in colour sections: one part per palette colour,
// each keeping its colour. Swap any section's colour with `recolor`:
//
//   import { loadModel } from './models.js';
//   const hero = await loadModel('hero', { height: 2, recolor: { '#1FA39A': '#F2635F' } });
//   scene.add(hero);
//   hero.userData.sections['#F2635F']  // -> the meshes in that section, e.g. to animate the cape
//
// One-colour models (made with --one-color) take `color` instead.
// Always keep the hand-built shape as a fallback: if loading fails, loadModel rejects
// and the caller keeps using the primitive version, so the game never breaks.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const cache = new Map();

/**
 * @param {string} name       file name in assets/models, without .glb
 * @param {object} [opts]
 * @param {string} [opts.color]              colour for a one-colour model (default: keep section colours)
 * @param {Object<string,string>} [opts.recolor]  section hex -> new colour, e.g. { '#1FA39A': '#00FF88' }
 * @param {number} [opts.height]             scale so the model is this tall (world units)
 * @param {number} [opts.rotationY]          turn to face the game's forward direction (radians)
 * @returns {Promise<THREE.Group>} a group whose origin sits at the model's feet, centred.
 *   group.userData.sections maps each (final) section colour to its meshes.
 */
export async function loadModel(name, { color, recolor = {}, height, rotationY = 0 } = {}) {
  if (!cache.has(name)) cache.set(name, loader.loadAsync(new URL(`../assets/models/${name}.glb`, import.meta.url).href));
  const gltf = await cache.get(name);
  const model = gltf.scene.clone(true);

  const swaps = Object.fromEntries(Object.entries(recolor).map(([k, v]) => [k.toUpperCase(), v]));
  const sections = {};
  model.traverse((obj) => {
    if (!obj.isMesh) return;
    const original = '#' + obj.material.color.getHexString().toUpperCase();
    const final = color ?? swaps[original] ?? original;
    obj.material = new THREE.MeshLambertMaterial({ color: final, flatShading: true });
    (sections[final.toUpperCase()] ??= []).push(obj);
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
  group.userData.sections = sections;
  return group;
}
