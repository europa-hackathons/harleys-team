# Webcam and microphone controls

Reached from `docs/agents/helper.md` (Design question 3) and the Friend rules in `AGENTS.md`. Webcam games mean the player moves their body in front of the laptop camera to play. Ideas for them: https://nvatvani.github.io/europaskolan-hackathon2026/background/IDEAS.html (head-steering, running in place, punch zones, flapping, clapping, roaring into the mic).

## When it's on

**The Team's idea, never ours.** Webcam or mic controls become a feature only when the Team brings them up while talking about controls: the camera, waving, moving or dancing in front of the screen, jumping, shouting or roaring. When they do, cheer it and record it under **Controls** in `docs/game-plan.md` (e.g. "Webcam: wave left/right half of the screen to steer"). Until the game plan's Controls say webcam or mic, games use keys, mouse or touch, and sparks offered to a stuck Team stay with those too.

## How to build it

- **The kit pieces**: `src/kit/webcam.js` (`startWebcam()`: motion, zones, grid, centroid, mirrored picture) and `src/kit/mic.js` (`startMic()`: loudness). Usage is in each file's header and `src/kit/README.md`. Motion only: they see *where* something moved, never *what* (no hand, face or pose recognition), so design rules that forgive: "move in the left box" rather than "raise your left hand".
- **Start the camera from a click**: call `startWebcam()` / `startMic()` from the PLAY button's handler, so the browser's permission prompt appears at a clear moment. While it's asking, show a friendly "Allow the camera! 📷" screen.
- **Every failure gets a kid-friendly screen**, using the error's `.reason` (`denied`, `no-camera`, `busy`, `insecure`, …): e.g. "We need the camera! Ask a grown-up to click the 📷 in the address bar." A keyboard fallback for the same actions keeps the game playable when the camera won't start.
- **Show the player themselves**: a mirrored camera picture (`cam.draw`) faded behind the game, or in a corner, with the active zones outlined, so kids see where to move.
- **Tune for a room**: kids standing 1–2 m back, other kids moving behind them. Use thresholds on `zone()` values (start around 0.05–0.15), smooth `centroid` over a few frames, and give each action a short cooldown so one wave isn't ten hits.

## Privacy

The camera picture stays on the screen, live. Never save, upload or log camera frames, and never put a screenshot with a real person in it into the repo or a Wish Record. Checks use a fake camera (below), whose picture is a test pattern.

## Checking it

- **Real camera**: `tools/webcam-test.html` (published at https://europa-hackathons.github.io/harleys-team/tools/webcam-test.html) checks camera, mic, motion zones and mirroring in one page; `?auto=1` starts both without a click. Works on https (GitHub Pages) and on localhost.
- **Friends' checks**: `tools/shot.py` has no camera. Launch Edge (not headless: headless refuses fake devices) with `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream --disable-backgrounding-occluded-windows --disable-renderer-backgrounding`, a fresh `--user-data-dir` and `--remote-debugging-port`, then read the page's state over the DevTools protocol (Node 22 has `WebSocket` built in). The fake camera shows a moving pattern, so motion is detected; the fake mic plays a tone.

## Where the Team plays: the published page

The T3 preview pane can't use the camera or mic (confirmed by the Grown-up, 2026-11-21), so a webcam game is played on the **published page** (**Saving and publishing** in `docs/agents/environment.md`; team machine: https://europa-hackathons.github.io/harleys-team/) in a normal Edge or Chrome tab. The first time, the Grown-up opens it and clicks Allow for the camera (and mic); flag this in the Grown-up Note.

That changes the loop for every delivered change:

1. The record keeper saves and publishes the change straight away (`docs/agents/backstage.md`); the Team sees nothing until it's pushed.
2. Wait for the publish to finish: `gh api repos/<owner>/<repo>/pages/builds/latest --jq '.status + " " + .commit'` shows `built` with the new commit (about a minute).
3. Tell the Team to **hard-reload** the game tab (Ctrl+Shift+R; a plain reload can show the old game for up to 10 minutes, because GitHub Pages lets the browser cache files).

Fill the minute of waiting with question time. The preview pane still works for everything except the camera and mic, so keep using it for quick looks (the keyboard fallback plays there).
