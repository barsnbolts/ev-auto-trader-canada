// Thermal / physics model for EV range, capacity, and DC-charging behavior
// under ambient temperature and preconditioning state.
//
// Purpose: given a vehicle's published specs and the current slider state
// (ambient °C, preconditioned y/n, HVAC on/off), return physically-grounded
// adjusted range, usable kWh, peak DC kW, and efficiency.
//
// Design principles (per scientific_rigor feedback memory):
//   * Every parameter comes from a published, citable source.
//   * Confidence of the output is derived from confidence of inputs AND the
//     inherent uncertainty of the physics model in the operating region.
//   * The function is pure, deterministic, and fully unit-testable.
//   * At slider extremes (-40 °C, +40 °C) confidence degrades to Low
//     automatically because real-world data is sparse out there.
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
//
// If you find a vehicle where the model disagrees with observed data by
// more than ~8%, update this vehicle's `thermal_profile` override (Phase 3
// task) or the anchor curves below.

import type { Vehicle, Confidence, BatteryChemistry } from "../types";

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
  computationNotes: string[];
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
// Values are "how much of rated usable kWh is actually available to the drive
// motor and accessories at this temperature". The energy penalty to warm the
// battery itself is charged to the HVAC/drivetrain-heater budget, not here.
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
// Heat pumps fall back to resistive behavior below their cutoff temperature.
const HVAC_RESISTIVE: ReadonlyArray<readonly [number, number]> = [
  [-40, 8.5], [-30, 7.5], [-20, 6.0], [-10, 4.5],
  [0, 3.0], [10, 1.2], [20, 0.3], [30, 2.0], [40, 4.2],
];
const HVAC_HEAT_PUMP: ReadonlyArray<readonly [number, number]> = [
  [-40, 8.5], [-30, 5.5], [-20, 2.2], [-10, 1.5],
  [0, 1.0], [10, 0.5], [20, 0.2], [30, 1.2], [40, 3.0],
];

// DC peak factor vs temperature WHEN NOT PRECONDITIONED. Cold-soaked cells
// derate HARD. Preconditioning removes this penalty almost entirely.
const DC_TEMP_FACTOR_COLD_SOAKED: ReadonlyArray<readonly [number, number]> = [
  [-40, 0.15], [-30, 0.25], [-20, 0.35], [-10, 0.50],
  [0, 0.70], [10, 0.88], [20, 0.95], [30, 0.98], [40, 0.90],
];

// DC peak factor when preconditioned — battery is at ideal temp regardless of ambient.
// Small derate at extreme ambient because cooling/heating system has overhead.
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

// ---------- Main model -------------------------------------------------------

