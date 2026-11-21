"""Play the game for real in a hidden browser and read what happened. No packages needed.

For checks a single screenshot can't do: music timing, keys pressed in order, game state after a
few seconds, the fake camera. The browser always closes when this ends (see tools/browser.py),
and the whole run is capped at --max seconds. Never launch a browser yourself; use this.

Usage (the game server must be running; default port 8000, otherwise pass --port):
  python tools/live.py --step 1000 "document.getElementById('play').click()" \\
                       --step 3000 "({state: game.state, round: game.round})" --shot C:/tmp/fight.png
  python tools/live.py --camera --step 4000 "window.game?.state"

--step MS JS   wait MS milliseconds of real time, then run JS in the page and print its value.
               Repeat for a sequence. An async JS value (a Promise) is awaited.
--camera       a fake camera and microphone (moving test pattern, a tone). Opens a visible window,
               because headless browsers refuse fake devices.
Prints one JSON object: each step's value, page errors, console messages, and the screenshot path.
Exit code 1 if the page threw an error or a step failed.
"""
import argparse, base64, json, os, socket, struct, sys, tempfile, time, urllib.parse, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import browser  # noqa: E402


class Socket:
    """A minimal WebSocket client, enough for the browser's DevTools protocol on localhost."""

    def __init__(self, url, timeout):
        u = urllib.parse.urlparse(url)
        self.s = socket.create_connection((u.hostname, u.port), timeout=timeout)
        key = base64.b64encode(os.urandom(16)).decode()
        self.s.sendall((f"GET {u.path} HTTP/1.1\r\nHost: {u.hostname}:{u.port}\r\nUpgrade: websocket\r\n"
                        f"Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n").encode())
        head = b""
        while b"\r\n\r\n" not in head:
            chunk = self.s.recv(1)
            if not chunk:
                raise ConnectionError("browser closed the DevTools connection")
            head += chunk
        if b" 101 " not in head.split(b"\r\n")[0]:
            raise ConnectionError(head.decode(errors="replace").splitlines()[0])

    def _read(self, n):
        buf = b""
        while len(buf) < n:
            chunk = self.s.recv(n - len(buf))
            if not chunk:
                raise ConnectionError("browser closed the DevTools connection")
            buf += chunk
        return buf

    def send(self, text, opcode=1):
        data = text.encode() if isinstance(text, str) else text
        n = len(data)
        head = bytes([0x80 | opcode]) + (bytes([0x80 | n]) if n < 126 else
                                         bytes([0x80 | 126]) + struct.pack(">H", n) if n < 65536 else
                                         bytes([0x80 | 127]) + struct.pack(">Q", n))
        mask = os.urandom(4)
        self.s.sendall(head + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))

    def recv(self):
        parts = []
        while True:
            b0, b1 = self._read(2)
            n = b1 & 0x7F
            if n == 126:
                n = struct.unpack(">H", self._read(2))[0]
            elif n == 127:
                n = struct.unpack(">Q", self._read(8))[0]
            mask = self._read(4) if b1 & 0x80 else None
            data = self._read(n)
            if mask:
                data = bytes(b ^ mask[i % 4] for i, b in enumerate(data))
            op = b0 & 0x0F
            if op == 8:
                raise ConnectionError("browser closed the DevTools connection")
            if op == 9:
                self.send(data, opcode=10)
                continue
            if op in (0, 1, 2):
                parts.append(data)
                if b0 & 0x80:
                    return b"".join(parts).decode(errors="replace")


