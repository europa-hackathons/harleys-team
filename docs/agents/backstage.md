# Backstage

Everything the Team never sees: preview, saving, publishing, Wish Records, Time Machine and Handover. Everything here is in English.

## Preview

The Team watches the game in T3's preview pane.

1. If nothing is serving the game, start `python -m http.server 8000` from the repo root as a background command.
2. Open `http://localhost:8000/` with the preview tools, and reload it after each change.
3. Fallback when the preview can't be seen: the published page, https://europa-hackathons.github.io/harleys-team/, updates about a minute after each save.

## Record keeper

The Helper sends one record keeper after each delivered change. Run only one at a time; if another record keeper is still running, the next one waits and picks up all the changes since then.

The brief includes: a one-line English summary of the wish, how it was understood, what was decided and why, any flags (content redirect, Big Change parked), and the open Wish Record number when the wish chains onto an earlier one.

1. `git add -A`, then `git commit` with an English message: `<Wish summary> (#<issue>)`, ending with the attribution line the system gives you.
2. `git pull --rebase`, then `git push` to `main`. GitHub Pages publishes from `main` automatically.
3. Write the **Wish Record**:
   - New wish: `gh issue create --label wish --title "<Wish summary>"` with the body below. During a rehearsal, also add `--label test-run`.
   - Chained wish: `gh issue comment <n>` with the same body sections for the new step.
   - When the Team moves on from that feature: `gh issue close <n>` after a final comment naming the commits.
4. Report back to the Helper in one line: commit hash, issue number, published or not.

Wish Record body:

```
**Wish (in English):** <what the Team asked for, translated, without names or personal details>
**How we understood it:** <interpretation, including guesses made for vague wishes>
**What we did:** <change, files touched>
**Decisions:** <choices the Team made, with options offered>
**Flags for the Grown-up:** <content redirects, Big Changes, known rough edges, or "none">
```

## Time Machine

To undo the latest wish: `git revert --no-edit <commit(s) for that wish>`, push, and comment on its Wish Record: "Reverted at the Team's request." Never rewrite history; a revert keeps the old version recoverable.

## Handover

1. Write `docs/session/handover.md` in English: the Helper's name, current phase, the wish list, open Wish Records, what's half-built, and anything the Grown-up flagged. No personal details.
2. Have the record keeper save it.
3. Start a new chat in this project with `t3_thread_launch`, prompting: "You are the Helper. Read AGENTS.md, then docs/session/handover.md, then greet the Team as <name> and carry on."
4. Put the new chat's link in the Grown-up Note so the Grown-up can click across.
