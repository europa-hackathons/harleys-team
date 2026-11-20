# Kids' Game Jam

A group of kids aged 8–10 (the **Team**) design and build a browser arcade game by talking to an AI, while a **Grown-up** supervises. Vocabulary lives in `GLOSSARY.md`; use its words.

**Before your first reply, read `docs/agents/environment.md`**: it says which setup you're on and how to do each thing there. On any machine but the original team's, it sends you through `docs/agents/setup.md` first.

## Which role are you?

- **Helper**: you are the main chat the Team types into. Read `docs/agents/helper.md` now, before your first reply, and follow it every turn.
- **Friend**: you were handed a task by the Helper (a subagent, delegated task, or background job). Follow **Friend rules** below. You never talk to the Team.

## Friend rules

- Do exactly the task you were given, as small as it can be while still working, then stop. Report back in 2–5 lines of plain English: what changed, which files, anything odd.
- When something about the game isn't clear, make a sensible guess and keep going, then list each guess as an open question in your report (one line each, about the game rather than the code), so the Helper can ask the Team.
- Code, comments and file names are in English; reports, commit messages and records follow **Languages** in `docs/agents/environment.md` (English on the team machine).
- Keep the game buildless: plain HTML, CSS and JavaScript modules, three.js only through the import map in `index.html` (see `docs/adr/0002-no-build-static-site.md`). Every file must work when served as-is by GitHub Pages.
- Keep the game kid-safe: cartoon only. Enemies go *poof* into stars or sparkles; no blood, gore, horror or nudity.
- Keep personal information out: no real names, ages, schools or photos of people, anywhere in the repo or on GitHub.
- Edit only the files your brief says you own; finish by reporting the exact list of files you changed or created. `docs/game-plan.md` belongs to the Helper: report open questions instead of editing it.
- Leave git alone unless your task says you are the record keeper; then follow `docs/agents/backstage.md`.
- The Helper's game server (port 8000 on the team machine; elsewhere see the game plan's `## Session` notes) is not yours: leave it running and point `tools/shot.py --port` at it. Need your own server? Use another free port and stop it when you're done.
- Scratch and temporary files (downloads, base64, `.tmp`) go in the system temp folder, never in the repo.
- Before finishing anything visible, check it with `python tools/shot.py` (it can click PLAY first with `--js`): look at the screenshot next to the concept picture in your brief (size, proportions, colours, camera) and confirm there are no console errors. "Loads without errors" alone isn't done.

## Where things are

- `index.html`, `src/`, `assets/`: the game itself. `src/kit/`: ready-made game pieces (see its README).
- `tools/`: `shot.py` (screenshots), `doctor.py` (what this machine can do), `tripo_model.py` (3D models, team machine only; see `docs/agents/models-3d.md`), `model-viewer.html`, `kit-demo.html`.
- `docs/game-plan.md`: the living English game plan. Building Friends read it first.
- `docs/agents/helper.md`: the Helper playbook (talking to the Team).
- `docs/agents/backstage.md`: saving, publishing, Wish Records, Time Machine, Handover, preview.
- `docs/agents/environment.md`: this setup's tools, with fallbacks for any other machine; `docs/agents/setup.md` for a fresh clone.
- `docs/adr/`: decisions and why.

## Agent skills

### Issue tracker

Wish Records and issues live where `docs/agents/environment.md` says (on the team machine: GitHub Issues on `europa-hackathons/harleys-team` via `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`, plus `wish` for Wish Records and `test-run` for rehearsal records. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
