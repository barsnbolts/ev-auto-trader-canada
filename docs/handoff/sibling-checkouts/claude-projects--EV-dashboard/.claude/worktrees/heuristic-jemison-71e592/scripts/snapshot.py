#!/usr/bin/env python3
"""snapshot.py — milestone screenshot archive (I-10).

Saves a screenshot of the running dev server (if reachable) to
`screenshots/<id>-<YYYYMMDD>.png` and appends a one-line entry to
`screenshots/index.md`.

This is a Bash-side helper that delegates the actual capture to whatever is
available locally:
  1. `Chrome.app` via AppleScript + screencapture (macOS only) — preferred,
     no external deps.
  2. `chromium` / `google-chrome` headless `--screenshot=` — fallback.
  3. Skip silently with a logged note if neither is present.

The Claude-in-Chrome MCP would also work but requires me (the agent) to drive
it from a running session — this script is for autonomous milestone runs that
need to function with no live agent attention.

Usage:
    python3 scripts/snapshot.py --milestone-id D-04-batch1
    python3 scripts/snapshot.py --milestone-id F-09 --url http://localhost:5173/
    python3 scripts/snapshot.py --quiet-on-skip   # don't print the skip note
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SHOTS_DIR = ROOT / "screenshots"
INDEX = SHOTS_DIR / "index.md"

DEFAULT_URL = "http://localhost:5173/"
DEFAULT_TIMEOUT = 5  # seconds


def server_reachable(url: str, timeout: int = DEFAULT_TIMEOUT) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            return 200 <= resp.status < 400
    except (urllib.error.URLError, ConnectionError, TimeoutError):
        return False
    except Exception:
        return False


def capture_with_chromium(url: str, out_path: Path) -> bool:
    for name in ("chromium", "google-chrome", "google-chrome-stable",
                 "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
                 "/Applications/Chromium.app/Contents/MacOS/Chromium"):
        bin_ = shutil.which(name) or (name if Path(name).exists() else None)
        if not bin_:
            continue
        try:
            res = subprocess.run(
                [bin_, "--headless=new", "--no-sandbox", "--disable-gpu",
                 "--hide-scrollbars",
                 f"--screenshot={out_path}", "--window-size=1440,900", url],
                capture_output=True, text=True, timeout=30,
            )
            if res.returncode == 0 and out_path.exists() and out_path.stat().st_size > 1000:
                return True
        except Exception:
            continue
    return False


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--milestone-id", default="snap")
    ap.add_argument("--url", default=DEFAULT_URL)
    ap.add_argument("--quiet-on-skip", action="store_true")
    args = ap.parse_args(argv[1:])

    if not server_reachable(args.url):
        if not args.quiet_on_skip:
            print(f"  → snapshot.py: dev server not reachable at {args.url}; skipping (non-fatal)")
        return 0

    SHOTS_DIR.mkdir(parents=True, exist_ok=True)
    today = date.today().isoformat().replace("-", "")
    out_path = SHOTS_DIR / f"{args.milestone_id}-{today}.png"

    ok = capture_with_chromium(args.url, out_path)
    if not ok:
        if not args.quiet_on_skip:
            print(f"  → snapshot.py: no headless Chrome/Chromium found; skipping (non-fatal)")
        return 0

    # Append to index
    line = f"- `{args.milestone_id}` ({date.today().isoformat()}) — `{out_path.relative_to(ROOT)}`\n"
    if INDEX.exists():
        INDEX.write_text(INDEX.read_text(encoding="utf-8") + line, encoding="utf-8")
    else:
        INDEX.write_text("# Screenshot archive\n\n*Auto-appended by `scripts/snapshot.py` (milestone step 15).*\n\n" + line, encoding="utf-8")
    print(f"  → snapshot.py: {out_path.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
