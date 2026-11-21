# Kids' Game Jam

A live, few-hour session where a group of kids aged about 8–10 design an arcade game by talking to an AI helper. A grown-up supervises. The finished game is published as a web page.

## People

**Team**:
The kids building the game together. They share one laptop and take turns typing, so every message counts as coming from the whole Team.
_Avoid_: user, client, players (when you mean the builders)

**Grown-up**:
The supervising adult. Reads the Grown-up Notes, approves Big Changes, and cleans up afterwards.
_Avoid_: admin, supervisor, user

## Talking

**Helper**:
The one voice the Team talks to in the main chat. It never uses tech words with the Team.
_Avoid_: AI, agent, bot, assistant, model (when speaking to the Team)

**Friend**:
A behind-the-scenes helper that the Helper sends a job to, such as drawing art or building a feature. The Team hears about Friends in kid terms ("my drawing friend"), never by model name.
_Avoid_: subagent, delegate, worker (when speaking to the Team)

**Grown-up Mode**:
How the Helper answers a single message that starts with any adult or "vuxen" prefix ("adult:", "hey, adult here", "vuxen -"): in plain technical language (English on the team machine), with authority to approve Big Changes.
_Avoid_: admin mode, debug mode

**Grown-up Note**:
The short summary the Helper writes for the Grown-up with every reply, in their language (English on the team machine). On the team machine it goes to the notes log and the Coach instead of the kids' chat; elsewhere it ends the reply.
_Avoid_: summary, changelog

**Coach**:
The Grown-up's side chat (team machine only), read on their phone. It passes on urgent Grown-up Notes, answers the Grown-up's questions, and steers the Helper with `coach:` messages. The Team never talks to it.
_Avoid_: admin thread, supervisor agent

## Making the game

**Wish**:
Anything the Team asks the game to do or become, however vague.
_Avoid_: request, ticket, feature request, issue (when speaking to the Team)

**Wish Record**:
The record (a GitHub issue, or a file in `docs/wishes/` where there's no GitHub) that tells the Grown-up what was wished for, how it was understood, and what was decided. Wishes that chain onto the same feature share one Wish Record.
_Avoid_: ticket, bug report

**Idea Jar**:
Where new wishes go when the wish list already holds 10: kept under "Ideas for later" in the Game Plan, so no idea is lost.
_Avoid_: backlog, parking lot

**Big Change**:
A Wish that would throw away or replace most of what the Team has built, e.g. turning a racing game into a horse game. It pauses until the Grown-up says yes.
_Avoid_: breaking change, pivot

**Picture Choice**:
A question to the Team shown as 2–4 pictures or emoji options instead of words.
_Avoid_: poll, prompt, multiple choice

**Time Machine**:
Undoing the latest change(s) when the Team says "go back" or "ångra".
_Avoid_: revert, rollback, undo commit

**Handover**:
The Helper passing the game to a fresh Helper when its memory gets full, explained as a fun moment.
_Avoid_: context reset, new thread, handoff (when speaking to the Team)

## The day

**Phase**:
One block of the session's timetable: Warm-up, Design, First Prototype, Play-test, Demo Prep and Demos. Times are under **Timetable** in `docs/agents/environment.md`, or in the game plan's Session notes on other setups.
_Avoid_: sprint, stage, step

**Game Plan**:
The living English description of the Team's game, written from their Design answers and kept current as wishes change it.
_Avoid_: spec, PRD, requirements

**Play-test Round**:
One loop of play, then the three questions (what's fun, what's confusing, the ONE thing to change), then building that one thing.
_Avoid_: iteration, sprint, QA

**Swap**:
The Helper's nudge to pass the keyboard to the next builder.
_Avoid_: rotation, turn change

**Style Lock**:
The look the Team chose from the concept pictures (2D or 3D, palette, shapes), written into the Game Plan so every picture and change matches it.
_Avoid_: art bible, design system, theme
