// Thermal / physics model for EV range under ambient temperature.
//
// Ported verbatim from sibling EV dashboard (src/lib/thermal.ts).
// Adapted: exports a simpler `realRangeKm` surface that works with this
// repo's `Spec` shape (plain numbers, not CitedValue). The full
// `computeThermal(vehicle, inputs)` is also exported for completeness but
// requires the sibling's Vehicle shape — callers should prefer `realRangeKm`.
//
// Sources informing the default curves (accessed 2026-04-23):
//   - Geotab "Winter EV Range Loss" dataset
//     https://www.geotab.com/blog/ev-range/
//   - Recurrent Auto "The real effect of cold weather on EV range" (2024)
//     https://www.recurrentauto.com/research/winter-ev-range-loss
//   - Fastned "Real-world charging speed data" dashboard
//     https://support.fastned.nl/
//   - Bjorn Nyland, 1000 km Challenge normalized results (YouTube channel)
//     https://www.youtube.com/@BjornNyland
//   - P3 Group charging-curve tests
//     https://www.p3-group.com/en/p3-charging-index/

export type Confidence = "High" | "Medium" | "Low";
export type BatteryChemistry = "LFP" | "NMC" | "NCA" | "LMR" | "UNKNOWN";

export interface ThermalInputs {
  temp_c: number;
  preconditioned: boolean;
  hvac_on: boolean;
  speed_kph?: number;
}

export interface ThermalOutputs {
  range_km: number;
  usable_kwh: number;
  peak_dc_kw: number;
  efficiency_whkm: number;
  confidence: Confidence;
  breakdown: {
    capacity_fraction: number;
    hvac_kw: number;
    dc_precon_factor: number;
    dc_temp_factor: number;
    rated_efficiency_whkm: number;
    temp_clamped: number;
  };
}

// ---------- Anchor curves ----------------------------------------------------

// Battery usable-capacity fraction vs ambient temperature, by chemistry.
const CAPACITY_CURVES: Record<BatteryChemistry, ReadonlyArray<readonly [number, number]>> = {
  LFP: [
    [-40, 0.20], [-30, 0.35], [-20, 0.55], [-10, 0.75],
    [0, 0.90], [10, 0.97], [20, 1.00], [30, 1.00], [40, 0.98],
  ],
  NMC: [
    [-40, 0.55], [-30, 0.68], [-20, 0.80], [-10, 0.88],
    [0, 0.95], [10, 0.98], [20, 1.00], [30, 1.00], [40, 0.98],
  ],
  NCA: [
    [-40, 0.55], [-30, 0.68], [-20, 0.80], [-10, 0.88],
    [0, 0.95], [10, 0.98], [20, 1.00], [30, 1.00], [40, 0.98],
  ],
  LMR: [
    [-40, 0.50], [-30, 0.64], [-20, 0.77], [-10, 0.86],
    [0, 0.94], [10, 0.98], [20, 1.00], [30, 1.00], [40, 0.97],
  ],
  UNKNOWN: [
    [-40, 0.50], [-30, 0.62], [-20, 0.75], [-10, 0.85],
    [0, 0.93], [10, 0.97], [20, 1.00], [30, 1.00], [40, 0.97],
  ],
};

// HVAC draw in kW vs ambient, for resistive heaters and for heat pumps.
const HVAC_RESISTIVE: ReadonlyArray<readonly [number, number]> = [
  [-40, 8.5], [-30, 7.5], [-20, 6.0], [-10, 4.5],
  [0, 3.0], [10, 1.2], [20, 0.3], [30, 2.0], [40, 4.2],
];
const HVAC_HEAT_PUMP: ReadonlyArray<readonly [number, number]> = [
  [-40, 8.5], [-30, 5.5], [-20, 2.2], [-10, 1.5],
  [0, 1.0], [10, 0.5], [20, 0.2], [30, 1.2], [40, 3.0],
];

// DC peak factor vs temperature WHEN NOT PRECONDITIONED.
const DC_TEMP_FACTOR_COLD_SOAKED: ReadonlyArray<readonly [number, number]> = [
  [-40, 0.15], [-30, 0.25], [-20, 0.35], [-10, 0.50],
  [0, 0.70], [10, 0.88], [20, 0.95], [30, 0.98], [40, 0.90],
];

// DC peak factor when preconditioned.
const DC_TEMP_FACTOR_PRECONDITIONED: ReadonlyArray<readonly [number, number]> = [
  [-40, 0.88], [-30, 0.93], [-20, 0.96], [-10, 0.98],
  [0, 0.99], [10, 1.00], [20, 1.00], [30, 0.98], [40, 0.92],
];

// ---------- Interpolation helper --------------------------------------------

