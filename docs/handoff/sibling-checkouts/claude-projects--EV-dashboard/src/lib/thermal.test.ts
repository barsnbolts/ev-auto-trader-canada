// Sanity-check the thermal model against physical expectations.
// Run with: npx tsx src/lib/thermal.test.ts    (requires `npm i -D tsx`)
//
// These are assertions, not a real framework, to keep dependencies minimal.

import { computeThermal } from "./thermal";
import type { Vehicle } from "../types";

const FIXTURE: Vehicle = {
  id: "fixture",
  brand_id: "test",
  model: "Fixture",
  generation_label: "v1",
  year_start: 2025,
  year_end: null,
  powertrain: "BEV",
  body_style: "Sedan",
  drivetrain_variant: "AWD",
  trim_label: "Long Range AWD",
  battery_kwh_total: { value: 80, confidence: "High" },
  battery_kwh_usable: { value: 75, confidence: "High" },
  battery_chemistry: "NMC",
  range_km: { value: 500, confidence: "High" },
  range_protocol: "EPA",
  ac_charge_kw_max: { value: 11, confidence: "High" },
  dc_charge_kw_max: { value: 250, confidence: "High" },
  port_type: "NACS",
  seats: 5,
  cargo_l_seats_up: null,
  cargo_l_seats_down: null,
  tow_rating_kg: null,
  weight_kg: null,
  has_heat_pump: { value: true, confidence: "High" },
  thermal_management: "active_liquid",
  charging_curve_20c: [],
  msrp_cad: { value: 70000, confidence: "High" },
  federal_izev_cad: { value: 0, confidence: "High" },
  provincial_rebate_cad_on: { value: 0, confidence: "High" },
  overall_confidence: "High",
};

function assertNear(actual: number, expected: number, tol: number, label: string) {
  const diff = Math.abs(actual - expected);
  if (diff > tol) {
    throw new Error(`${label}: expected ~${expected} ±${tol}, got ${actual.toFixed(2)}`);
  }
}

function assertLess(actual: number, bound: number, label: string) {
  if (actual >= bound) throw new Error(`${label}: expected <${bound}, got ${actual.toFixed(2)}`);
}

// Baseline: at 20 °C, HVAC off, preconditioned — should match rated specs closely.
const base = computeThermal(FIXTURE, { temp_c: 20, preconditioned: true, hvac_on: false });
assertNear(base.range_km, 500, 5, "20C baseline range");
assertNear(base.peak_dc_kw, 250, 5, "20C baseline DC peak");
assertNear(base.usable_kwh, 75, 0.5, "20C baseline usable kWh");

// Winter cold-soaked -20C, HVAC on, heat pump: range should drop substantially, DC peak massively.
const winter = computeThermal(FIXTURE, { temp_c: -20, preconditioned: false, hvac_on: true });
assertLess(winter.range_km, 380, "-20C non-precon range should be <380");
assertLess(winter.peak_dc_kw, 100, "-20C non-precon DC peak should be <100 kW");

// Same cold, but preconditioned + no HVAC -> DC peak recovers, range still dented by battery capacity.
const winterPrecon = computeThermal(FIXTURE, { temp_c: -20, preconditioned: true, hvac_on: false });
if (winterPrecon.peak_dc_kw <= winter.peak_dc_kw) {
  throw new Error("Preconditioning should raise DC peak vs cold-soaked");
}
if (winterPrecon.range_km <= winter.range_km) {
  throw new Error("HVAC-off should improve range vs HVAC-on");
}

// Hot day: +35C, HVAC on. Range should derate modestly; DC peak should derate some.
const summer = computeThermal(FIXTURE, { temp_c: 35, preconditioned: true, hvac_on: true });
if (summer.range_km >= base.range_km) throw new Error("Hot + HVAC should be worse than 20C idle");
if (summer.peak_dc_kw >= base.peak_dc_kw + 1) throw new Error("Hot DC peak should not exceed 20C");

// Confidence should downgrade at extremes.
const extreme = computeThermal(FIXTURE, { temp_c: -35, preconditioned: false, hvac_on: true });
if (extreme.confidence === "High") throw new Error("Confidence should downgrade at -35C");

console.log("✓ thermal.test.ts — all assertions pass");
console.log("  baseline (20C):", base.range_km.toFixed(0), "km,", base.peak_dc_kw.toFixed(0), "kW");
console.log("  winter cold-soaked (-20C, HVAC on):", winter.range_km.toFixed(0), "km,", winter.peak_dc_kw.toFixed(0), "kW");
console.log("  winter precon (-20C, HVAC off):", winterPrecon.range_km.toFixed(0), "km,", winterPrecon.peak_dc_kw.toFixed(0), "kW");
console.log("  summer (35C, HVAC on):", summer.range_km.toFixed(0), "km,", summer.peak_dc_kw.toFixed(0), "kW");
