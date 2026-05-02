#!/usr/bin/env python3
"""Merge filled data/heatpump-research-queue.json back into data/specs.json.

Idempotent: reads the queue, writes hasHeatPump + heatPumpSource +
heatPumpConfidence + heatPumpAccessed onto the matching spec row. Rows
where hasHeatPump is still null are skipped (still pending research).

Run: python3 scripts/merge_heatpump_research.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPECS = ROOT / "data" / "specs.json"
QUEUE = ROOT / "data" / "heatpump-research-queue.json"


def key(model, year, trim, drivetrain):
    return f"{model}|{year}|{trim}|{drivetrain}"


def main():
    if not QUEUE.exists():
        print(f"ERR: {QUEUE} missing — run build_heatpump_queue.py first")
        return 1
    specs = json.loads(SPECS.read_text())
    queue = json.loads(QUEUE.read_text())
    by_key = {key(r["model"], r["year"], r["trim"], r["drivetrain"]): r for r in queue}

    merged = 0
    skipped = 0
    for s in specs:
        k = key(s["model"], s["year"], s["trim"], s["drivetrain"])
        r = by_key.get(k)
        if not r or r["hasHeatPump"] is None:
            skipped += 1
            continue
        s["hasHeatPump"] = r["hasHeatPump"]
        if r.get("source"):
            s["heatPumpSource"] = r["source"]
        if r.get("confidence"):
            s["heatPumpConfidence"] = r["confidence"]
        if r.get("accessed"):
            s["heatPumpAccessed"] = r["accessed"]
        merged += 1

    SPECS.write_text(json.dumps(specs, indent=2) + "\n")
    print(f"OK: merged {merged} heat-pump rows into {SPECS.name}")
    print(f"  skipped (still pending research): {skipped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
