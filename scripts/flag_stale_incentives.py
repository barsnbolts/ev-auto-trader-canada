#!/usr/bin/env python3
"""TIER E1 — flag incentives whose lastVerified > N days ago.

Walks data/incentives.json. Prints any entry with stale lastVerified.
Advisory only — exit 0 always so this can run pre-cron without blocking
the daily refresh. Use for ops health (manual periodic re-verification).

Run: python3 scripts/flag_stale_incentives.py [--days 30]
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INC = ROOT / "data" / "incentives.json"


def parse_iso(s: str) -> date | None:
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).date()
    except (ValueError, TypeError):
        return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=30, help="staleness threshold (default 30d)")
    args = ap.parse_args()

    today = date.today()
    incentives = json.loads(INC.read_text())
    stale = []
    for inc in incentives:
        lv = parse_iso(inc.get("lastVerified", ""))
        if lv is None:
            stale.append((inc.get("id", "?"), "missing-lastVerified", inc.get("name", "")))
            continue
        age = (today - lv).days
        if age > args.days:
            stale.append((inc.get("id", "?"), f"{age}d", inc.get("name", "")))

    if not stale:
        print(f"OK: all {len(incentives)} incentives verified within {args.days}d")
        return 0

    print(f"STALE ({len(stale)}/{len(incentives)} incentives > {args.days}d unverified):", file=sys.stderr)
    for iid, age, name in sorted(stale, key=lambda r: r[0]):
        print(f"  {iid:30s} {age:>20s}  {name}", file=sys.stderr)
    return 0  # advisory: never blocks


if __name__ == "__main__":
    sys.exit(main())
