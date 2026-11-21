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

## Still to decide
_Open questions about the game for the Helper to ask the Team, most urgent first. Move each into Features once answered; unanswered ones stay and get asked again._
- What does the opponent do? Does it shoot its hand back? Can you dodge or block?

## Built so far
- Title screen with a PLAY button (starter).

## Wish list
- 🔨 First prototype: pixel ring, rocket hand, head/body punches, 1000 health bar, webcam + keyboard.
- ⭐ Body moves the boxer: the player's position in front of the camera moves their boxer forward/back in the ring (webcam centroid, smoothed; keyboard fallback Left/Right arrows). Open: up/down too? Is it for dodging?

## Ideas for later
_The idea jar: wishes that arrived while the wish list was full (10). Pull them back onto the wish list as space frees up._
