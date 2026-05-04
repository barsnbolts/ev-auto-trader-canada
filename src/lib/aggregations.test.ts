import { describe, expect, it } from "vitest";

import {
  computeKpis,
  dealerPressureMap,
  inGGH,
  provinceRollup,
} from "./aggregations";
import type { Dealer, ScoredUnit } from "./types";

// Minimal fixtures — cast to types via `as unknown as` since we only exercise
// the fields the aggregations actually read.

function mkDealer(overrides: Partial<Dealer> & { id: string }): Dealer {
  return {
    name: `Dealer ${overrides.id}`,
    province: "ON",
    city: "Toronto",
    address: "1 Main St",
    lat: 43.65,
    lng: -79.38,
    ...overrides,
  } as unknown as Dealer;
}

function mkUnit(overrides: Partial<ScoredUnit> & { id: string; dealerId: string }): ScoredUnit {
  return {
    model: "Ioniq5",
    year: 2025,
    trim: "Preferred RWD Long Range",
    drivetrain: "RWD",
    msrpCad: 51_999,
    dealerAskingPrice: 51_999,
    daysOnLot: 30,
    otdCad: 60_000,
    dealScore: 75,
    ...overrides,
  } as unknown as ScoredUnit;
}

describe("dealerPressureMap", () => {
  it("returns 0 for dealers with no units", () => {
    const dealers = [mkDealer({ id: "d1" }), mkDealer({ id: "d2" })];
    const out = dealerPressureMap([], dealers);
    expect(out).toEqual({ d1: 0, d2: 0 });
  });

  it("computes a number for dealers with units (pressure index roundtripped × 100)", () => {
    const dealers = [mkDealer({ id: "d1" })];
    const units = [
      mkUnit({ id: "u1", dealerId: "d1", daysOnLot: 60, dealerAskingPrice: 51_999 }),
      mkUnit({ id: "u2", dealerId: "d1", daysOnLot: 90, dealerAskingPrice: 51_999 }),
    ];
    const out = dealerPressureMap(units, dealers);
    expect(out.d1).toBeGreaterThanOrEqual(0);
    expect(out.d1).toBeLessThanOrEqual(100);
    expect(Number.isInteger(out.d1)).toBe(true);
  });

  it("only computes for declared dealers (ignores stray dealerIds in unit set)", () => {
    const dealers = [mkDealer({ id: "d1" })];
    const units = [mkUnit({ id: "u1", dealerId: "d1" }), mkUnit({ id: "u2", dealerId: "d999" })];
    const out = dealerPressureMap(units, dealers);
    expect(Object.keys(out)).toEqual(["d1"]);
  });
});

describe("inGGH", () => {
  it("Toronto Ontario unit → true", () => {
    const dealer = mkDealer({ id: "d1", province: "ON", city: "Toronto" });
    const dealerById = new Map([["d1", dealer]]);
    const unit = mkUnit({ id: "u1", dealerId: "d1" });
    expect(inGGH(unit, dealerById)).toBe(true);
  });

  it("Vancouver BC unit → false (BC not in GGH)", () => {
    const dealer = mkDealer({ id: "d2", province: "BC", city: "Vancouver" });
    const dealerById = new Map([["d2", dealer]]);
    const unit = mkUnit({ id: "u1", dealerId: "d2" });
    expect(inGGH(unit, dealerById)).toBe(false);
  });

  it("Ottawa Ontario unit → false (Ottawa not in GGH cities)", () => {
    const dealer = mkDealer({ id: "d3", province: "ON", city: "Ottawa" });
    const dealerById = new Map([["d3", dealer]]);
    const unit = mkUnit({ id: "u1", dealerId: "d3" });
    expect(inGGH(unit, dealerById)).toBe(false);
  });

  it("unknown dealerId → false (graceful fallback)", () => {
    const dealerById = new Map<string, Dealer>();
    const unit = mkUnit({ id: "u1", dealerId: "ghost" });
    expect(inGGH(unit, dealerById)).toBe(false);
  });
});

