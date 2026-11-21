# Agents start browsers only through our tools, which always close them

Agents check the game in a hidden browser: `tools/shot.py` for a picture, `tools/live.py` for anything that needs the game running in real time (key presses, music, game state over time, the fake camera). Both start the browser through `tools/browser.py`, and no agent launches a browser any other way.

On 2026-11-21 building Friends wrote their own one-off scripts that started headless Edge over the DevTools protocol, as the webcam doc then suggested. Those scripts closed Edge only when everything went right, so every failed or timed-out check left a browser drawing the game in software, forever. After an afternoon dozens were running, the machine froze until even tiny commands timed out, and it had to be switched off, which also damaged the disk.

`tools/browser.py` makes cleanup the operating system's job instead of the agent's. On Windows the tool joins a job object that kills every child process when the tool exits, however it exits; on Linux the browser gets a parent-death signal; everywhere it runs in its own process group with a hard time limit (at most 5 minutes). The tools and `tools/doctor.py` also sweep away leftover check browsers (headless or debug-port browsers on a temp profile, older than 10 minutes) and stale temp profiles, so a leak from anything else can't build up either.

We stayed with the Edge or Chrome already on the machine rather than Playwright: it needs no install on a fresh clone, and the leak came from nobody closing the browser, not from the browser.