export function computeThermal(
  vehicle: Vehicle,
  inputs: ThermalInputs,
): ThermalOutputs {
  const temp = Math.max(-40, Math.min(40, inputs.temp_c));
  const speed = inputs.speed_kph ?? 100;
  const notes: string[] = [];

  const ratedRange = vehicle.range_km.value ?? 0;
  const ratedUsable = vehicle.battery_kwh_usable.value ?? vehicle.battery_kwh_total.value ?? 0;
  const ratedDcPeak = vehicle.dc_charge_kw_max.value ?? 0;
  const chemistry = vehicle.battery_chemistry;
  const hasHp = vehicle.has_heat_pump.value ?? false;

  const ratedEfficiency =
    ratedRange > 0 && ratedUsable > 0
      ? (ratedUsable * 1000) / ratedRange
      : 175;

  // 1. Capacity fraction — prefer per-vehicle curve, else chemistry default.
  let capFrac: number;
  if (vehicle.cold_derate_curve && vehicle.cold_derate_curve.length >= 3) {
    const curve = vehicle.cold_derate_curve.map(
      (p) => [p.temp_c, p.value] as readonly [number, number],
    );
    capFrac = interp(curve, temp);
    notes.push("capacity: per-vehicle cold-derate curve (Recurrent/Geotab fleet data)");
  } else {
    capFrac = interp(CAPACITY_CURVES[chemistry] ?? CAPACITY_CURVES.UNKNOWN, temp);
    notes.push(`capacity: ${chemistry} chemistry default (no per-vehicle curve)`);
  }
  const effectiveKwh = ratedUsable * capFrac;

  // 2. HVAC draw — prefer per-vehicle curve, else global HP/resistive curves.
  let hvacKw = 0;
  if (inputs.hvac_on) {
    if (vehicle.hvac_draw_kw_by_temp && vehicle.hvac_draw_kw_by_temp.length >= 3) {
      const curve = vehicle.hvac_draw_kw_by_temp.map(
        (p) => [p.temp_c, p.value] as readonly [number, number],
      );
      hvacKw = interp(curve, temp);
      notes.push("HVAC: per-vehicle draw curve");
    } else {
      // Fall back to global curves; use vehicle's hp_min_temp_c if set.
      const hpMinC = vehicle.hp_min_temp_c ?? -10;
      if (hasHp && temp >= hpMinC) {
        hvacKw = interp(HVAC_HEAT_PUMP, temp);
        notes.push("HVAC: global heat-pump curve (no per-vehicle data)");
      } else {
        hvacKw = interp(HVAC_RESISTIVE, temp);
        notes.push("HVAC: global resistive curve (no per-vehicle data)");
      }
    }
  }

  // 3. Effective efficiency.
  const hvacWhKm = speed > 0 ? (hvacKw * 1000) / speed : 0;
  const effectiveEfficiency = ratedEfficiency + hvacWhKm;

  // 4. Adjusted range.
  const rangeKm = effectiveEfficiency > 0
    ? (effectiveKwh * 1000) / effectiveEfficiency
    : 0;

  // 5. DC peak — prefer per-vehicle cold-soak curve when not preconditioned.
  let dcTempFactor: number;
  if (!inputs.preconditioned && vehicle.dc_cold_soak_curve && vehicle.dc_cold_soak_curve.length >= 3) {
    const curve = vehicle.dc_cold_soak_curve.map(
      (p) => [p.temp_c, p.value] as readonly [number, number],
    );
    dcTempFactor = interp(curve, temp);
    notes.push("DC peak: per-vehicle cold-soak curve (Fastned/P3 data)");
  } else if (inputs.preconditioned) {
    dcTempFactor = interp(DC_TEMP_FACTOR_PRECONDITIONED, temp);
    // Apply per-vehicle preconditioning gain if available.
    if (vehicle.precon_thermal_gain != null) {
      const coldSoakFactor = vehicle.dc_cold_soak_curve && vehicle.dc_cold_soak_curve.length >= 3
        ? interp(vehicle.dc_cold_soak_curve.map((p) => [p.temp_c, p.value] as readonly [number, number]), temp)
        : interp(DC_TEMP_FACTOR_COLD_SOAKED, temp);
      // Precon recovers a fraction of the gap between cold-soak and ideal.
      const ideal = interp(DC_TEMP_FACTOR_PRECONDITIONED, temp);
      dcTempFactor = coldSoakFactor + (ideal - coldSoakFactor) * vehicle.precon_thermal_gain;
      notes.push(`DC peak: preconditioned (gain=${vehicle.precon_thermal_gain})`);
    } else {
      notes.push("DC peak: global preconditioned curve");
    }
  } else {
    dcTempFactor = interp(DC_TEMP_FACTOR_COLD_SOAKED, temp);
    notes.push("DC peak: global cold-soak curve (no per-vehicle data)");
  }
  const peakDcKw = ratedDcPeak * dcTempFactor;

  // 6. Confidence roll-up.
  const confidence = rollupConfidence(vehicle.overall_confidence, temp);

  return {
    range_km: rangeKm,
    usable_kwh: effectiveKwh,
    peak_dc_kw: peakDcKw,
    efficiency_whkm: effectiveEfficiency,
    confidence,
    computationNotes: notes,
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

function rollupConfidence(base: Confidence, temp: number): Confidence {
  // Fleet data (Geotab/Recurrent) covers -20°C well; below -30°C gets genuinely sparse.
  // Hot-weather data is well-covered up to +40°C (the slider maximum).
  if (temp <= -30) return "Low";
  if (temp <= -25 && base === "High") return "Medium";
  if (temp <= -20 && base === "Medium") return "Low";
  return base;
}
