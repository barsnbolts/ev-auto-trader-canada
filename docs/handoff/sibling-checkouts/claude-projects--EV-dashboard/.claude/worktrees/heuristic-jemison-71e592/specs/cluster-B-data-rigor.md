# Cluster B — Data Rigor

## Goal

Make every number in the app traceable to a real source, and make the physics model honest about per-vehicle differences. Right now the thermal model runs on generic NMC curves — every vehicle gets the same cold-weather math regardless of whether it has a Tesla Octovalve or no heat pump at all. Cluster B fixes that.

Two parallel tracks:

1. **Per-vehicle thermal profiles** (B1–B2): Populate the cold-derate curve, HVAC draw, heat-pump cutoff, and preconditioning data that each vehicle's real thermal system produces. Update `thermal.ts` to prefer this data over generic chemistry defaults.

2. **Source verification** (B3–B4): Run an Exa pass to verify MSRPs, battery sizes, and range ratings against current published sources. Upgrade Medium→High where ≥ 2 independent sources agree. Keep Medium (or add notes) where they disagree.

## User-visible behavior

- The compare view already has a thermal slider. After B1–B2, the numbers it produces will be vehicle-specific: the IONIQ 5 (800V platform, good heat pump) will show less cold-weather DC derate than the F-150 Lightning (400V, no heat pump).
- A `computationNotes` field will surface in the breakdown: "Used per-vehicle cold derate curve (Geotab fleet dataset)" vs "Used NMC chemistry default."
- After B3, more vehicles will show a green "H" badge instead of amber "M" — because we now have two sources that agree.

## New fields added to each vehicle (B1)

| Field | Type | What it means |
|---|---|---|
| `cold_derate_curve` | `ThermalPoint[]` | Capacity fraction at each temperature. Overrides chemistry default. |
| `hvac_draw_kw_by_temp` | `ThermalPoint[]` | HVAC kW draw at each temp for THIS vehicle. |
| `hp_min_temp_c` | `number` | Temperature (°C) below which heat pump falls back to resistive. |
| `precon_time_by_temp` | `ThermalPoint[]` | Minutes to precondition at each ambient temp. |
| `precon_thermal_gain` | `number` | Fraction of cold-soak DC derate recovered by preconditioning (0–1). |
| `dc_cold_soak_curve` | `ThermalPoint[]` | DC peak factor vs temp, cold-soaked. Captures 800V vs 400V advantage. |

All fields are **optional** — thermal.ts falls back to chemistry defaults if absent.

## Acceptance criteria

1. All 20 vehicles have at least `cold_derate_curve` + `hp_min_temp_c` populated (B1).
2. At least 15/20 have `dc_cold_soak_curve` populated (B1).
3. `thermal.ts` prefers per-vehicle fields over chemistry defaults (B2). Toggle test: delete one vehicle's `cold_derate_curve`, confirm model falls back gracefully.
4. `ThermalOutputs` includes `computationNotes: string[]` (B2).
5. All 60 golden-value invariants still pass after B2 changes (no regression).
6. At least 12/20 vehicles upgrade from Medium → High confidence after B3.
7. Tesla Model Y Juniper has a B4 deep-dive note in `notes` explaining what's known vs TBD.
8. Monthly iZEV/MSRP drift task is scheduled (B5).
9. `validate.py` exits green (warnings OK — source URLs still pre-B3; B3 fills some).
10. `scripts/smoke.sh` green.

## Data sources (B1)

Primary:
- Geotab "EV Fleet Winter Range Study" — fleet-wide cold derate by model
  https://www.geotab.com/blog/ev-range/
- Recurrent Auto cold-weather range reports (2023–2024 fleet data)
  https://www.recurrentauto.com/research/winter-ev-range-loss
- Fastned real-world charging speed data by temperature
  https://support.fastned.nl/hc/en-gb/articles/360007516494
- Bjørn Nyland YouTube channel (1000 km Challenge, cold-weather real-world tests)
  https://www.youtube.com/@BjornNyland
- P3 Group charging-curve tests (DC peak vs SOC vs temperature)
  https://www.p3-group.com/en/p3-charging-index/

Supplemental:
- InsideEVs real-world cold weather range tests
- EV Database (ev.energy) for HVAC draw estimates
- Manufacturer technical documentation where publicly available

