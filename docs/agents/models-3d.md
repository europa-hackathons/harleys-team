# Fancier 3D models (team machine only)

Reached from `docs/agents/helper.md`. Only usable where `docs/agents/environment.md` says **Fancier 3D models** are on; everywhere else, ignore this file and any Tripo or 3D-model tools your harness shows, and build from simple shapes.

Only in a 3D game, only once the first prototype is playable, and only when the Team wants something to look more detailed than our simple-shape version ("can the dragon look more real?"). It must still fit the Style Lock: the same toy look with more shape, never photo-real. There are two kinds, made by `tools/tripo_model.py` (it reads the Tripo key itself):

| | **Characters** (hero, people, animals that move) | **Props** (houses, trees, chimneys, things that stand still) |
|---|---|---|
| Concept picture | ONE character in a **T-pose** (arms straight out sideways, legs apart), facing the viewer, full body, plain white background | ONE object, three-quarter view, whole object visible, plain white background |
| Command | `--character --animations idle,walk,...` | `--palette "<every colour it needs>"` |
| Result | Textured (max 1024 px), up to 6k faces, rigged, with up to 5 animations | Flat palette-coloured sections, about 2k faces, no texture |
| Time / cost | about 2 min, about 40 credits + 25 rig + 10 per animation | about 1.5 min, about 40 credits |

**Credits.** Keep a running total of Tripo credits in the Grown-up Note's ⚠️ line whenever you spend them. Ask the Grown-up first (park it like a Big Change) for any single request over 100 credits, or once the session total passes 400.

Animations available for two-legged characters: `idle`, `walk`, `run`, `jump`, `fall`, `dive`, `climb`, `turn`, `hurt`, `slash`, `shoot`. There is no flying animation; build flying from a held `dive` or `fall` pose plus the game's own movement. Animals and other shapes get only a walk.

1. **Concept it**: the drawing Friend draws it as in the table, in the Style Lock: low-poly toy look, flat palette colours, no scenery, no text. For a character, tell the Team it's "standing like a starfish so my sculpting friend can see all of them! ⭐". Show it as a Picture Choice ("Like this? ✨") and save the chosen one as `assets/concepts/<name>-model.png`.
2. **Sculpt it** (a building Friend, in the background), e.g. `python tools/tripo_model.py --character --image assets/concepts/hero-model.png --name hero --animations idle,walk,run,jump,fall` or `python tools/tripo_model.py --image assets/concepts/house-model.png --name house --palette "#C9B8B0,#B8405E,#FFD45C"`. For props, list **one colour per material** (walls, roof, glass, frames, chimney…), each clearly different from the others: never a light and a dark shade of the same thing, and never two near-neighbours like peach and orange, or shadows on one material flip into the other's section. Leave out `--palette` to use the Style section. Use the wait for question time ("My sculpting friend is making it in 3D! 🗿").
3. **Drop it in** with `loadModel()` from `src/models.js` (the usage is in its header comment). Props: `recolor` swaps a section's colour for free. Characters: `userData.play('walk')` switches clips, and the game calls `userData.mixer.update(dt)` every frame and moves the character itself (clips stay in place). Models usually face sideways: set `rotationY` so they face the way they move. Keep the simple-shape version as the fallback when loading fails. Check new models in `tools/model-viewer.html?name=<name>&anim=walk`.
4. **Look check** with the drawing Friend, as in **Art direction**. For a prop whose colour landed on the wrong part (wedges or patches of the wrong colour on one wall), re-run with `--rebake` and a better `--palette`: it recolours the saved original for free. Re-baking can move triangles between sections, so update any `recolor` keys that point at the old section colours.

On props, tiny painted details (eyes, logos) are smaller than one triangle and disappear; add them as simple shapes on top when they matter. Characters keep them in their texture.
