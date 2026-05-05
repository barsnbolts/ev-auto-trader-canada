// Canonical reference data shared across the app. Edit here when official
// trims/years/provincial fees change so every page picks up the new value.

export const PROVINCES = [
  "AB",
  "BC",
  "MB",
  "NB",
  "NL",
  "NS",
  "NT",
  "NU",
  "ON",
  "PE",
  "QC",
  "SK",
  "YT",
] as const;
export type Province = (typeof PROVINCES)[number];

export const PROVINCE_NAMES: Record<Province, string> = {
  AB: "Alberta",
  BC: "British Columbia",
  MB: "Manitoba",
  NB: "New Brunswick",
  NL: "Newfoundland & Labrador",
  NS: "Nova Scotia",
  NT: "Northwest Territories",
  NU: "Nunavut",
  ON: "Ontario",
  PE: "Prince Edward Island",
  QC: "Quebec",
  SK: "Saskatchewan",
  YT: "Yukon",
};

// Sales tax by province (HST or GST+PST/QST). Used for true OTD math.
// Source for verification lives in research-prompts/incentives.md.
export const PROVINCE_TAX: Record<Province, number> = {
  AB: 0.05,
  BC: 0.12,
  MB: 0.12,
  NB: 0.15,
  NL: 0.15,
  NS: 0.15,
  NT: 0.05,
  NU: 0.05,
  ON: 0.13,
  PE: 0.15,
  QC: 0.14975,
  SK: 0.11,
  YT: 0.05,
};

export const MODELS = ["EV6", "Ioniq5", "Ioniq6", "EV9", "Ioniq9"] as const;
export type Model = (typeof MODELS)[number];

export const MODEL_LABEL: Record<Model, string> = {
  EV6: "Kia EV6",
  Ioniq5: "Hyundai Ioniq 5",
  Ioniq6: "Hyundai Ioniq 6",
  EV9: "Kia EV9",
  Ioniq9: "Hyundai Ioniq 9",
};

export const MODEL_BRAND: Record<Model, "Kia" | "Hyundai"> = {
  EV6: "Kia",
  Ioniq5: "Hyundai",
  Ioniq6: "Hyundai",
  EV9: "Kia",
  Ioniq9: "Hyundai",
};

export const SUPPORTED_YEARS = [2024, 2025, 2026] as const;

// Greater Golden Horseshoe coverage area for the "local" view. Cities here
// drive the default region filter on the inventory table.
export const GGH_CITIES = [
  "Toronto",
  "Mississauga",
  "Brampton",
  "Vaughan",
  "Markham",
  "Richmond Hill",
  "Pickering",
  "Ajax",
  "Whitby",
  "Oshawa",
  "Oakville",
  "Burlington",
  "Hamilton",
  "St. Catharines",
  "Niagara Falls",
  "Welland",
  "Kitchener",
  "Waterloo",
  "Cambridge",
  "Guelph",
  "Milton",
  "Newmarket",
  "Aurora",
  "Barrie",
];

// Typical Ontario dealer fees layered on top of MSRP for OTD math.
// Updated 2026-05-01 from cross-source DR (OMVIC bulletin Sep 2025; RPRA
// 2026 producer-pass-through ~$5.69/tire; multiple Ontario dealer
// disclosures showing $22 OMVIC and $25 tire on retail bills of sale).
/**
 * Scoring calibration constants (per F4 cleanup). Centralized so changes
 * surface in one place + the comments document the empirical reasoning
 * for each magic number rather than burying it in scoring.ts.
 */
export const SCORING = {
  /**
   * daysOnLot ceiling: at this many days, the dealer is maximally
   * negotiable. 0 days → 0 score. 60 days → ~0.5. 120+ → 1.0.
   * Calibrated against Ontario dealer behavior — most lots cycle
   * inventory in 60-90d; 120 captures the upper tail without saturating.
   */
  DAYS_ON_LOT_MAX: 120,
  /**
   * dealerPressure depth: 4+ same-trim units at one dealer signals they
   * over-stocked that variant and want it gone. Below 4 = normal stock.
   */
  PRESSURE_DEPTH_MAX: 4,
  /**
   * dealerPressure age: 90d average across the cluster signals the
   * over-stocked variant has been aging — dealer pain peaks here.
   */
  PRESSURE_AGE_MAX_DAYS: 90,
  /**
   * Federal GST rate (5%) applied at every OTD calculation. Constant
   * across all provinces; provincial portion lives in PROVINCE_TAX.
   */
  GST_RATE: 0.05,
} as const;

export const ON_DEALER_FEES = {
  airConditioningExciseTax: 100, // federal AC tax
  rdprmFee: 5,                   // RDPRM/lien registration (cash deals usually skip)
  omvicFee: 22,                  // OMVIC — raised from $12.50 effective 2025-09-01
  tireStewardshipFee: 22.76,     // 4 tires x ~$5.69 RPRA pass-through
  govLicensingEstimate: 105,     // plate / registration / safety estimate
} as const;

// BC PST progressive vehicle surtax brackets. Applies on top of 5% GST.
// Ranges captured from BC Chamber/Taxccount references.
// E-GMP Long Range AWD trims often cross from 7% (≤$54,999) into 10%
// ($57,000–$124,999) territory, materially shifting OTD vs Ontario.
export const BC_PST_BRACKETS: Array<{ minCad: number; maxCad: number | null; rate: number }> = [
  { minCad: 0,       maxCad: 55000,  rate: 0.07 },
  { minCad: 55000,   maxCad: 56000,  rate: 0.08 },
  { minCad: 56000,   maxCad: 57000,  rate: 0.09 },
  { minCad: 57000,   maxCad: 125000, rate: 0.10 },
  { minCad: 125000,  maxCad: 150000, rate: 0.15 },
  { minCad: 150000,  maxCad: null,   rate: 0.20 },
];

export function bcPstRateFor(priceCad: number): number {
  for (const b of BC_PST_BRACKETS) {
    if (priceCad >= b.minCad && (b.maxCad === null || priceCad < b.maxCad)) return b.rate;
  }
  return 0.07;
}