## Inputs / state touched

| File | Change |
|---|---|
| `src/types.ts` | Add 6 optional fields to `Vehicle` interface |
| `src/data/schema.ts` | Add optional Zod validators for new fields |
| `src/data/seed.json` | Populate new fields for all 20 vehicles |
| `src/lib/thermal.ts` | Use per-vehicle fields when present; add `computationNotes` |
| `src/lib/thermal.golden.test.ts` | Confirm 60 invariants still pass |

## 800V platform distinction (important)

Hyundai/Kia E-GMP vehicles (IONIQ 5, IONIQ 6, EV6) use an 800V architecture. At the same DC power level, current is halved → half the resistive heating penalty in cold cells → they maintain better DC peak in cold weather. The `dc_cold_soak_curve` for these vehicles should reflect this empirically (Fastned/P3 data shows ~45–55% peak at −20 °C cold-soaked vs ~30–40% for 400V equivalents).

## Vehicle thermal profile summary (B1 targets)

| Vehicle | HP | Arch | Cold derate (−20°C) | DC cold-soak (−20°C) | Source |
|---|---|---|---|---|---|
| Tesla Model 3 Highland RWD/AWD | ✅ Octovalve | 400V | ~78–82% rated | ~35–38% | Recurrent/Bjorn |
| Tesla Model Y Juniper | ✅ Octovalve | 400V | ~78–82% rated | ~35–38% | Limited data (Low) |
| Hyundai IONIQ 5 2025 | ✅ HP | 800V | ~80–84% rated | ~45–52% | Fastned/P3/Bjorn |
| Kia EV6 2025 | ✅ HP | 800V | ~80–84% rated | ~45–52% | Fastned/P3 |
| Ford Mach-E 2024 ER | ✅ HP | 400V | ~72–76% rated | ~32–36% | InsideEVs |
| Ford F-150 Lightning ER | ❌ No HP | 400V | ~65–70% rated | ~30–34% | InsideEVs |
| Chevy Equinox EV | ✅ HP | 400V | ~75–79% rated | ~33–37% | Limited data |
| Rivian R1S Gen 2 | ✅ HP | 400V | ~75–80% rated | ~35–40% | Rivian specs/owners |
| Toyota RAV4 Prime | ❌ No HP (gas backup) | 400V | PHEV: limited concern | N/A (J1772 only) | Toyota |
| Hyundai IONIQ 6 | ✅ HP | 800V | ~80–84% rated | ~45–52% | Fastned/P3 |
| VW ID.4 Pro | ✅ HP (limited) | 400V | ~72–76% rated | ~30–34% | InsideEVs |
| Polestar 2 LR | ✅ HP | 400V | ~76–80% rated | ~33–37% | P3/Bjorn |

## Test plan

- **Layer 5** (golden-value physics regression): all 60 invariants must pass post-B2.
- **Layer 1** (tsc): `types.ts` + `schema.ts` changes must type-check.
- **Layer 3** (Zod): bad seed.json shapes caught on import.
- **Layer 4** (validate.py): run with warnings; no new failures.
- Chrome-MCP walkthrough at cluster exit: drag slider to −20°C → IONIQ 5 shows better DC than Lightning.

## Open questions (resolved before implementation)

- **B4 Tesla Y Juniper**: NA production specs are still stabilizing as of Apr 2026. Will mark Medium with a clear `notes` field. Do not guess; mark Low if a spec is absent.
- **B5 scheduled task**: Uses `mcp__scheduled-tasks__create_scheduled_task` — check whether monthly recurrence is supported or if weekly is safer. Monthly preferred.

## Done when

- [ ] `specs/cluster-B-data-rigor.md` exists and Ian has read it
- [ ] `seed.backup.json` created before any seed.json edits
- [ ] All 20 vehicles have thermal profile fields
- [ ] `thermal.ts` B2 changes pass all 60 golden tests
- [ ] B3 Exa pass complete → at least 12 vehicles at High
- [ ] B4 Juniper notes in place
- [ ] B5 monthly task scheduled
- [ ] `validate.py` green (no failures; expected warnings OK)
- [ ] `scripts/smoke.sh` green
- [ ] `python3 scripts/milestone.py cluster-B "thermal profiles + exa pass"` exits 0

## Changelog

- 2026-04-23: initial spec.
