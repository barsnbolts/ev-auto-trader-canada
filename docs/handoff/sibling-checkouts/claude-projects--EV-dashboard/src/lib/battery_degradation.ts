// Battery degradation projection by chemistry.
// Based on Recurrent Auto fleet data + published longitudinal studies.
// Values are APPROXIMATE annual capacity loss at typical use (~20,000 km/yr,
// mixed DC + L2 charging, temperate climate). Real-world variance is high.
//
// Sources:
//   - Recurrent Auto 2024 "EV Battery Life Report"
//     https://www.recurrentauto.com/research/ev-battery-degradation
//   - Geotab Battery Degradation Tool dataset

import type { BatteryChemistry } from "../types";

// Annual capacity-loss rate (as fraction of original) per typical year of use.
// These are conservative end-of-first-year → end-of-Nth-year slopes.
const ANNUAL_LOSS: Record<BatteryChemistry, number> = {
  LFP: 0.008,   // ~0.8%/year — most durable; Recurrent fleet data
  NMC: 0.018,   // ~1.8%/year — typical high-nickel EV
  NCA: 0.020,   // ~2.0%/year — slightly hotter, faster decay
  LMR: 0.022,   // ~2.2%/year — emerging chemistry, conservative guess
  UNKNOWN: 0.020, // default to NCA-ish
};

export function retentionAtYear(chem: BatteryChemistry, years: number): number {
  const rate = ANNUAL_LOSS[chem] ?? ANNUAL_LOSS.UNKNOWN;
  // Simple linear first-order model. Real curves taper (less loss later),
  // but linear is fine for 5–10 year horizons where we care most.
  return Math.max(0.5, 1 - rate * years);
}

export function projectedRangeAtYear(ratedRangeKm: number, chem: BatteryChemistry, years: number): number {
  return ratedRangeKm * retentionAtYear(chem, years);
}
