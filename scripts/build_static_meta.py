#!/usr/bin/env python3
"""Build data/meta-static.json for the Tauri/static-export bundle.

Inlines mtimes of the canonical data files plus the full snapshot list
(file body + filename) so dataClient.ts can render the /history page
without a server-side fs reader.

Run from project root. Idempotent. No third-party deps.
"""
from __future__ import annotations

import datetime as _dt
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
SNAP = DATA / "snapshots"
OUT = DATA / "meta-static.json"


def _iso(p: Path) -> str:
    """Return file mtime as ISO 8601 UTC string, matching fs.stat().mtime
    behaviour used in src/lib/data.ts:loadMeta."""
    ts = _dt.datetime.fromtimestamp(p.stat().st_mtime, tz=_dt.timezone.utc)
    return ts.isoformat().replace("+00:00", "Z")


def main() -> int:
    if not DATA.exists():
        print(f"data dir missing: {DATA}", file=sys.stderr)
        return 1

    snapshot_files = sorted(p.name for p in SNAP.glob("*.json")) if SNAP.exists() else []
    snapshots: list[dict] = []
    for name in snapshot_files:
        with (SNAP / name).open("r", encoding="utf-8") as fh:
            snapshots.append(json.load(fh))

    last_snapshot_at = _iso(SNAP / snapshot_files[-1]) if snapshot_files else None

    meta = {
        "unitsUpdatedAt": _iso(DATA / "units.json"),
        "incentivesUpdatedAt": _iso(DATA / "incentives.json"),
        "dealersUpdatedAt": _iso(DATA / "dealers.json"),
        "snapshotCount": len(snapshot_files),
        "lastSnapshotAt": last_snapshot_at,
        "snapshotFiles": snapshot_files,
        "snapshots": snapshots,
        "_generatedAt": _dt.datetime.now(tz=_dt.timezone.utc).isoformat().replace("+00:00", "Z"),
    }

    OUT.write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    size_kb = OUT.stat().st_size / 1024
    print(
        f"meta-static.json: {len(snapshot_files)} snapshots, {size_kb:.1f} KB -> {OUT.relative_to(ROOT)}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
