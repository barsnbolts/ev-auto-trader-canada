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

export const MODELS = ["EV6", "Ioniq5", "Ioniq6"] as const;
export type Model = (typeof MODELS)[number];

export const MODEL_LABEL: Record<Model, string> = {
  EV6: "Kia EV6",
  Ioniq5: "Hyundai Ioniq 5",
  Ioniq6: "Hyundai Ioniq 6",
};

export const MODEL_BRAND: Record<Model, "Kia" | "Hyundai"> = {
  EV6: "Kia",
  Ioniq5: "Hyundai",
  Ioniq6: "Hyundai",
};

// Trim catalog — kept literal to power filters and validation. Update when
// Kia/Hyundai Canada release new MY26 trim names.
export const TRIMS_BY_MODEL: Record<Model, string[]> = {
  EV6: ["Light RWD", "Wind RWD", "Wind AWD", "Land AWD", "GT-Line AWD", "GT"],
  Ioniq5: [
    "Essential RWD",
    "Preferred RWD",
    "Preferred RWD Long Range",
    "Preferred AWD Long Range",
    "Limited AWD",
    "N",
  ],
  Ioniq6: [
    "Preferred RWD",
    "Preferred RWD Long Range",
    "Preferred AWD Long Range",
    "Limited AWD",
  ],
};

export const SUPPORTED_YEARS = [2024, 2025, 2026] as const;
export type Year = (typeof SUPPORTED_YEARS)[number];

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

// Typical Ontario dealer fees layered on top of MSRP for OTD math. Real
// per-dealer fees vary; these are conservative defaults until verified.
export const ON_DEALER_FEES = {
  airConditioningExciseTax: 100, // federal AC tax
  rdprmFee: 5,                   // RDPRM/lien registration
  omvicFee: 12.50,               // OMVIC fee
  tireStewardshipFee: 17.40,     // 4 tires x $4.35
  govLicensingEstimate: 105,     // plate / registration / safety estimate
} as const;
