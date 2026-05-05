#!/usr/bin/env python3
"""TIER E5 — regenerate CHANGELOG.md from `git log` history.

Walks `git log --pretty=format:%cs|%h|%s` since the project's first commit
(or --since N days). Groups by date. Skips bot/data-refresh commits.

Re-run on cron-friendly cadence (weekly is plenty).

Usage:
  python3 scripts/generate_changelog.py [--since 60d]
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "CHANGELOG.md"

# Skip auto-generated noise from the rolled-up log.
SKIP_PATTERNS = [
    re.compile(r"^data refresh:"),
    re.compile(r"^weekly data refresh:"),
    re.compile(r"^chore: bump version"),
    re.compile(r"^Merge pull request"),
    re.compile(r"^Merge branch"),
]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--since", default="180.days.ago",
        help="git log --since (default 180.days.ago — use git-friendly relative form)",
    )
    args = ap.parse_args()

    proc = subprocess.run(
        ["git", "log", f"--since={args.since}", "--pretty=format:%cs|%h|%s"],
        capture_output=True, text=True, cwd=ROOT,
    )
    if proc.returncode != 0:
        print("git log failed:", proc.stderr, file=sys.stderr)
        return 1

    by_day: dict[str, list[tuple[str, str]]] = defaultdict(list)
    for line in proc.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            date, sha, subject = line.split("|", 2)
        except ValueError:
            continue
        if any(p.match(subject) for p in SKIP_PATTERNS):
            continue
        by_day[date].append((sha, subject))

    lines = ["# CHANGELOG\n",
             f"_Auto-generated from `git log` since {args.since}. Run `scripts/generate_changelog.py` to refresh._\n"]
    for date in sorted(by_day, reverse=True):
        lines.append(f"\n## {date}\n")
        for sha, subj in by_day[date]:
            lines.append(f"- `{sha}` {subj}")

    OUT.write_text("\n".join(lines) + "\n")
    print(f"wrote {OUT} ({sum(len(v) for v in by_day.values())} entries across {len(by_day)} days)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
