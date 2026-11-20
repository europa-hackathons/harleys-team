# Should we rig the hero with Tripo?

Question from the Grown-up: *"Do we need to rig the character using Tripo for all these animations?"*

**Short answer: no.** The split-mesh pivots in `src/hero.js` already do what the game needs (cape flap, arm reach, leg swing), cost nothing and work offline. A Tripo rig is a real option if we later want bendy limbs (elbows, knees) or many ready-made moves (dance, cheer, wave). It would cost about 25 credits for the rig plus 10 per animation clip. It also needs two code changes we don't have yet: a skin-preserving re-bake and a skinned loader. Don't switch in the middle of the live session. Try it on the side only if the Team asks for moves the pivots can't do.

Researched 2026-11-20 against the official Tripo developer docs and three.js r170 (the version pinned in `index.html`). No paid Tripo endpoint was called.

## 1. What the Tripo API offers

### Endpoints (all async: create, then poll `GET /v3/tasks/{task_id}`)

| Step | Endpoint | Key params | Credits | Time |
|---|---|---|---|---|
| Riggability check | `POST /v3/animations/rig-check` | `input` | **0 (free)** | – |
| Auto-rig | `POST /v3/animations/rig` | `input`, `model`, `rig_type`, `spec`, `out_format` | **25** | ~30 s |
| Animate (retarget) | `POST /v3/animations/retarget` | `input` (rig task id), `animation` **or** `animations` (max 5), `out_format`, `export_with_geometry`, `animate_in_place` | **10 per clip** | ~5 s |

