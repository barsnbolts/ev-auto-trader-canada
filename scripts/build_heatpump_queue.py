#!/usr/bin/env python3
"""Generate data/heatpump-research-queue.json from data/specs.json.

One row per (model, year, trim, drivetrain) currently in specs.json.
Pre-fills hasHeatPump = null so a downstream researcher (LOW-reasoning
fill task: Exa search per row → paste answer back into queue) can update
the file. Never overwrites existing answers — re-runnable safely.

Run: python3 scripts/build_heatpump_queue.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPECS = ROOT / "data" / "specs.json"
QUEUE = ROOT / "data" / "heatpump-research-queue.json"


def key(s):
    return f'{s["model"]}|{s["year"]}|{s["trim"]}|{s["drivetrain"]}'


def main():
    specs = json.loads(SPECS.read_text())
    existing = {}
    if QUEUE.exists():
        for row in json.loads(QUEUE.read_text()):
            existing[
                f'{row["model"]}|{row["year"]}|{row["trim"]}|{row["drivetrain"]}'
            ] = row

    out = []
    for s in specs:
        k = key(s)
        if k in existing:
            out.append(existing[k])
            continue
        out.append({
            "model": s["model"],
            "year": s["year"],
            "trim": s["trim"],
            "drivetrain": s["drivetrain"],
            "hasHeatPump": None,        # ← researcher fills: true / false / null
            "source": "",                # ← researcher fills: OEM URL or null
            "accessed": "",              # ← researcher fills: YYYY-MM-DD
            "confidence": None,          # ← "High" | "Medium" | "Low"
            "notes": "",
        })

    QUEUE.write_text(json.dumps(out, indent=2) + "\n")
    todo = sum(1 for r in out if r["hasHeatPump"] is None and not r["notes"])
    done = len(out) - todo
    print(f"OK: wrote {len(out)} rows to {QUEUE.name}")
    print(f"  filled: {done}  todo: {todo}")


if __name__ == "__main__":
    main()
