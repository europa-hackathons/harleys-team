# Sounds and music (team machine only)

Reached from `docs/agents/helper.md`. Only usable where `docs/agents/environment.md` says **Sounds and music** are on; everywhere else, ignore this file and any ElevenLabs or audio tools your harness shows.

Once the first prototype is playable, when the Team wants a sound ("it should go *boing* when he jumps!") or music. `tools/elevenlabs_audio.py` makes one mp3 per request into `assets/audio/` (it reads the ElevenLabs key itself), and `src/kit/sound.js` plays it in the game.

## The Grown-up's rules (never bend these)

Out of bounds, whatever the Team asks:

- **Real spoken words**: speech, narration, announcers, lyrics. Characters may make **wordless** sounds, Sims-style: gibberish greetings, exclamations, cheers, laughs, an "oof" when hit.
- **Horror**: screaming, zombies, haunted, creepy.
- **Death and gore**: dying, killing, blood, pain.
- **Rude bodily sounds**: farts, burps, toilet sounds.

Everything else is fine, and the Team's taste leads: lasers, explosions, blasters, sword clashes, roaring monsters, crowds cheering, tense boss music. Don't make things cuter or sillier than they asked for.

- **When a wish crosses a line**, ask the Team what they'd like instead and mention one close option, without a telling-off: "monster dies" → "an explosion, or a power-down sound?"; "the robot says hello" → "robot beeps, or a happy wordless robot noise?". Write prompts about the sound itself ("enemy ship explodes, big boom"), and the defeat or the hit rather than a death ("boss defeated, huge explosion"). **One sound per prompt**: "monster stomping closer with a growl" crams footsteps and a growl into one clip; make `monster-steps` and `monster-growl` and let the game play both. For characters, describe the feeling, not a greeting: "greeting" reliably makes the model say "Hello" (held back), while "happy noise when it appears" or "surprised exclamation" come out wordless.
- **The tool is the backstop.** It refuses a prompt with a blocked word before spending anything: exit code 2 and one JSON line with the `blocked` words, a few close `options` and a `for_grown_up` line. Prompts asking for a voice (cheering, laughing, a crowd, a person) get a line asking for non-verbal noises only, and anything about a voice or a creature (monster, robot, alien, enemy) goes through speech-to-text: if it hears real words, the sound is **held back** (saved under `assets/audio/_old/`, not in the game) and refused the same way, with what it `heard`. Exclamations like "woo", "ooh", "wow", "oof" are allowed through; made-up words it doesn't know are held back to be safe, so a held-back sound may be fine. Only the Grown-up releases one, after listening: copy it to `assets/audio/<name>.mp3`. Music is always forced instrumental. The Friend reports refusals as they are and never rewords to sneak past the list.
- **Every refusal is flagged to the Grown-up.** The tool logs it to `assets/audio/_refused.jsonl` (git-ignored, stays on this computer), and the Helper copies the `for_grown_up` line into the Grown-up Note's ⚠️ line, with what the Team chose instead. Never make a refused sound some other way.
- **The Grown-up can listen to anything**: each new or held-back sound goes in the Grown-up Note as a link to the file (the result's `path`; how to link it is under **Sounds and music** in `docs/agents/environment.md`). If the Grown-up flags one, take it out of the game straight away.

## Kinds

| | **Sound effect** | **Music** |
|---|---|---|
| For | jump, pickup, laser, explosion, hit, win, lose, button, character greetings (wordless) | title screen, level loop, boss, win jingle |
| Command | `sfx --seconds 0.5–30` (short is better: 0.5–2 for actions); `--loop` for a background sound | `music --seconds 3–120` (30 for a level loop, 5–8 for a jingle) |
| Time | about 2 s | about 5–30 s |
| Cost | about 10 credits a second | about 12.5 credits a second (30 s ≈ 375) |

```
python tools/elevenlabs_audio.py sfx --prompt "short punchy laser blast" --name laser --seconds 0.6
python tools/elevenlabs_audio.py sfx --prompt "friendly alien character, happy noise when it appears" --name alien-hi --seconds 1.5
python tools/elevenlabs_audio.py music --prompt "driving synthwave space battle, fast" --name level --seconds 30
```

**Credits.** The account has 90,000 a month. Keep a running total in the Grown-up Note's ⚠️ line (each result prints `credits` for effects; count music at 12.5 a second). Ask the Grown-up first (park it like a Big Change) for any single request over 500 credits (music over 40 s), or once the session total passes 3,000.

## Steps

1. **Pin it down with the Team** in one question: what it sounds like, short or long, and the feel. For music, offer a Picture Choice of moods that fit their game (e.g. "🚀 fast space battle / 🌌 calm floating in space / 👾 tense boss fight").
2. **Make it** (a building Friend, in the background). Kid words: "my music friend is making it! 🎵". Use lowercase names with dashes (`coin-pickup`). Re-running a name replaces the file and keeps the old one in `assets/audio/_old/` (git-ignored); the result's `previous_version` says where.
3. **Drop it in** with `src/kit/sound.js` (usage in its header comment): `sound.play('jump')` on the action, `sound.music('level')` when the round starts. Vary pitch on repeated sounds (`{ pitch: 0.9 + Math.random() * 0.3 }`) so they don't get annoying. Keep music volume low (0.3–0.5) under the effects, and give the game a mute key (M) or button. Browsers stay silent until the first click, so music starts after PLAY.
4. **Try it**: the Team plays with it (the Grown-up can listen from the link in the Grown-up Note). Too loud, too long or wrong feel? Change `volume`/`pitch` for free, or re-run with a better prompt.

## Rolling back

- **One sound**: copy its file back from `assets/audio/_old/`, or `git checkout -- assets/audio/<name>.mp3` if it was already saved.
- **Sounds in the game**: remove the `sound.play` / `sound.music` lines; the game works without them. A missing file only warns once in the console.
- **The whole feature**: switch it off in `docs/agents/environment.md` (Sounds and music → Off), which every Helper reads first.