describe("computeKpis", () => {
  it("returns one row per requested model with zeros if no matching units", () => {
    const dealerById = new Map<string, Dealer>();
    const out = computeKpis([], dealerById, ["Ioniq5", "EV6"]);
    expect(out).toHaveLength(2);
    expect(out[0].totalCanada).toBe(0);
    expect(out[0].lowestOtdCanada).toBeNull();
    expect(out[0].bestDealScoreCanada).toBeNull();
    expect(out[0].avgDaysOnLotCanada).toBe(0);
  });

  it("computes lowest OTD + best score across the model set", () => {
    const dealer = mkDealer({ id: "d1", province: "ON", city: "Toronto" });
    const dealerById = new Map([["d1", dealer]]);
    const units = [
      mkUnit({ id: "u1", dealerId: "d1", model: "Ioniq5", otdCad: 60_000, dealScore: 80 }),
      mkUnit({ id: "u2", dealerId: "d1", model: "Ioniq5", otdCad: 55_000, dealScore: 85 }),
      mkUnit({ id: "u3", dealerId: "d1", model: "EV6", otdCad: 58_000, dealScore: 70 }),
    ];
    const out = computeKpis(units, dealerById, ["Ioniq5", "EV6"]);
    const ioniq5 = out.find((r) => r.model === "Ioniq5")!;
    expect(ioniq5.totalCanada).toBe(2);
    expect(ioniq5.lowestOtdCanada).toBe(55_000);
    expect(ioniq5.bestDealScoreCanada).toBe(85);
  });

  it("totalGgh + lowestOtdGgh respect GGH membership", () => {
    const torontoDealer = mkDealer({ id: "d1", province: "ON", city: "Toronto" });
    const ottawaDealer = mkDealer({ id: "d2", province: "ON", city: "Ottawa" });
    const dealerById = new Map([
      ["d1", torontoDealer],
      ["d2", ottawaDealer],
    ]);
    const units = [
      mkUnit({ id: "u1", dealerId: "d1", model: "Ioniq5", otdCad: 60_000 }),
      mkUnit({ id: "u2", dealerId: "d2", model: "Ioniq5", otdCad: 50_000 }),
    ];
    const out = computeKpis(units, dealerById, ["Ioniq5"]);
    expect(out[0].totalCanada).toBe(2);
    expect(out[0].totalGgh).toBe(1);
    expect(out[0].lowestOtdCanada).toBe(50_000);
    expect(out[0].lowestOtdGgh).toBe(60_000); // only the Toronto unit qualifies for GGH
  });

  it("avgDaysOnLot is integer-rounded", () => {
    const dealer = mkDealer({ id: "d1" });
    const dealerById = new Map([["d1", dealer]]);
    const units = [
      mkUnit({ id: "u1", dealerId: "d1", daysOnLot: 10 }),
      mkUnit({ id: "u2", dealerId: "d1", daysOnLot: 15 }),
      mkUnit({ id: "u3", dealerId: "d1", daysOnLot: 20 }),
    ];
    const out = computeKpis(units, dealerById, ["Ioniq5"]);
    expect(out[0].avgDaysOnLotCanada).toBe(15);
  });
});

describe("provinceRollup", () => {
  it("groups units by province + counts model types", () => {
    const dealers = [
      mkDealer({ id: "d1", province: "ON" }),
      mkDealer({ id: "d2", province: "ON" }),
      mkDealer({ id: "d3", province: "BC" }),
    ];
    const dealerById = new Map(dealers.map((d) => [d.id, d]));
    const units = [
      mkUnit({ id: "u1", dealerId: "d1", model: "Ioniq5" }),
      mkUnit({ id: "u2", dealerId: "d2", model: "Ioniq5" }),
      mkUnit({ id: "u3", dealerId: "d2", model: "EV6" }),
      mkUnit({ id: "u4", dealerId: "d3", model: "Ioniq6" }),
    ];
    const out = provinceRollup(units, dealerById);
    expect(out).toHaveLength(2);
    const on = out.find((r) => r.province === "ON")!;
    expect(on.count).toBe(3);
    expect(on.countByModel.Ioniq5).toBe(2);
    expect(on.countByModel.EV6).toBe(1);
    const bc = out.find((r) => r.province === "BC")!;
    expect(bc.count).toBe(1);
    expect(bc.countByModel.Ioniq6).toBe(1);
  });

  it("sorts by descending count", () => {
    const dealers = [
      mkDealer({ id: "d1", province: "ON" }),
      mkDealer({ id: "d2", province: "BC" }),
      mkDealer({ id: "d3", province: "BC" }),
    ];
    const dealerById = new Map(dealers.map((d) => [d.id, d]));
    const units = [
      mkUnit({ id: "u1", dealerId: "d1" }),
      mkUnit({ id: "u2", dealerId: "d2" }),
      mkUnit({ id: "u3", dealerId: "d3" }),
    ];
    const out = provinceRollup(units, dealerById);
    expect(out[0].province).toBe("BC"); // 2 > 1
    expect(out[1].province).toBe("ON");
  });

  it("skips units whose dealerId is unknown", () => {
    const dealerById = new Map<string, Dealer>();
    const units = [mkUnit({ id: "u1", dealerId: "ghost" })];
    expect(provinceRollup(units, dealerById)).toEqual([]);
  });
});
