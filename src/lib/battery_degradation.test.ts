import { describe, expect, it } from "vitest";

import {
  projectedRangeAtYear,
  retentionAtYear,
  type BatteryChemistry,
} from "./battery_degradation";

describe("retentionAtYear", () => {
  it("returns 1.0 at year 0 for any chemistry", () => {
    const chems: BatteryChemistry[] = ["LFP", "NMC", "NCA", "LMR", "UNKNOWN"];
    for (const c of chems) {
      expect(retentionAtYear(c, 0)).toBe(1);
    }
  });

  it("LFP loses ~0.8% per year (most durable)", () => {
    expect(retentionAtYear("LFP", 1)).toBeCloseTo(0.992, 3);
    expect(retentionAtYear("LFP", 5)).toBeCloseTo(0.96, 2);
  });

  it("NMC loses ~1.8% per year (typical EV)", () => {
    expect(retentionAtYear("NMC", 1)).toBeCloseTo(0.982, 3);
    expect(retentionAtYear("NMC", 5)).toBeCloseTo(0.91, 2);
  });

  it("NCA decays faster than NMC", () => {
    expect(retentionAtYear("NCA", 5)).toBeLessThan(retentionAtYear("NMC", 5));
  });

  it("UNKNOWN falls back to NCA-like decay rate", () => {
    expect(retentionAtYear("UNKNOWN", 5)).toBe(retentionAtYear("NCA", 5));
  });

  it("clamps retention to 50% floor for very long horizons", () => {
    // LFP at 100 years: linear would say -ve. Floor at 0.5.
    expect(retentionAtYear("LFP", 100)).toBe(0.5);
    expect(retentionAtYear("NMC", 100)).toBe(0.5);
  });

  it("monotonic — more years means less retention", () => {
    for (const c of ["LFP", "NMC", "NCA"] as BatteryChemistry[]) {
      const r1 = retentionAtYear(c, 1);
      const r5 = retentionAtYear(c, 5);
      const r10 = retentionAtYear(c, 10);
      expect(r1).toBeGreaterThan(r5);
      expect(r5).toBeGreaterThan(r10);
    }
  });
});

describe("projectedRangeAtYear", () => {
  it("scales rated range by retention", () => {
    expect(projectedRangeAtYear(500, "LFP", 0)).toBe(500);
    expect(projectedRangeAtYear(500, "LFP", 5)).toBeCloseTo(480, 0);
  });

  it("NMC 462 km after 5 years matches expected ~420 km", () => {
    const out = projectedRangeAtYear(462, "NMC", 5);
    // 462 * (1 - 0.018*5) = 462 * 0.91 = 420.42
    expect(out).toBeCloseTo(420, 0);
  });

  it("preserves zero range as zero", () => {
    expect(projectedRangeAtYear(0, "NMC", 5)).toBe(0);
  });
});
