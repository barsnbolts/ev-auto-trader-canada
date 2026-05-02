# Plan: Research 2025 Kia EV9 Land AWD for seed.json

## Conflict notice
User prompt says "Execute immediately, do NOT enter plan mode."
System reminder says plan mode is active, no writes permitted except this plan file.
Plan-mode reminder wins. Presenting plan instead of executing.

## Target
Write `/Users/ianmcadam/Documents/Claude/Projects/EV dashboard/.claude/worktrees/heuristic-jemison-71e592/docs/research/auto/d04/kia-ev9-2025-lr-awd.result.json` with cited specs for the 2025 Kia EV9 Land AWD (dual-motor, 99.8 kWh).

## Steps (when approved to execute)

1. **Parallel Exa search** (one tool message, three calls):
   - `web_search_exa "2025 Kia EV9 Land AWD specifications battery range Canada kia.ca"`
   - `web_search_exa "Kia EV9 GT-Line AWD 99.8 kWh EPA range DC fast charge curve"`
   - `web_search_exa "EV9 AWD weight cargo tow rating heat pump Canada MSRP"`

2. **Identify 3+ authoritative URLs** from results, prioritizing:
   - kia.ca (Canadian MSRP, trim/spec sheet)
   - ev-database.org (battery, range, charging curve, weight)
   - driving.ca / electricautonomy.ca (Canadian context)
   - insideevs.com / Car and Driver (EPA range, peak DC kW, charging curves)

3. **Parallel Exa fetch** of top 3-5 URLs in one tool message.

4. **Cross-validate fields against tier rules:**
   - High = ≥3 sources within 1%
   - Medium = 2 sources within 5%, OR a single kia.ca primary
   - Low = otherwise

5. **Compose JSON** matching the exact shape in the prompt:
   - vehicle: id `kia-ev9-2025-lr-awd`, brand_id `kia`, NMC chemistry, EPA protocol, CCS1, 7 seats, active_liquid thermal, 0.017 annual degradation
   - cited_fields with `{value, confidence, source: {url, name, accessed: "2026-04-25"}}` for: battery_kwh_total (~99.8), battery_kwh_usable (~96), range_km (EPA AWD ~exact), ac_charge_kw_max (11), dc_charge_kw_max (~210), cargo (seats up/down), tow_rating_kg (~2268 for AWD), weight_kg (~2660), has_heat_pump (true for Canadian-spec), msrp_cad (Land AWD bare, no freight)
   - Pre-baked: federal_izev_cad=0 + provincial_rebate_cad_on=0 (sources already given)
   - thermal_arrays: empty arrays + hp_min_temp_c=-10 + precon_thermal_gain=0.85
   - overall_confidence: Medium (typical for non-LR-spec curve data)

6. **Write JSON** via Write tool to the exact path.

7. **Return one line:** `wrote: docs/research/auto/d04/kia-ev9-2025-lr-awd.result.json`

## Budget
90s wall, 12k tokens. Fallback to WebSearch/WebFetch if Exa misses.

## Awaiting approval to exit plan mode and execute.
