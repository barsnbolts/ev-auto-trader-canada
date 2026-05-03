// Sanity-check the thermal model against physical expectations.
// Ported verbatim from sibling EV dashboard (src/lib/thermal.test.ts).
// Adapted: uses realRangeKm / computeThermalFull instead of computeThermal(Vehicle,...).
//
// Run with: npx tsx src/lib/thermal.test.ts    (requires `npm i -D tsx`)
//
// These are assertions, not a real framework, to keep dependencies minimal.

import { realRangeKm, computeThermalFull } from "./thermal";
import type { FullThermalSpec } from "./thermal";

const FIXTURE: FullThermalSpec = {
  range_km: 500,
  battery_kwh_usable: 75,
  dc_charge_kw_max: 250,
  chemistry: "NMC",
  has_heat_pump: true,
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
const base = computeThermalFull(FIXTURE, { temp_c: 20, preconditioned: true, hvac_on: false });
assertNear(base.range_km, 500, 5, "20C baseline range");
assertNear(base.peak_dc_kw, 250, 5, "20C baseline DC peak");
assertNear(base.usable_kwh, 75, 0.5, "20C baseline usable kWh");

// Winter cold-soaked -20C, HVAC on, heat pump: range should drop substantially, DC peak massively.
const winter = computeThermalFull(FIXTURE, { temp_c: -20, preconditioned: false, hvac_on: true });
assertLess(winter.range_km, 380, "-20C non-precon range should be <380");
assertLess(winter.peak_dc_kw, 100, "-20C non-precon DC peak should be <100 kW");

// Same cold, but preconditioned + no HVAC -> DC peak recovers, range still dented by battery capacity.
const winterPrecon = computeThermalFull(FIXTURE, { temp_c: -20, preconditioned: true, hvac_on: false });
if (winterPrecon.peak_dc_kw <= winter.peak_dc_kw) {
  throw new Error("Preconditioning should raise DC peak vs cold-soaked");
}
if (winterPrecon.range_km <= winter.range_km) {
  throw new Error("HVAC-off should improve range vs HVAC-on");
}

// Hot day: +35C, HVAC on. Range should derate modestly; DC peak should derate some.
const summer = computeThermalFull(FIXTURE, { temp_c: 35, preconditioned: true, hvac_on: true });
if (summer.range_km >= base.range_km) throw new Error("Hot + HVAC should be worse than 20C idle");
if (summer.peak_dc_kw >= base.peak_dc_kw + 1) throw new Error("Hot DC peak should not exceed 20C");

// Confidence should downgrade at extremes.
const extreme = computeThermalFull(FIXTURE, { temp_c: -35, preconditioned: false, hvac_on: true });
if (extreme.confidence === "High") throw new Error("Confidence should downgrade at -35C");

// realRangeKm surface test: cold-soaked -20°C with heat pump should be less than at +20°C.
const warm = realRangeKm({ epaKm: 500, batteryKwh: 75, hasHeatPump: true, tempC: 20 });
const cold = realRangeKm({ epaKm: 500, batteryKwh: 75, hasHeatPump: true, tempC: -20 });
if (warm == null || cold == null) throw new Error("realRangeKm should not return null with valid inputs");
if (cold >= warm) throw new Error("Cold range should be less than warm range");

console.log("✓ thermal.test.ts — all assertions pass");
console.log("  baseline (20C):", base.range_km.toFixed(0), "km,", base.peak_dc_kw.toFixed(0), "kW");
console.log("  winter cold-soaked (-20C, HVAC on):", winter.range_km.toFixed(0), "km,", winter.peak_dc_kw.toFixed(0), "kW");
console.log("  winter precon (-20C, HVAC off):", winterPrecon.range_km.toFixed(0), "km,", winterPrecon.peak_dc_kw.toFixed(0), "kW");
console.log("  summer (35C, HVAC on):", summer.range_km.toFixed(0), "km,", summer.peak_dc_kw.toFixed(0), "kW");
console.log("  realRangeKm warm/cold:", warm.toFixed(0), "km /", cold.toFixed(0), "km");
