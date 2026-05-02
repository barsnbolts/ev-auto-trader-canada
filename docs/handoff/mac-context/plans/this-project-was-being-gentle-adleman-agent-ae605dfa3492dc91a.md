# Plan: Research 2025 Kia EV9 Long Range RWD → write seed.json result

## Objective
Produce one JSON file at:
`/Users/ianmcadam/Documents/Claude/Projects/EV dashboard/.claude/worktrees/heuristic-jemison-71e592/docs/research/auto/d04/kia-ev9-2025-lr-rwd.result.json`

Shape pre-specified by caller (vehicle / cited_fields / thermal_arrays / overall_confidence).
Vehicle: 2025 Kia EV9 Long Range RWD, single-motor, 99.8 kWh nominal, longest-range RWD trim, Canadian-market data.

## Pre-baked policy (from caller, do not re-ask)
- MSRP = bare kia.ca config price BEFORE freight/PDI/AC tax/dealer fees. Subtract ~$2,200 freight only if a press source quotes "as delivered, includes freight".
- Range protocol: EPA preferred. NRCan or WLTP fallback (set `range_protocol` accordingly).
- Confidence rubric: High = ≥3 independent CA sources within 1%. Medium = 2 within 5% OR 1 manufacturer .ca. Low = 1 non-manufacturer or USD-converted.
- iZEV = 0, Ontario rebate = 0. Both with the URLs the caller pre-supplied (Transport Canada paused-2026 page; ontario.ca EV page).
- thermal_arrays: leave EMPTY arrays + `hp_min_temp_c: -10` + `precon_thermal_gain: 0.85` defaults. Rust thermal model uses inline defaults when arrays are empty.

## Source order (from caller)
1. Exa `web_search_exa` — query: `2025 Kia EV9 Long Range RWD Canada specs MSRP`
2. Exa `web_fetch_exa` on best three URLs:
   - kia.ca configurator / spec page for EV9
   - ev-database.org EV9 Long Range RWD page
   - driving.ca review (Canadian press)
3. WebSearch / WebFetch fallback only.

## Step-by-step (when plan mode lifts)

1. **Confirm output dir exists** — `ls .../docs/research/auto/d04/` already showed the directory exists (`hyundai-kona-electric-2025-...` files present). No mkdir needed.

2. **Exa search** — one call:
   `mcp__9a04470a-c5be-420d-a32b-adaaa7f50b13__web_search_exa`
   query: `2025 Kia EV9 Long Range RWD Canada specifications MSRP kWh range km`
   numResults: 8

3. **Exa fetch** — one batched call with 3 URLs in `urls[]`:
   - https://www.kia.ca/en/electric-vehicles/ev9 (or the specific spec/configurator page)
   - https://ev-database.org/car/2127/Kia-EV9-Long-Range-RWD (or the current slug)
   - one driving.ca / electricautonomy.ca / motortrend.ca review URL surfaced by step 2
   maxCharacters: 6000

4. **Cross-reference each numeric field** against the captured pages, applying confidence rubric:
   - battery_kwh_total — kia.ca spec sheet primary. Anchor hint: 99.8 kWh.
   - battery_kwh_usable — usually quoted by Kia as "99.8 nominal / ~96 usable". ev-database confirms.
   - range_km — EPA in km if cited; else NRCan (Canada-official). Anchor: ~491 km EPA → confirm.
   - ac_charge_kw_max — 11 kW onboard (standard for E-GMP).
   - dc_charge_kw_max — 800V architecture; ~233 kW peak per Kia.
   - cargo_l_seats_up / down — kia.ca dimensions. Anchors: 333 L / 2318 L.
   - tow_rating_kg — RWD trim ~1588 kg / 3500 lb.
   - weight_kg — curb weight ~2540 kg.
   - has_heat_pump — TRUE (standard on EV9 for cold-climate spec).
   - msrp_cad — kia.ca configurator bare price. Anchor: $64,995 (verify; 2025 MY may differ from 2024).
   - federal_izev_cad = 0, provincial_rebate_cad_on = 0 (hardcoded with caller-supplied URLs).

5. **port_type decision** — caller specified `"NACS"` in the example. NOTE: 2025 EV9 in Canada actually ships with **CCS1**; NACS adapter promised, native NACS port begins 2025+ MY in some markets. Need to verify against kia.ca / press. If kia.ca still lists CCS1 for the 2025 CA model, set `"port_type": "CCS1"` and flag in notes — caller's example values are explicitly labeled "HINTS to anchor your search; replace with what your sources actually say."

6. **Assemble JSON** matching caller's exact shape. Each cited_field = `{value, confidence, source: {url, name, accessed: "2026-04-25"}}`. Fields where Canadian sources disagree → mark `Medium`.

7. **Write the file** with the `Write` tool (single call, single JSON document, UTF-8, 2-space indent for readability).

8. **Return one line**: `wrote: docs/research/auto/d04/kia-ev9-2025-lr-rwd.result.json`. No other prose, no questions. (Per caller's explicit instruction.)

## Budget tracking
- 90 s wall-clock, 12k tokens output cap.
- 1 Exa search + 1 batched Exa fetch (3 URLs) + 1 Write = 3 tool calls in the implementation phase.
- Final assistant message = single line.

## Risks / open questions (none requiring user input)
- `port_type` may need to be CCS1 not NACS — resolve from kia.ca during fetch.
- 2025 vs 2024 MY MSRP — kia.ca configurator is canonical; if it shows only 2025, use that.
- If kia.ca lists range only in NRCan (combined km), use it and set `range_protocol: "NRCan"`. EPA values come from fueleconomy.gov which is US-only — acceptable as one of 3 sources but not Canadian.

## Files this plan will touch (when executed)
- WRITE: `docs/research/auto/d04/kia-ev9-2025-lr-rwd.result.json` (new file, ~2 KB)
- No other writes. No commits. No edits to seed.json (that's a separate downstream step the caller will handle).
