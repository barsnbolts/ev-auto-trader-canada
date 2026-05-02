// Vitest suite for the thermal model. Migrated from hand-written asserts.
// Run with: npm test
//
// Covers:
//  - 20°C baseline sanity (range, peak kW, usable kWh)
//  - Winter cold-soaked vs preconditioned vs HVAC behaviors
//  - Summer derate
//  - Confidence downgrade at extremes
//  - rollupConfidence fix (Cluster C C4 adds the regression case)
//
// Golden-value matrix (A12 — 60 asserted cases across 5 vehicles × 3 temps × 2 precon × 2 hvac)
// lives in thermal.golden.test.ts.

import { describe, it, expect } from "vitest";
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

describe("thermal — 20°C baseline", () => {
  const base = computeThermal(FIXTURE, { temp_c: 20, preconditioned: true, hvac_on: false });

  it("range matches rated within 5 km", () => {
    expect(Math.abs(base.range_km - 500)).toBeLessThanOrEqual(5);
  });

  it("peak DC kW matches rated within 5 kW", () => {
    expect(Math.abs(base.peak_dc_kw - 250)).toBeLessThanOrEqual(5);
  });

  it("usable kWh matches stated within 0.5 kWh", () => {
    expect(Math.abs(base.usable_kwh - 75)).toBeLessThanOrEqual(0.5);
  });
});

describe("thermal — winter (-20°C)", () => {
  const coldSoaked = computeThermal(FIXTURE, {
    temp_c: -20,
    preconditioned: false,
    hvac_on: true,
  });
  const preconditioned = computeThermal(FIXTURE, {
    temp_c: -20,
    preconditioned: true,
    hvac_on: false,
  });

  it("cold-soaked range drops substantially below rated", () => {
    expect(coldSoaked.range_km).toBeLessThan(380);
  });

  it("cold-soaked peak DC drops below 100 kW", () => {
    expect(coldSoaked.peak_dc_kw).toBeLessThan(100);
  });

  it("preconditioning raises DC peak vs cold-soaked", () => {
    expect(preconditioned.peak_dc_kw).toBeGreaterThan(coldSoaked.peak_dc_kw);
  });

  it("HVAC-off improves range vs HVAC-on at same ambient", () => {
    expect(preconditioned.range_km).toBeGreaterThan(coldSoaked.range_km);
  });
});

describe("thermal — summer (+35°C, HVAC on)", () => {
  const summer = computeThermal(FIXTURE, { temp_c: 35, preconditioned: true, hvac_on: true });
  const base = computeThermal(FIXTURE, { temp_c: 20, preconditioned: true, hvac_on: false });

  it("range is worse than 20°C idle baseline", () => {
    expect(summer.range_km).toBeLessThan(base.range_km);
  });

  it("peak DC does not exceed 20°C baseline", () => {
    expect(summer.peak_dc_kw).toBeLessThanOrEqual(base.peak_dc_kw + 1);
  });
});

describe("thermal — confidence downgrade at extremes", () => {
  it("-35°C non-preconditioned HVAC-on no longer reports High confidence", () => {
    const extreme = computeThermal(FIXTURE, {
      temp_c: -35,
      preconditioned: false,
      hvac_on: true,
    });
    expect(extreme.confidence).not.toBe("High");
  });
});

describe("rollupConfidence — C4 regression cases", () => {
  it("-10°C High stays High (common Canadian winter day)", () => {
    const r = computeThermal(FIXTURE, { temp_c: -10, preconditioned: true, hvac_on: false });
    expect(r.confidence).toBe("High");
  });

  it("-20°C High stays High (fleet data well-covered)", () => {
    const r = computeThermal(FIXTURE, { temp_c: -20, preconditioned: true, hvac_on: false });
    expect(r.confidence).toBe("High");
  });

  it("-26°C High demotes to Medium (data thinning)", () => {
    const r = computeThermal(FIXTURE, { temp_c: -26, preconditioned: true, hvac_on: false });
    expect(r.confidence).toBe("Medium");
  });

  it("-30°C always returns Low regardless of base", () => {
    const r = computeThermal(FIXTURE, { temp_c: -30, preconditioned: true, hvac_on: false });
    expect(r.confidence).toBe("Low");
  });

  const MEDIUM_FIXTURE: Vehicle = { ...FIXTURE, overall_confidence: "Medium" };

  it("-20°C Medium demotes to Low", () => {
    const r = computeThermal(MEDIUM_FIXTURE, { temp_c: -20, preconditioned: true, hvac_on: false });
    expect(r.confidence).toBe("Low");
  });
});
