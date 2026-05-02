#!/usr/bin/env python3
"""detect_level.py — read the active Claude Code model + effort.

Discovery: Claude Desktop writes per-session JSON to
  ~/Library/Application Support/Claude/claude-code-sessions/<host>/<plugin>/local_*.json

Each file holds top-level keys including:
  - cliSessionId    (matches ~/.claude/sessions/<pid>.json sessionId)
  - cwd / worktreePath / branch
  - model           (e.g. "claude-opus-4-7[1m]")
  - effort          (e.g. "low" / "medium" / "high" / "xhigh" / "max")
  - lastActivityAt  (ms timestamp)

This script picks the most-recently-active session whose worktreePath or cwd
matches the current repo root, and prints model + effort.

Usage:
  python3 scripts/detect_level.py            # human-readable
  python3 scripts/detect_level.py --json     # machine-readable
  python3 scripts/detect_level.py --quiet    # just "model effort" on one line

Exit codes:
  0  = found
  2  = no matching session (UI may have closed or never opened a CLI for this cwd)
"""

from __future__ import annotations

import argparse
import datetime as dt
import glob
import json
import os
import sys
from pathlib import Path

HOME = Path(os.environ.get("HOME", "~")).expanduser()
SESSIONS_GLOB = (
    HOME
    / "Library"
    / "Application Support"
    / "Claude"
    / "claude-code-sessions"
    / "*"
    / "*"
    / "*.json"
)


def repo_root() -> Path:
    """Walk up until we find a .git, package.json, or Cargo.toml."""
    p = Path.cwd().resolve()
    for _ in range(8):
        if (p / ".git").exists() or (p / "package.json").exists():
            return p
        if not p.parent or p.parent == p:
            break
        p = p.parent
    return Path.cwd().resolve()


def load_session(path: Path) -> dict | None:
    try:
        with path.open("r", encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, json.JSONDecodeError):
        return None


def matches_cwd(session: dict, root: Path) -> bool:
    candidates = [session.get("cwd"), session.get("worktreePath"), session.get("originCwd")]
    root_str = str(root)
    for c in candidates:
        if not c:
            continue
        # Match if either the session cwd is the repo root, the session cwd is
        # inside the repo root, or the repo root is inside the session cwd
        # (worktree case where session cwd is the parent repo).
        if c == root_str or c.startswith(root_str + os.sep) or root_str.startswith(c + os.sep):
            return True
    return False


def find_active_session(root: Path) -> tuple[dict, Path] | None:
    paths = [Path(p) for p in glob.glob(str(SESSIONS_GLOB))]
    matches = []
    for path in paths:
        d = load_session(path)
        if not d:
            continue
        if not matches_cwd(d, root):
            continue
        matches.append((d.get("lastActivityAt", 0), d, path))
    if not matches:
        return None
    matches.sort(key=lambda t: t[0], reverse=True)
    _, d, path = matches[0]
    return d, path


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--json", action="store_true", help="print JSON instead of human-readable")
    ap.add_argument(
        "--quiet",
        action="store_true",
        help="print just 'model effort' on one line (for shell use)",
    )
    args = ap.parse_args()

    root = repo_root()
    found = find_active_session(root)
    if found is None:
        if args.quiet:
            print("unknown unknown")
        elif args.json:
            print(json.dumps({"ok": False, "reason": "no_matching_session", "cwd": str(root)}))
        else:
            print(f"could not detect active session for {root}", file=sys.stderr)
        return 2

    session, path = found
    model = session.get("model", "unknown")
    effort = session.get("effort", "unknown")
    last = session.get("lastActivityAt", 0)
    last_iso = (
        dt.datetime.fromtimestamp(last / 1000).isoformat(timespec="seconds") if last else "unknown"
    )
    if args.quiet:
        print(f"{model} {effort}")
    elif args.json:
        print(
            json.dumps(
                {
                    "ok": True,
                    "model": model,
                    "effort": effort,
                    "lastActivityAt": last,
                    "lastActivityIso": last_iso,
                    "cwd": session.get("cwd"),
                    "worktreePath": session.get("worktreePath"),
                    "source_file": str(path),
                }
            )
        )
    else:
        print(f"model:  {model}")
        print(f"effort: {effort}")
        print(f"last:   {last_iso}")
        print(f"cwd:    {session.get('cwd')}")
        print(f"src:    {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
