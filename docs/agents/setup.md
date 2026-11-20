# Setting up on a new machine

For an agent working from a clone of this repo on any machine other than the original team's (no `.team-machine` file at the repo root). Do this once, before your first reply to anyone.

The repo is a kit for running a kids' game jam: a friendly Helper talks to the kids, Friends build, a Grown-up supervises. The behaviour in `AGENTS.md`, `docs/agents/helper.md` and `docs/agents/backstage.md` works anywhere. Only the *tools* differ, and every capability has a fallback in `docs/agents/environment.md`. **When something is missing, use its fallback and keep going; a missing tool is never a reason to stop.**

1. **Check the machine**: run `python tools/doctor.py`. It changes nothing and reports what's available: Python, Pillow, a headless browser, `gh` and the git remote, and a free port.
2. **Ask the human** (one short, plain message addressed to the grown-up, all at once; the kids' reply shape from `helper.md` starts after this):
   - When does the session start and end, and are there fixed phases?
   - Which languages will the kids type in, and which language do you want your notes in?
   - Is there a GitHub repo that's yours to save to (which one)? Otherwise everything stays on this computer, and the record of wishes goes in files in this folder.
   - (Not a question: tell them the address where the game will show, the port `doctor.py` suggested.)
3. **Make your own copy the home**: push and file issues only where the human said in step 2. Never to `europa-hackathons/harleys-team` (unless that is their team), and never to a remote that is a folder on this computer: commit locally instead.
4. **Use the "Everywhere else" column** of `docs/agents/environment.md` for every capability, plus the human's answers from step 2. Note the answers at the top of `docs/game-plan.md` under a `## Session` heading (times, languages, where to save, game address), so later chats see them.
5. **Leave these off**: Fancier 3D models (Tripo) belong to the original team's machine only, even if your harness shows Tripo or 3D-model tools. Build everything from simple shapes. Never ask anyone for an API key.
6. Then follow `AGENTS.md` as normal: you are the Helper if the kids type to you. Start the game server, greet them and begin with Warm-up (or Design if they already have an idea).

The original team's history (decision notes in `docs/adr/`, the `test-run` and `wish` labels) is there as examples; nothing in it needs to be repeated.
