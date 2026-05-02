#!/usr/bin/env python3
"""apply_research.py — fold a research-vehicle JSON result into seed.json.

Usage:
    python3 scripts/apply_research.py docs/research/auto/<slug>-<date>.result.json
    python3 scripts/apply_research.py docs/research/auto/<slug>-<date>.result.json --dry-run

This is the "closer" half of the parallel-research pipeline:

  1. `research_vehicle.py` writes a dispatch plan (.json + .md).
  2. Claude spawns N parallel agents per the plan, collects their JSON output.
  3. Claude merges the agent outputs into one `<slug>-<date>.result.json` file
     of shape `{vehicle: {brand, model, year, trim, id, ...}, fields: {...}}`.
  4. THIS script reads the result file and patches seed.json.

The result file shape (Claude assembles it from the agent outputs):

```json
{
  "vehicle": {
    "id": "hyundai-kona-2025-lr-rwd",
    "brand_id": "hyundai",
    "model": "Kona Electric",
    "generation_label": "2024+ refresh",
    "year_start": 2024,
    "year_end": null,
    "powertrain": "BEV",
    "body_style": "Crossover",
    "drivetrain_variant": "SINGLE_MOTOR",
    "trim_label": "Long Range RWD",
    "battery_chemistry": "NMC",
    "range_protocol": "EPA",
    "port_type": "CCS1",
    "seats": 5,
    "thermal_management": "active_liquid",
    "degradation_annual": 0.02
  },
  "cited_fields": {
    "battery_kwh_total": {"value": 64.8, "confidence": "Medium", "source": {...}},
    "battery_kwh_usable": {...},
    "range_km": {...},
    "ac_charge_kw_max": {...},
    "dc_charge_kw_max": {...},
    "cargo_l_seats_up": {...},
    "tow_rating_kg": {...},
    "weight_kg": {...},
    "has_heat_pump": {...},
    "msrp_cad": {...},
    "federal_izev_cad": {...},
    "provincial_rebate_cad_on": {...}
  },
  "thermal_arrays": {
    "cold_derate_curve": [...],
    "hvac_draw_kw_by_temp": [...],
    "hp_min_temp_c": -10,
    "precon_time_by_temp": [...],
    "precon_thermal_gain": 0.85,
    "dc_cold_soak_curve": [...],
    "charging_curve_20c": [...]
  },
  "overall_confidence": "Medium"
}
```

The script:
  - validates the result has all required fields (refuses to apply partial).
  - checks vehicle.id doesn't already exist in seed.json (refuses overwrite).
  - adds the brand to seed.brands if missing.
  - inserts the vehicle row.
  - runs `validate.py` after; reverts on failure (writes seed.json.bak.<ts>).
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEED = ROOT / "src" / "data" / "seed.json"

REQUIRED_VEHICLE_FIELDS = {
    "id", "brand_id", "model", "generation_label", "year_start", "year_end",
    "powertrain", "body_style", "drivetrain_variant", "trim_label",
    "battery_chemistry", "range_protocol", "port_type", "seats",
    "thermal_management",
}

REQUIRED_CITED_FIELDS = {
    "battery_kwh_total", "battery_kwh_usable", "range_km",
    "ac_charge_kw_max", "dc_charge_kw_max",
    "cargo_l_seats_up", "tow_rating_kg", "weight_kg",
    "has_heat_pump", "msrp_cad", "federal_izev_cad", "provincial_rebate_cad_on",
}

REQUIRED_THERMAL_ARRAYS = {
    "cold_derate_curve", "hvac_draw_kw_by_temp", "hp_min_temp_c",
    "precon_time_by_temp", "precon_thermal_gain", "dc_cold_soak_curve",
    "charging_curve_20c",
}


def validate_result(result: dict) -> list[str]:
    errs: list[str] = []
    v = result.get("vehicle", {})
    cited = result.get("cited_fields", {})
    thermal = result.get("thermal_arrays", {})

    missing_v = REQUIRED_VEHICLE_FIELDS - set(v.keys())
    missing_c = REQUIRED_CITED_FIELDS - set(cited.keys())
    missing_t = REQUIRED_THERMAL_ARRAYS - set(thermal.keys())

    if missing_v:
        errs.append(f"vehicle missing keys: {sorted(missing_v)}")
    if missing_c:
        errs.append(f"cited_fields missing keys: {sorted(missing_c)}")
    if missing_t:
        errs.append(f"thermal_arrays missing keys: {sorted(missing_t)}")
    if "overall_confidence" not in result:
        errs.append("top-level overall_confidence missing")

    # cited_fields must each carry value + confidence
    for k, val in cited.items():
        if not isinstance(val, dict):
            errs.append(f"cited_fields.{k}: must be a dict, got {type(val).__name__}")
            continue
        if "value" not in val:
            errs.append(f"cited_fields.{k}: missing 'value'")
        if val.get("confidence") not in {"High", "Medium", "Low"}:
            errs.append(f"cited_fields.{k}: confidence must be High/Medium/Low")

    return errs


def merge_into_vehicle(result: dict) -> dict:
    """Build the final vehicle row from the result JSON shape."""
    v = dict(result["vehicle"])
    v.update(result["cited_fields"])
    v.update(result["thermal_arrays"])
    v["overall_confidence"] = result["overall_confidence"]
    return v


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("result", help="path to the merged result JSON from research_vehicle.py")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--brand-name", help="if brand_id not in seed.brands, the human name to register")
    ap.add_argument("--brand-country", default="USA", help="country for new brand if registering")
    args = ap.parse_args(argv[1:])

    result_path = Path(args.result)
    if not result_path.is_absolute():
        result_path = ROOT / result_path
    if not result_path.exists():
        print(f"result file not found: {result_path}", file=sys.stderr)
        return 2

    result = json.loads(result_path.read_text(encoding="utf-8"))

    errs = validate_result(result)
    if errs:
        print("✗ result file is incomplete:")
        for e in errs:
            print(f"  - {e}")
        return 1

    new_vehicle = merge_into_vehicle(result)
    seed = json.loads(SEED.read_text(encoding="utf-8"))

    if any(v["id"] == new_vehicle["id"] for v in seed["vehicles"]):
        print(f"✗ vehicle already in seed.json: {new_vehicle['id']}", file=sys.stderr)
        return 1

    brand_id = new_vehicle["brand_id"]
    if not any(b["id"] == brand_id for b in seed["brands"]):
        if not args.brand_name:
            print(f"✗ brand '{brand_id}' not in seed.brands and --brand-name not provided", file=sys.stderr)
            return 1
        seed["brands"].append({"id": brand_id, "name": args.brand_name, "country": args.brand_country})
        print(f"  + new brand: {brand_id} ({args.brand_name}, {args.brand_country})")

    seed["vehicles"].append(new_vehicle)

    print(f"  + vehicle: {new_vehicle['id']}  ({len(seed['vehicles'])} total)")
    if args.dry_run:
        print("dry-run: not writing.")
        return 0

    # Backup + atomic write
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = SEED.with_suffix(f".bak.{ts}")
    shutil.copy2(SEED, backup)
    SEED.write_text(json.dumps(seed, indent=2) + "\n", encoding="utf-8")
    print(f"  backup: {backup.relative_to(ROOT)}")

    # Re-validate
    rc = subprocess.call([sys.executable, str(ROOT / "scripts" / "validate.py")], cwd=ROOT)
    if rc != 0:
        print("✗ validate.py failed — reverting from backup")
        shutil.copy2(backup, SEED)
        return 1

    print("✅ applied + validated")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
