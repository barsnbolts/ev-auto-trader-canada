# Plan: Research 2025 Volvo EX30 Twin Motor Performance AWD

## Conflict notice

The user prompt instructs me to "Execute immediately. Do NOT enter plan mode." However, the active system reminder for plan mode explicitly states it supersedes any other instructions, including instructions to make edits. I am therefore producing a plan rather than executing.

If the user (or parent agent) wants execution, they should exit plan mode and re-run.

## Goal

Research the 2025 Volvo EX30 Twin Motor Performance AWD (~69 kWh usable, dual-motor) for the EV Dashboard Canadian seed.json and write ONE result file to:

`/Users/ianmcadam/Documents/Claude/Projects/EV dashboard/.claude/worktrees/heuristic-jemison-71e592/docs/research/auto/d04/volvo-ex30-2025-er-twin.result.json`

## Steps (when executed)

1. Run two parallel Exa MCP searches via `mcp__9a04470a-c5be-420d-a32b-adaaa7f50b13__web_search_exa`:
   - "Volvo EX30 Twin Motor Performance AWD Canada 2025 specs battery range charging"
   - "Volvo EX30 Twin Motor 2024 EPA range kWh DC fast charge curve heat pump"
2. Identify top URLs from volvocars.com/en-ca, ev-database.org, fueleconomy.gov, driving.ca.
3. Batch-fetch top 4-6 URLs via `mcp__9a04470a-c5be-420d-a32b-adaaa7f50b13__web_fetch_exa`.
4. Extract these fields with confidence ratings (High = 3 sources within 1%, Medium = 2 within 5% or 1 volvocars.com/en-ca, Low = single weaker source):
   - battery_kwh_total, battery_kwh_usable (target 69), range_km (EPA preferred)
   - ac_charge_kw_max (likely 11), dc_charge_kw_max (likely 153)
   - cargo_l_seats_up, cargo_l_seats_down, tow_rating_kg (1600), weight_kg
   - has_heat_pump (true), msrp_cad (bare MSRP only)
5. Pre-baked rebate fields:
   - federal_izev_cad: 0 (Transport Canada paused 2026)
   - provincial_rebate_cad_on: 0 (Ontario, no rebate since 2018)
6. Build the JSON object per the exact shape in the prompt:
   - vehicle id: `volvo-ex30-2025-er-twin`
   - powertrain: BEV, body_style: SUV, drivetrain_variant: AWD
   - battery_chemistry: NMC, port_type: CCS1, seats: 5
   - thermal_management: active_liquid, degradation_annual: 0.017
   - thermal_arrays left empty per spec (cold_derate_curve [], etc.)
   - hp_min_temp_c: -10, precon_thermal_gain: 0.85
   - overall_confidence: derived from worst single field rating
7. Write the file via Write tool to the path above.
8. Return one line: `wrote: docs/research/auto/d04/volvo-ex30-2025-er-twin.result.json`

## Budget

- 90 seconds wall clock
- 12k tokens
- Exa MCP first, WebSearch/WebFetch fallback if Exa errors

## Files touched (when executed)

- WRITE: `docs/research/auto/d04/volvo-ex30-2025-er-twin.result.json` (one new JSON file)

No other files modified.
