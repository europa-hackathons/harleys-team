"""Append a Grown-up Note to the notes log, so it stays out of the Team's chat.

Usage:
  python tools/note.py "Racing track built; record keeper saving it"
  python tools/note.py --flag "Big Change parked: horse game, waiting for a yes"
  python tools/note.py --show        # print the log (the Coach reads it this way)

The log is .grownup/notes.md at the repo root (git-ignored, stays on this computer).
Each line is "HH:MM  text"; --flag marks it with a warning sign.
"""
import argparse
import sys
from datetime import datetime
from pathlib import Path

LOG = Path(__file__).resolve().parent.parent / ".grownup" / "notes.md"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("text", nargs="?", help="the note, in the Grown-up's language")
    ap.add_argument("--flag", action="store_true", help="something needs the Grown-up")
    ap.add_argument("--show", action="store_true", help="print the log and exit")
    args = ap.parse_args()

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    if args.show:
        print(LOG.read_text(encoding="utf-8") if LOG.exists() else "(no notes yet)")
        return
    if not args.text:
        ap.error("give the note text, or --show")

    LOG.parent.mkdir(exist_ok=True)
    if not LOG.exists():
        LOG.write_text(f"# Grown-up notes, {datetime.now():%Y-%m-%d}\n\n", encoding="utf-8")
    line = f"- {datetime.now():%H:%M}  {'⚠️ ' if args.flag else ''}{args.text.strip()}\n"
    with LOG.open("a", encoding="utf-8") as f:
        f.write(line)
    print(f"noted in {LOG}")


if __name__ == "__main__":
    main()
