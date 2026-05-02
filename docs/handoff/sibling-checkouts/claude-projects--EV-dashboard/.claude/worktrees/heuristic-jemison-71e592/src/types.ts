// Type definitions mirror the data model in PROJECT_PLAN.md §6.
// These types are intentionally explicit; we prefer verbosity over guesswork
// because every number displayed must be traceable.

export type Powertrain = "BEV" | "PHEV" | "EREV";
export type DrivetrainVariant = "SINGLE_MOTOR" | "AWD";
export type PortType = "NACS" | "CCS1" | "CCS2" | "CHAdeMO" | "J1772_ONLY";
export type BatteryChemistry = "LFP" | "NMC" | "NCA" | "LMR" | "UNKNOWN";
export type Confidence = "High" | "Medium" | "Low";
export type BodyStyle =
  | "Sedan"
  | "Hatchback"
  | "SUV"
  | "Crossover"
  | "Truck"
  | "Minivan"
  | "Wagon";
export type RangeTestProtocol = "EPA" | "WLTP" | "NRCan" | "RealWorld";

export interface Source {
  url: string;
  name: string;
  accessed: string; // ISO date
}

/** A single data point (e.g. range at 20C) with its provenance. */
export interface CitedValue<T> {
  value: T | null;
  source?: Source;
  confidence: Confidence;
  notes?: string;
}

export interface Brand {
  id: string;
  name: string;
  country: string;
}

export interface ThermalPoint {
  temp_c: number;
  value: number;
  source?: Source;
}

export interface ChargingCurvePoint {
  soc_pct: number;
  kw: number;
}

export interface Vehicle {
  id: string;
  brand_id: string;
  model: string;
  generation_label: string; // e.g. "Highland (2024+)"
  year_start: number;
  year_end: number | null; // null = current
  powertrain: Powertrain;
  body_style: BodyStyle;
  drivetrain_variant: DrivetrainVariant;
  trim_label: string; // e.g. "Long Range RWD"

  // Core specs
  battery_kwh_total: CitedValue<number>;
  battery_kwh_usable: CitedValue<number>;
  battery_chemistry: BatteryChemistry;
  range_km: CitedValue<number>;
  range_protocol: RangeTestProtocol;
  ac_charge_kw_max: CitedValue<number>;
  dc_charge_kw_max: CitedValue<number>;
  port_type: PortType;
  seats: number;
  cargo_l_seats_up: CitedValue<number> | null;
  cargo_l_seats_down: CitedValue<number> | null;
  tow_rating_kg: CitedValue<number> | null;
  weight_kg: CitedValue<number> | null;

  // Thermal / physics model inputs (for Phase 3 slider)
  has_heat_pump: CitedValue<boolean>;
  thermal_management: "active_liquid" | "passive" | "active_refrigerant" | "UNKNOWN";

  // Per-vehicle thermal profile overrides (populated in Cluster B1).
  // All optional — thermal.ts falls back to chemistry-based defaults when absent.
  cold_derate_curve?: ThermalPoint[];     // capacity fraction vs ambient temp
  hvac_draw_kw_by_temp?: ThermalPoint[];  // HVAC draw (kW) vs ambient temp
  hp_min_temp_c?: number;                 // heat pump cutoff; below this → resistive
  precon_time_by_temp?: ThermalPoint[];   // minutes to precondition vs ambient temp
  precon_thermal_gain?: number;           // fraction of cold-soak DC derate recovered by precon
  dc_cold_soak_curve?: ThermalPoint[];    // DC peak factor vs temp when cold-soaked (800V advantage)

  // Charging curve (20C baseline; more curves added in Phase 3)
  charging_curve_20c: ChargingCurvePoint[];

  // Pricing
  msrp_cad: CitedValue<number>;
  federal_izev_cad: CitedValue<number>;
  provincial_rebate_cad_on: CitedValue<number>;

  // Battery degradation (fleet-average annual range loss fraction; Recurrent data)
  degradation_annual?: number; // default 0.02 (2%/yr) when absent

  // Overall vehicle data confidence (summary of per-field confidence)
  overall_confidence: Confidence;
  notes?: string;
}

export interface Dataset {
  schema_version: string;
  generated_at: string;
  brands: Brand[];
  vehicles: Vehicle[];
}
