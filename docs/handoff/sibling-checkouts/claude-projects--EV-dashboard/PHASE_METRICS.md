# Phase metrics (auto-generated)

*Generated 2026-04-23 by `scripts/metrics.py`. Do not hand-edit.*

## Code
| Metric | Value |
|---|---|
| Lines of TypeScript/TSX (src/) | 3144 |
| Lines of seed JSON | 5919 |

## Data coverage
| Metric | Count |
|---|---|
| Brands | 16 |
| Vehicles | 37 |
| Powertrain: BEV | 33 |
| Powertrain: PHEV | 4 |
| Body style: Crossover | 25 |
| Body style: Minivan | 1 |
| Body style: SUV | 2 |
| Body style: Sedan | 8 |
| Body style: Truck | 1 |
| Drivetrain: AWD | 20 |
| Drivetrain: SINGLE_MOTOR | 17 |
| Confidence: High | 30 |
| Confidence: Medium | 6 |
| Confidence: Low | 1 |

## Data integrity checks
✅ All non-Low vehicles have values in every required field.

## Milestone readiness
- ✅ Phase 1 MVP (scaffold + seed + compare view)
- ✅ Phase 1 visual validation via Claude-in-Chrome
- 🟡 Thermal physics model written, not yet wired to UI → Milestone 3b
- ⬜ Data-quality validator script → Milestone 2a (this is part of it)
- ⬜ Exa-powered verification pass → Milestone 2b

## How to regenerate
```
python3 scripts/metrics.py
```
