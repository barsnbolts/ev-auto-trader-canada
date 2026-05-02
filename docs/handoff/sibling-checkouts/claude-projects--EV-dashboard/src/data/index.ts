import seedJson from "./seed.json";
import type { Dataset, Vehicle, Brand } from "../types";

// Cast is safe: seed.json is authored by hand to match Dataset schema.
// In Phase 2, this import is replaced by a runtime fetch from SQLite via Tauri.
export const dataset = seedJson as unknown as Dataset;

export const allBrands: Brand[] = dataset.brands;
export const allVehicles: Vehicle[] = dataset.vehicles;

export const brandById = (id: string): Brand | undefined =>
  allBrands.find((b) => b.id === id);

export const vehicleById = (id: string): Vehicle | undefined =>
  allVehicles.find((v) => v.id === id);