class Page:
    def __init__(self, ws):
        self.ws, self.next_id, self.errors, self.console = ws, 0, [], []

    def call(self, method, **params):
        self.next_id += 1
        self.ws.send(json.dumps({"id": self.next_id, "method": method, "params": params}))
        while True:
            msg = json.loads(self.ws.recv())
            if msg.get("id") == self.next_id:
                if "error" in msg:
                    raise RuntimeError(f"{method}: {msg['error'].get('message')}")
                return msg.get("result", {})
            self._event(msg)

    def _event(self, msg):
        m, p = msg.get("method"), msg.get("params", {})
        if m == "Runtime.exceptionThrown":
            d = p.get("exceptionDetails", {})
            self.errors.append((d.get("exception") or {}).get("description") or d.get("text", "error"))
        elif m == "Runtime.consoleAPICalled":
            text = " ".join(str(a.get("value", a.get("description", ""))) for a in p.get("args", []))
            (self.errors if p.get("type") == "error" else self.console).append(text[:500])

    def pump(self, seconds):
        """Let the page run for real time, collecting console messages and errors meanwhile."""
        end = time.time() + seconds
        while (left := end - time.time()) > 0:
            self.ws.s.settimeout(left)
            try:
                self._event(json.loads(self.ws.recv()))
            except (socket.timeout, TimeoutError):
                break
        self.ws.s.settimeout(30)

    def eval(self, js):
        r = self.call("Runtime.evaluate", expression=js, awaitPromise=True, returnByValue=True)
        if "exceptionDetails" in r:
            d = r["exceptionDetails"]
            raise RuntimeError((d.get("exception") or {}).get("description") or d.get("text", "error"))
        return r.get("result", {}).get("value")


def devtools_url(profile, deadline):
    port_file = os.path.join(profile, "DevToolsActivePort")
    while time.time() < deadline:
        try:
            port = int(open(port_file).read().split()[0])
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/json/list", timeout=5) as r:
                pages = [t for t in json.load(r) if t.get("type") == "page"]
            if pages:
                return pages[0]["webSocketDebuggerUrl"]
        except (OSError, ValueError, IndexError):
            pass
        time.sleep(0.2)
    raise TimeoutError("the browser didn't start in time")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--page", default="/", help="path on the local server (default: the game)")
    ap.add_argument("--step", nargs=2, action="append", default=[], metavar=("MS", "JS"))
    ap.add_argument("--shot", help="save a screenshot at the end to this PNG path")
    ap.add_argument("--camera", action="store_true", help="fake camera + mic (visible window)")
    ap.add_argument("--size", default="1280,800")
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--max", type=int, default=90, help=f"hard limit in seconds for the whole run (max {browser.MAX_SECONDS})")
    a = ap.parse_args()

    browser.sweep()
    url = f"http://localhost:{a.port}{a.page}"
    try:
        urllib.request.urlopen(url, timeout=5).close()
    except OSError:
        sys.exit(f"Nothing is serving the game at {url}. Start the game server (see docs/agents/environment.md) or pass --port.")

    args = ["--remote-debugging-port=0", f"--window-size={a.size}", "--autoplay-policy=no-user-gesture-required",
            "--disable-renderer-backgrounding", "--disable-background-timer-throttling",
            "--disable-backgrounding-occluded-windows", "about:blank"]
    if a.camera:
        args[:0] = ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--window-position=0,0"]
    report, failed = {"page": url, "steps": []}, False
    deadline = time.time() + min(a.max, browser.MAX_SECONDS) - 5
    with browser.Browser(args, seconds=a.max, headless=not a.camera) as b:
        ws = Socket(devtools_url(b.profile, min(deadline, time.time() + 30)), timeout=30)
        page = Page(ws)
        page.call("Runtime.enable")
        page.call("Page.enable")
        page.call("Page.navigate", url=url)
        while time.time() < deadline and page.eval("document.readyState") != "complete":
            page.pump(0.2)
        for ms, js in a.step:
            page.pump(min(int(ms) / 1000, max(0, deadline - time.time())))
            if time.time() >= deadline:
                report["steps"].append({"js": js, "error": "skipped: --max reached"})
                failed = True
                break
            try:
                report["steps"].append({"js": js, "value": page.eval(js)})
            except RuntimeError as e:
                report["steps"].append({"js": js, "error": str(e)})
                failed = True
        if a.shot:
            out = os.path.abspath(a.shot)
            with open(out, "wb") as f:
                f.write(base64.b64decode(page.call("Page.captureScreenshot", format="png")["data"]))
            report["screenshot"] = out
        page.pump(0.2)
        report["errors"], report["console"] = page.errors, page.console[-30:]
    print(json.dumps(report, indent=2, ensure_ascii=False))
    sys.exit(1 if failed or page.errors else 0)


if __name__ == "__main__":
    main()
