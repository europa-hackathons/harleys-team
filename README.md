# Kids' game jam kit

A setup for running a game jam where kids (about 8–10) design and build a browser arcade game by talking to an AI helper, with a grown-up supervising. The helper keeps the talk simple and fun, lets the kids make every creative choice, and does the engineering quietly in the background.

Open the game: serve this folder (`python tools/serve.py`, which turns caching off) and visit http://localhost:8000/. There's no build step; it's plain HTML and JavaScript (three.js loaded from a CDN).

## Using it with your own AI agent

Clone it, open it in your agent (Claude Code, Codex, or similar) and tell it the kids are about to start. The agent reads `AGENTS.md`, notices it's not on the original team's machine, and walks through `docs/agents/setup.md`: it checks what your machine has (`python tools/doctor.py`), asks you a few questions (session times, languages, where to keep the record of wishes) and then switches to fallbacks for anything you don't have.

Please don't push to or open issues on the original repo; use your own copy.

## What's inside

- `AGENTS.md`: the rules every agent reads first.
- `docs/agents/helper.md`: how the helper talks to the kids (voice, picture choices, wish list, phases, safety).
- `docs/agents/backstage.md`: saving, publishing, wish records, undo, handover.
- `docs/agents/environment.md`: the only setup-specific file. It shows the original team's tools and a fallback for everyone else.
- `src/kit/`: ready-made game pieces (keys, loop, score and timer text, poofs, follow camera). `tools/kit-demo.html` shows them working.
- `tools/`: `shot.py` (headless screenshots), `live.py` (real-time checks in a hidden browser), `doctor.py` (machine check; also stops leftover check browsers).
