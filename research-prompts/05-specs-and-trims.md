# Prompt — Trim catalog & spec sheet refresh (run on model-year changes only)

## Purpose

This prompt seeds and refreshes the *reference* data for the three vehicles —
trim names, MSRP, freight/PDI, range, charging speed, motor power, weight,
cargo volume — that powers the comparison view. Re-run only when Kia/Hyundai
publish a new model year (typically once per ~12 months) or mid-cycle refresh.

## Models

- Kia EV6 — 2024, 2025, 2026 model years (Canada)
- Hyundai Ioniq 5 — 2024, 2025, 2026 model years (Canada)
- Hyundai Ioniq 6 — 2024, 2025, 2026 model years (Canada)

## Per-trim fields

| Field | Notes |
| --- | --- |
| `model` | `EV6` / `Ioniq5` / `Ioniq6` |
| `year` | 2024 / 2025 / 2026 |
| `trim` | exact factory name as it appears on the Canadian configurator |
| `drivetrain` | `RWD` or `AWD` |
| `motorKw` | combined motor power, kilowatts |
| `motorHp` | combined horsepower (rough check: kW × 1.341) |
| `batteryKwh` | usable battery capacity, kWh |
| `rangeKm` | EPA-cycle range (Canada uses NRCan, ~5% lower than EPA — capture NRCan if available) |
| `dcFastChargeKw` | peak DC fast-charge speed |
| `acChargeKw` | onboard AC charger rating (typically 11 kW) |
| `zeroToHundredSec` | manufacturer's 0-100 km/h time |
| `cargoLitres` | rear cargo volume seats up |
| `seats` | passenger capacity |
| `weightKg` | curb weight |
| `msrpCad` | base MSRP at launch (matches what dealers list as MSRP) |
| `freightPdiCad` | freight + PDI typical line item |
| `notes` | anything trim-specific — V2L, heat pump, glass roof, etc. |

## Output format — STRICT JSON

```json
[
  {
    "model": "EV6",
    "year": 2025,
    "trim": "Wind AWD",
    "drivetrain": "AWD",
    "motorKw": 239,
    "motorHp": 320,
    "batteryKwh": 84,
    "rangeKm": 412,
    "dcFastChargeKw": 350,
    "acChargeKw": 11,
    "zeroToHundredSec": 5.3,
    "cargoLitres": 480,
    "seats": 5,
    "weightKg": 2070,
    "msrpCad": 60995,
    "freightPdiCad": 1995,
    "notes": "Heat pump standard; V2L outlet"
  }
]
```

Rules:
- One JSON array. No prose.
- Use Canadian configurator values — these differ from US specs.
- Round range to whole km, weights to whole kg, prices to whole CAD.
- Include EV6 GT and Ioniq 5 N as their own entries.
