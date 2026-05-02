import seedJson from "./seed.json";
import type { Dataset, Vehicle, Brand } from "../types";
import { DatasetSchema } from "./schema";

// Zod-validate at import. Bad data fails loudly here rather than producing
// undefined fields downstream in the UI. In dev this surfaces as a crash on
// `npm run dev`; in tests, the Zod error message names the offending path.
const parseResult = DatasetSchema.safeParse(seedJson);
if (!parseResult.success) {
  const issues = parseResult.error.issues
    .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(
    `seed.json failed schema validation:\n${issues}\n\n` +
      `Fix the flagged fields in src/data/seed.json, then reload.`
  );
}

export const dataset = parseResult.data as unknown as Dataset;

export const allBrands: Brand[] = dataset.brands;
export const allVehicles: Vehicle[] = dataset.vehicles;

export const brandById = (id: string): Brand | undefined =>
  allBrands.find((b) => b.id === id);

export const vehicleById = (id: string): Vehicle | undefined =>
  allVehicles.find((v) => v.id === id);
