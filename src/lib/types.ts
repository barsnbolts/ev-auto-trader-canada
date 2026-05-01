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
  lastVerified: z.string(),                   // ISO
});
export type Incentive = z.infer<typeof IncentiveSchema>;

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
