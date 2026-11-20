// One night, sunset to sunrise: the sky, sun, moon, stars, fog and lights follow the round timer.
// Sunset (first ~8 s) -> night purple with stars -> dawn and sunrise (last ~10 s).
import * as THREE from 'three';
import { GLOW_MATERIALS, NIGHT_GLOW_MATERIALS } from './town.js';

const SUNSET_SECONDS = 8;
const SUNRISE_SECONDS = 10;

// Colour sets: top of sky, middle, horizon, fog, sky fill (hemi) and its ground colour, light tint.
// At night the sky runs from deep violet overhead to a lighter violet at the horizon, and the fog is a
// little darker than the horizon, so the far roofs stand out against the sky as soft layers.
const NIGHT = { top: '#392568', mid: '#5E3A93', low: '#804BB5', fog: '#715298', hemi: '#D9C9F3', ground: '#61465C', key: '#FFE0AF' };
const DUSK = { top: '#4A2F8F', mid: '#D9668A', low: '#FFA65C', fog: '#B9668E', hemi: '#FFB8A8', ground: '#735274', key: '#FFB070' };
const DAWN = { top: '#5E4AB0', mid: '#F08CA6', low: '#FFC46E', fog: '#D88A9E', hemi: '#FFD2B8', ground: '#735274', key: '#FFC98A' };

// Fog distances: in the round it starts about two house rows away and is full about ten rows away
// (a row is 12 units); a bit clearer by day; the title tour sees the whole town.
const FOG_NIGHT = { near: 22, far: 130 };
const FOG_DAY = { near: 30, far: 170 };
const FOG_TITLE = { near: 60, far: 240 };

// A soft peach fill from above and to the camera's left (no shadows), so faces and the cape read
// warmly at night. Weaker when the low sun does the work.
const FILL = { color: '#FFD1AE', night: 1.0, day: 0.35 };

const SUNSET_DIR = new THREE.Vector3(0.35, 0, 1).normalize(); // the sun goes down here, in front of the hero at the start...
const SUNRISE_DIR = new THREE.Vector3(-0.35, 0, -1).normalize(); // ...and comes up on the opposite side
const SUN_DISTANCE = 300;
const deg = THREE.MathUtils.degToRad;

// The one shadow-casting light: the low sun at sunset and sunrise (warm, long, strong shadows),
// the moon at night (bluish, fainter). Its shadow box follows the hero so the shadows stay crisp.
// hemi: the soft sky fill light, a bit lower than before so the shadows show.
const MOON_LIGHT = { color: new THREE.Color('#C4C8FF'), intensity: 2.3, shadow: 0.7, hemi: 0.8 };
const SUN_LIGHT = { intensity: 3.0, shadow: 0.85, hemi: 1.0 };
const MIN_SUN_ELEV = 7;      // degrees; lower than this and the whole town would be one big shadow
const SHADOW_HALF = 34;      // the shadow box is about 68 units wide round the hero...
const SHADOW_HALF_TITLE = 75; // ...and covers the whole town on the title screen
const SHADOW_MAP = 2048;
const LIGHT_DISTANCE = 150;

// Window and lamp lights: a plain dim glass colour by day, warm yellow glow at night.
const LIGHT_OFF = new THREE.Color('#5C5784');
const LIGHT_ON = new THREE.Color('#FFD45C');

