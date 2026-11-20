# Game kit

Small, tested building blocks so a first prototype is assembled, not written from scratch. Plain ES modules, no build step. Import only what the game needs, and change them freely.

| Module | What it gives you | 2D / 3D |
|---|---|---|
| `input.js` | `keys.held('ArrowLeft')`, `keys.pressed('Space')` (this frame only), `keys.axis()` → `{x, y}` from arrows/WASD | both |
| `loop.js` | `startLoop(update)`: calls `update(dt, time)` every frame, dt capped, pauses while the tab is hidden | both |
| `hud.js` | `hud.set('score', '⭐ 3')`, `hud.banner('YOU WIN! 🎉', 2000)`: big readable text over the game | both |
| `timer.js` | `roundTimer(60, { onTick, onEnd })` with `.update(dt)`, `.left`, `.reset()` | both |
| `touch.js` | `touching(a, b, radius)`: pickups and bumps, on `{x, y}`, `{x, y, z}` or three.js objects | both |
| `poof2d.js` | `poof2d(x, y)` + `drawPoofs(ctx, dt)`: star burst on a canvas | 2D |
| `poof3d.js` | `poof3d(scene, position)` + `updatePoofs(dt)`: sparkle burst in three.js | 3D |
| `follow-camera.js` | `followCamera(camera, target, { distance, height })` → `.update(dt)` | 3D |

Working examples of all of them together: `tools/kit-demo.html` (3D) and `tools/kit-demo.html?mode=2d`.
