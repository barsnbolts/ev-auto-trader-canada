# Plan: Research 2025 BMW i4 xDrive40 AWD for seed.json

## Goal
Produce a single JSON file at:
`/Users/ianmcadam/Documents/Claude/Projects/EV dashboard/.claude/worktrees/heuristic-jemison-71e592/docs/research/auto/d04/bmw-i4-2025-lr-awd.result.json`

Containing fully-cited Canadian-market spec data for the 2025 BMW i4 xDrive40 AWD per the EV Dashboard schema (vehicle, cited_fields, thermal_arrays, overall_confidence).

## Steps (when plan-mode released)

### 1. Verify output directory exists
- Confirmed `docs/research/auto/d04/` does not yet exist (Bash check above returned "need to create")
- `mkdir -p` the path before write

### 2. Parallel research dispatch (single tool message, ~6 calls)
Per CLAUDE.md "parallel-dispatch is the default for ANY research touching >=3 facts or >=2 sources". Dispatch in ONE batch:

a. `mcp__9a04470a...__web_search_exa` — "BMW i4 xDrive40 2025 Canada specifications battery range"
b. `mcp__9a04470a...__web_search_exa` — "BMW i4 xDrive40 2025 MSRP Canada bmw.ca price"
c. `mcp__9a04470a...__web_search_exa` — "BMW i4 xDrive40 EPA range kWh battery DC fast charging kW"
d. `mcp__9a04470a...__web_search_exa` — "BMW i4 xDrive40 cargo trunk litres weight curb heat pump"
e. `WebFetch` — `https://ev-database.org/car/1907/BMW-i4-eDrive40` (and xDrive40 sibling page) for usable kWh + DC peak
f. `WebFetch` — `https://www.fueleconomy.gov/feg/Find.do?action=sbs&id=46824` (fueleconomy.gov 2025 i4 xDrive40 entry) for EPA range

If Exa rate-limits, fallback to native `WebSearch` + `WebFetch` against the same URL set.

### 3. Source priority (per pre-baked policy in user prompt)
- bmw.ca → Canadian MSRP (bare, no freight/PDI), bmw.ca authority for HP/specs
- fueleconomy.gov → EPA range (preferred protocol)
- ev-database.org → battery total + usable kWh, DC peak, AC max
- driving.ca → Canadian editorial corroboration

Confidence rule:
- High = >=3 CA-relevant sources within 1%
- Medium = 2 within 5% OR 1 bmw.ca official source
- Low = 1 non-manufacturer source

### 4. Known-good baseline values to verify (from training, must be source-cited before writing)
| Field | Expected value | Why |
|---|---|---|
| battery_kwh_total | 83.9 | BMW spec sheet figure |
| battery_kwh_usable | ~81.0 | ev-database typical figure |
| range_km | ~488 km (303 mi EPA xDrive40 19" wheel) | EPA |
| ac_charge_kw_max | 11 | pre-baked in template |
| dc_charge_kw_max | 205 | pre-baked in template |
| cargo_l_seats_up | ~470 L | BMW Gran Coupe |
| cargo_l_seats_down | ~1290 L | BMW Gran Coupe |
| weight_kg | ~2125 | xDrive curb |
| has_heat_pump | true | i4 ships standard with heat pump |
| msrp_cad | ~$67,500-69,000 | bmw.ca 2025 — must verify exact bare MSRP |

All values above are placeholders — must NOT be written without a corroborating live source pulled in step 2.

### 5. Compose JSON exactly per schema in user prompt
- Pre-baked fixed values: tow_rating_kg=0/High/notes; federal_izev_cad=0; provincial_rebate_cad_on=0 (with provided URLs/dates)
- Each cited_field gets: value, confidence, source {url, name, accessed: "2026-04-25"}
- thermal_arrays: keep arrays empty (curves not in scope of this research) but populate hp_min_temp_c=-10 and precon_thermal_gain=0.85 per template
- overall_confidence = lowest of any field marked Medium or higher; downgrade to Low if any single field is Low

### 6. Write file
Write to absolute path. Single output line afterward:
`wrote: docs/research/auto/d04/bmw-i4-2025-lr-awd.result.json`

## Budget
- 90 sec wall clock, 12k tokens out — achievable because all research is parallel and compose is mechanical.

## Risk / fallback
- If bmw.ca returns nothing for 2025 (model-year transition), fall back to bmw.ca 2024 spec page + driving.ca 2025 review + mark msrp confidence Medium with note "2025 model year, 2024 spec pages still authoritative pending refresh".
- If EPA has no entry for 2025 xDrive40 yet, use 2024 EPA value and label confidence Medium.

## Awaiting
User to exit plan mode so I can dispatch the parallel research batch and write the result JSON.