Sources: [rig check](https://developers.tripo3d.com/en/docs/animations-rig-check), [auto rigging](https://developers.tripo3d.com/en/docs/animations-rig), [retarget](https://developers.tripo3d.com/en/docs/animations-retarget), [rig pricing](https://developers.tripo3d.com/en/models/rig), [animation pricing](https://developers.tripo3d.com/en/models/animation), [quick start](https://developers.tripo3d.com/en/docs/quick-start).

The names `animate_prerigcheck`, `animate_rig` and `animate_retarget` come from the older v2 `/task` API and community SDKs. In v3 they are separate endpoints, as shown above. The docs give the base URL as `openapi.tripo3d.com/v3`, but our tool uses `openapi.tripo3d.ai/v3`. Both appear to be in use. Check this before adding calls.

### Inputs

- `input` for rig-check and rig can be **a task id, a `file_token` from the upload API, or a public URL**. GLB/FBX/OBJ/STL up to 150 MB. That means we can rig our saved painted original `assets/models/_source/hero.glb` (one indexed mesh, 2,473 triangles, textured) by uploading it. We don't need to regenerate it.
- `input` for retarget must be **the task id of a rigged model** (the rig task, or a later task run on it). A raw generation task id fails ([quick start](https://developers.tripo3d.com/en/docs/quick-start)).
- The docs say nothing about textured vs untextured models, smart low poly, face limits or multi-mesh inputs. The quick-start pipeline generates with texture on, but that's advice for generation, not a rule for rigging. **Not documented. Find out with the free rig-check.**

### Rig types and versions

- `rig_type`: `biped` (default), `quadruped`, `hexapod`, `octopod`, `avian`, `serpentine`, `aquatic`, plus `others` (v3.0 only). `spec`: `tripo` (default) or `mixamo` for bipeds. v3.0 adds `actorcore`, `unity`, `unreal` and `vrm`.
- `model`: the **default is `v1.0-20240301`** (biped only, 90+ presets). Other options are `v2.5-20260210` (creatures) and `v3.0-20260909` (recommended for humanoids). **Presets are tied to the rig version**, so pick the version for the clips you want.

### Preset animations

- **v3.0 biped:** `preset:idle`, `walk`, `run`, `dive`, `climb`, `jump`, `slash`, `shoot`, `hurt`, `fall`, `turn`.
- **v1.0 biped** (`preset:biped:<name>`, 90+): includes `idle`, `walk`, `run`, `jump`, `swim`, `fall`, `dive`, `climb`, plus fun ones like `cheer`, `clap`, `dance_01`…`dance_06`, `victory_celebration`, `wave_goodbye_01`, `greet_01`…`04`, `flip`, `heart_pose`, `laugh_01`. Some presets (`box_*`, `slash`, `shoot`, `hit_to_*`, `angry_*`) don't suit our gentle cartoon style, so we'd pick friendly ones.
- **There is no "fly" preset.** Flying would stay code-driven either way. Possible stand-ins are `dive`, `fall` or `swim`, or a held pose made by turning bones in code.
- `animate_in_place: true` keeps the clip on the spot. We need that because the game moves the hero itself.

### Output

- `out_format`: `glb` (default) or `fbx`. The URL is in `output.model_url`. The quick start reads `output.model_urls` for a batch of animations. **URLs expire after 5 minutes**, so download right away.
- The docs don't spell out what's inside the GLB. Going by the feature, it should hold a skeleton, skin weights and one animation clip per preset. We don't know if a 5-clip batch comes back as one GLB with 5 clips or as 5 GLBs. The `model_urls` field suggests several files, which we'd then merge by loading each and pooling the `gltf.animations`. **Check this in the experiment.**

### Does it fit our colour-section pipeline? (ADR 0003)

Today's `--rebake` (`tools/tripo_model.py`, `bake_sections` and `write_glb`) **would break a rigged GLB**:

- it writes only `POSITION` and `NORMAL`, so `JOINTS_0` and `WEIGHTS_0`, the `skins`, the bone nodes and the `animations` are all dropped;
- it bakes node world matrices into the positions. A skinned mesh must keep its bind-space positions instead.

This is fixable, and the fix doesn't hurt the skin weights. Re-baking only regroups triangles by colour. Every vertex keeps its own joints and weights, so the colour sections can't tear apart where they meet. The least invasive version:

1. Rig (and animate) the **painted original**, not our baked `hero.glb`. Tripo's paint is what the bake samples. The rigger may also prefer one connected mesh over our 7 unindexed sections (not documented).
2. A new skinned re-bake keeps the Tripo GLB as it is (nodes, skin, animations) and only swaps the mesh: one **primitive per palette colour**, each with `POSITION`, `NORMAL`, `JOINTS_0`, `WEIGHTS_0` and a plain colour material. Textures, images and UVs are removed. That's roughly 60–100 extra lines in `tripo_model.py`.
3. GLTFLoader turns each primitive into its own `SkinnedMesh` sharing one skeleton. So `userData.sections` and `recolor` in `src/models.js` keep working.

The rig can also be re-baked for free whenever the palette changes, the same way `_source/` works today. To allow that, save the rigged and animated GLB in `_source/`.

## 2. Playing the clips in three.js (r170)

Docs: [SkinnedMesh](https://threejs.org/docs/#api/en/objects/SkinnedMesh), [Skeleton](https://threejs.org/docs/#api/en/objects/Skeleton), [AnimationMixer](https://threejs.org/docs/#api/en/animation/AnimationMixer), [AnimationAction](https://threejs.org/docs/#api/en/animation/AnimationAction), [GLTFLoader](https://threejs.org/docs/#examples/en/loaders/GLTFLoader), [SkeletonUtils](https://threejs.org/docs/#examples/en/utils/SkeletonUtils), example [webgl_animation_skinning_blending](https://threejs.org/examples/#webgl_animation_skinning_blending).

```js
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
const gltf = await loader.loadAsync(url);            // gltf.animations = AnimationClip[]
const model = cloneSkinned(gltf.scene);              // NOT scene.clone(true) for skinned models
const mixer = new THREE.AnimationMixer(model);
const walk = mixer.clipAction(THREE.AnimationClip.findByName(gltf.animations, 'walk'));
walk.play();                                         // idle.crossFadeTo(walk, 0.2) to blend
// every frame:
mixer.update(dt);
```

Changes this would need in `src/models.js`:

- **Cloning:** `gltf.scene.clone(true)` leaves the cloned skinned meshes bound to the *original* bones. Use `SkeletonUtils.clone`, from the same pinned import map, so no build step is needed.
- **Materials:** swapping in `MeshLambertMaterial({ flatShading: true })` is fine. Since r129, skinning works on any built-in material on a `SkinnedMesh`, with no `skinning: true` flag needed. Flat shading works out normals per pixel, so a skinned body still looks faceted.
- **Re-centring and scaling:** these are fine as they are. They change the transform of the wrapper or model root, which is above the bones. `Box3.setFromObject` uses `SkinnedMesh.computeBoundingBox()` in recent three.js, which follows the current pose. So measure the size before the first `mixer.update`, while the model is still in its rest pose.
- **Return the clips:** for example `group.userData.clips = gltf.animations` and `group.userData.mixer`. `hero.js` would call `mixer.update(dt)` and cross-fade between idle, walk and run.
- **Our own moves stay possible:** after `mixer.update`, code can still turn a bone by hand, such as the right upper arm for the forward web reach or the flying pose. A bone that no clip animates can be set freely.
- **Cape:** a biped rig has no cape bones, so Tripo will tie the cape to the spine and legs, and it may stretch with the steps. We'd keep the cape as a separate flapping copy. It would become a plain `Mesh` with its skin attributes dropped, attached to the chest/spine bone with `bone.add(capePivot)`. The bone names in Tripo's `tripo` spec aren't in the docs, so we'll read them from the experiment file.
- `splitOntoPivot` would no longer be needed for arms and legs on the rigged hero. Keep it working for the hand-built fallback hero.

## 3. Recommendation for a live 3-hour kids' session

| | Keep split-mesh pivots (now) | Switch to Tripo rig + presets |
|---|---|---|
| Looks | Stiff limbs that swing from a joint, toy-like. Fits the low-poly style. Joints can show seams. | Smooth bending at elbows, knees and spine. Real walk and run cycles. Fun extras like dance, cheer and wave. |
| Effort | Already built. Walking legs are in progress. | Skinned re-bake (~60–100 lines of Python) plus loader and mixer changes (~30 lines). Cape re-attachment and bone-driven flying pose. About half a day for a Friend, plus testing. |
| Risk | Low. Offline, deterministic, no API calls. | Medium. Rig quality on a chunky 2.5k-triangle hero with a cape is unknown. There's no fly preset. Batch output format and bone names aren't documented. 5-minute download URLs. Depends on the network during the session. |
| Credits | 0 | Rig 25, plus 10 per clip. Idle, walk, run and jump come to **~65**. Re-rigging after a new hero model costs the same again. |
| Kids' agency | They can tweak swing angles live ("bigger arm swing!"). | They choose moves from a menu ("make her do a victory dance!"), which is very motivating. |

**Recommendation:** keep the pivots for the live session. They're working, free, and the Team can tune them by talking. Treat rigging as an optional side quest the Grown-up can run in the background (or between sessions). Do it only if the Team asks for moves the pivots can't fake, like dances, cheers or proper running.

### Smallest experiment worth trying (about 45 credits, ~15 minutes)

1. **Free:** upload `assets/models/_source/hero.glb` (`POST /v3/files`) and `POST /v3/animations/rig-check`. Check `riggable` and `rig_type == biped`. If it isn't riggable, stop here at 0 credits spent.
2. **25 credits:** `POST /v3/animations/rig` with `model: "v3.0-20260909"`, `rig_type: "biped"`, `spec: "tripo"`. If we'd rather have the big fun list, choose `v1.0-20240301` and use `preset:biped:*` names instead.
3. **20 credits:** `POST /v3/animations/retarget` with `animations: ["preset:idle", "preset:walk"]` and `animate_in_place: true`. Download within 5 minutes and save to `assets/models/_source/`, which is git-ignored.
4. Open it in `tools/model-viewer.html` or the three.js editor. Check how the cape, goggles and hands move, whether the feet stay planted, what the bone names are, and whether the batch came back as one file or two.
5. Only if it looks clearly better: build the skinned re-bake and the `models.js` mixer changes (sections 1 and 2), and keep the pivot hero as the fallback.

## Open questions (not answered by the docs)

- Does the rigger accept our smart-low-poly mesh, and how well does it weight a cape? Only rig-check plus a real rig will tell.
- Is a batch retarget one GLB with several clips or several GLBs?
- What are the bone names in the `tripo` spec? We need them for code-driven flying and reach poses and for attaching the cape.
- Which API host is current: `openapi.tripo3d.ai` (our tool) or `openapi.tripo3d.com` (the docs)?
- Can a task id from a weeks-old generation still be used as `input`? Uploading the saved source GLB avoids the question.
