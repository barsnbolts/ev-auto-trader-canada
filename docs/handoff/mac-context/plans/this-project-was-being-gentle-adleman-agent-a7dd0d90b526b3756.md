# Plan: Research 2025 Kia EV9 Wind RWD Long Range and write seed.json fragment

## Conflict notice

The invoking prompt instructs "Execute immediately. Do NOT enter plan mode." but the system reminder states plan mode is active and supersedes all other instructions, including direct edit instructions. Per the system reminder, I cannot run any non-readonly tools (Exa MCP fetches, Write to result.json). Plan documented here for user approval.

## Target output file

`/Users/ianmcadam/Documents/Claude/Projects/EV dashboard/.claude/worktrees/heuristic-jemison-71e592/docs/research/auto/d04/kia-ev9-2025-lr-rwd.result.json`

## Vehicle scope

- 2025 Kia EV9 Wind RWD (Canadian trim)
- Single-motor, RWD
- 99.8 kWh battery (Long Range pack)
- id: `kia-ev9-2025-lr-rwd`, brand_id: `kia`

## Research steps (when un-blocked)

1. Load Exa MCP schemas: `ToolSearch` with `select:mcp__9a04470a-c5be-420d-a32b-adaaa7f50b13__web_search_exa,mcp__9a04470a-c5be-420d-a32b-adaaa7f50b13__web_fetch_exa`
2. Exa search: "2025 Kia EV9 Wind RWD Long Range Canada specs MSRP"
3. Exa fetch (parallel batch):
   - https://www.kia.ca/en/vehicles/ev9 (manufacturer Canadian site — primary source)
   - https://ev-database.org/car/2003/Kia-EV9-Long-Range-RWD (specs)
   - driving.ca review hits (Canadian context for MSRP)
4. WebSearch fallback if Exa returns thin results: NRCan fuel/range data for EV9 RWD

## Field plan

| Field | Expected value | Source priority |
|---|---|---|
| battery_kwh_total | 99.8 | kia.ca / ev-database |
| battery_kwh_usable | ~96 (est) | ev-database |
| range_km | ~492 km EPA (Long Range RWD) | EPA / kia.ca |
| ac_charge_kw_max | 11 (pre-baked) | confirm from kia.ca |
| dc_charge_kw_max | 230 (E-GMP 800V) | kia.ca / Kia US press |
| cargo_l_seats_up | ~570 L (third row up) | kia.ca |
| cargo_l_seats_down | ~2318 L | kia.ca |
| tow_rating_kg | ~2268 kg (5000 lb) | kia.ca |
| weight_kg | ~2520 kg | ev-database / kia.ca |
| has_heat_pump | true (pre-baked) | confirm kia.ca |
| msrp_cad | ~$64,995 (Wind RWD, bare MSRP) | kia.ca |
| federal_izev_cad | 0 (pre-baked, paused) | tc.canada.ca |
| provincial_rebate_cad_on | 0 (pre-baked) | ontario.ca |

## Confidence policy (pre-baked)

- High: ≥3 CA sources within 1%
- Medium: 2 within 5% or 1 kia.ca source
- Low: 1 non-manufacturer source

## Thermal arrays (pre-baked defaults from spec template)

- cold_derate_curve: []
- hvac_draw_kw_by_temp: []
- hp_min_temp_c: -10
- precon_time_by_temp: []
- precon_thermal_gain: 0.85
- dc_cold_soak_curve: []
- charging_curve_20c: []

## Action requested

Either:
1. Exit plan mode to allow the research-and-write to run, OR
2. Confirm I should write the JSON with all numerics as `null` "Low" placeholders (no network fetch), OR
3. Cancel the task.
