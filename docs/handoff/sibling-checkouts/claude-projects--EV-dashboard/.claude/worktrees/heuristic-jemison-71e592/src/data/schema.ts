// Zod runtime schemas mirroring src/types.ts.
// Validates seed.json at import — bad data fails loudly, not silently in the UI.
import { z } from "zod";

export const PowertrainSchema = z.enum(["BEV", "PHEV", "EREV"]);
export const DrivetrainVariantSchema = z.enum(["SINGLE_MOTOR", "AWD"]);
export const PortTypeSchema = z.enum(["NACS", "CCS1", "CCS2", "CHAdeMO", "J1772_ONLY"]);
export const BatteryChemistrySchema = z.enum(["LFP", "NMC", "NCA", "LMR", "UNKNOWN"]);
export const ConfidenceSchema = z.enum(["High", "Medium", "Low"]);
export const BodyStyleSchema = z.enum([
  "Sedan",
  "Hatchback",
  "SUV",
  "Crossover",
  "Truck",
  "Minivan",
  "Wagon",
]);
export const RangeTestProtocolSchema = z.enum(["EPA", "WLTP", "NRCan", "RealWorld"]);
export const ThermalManagementSchema = z.enum([
  "active_liquid",
  "passive",
  "active_refrigerant",
  "UNKNOWN",
]);

export const SourceSchema = z.object({
  url: z.string().url(),
  name: z.string().min(1),
  accessed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "accessed must be YYYY-MM-DD"),
});

/** Generic CitedValue factory — use citedValue(z.number()) etc. */
export const citedValue = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z.object({
    value: valueSchema.nullable(),
    source: SourceSchema.optional(),
    confidence: ConfidenceSchema,
    notes: z.string().optional(),
  });

export const CitedNumberSchema = citedValue(z.number());
export const CitedBoolSchema = citedValue(z.boolean());

export const ThermalPointSchema = z.object({
  temp_c: z.number(),
  value: z.number(),
  source: SourceSchema.optional(),
});

export const ChargingCurvePointSchema = z.object({
  soc_pct: z.number().min(0).max(100),
  kw: z.number().min(0),
});

export const BrandSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  country: z.string().min(1),
});

export const VehicleSchema = z.object({
  id: z.string().min(1),
  brand_id: z.string().min(1),
  model: z.string().min(1),
  generation_label: z.string(),
  year_start: z.number().int(),
  year_end: z.number().int().nullable(),
  powertrain: PowertrainSchema,
  body_style: BodyStyleSchema,
  drivetrain_variant: DrivetrainVariantSchema,
  trim_label: z.string(),

  battery_kwh_total: CitedNumberSchema,
  battery_kwh_usable: CitedNumberSchema,
  battery_chemistry: BatteryChemistrySchema,
  range_km: CitedNumberSchema,
  range_protocol: RangeTestProtocolSchema,
  ac_charge_kw_max: CitedNumberSchema,
  dc_charge_kw_max: CitedNumberSchema,
  port_type: PortTypeSchema,
  seats: z.number().int().positive(),
  cargo_l_seats_up: CitedNumberSchema.nullable(),
  cargo_l_seats_down: CitedNumberSchema.nullable(),
  tow_rating_kg: CitedNumberSchema.nullable(),
  weight_kg: CitedNumberSchema.nullable(),

  has_heat_pump: CitedBoolSchema,
  thermal_management: ThermalManagementSchema,

  // Per-vehicle thermal profile (optional — thermal.ts falls back to chemistry defaults)
  cold_derate_curve: z.array(ThermalPointSchema).optional(),
  hvac_draw_kw_by_temp: z.array(ThermalPointSchema).optional(),
  hp_min_temp_c: z.number().optional(),
  precon_time_by_temp: z.array(ThermalPointSchema).optional(),
  precon_thermal_gain: z.number().min(0).max(1).optional(),
  dc_cold_soak_curve: z.array(ThermalPointSchema).optional(),

  charging_curve_20c: z.array(ChargingCurvePointSchema),

  msrp_cad: CitedNumberSchema,
  federal_izev_cad: CitedNumberSchema,
  provincial_rebate_cad_on: CitedNumberSchema,

  degradation_annual: z.number().min(0).max(0.2).optional(),

  overall_confidence: ConfidenceSchema,
  notes: z.string().optional(),
});

export const DatasetSchema = z.object({
  schema_version: z.string(),
  generated_at: z.string(),
  brands: z.array(BrandSchema),
  vehicles: z.array(VehicleSchema),
});

export type DatasetParsed = z.infer<typeof DatasetSchema>;
