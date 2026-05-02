#!/usr/bin/env python3
"""
Thermal model self-validation harness.

Encodes the same chemistry + HVAC + DC-factor curves as src/lib/thermal.ts,
then runs a suite of anchor-point tests derived from published real-world
winter tests (Bjørn Nyland 1000 km, Recurrent Auto, Geotab). Each anchor
specifies a vehicle, slider state, and an expected range window. The model
must predict inside the window, or this gate fails.

Called by scripts/milestone.py as part of the ritual. If the physics model
ever drifts — say, if we tune a chemistry curve wrong or a vehicle's
thermal_profile override goes haywire — the milestone cannot close until
fixed.

Exit 0 = all anchors pass. Exit 1 = one or more failed.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEED = ROOT / "src" / "data" / "seed.json"


# ---------- Curves (mirror of thermal.ts) ------------------------------------

CAPACITY_CURVES = {
    "LFP": [(-40, 0.20), (-30, 0.35), (-20, 0.55), (-10, 0.75),
            (0, 0.90), (10, 0.97), (20, 1.00), (30, 1.00), (40, 0.98)],
    "NMC": [(-40, 0.55), (-30, 0.68), (-20, 0.80), (-10, 0.88),
            (0, 0.95), (10, 0.98), (20, 1.00), (30, 1.00), (40, 0.98)],
    "NCA": [(-40, 0.55), (-30, 0.68), (-20, 0.80), (-10, 0.88),
            (0, 0.95), (10, 0.98), (20, 1.00), (30, 1.00), (40, 0.98)],
    "LMR": [(-40, 0.50), (-30, 0.64), (-20, 0.77), (-10, 0.86),
            (0, 0.94), (10, 0.98), (20, 1.00), (30, 1.00), (40, 0.97)],
    "UNKNOWN": [(-40, 0.50), (-30, 0.62), (-20, 0.75), (-10, 0.85),
                (0, 0.93), (10, 0.97), (20, 1.00), (30, 1.00), (40, 0.97)],
}

HVAC_RESISTIVE = [(-40, 8.5), (-30, 7.5), (-20, 6.0), (-10, 4.5),
                  (0, 3.0), (10, 1.2), (20, 0.3), (30, 2.0), (40, 4.2)]
HVAC_HEAT_PUMP = [(-40, 8.5), (-30, 5.5), (-20, 2.2), (-10, 1.5),
                  (0, 1.0), (10, 0.5), (20, 0.2), (30, 1.2), (40, 3.0)]


def interp(curve: list[tuple[float, float]], x: float) -> float:
    if x <= curve[0][0]:
        return curve[0][1]
    if x >= curve[-1][0]:
        return curve[-1][1]
    for i in range(len(curve) - 1):
        x0, y0 = curve[i]
        x1, y1 = curve[i + 1]
        if x0 <= x <= x1:
            t = (x - x0) / (x1 - x0)
            return y0 + t * (y1 - y0)
    return curve[-1][1]


def compute_range(vehicle: dict, temp_c: float, preconditioned: bool, hvac_on: bool, speed_kph: float = 100) -> float:
    temp = max(-40, min(40, temp_c))
    rated_range = vehicle["range_km"]["value"]
    rated_usable = vehicle["battery_kwh_usable"]["value"] or vehicle["battery_kwh_total"]["value"]
    chemistry = vehicle.get("battery_chemistry", "UNKNOWN")
    has_hp = vehicle["has_heat_pump"]["value"]

    rated_eff = (rated_usable * 1000) / rated_range if rated_range and rated_usable else 175.0
    cap_frac = interp(CAPACITY_CURVES.get(chemistry, CAPACITY_CURVES["UNKNOWN"]), temp)
    effective_kwh = rated_usable * cap_frac

    hvac_kw = 0.0
    if hvac_on:
        # Matches thermal.ts: per-vehicle heat_pump_min_effective_c override,
        # default -20°C.
        hp_min_c = -20
        hp_field = vehicle.get("heat_pump_min_effective_c")
        if isinstance(hp_field, dict) and hp_field.get("value") is not None:
            hp_min_c = hp_field["value"]
        if has_hp and temp >= hp_min_c:
            hvac_kw = interp(HVAC_HEAT_PUMP, temp)
        else:
            hvac_kw = interp(HVAC_RESISTIVE, temp)

    hvac_whkm = (hvac_kw * 1000) / speed_kph if speed_kph > 0 else 0
    eff_eff = rated_eff + hvac_whkm
    return (effective_kwh * 1000) / eff_eff if eff_eff > 0 else 0


# ---------- Anchor tests ------------------------------------------------------
# Each anchor: (vehicle_id, temp_c, preconditioned, hvac_on, (min_km, max_km), source_label)
# Ranges are intentionally wide enough to accommodate model abstraction, narrow
# enough to catch real drift.

ANCHORS = [
    # Tesla Model 3 LR AWD at -10°C, HVAC on, preconditioned — heat pump helps.
    # Bjørn Nyland / community: ~15-22% winter loss, so ~440-480 km from 565.
    ("tesla-model3-highland-lr-awd", -10, True, True, (430, 490),
     "Bjørn Nyland 1000 km cold-weather results for Model 3 LR AWD"),

    # F-150 Lightning ER AWD at -20°C, HVAC on, cold-soaked — no heat pump.
    # Community: 30-40% range loss from rated → 310-360 km from 515.
    ("ford-lightning-er-awd", -20, False, True, (300, 365),
     "InsideEVs / Out of Spec F-150 Lightning winter testing"),

    # Polestar 2 LR Single Motor at -20°C, HVAC on, preconditioned.
    # Heat pump standard on 2024+ → modest winter loss.
    ("polestar-2-lr-sm-2024", -20, True, True, (330, 400),
     "Recurrent Auto fleet data for Polestar 2 LR 2024"),

    # IONIQ 5 LR RWD 2025+ at -20°C, HVAC on, preconditioned.
    # Heat pump standard; 25-30% winter loss typical.
    ("hyundai-ioniq5-2025-lr-rwd", -20, True, True, (340, 405),
     "Bjørn Nyland IONIQ 5 winter testing (2024+ 77.4 kWh pre-refresh as proxy)"),

    # Mid-temperature sanity: any vehicle at +20°C preconditioned, HVAC off
    # should match rated within ±3%.
    ("tesla-model3-highland-lr-awd", 20, True, False, (550, 575),
     "Rated-conditions sanity check"),

    # Hot weather: +35°C with AC on, should derate modestly (~7-15%).
    ("tesla-model3-highland-lr-awd", 35, True, True, (470, 540),
     "Summer AC-on derate sanity"),
]


def main() -> int:
    data = json.loads(SEED.read_text(encoding="utf-8"))
    by_id = {v["id"]: v for v in data["vehicles"]}

    print("Thermal-model anchor validation:")
    fails = 0
    skipped = 0
    for vid, temp_c, precon, hvac, (lo, hi), source in ANCHORS:
        vehicle = by_id.get(vid)
        if vehicle is None:
            print(f"  · SKIP {vid} @ {temp_c}°C — not in seed")
            skipped += 1
            continue
        # Skip if vehicle is Low-confidence or missing core data — model isn't
        # expected to be accurate for placeholders.
        if vehicle["overall_confidence"] == "Low" or vehicle["range_km"]["value"] is None:
            print(f"  · SKIP {vid} @ {temp_c}°C — Low-confidence or missing data")
            skipped += 1
            continue

        predicted = compute_range(vehicle, temp_c, precon, hvac)
        ok = lo <= predicted <= hi
        marker = "✓" if ok else "✗"
        precon_s = "precon" if precon else "cold-soaked"
        hvac_s = "HVAC on" if hvac else "HVAC off"
        print(f"  {marker} {vid} @ {temp_c:+d}°C, {precon_s}, {hvac_s}: "
              f"predicted {predicted:.0f} km (expected {lo}–{hi} km)")
        if not ok:
            print(f"      source: {source}")
            fails += 1

    print("")
    total_run = len(ANCHORS) - skipped
    print(f"Ran {total_run} anchors, {fails} failed, {skipped} skipped.")
    if fails > 0:
        print(f"✗ Thermal model has drifted. Investigate before closing milestone.")
        return 1
    print(f"✓ Thermal model passes all anchors within tolerance.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
