#!/usr/bin/env python3
"""TIER E3 — keep latest N snapshots in data/snapshots/, delete the rest.

Run after derive_days_on_market.py so days-on-lot computation has its
inputs before the prune. Default keep=14 (matches stale-listing chip
threshold + 7d safety margin).

Usage:
  python3 scripts/prune_snapshots.py [--keep 14] [--dry-run]
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SNAP_DIR = ROOT / "data" / "snapshots"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--keep", type=int, default=14, help="snapshots to retain (default 14)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not SNAP_DIR.exists():
        print(f"no snapshot dir at {SNAP_DIR} — nothing to prune")
        return 0

    snaps = sorted(SNAP_DIR.glob("*.json"))
    if len(snaps) <= args.keep:
        print(f"OK: {len(snaps)} snapshots, keep={args.keep} — nothing to prune")
        return 0

    keep_set = set(snaps[-args.keep:])  # newest first
    to_delete = [p for p in snaps if p not in keep_set]
    print(f"prune: keeping {len(keep_set)}, deleting {len(to_delete)} (oldest = {to_delete[0].name})")

    if args.dry_run:
        for p in to_delete:
            print(f"  DRY would delete: {p.name}")
        return 0

    for p in to_delete:
        p.unlink()
        print(f"  deleted: {p.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
