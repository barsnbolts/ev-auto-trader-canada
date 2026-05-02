# Phase metrics (auto-generated)

*Generated 2026-04-25 by `scripts/metrics.py`. Do not hand-edit.*

## Code
| Metric | Value |
|---|---|
| Lines of TypeScript/TSX (src/) | 3875 |
| Lines of seed JSON | 10568 |

## Data coverage
| Metric | Count |
|---|---|
| Brands | 23 |
| Vehicles | 51 |
| Powertrain: BEV | 50 |
| Powertrain: PHEV | 1 |
| Body style: Crossover | 15 |
| Body style: SUV | 18 |
| Body style: Sedan | 17 |
| Body style: Truck | 1 |
| Drivetrain: AWD | 37 |
| Drivetrain: SINGLE_MOTOR | 14 |
| Confidence: High | 35 |
| Confidence: Medium | 16 |
| Confidence: Low | 0 |

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
