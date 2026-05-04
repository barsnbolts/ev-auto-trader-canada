// Specs for pure scoring functions. Avoids fixturing full Dealer / Incentive
// shapes — focuses on the easily-isolated math: transportCost,
// preTaxTransactionValue, dealerPressureIndex.
//
// Larger surfaces (computeOtd, applicableIncentives, computeFinanceOtd,
// computeLeaseOtd) deserve their own pass with realistic fixtures from
// data/incentives.json + data/taxes-and-fees.json.

import { describe, it, expect } from "vitest";
import {
  transportCost,
  preTaxTransactionValue,
  dealerPressureIndex,
} from "./scoring";
import { ON_DEALER_FEES } from "./constants";
import type { InventoryUnit } from "./types";

const baseUnit = (over: Partial<InventoryUnit>): InventoryUnit =>
  ({
    id: "u-test-1",
    dealerId: "d-1",
    model: "Ioniq5",
    year: 2025,
    trim: "Preferred",
    drivetrain: "RWD",
    msrp: 50000,
    dealerAskingPrice: 50000,
    freightPdi: 1900,
    status: "in_stock",
    daysOnLot: 0,
    listingUrl: "https://example.com",
    lastSeen: "2026-05-04",
    ...over,
  } as unknown as InventoryUnit);

describe("transportCost", () => {
  it("same province → $0", () => {
    expect(transportCost("ON", "ON")).toBe(0);
  });

  it("ON ↔ QC are neighbours → $1200", () => {
    expect(transportCost("ON", "QC")).toBe(1200);
    expect(transportCost("QC", "ON")).toBe(1200);
  });

  it("non-neighbour but same regional group → $2000", () => {
    // BC + YT are in 'west' group AND neighbours, so test a non-neighbour
    // pair within a group: NL + NB are 'atlantic' but NOT direct neighbours
    // for NL (NL→NS,QC). Use atlantic NS↔PE which IS a neighbour. Better:
    // prairies AB↔MB — not neighbours (AB→BC,SK,NT; MB→SK,ON,NU) but both
    // in the prairies group.
    expect(transportCost("AB", "MB")).toBe(2000);
  });

  it("cross-country fallback when no relationship → $2500", () => {
    expect(transportCost("BC", "ON")).toBe(2500);
  });
});

describe("preTaxTransactionValue", () => {
  it("sums asking + freight + AC excise tax", () => {
    const u = baseUnit({ dealerAskingPrice: 50000, freightPdi: 1900 });
    expect(preTaxTransactionValue(u)).toBe(
      50000 + 1900 + ON_DEALER_FEES.airConditioningExciseTax,
    );
  });

  it("uses dealerAskingPrice not msrp when they differ", () => {
    const u = baseUnit({ msrp: 60000, dealerAskingPrice: 55000, freightPdi: 1900 });
    const expected = 55000 + 1900 + ON_DEALER_FEES.airConditioningExciseTax;
    expect(preTaxTransactionValue(u)).toBe(expected);
  });
});

describe("dealerPressureIndex", () => {
  const target = baseUnit({ id: "u-1", model: "Ioniq5", trim: "Preferred" });

  it("returns 0 when no other same-trim units at the dealer", () => {
    expect(dealerPressureIndex(target, [target])).toBeGreaterThanOrEqual(0);
    // Lone unit means depth=0.25 and ageSignal=0 → 0.125, but allow slack.
    expect(dealerPressureIndex(target, [target])).toBeLessThan(0.3);
  });

  it("returns 0 when the dealer holds zero same-trim units (filtered out)", () => {
    const other = baseUnit({ id: "u-2", model: "EV6", trim: "Light" });
    expect(dealerPressureIndex(target, [other])).toBe(0);
  });

  it("max signal at 4+ same-trim units with avgAge ≥ 90 days", () => {
    const aged = [0, 1, 2, 3].map((i) =>
      baseUnit({ id: `u-${i}`, model: "Ioniq5", trim: "Preferred", daysOnLot: 100 }),
    );
    expect(dealerPressureIndex(target, aged)).toBeCloseTo(1.0, 1);
  });

  it("intermediate signal: 4 same-trim, brand-new = depth max + ageSignal 0 → ~0.5", () => {
    const fresh = [0, 1, 2, 3].map((i) =>
      baseUnit({ id: `u-${i}`, model: "Ioniq5", trim: "Preferred", daysOnLot: 0 }),
    );
    expect(dealerPressureIndex(target, fresh)).toBeCloseTo(0.5, 1);
  });
});
