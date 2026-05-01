// Data layer: loads JSON from /data and validates with the zod schemas.
// Server-only; never imported into a "use client" file.

import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";

import {
  DealerSchema,
  IncentiveSchema,
  InventoryUnitSchema,
  MarketIntelSchema,
  SnapshotSchema,
  SpecSchema,
  TaxesAndFeesSchema,
  UsedListingSchema,
  type Dealer,
  type Incentive,
  type InventoryUnit,
  type MarketIntel,
  type ScoredUnit,
  type Snapshot,
  type Spec,
  type TaxesAndFees,
  type UsedListing,
  type UsedMarketStat,
} from "./types";
import { MODELS } from "./constants";
import { applicableIncentives, computeDealScore, computeOtd } from "./scoring";

const DATA_DIR = path.join(process.cwd(), "data");

async function readJson<T>(file: string, schema: z.ZodType<T>): Promise<T> {
  const raw = await fs.readFile(path.join(DATA_DIR, file), "utf8");
  return schema.parse(JSON.parse(raw));
}

export async function loadDealers(): Promise<Dealer[]> {
  return readJson("dealers.json", z.array(DealerSchema));
}

export async function loadUnits(): Promise<InventoryUnit[]> {
  return readJson("units.json", z.array(InventoryUnitSchema));
}

export async function loadIncentives(): Promise<Incentive[]> {
  return readJson("incentives.json", z.array(IncentiveSchema));
}

export async function loadSpecs(): Promise<Spec[]> {
  try {
    return await readJson("specs.json", z.array(SpecSchema));
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return [];
    throw err;
  }
}

export async function loadTaxesAndFees(): Promise<TaxesAndFees | null> {
  try {
    return await readJson("taxes-and-fees.json", TaxesAndFeesSchema);
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return null;
    throw err;
  }
}

export async function loadMarketIntel(): Promise<MarketIntel | null> {
  try {
    return await readJson("market-intel.json", MarketIntelSchema);
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return null;
    throw err;
  }
}

export async function loadUsedListings(): Promise<UsedListing[]> {
  try {
    return await readJson("used-listings.json", z.array(UsedListingSchema));
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return [];
    throw err;
  }
}

// Per-model used-market summary used as new-car negotiation leverage data.
// retentionPercent = median used / lowest new MSRP — the lower it is, the
// faster these cars depreciate, the harder you can push on a new MSRP.
export function computeUsedMarketStats(
  used: UsedListing[],
  specs: Spec[],
): UsedMarketStat[] {
  const median = (arr: number[]): number => {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };
  const newMsrpByModel = new Map<string, number>();
  for (const s of specs) {
    if (!s.msrpCad) continue;
    const cur = newMsrpByModel.get(s.model);
    if (cur == null || s.msrpCad < cur) newMsrpByModel.set(s.model, s.msrpCad);
  }
  return MODELS.map((model) => {
    const rows = used.filter((u) => u.model === model);
    const prices = rows.map((u) => u.priceCad);
    const kms = rows.map((u) => u.kmDriven);
    const medPrice = median(prices);
    const newFloor = newMsrpByModel.get(model) ?? null;
    return {
      model,
      count: rows.length,
      medianPriceCad: medPrice,
      minPriceCad: prices.length ? Math.min(...prices) : 0,
      maxPriceCad: prices.length ? Math.max(...prices) : 0,
      medianKm: median(kms),
      newMsrpFloorCad: newFloor,
      retentionPercent: newFloor && medPrice ? Math.round((medPrice / newFloor) * 100) : null,
    };
  }).filter((s) => s.count > 0);
}

export function specKey(model: string, year: number, trim: string, drivetrain: string): string {
  return `${model}|${year}|${trim}|${drivetrain}`;
}

export function specMap(specs: Spec[]): Map<string, Spec> {
  return new Map(specs.map((s) => [specKey(s.model, s.year, s.trim, s.drivetrain), s]));
}

export type DataMeta = {
  unitsUpdatedAt: string;
  incentivesUpdatedAt: string;
  dealersUpdatedAt: string;
  snapshotCount: number;
  lastSnapshotAt: string | null;
};

export async function loadMeta(): Promise<DataMeta> {
  const [unitsStat, incStat, dealersStat, snaps] = await Promise.all([
    fs.stat(path.join(DATA_DIR, "units.json")),
    fs.stat(path.join(DATA_DIR, "incentives.json")),
    fs.stat(path.join(DATA_DIR, "dealers.json")),
    listSnapshotFiles(),
  ]);
  const lastSnapshotAt = snaps.length
    ? (await fs.stat(path.join(DATA_DIR, "snapshots", snaps[snaps.length - 1]))).mtime.toISOString()
    : null;
  return {
    unitsUpdatedAt: unitsStat.mtime.toISOString(),
    incentivesUpdatedAt: incStat.mtime.toISOString(),
    dealersUpdatedAt: dealersStat.mtime.toISOString(),
    snapshotCount: snaps.length,
    lastSnapshotAt,
  };
}

export async function listSnapshotFiles(): Promise<string[]> {
  const dir = path.join(DATA_DIR, "snapshots");
  try {
    const entries = await fs.readdir(dir);
    return entries
      .filter((e) => e.endsWith(".json"))
      .sort();
  } catch {
    return [];
  }
}

export async function loadSnapshots(limit?: number): Promise<Snapshot[]> {
  const files = await listSnapshotFiles();
  const slice = limit ? files.slice(-limit) : files;
  return Promise.all(
    slice.map((f) =>
      readJson(path.join("snapshots", f), SnapshotSchema),
    ),
  );
}

// Consolidated dataset: every unit decorated with OTD, deal score, and the
// incentives that apply. This is the single source of truth all UI reads from.
export async function loadScoredUnits(): Promise<{
  units: ScoredUnit[];
  dealers: Dealer[];
  dealerById: Map<string, Dealer>;
  incentives: Incentive[];
}> {
  const [units, dealers, incentives] = await Promise.all([
    loadUnits(),
    loadDealers(),
    loadIncentives(),
  ]);
  const dealerById = new Map(dealers.map((d) => [d.id, d]));
  const unitsByDealer = new Map<string, InventoryUnit[]>();
  for (const u of units) {
    const arr = unitsByDealer.get(u.dealerId) ?? [];
    arr.push(u);
    unitsByDealer.set(u.dealerId, arr);
  }

  const scored = units.map((unit) => {
    const dealer = dealerById.get(unit.dealerId);
    if (!dealer) {
      throw new Error(`Unit ${unit.id} references unknown dealer ${unit.dealerId}`);
    }
    const applicable = applicableIncentives(unit, dealer, incentives);
    const otdBreakdown = computeOtd(unit, dealer, applicable);
    const { score, breakdown } = computeDealScore({
      unit,
      dealer,
      dealerUnits: unitsByDealer.get(dealer.id) ?? [],
      applicable,
    });
    return {
      ...unit,
      otdCad: otdBreakdown.total,
      otdBreakdown,
      dealScore: score,
      dealScoreBreakdown: breakdown,
      applicableIncentives: applicable,
    } satisfies ScoredUnit;
  });

  return { units: scored, dealers, dealerById, incentives };
}
