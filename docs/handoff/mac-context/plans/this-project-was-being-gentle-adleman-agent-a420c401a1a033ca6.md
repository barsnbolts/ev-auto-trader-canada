# Plan: Research 2025 Kia EV9 Land AWD for seed.json

## Goal
Research the 2025 Kia EV9 Land AWD (dual-motor 99.8 kWh, longest-range AWD trim) and write a single JSON result file to:
`/Users/ianmcadam/Documents/Claude/Projects/EV dashboard/.claude/worktrees/heuristic-jemison-71e592/docs/research/auto/d04/kia-ev9-2025-lr-awd.result.json`

## Approach (when plan mode is exited)

### Step 1: Parallel research dispatch (single tool message, multiple calls)
- `mcp__9a04470a-c5be-420d-a32b-adaaa7f50b13__web_search_exa` query: "2025 Kia EV9 Land AWD Canada specs MSRP range kWh"
- `mcp__9a04470a-c5be-420d-a32b-adaaa7f50b13__web_search_exa` query: "Kia EV9 Land 99.8 kWh DC fast charging curve EPA range km"
- `WebSearch` query: "2025 Kia EV9 Land AWD kia.ca price Ontario"
- `WebSearch` query: "Kia EV9 GT-Line AWD vs Land AWD specs Canada 2025"

### Step 2: Targeted fetches for canonical sources
- `mcp__9a04470a-c5be-420d-a32b-adaaa7f50b13__web_fetch_exa` URLs (batch in one call):
  - `https://www.kia.ca/en/ev9` — manufacturer.ca for MSRP, trim specs, cargo, weight
  - `https://ev-database.org/car/2076/Kia-EV9-Long-Range-AWD` — battery usable, range, charging
  - `https://driving.ca/kia/ev9` — Canadian review for range/MSRP cross-check

### Step 3: Confidence scoring (per pre-baked policy)
- High = ≥3 CA sources agree within 1%
- Medium = 2 sources within 5% OR 1 manufacturer.ca source
- Low = 1 non-manufacturer or USD-converted

### Step 4: Field assembly with known anchors
Pre-known/fixed values from prompt:
- `battery_kwh_total`: 99.8 (gross pack)
- `ac_charge_kw_max`: 11
- `dc_charge_kw_max`: 233 (peak via 800V architecture)
- `tow_rating_kg`: 2268 (5000 lb conversion)
- `federal_izev_cad`: 0 (paused 2026)
- `provincial_rebate_cad_on`: 0 (no ON rebate since 2018)
- `degradation_annual`: 0.017 (NMC default)
- `thermal_management`: active_liquid
- `port_type`: NACS (2025+ Kia transition; verify in research)
- `seats`: 7 (Land trim is 7-seat captain config or 6-seat — verify)

Fields to research:
- `battery_kwh_usable` (~96 expected, ev-database.org)
- `range_km` (EPA → km conversion, expect ~435-450 km AWD)
- `cargo_l_seats_up` and `cargo_l_seats_down`
- `weight_kg` (curb weight, ~2664 kg expected)
- `has_heat_pump` (verify standard on Land or option)
- `msrp_cad` (bare price, no freight/PDI — kia.ca configurator)

### Step 5: Thermal arrays
Use defaults consistent with NMC + 800V + heat-pump SUV class:
- `cold_derate_curve`: empty or default Recurrent-style curve
- `hvac_draw_kw_by_temp`: empty (filled later by thermal model)
- `hp_min_temp_c`: -10
- `precon_time_by_temp`: empty
- `precon_thermal_gain`: 0.85
- `dc_cold_soak_curve`: empty
- `charging_curve_20c`: empty (filled later from Fastned/Bjorn data, or include rough 5-point if found)

### Step 6: Write result file
Single JSON write to the target path. Validate JSON shape matches the prompt spec exactly (vehicle / cited_fields / thermal_arrays / overall_confidence keys).

### Step 7: Return
One line: `wrote: docs/research/auto/d04/kia-ev9-2025-lr-awd.result.json`

## Budget
- 90 seconds wall-clock
- 12k tokens output
- Parallel dispatch is mandatory (per CLAUDE.md research-first rule + parallel-dispatch default for ≥3 facts)

## Risks / Open questions
- NACS port: 2025 Kia EV9 in Canada may still be CCS Combo until adapter rollout — research must confirm. If CCS, override `port_type` to "CCS_Combo".
- Land trim availability in Canada: confirm Land is sold in Canada vs. only Wind/GT-Line. If not, fall back to closest equivalent (Wind AWD) and update id/trim_label.
- Heat pump: may be optional Cold Weather Package — note in confidence if so.
