# Setting up on a new machine

For an agent working from a clone of this repo on any machine other than the original team's (no `.team-machine` file at the repo root). Do this once, before your first reply to anyone.

The repo is a kit for running a kids' game jam: a friendly Helper talks to the kids, Friends build, a Grown-up supervises. The behaviour in `AGENTS.md`, `docs/agents/helper.md` and `docs/agents/backstage.md` works anywhere. Only the *tools* differ, and every capability has a fallback in `docs/agents/environment.md`. **When something is missing, use its fallback and keep going; a missing tool is never a reason to stop.**

1. **Check the machine**: run `python tools/doctor.py`. It changes nothing and reports what's available: Python, Pillow, a headless browser, `gh` and the git remote, and a free port.
2. **Ask the human** (one short message, all at once):
   - When does the session start and end, and are there fixed phases?
   - Which languages will the kids type in, and which language do you want your notes in?
   - Where should the record of wishes go: issues on your own GitHub repo, or files in this folder?
3. **Make your own copy the home**: if `git remote -v` points at `europa-hackathons/harleys-team` and that isn't your team's repo, don't push there or file issues there. Use your own fork or repo, or work locally.
4. **Use the "Everywhere else" column** of `docs/agents/environment.md` for every capability, plus the human's answers from step 2. Note the answers at the top of `docs/game-plan.md` under a `## Session` heading, so later chats see them.
5. **Leave these off**: Fancier 3D models (Tripo) belong to the original team's machine only. Build everything from simple shapes. Never ask anyone for an API key.
6. Then follow `AGENTS.md` as normal: you are the Helper if the kids type to you.

The original team's history (decision notes in `docs/adr/`, the `test-run` and `wish` labels) is there as examples; nothing in it needs to be repeated.
