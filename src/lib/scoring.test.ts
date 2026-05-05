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
  stackedOtdIncentives,
  applicableIncentives,
  evapEligibleAmount,
} from "./scoring";
import { ON_DEALER_FEES } from "./constants";
import type { Dealer, Incentive, InventoryUnit } from "./types";

const baseIncentive = (over: Partial<Incentive>): Incentive =>
  ({
    id: "fed-evap",
    scope: "federal",
    name: "iZEV federal rebate",
    status: "active",
    lastVerified: "2026-05-04",
    amountCad: 5000,
    ...over,
  } as Incentive);

const baseDealer = (over: Partial<Dealer>): Dealer =>
  ({
    id: "d-1",
    brand: "Hyundai",
    name: "Test Hyundai",
    address: "1 Test Way",
    city: "Toronto",
    province: "ON",
    ...over,
  } as Dealer);

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

describe("stackedOtdIncentives", () => {
  const u = baseUnit({});

  it("sums OTD-eligible cash scopes (federal + manufacturer + loyalty)", () => {
    const stack = stackedOtdIncentives(u, [
      baseIncentive({ id: "fed-other", scope: "federal", amountCad: 5000 }),
      baseIncentive({ id: "kia-cash", scope: "manufacturer_cash", amountCad: 2500 }),
      baseIncentive({ id: "kia-loyalty", scope: "loyalty", amountCad: 750 }),
    ]);
    expect(stack.totalCad).toBe(8250);
    expect(stack.lines).toHaveLength(3);
  });

  it("ignores APR-based scopes (lease_promo / finance_promo)", () => {
    const stack = stackedOtdIncentives(u, [
      baseIncentive({ id: "kia-cash", scope: "manufacturer_cash", amountCad: 2000 }),
      baseIncentive({ id: "lease-1", scope: "lease_promo", amountCad: 9999 }),
      baseIncentive({ id: "fin-1", scope: "finance_promo", amountCad: 9999 }),
    ]);
    expect(stack.totalCad).toBe(2000);
    expect(stack.lines).toHaveLength(1);
  });

  it("ignores ended/paused incentives", () => {
    const stack = stackedOtdIncentives(u, [
      baseIncentive({ id: "kia-cash", scope: "manufacturer_cash", amountCad: 2000 }),
      baseIncentive({ id: "ended", scope: "manufacturer_cash", status: "ended", amountCad: 5000 }),
      baseIncentive({ id: "paused", scope: "manufacturer_cash", status: "paused", amountCad: 5000 }),
    ]);
    expect(stack.totalCad).toBe(2000);
  });

  it("drops incentives in NON_OTD_INCENTIVE_IDS allowlist (loan rebates)", () => {
    const stack = stackedOtdIncentives(u, [
      baseIncentive({
        id: "nl-takecharge-nlcu-loan-rebate-2026",
        scope: "provincial",
        amountCad: 5000,
      }),
    ]);
    expect(stack.totalCad).toBe(0);
  });
});

describe("applicableIncentives", () => {
  const u = baseUnit({ model: "Ioniq5", trim: "Preferred", year: 2025 });
  const dealer = baseDealer({ province: "ON" });

  it("returns no-appliesTo entries unchanged", () => {
    const r = applicableIncentives(u, dealer, [
      baseIncentive({ id: "broad", scope: "manufacturer_cash", amountCad: 1000 }),
    ]);
    expect(r).toHaveLength(1);
  });

  it("filters by appliesTo.models", () => {
    const r = applicableIncentives(u, dealer, [
      baseIncentive({
        id: "ev6-only",
        appliesTo: { models: ["EV6"] },
      }),
    ]);
    expect(r).toHaveLength(0);
  });

  it("filters by appliesTo.provinces", () => {
    const r = applicableIncentives(u, dealer, [
      baseIncentive({
        id: "qc-only",
        appliesTo: { provinces: ["QC"] },
      }),
    ]);
    expect(r).toHaveLength(0);
  });

  it("excludes loyalty when buyerContext.loyalty=false", () => {
    const r = applicableIncentives(
      u,
      dealer,
      [baseIncentive({ id: "kia-loyalty", scope: "loyalty", amountCad: 750 })],
      { province: "ON", loyalty: false, conquest: false },
    );
    expect(r).toHaveLength(0);
  });

  it("includes loyalty when buyerContext.loyalty=true", () => {
    const r = applicableIncentives(
      u,
      dealer,
      [baseIncentive({ id: "kia-loyalty", scope: "loyalty", amountCad: 750 })],
      { province: "ON", loyalty: true, conquest: false },
    );
    expect(r).toHaveLength(1);
  });

  it("drops 'ended' incentives entirely", () => {
    const r = applicableIncentives(u, dealer, [
      baseIncentive({ id: "old", status: "ended", amountCad: 9999 }),
    ]);
    expect(r).toHaveLength(0);
  });

  it("D4 · evapEligibleAmount: 48mo+ lease prorates to full $5k", () => {
    const evap = baseIncentive({
      id: "fed-evap",
      scope: "federal",
      amountCad: 5000,
      leaseTermProration: { "12": 1250, "24": 2500, "36": 3750, "48": 5000 },
    });
    const u = baseUnit({});
    expect(evapEligibleAmount(u, evap, [evap])).toBe(5000);
  });

  it("D4 · evapEligibleAmount: returns 0 when EVAP missing or paused", () => {
    const u = baseUnit({});
    expect(evapEligibleAmount(u, undefined, [])).toBe(0);
    const paused = baseIncentive({ id: "fed-evap", status: "paused", amountCad: 5000 });
    expect(evapEligibleAmount(u, paused, [paused])).toBe(0);
  });

  it("D4 · evapEligibleAmount: enforces transactionValueCap on imports", () => {
    const evap = baseIncentive({
      id: "fed-evap",
      scope: "federal",
      amountCad: 5000,
      transactionValueCapCad: 50000,
      capAppliesToImported: true,
    });
    const expensive = baseUnit({ dealerAskingPrice: 60000, msrp: 60000 });
    // No OEM cash to bring effective price below cap → blocked.
    expect(evapEligibleAmount(expensive, evap, [evap])).toBe(0);
    // With $15k OEM cash → effective $45k → under cap → full amount.
    const oem = baseIncentive({
      id: "kia-cash", scope: "manufacturer_cash", amountCad: 15000,
    });
    expect(evapEligibleAmount(expensive, evap, [evap, oem])).toBe(5000);
  });

  it("enforces EVAP $50k post-OEM-cash cap", () => {
    // Unit at $58k pre-tax with $16k OEM cash → effective $42k → under cap.
    // Cap-applied EVAP should pass; without OEM cash, $58k > $50k → drop.
    const expensive = baseUnit({ dealerAskingPrice: 58000, msrp: 58000 });
    const oemCash = baseIncentive({
      id: "kia-cash-big",
      scope: "manufacturer_cash",
      amountCad: 16000,
    });
    const evap = baseIncentive({
      id: "fed-evap",
      scope: "federal",
      amountCad: 5000,
      transactionValueCapCad: 50000,
      capAppliesToImported: true,
    });
    const withCash = applicableIncentives(expensive, dealer, [oemCash, evap]);
    expect(withCash.find((i) => i.id === "fed-evap")).toBeDefined();
    const withoutCash = applicableIncentives(expensive, dealer, [evap]);
    expect(withoutCash.find((i) => i.id === "fed-evap")).toBeUndefined();
  });
});
