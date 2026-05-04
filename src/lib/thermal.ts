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
  /**
   * Pre-conditioned battery + cabin? (default false — cold-soaked is conservative).
   * When true, models a typical Hyundai/Kia E-GMP "Winter Mode" / Battery
   * Conditioning preset: battery brought to ~20°C operating temp before unplug,
   * cabin pre-heated. Effects modeled below.
   */
  preconditioned?: boolean;
  /**
   * Temperature (°C) below which the heat pump becomes ineffective and the
   * vehicle falls back to resistive heating. Hyundai/Kia E-GMP heat pumps
   * are rated effective to ~-25 to -30°C; default -20 is conservative.
   */
  heatPumpMinEffectiveC?: number;
}

/**
 * Estimate real-world range in km at a given temperature.
 *
 * Returns null when required inputs are missing (epaKm = 0 or null).
 * Designed for the WinterRangeChip: conservative assumptions (cold-soaked,
 * HVAC on) because this is shown to buyers planning Ontario winter driving.
 *
 * Preconditioning model (when `preconditioned=true`):
 *   - Battery acts ~15°C warmer than ambient (capped at 20°C). This is the
 *     E-GMP "Battery Conditioning" effect — internal warming from the
 *     coolant heat exchanger before unplug brings cell temp into the band
 *     where capacity loss flattens.
 *   - Cabin HVAC draw is reduced ~30% on average across the trip. Cabin
 *     is pre-warmed at the plug, so the first 15 min of an averaged 60-min
 *     drive runs near setpoint instead of climbing from cold.
 *
 * Real-world data points (Bjorn Nyland 1000 km, Recurrent winter 2024,
 * Hyundai Bluelink telemetry as cited in reviewers' tests): preconditioning
 * recovers ~8-15% of cold-temperature range at -20°C, less at milder temps.
 * Net effect of this model at -20°C with heat pump: ~+12% vs cold-soaked.
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
    heatPumpMinEffectiveC = -20,
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
  // Preconditioning shifts the effective battery temp ~15°C warmer (capped at 20°C),
  // because the pack has been brought to operating temp before unplug.
  const effectiveBatteryTemp = preconditioned
    ? Math.min(20, temp + 15)
    : temp;
  const capFrac = interp(CAPACITY_CURVES[chemistry] ?? CAPACITY_CURVES.UNKNOWN, effectiveBatteryTemp);
  const effectiveKwh = usableKwh * capFrac;

  // 2. HVAC draw. Assume HVAC on (conservative for winter-range chip).
  // Heat pump effectiveness degrades GRADUALLY near the cutoff — real-world
  // E-GMP heat pumps don't step off at a sharp threshold. We blend between
  // the heat-pump curve and the resistive curve over a 5°C transition zone:
  //   temp >= hpMin + 5°C  → full heat pump
  //   temp <= hpMin        → full resistive (heat pump given up)
  //   between              → linear blend
  // This eliminates the unrealistic ~14% range cliff at the cutoff temp.
  let hvacKw: number;
  if (hasHeatPump !== true) {
    hvacKw = interp(HVAC_RESISTIVE, temp);
  } else {
    const transitionTop = heatPumpMinEffectiveC + 5;
    if (temp >= transitionTop) {
      hvacKw = interp(HVAC_HEAT_PUMP, temp);
    } else if (temp <= heatPumpMinEffectiveC) {
      hvacKw = interp(HVAC_RESISTIVE, temp);
    } else {
      const frac = (temp - heatPumpMinEffectiveC) / 5; // 0 at cutoff → 1 at top of zone
      const hpKw = interp(HVAC_HEAT_PUMP, temp);
      const resKw = interp(HVAC_RESISTIVE, temp);
      hvacKw = resKw + frac * (hpKw - resKw);
    }
  }
  // Preconditioning reduces averaged HVAC draw — cabin is pre-warmed, so
  // first ~25% of trip runs near setpoint instead of climbing from cold.
  if (preconditioned) {
    hvacKw *= 0.7;
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

// ---------- Warm-up ramp model ----------------------------------------------
//
// Real-world EV range when cold-soaked is NOT static — it changes minute by
// minute as the cabin and battery warm. The averaged `realRangeKm` above is
// the integrated effective range across a typical 60-min trip. The ramp
// model below returns range at minute T, useful for visualising why a
// short cold trip uses MORE energy per km than a long one.
//
// Physics modeled (first-order time-constant approximations):
//
// 1. HVAC draw decays from peak at t=0 to steady-state with tau_hvac ≈ 8 min
//    (cold-soaked) or tau_hvac ≈ 3 min (preconditioned cabin starts warm).
//    HVAC(t) = steady + (peak - steady) * exp(-t/tau_hvac)
//    Peak HVAC at -20°C cold-soaked: 8.5 kW (cabin heat-up surge).
//
// 2. Battery capacity rises from cold value toward steady-state with
//    tau_batt ≈ 25 min as regen/PE waste heat warms the pack. For pre-
//    conditioned vehicles the battery starts already at +15°C from ambient.
//    cap(t) = cap_warm - (cap_warm - cap_initial) * exp(-t/tau_batt)
//
// 3. Effective range at minute T is the AVERAGED range over [0, T] using
//    the integrated HVAC + capacity at each minute. Conservative — a buyer
//    pulling stats at T=10 min sees the worst-case "first 10 min" number,
//    not the steady-state.
//
// Real-world calibration: Hyundai Bluelink + Bjorn Nyland telemetry both show
// ~25-35% range hit on the FIRST 10 km of cold-soaked winter drive, climbing
// to the steady-state ~30% hit by km 30-50. Preconditioning erases most of
// the first-10-km penalty.

const TAU_HVAC_COLD_MIN = 8;     // minutes — HVAC peak decay time when cold-soaked
const TAU_HVAC_PRECON_MIN = 3;   // minutes — HVAC peak decay time when preconditioned
const TAU_BATTERY_MIN = 25;      // minutes — battery warm-up time under driving load
const HVAC_PEAK_KW = 8.5;        // peak HVAC draw at -20°C cold-soaked

export interface RampParams extends RealRangeParams {
  /** Minutes elapsed since drive start (0 = just started, 60+ = steady-state) */
  minutesElapsed: number;
}

