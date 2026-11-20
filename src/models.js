// Loads a Tripo game mesh (assets/models/<name>.glb) and shades it to match the game's matte lighting.
// Made by tools/tripo_model.py in one of two kinds:
//
// 1. Colour-section models (houses, props): one part per palette colour, flat-shaded triangles.
//    Swap any section's colour with `recolor`:
//      const house = await loadModel('house2', { height: 4, recolor: { '#C9B8B0': '#FFD1DC' } });
//      house.userData.sections['#FFD1DC']  // -> the meshes in that section
//    One-colour models (made with --one-color) take `color` instead.
//
// 2. Characters (made with --character): textured (max 1024 px), rigged, with preset animations.
//      const hero = await loadModel('hero', { height: 2 });
//      hero.userData.play('walk');                  // crossfades from the current clip
//      hero.userData.clips                          // -> ['idle', 'walk', ...]
//      // every frame:  hero.userData.mixer.update(deltaSeconds);
//    Clips are "in place": move the character yourself.
//
// Always keep the hand-built shape as a fallback: if loading fails, loadModel rejects
// and the caller keeps using the primitive version, so the game never breaks.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

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
 *   userData.sections: section colour -> meshes. Characters also get userData.mixer, .clips, .play(name).
 */
export async function loadModel(name, { color, recolor = {}, height, rotationY = 0 } = {}) {
  if (!cache.has(name)) cache.set(name, loader.loadAsync(new URL(`../assets/models/${name}.glb`, import.meta.url).href));
  const gltf = await cache.get(name);
  const model = cloneSkinned(gltf.scene);

  const swaps = Object.fromEntries(Object.entries(recolor).map(([k, v]) => [k.toUpperCase(), v]));
  const sections = {};
  model.traverse((obj) => {
    if (!obj.isMesh) return;
    const old = obj.material;
    if (old.map) {   // character: keep the painted texture, matte like everything else
      obj.material = new THREE.MeshLambertMaterial({ map: old.map, color: color ?? '#ffffff' });
      obj.frustumCulled = false;   // skinned meshes move outside their bind-pose bounds
      return;
    }
    const original = '#' + old.color.getHexString().toUpperCase();
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

  if (gltf.animations.length) {
    const mixer = new THREE.AnimationMixer(model);
    const actions = Object.fromEntries(gltf.animations.map((clip) => [clip.name, mixer.clipAction(clip)]));
    let current = null;
    group.userData.mixer = mixer;
    group.userData.clips = Object.keys(actions);
    group.userData.play = (clipName, fade = 0.25) => {
      const next = actions[clipName];
      if (!next || next === current) return;
      next.reset().play();
      if (current) current.crossFadeTo(next, fade, false);
      current = next;
    };
    group.userData.play(actions.idle ? 'idle' : group.userData.clips[0]);
  }
  return group;
}
