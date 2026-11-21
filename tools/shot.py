"""Screenshot a page of the game with headless Edge/Chrome, WebGL included. No packages needed.

Usage (the game server must be running; default port 8000, otherwise pass --port):
  python tools/shot.py                                   # the game's title screen -> shot.png in the temp folder
  python tools/shot.py --js "document.getElementById('play').click()" --wait 4000 --out C:/tmp/play.png
  python tools/shot.py --page "/tools/model-viewer.html?name=hero&anim=walk"

--js runs inside the page (after --delay ms) to click buttons or set up a moment worth checking.
--wait is how long the page runs before the picture is taken. Prints the PNG path, and any console
messages from the page (errors included) as lines starting with "console:".
Use this instead of the kids' preview tab: hidden preview tabs draw 3D scenes blank.
For checks that need the game running in real time (keys, music, camera), use tools/live.py.
"""
import argparse, os, subprocess, sys, tempfile, time, urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import browser  # noqa: E402  (the one safe way to start a browser)

def take(url, out, size, budget_ms):
    args = ["--hide-scrollbars", "--enable-logging=stderr", "--v=0", f"--window-size={size}",
            f"--virtual-time-budget={budget_ms}", f"--screenshot={out}", url]
    if os.path.exists(out):
        os.remove(out)
    with browser.Browser(args, seconds=120) as b:   # always closed, even if this script is killed
        try:
            _, err = b.proc.communicate(timeout=120)
        except subprocess.TimeoutExpired:
            sys.exit("Screenshot timed out after 120 s; the browser was stopped")
    for line in err.decode(errors="replace").splitlines():
        if ":CONSOLE" in line and "chrome-extension://" not in line and "localhost" in line:
            print("console: " + line.split("] ", 1)[-1], file=sys.stderr)
    if not os.path.isfile(out):
        sys.exit("Screenshot failed (is the server running?)")


def check_same_repo(port):
    """Warn when the server on this port isn't serving this copy of the repo (e.g. another team's game)."""
    import urllib.error, urllib.request, uuid
    root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
    name = f".shot-probe-{uuid.uuid4().hex}"
    probe = os.path.join(root, name)
    open(probe, "w").close()   # a file only this folder has; the right server can serve it back
    try:
        with urllib.request.urlopen(f"http://localhost:{port}/{name}", timeout=5) as r:
            r.read()
        same = True
    except urllib.error.HTTPError:
        same = False
    except Exception:
        same = None
    finally:
        for _ in range(20):   # Windows: the server may hold the file for a moment
            try:
                os.remove(probe)
                break
            except PermissionError:
                time.sleep(0.1)
    if same is None:
        sys.exit(f"Nothing is serving the game on port {port}. Start the game server (see docs/agents/environment.md) or pass --port.")
    if not same:
        print(f"warning: port {port} serves a different copy of the game than this folder; pass --port for this copy's server", file=sys.stderr)


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
    browser.sweep()
    direct = f"http://localhost:{a.port}{a.page}"
    check_same_repo(a.port)
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