function interp(
  curve: ReadonlyArray<readonly [number, number]>,
  x: number,
): number {
  if (x <= curve[0][0]) return curve[0][1];
  if (x >= curve[curve.length - 1][0]) return curve[curve.length - 1][1];
  for (let i = 0; i < curve.length - 1; i++) {
    const [x0, y0] = curve[i];
    const [x1, y1] = curve[i + 1];
    if (x >= x0 && x <= x1) {
      const t = (x - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return curve[curve.length - 1][1];
}

// ---------- Confidence roll-up -----------------------------------------------

function rollupConfidence(base: Confidence, temp: number): Confidence {
  const dist = Math.abs(temp - 20);
  if (dist >= 45) return "Low";
  if (dist >= 30 && base === "Medium") return "Low";
  if (dist >= 30 && base === "High") return "Medium";
  if (dist >= 40) return "Low";
  return base;
}

// ---------- Simple surface for this repo's Spec shape -----------------------

export interface RealRangeParams {
  /** EPA-rated range in km */
  epaKm: number;
  /** Usable battery capacity in kWh (null = unknown) */
  batteryKwh: number | null;
  /** True = heat pump, false = resistive, null = unknown */
  hasHeatPump: boolean | null;
  /** Ambient temperature in °C */
  tempC: number;
  /** Battery chemistry (default "UNKNOWN") */
  chemistry?: BatteryChemistry;
  /** Speed for HVAC Wh/km calculation (default 100 kph) */
  speedKph?: number;
  /** Pre-conditioned battery? (default false — cold-soaked is conservative) */
  preconditioned?: boolean;
}

/**
 * Estimate real-world range in km at a given temperature.
 *
 * Returns null when required inputs are missing (epaKm = 0 or null).
 * Designed for the WinterRangeChip: conservative assumptions (cold-soaked,
 * HVAC on) because this is shown to buyers planning Ontario winter driving.
 */
export function realRangeKm(params: RealRangeParams): number | null {
  const {
    epaKm,
    batteryKwh,
    hasHeatPump,
    tempC,
    chemistry = "UNKNOWN",
    speedKph = 100,
    preconditioned = false,
  } = params;

  if (!epaKm || epaKm <= 0) return null;

  const temp = Math.max(-40, Math.min(40, tempC));

  // Rated efficiency from EPA range + battery kWh (if available).
  // Fallback ~175 Wh/km is typical mid-size BEV.
  const ratedEfficiency =
    batteryKwh != null && batteryKwh > 0 && epaKm > 0
      ? (batteryKwh * 1000) / epaKm
      : 175;

  const usableKwh = batteryKwh ?? (epaKm * ratedEfficiency) / 1000;

  // 1. Capacity fraction from chemistry curve.
  const capFrac = interp(CAPACITY_CURVES[chemistry] ?? CAPACITY_CURVES.UNKNOWN, temp);
  const effectiveKwh = usableKwh * capFrac;

  // 2. HVAC draw. Assume HVAC on (conservative for winter-range chip).
  const hpCutoff = -20; // default heat pump min effective temp
  let hvacKw: number;
  if (hasHeatPump === true && temp >= hpCutoff) {
    hvacKw = interp(HVAC_HEAT_PUMP, temp);
  } else {
    hvacKw = interp(HVAC_RESISTIVE, temp);
  }

  // 3. Effective efficiency.
  const hvacWhKm = speedKph > 0 ? (hvacKw * 1000) / speedKph : 0;
  const effectiveEfficiency = ratedEfficiency + hvacWhKm;

  // 4. Adjusted range.
  if (effectiveEfficiency <= 0) return null;
  const rangeKm = (effectiveKwh * 1000) / effectiveEfficiency;

  return rangeKm;
}

/**
 * Confidence of the thermal estimate at a given temperature.
 * Downgrades automatically at extremes where real-world data is sparse.
 */
export function thermalConfidence(base: Confidence, tempC: number): Confidence {
  return rollupConfidence(base, tempC);
}

// ---------- Full model (for completeness — matches sibling API) -------------
// Note: this version requires caller to pass the fields inline rather than
// a Vehicle object (since we don't import that type here).

export interface FullThermalSpec {
  range_km: number;
  battery_kwh_usable: number;
  dc_charge_kw_max: number;
  chemistry: BatteryChemistry;
  has_heat_pump: boolean;
  heat_pump_min_effective_c?: number;
  overall_confidence: Confidence;
}

export function computeThermalFull(
  spec: FullThermalSpec,
  inputs: ThermalInputs,
): ThermalOutputs {
  const temp = Math.max(-40, Math.min(40, inputs.temp_c));
  const speed = inputs.speed_kph ?? 100;

  const ratedRange = spec.range_km;
  const ratedUsable = spec.battery_kwh_usable;
  const ratedDcPeak = spec.dc_charge_kw_max;
  const chemistry = spec.chemistry;
  const hasHp = spec.has_heat_pump;

  const ratedEfficiency =
    ratedRange > 0 && ratedUsable > 0
      ? (ratedUsable * 1000) / ratedRange
      : 175;

  const capFrac = interp(CAPACITY_CURVES[chemistry] ?? CAPACITY_CURVES.UNKNOWN, temp);
  const effectiveKwh = ratedUsable * capFrac;

  let hvacKw = 0;
  if (inputs.hvac_on) {
    const hpMinC = spec.heat_pump_min_effective_c ?? -20;
    if (hasHp && temp >= hpMinC) {
      hvacKw = interp(HVAC_HEAT_PUMP, temp);
    } else {
      hvacKw = interp(HVAC_RESISTIVE, temp);
    }
  }

  const hvacWhKm = speed > 0 ? (hvacKw * 1000) / speed : 0;
  const effectiveEfficiency = ratedEfficiency + hvacWhKm;

  const rangeKm = effectiveEfficiency > 0
    ? (effectiveKwh * 1000) / effectiveEfficiency
    : 0;

  const dcTempFactor = inputs.preconditioned
    ? interp(DC_TEMP_FACTOR_PRECONDITIONED, temp)
    : interp(DC_TEMP_FACTOR_COLD_SOAKED, temp);
  const peakDcKw = ratedDcPeak * dcTempFactor;

  const confidence = rollupConfidence(spec.overall_confidence, temp);

  return {
    range_km: rangeKm,
    usable_kwh: effectiveKwh,
    peak_dc_kw: peakDcKw,
    efficiency_whkm: effectiveEfficiency,
    confidence,
    breakdown: {
      capacity_fraction: capFrac,
      hvac_kw: hvacKw,
      dc_precon_factor: inputs.preconditioned ? 1 : dcTempFactor,
      dc_temp_factor: dcTempFactor,
      rated_efficiency_whkm: ratedEfficiency,
      temp_clamped: temp,
    },
  };
}
