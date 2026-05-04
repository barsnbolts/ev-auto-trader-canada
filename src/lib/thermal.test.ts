// Vitest specs for the thermal model. Anchor against physical expectations
// so cold-weather range, preconditioning, and DC peak derating stay sane
// across refactors.
//
// Run: npx vitest run

import { describe, it, expect } from "vitest";
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

describe("computeThermalFull", () => {
  it("at 20°C, preconditioned, HVAC off → matches rated specs", () => {
    const base = computeThermalFull(FIXTURE, { temp_c: 20, preconditioned: true, hvac_on: false });
    expect(base.range_km).toBeCloseTo(500, -1);  // within ±5
    expect(base.peak_dc_kw).toBeCloseTo(250, -1);
    expect(base.usable_kwh).toBeCloseTo(75, 0);
  });

  it("at -20°C cold-soaked, HVAC on → range <380, DC peak <100kW", () => {
    const winter = computeThermalFull(FIXTURE, { temp_c: -20, preconditioned: false, hvac_on: true });
    expect(winter.range_km).toBeLessThan(380);
    expect(winter.peak_dc_kw).toBeLessThan(100);
  });

  it("preconditioning raises DC peak + range vs cold-soaked", () => {
    const winter = computeThermalFull(FIXTURE, { temp_c: -20, preconditioned: false, hvac_on: true });
    const precon = computeThermalFull(FIXTURE, { temp_c: -20, preconditioned: true, hvac_on: false });
    expect(precon.peak_dc_kw).toBeGreaterThan(winter.peak_dc_kw);
    expect(precon.range_km).toBeGreaterThan(winter.range_km);
  });

  it("hot day with HVAC derates vs 20°C baseline", () => {
    const base = computeThermalFull(FIXTURE, { temp_c: 20, preconditioned: true, hvac_on: false });
    const summer = computeThermalFull(FIXTURE, { temp_c: 35, preconditioned: true, hvac_on: true });
    expect(summer.range_km).toBeLessThan(base.range_km);
    expect(summer.peak_dc_kw).toBeLessThanOrEqual(base.peak_dc_kw + 1);
  });

  it("confidence downgrades at temperature extremes", () => {
    const extreme = computeThermalFull(FIXTURE, { temp_c: -35, preconditioned: false, hvac_on: true });
    expect(extreme.confidence).not.toBe("High");
  });
});

describe("realRangeKm", () => {
  it("cold (-20°C) returns less range than warm (+20°C) with heat pump", () => {
    const warm = realRangeKm({ epaKm: 500, batteryKwh: 75, hasHeatPump: true, tempC: 20 });
    const cold = realRangeKm({ epaKm: 500, batteryKwh: 75, hasHeatPump: true, tempC: -20 });
    expect(warm).not.toBeNull();
    expect(cold).not.toBeNull();
    expect(cold!).toBeLessThan(warm!);
  });

  it("no heat pump degrades cold-weather range further", () => {
    const withHP = realRangeKm({ epaKm: 500, batteryKwh: 75, hasHeatPump: true, tempC: -10 });
    const noHP = realRangeKm({ epaKm: 500, batteryKwh: 75, hasHeatPump: false, tempC: -10 });
    expect(withHP).not.toBeNull();
    expect(noHP).not.toBeNull();
    expect(noHP!).toBeLessThan(withHP!);
  });
});
