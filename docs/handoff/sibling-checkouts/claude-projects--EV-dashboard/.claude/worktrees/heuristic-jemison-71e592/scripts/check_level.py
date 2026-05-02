#!/usr/bin/env python3
"""check_level.py — verify the current level fits a given task tag.

Workflow at every task boundary:

    python3 scripts/check_level.py --task spec-writing

Exit codes:
  0  fits current level — go ahead
  1  mismatch — printed reason; caller should switch tasks or stop
  2  detection failed (no active session JSON found)

Without --task, prints current detected level.
With --suggest, also prints compatible task tags.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

from task_complexity import (
    TASKS,
    all_compatible_tags,
    fits,
    lookup,
)

DETECT = Path(__file__).resolve().parent / "detect_level.py"


def detect() -> tuple[str, str] | None:
    res = subprocess.run(
        [sys.executable, str(DETECT), "--json"],
        check=False,
        capture_output=True,
        text=True,
    )
    if res.returncode != 0:
        return None
    try:
        d = json.loads(res.stdout)
    except json.JSONDecodeError:
        return None
    if not d.get("ok"):
        return None
    return d.get("model", "unknown"), d.get("effort", "unknown")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--task", help=f"task tag (one of: {', '.join(sorted(TASKS))})")
    ap.add_argument(
        "--suggest", action="store_true", help="list task tags that fit current level"
    )
    ap.add_argument(
        "--quiet", action="store_true", help="print only OK/MISMATCH on exit (for scripts)"
    )
    args = ap.parse_args()

    found = detect()
    if found is None:
        print("could not detect active session; check Claude Code is open + cwd in this repo", file=sys.stderr)
        return 2
    model, effort = found

    if args.task:
        ok, msg = fits(effort, model, args.task)
        if args.quiet:
            print("OK" if ok else "MISMATCH")
        else:
            print(msg)
        return 0 if ok else 1

    # No --task: show current level + optionally suggest
    if not args.quiet:
        min_eff, min_mod, _ = lookup("default")
        print(f"current: model={model}  effort={effort}")
        print(f"default-task gate: ≥{min_eff} effort + ≥{min_mod} model")
    if args.suggest:
        compatible = all_compatible_tags(effort, model)
        print("compatible task tags:")
        for tag in sorted(compatible):
            print(f"  - {tag}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
