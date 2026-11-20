# Backstage

Everything the Team never sees: preview, saving, publishing, Wish Records, Time Machine and Handover. Everything here is in English.

## Preview

The Team watches the game in T3's preview pane. Port 8000 belongs to the Helper's one server.

1. **Start the server once**, from the repo root, as a background command with the maximum time limit (`timeout: 7200000`, 2 hours): `python -m http.server 8000`. A default background command is stopped after 30 minutes, and the Team's game disappears. Restart it the same way if it stops.
2. **Show the game**: `preview_open` on `http://localhost:8000/`, visible. After a change lands, reload the same tab.
3. **When the game window is gone** (closed, or "it went away"): open a fresh tab with `reuseExistingTab: false`, then close the old one with `t3_preview_close`. Reusing the old tab doesn't bring it back.
4. **Hold the reload** while a Friend is mid-edit on files the game loads, so the Team never plays a half-built game; reload when the change lands.
5. **Checking things yourself**: use `python tools/shot.py` (headless screenshot, WebGL included), never the Team's tab. Hidden preview tabs draw 3D scenes blank.
6. Fallback when the preview can't be seen: the published page, https://europa-hackathons.github.io/harleys-team/, updates about a minute after each save.

## Record keeper

The Helper sends one record keeper after each delivered change. Run only one at a time; if another record keeper is still running, the next one waits.

The brief includes: the **exact list of files** the finished Friend reported, a one-line English summary of the wish, how it was understood, what was decided and why, any flags (content redirect, Big Change parked), and the Wish Record number when the wish chains onto an earlier one (or "new"). Never a placeholder like `#A`.

1. Stage **only the listed files**: `git add -- <files>`. Other Friends may be mid-edit in the same folder, so never `git add -A` or `git add .`. Leave anything unlisted alone and mention it in the report.
2. `git commit` with an English message: `<Wish summary> (#<issue>)`, one wish per commit, ending with the attribution line the system gives you. For a new wish, create the issue first (step 4) so the commit can name it.
3. `git pull --rebase`, then `git push` to `main`. GitHub Pages publishes from `main` automatically.
4. Write the **Wish Record**:
   - New wish: `gh issue create --label wish --title "<Wish summary>"` with the body below. During a rehearsal, also add `--label test-run`.
   - Chained wish: `gh issue comment <n>` with the same body sections for the new step.
   - When the Team moves on from a feature, the Helper says so in the next brief: `gh issue close <n>` after a final comment naming the commits. A feature is never left open once the Team has moved on.
5. Report back to the Helper in one line: commit hash, issue number, published or not, and any unlisted changed files you saw.

Wish Record body:

```
**Wish (in English):** <what the Team asked for, translated, without names or personal details>
**How we understood it:** <interpretation, including guesses made for vague wishes>
**What we did:** <change, files touched>
**Decisions:** <choices the Team made, with options offered>
**Flags for the Grown-up:** <content redirects, Big Changes, credits spent, known rough edges, or "none">
```

## Time Machine

To undo the latest wish: `git revert --no-edit <commit(s) for that wish>`, push, and comment on its Wish Record: "Reverted at the Team's request." Never rewrite history; a revert keeps the old version recoverable.

## Handover

1. Write `docs/session/handover.md` in English: the Helper's name, current phase, the wish list, open Wish Records, what's half-built, and anything the Grown-up flagged. No personal details.
2. Have the record keeper save it.
3. Start a new chat in this project with `t3_thread_launch`, prompting: "You are the Helper. Read AGENTS.md, then docs/session/handover.md, then greet the Team as <name> and carry on."
4. Put the new chat's link in the Grown-up Note so the Grown-up can click across.
