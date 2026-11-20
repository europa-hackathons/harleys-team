"""Screenshot a page of the game with headless Edge/Chrome, WebGL included. No packages needed.

Usage (the preview server must be running on http://localhost:8000):
  python tools/shot.py                                   # the game's title screen -> shot.png in the temp folder
  python tools/shot.py --js "document.getElementById('play').click()" --wait 4000 --out C:/tmp/play.png
  python tools/shot.py --page "/tools/model-viewer.html?name=hero&anim=walk"

--js runs inside the page (after --delay ms) to click buttons or set up a moment worth checking.
--wait is how long the page runs before the picture is taken. Prints the PNG path, and any console
messages from the page (errors included) as lines starting with "console:".
Use this instead of the kids' preview tab: hidden preview tabs draw 3D scenes blank.
"""
import argparse, os, shutil, subprocess, sys, tempfile, urllib.parse

BROWSERS = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    "msedge", "chrome", "google-chrome", "chromium",
]


def browser():
    for b in BROWSERS:
        path = b if os.path.isfile(b) else shutil.which(b)
        if path:
            return path
    sys.exit("No Edge or Chrome found for headless screenshots")


def take(url, out, size, budget_ms):
    profile = tempfile.mkdtemp(prefix="shot-")
    cmd = [browser(), "--headless=new", f"--user-data-dir={profile}", "--hide-scrollbars", "--mute-audio",
           "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist",
           "--enable-logging=stderr", "--v=0", f"--window-size={size}", f"--virtual-time-budget={budget_ms}", f"--screenshot={out}", url]
    # Git Bash leaks variables (e.g. __COMPAT_LAYER, MSYSTEM, HOME) that make Edge exit silently.
    env = {k: v for k, v in os.environ.items() if not k.startswith(("MSYS", "MINGW", "__COMPAT", "EXEPATH", "SHELL",
                                                                      "TERM", "SHLVL", "OLDPWD", "PWD", "_"))
           and k not in ("HOME",)}
    if os.path.exists(out):
        os.remove(out)
    try:
        run = subprocess.run(cmd, check=True, capture_output=True, timeout=120, env=env)
        for line in run.stderr.decode(errors="replace").splitlines():
            if ":CONSOLE" in line and "chrome-extension://" not in line and "localhost" in line:
                print("console: " + line.split("] ", 1)[-1], file=sys.stderr)
    finally:
        shutil.rmtree(profile, ignore_errors=True)
    if not os.path.isfile(out):
        sys.exit("Screenshot failed (is the server running?)")


def blank(path):
    try:
        from PIL import Image
    except ImportError:
        return False
    return Image.open(path).convert("RGB").getextrema() == ((0, 0), (0, 0), (0, 0))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--page", default="/", help="path on the local server (default: the game)")
    ap.add_argument("--js", help="code to run inside the page before the picture")
    ap.add_argument("--delay", type=int, default=800, help="ms after load before --js runs (default 800)")
    ap.add_argument("--wait", type=int, default=3000, help="ms the page runs before the picture (default 3000)")
    ap.add_argument("--size", default="1280,800", help="window size (default 1280,800)")
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--out", default=os.path.join(tempfile.gettempdir(), "shot.png"))
    a = ap.parse_args()

    out = os.path.abspath(a.out)
    direct = f"http://localhost:{a.port}{a.page}"
    if a.js:
        query = {"page": a.page, "delay": a.delay, "js": a.js}
        url = f"http://localhost:{a.port}/tools/shot-frame.html?" + urllib.parse.urlencode(query)
        take(url, out, a.size, a.wait + a.delay)
        if blank(out):   # some WebGL pages don't paint inside the frame in headless mode
            print("warning: the --js shot came out blank; this is the page without --js instead", file=sys.stderr)
            take(direct, out, a.size, a.wait + a.delay)
    else:
        take(direct, out, a.size, a.wait)
    print(out)


if __name__ == "__main__":
    main()
