// A floating colour-coded marker above each racer (P1 orange, P2 purple) so you can always find yours.
// It draws on top of clouds and grows with distance, so it stays easy to see when you're far away.
import * as THREE from 'three';

const MARKER_COLORS = ['#F28C28', '#9B5BD6'];
const MARKER_HEIGHT = 2.2;    // above the racer's middle
const MARKER_SIZE = 0.6;      // size when close (it grows with distance to stay readable)
const MARKER_GROW_FROM = 20;  // start growing when further from the camera than this

function flat(color) {
  return new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, fog: false });
}

/** A chunky down-pointing arrow with a little ring on top, in the player's colour. */
export function makeMarker(index) {
  const g = new THREE.Group();
  const color = MARKER_COLORS[index];
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.7, 4), flat(color));
  arrow.rotation.x = Math.PI;               // point down at the racer
  const edge = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.88, 4), flat('#FFFFFF'));
  edge.rotation.x = Math.PI;
  edge.position.y = 0.05;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.11, 6, 12), flat(color));
  ring.position.y = 0.72;
  g.add(edge, arrow, ring);
  g.traverse((o) => { if (o.isMesh) o.renderOrder = 10 + (o === edge ? 0 : 1); });
  return g;
}

/** Keep the marker above its racer, bobbing, facing the camera, and big enough to see from far away. */
export function updateMarker(marker, pos, camera, time) {
  const dist = camera.position.distanceTo(pos);
  const s = MARKER_SIZE * Math.max(1, dist / MARKER_GROW_FROM);
  marker.scale.setScalar(s);
  marker.position.set(pos.x, pos.y + MARKER_HEIGHT + 0.25 * s + Math.sin(time * 4) * 0.15 * s, pos.z);
  marker.quaternion.copy(camera.quaternion);
}