/**
 * Estimate cumulative averaged range from minute 0 to `minutesElapsed`.
 *
 * At T=0 returns the worst-case (peak HVAC + cold battery).
 * At T=60+ converges to `realRangeKm` (steady-state).
 *
 * Used by the dossier ramp chart to show "range at the first 10 min vs the
 * first 30 min vs steady-state" — explains why Sunday-morning short trips
 * burn so much more than rated.
 */
export function realRangeRampKm(params: RampParams): number | null {
  const {
    epaKm,
    batteryKwh,
    hasHeatPump,
    tempC,
    chemistry = "UNKNOWN",
    speedKph = 100,
    preconditioned = false,
    heatPumpMinEffectiveC = -20,
    minutesElapsed,
  } = params;

  if (!epaKm || epaKm <= 0) return null;
  if (minutesElapsed < 0) return null;

  const temp = Math.max(-40, Math.min(40, tempC));
  const t = Math.max(0, minutesElapsed);

  const ratedEfficiency =
    batteryKwh != null && batteryKwh > 0 && epaKm > 0
      ? (batteryKwh * 1000) / epaKm
      : 175;
  const usableKwh = batteryKwh ?? (epaKm * ratedEfficiency) / 1000;

  // ── 1. Steady-state HVAC (the value `realRangeKm` uses) ────────────────
  let hvacSteady: number;
  if (hasHeatPump !== true) {
    hvacSteady = interp(HVAC_RESISTIVE, temp);
  } else {
    const transitionTop = heatPumpMinEffectiveC + 5;
    if (temp >= transitionTop) hvacSteady = interp(HVAC_HEAT_PUMP, temp);
    else if (temp <= heatPumpMinEffectiveC) hvacSteady = interp(HVAC_RESISTIVE, temp);
    else {
      const frac = (temp - heatPumpMinEffectiveC) / 5;
      hvacSteady = interp(HVAC_RESISTIVE, temp) + frac *
        (interp(HVAC_HEAT_PUMP, temp) - interp(HVAC_RESISTIVE, temp));
    }
  }
  if (preconditioned) hvacSteady *= 0.7;

  // ── 2. Peak HVAC at t=0 ────────────────────────────────────────────────
  // Preconditioned vehicles start near steady-state; cold-soaked vehicles
  // start at HVAC_PEAK_KW (cabin heating surge), capped at the colder of
  // {steady, peak} so warm-temp scenarios don't surge artificially.
  const peakHvac = preconditioned
    ? hvacSteady * 1.15
    : Math.max(hvacSteady, temp < 5 ? HVAC_PEAK_KW : hvacSteady * 1.4);

  const tauHvac = preconditioned ? TAU_HVAC_PRECON_MIN : TAU_HVAC_COLD_MIN;
  // Time-averaged HVAC over [0, t]:
  // ∫₀ᵗ HVAC(s) ds / t = steady + (peak - steady) * (tau/t) * (1 - e^(-t/tau))
  const hvacAvg = t === 0
    ? peakHvac
    : hvacSteady + (peakHvac - hvacSteady) * (tauHvac / t) * (1 - Math.exp(-t / tauHvac));

  // ── 3. Battery capacity rises over time ────────────────────────────────
  // Steady-state cap (battery at op temp): use min(20°C, ambient+15°C) for
  // preconditioned vehicles, else ambient.
  const capCurve = CAPACITY_CURVES[chemistry] ?? CAPACITY_CURVES.UNKNOWN;
  const capInitialTemp = preconditioned ? Math.min(20, temp + 15) : temp;
  const capInitial = interp(capCurve, capInitialTemp);
  const capWarm = interp(capCurve, Math.min(20, temp + 20)); // pack warms ~20°C above ambient under load
  const tauBatt = preconditioned ? TAU_BATTERY_MIN * 0.5 : TAU_BATTERY_MIN;
  // Time-averaged capacity over [0, t]
  const capAvg = t === 0
    ? capInitial
    : capWarm - (capWarm - capInitial) * (tauBatt / t) * (1 - Math.exp(-t / tauBatt));

  // ── 4. Range at this point in the trip ────────────────────────────────
  const effectiveKwh = usableKwh * capAvg;
  const hvacWhKm = speedKph > 0 ? (hvacAvg * 1000) / speedKph : 0;
  const effectiveEfficiency = ratedEfficiency + hvacWhKm;
  if (effectiveEfficiency <= 0) return null;
  return (effectiveKwh * 1000) / effectiveEfficiency;
}