const vertexShader = `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const fragmentShader = `
  uniform vec3 top, mid, low, glowColor, sunDir;
  uniform float glow;
  varying vec3 vWorld;
  void main() {
    vec3 dir = normalize(vWorld - cameraPosition);
    float h = dir.y;
    vec3 col = mix(low, mid, smoothstep(-0.05, 0.25, h));
    col = mix(col, top, smoothstep(0.25, 0.85, h));
    float facing = max(dot(dir, sunDir), 0.0);
    float near = pow(facing, 8.0) + 0.45 * pow(facing, 2.0) * (1.0 - smoothstep(0.0, 0.5, h));
    col = mix(col, glowColor, clamp(near * glow, 0.0, 1.0));
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

export function createSky(scene, { stars, moon, hemi, keyLight }) {
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP);
  Object.assign(keyLight.shadow.camera, { near: 1, far: LIGHT_DISTANCE * 2 });
  keyLight.shadow.bias = -0.0004;
  keyLight.shadow.normalBias = 0.05;
  scene.add(keyLight.target);
  let shadowHalf = 0;
  const lightDir = new THREE.Vector3(), moonDir = new THREE.Vector3(), sunLightDir = new THREE.Vector3();
  const focusPoint = new THREE.Vector3(), basis = new THREE.Matrix4(), axis = new THREE.Vector3();

  const uniforms = {
    top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, low: { value: new THREE.Color() },
    glowColor: { value: new THREE.Color('#FFB35C') }, sunDir: { value: new THREE.Vector3() }, glow: { value: 0 },
  };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(450, 32, 16),
    new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, side: THREE.BackSide, depthWrite: false }),
  );
  dome.renderOrder = -1;
  dome.frustumCulled = false;
  scene.add(dome);

  // A big friendly low-poly sun with a soft glowing halo. It always turns to face the camera.
  const sun = new THREE.Group();
  sun.add(new THREE.Mesh(new THREE.CircleGeometry(26, 10), new THREE.MeshBasicMaterial({ color: '#FFD45C', fog: false })));
  const halo = new THREE.Mesh(new THREE.CircleGeometry(42, 10),
    new THREE.MeshBasicMaterial({ color: '#FFB35C', fog: false, transparent: true, opacity: 0.4, depthWrite: false }));
  halo.position.z = -1;
  sun.add(halo);
  scene.add(sun);

  stars.material.transparent = true;
  moon.material.transparent = true;

  // About one star in six shines twice as big.
  const sp = stars.geometry.attributes.position, bigPos = [];
  for (let i = 0; i < sp.count; i += 6) bigPos.push(sp.getX(i), sp.getY(i), sp.getZ(i));
  const bigGeo = new THREE.BufferGeometry();
  bigGeo.setAttribute('position', new THREE.Float32BufferAttribute(bigPos, 3));
  const bigStars = new THREE.Points(bigGeo, stars.material.clone());
  bigStars.material.size = stars.material.size * 2;
  stars.add(bigStars);

  const fill = new THREE.DirectionalLight(FILL.color, FILL.night);
  fill.castShadow = false;
  scene.add(fill, fill.target);
  const camRight = new THREE.Vector3(), camFwd = new THREE.Vector3(), fillDir = new THREE.Vector3();

  const a = {}, b = {}, mixed = {};
  const toColors = (set, out) => { for (const k in set) out[k] = (out[k] || new THREE.Color()).set(set[k]); return out; };
  const nightC = toColors(NIGHT, {}), duskC = toColors(DUSK, {}), dawnC = toColors(DAWN, {});
  const sunDir = new THREE.Vector3();

  // timeLeft: seconds left in the round, or null for the title screen (plain night).
  // focus: where the shadows matter most (just ahead of the hero), or null for the whole town.
  function update(timeLeft, roundSeconds, camera, focus = null) {
    let day = 0, sideDir = SUNSET_DIR, elev = -20, warm = duskC;
    if (timeLeft !== null) {
      const elapsed = roundSeconds - timeLeft;
      if (elapsed < SUNSET_SECONDS) {
        day = 1 - elapsed / SUNSET_SECONDS; // 1 at sunset -> 0 at night
        elev = THREE.MathUtils.lerp(14, -10, elapsed / SUNSET_SECONDS);
      } else if (timeLeft < SUNRISE_SECONDS) {
        const p = 1 - Math.max(timeLeft, 0) / SUNRISE_SECONDS; // 0 -> 1 as time runs out
        day = p;
        sideDir = SUNRISE_DIR; warm = dawnC;
        elev = THREE.MathUtils.lerp(-10, 26, p); // ends clearly above the mountains
      }
    }
    const s = day * day * (3 - 2 * day); // smooth fade

    for (const k in nightC) mixed[k] = (mixed[k] || new THREE.Color()).copy(nightC[k]).lerp(warm[k], s);
    uniforms.top.value.copy(mixed.top);
    uniforms.mid.value.copy(mixed.mid);
    uniforms.low.value.copy(mixed.low);
    uniforms.glow.value = s * 1.1;
    scene.fog.color.copy(mixed.fog);
    hemi.color.copy(mixed.hemi);
    hemi.groundColor.copy(mixed.ground);
    const fogSet = timeLeft === null ? FOG_TITLE : FOG_NIGHT;
    scene.fog.near = THREE.MathUtils.lerp(fogSet.near, FOG_DAY.near, timeLeft === null ? 0 : s);
    scene.fog.far = THREE.MathUtils.lerp(fogSet.far, FOG_DAY.far, timeLeft === null ? 0 : s);

    // Peach fill: from above, the camera's left and a little behind it, so it lights what she looks at.
    camRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
    camFwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
    fillDir.set(0, 1, 0).multiplyScalar(0.8).addScaledVector(camRight, -0.6).addScaledVector(camFwd, -0.3);
    fill.target.position.copy(camera.position);
    fill.position.copy(camera.position).addScaledVector(fillDir, 20);
    fill.intensity = THREE.MathUtils.lerp(FILL.night, FILL.day, s);

    // Sun position on its side of the sky.
    sunDir.copy(sideDir).multiplyScalar(Math.cos(deg(elev))).setY(Math.sin(deg(elev)));
    sun.position.copy(sunDir).multiplyScalar(SUN_DISTANCE);
    sun.visible = timeLeft !== null && elev > -9;
    sun.lookAt(camera.position);
    uniforms.sunDir.value.copy(sun.position).sub(camera.position).normalize();
    dome.position.copy(camera.position);

    // Stars fade with the daylight; the moon arcs across the sky during the round.
    stars.material.opacity = bigStars.material.opacity = 1 - s;
    moon.material.opacity = 1 - s * 0.7;

    // Lights click on once it gets dark enough, and off again as the sun comes up.
    const lightsOn = 1 - THREE.MathUtils.smoothstep(day, 0.2, 0.65);
    for (const m of GLOW_MATERIALS) m.color.copy(LIGHT_OFF).lerp(LIGHT_ON, lightsOn);
    for (const m of NIGHT_GLOW_MATERIALS) m.opacity = m.userData.nightOpacity * lightsOn;
    if (timeLeft !== null) {
      const f = THREE.MathUtils.clamp((roundSeconds - timeLeft) / roundSeconds, 0, 1);
      const ang = THREE.MathUtils.lerp(deg(25), deg(155), f);
      moon.position.set(Math.cos(ang) * 230, 60 + Math.sin(ang) * 140, -200);
    }

    // The shadow light shines from the moon at night and swings to the low sun at sunset and sunrise.
    moonDir.copy(moon.position).normalize();
    const e = deg(Math.max(elev, MIN_SUN_ELEV));
    sunLightDir.copy(sideDir).multiplyScalar(Math.cos(e)).setY(Math.sin(e));
    lightDir.copy(moonDir).lerp(sunLightDir, s).normalize();
    keyLight.color.copy(MOON_LIGHT.color).lerp(mixed.key, s);
    keyLight.intensity = THREE.MathUtils.lerp(MOON_LIGHT.intensity, SUN_LIGHT.intensity, s);
    keyLight.shadow.intensity = THREE.MathUtils.lerp(MOON_LIGHT.shadow, SUN_LIGHT.shadow, s);
    hemi.intensity = THREE.MathUtils.lerp(MOON_LIGHT.hemi, SUN_LIGHT.hemi, s);
    placeShadowBox(focus);
  }

  // Centres the shadow box on the focus point, snapped to whole shadow-map pixels
  // so the shadow edges don't shimmer as she flies.
  function placeShadowBox(focus) {
    const half = focus ? SHADOW_HALF : SHADOW_HALF_TITLE;
    if (half !== shadowHalf) {
      shadowHalf = half;
      Object.assign(keyLight.shadow.camera, { left: -half, right: half, top: half, bottom: -half });
      keyLight.shadow.camera.updateProjectionMatrix();
    }
    focusPoint.set(focus ? focus.x : 0, 3, focus ? focus.z : 0);
    const texel = (half * 2) / SHADOW_MAP;
    basis.lookAt(lightDir, axis.set(0, 0, 0), THREE.Object3D.DEFAULT_UP);
    for (const col of [0, 1]) {
      axis.setFromMatrixColumn(basis, col);
      const d = focusPoint.dot(axis);
      focusPoint.addScaledVector(axis, Math.round(d / texel) * texel - d);
    }
    keyLight.target.position.copy(focusPoint);
    keyLight.position.copy(focusPoint).addScaledVector(lightDir, LIGHT_DISTANCE);
  }

  return { update };
}
