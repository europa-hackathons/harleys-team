// One night, sunset to sunrise: the sky, sun, moon, stars, fog and lights follow the round timer.
// Sunset (first ~8 s) -> night purple with stars -> dawn and sunrise (last ~10 s).
import * as THREE from 'three';
import { GLOW_MATERIALS, NIGHT_GLOW_MATERIALS, NIGHT_KEY_POSITION } from './town.js';

const SUNSET_SECONDS = 8;
const SUNRISE_SECONDS = 10;

// Colour sets: top of sky, middle, horizon, fog, glow around the sun, light tint.
const NIGHT = { top: '#22104F', mid: '#4B2A8C', low: '#7A4FB8', fog: '#70509A', hemi: '#D4C5F1', key: '#FFE0AF' };
const DUSK = { top: '#4A2F8F', mid: '#D9668A', low: '#FFA65C', fog: '#B9668E', hemi: '#FFB8A8', key: '#FFB070' };
const DAWN = { top: '#5E4AB0', mid: '#F08CA6', low: '#FFC46E', fog: '#D88A9E', hemi: '#FFD2B8', key: '#FFC98A' };

const SUNSET_DIR = new THREE.Vector3(0.35, 0, 1).normalize(); // the sun goes down here, in front of the hero at the start...
const SUNRISE_DIR = new THREE.Vector3(-0.35, 0, -1).normalize(); // ...and comes up on the opposite side
const SUN_DISTANCE = 300;
const deg = THREE.MathUtils.degToRad;

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

  const a = {}, b = {}, mixed = {};
  const toColors = (set, out) => { for (const k in set) out[k] = (out[k] || new THREE.Color()).set(set[k]); return out; };
  const nightC = toColors(NIGHT, {}), duskC = toColors(DUSK, {}), dawnC = toColors(DAWN, {});
  const sunDir = new THREE.Vector3();

  // timeLeft: seconds left in the round, or null for the title screen (plain night).
  function update(timeLeft, roundSeconds, camera) {
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
    keyLight.color.copy(mixed.key);

    // Sun position on its side of the sky.
    sunDir.copy(sideDir).multiplyScalar(Math.cos(deg(elev))).setY(Math.sin(deg(elev)));
    sun.position.copy(sunDir).multiplyScalar(SUN_DISTANCE);
    sun.visible = timeLeft !== null && elev > -9;
    sun.lookAt(camera.position);
    uniforms.sunDir.value.copy(sun.position).sub(camera.position).normalize();
    dome.position.copy(camera.position);

    // Stars fade with the daylight; the moon arcs across the sky during the round.
    stars.material.opacity = 1 - s;
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
    // The warm side light stays put at night and swings toward the low sun at sunset and sunrise.
    keyLight.position.copy(NIGHT_KEY_POSITION);
    if (s > 0) keyLight.position.lerp(sunDir.clone().multiplyScalar(100).setY(Math.max(sunDir.y * 100, 30)), s);
  }

  return { update };
}
