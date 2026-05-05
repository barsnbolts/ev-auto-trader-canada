// Specs for cross-listings join + helpers. Pure-function tests; no IO.

import { describe, it, expect } from "vitest";
import { makeFallbackKey, cheapestCash, leaseTakeover, lookupCrossSource } from "./crossListings";
import type { CrossSourceEntry, CrossListing } from "./crossListings";
import crossListingsJson from "@/data/cross-listings.json";

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
  // Post-I0b-2 (commit 68c9e56b): trim + km dropped from join key.
  // See docs/CROSS_LISTINGS.md for the format-mismatch rationale.
  it("lowercases make/normalizes model and ignores trim/km", () => {
    const k = makeFallbackKey({
      year: 2025,
      make: "Hyundai",
      model: "Ioniq 5",
      trim: "Preferred Long Range",
      km: 22000,
    });
    // Per normalizeModelForFallback: "Ioniq 5" → "ioniq5" (whitespace
    // stripped, alias-mapped). Mirrors Python normalize_model.
    expect(k).toBe("2025|hyundai|ioniq5");
  });

  it("ignores km bucketing entirely (key invariant under km change)", () => {
    const a = makeFallbackKey({ year: 2024, make: "Kia", model: "EV6", trim: "GT", km: 23999 });
    const b = makeFallbackKey({ year: 2024, make: "Kia", model: "EV6", trim: "GT", km: 0 });
    expect(a).toBe(b);
  });

  it("ignores trim entirely (key invariant under trim change)", () => {
    const a = makeFallbackKey({ year: 2024, make: "Kia", model: "EV6", trim: "GT" });
    const b = makeFallbackKey({ year: 2024, make: "Kia", model: "EV6", trim: "Land AWD" });
    expect(a).toBe(b);
  });

  it("missing trim/km still produces a clean 3-segment key", () => {
    const k = makeFallbackKey({ year: 2024, make: "Kia", model: "EV6" });
    expect(k).toBe("2024|kia|ev6");
    expect(k.split("|")).toHaveLength(3);
  });

  it("normalizes model whitespace + aliases (mirrors Python normalize_model)", () => {
    // Python emits "ioniq5" for both "IONIQ 5" (AT) and "ioniq_5" (Kijiji).
    // TS must match — otherwise cross-source chips silently miss.
    const at = makeFallbackKey({ year: 2025, make: "Hyundai", model: "IONIQ 5" });
    const kij = makeFallbackKey({ year: 2025, make: "Hyundai", model: "ioniq_5" });
    const cs = makeFallbackKey({ year: 2025, make: "Hyundai", model: "Ioniq-5" });
    expect(at).toBe("2025|hyundai|ioniq5");
    expect(at).toBe(kij);
    expect(at).toBe(cs);
    // "Niro" alias resolves to "niroev"
    const niroShort = makeFallbackKey({ year: 2025, make: "Kia", model: "Niro" });
    const niroFull = makeFallbackKey({ year: 2025, make: "Kia", model: "Niro EV" });
    expect(niroShort).toBe("2025|kia|niroev");
    expect(niroShort).toBe(niroFull);
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

describe("lookupCrossSource — VIN-vs-fallback resolution", () => {
  // Pull a real entry to exercise the live indexes built at module load.
  const realEntries = crossListingsJson as CrossSourceEntry[];

  it("returns null when neither VIN nor fallbackKey matches anything", () => {
    const out = lookupCrossSource({
      vin: "GHOST_VIN_NOT_IN_INDEX_99",
      year: 1900,
      make: "Brand",
      model: "Model",
      trim: "no-such-trim",
      km: 999_999,
    });
    expect(out).toBeNull();
  });

  it("matches by VIN when entry has one", () => {
    const sample = realEntries.find((e) => e.vin);
    if (!sample) {
      // No VIN-bearing entries in current data; skip rather than fail
      return;
    }
    const hit = lookupCrossSource({
      vin: sample.vin!,
      // Use intentionally wrong year/make/model — VIN should win regardless.
      year: 1900,
      make: "WRONG",
      model: "WRONG",
      trim: "wrong",
      km: 0,
    });
    expect(hit).not.toBeNull();
    expect(hit?.vin).toBe(sample.vin);
  });

  it("TS makeFallbackKey + Python merge agree on year|make|model 3-segment key (post-I0b-2)", () => {
    // FIX SHIPPED 2026-05-05 (I0b-2 commit 68c9e56b): both Python merge
    // and TS makeFallbackKey now emit 3-segment year|make|model keys
    // (trim + km dropped because they don't survive cross-source format
    // normalization). Cross-source fallback lookups now actually match.
    const sample = realEntries[0];
    expect(sample.fallbackKey.split("|")).toHaveLength(3);
    const tsKey = makeFallbackKey({
      year: sample.year,
      make: sample.make,
      model: sample.model,
      trim: sample.trim,
      km: null,
    });
    expect(tsKey.split("|")).toHaveLength(3);
    expect(tsKey).toBe(sample.fallbackKey);
  });

  it("treats supplied VIN as the only join attempt when fallback paths can't reconstruct", () => {
    const out = lookupCrossSource({
      vin: "DEFINITELY_NOT_A_REAL_VIN_XX",
      year: 1900,
      make: "GHOST",
      model: "GHOST",
      trim: null,
      km: null,
    });
    // VIN miss + fallback miss → null.
    expect(out).toBeNull();
  });

  it("returns null when VIN is null and fallbackKey reconstruction misses", () => {
    const out = lookupCrossSource({
      vin: null,
      year: 1900,
      make: "GHOST",
      model: "GHOST",
      trim: "ghost",
      km: 1,
    });
    expect(out).toBeNull();
  });
});
