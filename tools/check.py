"""Fast checks on the game code. No packages needed. Exit code 1 if anything fails.

Usage:
  python tools/check.py

Checks, over index.html and every .js file under src/:
  1. Syntax: each .js file parsed as an ES module by Node (skipped with a note if Node isn't installed).
  2. Renderer: no bare `WebGLRenderer` outside src/kit/. Use `makeRenderer` from
     src/kit/renderer.js, which survives a preview tab that opens hidden.
  3. Imports: no http(s) imports in src/. three.js comes only through the import map
     in index.html (docs/adr/0002-no-build-static-site.md).
"""
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
KIT = SRC / "kit"

RENDERER = re.compile(r"\bWebGLRenderer\s*\(")
URL_IMPORT = re.compile(r"""(?:\bfrom\s*|\bimport\s*\(?\s*)['"]https?://""")


def rel(p):
    return p.relative_to(ROOT).as_posix()


def main():
    problems = []
    js_files = sorted(SRC.rglob("*.js"))

    node = shutil.which("node")
    if node:
        for f in js_files:
            # Plain `node --check file.js` passes broken ES modules, so check as a module on stdin.
            with f.open("rb") as src:
                r = subprocess.run([node, "--input-type=module", "--check"], stdin=src, capture_output=True, text=True)
            if r.returncode != 0:
                lines = r.stderr.splitlines()
                where = next((l.split(":", 1)[1] for l in lines if l.startswith("[stdin]:")), "?")
                what = next((l for l in lines if "Error" in l), r.stderr.strip()[:200])
                problems.append(f"{rel(f)}:{where}: {what}")
    else:
        print("note: Node not found, syntax check skipped")

    for f in js_files + [ROOT / "index.html"]:
        if not f.exists():
            continue
        in_kit = KIT in f.parents
        for n, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
            if not in_kit and RENDERER.search(line):
                problems.append(f"{rel(f)}:{n}: bare WebGLRenderer; use makeRenderer from src/kit/renderer.js")
            if f.suffix == ".js" and URL_IMPORT.search(line):
                problems.append(f"{rel(f)}:{n}: imports from a URL; use the import map in index.html")

    for p in problems:
        print(p)
    print(f"{'FAIL' if problems else 'ok'}: {len(js_files)} files checked, {len(problems)} problem(s)")
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
