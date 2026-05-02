import { describe, it, expect } from "vitest";
import {
  profileFor,
  projectedRangeKm,
  projectedCapacityPct,
  degradationSchedule,
} from "./degradation";

// Legacy formula — kept for the original flat-rate sanity tests.
function rangeAtYear(rated: number, degRate: number, years: number): number {
  return rated * Math.pow(1 - degRate, years);
}

describe("battery degradation projection", () => {
  // Standard NMC BEV — 2%/yr, 500 km rated
  const BASE = 500;
  const RATE = 0.02;

  it("5yr NMC BEV loses ~9%", () => {
    expect(rangeAtYear(BASE, RATE, 5)).toBeCloseTo(451.95, 0);
  });
  it("8yr NMC BEV loses ~15%", () => {
    expect(rangeAtYear(BASE, RATE, 8)).toBeCloseTo(425.39, 0);
  });
  it("10yr NMC BEV loses ~18%", () => {
    expect(rangeAtYear(BASE, RATE, 10)).toBeCloseTo(408.56, 0);
  });

  // PHEV — 1.5%/yr, 600 km rated
  const PHEV_BASE = 600;
  const PHEV_RATE = 0.015;

  it("5yr PHEV loses ~7%", () => {
    expect(rangeAtYear(PHEV_BASE, PHEV_RATE, 5)).toBeCloseTo(556.47, 0);
  });
  it("10yr PHEV loses ~14%", () => {
    expect(rangeAtYear(PHEV_BASE, PHEV_RATE, 10)).toBeCloseTo(516.07, 0);
  });

  // Monotonically decreasing
  it("range decreases each year", () => {
    const r5 = rangeAtYear(BASE, RATE, 5);
    const r8 = rangeAtYear(BASE, RATE, 8);
    const r10 = rangeAtYear(BASE, RATE, 10);
    expect(r5).toBeGreaterThan(r8);
    expect(r8).toBeGreaterThan(r10);
  });

  // Default rate check
  it("default 0.02 matches explicit 2%/yr", () => {
    expect(rangeAtYear(300, 0.02, 5)).toBeCloseTo(300 * Math.pow(0.98, 5), 6);
  });
});

describe("degradation.ts — chemistry-aware projection (F-10)", () => {
  it("year 0 returns full rated range", () => {
    expect(projectedRangeKm(500, "NMC", 0)).toBe(500);
  });

  it("year 1 NMC drops 5%", () => {
    expect(projectedRangeKm(500, "NMC", 1)).toBeCloseTo(475, 1);
  });

  it("year 1 LFP drops only 3%", () => {
    expect(projectedRangeKm(500, "LFP", 1)).toBeCloseTo(485, 1);
  });

  it("LFP outperforms NMC at every horizon ≥ 1yr", () => {
    for (const y of [2, 5, 8, 10, 15]) {
      expect(projectedRangeKm(500, "LFP", y)).toBeGreaterThan(
        projectedRangeKm(500, "NMC", y),
      );
    }
  });

  it("year 5 NMC matches expected (475 × 0.983^4)", () => {
    const expected = 475 * Math.pow(1 - 0.017, 4);
    expect(projectedRangeKm(500, "NMC", 5)).toBeCloseTo(expected, 2);
  });

  it("monotonically decreasing across horizons for both chemistries", () => {
    for (const chem of ["NMC", "LFP"] as const) {
      const r1 = projectedRangeKm(500, chem, 1);
      const r5 = projectedRangeKm(500, chem, 5);
      const r10 = projectedRangeKm(500, chem, 10);
      const r15 = projectedRangeKm(500, chem, 15);
      expect(r1).toBeGreaterThan(r5);
      expect(r5).toBeGreaterThan(r10);
      expect(r10).toBeGreaterThan(r15);
    }
  });

  it("UNKNOWN chemistry falls back to conservative profile", () => {
    expect(projectedRangeKm(500, "UNKNOWN", 5)).toBeLessThan(
      projectedRangeKm(500, "NMC", 5),
    );
  });

  it("negative or zero rated range returns 0", () => {
    expect(projectedRangeKm(0, "NMC", 5)).toBe(0);
    expect(projectedRangeKm(-100, "NMC", 5)).toBe(0);
  });

  it("year-0.5 sits between rated and year-1 (linear interp inside year 1)", () => {
    const r = projectedRangeKm(500, "NMC", 0.5);
    expect(r).toBeLessThan(500);
    expect(r).toBeGreaterThan(projectedRangeKm(500, "NMC", 1));
  });

  it("projectedCapacityPct stays within 0..100", () => {
    for (const y of [0, 1, 5, 10, 30, 100]) {
      const pct = projectedCapacityPct("NMC", y);
      expect(pct).toBeGreaterThanOrEqual(0);
      expect(pct).toBeLessThanOrEqual(100);
    }
  });

  it("degradationSchedule emits the requested year list", () => {
    const sched = degradationSchedule(500, "NMC", [2, 5, 8]);
    expect(sched.map((s) => s.year)).toEqual([2, 5, 8]);
    expect(sched[0].range_km).toBeGreaterThan(sched[1].range_km);
    expect(sched[1].range_km).toBeGreaterThan(sched[2].range_km);
  });

  it("profileFor exposes confidence + sourceLabel for UI tooltips", () => {
    const p = profileFor("NMC");
    expect(p.confidence).toBe("Medium");
    expect(p.sourceLabel).toMatch(/Recurrent/);
  });
});
