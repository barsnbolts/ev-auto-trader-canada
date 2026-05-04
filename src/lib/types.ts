import { z } from "zod";
import { MODELS, PROVINCES, SUPPORTED_YEARS } from "./constants";

// ── Provenance types (ported from sibling EV dashboard) ─────────────────────

export type Confidence = "High" | "Medium" | "Low";

export interface Source {
  url: string;
  name: string;
  accessed: string; // ISO date
}

/** A single data point with its provenance. */
export interface CitedValue<T> {
  value: T | null;
  source?: Source;
  confidence: Confidence;
  notes?: string;
}

export interface ChargingCurvePoint {
  socPct: number;   // renamed from sibling's soc_pct
  kw: number;
}

/**
 * Read a hasHeatPump field that may be a plain boolean (legacy) or a
 * CitedValue<boolean> (new). Returns boolean | null for consumers.
 */
export function readHeatPump(
  v: CitedValue<boolean> | boolean | null | undefined,
): boolean | null {
  if (v == null) return null;
  if (typeof v === "boolean") return v;
  return v.value;
}

/**
 * Read a numeric field that may be a plain number (legacy) or a
 * CitedValue<number> (new). Returns number | undefined for consumers.
 */
export function readNumeric(
  v: CitedValue<number> | number | null | undefined,
): number | undefined {
  if (v == null) return undefined;
  if (typeof v === "number") return v;
  return v.value ?? undefined;
}

export const ProvinceSchema = z.enum(PROVINCES);
export const ModelSchema = z.enum(MODELS);

// Buyer context = the household-level facts that swing incentive
// eligibility and tax. Extends the original buyer-province concept (which
// shipped first as a single-string cookie) with two boolean flags that
// gate Hyundai/Kia loyalty + conquest programs. Persisted as a single JSON
// cookie (see lib/buyerContextServer.ts and lib/buyerContext.ts client
// hook). Defaults: ON province, no loyalty, no conquest.
export const BuyerContextSchema = z.object({
  province: ProvinceSchema,
  loyalty: z.boolean(),       // currently owns a Hyundai/Kia
  conquest: z.boolean(),      // currently owns a competing brand (eligible for conquest cash)
});
export type BuyerContext = z.infer<typeof BuyerContextSchema>;

export const YearSchema = z.union(
  SUPPORTED_YEARS.map((y) => z.literal(y)) as [
    z.ZodLiteral<2024>,
    z.ZodLiteral<2025>,
    z.ZodLiteral<2026>,
  ],
);

export const DealerSchema = z.object({
  id: z.string(),
  brand: z.enum(["Kia", "Hyundai"]),
  name: z.string(),
  address: z.string(),
  city: z.string(),
  province: ProvinceSchema,
  postal: z.string().optional(),
  phone: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  inventoryUrl: z.string().url().optional(),
});
export type Dealer = z.infer<typeof DealerSchema>;

export const UnitStatus = z.enum([
  "in_stock",
  "in_transit",
  "demo",
  "loaner",
  "sold_pending",
]);
export type UnitStatus = z.infer<typeof UnitStatus>;

export const InventoryUnitSchema = z.object({
  id: z.string(),                    // stable hash of vin or stock#+dealer
  vin: z.string().optional(),
  stockNumber: z.string().optional(),
  model: ModelSchema,
  year: YearSchema,
  trim: z.string(),
  drivetrain: z.enum(["RWD", "AWD"]),
  exteriorColor: z.string(),
  interiorColor: z.string(),
  msrp: z.number(),                  // base MSRP
  // Where this MSRP came from. "spec-lookup" = matched (model,year,trim) in
  // specs.json. "default-table" = fell back to the curated DEFAULT_MSRP map
  // in build_units_from_at.py (less precise but still reasonable). "asking-
  // fallback" = no MSRP source at all; we used the dealer's asking price as
  // a stand-in, which makes any "discount vs MSRP" math meaningless and
  // inflates dealScore artificially. UI uses this to render confidence
  // chips and to filter such units out of "Top Deals" on the home page.
  // Optional for back-compat: rows pre-discriminator parse without it.
  msrpSource: z.enum(["spec-lookup", "default-table", "asking-fallback"]).optional(),
  freightPdi: z.number(),            // freight + PDI
  dealerAskingPrice: z.number(),     // dealer's listed price (may be MSRP, may be discounted)
  status: UnitStatus,
  daysOnLot: z.number().int().nonnegative().optional(),
  firstSeen: z.string(),             // ISO date the unit first appeared in our snapshots
  lastSeen: z.string(),              // ISO date last confirmed in stock
  dealerId: z.string(),
  listingUrl: z.string().url().optional(),
  isDemo: z.boolean().optional(),
  demoKm: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});
