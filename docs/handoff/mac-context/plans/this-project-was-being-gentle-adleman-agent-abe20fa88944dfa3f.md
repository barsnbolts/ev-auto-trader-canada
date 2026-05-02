# Plan: Research 2025 BMW i4 eDrive40 -> seed.json fragment

## Goal
Produce one JSON file at:
`docs/research/auto/d04/bmw-i4-2025-lr-rwd.result.json`

Shape and id pre-specified by caller. Fill numerics from CA-priority sources.

## Steps

1. **Exa web_search_exa** — query "2025 BMW i4 eDrive40 Canada specs MSRP range Gran Coupe", numResults 8. Identify top hits from bmw.ca, ev-database.org, driving.ca, fueleconomy.gov, caranddriver.com.

2. **Exa web_fetch_exa (batched, single call, 4 URLs in parallel)**:
   - bmw.ca i4 eDrive40 build/specs page
   - ev-database.org BMW i4 eDrive40 (2024+ refresh)
   - fueleconomy.gov 2025 BMW i4 eDrive40
   - driving.ca or autotrader.ca review/listing for CAD MSRP confirmation

3. **WebSearch fallback** if any field still null after step 2 (e.g. cargo L, weight kg, heat-pump confirmation).

4. **Tally per field** with confidence rule:
   - High = >=3 CA sources within 1%
   - Medium = 2 sources within 5%, or single bmw.ca
   - Low = 1 non-manufacturer / USD-converted / null

5. **Pre-baked fields** (skip research):
   - `tow_rating_kg`: 0 / High / "Not rated for towing in North America."
   - `federal_izev_cad`: 0 / High / TC iZEV paused 2026 URL
   - `provincial_rebate_cad_on`: 0 / High / Ontario no-rebate URL
   - `ac_charge_kw_max`: 11 (BMW spec)
   - `dc_charge_kw_max`: 205 (BMW spec, peak)

6. **Thermal arrays** — leave empty arrays / pre-baked values per template (`hp_min_temp_c: -10`, `precon_thermal_gain: 0.85`). BMW i4 has heat pump standard in CA (confirm via bmw.ca).

7. **Write JSON file** to the target path. Single line stdout: `wrote: docs/research/auto/d04/bmw-i4-2025-lr-rwd.result.json`.

## Expected fields needed from research

| Field | Likely source | Likely value (sanity) |
|---|---|---|
| battery_kwh_total | bmw.ca / ev-db | ~83.9 kWh |
| battery_kwh_usable | ev-db | ~81.3 kWh |
| range_km | fueleconomy.gov EPA -> km | ~482 km (300 mi EPA) |
| cargo_l_seats_up | bmw.ca | ~470 L |
| cargo_l_seats_down | bmw.ca | ~1290 L |
| weight_kg | bmw.ca curb | ~2125 kg |
| has_heat_pump | bmw.ca | true (standard) |
| msrp_cad | bmw.ca 2025 | ~$61,500 CAD bare MSRP |

## Budget
90 sec wall clock, 12k output tokens. One file written. No code edits, no commits.

## Risk
- BMW Canada sometimes lists 2024 MY only for early-2026 access; if 2025 MY page is gated, accept 2024 specs (battery and range unchanged for eDrive40 since 2024 refresh) and mark Medium.
- MSRP volatility post-tariff news — pin to bmw.ca on access date 2026-04-25.
