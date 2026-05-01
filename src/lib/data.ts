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
  SnapshotSchema,
  type Dealer,
  type Incentive,
  type InventoryUnit,
  type ScoredUnit,
  type Snapshot,
} from "./types";
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

export type DataMeta = {
  unitsUpdatedAt: string;
  incentivesUpdatedAt: string;
  snapshotCount: number;
};

export async function loadMeta(): Promise<DataMeta> {
  const [unitsStat, incStat, snaps] = await Promise.all([
    fs.stat(path.join(DATA_DIR, "units.json")),
    fs.stat(path.join(DATA_DIR, "incentives.json")),
    listSnapshotFiles(),
  ]);
  return {
    unitsUpdatedAt: unitsStat.mtime.toISOString(),
    incentivesUpdatedAt: incStat.mtime.toISOString(),
    snapshotCount: snaps.length,
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
    const otdBreakdown = computeOtd(unit, dealer);
    const applicable = applicableIncentives(unit, dealer, incentives);
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
