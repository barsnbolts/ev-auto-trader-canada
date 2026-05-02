# Plan: Research 2025 BMW i4 xDrive40 AWD for seed.json

## Goal
Research the 2025 BMW i4 xDrive40 (dual-motor AWD, ~84 kWh) and write one
JSON result file to:
`docs/research/auto/d04/bmw-i4-2025-lr-awd.result.json`

## Steps

1. **Exa parallel search** — fire `web_search_exa` queries in parallel:
   - "2025 BMW i4 xDrive40 specs battery kWh EPA range Canada"
   - "BMW i4 xDrive40 DC fast charging kW peak"
   - "BMW i4 xDrive40 cargo trunk litres curb weight kg"
   - "BMW i4 xDrive40 heat pump CCS1 AC charging 11 kW"
   - "BMW i4 xDrive40 MSRP CAD bmw.ca 2025"

2. **Exa fetch** — `web_fetch_exa` on top hits from:
   - bmw.ca (official Canadian MSRP + specs)
   - ev-database.org (battery, range, charge curves)
   - fueleconomy.gov (EPA range)
   - driving.ca / electrekreviews
   - InsideEVs / Car and Driver for charging curve

3. **Cross-reference** — three sources within 1% = High; two within 5% or
   one bmw.ca = Medium; otherwise Low.

4. **Pre-baked values** (no research needed):
   - `tow_rating_kg`: 0, High ("Not rated for towing in North America.")
   - `federal_izev_cad`: 0, High (Transport Canada paused 2026)
   - `provincial_rebate_cad_on`: 0, High (Ontario no rebate since 2018)
   - `ac_charge_kw_max`: 11 (J1772 standard, BMW i4 spec)
   - `port_type`: CCS1 (NA market)
   - `battery_chemistry`: NMC
   - `thermal_management`: active_liquid
   - `has_heat_pump`: true (standard on i4)
   - `degradation_annual`: 0.017 (BMW NMC active-liquid baseline)

5. **Write result** — single JSON file at the target path with shape from
   the user prompt. Empty thermal arrays (filled in later phase).
   `overall_confidence`: Medium (single bmw.ca + 1-2 corroborating).

6. **Return** one line: `wrote: docs/research/auto/d04/bmw-i4-2025-lr-awd.result.json`

## Budget
90s wall, 12k tokens.

## Tools used
- mcp__9a04470a-c5be-420d-a32b-adaaa7f50b13__web_search_exa
- mcp__9a04470a-c5be-420d-a32b-adaaa7f50b13__web_fetch_exa
- WebSearch / WebFetch fallback
- Write
