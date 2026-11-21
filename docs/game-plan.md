# Game plan

_Designed in Design phase (rehearsal). The Helper fills this in during Design from the Team's answers, and keeps it up to date as wishes change the game. Only the Helper edits this file. English only; no names or personal details._

## The game
- **What is it about?** A kitten and a pony go on an adventure, flying back to their old farm up in the sky. The flying route keeps changing along the way.
- **What does the player do?** Each player flies their animal through the sky by "sky swimming", a breaststroke-style stroke through the air. There's also a **sky stable** to decorate, like a racing team's garage but for magical animals. Flow of a round: 1) each player **decorates their own sky stable first** (it's their team's home base and the goal); 2) the **race**: kitten vs pony sky-swim to the farm; 3) the winner's animal, stable and team win, and they **celebrate at their stable with a big fizzy-drink spray** (a race-winner-style spray of sparkly fizzy sky-juice and confetti, kid-friendly, not champagne).
- **Controls:** (both players share one keyboard)
  - Arrow keys: steer up / down / left / right.
  - "Command" key: sky-swim forward (one stroke). The Team said Command, but on this Windows laptop that key opens the Start menu, so use another key nearby (e.g. Space or Alt) when building.
  - **B**: pink laser beams shoot out the back as a **speed boost** (a rocket-style jet, not a weapon).
  - **N**: drop **bananas** behind you to slow the other player down.
  - **M**: drop **mud** that the other player gets stuck in.
  - **Player 2**: WASD to steer; **1** for boost, **2** for bananas, **3** for mud. Swim-forward key not given yet; guess Left Shift. (Player 1 = arrows/B/N/M, player 2 = WASD/1/2/3.)
- **Score / win / lose:** a race: the first animal to reach the sky farm wins, and their stable and team celebrate.
- **What makes it fun?** **Cheering crowds** at the start line and the finish (on clouds, waving and cheering). **Sweets as bonuses**: players can give out sweets to everyone (to the crowd?) for bonus points or power (exact meaning still to decide).
- **Round length:** aim for 60–90 seconds of play.
- **What the Team loves in games (Warm-up):** fun, competitive, easy to understand; they like busy team-cooking chaos, running-and-jumping platformers and kart racing. (Inspiration only: our game is our own.) They want it **competitive and multiplayer** (players against each other).

## Style
_Written when the Team picks a concept (the Style Lock). Every picture and building brief follows it._
- **2D or 3D / camera view:** 3D (three.js), chase camera behind and slightly above the two racers, flying forward into the sky toward a farm on a cloud far ahead.
- **Palette (hex):** sky blue `#4FB3F6`, cloud white `#F4F7FB`, kitten orange `#F28C28`, pony cream `#F6EAD2`, mane/hoof purple `#9B5BD6`, farm red `#D9443A`, grass green `#6CC24A`.
- **Shapes and outlines:** low-poly toy look built from simple shapes (spheres, boxes, cylinders, cones) with flat shading and soft lighting; no outlines and no textures. Clouds are clumps of faceted spheres, and the route is made of cloud rings (tori of small cloud lumps). The animals are chunky and cute, with arms spread in a breaststroke pose.
- **Chosen concept picture:** `assets/concepts/concept-3d.png` (the Grown-up picked it over the Team's first pick, `concept-2d.png`).

## Features
_One short entry per feature, written clearly enough that a building Friend can build it: what it does, how it looks, what happens at the edges (crashes, falling off, running out of time). Grows during question time._
- **Four season tracks** (this is how "the route changes"): each track is a different season, with its own light colour, floating trees in season colours, and a different landscape far below. Obstacles float in the way and you must fly around them (bumping one slows you down). The Helper picked these details at the Team's request:
  - **Spring**: soft fresh morning light; floating trees with pink blossom; green meadows and flower fields below; obstacles are **giant tulips** and big daisies.
  - **Summer**: bright warm golden light; floating trees in deep green; a sunny beach and fields below; obstacles are **giant sunflowers** and beach balls.
  - **Autumn**: warm orange sunset light; floating trees in orange/red/yellow; a pumpkin patch and leafy forest below; obstacles are **giant pumpkins** and swirling leaf piles.
  - **Winter**: cool pale-blue light, gently falling snow; floating trees frosted white; a snowy landscape below; obstacles are **snowmen** and big snowballs.
  - Players pick the track (or season) before racing; the order is still to decide.
- **Pick your animal**: before the race, each player picks their animal on a simple pick screen (P1 picks with their keys, P2 with theirs). The Team wants **lots of characters to choose from** (a big character roster), with kitten, pony, **piglet** (pink), **bunny** (white/grey, long ears) **puppy** (brown, floppy ears), and a **robot** (the Team's own pick: a chunky, friendly toy robot made of boxes, with an antenna). The Helper picked those three at the Team's request, as farm friends. Whether both players can pick the same animal is still to decide.

## Still to decide
_Open questions about the game for the Helper to ask the Team, most urgent first. Move each into Features once answered; unanswered ones stay and get asked again._
- What can you put in your stable when decorating?
- Player 2's swim-forward key: is Z OK (Left Shift can trigger Windows Sticky Keys)?
- Should cloud rings matter more (bigger push), or are they just for show?
- Can your own banana/mud hit you, or only the other racer?
- Farm up-right like the concept, or straight ahead? Is "GO!" the right word? Are the big rings too easy now?
- Is the steering helper too strong (it gets you through ~9 of 10 rings without steering)? Should catch-up be stronger? Do the arrow markers look good?
- Which season track first?
- Can a player change their mind after pressing READY on the pick screen?
- Sweets as bonuses: do you collect sweets along the route, or throw them to the crowd? What does a sweet give you (speed, points, more bananas)?

## Built so far
- Title screen with a PLAY button (starter).
- First prototype (#22): 3D kitten vs pony sky-swim race through cloud rings to the sky farm; boost/banana/mud with cooldowns; progress bar; win screen with confetti and RACE AGAIN. P2 swims with Left Shift or Z.
- Pick your racer (#23): pick screen with six racers (kitten, pony, piglet, bunny, puppy, robot); both may pick the same; ready locks; last pick remembered.
- Prettier sky (#24): closer chase camera that keeps both racers in frame, big staggered cloud rings, farm island visible from the start, 3-2-1-GO countdown.
- Steering helper + catch-up (#25): soft pull toward the next ring, speed bonus for the racer behind (up to +30%), camera always frames both racers, orange/purple floating markers.

## Wish list
- ⭐ Stable decorating before the race
- ⭐ Cheering crowds + fizzy-juice celebration
- ⭐ Sweets bonuses
- ⭐ Four season tracks (spring, summer, autumn, winter) with obstacles

## Ideas for later
_The idea jar: wishes that arrived while the wish list was full (10). Pull them back onto the wish list as space frees up._