export type InventoryUnit = z.infer<typeof InventoryUnitSchema>;

export const IncentiveScopeSchema = z.enum([
  "federal",
  "provincial",
  "manufacturer_cash",
  "loyalty",
  "conquest",
  "lease_promo",
  "finance_promo",
  "charger_install",
]);
export type IncentiveScope = z.infer<typeof IncentiveScopeSchema>;

export const IncentiveSchema = z.object({
  id: z.string(),
  scope: IncentiveScopeSchema,
  name: z.string(),
  appliesTo: z.object({
    models: z.array(ModelSchema).optional(),  // omit = all
    trims: z.array(z.string()).optional(),
    years: z.array(YearSchema).optional(),
    provinces: z.array(ProvinceSchema).optional(),
  }).optional(),
  amountCad: z.number().optional(),           // simple cash incentive
  aprPercent: z.number().optional(),          // for finance/lease promos
  termMonths: z.number().int().optional(),
  residualPercent: z.number().optional(),     // lease only
  monthlyPaymentExample: z.number().optional(),
  downPaymentExample: z.number().optional(),
  // Lease-specific structural fields. Per-incentive overrides over the
  // OEM-default lease terms in MarketIntelSchema.oemSubventions2026May.
  // capCostReductionCad: signing-time down on a lease (a.k.a. "cash due at
  // signing" minus first month's payment). Distinct from finance down.
  leaseSecurityDepositCad: z.number().optional(),
  leaseAnnualMileageKm: z.number().optional(),
  leaseOverageCadPerKm: z.number().optional(),
  capCostReductionCad: z.number().optional(),
  status: z.enum(["active", "paused", "ended", "upcoming"]),
  effectiveFrom: z.string().optional(),       // ISO
  effectiveUntil: z.string().optional(),      // ISO
  stackableWith: z.array(z.string()).optional(), // ids of other incentives
  source: z.string().optional(),              // URL or note for verification
  notes: z.string().optional(),               // eligibility caveats, restrictions
  lastVerified: z.string(),                   // ISO
  // EVAP-style structural fields. The federal EVAP rebate is conditional
  // on (a) transaction value <= cap, (b) lease term, (c) origin country.
  // Modeling these explicitly lets the OTD calculator decide whether the
  // rebate applies for a given unit instead of treating amountCad as flat.
  transactionValueCapCad: z.number().optional(),     // EVAP: $50,000
  capAppliesToImported: z.boolean().optional(),      // EVAP: true (Cdn-made exempt)
  leaseTermProration: z.record(z.string(), z.number()).optional(), // {"48":5000,"36":3750,...}
  // Roulez-vert-style calendar tier history. Registration date selects the
  // amount; useful for QC dealers + future-tier projections.
  yearTierAmounts: z.record(z.string(), z.number()).optional(),    // {"2024":7000,...}
  effectiveByRegistrationDate: z.boolean().optional(),
});
export type Incentive = z.infer<typeof IncentiveSchema>;

