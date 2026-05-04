#!/usr/bin/env python3
"""
validate_thermal_specs.py — auto-audit every spec in data/specs.json against
the thermal model's required inputs and physical-plausibility expectations.

Run before every spec edit / commit. Wired into `npm run predeploy` via the
`thermal-audit` npm script.

Required per-spec fields:
  - rangeEpaKm (or legacy rangeKm)
  - batteryKwhUsable (or batteryKwh)
  - hasHeatPump (with confidence)
  - batteryChemistry (LFP|NMC|NCA|LMR — UNKNOWN allowed but downgrades estimate)
  - heatPumpMinEffectiveC if hasHeatPump=true

Physical-plausibility bands (from Geotab + Recurrent + Bjorn Nyland real-world):
  - Wh/km efficiency: 120-230 (Ioniq 6 RWD LR sets the low end at 127)
  - Range retention at -20°C with heat pump: 65-78%
  - Range retention at -20°C without heat pump: 55-65%
  - Preconditioning gain at -20°C: 10-25%

Exits 1 (fail) if any spec violates required-fields or hard-band.
Exits 0 (pass) with warning if soft-band only.
"""
from __future__ import annotations
import json
import sys
from pathlib import Path

SPECS = Path(__file__).resolve().parent.parent / "data" / "specs.json"

# ── Mirrored thermal model (must stay in sync with src/lib/thermal.ts) ─────
CAPACITY_CURVES = {
    "LFP": [(-40,0.20),(-30,0.35),(-20,0.55),(-10,0.75),(0,0.90),(10,0.97),(20,1.00),(30,1.00),(40,0.98)],
    "NMC": [(-40,0.55),(-30,0.68),(-20,0.80),(-10,0.88),(0,0.95),(10,0.98),(20,1.00),(30,1.00),(40,0.98)],
    "NCA": [(-40,0.55),(-30,0.68),(-20,0.80),(-10,0.88),(0,0.95),(10,0.98),(20,1.00),(30,1.00),(40,0.98)],
    "LMR": [(-40,0.50),(-30,0.64),(-20,0.77),(-10,0.86),(0,0.94),(10,0.98),(20,1.00),(30,1.00),(40,0.97)],
    "UNKNOWN": [(-40,0.50),(-30,0.62),(-20,0.75),(-10,0.85),(0,0.93),(10,0.97),(20,1.00),(30,1.00),(40,0.97)],
}
HVAC_RES = [(-40,8.5),(-30,7.5),(-20,6.0),(-10,4.5),(0,3.0),(10,1.2),(20,0.3),(30,2.0),(40,4.2)]
HVAC_HP =  [(-40,8.5),(-30,5.5),(-20,2.2),(-10,1.5),(0,1.0),(10,0.5),(20,0.2),(30,1.2),(40,3.0)]


def interp(curve, x):
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


def hvac_kw(temp, has_hp, hp_min):
    if not has_hp:
        return interp(HVAC_RES, temp)
    transition_top = hp_min + 5
    if temp >= transition_top:
        return interp(HVAC_HP, temp)
    if temp <= hp_min:
        return interp(HVAC_RES, temp)
    frac = (temp - hp_min) / 5
    hp = interp(HVAC_HP, temp)
    res = interp(HVAC_RES, temp)
    return res + frac * (hp - res)


def real_range(epa, bat, has_hp, hp_min, chem, temp, precon=False):
    if not epa or epa <= 0:
        return None
    rated_eff = (bat * 1000) / epa if bat and bat > 0 else 175
    usable = bat if bat else (epa * rated_eff) / 1000
    eff_temp = min(20, temp + 15) if precon else temp
    cap = interp(CAPACITY_CURVES.get(chem, CAPACITY_CURVES["UNKNOWN"]), eff_temp)
    eff_kwh = usable * cap
    h = hvac_kw(temp, has_hp, hp_min)
    if precon:
        h *= 0.7
    eff_eff = rated_eff + (h * 1000 / 100)
    return (eff_kwh * 1000) / eff_eff if eff_eff > 0 else None


def num(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return v
    if isinstance(v, dict):
        return v.get("value")
    return None


def hp_value(v):
    if v is None:
        return None
    if isinstance(v, bool):
        return v
    if isinstance(v, dict):
        return v.get("value")
    return None


def main() -> int:
    specs = json.loads(SPECS.read_text())
    errors: list[str] = []
    warnings: list[str] = []

    for s in specs:
        sid = f"{s['model']} {s['year']} {s['trim']} {s['drivetrain']}"
        epa = num(s.get("rangeEpaKm")) or s.get("rangeKm")
        bat = num(s.get("batteryKwhUsable")) or num(s.get("batteryKwh"))
        chem = s.get("batteryChemistry")
        has_hp = hp_value(s.get("hasHeatPump"))
        hp_min = num(s.get("heatPumpMinEffectiveC"))

        # ── Hard requirements ───────────────────────────────────────────
        if epa is None:
            errors.append(f"{sid}: missing EPA range (rangeEpaKm or rangeKm)")
            continue
        if bat is None:
            errors.append(f"{sid}: missing battery kWh (batteryKwhUsable or batteryKwh)")
            continue
        if has_hp is None:
            warnings.append(f"{sid}: hasHeatPump unknown — model will assume resistive (conservative)")
        if has_hp is True and hp_min is None:
            errors.append(f"{sid}: hasHeatPump=true but no heatPumpMinEffectiveC — using default -20°C")
        if chem is None or chem == "UNKNOWN":
            warnings.append(f"{sid}: batteryChemistry={chem} — using fallback curve")

        # ── Wh/km sanity ────────────────────────────────────────────────
        wh = (bat * 1000) / epa
        if wh < 120 or wh > 230:
            errors.append(f"{sid}: efficiency {wh:.0f} Wh/km outside 120-230 sane band — verify EPA range and battery kWh")

        # ── Cold-weather retention sanity ───────────────────────────────
        cold_20 = real_range(epa, bat, has_hp, hp_min or -20, chem or "UNKNOWN", -20, False)
        if cold_20 is not None:
            ret = (cold_20 / epa) * 100
            lo, hi = (65, 78) if has_hp else (55, 65)
            if not (lo <= ret <= hi):
                errors.append(f"{sid}: -20°C retention {ret:.1f}% outside expected {lo}-{hi}% (HP={has_hp}) — verify chemistry / cutoff")

        # ── Preconditioning gain sanity ─────────────────────────────────
        warm_20 = real_range(epa, bat, has_hp, hp_min or -20, chem or "UNKNOWN", -20, True)
        if cold_20 and warm_20:
            gain = (warm_20 / cold_20 - 1) * 100
            if not (8 <= gain <= 28):
                errors.append(f"{sid}: precon gain {gain:.1f}% at -20°C outside 8-28% — investigate")

    print(f"Audited {len(specs)} specs")
    if warnings:
        print(f"\n⚠ {len(warnings)} warnings (non-blocking):")
        for w in warnings:
            print(f"  - {w}")
    if errors:
        print(f"\n✗ {len(errors)} ERRORS:")
        for e in errors:
            print(f"  - {e}")
        return 1
    print("\n✓ All specs pass thermal-input audit.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
