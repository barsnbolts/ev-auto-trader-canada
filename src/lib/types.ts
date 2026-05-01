import { z } from "zod";
import { MODELS, PROVINCES, SUPPORTED_YEARS } from "./constants";

export const ProvinceSchema = z.enum(PROVINCES);
export const ModelSchema = z.enum(MODELS);
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

export const SpecSchema = z.object({
  model: ModelSchema,
  year: YearSchema,
  trim: z.string(),
  drivetrain: z.enum(["RWD", "AWD"]),
  motorKw: z.number().optional(),
  motorHp: z.number().optional(),
  batteryKwh: z.number().optional(),
  rangeKm: z.number().optional(),
  dcFastChargeKw: z.number().optional(),
  acChargeKw: z.number().optional(),
  zeroToHundredSec: z.number().optional(),
  cargoLitres: z.number().optional(),
  seats: z.number().int().optional(),
  weightKg: z.number().optional(),
  msrpCad: z.number().optional(),
  freightPdiCad: z.number().optional(),
  notes: z.string().optional(),
  source: z.string().optional(),
});
export type Spec = z.infer<typeof SpecSchema>;

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
  })),
});
export type Snapshot = z.infer<typeof SnapshotSchema>;

export type ScoredUnit = InventoryUnit & {
  otdCad: number;
  otdBreakdown: {
    msrp: number;
    freightPdi: number;
    dealerAdjustment: number;       // negative if discount, positive if markup
    acExciseTax: number;
    rdprm: number;
    omvic: number;
    tireStewardship: number;
    govLicensing: number;
    salesTax: number;
    total: number;
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
