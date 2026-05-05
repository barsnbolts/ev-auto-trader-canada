#!/usr/bin/env python3
"""TIER E2 — verify every unit in units.json has a matching spec.

For each unit, look up by (model, year, trim) in specs.json. Print misses.
Exit 0 (advisory). Coverage % printed for at-a-glance health.

Run: python3 scripts/validate_unit_spec_joins.py
"""
from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UNITS = ROOT / "data" / "units.json"
SPECS = ROOT / "data" / "specs.json"


def main() -> int:
    units = json.loads(UNITS.read_text())
    specs = json.loads(SPECS.read_text())

    spec_index = {(s["model"], s["year"], s["trim"]) for s in specs}
    spec_loose = {(s["model"], s["trim"]) for s in specs}

    miss_strict: list[tuple] = []
    miss_loose: list[tuple] = []
    for u in units:
        key = (u["model"], u["year"], u["trim"])
        if key in spec_index:
            continue
        if (u["model"], u["trim"]) in spec_loose:
            miss_strict.append(key)  # year-relax saves it
        else:
            miss_loose.append(key)

    total = len(units)
    hit = total - len(miss_strict) - len(miss_loose)
    relax = len(miss_strict)
    miss = len(miss_loose)
    print(f"unit→spec join: {hit}/{total} strict ({100*hit//total}%), +{relax} year-relax, {miss} miss")

    if miss_loose:
        print("MISSES (no spec at any year):", file=sys.stderr)
        for k, c in Counter(miss_loose).most_common():
            print(f"  {k[0]} {k[1]} {k[2]:30s}  ×{c}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