// Tax + dealer-fee structural data. Lives in data/taxes-and-fees.json so it
// can be refreshed without touching application code.
export const TaxesAndFeesSchema = z.object({
  salesTaxByProvince: z.record(z.string(), z.object({
    type: z.enum(["HST", "GST", "GST+PST", "GST+QST"]),
    ratePercent: z.number().optional(),
    gstPercent: z.number().optional(),
    pstPercent: z.number().optional(),
    qstPercent: z.number().optional(),
  })),
  ontarioDealerFees: z.object({
    acExciseTaxCad: z.number(),
    omvicCad: z.number(),
    tireStewardshipCad: z.number(),
    govLicensingCad: z.number(),
    rdprmCad: z.number().optional(),
  }),
  bcVehicleSurtaxBrackets: z.array(z.object({
    minPriceCad: z.number(),
    maxPriceCad: z.number().nullable(),
    ratePercent: z.number(),
  })),
  federalLuxuryTax: z.object({
    thresholdCad: z.number(),
    rateRule: z.string(),
    appliesToEvs: z.boolean(),
    usedExempt: z.boolean(),
  }),
  freightPdiByOem: z.object({
    Kia: z.number(),
    Hyundai: z.number(),
  }),
  source: z.string().optional(),
  lastVerified: z.string(),
});
export type TaxesAndFees = z.infer<typeof TaxesAndFeesSchema>;

// Market intel: recall families, OEM subventions, competitor benchmarks.
// Surfaced on the dashboard and in the unit drawer for negotiation context.
export const MarketIntelSchema = z.object({
  knownIssues: z.array(z.object({
    model: ModelSchema.optional(),
    yearRange: z.string(),
    issue: z.string(),
    severity: z.enum(["low", "medium", "high"]),
    resolution: z.string().optional(),
    warrantyExtensionYears: z.number().optional(),
    warrantyExtensionKm: z.number().optional(),
    source: z.string().optional(),
  })),
  warrantyTerms: z.object({
    kiaBatteryYears: z.number(),
    kiaBatteryKm: z.number(),
    hyundaiBatteryYears: z.number(),
    hyundaiBatteryKm: z.number(),
    iccuExtensionYears: z.number().optional(),
    iccuExtensionKm: z.number().optional(),
  }),
  competingEvs: z.array(z.object({
    make: z.string(),
    model: z.string(),
    year: z.number().int(),
    drivetrain: z.string().optional(),
    msrpCad: z.number().optional(),
    rangeKm: z.number().optional(),
    qualifiesForEvap: z.boolean(),
    source: z.string().optional(),
  })),
  oemSubventions2026May: z.object({
    Kia: z.object({
      bonusCadByModel: z.record(z.string(), z.number()).optional(),
      loyaltyRateReductionPercent: z.number().optional(),
      militaryCad: z.number().optional(),
      mobilityCad: z.number().optional(),
    }).optional(),
    Hyundai: z.object({
      springDriveBonusMaxCad: z.number().optional(),
      leaseSecurityDepositCad: z.number().optional(),
      leaseAnnualKm: z.number().optional(),
      leaseOverageCadPerKm: z.number().optional(),
      loyaltyLeaseRateReductionPercent: z.number().optional(),
      loyaltyFinanceRateReductionPercent: z.number().optional(),
    }).optional(),
  }).optional(),
  endOfMonthSignal: z.string().optional(),
  lastVerified: z.string(),
});
export type MarketIntel = z.infer<typeof MarketIntelSchema>;

// ── CitedValue zod schema (for SpecSchema augmentation) ─────────────────────

const SourceSchema = z.object({
  url: z.string(),
  name: z.string(),
  accessed: z.string(),
});

function citedValue<T extends z.ZodTypeAny>(inner: T) {
  return z.object({
    value: inner.nullable(),
    source: SourceSchema.optional(),
    confidence: z.enum(["High", "Medium", "Low"]),
    notes: z.string().optional(),
  });
}

// ── Spec ─────────────────────────────────────────────────────────────────────

