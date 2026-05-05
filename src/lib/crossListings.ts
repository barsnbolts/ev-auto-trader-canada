// Phase D: cross-source listing intelligence. VIN-keyed (when available)
// merge of AutoTrader + Kijiji Autos + Leasebusters listings. Surfaces
// "this VIN is $X cheaper on Kijiji" or "matching lease takeover on
// Leasebusters" as a chip on inventory rows + dossier.
//
// Schema is loose (not enforced via Zod yet) so per-source scrapers can
// evolve independently. Phase D-bis (Hyundai/Kia dealer feeds) extends
// this without breaking changes.

import crossListingsJson from "@/data/cross-listings.json";

export type Source =
  | "autotrader"
  | "kijiji_autos"
  | "leasebusters"
  | "hyundai_dealer"
  | "kia_dealer";

export type CrossListing = {
  source: Source;
  /** Source-specific stable id (e.g. AutoTrader listing id, Kijiji ad id). */
  stockId: string;
  url: string;
  /** Cash asking price in CAD. Null when source is lease-only. */
  priceCad: number | null;
  km: number | null;
  dealerName: string | null;
  province: string | null;
  /** Lease-takeover details (Leasebusters only). */
  monthlyPaymentCad?: number | null;
  monthsRemaining?: number | null;
  cashIncentiveCad?: number | null;
  /** ISO timestamp of the most recent successful scrape. */
  lastVerified: string;
};

export type CrossSourceEntry = {
  /** Primary join key. Null when no source exposes VIN (Leasebusters). */
  vin: string | null;
  /** Fallback join key for VIN-anonymized listings.
   *  Format: `<year>-<make>-<model>-<trim>-<kmBucket>` (km bucket = floor(km/2000)*2000) */
  fallbackKey: string;
  year: number;
  make: string;
  model: string;
  trim: string | null;
  listings: CrossListing[];
};

const ENTRIES = crossListingsJson as CrossSourceEntry[];

const VIN_INDEX = new Map<string, CrossSourceEntry>();
const FALLBACK_INDEX = new Map<string, CrossSourceEntry>();
for (const e of ENTRIES) {
  if (e.vin) VIN_INDEX.set(e.vin, e);
  FALLBACK_INDEX.set(e.fallbackKey, e);
}

/** Look up cross-source listings by VIN first, falling back to fuzzy key. */
export function lookupCrossSource(args: {
  vin?: string | null;
  year: number;
  make: string;
  model: string;
  trim?: string | null;
  km?: number | null;
}): CrossSourceEntry | null {
  if (args.vin) {
    const hit = VIN_INDEX.get(args.vin);
    if (hit) return hit;
  }
  const key = makeFallbackKey(args);
  return FALLBACK_INDEX.get(key) ?? null;
}

/**
 * Mirrors scripts/merge_cross_sources.normalize_model — must stay in sync.
 * Strips spaces / hyphens / underscores, then maps known aliases (e.g.
 * "ioniq 5" → "ioniq5", "niro" → "niroev"). Without this, a Kijiji-side
 * model string of "Ioniq 5" wouldn't match an AT "Ioniq5" via fallbackKey.
 *
 * AUDIT FINDING (2026-05-05): the previous implementation just lowercased,
 * which silently misaligned with the Python normalizer. Pinned by spec
 * `crossListings.test.ts > makeFallbackKey > model normalization`.
 */
export function normalizeModelForFallback(m: string): string {
  const s = m.trim().toLowerCase().replace(/[\s\-_]/g, "");
  const aliases: Record<string, string> = {
    ioniq5: "ioniq5",
    ioniq6: "ioniq6",
    ioniq9: "ioniq9",
    ev6: "ev6",
    ev9: "ev9",
    niroev: "niroev",
    niro: "niroev",
    kona: "konaev",
    konaev: "konaev",
    konaelectric: "konaev",
  };
  return aliases[s] ?? s;
}

export function makeFallbackKey(args: {
  year: number;
  make: string;
  model: string;
  trim?: string | null;
  km?: number | null;
}): string {
  // Aligned with scripts/merge_cross_sources.py I0b-2 update — trim + km
  // dropped because they don't survive cross-source format normalization
  // (AT writes "Land Long Range AWD", Kijiji writes "Land AWD w/ Plus
  // Package"; AT km=null, Kijiji km=42103). Year + make + model is coarser
  // but joins ~92 % of VIN-less AT entries empirically.
  // trim + km still passed in for API stability (callers don't care).
  void args.trim;
  void args.km;
  return [
    args.year,
    args.make.trim().toLowerCase(),
    normalizeModelForFallback(args.model),
  ].join("|");
}

/** Find the cheapest cash listing in the entry, or null if none. */
export function cheapestCash(entry: CrossSourceEntry): CrossListing | null {
  let best: CrossListing | null = null;
  for (const l of entry.listings) {
    if (l.priceCad == null) continue;
    if (best == null || l.priceCad < best.priceCad!) best = l;
  }
  return best;
}

/** Find the active lease-takeover listing, or null. */
export function leaseTakeover(entry: CrossSourceEntry): CrossListing | null {
  return entry.listings.find((l) => l.source === "leasebusters" && l.monthlyPaymentCad != null) ?? null;
}
