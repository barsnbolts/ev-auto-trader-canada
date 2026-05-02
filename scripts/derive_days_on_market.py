#!/usr/bin/env python3
"""Derive daysOnLot per stable unit ID from data/snapshots/.

Reads every JSON snapshot file in data/snapshots/, walks oldest -> newest,
records first-seen date per stable ID (`u-at-<8hex>` namespace only —
pre-stable-ID snapshots are filtered out by regex).

Writes to data/units-enrichment.json, which build_units_from_at.py
consumes via the existing enrichment-overlay mechanism. So no change
needed in build_units_from_at.py for this signal to flow into units.json.

Idempotent. Safe to run repeatedly. Only writes if the enrichment shape
changed.

Run: python3 scripts/derive_days_on_market.py

Algorithm + caveats are documented in
/Users/ianmcadam/.claude/plans/you-are-the-planning-floating-breeze.md
section 5/M3. The relisting edge case (sold + relisted unit credits the
earliest sighting, overstating days-on-lot) is accepted as a v1 limit
until 7+ days of cron history exposes a real case.
"""
from __future__ import annotations
import json
import re
import sys
import datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SNAP_DIR = ROOT / "data" / "snapshots"
ENRICHMENT = ROOT / "data" / "units-enrichment.json"
ID_RE = re.compile(r"^u-at-[0-9a-f]{8}$")


def load_snapshot(p: Path) -> dict:
    return json.loads(p.read_text(encoding="utf-8"))


def derive_first_seen(snapshot_files: list[Path]) -> dict[str, dt.date]:
    """Walk snapshots oldest -> newest, record earliest sighting per stable ID."""
    first_seen: dict[str, dt.date] = {}
    for f in snapshot_files:
        snap = load_snapshot(f)
        try:
            taken = dt.datetime.fromisoformat(
                snap["takenAt"].replace("Z", "+00:00")
            ).date()
        except (KeyError, ValueError):
            taken = dt.date.fromisoformat(f.stem)

        for unit in snap.get("units", []):
            uid = unit.get("id")
            if not uid or not ID_RE.match(uid):
                continue
            first_seen.setdefault(uid, taken)  # earliest wins
    return first_seen


def main() -> int:
    files = sorted(SNAP_DIR.glob("*.json"), key=lambda p: p.name)
    if not files:
        print("ERR: no snapshots in data/snapshots/", file=sys.stderr)
        return 1

    first_seen = derive_first_seen(files)
    today = dt.date.today()

    enrichment: dict[str, dict] = (
        json.loads(ENRICHMENT.read_text()) if ENRICHMENT.exists() else {}
    )

    merged = 0
    for uid, fs_date in first_seen.items():
        days = (today - fs_date).days
        entry = enrichment.setdefault(uid, {})
        entry["daysOnLot"] = days
        entry["daysOnLotSource"] = "snapshot-diff"
        entry["daysOnLotFirstSeen"] = fs_date.isoformat()
        merged += 1

    ENRICHMENT.write_text(json.dumps(enrichment, indent=2, sort_keys=True) + "\n")
    print(f"merged daysOnLot for {merged} units across {len(files)} snapshots")
    return 0


if __name__ == "__main__":
    sys.exit(main())
