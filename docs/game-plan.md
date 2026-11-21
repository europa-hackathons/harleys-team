# Game plan

_Not designed yet. The Helper fills this in during Design from the Team's answers, and keeps it up to date as wishes change the game. Only the Helper edits this file. English only; no names or personal details._

## The game
- **What is it about?** A boxing match in a boxing ring.
- **What does the player do?** Fights an opponent by shooting their glove: the hand flies across the ring like a rocket to hit the opponent.
- **Controls:** Webcam (the laptop camera at the top of the screen): the player moves their body in front of the camera to play. Punch in front of the camera and your boxer's WHOLE HAND (glove and all) shoots off across the ring like a rocket at the opponent (motion detection: a big burst of movement in a punch zone fires it, with a short cooldown; the hand flies back after). Keyboard fallback for the same actions. Details being decided (see `docs/agents/webcam.md`).
- **Score / win / lose:** The opponent starts with 1000 health. A rocket hand to the HEAD does 100 damage; to the BODY does 50. Bring the opponent to 0 health to win.
- **What makes it fun?** Your real body is the controller: when you move in front of the camera, your boxer moves too, and real punches fire the rocket hand.
- **Round length:** aim for 60–90 seconds of play.

## Style
_Written when the Team picks a concept (the Style Lock). Every picture and building brief follows it._
- **2D or 3D / camera view:** 2D pixel art, side view of the boxing ring: player boxer on the left facing right, opponent on the right facing left, crowd silhouettes behind.
- **Palette (hex):** night navy `#0f2347` (background), crowd blue `#1e5a7a`, player teal `#1fb8b0`, opponent orange `#f0662c`, ring red `#e0485a`, rope cream `#f4e4c4`, sparkle yellow `#ffd23f`.
- **Shapes and outlines:** retro pixel art with big visible pixels (draw at a low resolution like 320x180 and scale up with no smoothing); dark 1-pixel outlines; chunky, spiky-haired boxers with headbands; flame trail behind the flying glove; hits make yellow stars/sparkles.
- **Chosen concept picture:** `assets/concepts/concept-pixel-2d.png`

## Features
_One short entry per feature, written clearly enough that a building Friend can build it: what it does, how it looks, what happens at the edges (crashes, falling off, running out of time). Grows during question time._
- **Rocket punch:** when the player punches (webcam punch zone, or keyboard fallback Space), their whole hand (glove) shoots across the ring with a flame trail toward the opponent; on a hit, stars/sparkles burst and the opponent wobbles; the hand then flies back to the player. Short cooldown so one punch is one shot.
- **Head and body punches:** webcam: a punch in the upper punch zone aims at the head (100), in the lower zone at the body (50). Keyboard fallback: Up arrow / W = head punch, Space / Down arrow = body punch. Health bar shows the number out of 1000.
- **Webcam play:** mirrored camera picture faded behind or in a corner with the punch zone outlined; friendly screens for "Allow the camera! 📷" and for camera failures; keyboard fallback always works.

## Play-test notes
- Round 1: they LOVE shooting the rocket fist. 2 players and walking weren't built yet (confused them).

## Still to decide
_Open questions about the game for the Helper to ask the Team, most urgent first. Move each into Features once answered; unanswered ones stay and get asked again._
- Opponent shooting back: how much damage, and does the player also have 1000 health?
- More characters: which other boxers are on the wheel, and what special move does each have? 
- How many hiding blocks, and can they break?

## Built so far
- Title screen with a PLAY button (starter).

## Wish list
- 🔨 First prototype: pixel ring, rocket hand, head/body punches, 1000 health bar, webcam + keyboard.
- ⭐ Body moves the boxer: the player's position in front of the camera moves their boxer forward/back in the ring (webcam centroid, smoothed; keyboard fallback Left/Right arrows). Why: to hide behind blocks and to line up your aim.
- ⭐ Hiding blocks: a few pixel blocks/crates standing in the ring the player can move behind to take cover; rocket hands that hit a block bounce off with a poof.
- ⭐ Opponent shoots back: the opponent fires its own rocket hands at the player (that's why you hide).
- ⭐ More characters, each with a different special move, chosen by spinning a WHEEL before the fight. One super-rare boxer, ZEUS (1% chance on the wheel), has a THUNDER ability that does 150 damage. Look (our own original character, inspired by a powered-up anime hero; no copied character): spiky glowing golden hair, crackling yellow lightning aura, glowing gloves.
- ⭐ NEXT: 2-player mode (play-test round 1 top wish): the two players stand NEXT TO EACH OTHER in front of the one camera, left half = player 1 (teal, left boxer), right half = player 2 (orange, right boxer). They fight each other: punch HIGH = rocket fist flies high (head, 100), punch LOW = rocket fist flies low (body, 50). DUCK in real life = your boxer ducks, and high rocket fists fly over you (dodging). Each boxer has 1000 health. Keyboard fallback: P1 W high / S low / X duck, P2 Up high / Down low / Shift duck.

## Ideas for later
_The idea jar: wishes that arrived while the wish list was full (10). Pull them back onto the wish list as space frees up._
