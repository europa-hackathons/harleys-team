# Game plan

_The living English game plan. The Helper keeps it up to date as wishes change the game. English only; no names or personal details._

## The game
- **What is it about?** An original flying superhero woman (goggles, cape, laser power, spider-style climbing) who patrols the rooftops of a cozy town at night and climbs up chimneys. She is our own character, not any existing hero.
- **What does the player do?** Rescue townsfolk stuck on rooftops and chimneys, who wave for help.
- **Controls:** Arrow keys to fly/move. Space bar shoots a web line to swing (from chimney to chimney).
- **Score / win / lose:** Every person rescued counts ("RESCUED: N"). You win by rescuing people; exact target (e.g. rescue N before the timer ends) to be decided during the first prototype.
- **What makes it fun?** The rescued people thank you a LOT: big happy reactions, cheers, hearts/stars, thank-you bubbles.
- **Round length:** aim for 60–90 seconds of play.

## Style
- **2D or 3D / camera view:** 3D (three.js), third-person camera behind and a little above the hero, looking out over the rooftops.
- **Palette (hex):**
  - Night sky purple `#4B2A8C`
  - Hero suit teal `#1FA39A`
  - Cape coral `#F2635F`
  - Gloves/boots lavender `#B57EDC`
  - Window glow / stars / web yellow-cyan accents `#FFD45C` (web line `#4FE3E0`)
  - Roof red `#B8405E` (chimneys/walls warm grey `#C9B8B0`)
- **Shapes and outlines:** low-poly toy look built from simple primitives (boxes, spheres, cylinders, cones); chunky rounded proportions; flat or simple shaded colours; soft lighting; no outlines, no detailed textures. Warm glowing windows, a few streetlamps and round trees.
- **Chosen concept picture:** `assets/concepts/concept-3d.png`

## Features
_One short entry per feature, written clearly enough that a building Friend can build it: what it does, how it looks, what happens at the edges (crashes, falling off, running out of time). Grows during question time._

## Still to decide
_Open questions about the game for the Helper to ask the Team, most urgent first. Move each into Features once answered._

## Built so far
- **First playable version, "Rooftop Rescue"** (working title; the Team may rename it).
  - Title screen with the game name, a short "How to play" line and a PLAY button; the town slowly spins behind it.
  - 3D night town built from simple shapes: about 100 low-poly houses with red roofs, glowing yellow windows and chimneys, round trees, streetlamps, purple starry sky, moon and mountains.
  - The hero (teal suit, coral cape, lavender gloves/boots, yellow goggles, brown hair bun) flies above the rooftops; the camera follows from behind and above.
  - Controls: hold ⬆️ to fly forward, ⬇️ to slow down/back up, ⬅️ ➡️ to turn. SPACE shoots a cyan web line to a chimney in front and zips her there (it picks chimneys with people waiting first).
  - 7 townsfolk wave for help on chimney tops with a "HELP!" bubble. Fly close = rescued: they jump and cheer, a "THANK YOU!" bubble floats up, hearts and stars burst out, then they pop away in sparkles and someone new appears somewhere else.
  - A yellow arrow above the hero points to the nearest person who needs help.
  - HUD: "RESCUED: N" top-left, 90-second timer top-right. When time runs out: "You rescued N people!" and a PLAY AGAIN button. No way to lose.
  - Code: `src/main.js` (game flow, camera, web aiming), `src/town.js`, `src/hero.js`, `src/townsfolk.js`, `src/effects.js`.

## Wish list
- (none yet)
