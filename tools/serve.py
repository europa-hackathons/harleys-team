"""Serve the game folder with caching turned off. No packages needed.

Usage:
  python tools/serve.py          # http://localhost:8000
  python tools/serve.py 8010     # another port

Like `python -m http.server`, but every response says `Cache-Control: no-store`,
so a page reload in the preview always picks up the newest CSS and JS files.
It always serves the repo root, whatever folder you run it from.
"""
import functools
import http.server
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class NoStoreHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    handler = functools.partial(NoStoreHandler, directory=str(ROOT))
    # Same binding and dual-stack setup as `python -m http.server`.
    http.server.test(HandlerClass=handler, ServerClass=http.server.ThreadingHTTPServer, port=port)


if __name__ == "__main__":
    main()