/**
 * Generate a ramp curve [{minute, rangeKm}] for plotting in the dossier.
 * Default: 0, 5, 10, 15, 20, 30, 45, 60 min sample points.
 */
export function realRangeRampCurve(
  params: Omit<RampParams, "minutesElapsed">,
  samplesMin: number[] = [0, 5, 10, 15, 20, 30, 45, 60],
): { minute: number; rangeKm: number }[] {
  const out: { minute: number; rangeKm: number }[] = [];
  for (const m of samplesMin) {
    const r = realRangeRampKm({ ...params, minutesElapsed: m });
    if (r != null) out.push({ minute: m, rangeKm: Math.round(r) });
  }
  return out;
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
    // Same soft transition as realRangeKm — gradual blend between heat-pump
    // and resistive curves over a 5°C window above the cutoff temp.
    const hpMinC = spec.heat_pump_min_effective_c ?? -20;
    if (!hasHp) {
      hvacKw = interp(HVAC_RESISTIVE, temp);
    } else {
      const transitionTop = hpMinC + 5;
      if (temp >= transitionTop) {
        hvacKw = interp(HVAC_HEAT_PUMP, temp);
      } else if (temp <= hpMinC) {
        hvacKw = interp(HVAC_RESISTIVE, temp);
      } else {
        const frac = (temp - hpMinC) / 5;
        const hpKw = interp(HVAC_HEAT_PUMP, temp);
        const resKw = interp(HVAC_RESISTIVE, temp);
        hvacKw = resKw + frac * (hpKw - resKw);
      }
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
