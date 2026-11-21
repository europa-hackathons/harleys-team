# Backstage

Everything the Team never sees: preview, saving, publishing, Wish Records, Time Machine and Handover. Records and commit messages are in the Grown-up's language (English on the team machine).

## Preview

How the Team sees the game depends on the setup: **Show the game** in `docs/agents/environment.md` (and **Preview on the team machine** there). Everywhere:

- **Hold the reload** while a Friend is mid-edit on files the game loads, so the Team never plays a half-built game; reload when the change lands.
- **Checking things yourself**: use `python tools/shot.py` (headless screenshot, WebGL included), never the Team's view.
- Saved changes also reach the published page (**Publishing** in `environment.md`) about a minute later.

## Record keeper

The Helper sends one record keeper after each delivered change. Run only one at a time; if another record keeper is still running, the next one waits.

The brief includes: the **exact list of files** the finished Friend reported, a one-line summary of the wish, how it was understood, what was decided and why, any flags (content redirect, Big Change parked), and the Wish Record number when the wish chains onto an earlier one (or "new"). Never a placeholder like `#A`.

1. **New wish?** Write its Wish Record first (step 6), so the commit can name its number.
2. Run `python tools/check.py`. If it fails, commit nothing: report its output to the Helper, who sends the fix to a Friend.
3. Stage **only the listed files**: `git add -- <files>`. Other Friends may be mid-edit in the same folder, so never `git add -A` or `git add .`. Leave anything unlisted alone and mention it in the report.
4. `git commit` with the message `<Wish summary> (#<number>)`, one wish per commit, ending with the attribution line the system gives you.
5. Push only as **Saving and publishing** in `docs/agents/environment.md` says (team machine: `git pull --rebase`, then `git push` to `main`); where no remote was confirmed, the commit stays local.
6. Write the **Wish Record** where **Wish Records** in `docs/agents/environment.md` says. With GitHub issues:
   - New wish: `gh issue create --label wish --title "<Wish summary>"` with the body below. During a rehearsal, also add `--label test-run`.
   - Chained wish: `gh issue comment <n>` with the same body sections for the new step.
   - Without GitHub: one file per wish, `docs/wishes/<NNN>-<short-name>.md` (numbered 001, 002, … in order), with the same body; append chained steps to it and mark it `Closed` at the top when done.
   - When the Team moves on from a feature, the Helper says so in the next brief: `gh issue close <n>` after a final comment naming the commits. A feature is never left open once the Team has moved on.
**Design saves**: the game plan, concept pictures and mockups aren't wishes, so they get a plain commit with no Wish Record (`Design: <what was decided>`), sent by the Helper when Design ends and whenever the Style is locked.

7. Report back to the Helper in one line: commit hash, issue number, published or not, and any unlisted changed files you saw.

Wish Record body:

```
**Wish (in English):** <what the Team asked for, translated, without names or personal details>
**How we understood it:** <interpretation, including guesses made for vague wishes>
**What we did:** <change, files touched>
**Decisions:** <choices the Team made, with options offered>
**Flags for the Grown-up:** <content redirects, Big Changes, credits spent, known rough edges, or "none">
```

## Time Machine

To undo the latest wish: `git revert --no-edit <commit(s) for that wish>`, push only where **Saving and publishing** allows, and add "Reverted at the Team's request." to its Wish Record (an issue comment, or a line appended to its file). Never rewrite history; a revert keeps the old version recoverable.

## Handover

1. Write `docs/session/handover.md` in English: the Helper's name, current phase, the wish list, open Wish Records, what's half-built, anything the Grown-up flagged, and the Coach's thread id if there is one. No personal details.
2. Have the record keeper save it.
3. Start a new chat as **Handover** in `docs/agents/environment.md` says, prompting: "You are the Helper. Read AGENTS.md, then docs/session/handover.md, then greet the Team as <name> and carry on."
4. Put the new chat's link (or what to do) in the Grown-up Note so the Grown-up can switch across. With a Coach, send it there: `helper: handover, new kids' thread <link>`.
