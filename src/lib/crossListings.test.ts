// Specs for cross-listings join + helpers. Pure-function tests; no IO.

import { describe, it, expect } from "vitest";
import { makeFallbackKey, cheapestCash, leaseTakeover } from "./crossListings";
import type { CrossSourceEntry, CrossListing } from "./crossListings";

const baseListing = (over: Partial<CrossListing>): CrossListing => ({
  source: "kijiji_autos",
  stockId: "k-123",
  url: "https://example.com/123",
  priceCad: null,
  km: null,
  dealerName: null,
  province: "ON",
  lastVerified: "2026-05-04T00:00:00Z",
  ...over,
});

describe("makeFallbackKey", () => {
  it("lowercases make/model/trim and dashifies whitespace", () => {
    const k = makeFallbackKey({
      year: 2025,
      make: "Hyundai",
      model: "Ioniq 5",
      trim: "Preferred Long Range",
      km: 22000,
    });
    expect(k).toBe("2025|hyundai|ioniq 5|preferred-long-range|22000");
  });

  it("buckets km in 2000-unit increments", () => {
    const a = makeFallbackKey({ year: 2024, make: "Kia", model: "EV6", trim: "GT", km: 23999 });
    const b = makeFallbackKey({ year: 2024, make: "Kia", model: "EV6", trim: "GT", km: 22000 });
    expect(a).toBe(b);
  });

  it("treats missing km as 'any'", () => {
    const k = makeFallbackKey({ year: 2024, make: "Kia", model: "EV6", trim: "GT" });
    expect(k).toContain("|any");
  });

  it("treats missing trim as 'any'", () => {
    const k = makeFallbackKey({ year: 2024, make: "Kia", model: "EV6", km: 0 });
    expect(k).toContain("|any|");
  });
});

describe("cheapestCash", () => {
  const entry = (listings: CrossListing[]): CrossSourceEntry => ({
    vin: null,
    fallbackKey: "fk",
    year: 2025,
    make: "Hyundai",
    model: "Ioniq5",
    trim: null,
    listings,
  });

  it("returns null when no listing has a price", () => {
    expect(cheapestCash(entry([baseListing({ priceCad: null })]))).toBeNull();
  });

  it("returns the lowest-priced listing", () => {
    const a = baseListing({ priceCad: 50000, stockId: "a" });
    const b = baseListing({ priceCad: 47000, stockId: "b" });
    const c = baseListing({ priceCad: 49000, stockId: "c" });
    expect(cheapestCash(entry([a, b, c]))?.stockId).toBe("b");
  });

  it("ignores null-priced listings when picking cheapest", () => {
    const cash = baseListing({ priceCad: 51000, stockId: "cash" });
    const lease = baseListing({
      source: "leasebusters",
      priceCad: null,
      monthlyPaymentCad: 599,
      stockId: "lease",
    });
    expect(cheapestCash(entry([lease, cash]))?.stockId).toBe("cash");
  });
});

describe("leaseTakeover", () => {
  const entry = (listings: CrossListing[]): CrossSourceEntry => ({
    vin: null,
    fallbackKey: "fk",
    year: 2025,
    make: "Hyundai",
    model: "Ioniq5",
    trim: null,
    listings,
  });

  it("returns the leasebusters entry with a monthly payment", () => {
    const cash = baseListing({ source: "kijiji_autos", priceCad: 47000, stockId: "k" });
    const lease = baseListing({
      source: "leasebusters",
      priceCad: null,
      monthlyPaymentCad: 612,
      monthsRemaining: 24,
      stockId: "lb",
    });
    expect(leaseTakeover(entry([cash, lease]))?.stockId).toBe("lb");
  });

  it("returns null when no leasebusters listing exists", () => {
    expect(leaseTakeover(entry([baseListing({ source: "kijiji_autos", priceCad: 49000 })]))).toBeNull();
  });

  it("returns null when leasebusters listing is missing monthlyPaymentCad", () => {
    const lease = baseListing({ source: "leasebusters", priceCad: null, monthlyPaymentCad: null });
    expect(leaseTakeover(entry([lease]))).toBeNull();
  });
});
