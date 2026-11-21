# Environment

The only file that says *how* this setup does things. The playbooks (`helper.md`, `backstage.md`) say *what* to do and point here for the how.

## Which column applies to you?

- **Team machine**: a file named `.team-machine` exists at the repo root. It is git-ignored and exists only on the original team's desktop. Use the **Team machine** column.
- **Anyone else** (a clone, another team's laptop): use the **Everywhere else** column, and read `docs/agents/setup.md` once before your first reply.

### The team machine's setup

The desktop runs T3 Code and holds the repo; every agent, tool, file and server runs there ("this computer" means the desktop). Nobody sits at it:

- **The Team** types on a laptop connected to the desktop with T3 Connect. They see the kids' thread and the preview pane there, and play webcam games on that laptop's camera.
- **The Grown-up** uses the T3 mobile app, connected to the desktop over the tailnet, mostly for the Coach thread (**Grown-up Notes on the team machine**).

All three show the same T3 threads, so any new thread (the Coach, a Handover chat, Friends' threads) also appears in the laptop's thread list.

## Capabilities

| Capability | Team machine | Everywhere else |
|---|---|---|
| **Friends** (helpers that do the work) | T3 Code `delegate_task`, targets below | Your own subagent tool if you have one (Claude Code `Agent`, Codex `spawn_agent`), with the same roles and brief template, on a fast model at moderate effort (a live room can't wait 10 minutes). None? Do the work yourself, one small visible step at a time. |
| **Drawing Friend** (concept pictures, look checks) | GPT Astra via `delegate_task` | Any image-generation tool you have. None? A building Friend makes a quick mockup page in the game's style at `assets/concepts/mockups/<name>.html` and screenshots it with `tools/shot.py --page /assets/concepts/mockups/<name>.html` into `assets/concepts/<name>.png`; that picture is the concept, and look checks compare screenshots with it the same way. |
| **Show the game** | T3 preview pane; see **Preview on the team machine** | Serve the repo on the first free port from 8000 up (`tools/doctor.py` says whether 8000 is taken; then `python tools/serve.py 8001`) with the longest background time limit your harness allows, and have the human open it in their browser. Pass the same port to `tools/shot.py --port`. |
| **Picture Choice** | `AskUserQuestion` question cards | A numbered emoji list the kids can answer with a number. |
| **Screenshots for checks** | `python tools/shot.py` (Edge); real-time checks with `python tools/live.py` | Same scripts; they also find Chrome/Chromium. No browser? Ask the human to look. Never launch a browser any other way. |
| **Fancier 3D models** | Tripo via `tools/tripo_model.py`; steps in `docs/agents/models-3d.md` | **Off**, even if your harness shows Tripo or 3D-model tools. The key is personal to the team machine. Build models from simple shapes; never ask anyone for a Tripo key. |
| **Sounds and music** | ElevenLabs via `tools/elevenlabs_audio.py`; steps and the Grown-up's rules in `docs/agents/sounds.md`. The Grown-up listens through Markdown links to the absolute file path (the result's `path`), e.g. `[🔊 tank-shot](C:/Users/<you>/Projects/harleys-team/assets/audio/tank-shot.mp3)`: T3 opens them, also on the Grown-up's phone. Never link `localhost`. | **Off**, even if your harness shows ElevenLabs or audio tools. The key is personal to the team machine; never ask anyone for one. If the Team wants sound, a building Friend can make simple beeps in code (Web Audio oscillators), never spoken words. |
| **Wish Records** | GitHub issues on `europa-hackathons/harleys-team` via `gh` | Issues on the repo the human confirmed as theirs in setup; otherwise markdown files in `docs/wishes/`. Never file issues in `europa-hackathons/harleys-team` unless that is your team. |
| **Saving and publishing** | Commit and push `main` to `origin`; GitHub Pages publishes https://europa-hackathons.github.io/harleys-team/ | Commit locally. Push only to a remote the human confirmed as theirs in setup (then their GitHub Pages, if they use it). Never push to `europa-hackathons/harleys-team` or to a remote that's a folder on this computer. |
| **Clock** | `Get-Date -Format HH:mm` (PowerShell) | `date +%H:%M` or your platform's equivalent. |
| **Session timetable** | Europa-Hack, see **Timetable** | Ask the human for theirs. With only an end time, split what's left roughly: Design 10 %, First prototype 25 %, Play-test until 15 minutes before the end, then Demo prep. With nothing at all: Warm-up, Design, First prototype, Play-test in order. |
| **Languages** | Kids in Swedish or English; Grown-up notes and records in English | Mirror the kids' language; Grown-up notes and records in the human's language (English if unsure). Code, comments and file names stay English everywhere. |
| **Grown-up Notes** | Out of the kids' chat: the notes log plus the Coach thread; see **Grown-up Notes on the team machine** | The last lines of every reply, as `helper.md` shows. |
| **Handover** | `t3_thread_launch` a new chat; its link goes to the Coach | Write `docs/session/handover.md` and ask the human to start a fresh chat pointing at it. |

## Friends on the team machine

Use exactly these `delegate_task` targets (no need to look them up); higher effort is far too slow for a live room:

| Friend | `target` |
|---|---|
| **Building Friend** | `{ providerInstanceId: "claudeAgent", model: "claude-opus-5-5", options: { effort: "medium" } }` |
| **Drawing Friend** | `{ providerInstanceId: "codex", model: "gpt-6.2-astra", options: { reasoningEffort: "low" } }` |
| **Record keeper** | `{ providerInstanceId: "claudeAgent", model: "claude-sonnet-5-5", options: { effort: "low" } }` |

## Preview on the team machine

Port 8000 belongs to the Helper's one server.

1. **Reset the server at the start of every session**, before anything else: whatever is listening on port 8000 is left over from an earlier chat (often serving a different folder), so always stop it first, in PowerShell:
   `Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -Confirm:$false }`
   Then start `python tools/serve.py` (port 8000, no caching, always serves the repo root) as a background command with the maximum time limit (`timeout: 7200000`, 2 hours). A default background command is stopped after 30 minutes and the Team's game disappears; restart it the same way if it stops.
2. **Show the game** from Warm-up on (the starter screen invites the Team to design): `preview_open` with `target: { kind: "environment-port", port: 8000 }`, visible (this is how it reaches the Team's laptop).
3. **Reload** after a change lands: `preview_evaluate` with `location.reload()` on the open tab. Calling `preview_open` again with the same URL does *not* reload it, and a `?v=` on the page URL refreshes nothing the page loads.
4. **Tab check**, after every open or reload; the preview counts as showing the change only once it passes. Wait about 2 s, then `preview_evaluate`: `({ state: window.game?.state, errors: window.pageErrors })`. Passing: `errors` is an empty list and `state` is set (the starter shows `'title'`). `tools/shot.py` can't stand in for this: its fresh, visible headless browser never sees the preview's problems.
5. **When the game window is gone** (closed, or "it went away"): open a fresh tab with `reuseExistingTab: false`, then close the old one with `t3_preview_close`. Reusing the old tab doesn't bring it back. A new tab loads hidden, where WebGL can't start; games that make their renderer with the kit's `makeRenderer` wait for the tab to show. Run the tab check.

## Grown-up Notes on the team machine

The Grown-up reads notes in a separate **Coach** thread on their phone, so the kids' chat has no Grown-up Note lines at all. The Coach thread is listed on the Team's laptop too, so nothing in it may be unfit for kids to read.

1. **Start the Coach** at the start of every session, right after the game server: `t3_thread_list` (its `currentThreadId` is your own thread id), then `t3_thread_launch` with title `🧑‍🏫 Coach`, `modelSelection: { instanceId: "claudeAgent", model: "claude-sonnet-5-5", options: { effort: "medium" } }` (if that's refused, leave `modelSelection` out), and the message: "You are the Coach. Read AGENTS.md, then docs/agents/coach.md. Kids' thread: <your thread id>." Keep the Coach's thread id for this session. After a Handover, the new Helper reuses the Coach from `docs/session/handover.md` instead of starting another.
2. **Every Grown-up Note** (the gist of what changed or is running) goes to the notes log: `python tools/note.py "<note>"`. Add `--flag` for a ⚠️ line. This costs nothing and wakes nobody.
3. **Also send to the Coach**, with `t3_thread_send` (`mode: "auto"`), one line starting `helper:`, for: every ⚠️ line, every new or held-back sound link, a Handover's new chat link, and your answer to each `coach:` message. Routine notes go only to the log.
4. **`coach:` messages** in your chat come from the Grown-up through the Coach: see **Grown-up Mode** in `helper.md`.

## Timetable

Europa-Hack, team machine:

| Time | Phase |
|---|---|
| before 14:20 | Warm-up |
| 14:20–14:35 | Design |
| 14:35–15:15 | First prototype |
| 15:15–16:15 | Play-test |
| 16:15–16:30 | Demo prep |
| 16:30–17:00 | Demos |
