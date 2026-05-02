# Prompt template — D-04 / BATCH-1 author new vehicle records

**Purpose:** ask a subagent to AUTHOR complete vehicle spec records with citations, not just verify existing ones.

**Version: v1** (2026-04-23)

**Key difference from d01_verify:** this generates records from scratch. The subagent must respect Long-Range trim rules, generation splitting, and our schema exactly.

## Rules the subagent must obey

- Long-Range trims only: include the longest-range single-motor variant (RWD or FWD) AND the longest-range AWD variant per model. Skip base/standard-range, skip performance/tri-motor.
- Some models only have one variant — that's fine. F-150 Lightning = AWD only. Subaru Solterra = AWD only. Kia Niro PHEV = FWD only. Chrysler Pacifica PHEV = FWD only.
- Distinct entries per generation when a major refresh has changed the battery, thermal system, or charging curve.
- Every `CitedValue<T>` needs a `source` with real URL + name + accessed date.
- Confidence rules:
  - High: ≥2 independent sources agree within ±5%.
  - Medium: 1 reputable source (OEM site, EV-Database, fueleconomy.gov).
  - Low: emergent specs, volatile pricing, or guesswork.
- MSRPs stay Low (Canadian pricing decays monthly).
- iZEV rebate: value 0, Medium confidence, with note about 2025 pause.
- Ontario provincial rebate: value 0, High confidence (correctly reflects 2026 reality).
- All values in metric: km for range, kWh for battery, kW for charging, CAD for MSRP, kg for tow/weight, L for cargo.

## Required fields per vehicle (matches types.ts)

id (kebab-case brand-model-gen-variant),
brand_id,
model, generation_label, year_start, year_end,
powertrain (BEV|PHEV|EREV),
body_style, drivetrain_variant (SINGLE_MOTOR|AWD), trim_label,
battery_kwh_total, battery_kwh_usable, battery_chemistry,
range_km, range_protocol (EPA),
ac_charge_kw_max, dc_charge_kw_max, port_type (NACS|CCS1|CCS2|CHAdeMO|J1772_ONLY),
seats, cargo_l_seats_up, cargo_l_seats_down, tow_rating_kg, weight_kg,
has_heat_pump, thermal_management,
charging_curve_20c (5 points: 10, 20, 40, 60, 80 % SoC),
msrp_cad, federal_izev_cad, provincial_rebate_cad_on,
overall_confidence

## Output contract

Write the complete JSON array to `src/data/new_vehicles.json` with one root object: `{"new_brands": [...], "new_vehicles": [...]}`. Also return a short summary in the response body (counts + notable findings).