export const SpecSchema = z.object({
  model: ModelSchema,
  year: YearSchema,
  trim: z.string(),
  drivetrain: z.enum(["RWD", "AWD"]),
  motorKw: z.number().optional(),
  motorHp: z.number().optional(),
  // Legacy flat number OR new CitedValue shape — both accepted
  batteryKwh: z.union([z.number(), citedValue(z.number())]).optional(),
  rangeKm: z.number().optional(),
  dcFastChargeKw: z.number().optional(),
  acChargeKw: z.number().optional(),
  zeroToHundredSec: z.number().optional(),
  // Legacy flat number OR new CitedValue shape
  cargoLitres: z.union([z.number(), citedValue(z.number())]).optional(),
  seats: z.number().int().optional(),
  // Legacy flat number OR new CitedValue shape
  weightKg: z.union([z.number(), citedValue(z.number())]).optional(),
  msrpCad: z.number().optional(),
  freightPdiCad: z.number().optional(),
  // Heat-pump availability per trim. Tri-state:
  //   true  = heat pump confirmed standard
  //   false = confirmed NOT standard (resistive heater only)
  //   null / undefined = not yet researched (renders as "?" chip in UI)
  // UPGRADED: now accepts CitedValue<boolean> (new) or plain boolean (legacy).
  // Use readHeatPump() helper to safely extract the boolean value in UI.
  hasHeatPump: z
    .union([
      z.boolean().nullable(),
      citedValue(z.boolean()),
    ])
    .optional(),
  heatPumpSource: z.string().optional(),       // URL the answer came from
  heatPumpConfidence: z.enum(["High", "Medium", "Low"]).optional(),
  heatPumpAccessed: z.string().optional(),     // ISO date the source was checked
  notes: z.string().optional(),
  source: z.string().optional(),
  // ── New CitedValue fields (additive — absent on pre-F1 entries) ──────────
  batteryKwhUsable: citedValue(z.number()).optional(),
  batteryChemistry: z
    .enum(["LFP", "NMC", "NCA", "LMR", "UNKNOWN"])
    .optional(),
  rangeEpaKm: citedValue(z.number()).optional(),
  rangeProtocol: z.enum(["EPA", "WLTP", "NRCan", "RealWorld"]).optional(),
  acChargeMaxKw: citedValue(z.number()).optional(),
  dcChargeMaxKw: citedValue(z.number()).optional(),
  portType: z
    .enum(["NACS", "CCS1", "CCS2", "CHAdeMO", "J1772_ONLY"])
    .optional(),
  heatPumpMinEffectiveC: citedValue(z.number()).optional(),
  thermalManagement: z
    .enum(["active_liquid", "passive", "active_refrigerant", "UNKNOWN"])
    .optional(),
  // Per-vehicle thermal characteristics for accurate DC-charge ramp modelling.
  // All optional — defaults in src/lib/thermal.ts are sensible for a generic
  // 80 kWh NMC pack. Override per-vehicle when manufacturer data available.
  batteryThermalMassKjPerKwh: z.number().optional(), // default 10.0
  heatLossCoeffKwPerC: z.number().optional(),         // default 0.05 + 0.0008 × kWh
  packHeaterKw: z.number().optional(),                // E-GMP ~5.5; some EVs lack one
  chargingArchitectureVolts: z.union([z.literal(400), z.literal(800)]).optional(),
  batteryPreconditioning: z.enum(["manual", "nav-based", "auto", "none"]).optional(),
  chargingCurve: z
    .array(z.object({ socPct: z.number(), kw: z.number() }))
    .optional(),
  bodyStyle: z
    .enum(["Sedan", "Hatchback", "SUV", "Crossover", "Truck", "Minivan", "Wagon"])
    .optional(),
  powertrain: z.enum(["BEV", "PHEV", "EREV"]).optional(),
  generationLabel: z.string().optional(),
});
export type Spec = z.infer<typeof SpecSchema>;

// Used-market reference data: 2023-2024 listings of the same nameplates,
// scraped from AutoTrader. Used purely as a depreciation benchmark for new-
// car negotiation leverage. Not part of the inventory the buyer can purchase.
export const UsedListingSchema = z.object({
  id: z.string(),
  model: ModelSchema,
  year: z.number().int(),         // wider than YearSchema — used market includes older MYs
  title: z.string(),
  priceCad: z.number(),
  kmDriven: z.number().int().nonnegative(),
  dealerName: z.string(),
  city: z.string(),
  province: ProvinceSchema,
  url: z.string().url(),
  lastSeen: z.string(),           // ISO date
});
export type UsedListing = z.infer<typeof UsedListingSchema>;

