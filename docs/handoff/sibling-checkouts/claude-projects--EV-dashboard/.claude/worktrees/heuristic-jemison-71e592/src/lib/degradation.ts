// Battery degradation projection (F-10).
//
// Calibrated from Recurrent's 2024 fleet-data report (https://www.recurrentauto.com/research)
// and Geotab's BEV battery health study. Both sources point to the same shape:
// fast loss in year-1 (capacity calibration + early SEI growth), then a long
// near-linear decline through ~year-10, with chemistry-dependent rates.
//
// We model that as a piecewise function: a one-time "year-1 step" loss, then
// a per-year exponential decay on whatever's left. Both numbers are
// chemistry-aware (LFP degrades meaningfully slower than NMC at calendar age).
//
// All values are FLEET MEDIAN — individual cars can sit ±5 percentage points
// either side. That's why the CompareView rows that consume this carry Low
// confidence.

import type { BatteryChemistry } from "../types";

export interface DegradationProfile {
  /** One-time capacity loss in year 1 (calibration + SEI). 0–1 fraction. */
  yearOneLoss: number;
  /** Annualized loss rate from year 2 onwards. 0–1 fraction. */
  annualLoss: number;
  /** Confidence flag for the formula's overall accuracy. */
  confidence: "High" | "Medium" | "Low";
  /** Source citation for the calibration. */
  sourceLabel: string;
}

const PROFILES: Record<BatteryChemistry, DegradationProfile> = {
  // Recurrent 2024: NMC fleet shows ~5% year-one loss, ~1.7%/yr after.
  NMC: {
    yearOneLoss: 0.05,
    annualLoss: 0.017,
    confidence: "Medium",
    sourceLabel: "Recurrent Auto 2024 fleet data — NMC median",
  },
  // NCA tracks NMC closely; treat as same profile.
  NCA: {
    yearOneLoss: 0.05,
    annualLoss: 0.017,
    confidence: "Medium",
    sourceLabel: "Recurrent Auto 2024 fleet data — NCA ~ NMC",
  },
  // LFP fleet: ~3% year-one loss, ~1.0%/yr after. Tesla LFP packs
  // (Model 3 SR / Megapack data) consistently hold up better.
  LFP: {
    yearOneLoss: 0.03,
    annualLoss: 0.010,
    confidence: "Medium",
    sourceLabel: "Recurrent Auto 2024 fleet data — LFP median",
  },
  // LMR is too new in passenger EVs (GM 2026) to have fleet data;
  // estimated to sit between NMC and LFP.
  LMR: {
    yearOneLoss: 0.04,
    annualLoss: 0.014,
    confidence: "Low",
    sourceLabel: "Estimate — interpolated NMC/LFP, fleet data not yet public",
  },
  // Unknown chemistry — fall back to the conservative (worse) NMC profile.
  UNKNOWN: {
    yearOneLoss: 0.05,
    annualLoss: 0.020,
    confidence: "Low",
    sourceLabel: "Fallback — NMC-conservative profile, chemistry not specified",
  },
};

export function profileFor(chemistry: BatteryChemistry): DegradationProfile {
  return PROFILES[chemistry] ?? PROFILES.UNKNOWN;
}

/**
 * Projected remaining range at calendar age `years`.
 *
 * Formula:
 *   year 0: ratedRange (no loss)
 *   year ≥1: ratedRange × (1 - yearOneLoss) × (1 - annualLoss)^(years - 1)
 *
 * Years can be fractional. Negative years clamp to 0.
 */
export function projectedRangeKm(
  ratedRangeKm: number,
  chemistry: BatteryChemistry,
  years: number,
): number {
  if (!Number.isFinite(ratedRangeKm) || ratedRangeKm <= 0) return 0;
  if (years <= 0) return ratedRangeKm;
  const p = profileFor(chemistry);
  const afterYearOne = ratedRangeKm * (1 - p.yearOneLoss);
  if (years <= 1) {
    // Linear interp from full range at y=0 to (1 - yearOneLoss) at y=1
    return ratedRangeKm - (ratedRangeKm - afterYearOne) * years;
  }
  return afterYearOne * Math.pow(1 - p.annualLoss, years - 1);
}

/**
 * Percent of original range remaining at calendar age `years`. 0–100.
 * Useful for the UI "75% of original range" display.
 */
export function projectedCapacityPct(chemistry: BatteryChemistry, years: number): number {
  const ref = projectedRangeKm(100, chemistry, years);
  return Math.max(0, Math.min(100, ref));
}

/**
 * Render a fixed schedule of (year, range, percent) checkpoints — used by the
 * CompareView degradation rows so they all stay in sync.
 */
export function degradationSchedule(
  ratedRangeKm: number,
  chemistry: BatteryChemistry,
  years: number[] = [5, 8, 10],
): { year: number; range_km: number; percent: number }[] {
  return years.map((y) => ({
    year: y,
    range_km: projectedRangeKm(ratedRangeKm, chemistry, y),
    percent: projectedCapacityPct(chemistry, y),
  }));
}
