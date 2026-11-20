// Cartoon "poof" in three.js: sparkles that fly out and fade. The kid-safe way to make things disappear.
//   poof3d(scene, enemy.position);   ...each frame: updatePoofs(dt);
import * as THREE from 'three';

const COLORS = ['#FFD93B', '#FF6B9A', '#4BE3A4', '#6EC6FF', '#FFFFFF'];
const geometry = new THREE.OctahedronGeometry(1, 0);
const live = [];

export function poof3d(scene, position, { count = 16, size = 0.18, speed = 4, colors = COLORS } = {}) {
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true }));
    mesh.position.copy(position);
    mesh.scale.setScalar(size * (0.6 + Math.random() * 0.8));
    const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).normalize();
    scene.add(mesh);
    live.push({ mesh, scene, vel: dir.multiplyScalar(speed * (0.5 + Math.random())), age: 0, life: 0.6 + Math.random() * 0.4 });
  }
}

export function updatePoofs(dt) {
  for (let i = live.length - 1; i >= 0; i--) {
    const p = live[i];
    p.age += dt;
    if (p.age >= p.life) {
      p.scene.remove(p.mesh);
      p.mesh.material.dispose();
      live.splice(i, 1);
      continue;
    }
    p.mesh.position.addScaledVector(p.vel, dt);
    p.vel.multiplyScalar(0.92);
    p.vel.y -= 3 * dt;
    p.mesh.rotation.x += dt * 6;
    p.mesh.rotation.y += dt * 4;
    p.mesh.material.opacity = 1 - p.age / p.life;
  }
}
