"""Report what this machine can do for the game jam. Changes nothing.

Usage (from the repo root):  python tools/doctor.py

Tells an agent which column of docs/agents/environment.md applies and which fallbacks to use.
"""
import os, shutil, socket, subprocess, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
TEAM_REPO = "europa-hackathons/harleys-team"
BROWSERS = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "msedge", "chrome", "google-chrome", "chromium", "chromium-browser",
]


def run(cmd):
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=20, cwd=ROOT)
        return r.returncode, (r.stdout + r.stderr).strip()
    except (OSError, subprocess.TimeoutExpired) as e:
        return 1, str(e)


def line(ok, name, detail):
    print(f"  {'OK ' if ok else '-- '} {name:<19} {detail}")


def main():
    team = os.path.isfile(os.path.join(ROOT, ".team-machine"))
    print("Game jam doctor\n")
    print(f"Machine: {'TEAM MACHINE: use the Team machine column' if team else 'NOT the team machine: use the Everywhere else column and read docs/agents/setup.md'}\n")

    line(True, "Python", sys.version.split()[0])
    try:
        import PIL  # noqa: F401
        line(True, "Pillow", "installed")
    except ImportError:
        line(False, "Pillow", "missing (only needed for 3D model tools)")

    browser = next((b for b in BROWSERS if (os.path.isfile(b) or shutil.which(b))), None)
    line(bool(browser), "Headless browser", browser or "none: tools/shot.py won't work; ask the human to look instead")

    code, remote = run(["git", "remote", "get-url", "origin"])
    remote = remote if code == 0 else "(no remote)"
    line(code == 0, "Git remote", remote)
    if not team and code == 0:
        if TEAM_REPO in remote:
            print("       ! This remote is the original team's repo. Don't push or file issues there; use your own repo or work locally.")
        elif "://" not in remote and "@" not in remote:
            print("       ! This remote is a folder on this computer, not an online repo. Commit locally; don't push to it.")

    gh = shutil.which("gh")
    if gh:
        code, out = run(["gh", "auth", "status"])
        line(code == 0, "GitHub CLI", "logged in" if code == 0 else "installed but not logged in")
    else:
        line(False, "GitHub CLI", "missing: keep Wish Records as files in docs/wishes/")

    def free(port):
        with socket.socket() as sock:
            return sock.connect_ex(("127.0.0.1", port)) != 0
    if free(8000):
        line(True, "Game port", "8000 is free: serve the game there")
    elif team:
        line(True, "Game port", "8000 in use: at a session start, stop it and start the game server fresh (environment.md)")
    else:
        spare = next(p for p in range(8001, 8100) if free(p))
        line(False, "Game port", f"8000 is taken by something else: serve the game on {spare} and use tools/shot.py --port {spare}")

    tripo = team and bool(os.environ.get("TRIPO_API_KEY"))
    line(tripo, "3D models (Tripo)", "on" if tripo else "off: build models from simple shapes")

    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from elevenlabs_audio import find_key
    sounds = team and bool(find_key())
    line(sounds, "Sounds (ElevenLabs)", "on" if sounds else "off: simple beeps made in code at most")


if __name__ == "__main__":
    main()
