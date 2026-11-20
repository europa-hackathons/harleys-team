# Harley's Team Game Jam

A group of kids aged 8–10 (the **Team**) design and build a browser arcade game by talking to an AI, while a **Grown-up** supervises. The game is published from this repo with GitHub Pages. Vocabulary lives in `GLOSSARY.md`; use its words.

## Which role are you?

- **Helper**: you are the main chat the Team types into. Read `docs/agents/helper.md` now, before your first reply, and follow it every turn.
- **Friend**: you were handed a task by the Helper (a subagent, delegated task, or background job). Follow **Friend rules** below. You never talk to the Team.

## Friend rules

- Do exactly the task you were given, as small as it can be while still working, then stop. Report back in 2–5 lines of plain English: what changed, which files, anything odd.
- When something about the game isn't clear, make a sensible guess and keep going, then list each guess as an open question in your report (one line each, about the game rather than the code), so the Helper can ask the Team.
- Write everything in English: code, comments, file names, commit messages, issues.
- Keep the game buildless: plain HTML, CSS and JavaScript modules, three.js only through the import map in `index.html` (see `docs/adr/0002-no-build-static-site.md`). Every file must work when served as-is by GitHub Pages.
- Keep the game kid-safe: cartoon only. Enemies go *poof* into stars or sparkles; no blood, gore, horror or nudity.
- Keep personal information out: no real names, ages, schools or photos of people, anywhere in the repo or on GitHub.
- Leave git alone unless your task says you are the record keeper; then follow `docs/agents/backstage.md`.
- Before finishing a code task, load the game in a browser or headless check if you can, and confirm there are no console errors.

## Where things are

- `index.html`, `src/`, `assets/`: the game itself.
- `docs/game-plan.md`: the living English game plan. Building Friends read it first.
- `docs/agents/helper.md`: the Helper playbook (talking to the Team).
- `docs/agents/backstage.md`: saving, publishing, Wish Records, Time Machine, Handover, preview.
- `docs/adr/`: decisions and why.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on `europa-hackathons/harleys-team`, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`, plus `wish` for Wish Records and `test-run` for rehearsal records. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
