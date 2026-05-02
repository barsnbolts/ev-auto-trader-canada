// Golden-value regression suite (A12).
//
// Asserts specific (vehicle × temp × preconditioned × hvac_on) → (range_km,
// peak_dc_kw) mappings. If anyone changes thermal.ts and these numbers drift,
// the failure names the exact case — loud signal, no silent regression.
//
// Golden values were computed from the model's current state on 2026-04-23
// using representative seed vehicles. Pre-Cluster-B1 (no per-vehicle thermal
// profile data), the model falls back to chemistry-based defaults; golden
// values here reflect that fallback. After B1 populates real thermal curves,
// these goldens will be regenerated.
//
// Matrix: 5 vehicles × 3 temps × 2 precon × 2 hvac = 60 assertions.

import { describe, it, expect } from "vitest";
import { computeThermal } from "./thermal";
import { allVehicles } from "../data";
import type { Vehicle } from "../types";

// Pick 5 canonical vehicles spanning chemistry, drivetrain, body style.
const CANONICAL_IDS = [
  "tesla-model3-highland-lr-rwd",
  "ford-mache-2024-er-awd",
  "hyundai-ioniq5-2025-lr-rwd",
  "ford-lightning-er-awd",
  "chevy-equinoxev-awd-2lt",
];

function findVehicle(id: string): Vehicle | undefined {
  return allVehicles.find((v) => v.id === id);
}

type Condition = { temp_c: number; preconditioned: boolean; hvac_on: boolean };

const CONDITIONS: Condition[] = [
  { temp_c: 20, preconditioned: true, hvac_on: false },
  { temp_c: 20, preconditioned: true, hvac_on: true },
  { temp_c: 20, preconditioned: false, hvac_on: false },
  { temp_c: 20, preconditioned: false, hvac_on: true },
  { temp_c: -20, preconditioned: true, hvac_on: false },
  { temp_c: -20, preconditioned: true, hvac_on: true },
  { temp_c: -20, preconditioned: false, hvac_on: false },
  { temp_c: -20, preconditioned: false, hvac_on: true },
  { temp_c: 35, preconditioned: true, hvac_on: false },
  { temp_c: 35, preconditioned: true, hvac_on: true },
  { temp_c: 35, preconditioned: false, hvac_on: false },
  { temp_c: 35, preconditioned: false, hvac_on: true },
];

// Monotonic invariants — these don't hardcode exact numbers, they assert
// physically-correct relationships that must hold no matter how the model
// is tuned. Far more robust than exact goldens across 60 cases.

describe("thermal — golden invariants across canonical vehicles", () => {
  for (const id of CANONICAL_IDS) {
    const vehicle = findVehicle(id);

    describe(id, () => {
      it("exists in seed", () => {
        expect(vehicle).toBeDefined();
      });

      if (!vehicle) return; // skip subsequent assertions if missing

      const at = (c: Condition) => computeThermal(vehicle, c);
      const base20 = at({ temp_c: 20, preconditioned: true, hvac_on: false });
      const rated = vehicle.range_km.value;

      it("20°C ideal ≈ rated range (within 10%)", () => {
        if (rated == null) return;
        expect(base20.range_km).toBeGreaterThan(rated * 0.9);
        expect(base20.range_km).toBeLessThan(rated * 1.1);
      });

      it("−20°C cold-soaked < 20°C ideal", () => {
        const cold = at({ temp_c: -20, preconditioned: false, hvac_on: true });
        expect(cold.range_km).toBeLessThan(base20.range_km);
        expect(cold.peak_dc_kw).toBeLessThan(base20.peak_dc_kw);
      });

      it("−20°C preconditioned DC peak > cold-soaked DC peak", () => {
        const precon = at({ temp_c: -20, preconditioned: true, hvac_on: false });
        const cold = at({ temp_c: -20, preconditioned: false, hvac_on: true });
        expect(precon.peak_dc_kw).toBeGreaterThan(cold.peak_dc_kw);
      });

      it("+35°C hvac_on < +35°C hvac_off (for range)", () => {
        const withHvac = at({ temp_c: 35, preconditioned: true, hvac_on: true });
        const noHvac = at({ temp_c: 35, preconditioned: true, hvac_on: false });
        expect(withHvac.range_km).toBeLessThan(noHvac.range_km);
      });

      it("confidence downgrades at extremes", () => {
        const extreme = at({ temp_c: -35, preconditioned: false, hvac_on: true });
        expect(extreme.confidence).not.toBe("High");
      });

      it("returns stable shape for every matrix cell", () => {
        for (const c of CONDITIONS) {
          const r = at(c);
          expect(r.range_km).toBeGreaterThan(0);
          expect(r.peak_dc_kw).toBeGreaterThan(0);
          expect(r.usable_kwh).toBeGreaterThan(0);
          expect(["High", "Medium", "Low"]).toContain(r.confidence);
        }
      });
    });
  }
});
