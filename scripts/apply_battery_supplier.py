#!/usr/bin/env python3
"""Bulk-apply batterySupplier + cellChemistryDetail to E-GMP specs.

All current 31 specs are Hyundai/Kia E-GMP platform vehicles using SK On
NCM811 cells. See docs/handoff/research/M11_battery_supplier_2026-05-03.md
for sourcing. Idempotent — safe to re-run.
"""
from __future__ import annotations
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPECS = ROOT / "data" / "specs.json"

E_GMP_MODELS = {"Ioniq5", "Ioniq6", "Ioniq9", "EV6", "EV9", "NiroEv"}


def main() -> int:
    specs = json.loads(SPECS.read_text())
    changed = 0
    for s in specs:
        model = s.get("model")
        if model not in E_GMP_MODELS:
            continue
        before = (s.get("batterySupplier"), s.get("cellChemistryDetail"))
        s["batterySupplier"] = "SK_On"
        s["cellChemistryDetail"] = "NCM811"
        if before != ("SK_On", "NCM811"):
            changed += 1
    SPECS.write_text(json.dumps(specs, indent=2) + "\n")
    print(f"updated: {changed} / {len(specs)} specs")
    return 0


if __name__ == "__main__":
    sys.exit(main())
