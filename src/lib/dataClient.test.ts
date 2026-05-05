// D5 — integration test for loadScoredUnits against real data files.
// Asserts shape + invariants that downstream pages depend on.
//
// Notes:
// - Uses the actual data/units.json + dealers.json + incentives.json the
//   build is shipping. If counts drop dramatically vs assertion floors,
//   test fails — early signal that the AT scrape is regressing.
// - Pinned thresholds are conservative (≥ counts, not exact) so a
//   normal day-to-day inventory swing doesn't churn the spec.

import { describe, it, expect } from "vitest";
import { loadScoredUnits } from "./dataClient";

describe("loadScoredUnits (integration)", () => {
  it("returns ≥ 1 unit + every unit has otdBreakdown.total > 0", async () => {
    const { units, dealers, dealerById } = await loadScoredUnits("ON");
    expect(units.length).toBeGreaterThanOrEqual(1);
    expect(dealers.length).toBeGreaterThanOrEqual(1);
    // Every unit's OTD must be a positive number — sentinel that
    // computeOtd ran cleanly for the entire dataset.
    for (const u of units) {
      expect(u.otdBreakdown.total).toBeGreaterThan(0);
    }
    // dealerById covers ≥ 95% of units (orphan units would indicate a
    // foreign-key drift between units.json and dealers.json — caught
    // hard by build_units_from_at, but spec it here too).
    const orphans = units.filter((u) => !dealerById.get(u.dealerId)).length;
    expect(orphans / units.length).toBeLessThan(0.05);
  });

  it("every unit has a finite non-negative dealScore + dealScoreBreakdown shape", async () => {
    const { units } = await loadScoredUnits("ON");
    for (const u of units) {
      expect(Number.isFinite(u.dealScore)).toBe(true);
      expect(u.dealScore).toBeGreaterThanOrEqual(0);
      expect(u.dealScoreBreakdown).toBeTruthy();
    }
  });

  it("buyerContext flows through: ON vs BC produce different OTDs (PST differs)", async () => {
    const on = await loadScoredUnits("ON");
    const bc = await loadScoredUnits("BC");
    if (on.units.length === 0) return;
    // Pick same-id units in both runs and compare OTD
    const sample = on.units[0];
    const bcMatch = bc.units.find((u) => u.id === sample.id);
    expect(bcMatch).toBeDefined();
    // OTD includes provincial sales tax — ON HST (13%) vs BC GST+PST
    // (5%+7-20%) usually diverge for an EV at $40-60k.
    expect(bcMatch!.otdBreakdown.total).not.toBe(sample.otdBreakdown.total);
  });
});
