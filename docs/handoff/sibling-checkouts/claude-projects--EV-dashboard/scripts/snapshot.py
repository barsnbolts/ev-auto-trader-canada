#!/usr/bin/env python3
"""
Snapshot the current seed.json into snapshots/ with a UTC timestamp.

Called from scripts/milestone.py so every closed milestone has a versioned
copy of the dataset on disk. Cheap insurance against accidental deletion or
a bad Exa verification run overwriting good data.

Usage:
    python3 scripts/snapshot.py        # writes a timestamped snapshot
    python3 scripts/snapshot.py --diff # also prints diff vs previous snapshot

After writing, auto-rotates: keeps the most recent KEEP_ACTIVE snapshots as
loose .json, bundles older ones into snapshots/archive/YYYYMMDD-bundle.tar.gz.
Keeps disk + token footprint bounded regardless of milestone count.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import tarfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEED = ROOT / "src" / "data" / "seed.json"
SNAP_DIR = ROOT / "snapshots"
ARCHIVE_DIR = SNAP_DIR / "archive"
KEEP_ACTIVE = 5  # how many loose .json snapshots to keep before archiving


def ensure_snap_dir() -> None:
    SNAP_DIR.mkdir(parents=True, exist_ok=True)


def previous_snapshot() -> Path | None:
    if not SNAP_DIR.exists():
        return None
    existing = sorted(SNAP_DIR.glob("*-seed.json"))
    return existing[-1] if existing else None


def write_snapshot() -> Path:
    ensure_snap_dir()
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d-%H%M%S")
    target = SNAP_DIR / f"{ts}-seed.json"
    shutil.copy2(SEED, target)
    return target


def quick_diff(a: Path, b: Path) -> None:
    """Pretty delta between two seed snapshots — vehicle count + confidence."""
    da = json.loads(a.read_text(encoding="utf-8"))
    db = json.loads(b.read_text(encoding="utf-8"))
    from collections import Counter

    def summary(d):
        return {
            "vehicles": len(d["vehicles"]),
            "brands": len(d["brands"]),
            "confidence": dict(Counter(v["overall_confidence"] for v in d["vehicles"])),
        }

    sa, sb = summary(da), summary(db)
    print("Diff vs previous snapshot:")
    for k in ("vehicles", "brands"):
        if sa[k] != sb[k]:
            print(f"  {k}: {sa[k]} → {sb[k]}")
    ca, cb = sa["confidence"], sb["confidence"]
    for level in ("High", "Medium", "Low"):
        va, vb = ca.get(level, 0), cb.get(level, 0)
        if va != vb:
            print(f"  confidence[{level}]: {va} → {vb}")
    ids_a = {v["id"] for v in da["vehicles"]}
    ids_b = {v["id"] for v in db["vehicles"]}
    added = ids_b - ids_a
    removed = ids_a - ids_b
    for vid in sorted(added): print(f"  + vehicle added: {vid}")
    for vid in sorted(removed): print(f"  - vehicle removed: {vid}")


def rotate_snapshots() -> None:
    """Keep only KEEP_ACTIVE loose snapshots; bundle older ones into tar.gz.

    Idempotent: if nothing needs rotating, does nothing. Survives when the
    sandbox can't delete pre-existing files (they get re-tarred on next call
    until eventually removable).
    """
    existing = sorted(SNAP_DIR.glob("*-seed.json"))
    if len(existing) <= KEEP_ACTIVE:
        return
    ARCHIVE_DIR.mkdir(parents=True, exist_ok=True)
    old = existing[:-KEEP_ACTIVE]
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    bundle = ARCHIVE_DIR / f"snapshots-{ts}.tar.gz"
    with tarfile.open(bundle, "w:gz") as tf:
        for p in old:
            tf.add(p, arcname=p.name)
    removed, kept = 0, 0
    for p in old:
        try:
            p.unlink()
            removed += 1
        except OSError:
            # Sandbox/filesystem may refuse deletion; the tar still has them.
            kept += 1
    note = f"archived {len(old)} → {bundle.name}"
    if kept:
        note += f" (sandbox kept {kept} originals; safe to rm on host)"
    print(note)


def main(argv: list[str]) -> int:
    if not SEED.exists():
        sys.stderr.write(f"seed not found at {SEED}\n")
        return 1

    prev = previous_snapshot()
    target = write_snapshot()
    size_kb = target.stat().st_size / 1024
    print(f"Snapshot written: {target.relative_to(ROOT)} ({size_kb:.1f} KB)")

    if "--diff" in argv and prev is not None:
        quick_diff(prev, target)

    rotate_snapshots()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
