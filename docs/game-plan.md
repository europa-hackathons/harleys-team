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

- **Fly up and down:** the Team loves flying and wants to go higher. Arrows still steer as now; **W** flies up and **S** flies down. She can go from just above the rooftops up to well above the town (high enough to see far, not so high the townsfolk are lost; suggested range about roof height + 2 up to ~3x the current cruise height). The camera follows smoothly. Space web-zips still work from any height.
- **Land and walk:** hold S at the lowest height to land. On the ground she walks around (arrows), can take off again (W), and can shoot her web from the ground to zip straight up to a chimney (Space), like a spider swinging up a wall.
- **People pop out of chimneys:** like in the concept picture, townsfolk stand INSIDE a chimney, visible from the waist up with their arms over the rim, waving for help. A new person appears by popping up out of a chimney (a springy jack-in-the-box pop with a little puff of sparkles/soot-free smoke), and when rescued they pop out and cheer before vanishing in sparkles.
- **Clouds:** puffy low-poly clouds (clusters of flattened spheres) drifting slowly above the town, tinted by the sky: pink-orange at sunset and sunrise, soft lavender-grey at night. She can fly right through them: when she flies into a cloud, a rainbow bursts out of it (a colourful arc of the palette colours plus rainbow stripes that pops out and fades after a couple of seconds, with a little sparkle).
- **Sunrise party (end of round):** when the sun comes up, everyone she rescued this round appears on the rooftops cheering and waving, with confetti and hearts, before the end screen (see assets/concepts/idea-4.png).
- **Pets and kites:** besides people, sometimes a cute cat waits on a chimney or a kite is tangled on one; rescuing them counts too (see assets/concepts/idea-1.png).
- **Shooting stars:** now and then a shooting star streaks across the night sky; fly up and touch it for +5 bonus (see assets/concepts/idea-2.png).
- **Traffic on the streets:** (the Team wanted a racing game; the Grown-up kept the rescue game and offered traffic instead.) Chunky low-poly toy cars in palette colours drive along the streets between the houses, turning at corners, with glowing headlights and tail lights at night (off by day, like the windows). They are scenery: no crashing, the hero simply passes over or beside them when walking. The Team wants **a bus and cars**: one long chunky town bus plus a few small cars.
- **One night, sunset to sunrise (the round timer):** she is a night-time hero. A round lasts **60 seconds** (was 90) and is one whole night. It starts at sunset: the sun is going down behind the mountains and the sky is orange-pink. It quickly fades to the night purple with stars for most of the round. Near the end it brightens to a pink-orange dawn, and the sun comes up when time is up. Goal: rescue as many people as possible before sunrise. There is no fixed win number; the end screen celebrates the count ("The sun is up! You rescued N people!").

## Still to decide
_Open questions about the game for the Helper to ask the Team, most urgent first. Move each into Features once answered._

- Belt emblem: is a star right? Goggles over the eyes or pushed up?

## Built so far
- **First playable version, "Rooftop Rescue"** (working title; the Team may rename it).
  - Title screen with the game name, a short "How to play" line and a PLAY button; the town slowly spins behind it.
  - 3D night town built from simple shapes: about 100 low-poly houses with red roofs, glowing yellow windows and chimneys, round trees, streetlamps, purple starry sky, moon and mountains.
  - The hero (teal suit, coral cape, lavender gloves/boots, yellow goggles, brown hair bun) flies above the rooftops; the camera follows from behind and above.
  - Controls: hold ⬆️ to fly forward, ⬇️ to slow down/back up, ⬅️ ➡️ to turn. SPACE shoots a cyan web line to a chimney in front and zips her there (it picks chimneys with people waiting first).
  - **Fly up and down:** W flies up, S flies down (smooth speed-up, she tilts nose-up/nose-down). She can go from 2 above the roofs and chimneys (she glides up over houses, never through them) up to 3x the old cruise height. With no key held she keeps her height, also after a web zip. Higher up the camera pulls back and looks down more. The title screen "How to play" mentions W/S.
  - 7 townsfolk wave for help on chimney tops with a "HELP!" bubble. Fly close = rescued: they jump and cheer, a "THANK YOU!" bubble floats up, hearts and stars burst out, then they pop away in sparkles and someone new appears somewhere else.
  - A yellow arrow above the hero points to the nearest person who needs help.
  - HUD: "RESCUED: N" top-left, 60-second timer top-right. When time runs out: "The sun is up! You rescued N people!" and a PLAY AGAIN button. No way to lose.
  - **One night, sunset to sunrise:** each round starts at sunset (orange-pink sky, a big glowing yellow sun sinking behind the mountains in front of her). In about 8 seconds it fades to the purple night with stars; the moon slowly arcs across the sky. In the last 10 seconds the sky turns pink-orange on the opposite side and the sun rises over the mountains as time runs out. Fog and lights follow the sky; windows keep glowing. The title screen stays night.
  - **Land and walk:** hold S at her lowest flying height and she floats gently down and lands on whatever is under her (street, a roof slope or a chimney top) with a little puff of dust and sparkles. On her feet she stands upright and walks: ⬆️/⬇️ walk forward/back (much slower than flying), ⬅️ ➡️ turn. Her legs step and her arms swing; the cape hangs and sways. Walls and anything taller than a small step stop her (she slides along them); walking off a roof she drops down with a plop. W hops her back into the sky; SPACE web-zips her up to a chimney in front (or just takes off if there is none). The camera comes closer and lower behind her while walking and blends back when she flies. Walking up to someone on a roof rescues them; people on high chimneys are out of reach from the street. The title screen mentions S/W/SPACE for landing.
  - Code: `src/main.js` (game flow, camera, web aiming), `src/town.js`, `src/hero.js`, `src/townsfolk.js`, `src/effects.js`, `src/sky.js` (sunset/night/sunrise).

## Wish list
- (none yet)