export type UsedMarketStat = {
  model: (typeof MODELS)[number];
  count: number;
  medianPriceCad: number;
  minPriceCad: number;
  maxPriceCad: number;
  medianKm: number;
  // Pulled from new-car specs for delta context.
  newMsrpFloorCad: number | null;
  // Median used / new-MSRP-floor — lower = steeper depreciation.
  retentionPercent: number | null;
};

export const SnapshotSchema = z.object({
  takenAt: z.string(),                        // ISO
  unitCount: z.number().int(),
  units: z.array(z.object({
    id: z.string(),
    dealerId: z.string(),
    model: ModelSchema,
    trim: z.string(),
    askingPrice: z.number(),
    daysOnLot: z.number().int().nonnegative().optional(),
    status: UnitStatus,
    // Added 2026-05-01 to make snapshot diffs survive id changes (id is
    // now a stable hash; older snapshots used positional ids). Diffing on
    // listingUrl is the durable identity. Optional for back-compat.
    listingUrl: z.string().url().optional(),
    vin: z.string().optional(),
  })),
});
export type Snapshot = z.infer<typeof SnapshotSchema>;

export type IncentiveLine = {
  id: string;
  name: string;
  scope: IncentiveScope;
  amountCad: number;
};

// Cash OTD breakdown. The legacy single-path shape — every existing route
// reads this. Promoted from anonymous inline in 2026-05-02 schema pass so
// otdPaths.cash can reuse the type.
export type OtdBreakdown = {
  msrp: number;
  freightPdi: number;
  dealerAdjustment: number;       // negative if discount, positive if markup
  acExciseTax: number;
  rdprm: number;
  omvic: number;
  tireStewardship: number;
  govLicensing: number;
  salesTax: number;
  transportCost: number;          // 0 if buyer-province == dealer-province
  salesTaxProvince: string;       // which province's tax we used (= buyer's)
  incentivesApplied: IncentiveLine[]; // per-line cash deductions
  incentivesTotalCad: number;         // sum of incentivesApplied
  total: number;
};

// Finance path breakdown. Cash OTD spread over a term at the promo APR.
// Down + amortized monthly + total interest. Generated by computeFinanceOtd
// when at least one matching finance_promo applies.
export type FinanceBreakdown = {
  aprPercent: number;
  termMonths: number;
  downPaymentCad: number;
  amountFinancedCad: number;        // OTD total - down payment
  monthlyPaymentCad: number;
  totalInterestCad: number;
  totalCostCad: number;             // OTD + total interest
  promoId?: string;                 // which incentive drove this
};

// Lease path breakdown. Monthly = depreciation + finance charge over the
// term. Residual buyout = MSRP × residualPercent. Mileage allowance + per-km
// overage flagged as cost-of-ownership risk. Generated by computeLeaseOtd
// when at least one matching lease_promo applies.
export type LeaseBreakdown = {
  aprPercent: number;               // money factor × 2400 expressed as APR
  termMonths: number;
  residualPercent: number;
  residualBuyoutCad: number;        // MSRP × residualPercent
  capCostCad: number;               // MSRP + freight - capCostReduction
  capCostReductionCad: number;      // signing down
  securityDepositCad: number;
  annualMileageKm: number;
  overageCadPerKm: number;
  monthlyPaymentCad: number;        // pre-tax monthly
  monthlyPaymentWithTaxCad: number; // monthly × (1 + provincial tax rate)
  totalLeaseCostCad: number;        // sum of payments + cap reduction + security
  promoId?: string;
};

export type ScoredUnit = InventoryUnit & {
  otdCad: number;
  otdBreakdown: OtdBreakdown;
  // 3-path deal modeling (cash + finance + lease). Populated from 2026-05-02.
  // cash mirrors top-level otdBreakdown for backward compat. finance/lease
  // only present when a matching incentive applies to this unit + buyer
  // context.
  otdPaths?: {
    cash: OtdBreakdown;
    finance?: FinanceBreakdown;
    lease?: LeaseBreakdown;
  };
  dealScore: number;                // 0-100
  dealScoreBreakdown: {
    priceVsMsrp: number;
    daysOnLot: number;
    dealerPressure: number;
    incentiveStack: number;
  };
  applicableIncentives: Incentive[];
};
