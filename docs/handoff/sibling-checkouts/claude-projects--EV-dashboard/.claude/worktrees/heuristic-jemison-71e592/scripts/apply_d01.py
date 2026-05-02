#!/usr/bin/env python3
"""apply_d01.py — patch seed.json with the D-01 verification agent outputs.

Reads the 5 result files in docs/research/auto/d01/*.json (one per brand
cluster) and applies them to src/data/seed.json per Ian's confirmed policy
(2026-04-24):

    1. Apply value corrections aggressively when ≥2-3 sources agree (no ±5%
       threshold).
    2. MSRP convention = bare MSRP from the manufacturer's CA configurator
       (excludes freight/PDI/fees).
    3. When seed value mismatches the trim_label (wrong trim), fix the value
       to match trim_label.
    4. Vehicles not sold in Canada → delete from seed.

Action handling:
    "upgrade"       → write new_value, new_confidence, new_source
    "add_source"    → keep value, write new_confidence + new_source
    "delete_vehicle"→ remove vehicle entry (orchestrator-driven)
    "no_change"     → skip

Workflow:
    1. Backup seed.json → seed.json.bak.<ts>
    2. Apply patches in-memory
    3. Atomic temp-write + replace
    4. Run validate.py — if red, revert from backup

Usage:
    python3 scripts/apply_d01.py             # apply
    python3 scripts/apply_d01.py --dry-run   # show diff only
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEED = ROOT / "src" / "data" / "seed.json"
RESULTS_DIR = ROOT / "docs" / "research" / "auto" / "d01"

# Vehicles Ian explicitly confirmed for deletion (US-only, not sold in CA).
VEHICLES_TO_DELETE = {"tesla-modely-juniper-lr-rwd"}

# Field name in seed → field name we use in result JSON
FIELD_MAP = {
    "battery_kwh_usable": "battery_kwh_usable",
    "range_km": "range_km",
    "msrp_cad": "msrp_cad",
}


def load_results() -> dict:
    """Read every result file and merge into one dict keyed by vehicle_id."""
    merged: dict[str, dict] = {}
    for f in sorted(RESULTS_DIR.glob("*.result.json")):
        data = json.loads(f.read_text(encoding="utf-8"))
        for vid, fields in data.items():
            if vid.startswith("_"):
                continue  # _notes, _comment, etc.
            merged.setdefault(vid, {}).update(fields)
    return merged


def apply_one(vehicle: dict, fields: dict, dry_run: bool) -> list[str]:
    """Mutate a single vehicle dict per the agent's action map. Returns log lines."""
    diffs: list[str] = []
    for field_name, patch in fields.items():
        if field_name not in FIELD_MAP:
            continue
        if not isinstance(patch, dict):
            continue
        action = patch.get("action")
        if action == "no_change":
            continue
        seed_field = FIELD_MAP[field_name]
        current = vehicle.get(seed_field) or {}
        old_value = current.get("value")
        old_conf = current.get("confidence")
        new_value = patch.get("new_value")
        new_conf = patch.get("new_confidence", old_conf)
        new_source = patch.get("new_source")

        if action == "upgrade":
            updated = dict(current)
            if new_value is not None:
                updated["value"] = new_value
            if new_conf:
                updated["confidence"] = new_conf
            if new_source:
                updated["source"] = new_source
            if not dry_run:
                vehicle[seed_field] = updated
            tag = "PATCH" if (new_value is not None and new_value != old_value) else "UPGRADE"
            diffs.append(
                f"  [{tag}] {seed_field}: {old_value} [{old_conf}] → {updated.get('value')} [{updated.get('confidence')}]"
            )
        elif action == "add_source":
            updated = dict(current)
            if new_conf:
                updated["confidence"] = new_conf
            if new_source:
                updated["source"] = new_source
            if not dry_run:
                vehicle[seed_field] = updated
            diffs.append(
                f"  [SOURCE] {seed_field}: {old_value} [{old_conf}] → cite added [{updated.get('confidence')}]"
            )
        # delete_vehicle handled at outer scope
    return diffs


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args(argv[1:])

    if not RESULTS_DIR.exists():
        print(f"ERROR: {RESULTS_DIR} not found", file=sys.stderr)
        return 1
    results = load_results()
    if not results:
        print("ERROR: no result files in docs/research/auto/d01/", file=sys.stderr)
        return 1
    print(f"Loaded {len(results)} vehicle entries from {RESULTS_DIR}")

    seed = json.loads(SEED.read_text(encoding="utf-8"))

    # Map vehicle_id → vehicle dict for O(1) lookup
    by_id = {v["id"]: v for v in seed["vehicles"]}

    total_diffs = 0
    deletions = 0
    for vid, fields in results.items():
        if vid in VEHICLES_TO_DELETE:
            if not args.dry_run:
                seed["vehicles"] = [v for v in seed["vehicles"] if v["id"] != vid]
                by_id.pop(vid, None)
            print(f"\n→ DELETE vehicle: {vid} (US-only, not sold in CA)")
            deletions += 1
            continue
        v = by_id.get(vid)
        if not v:
            print(f"  ! vehicle id {vid} not found in seed — skipping")
            continue
        diffs = apply_one(v, fields, dry_run=args.dry_run)
        if diffs:
            print(f"\n→ {vid}")
            for d in diffs:
                print(d)
            total_diffs += len(diffs)

    print(f"\n=== Summary ===")
    print(f"  field-level patches: {total_diffs}")
    print(f"  vehicle deletions:   {deletions}")
    print(f"  vehicles before:     {len(by_id) + deletions}")
    print(f"  vehicles after:      {len(seed['vehicles'])}")

    if args.dry_run:
        print("\n(dry run — seed.json not modified)")
        return 0

    # Backup
    ts = time.strftime("%Y%m%d-%H%M%S")
    backup = SEED.with_suffix(f".json.bak.{ts}")
    shutil.copy2(SEED, backup)
    print(f"\n  backup: {backup.relative_to(ROOT)}")

    # Atomic write
    tmp = SEED.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(seed, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    tmp.replace(SEED)
    print(f"  written: {SEED.relative_to(ROOT)}")

    # Validate
    res = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "validate.py")],
        cwd=ROOT, capture_output=True, text=True,
    )
    print(f"\n  validate.py: exit {res.returncode}")
    if res.returncode != 0:
        # Revert
        print("  ! validate failed — reverting seed.json from backup")
        shutil.copy2(backup, SEED)
        print(res.stdout[-2000:])
        print(res.stderr[-2000:], file=sys.stderr)
        return 1
    print(res.stdout[-500:])
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
