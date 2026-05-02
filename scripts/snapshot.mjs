#!/usr/bin/env node
// Append a timestamped snapshot of current units.json into data/snapshots/.
// Run via `npm run snapshot`. Designed to be safe on every run (idempotent
// per-day: overwrites the day's snapshot if one already exists).

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dataDir = path.join(root, "data");
const snapDir = path.join(dataDir, "snapshots");

const unitsRaw = await fs.readFile(path.join(dataDir, "units.json"), "utf8");
const units = JSON.parse(unitsRaw);

const takenAt = new Date().toISOString();
const dateKey = takenAt.slice(0, 10);

const snapshot = {
  takenAt,
  unitCount: units.length,
  units: units.map((u) => ({
    id: u.id,
    dealerId: u.dealerId,
    model: u.model,
    trim: u.trim,
    askingPrice: u.dealerAskingPrice,
    daysOnLot: u.daysOnLot,
    status: u.status,
    listingUrl: u.listingUrl,
    vin: u.vin,
  })),
};

await fs.mkdir(snapDir, { recursive: true });
const outPath = path.join(snapDir, `${dateKey}.json`);
await fs.writeFile(outPath, JSON.stringify(snapshot, null, 2) + "\n");
console.log(`Snapshot written: ${path.relative(root, outPath)} (${snapshot.unitCount} units)`);
