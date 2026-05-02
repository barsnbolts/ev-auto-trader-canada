# Cluster I — OpenEV Data integration

## Goal

Stop hand-curating non-Canadian-specific vehicle specs in `seed.json`. Pull them from the open-source [OpenEV Data dataset](https://github.com/open-ev-data/open-ev-data-dataset) (Apache 2.0) and overlay our Canadian-specific fields on top. Reduces seed maintenance ~70% and gives us a drift-detection story (upstream changes show up as diffs we can review and merge).

## User-visible behavior

Ian sees no functional change in the app — the UI is identical. Behind the scenes:

- Adding a new vehicle goes from a 30-minute hand-curate-and-cite job to "find it in OpenEV, run import script, fill in MSRP and rebate, validate."
- Stale fields (e.g., a manufacturer revising a battery spec) surface as a diff report on demand.

## Acceptance criteria

1. `scripts/openev_import.py <vehicle-id>` script imports a single vehicle from upstream JSON and outputs a partial seed entry (everything except Canadian-specific fields) ready for hand merging.
2. `scripts/openev_diff.py` runs once, comparing every existing `seed.json` vehicle against the latest upstream OpenEV record. Writes a diff report to `logs/diffs/openev_<date>.md` listing fields where values disagree.
3. `validate.py` gains an optional `--openev-check` flag that flags missing-from-upstream vehicles as Medium-confidence "no upstream cross-check available."
4. At least one vehicle in `seed.json` (suggest IONIQ 5 2025+) is re-derived end-to-end via the importer to prove the round-trip works.
5. CLAUDE.md and `docs/medium_mode_playbook.md` document the new "add a vehicle" workflow.

## Inputs / state touched

- New: `scripts/openev_import.py`, `scripts/openev_diff.py`, `data/openev_cache/` (gitignored cache of upstream JSON).
- Edit: `scripts/validate.py`, `CLAUDE.md`, `docs/medium_mode_playbook.md`.
- Edit (optional, only if round-trip test re-derives a vehicle): `src/data/seed.json`.

## Outputs

- A reproducible "import a vehicle" pipeline.
- A weekly drift report (run on demand or via scheduled task).
- Faster onboarding for the next 20 vehicles when scope expands.

## Dependencies

- The OpenEV Data repo's JSON schema. Reference: `https://github.com/open-ev-data/open-ev-data-dataset` — top-level `schema.json`, `/src/`, `/example/`.
- Python 3 + `requests` (or stdlib `urllib`).
- No external API keys.

## Field mapping

The mapping lives in `scripts/openev_import.py` as a constant. Initial draft (refine when implementing):

| Our field | OpenEV field | Notes |
|---|---|---|
| `id` | derived `make-model-trim-year` slug | manual override allowed |
| `brand_id` | `manufacturer` | normalize case |
| `model` | `model` | |
| `generation_label` | `generation` or `model_year_range` | |
| `trim_label` | `trim` | |
| `powertrain` | `powertrain_type` | map BEV/PHEV/EREV/FCEV |
| `body_style` | `body_style` | |
| `drivetrain_variant` | `drivetrain` | RWD/FWD/AWD |
| `seats` | `seating_capacity` | |
| `range_km` | `range.epa` if present, else `range.wltp` | record protocol used |
| `range_protocol` | derived from above | EPA / WLTP / NEDC |
| `battery_kwh_total` | `battery.gross_kwh` | |
| `battery_kwh_usable` | `battery.usable_kwh` | |
| `battery_chemistry` | `battery.chemistry` | NMC / LFP / NCA / etc. |
| `dc_charge_kw_max` | `charging.dc_max_kw` | |
| `ac_charge_kw_max` | `charging.ac_max_kw` | |
| `port_dc` | `charging.dc_port` | CCS1 / NACS / CHAdeMO |
| `weight_kg` | `dimensions.weight_kg` | |
| `cargo_l_seats_up` / `_down` | `dimensions.cargo_l_*` | |
| `tow_rating_kg` | `tow_rating_kg` | |
| `has_heat_pump` | `thermal.heat_pump` | |
| `thermal_management` | `thermal.system_type` | |

**Canadian-only — never imported:**
- `msrp_cad`
- `federal_izev_cad`, `provincial_rebate_cad_on`
- `dealer_availability_canada` (future)
- All thermal-profile fields (`cold_derate_curve`, `hvac_draw_kw_by_temp`, `precon_*`) — these come from Geotab/Recurrent/etc. via `inject_thermal_profiles.py` (now archived) or hand curation.

## Test plan

- Layer 1 (tsc) — unaffected, no TS changes.
- Layer 4 (validate.py) — extended with `--openev-check` flag; a new test fixture in `data/openev_cache/_test/` provides a known-mismatched record, validate.py must flag it.
- Layer 8 (smoke.sh) — adds `python3 scripts/openev_diff.py --dry-run` to confirm script doesn't crash on real upstream data.
- Manual round-trip — re-import IONIQ 5 2025+, diff against current seed entry, expect zero changes on imported fields after one hand-merge pass.

## Open questions

- Which range protocol does OpenEV prioritize for North American models? If `range.epa` is sometimes null where we have a real number, which side wins? **Default decision unless overridden:** keep our value, flag in `notes` field as "EPA value present in seed but absent upstream — verify on next refresh."
- Cache TTL — refresh OpenEV data daily, weekly, or on demand? **Default decision:** weekly, plus on-demand via `--refresh` flag. Avoids repo bloat.
- Schema version pinning — upstream OpenEV could break their schema. **Default decision:** pin to a commit SHA in `scripts/openev_import.py`; bump only when intentionally updating.

## Done when

1. Acceptance criteria 1–5 all green.
2. `python3 scripts/openev_diff.py` runs against current seed.json and produces a sensible diff report.
3. Importer round-trip on one vehicle passes (re-imported entry matches existing seed values for all imported fields).
4. CLAUDE.md and medium playbook updated.
5. Cluster I LEARNINGS entry written by `milestone.py`.

## Reasoning level

- Spec writing (this file): High — judgment-heavy on field mapping, defaults.
- Importer + diff scripts: Medium can implement from this spec. Field mapping is in writing; round-trip test gives a clear pass/fail.
- The round-trip itself + edge cases: Medium-OK if tests are written first.

## Changelog

- 2026-04-24: initial spec at Cluster H closeout.
