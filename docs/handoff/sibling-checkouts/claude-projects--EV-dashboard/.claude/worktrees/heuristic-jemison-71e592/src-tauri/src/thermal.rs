// Rust port of src/lib/thermal.ts — faithful to the TypeScript logic.
// Exposes `compute_thermal` as a Tauri command; the TypeScript hot-render
// path (CompareView/VehicleRow) stays synchronous TS for render performance.
// This plugin is used by the Cluster E trip planner (async, heavy computation).
//
// Sources: same as thermal.ts (Geotab, Recurrent, Fastned, Bjorn Nyland, P3).

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};

// ---------- Shared types (Serialize so they cross the Tauri IPC bridge) ------

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum BatteryChemistry {
    Lfp,
    Nmc,
    Nca,
    Lmr,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub enum Confidence {
    High,
    Medium,
    Low,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ThermalPoint {
    pub temp_c: f64,
    pub value: f64,
}

// Generic CitedValue wrapper — only extracts `value`; other fields ignored.
#[derive(Debug, Clone, Deserialize)]
pub struct CitedValue<T> {
    pub value: Option<T>,
}

// Minimal vehicle subset for the thermal model.
#[derive(Debug, Clone, Deserialize)]
pub struct VehicleThermal {
    pub id: String,
    pub battery_chemistry: BatteryChemistry,
    pub has_heat_pump: CitedValue<bool>,
    pub range_km: CitedValue<f64>,
    pub battery_kwh_usable: CitedValue<f64>,
    pub battery_kwh_total: CitedValue<f64>,
    pub dc_charge_kw_max: CitedValue<f64>,
    pub overall_confidence: Confidence,
    pub cold_derate_curve: Option<Vec<ThermalPoint>>,
    pub hvac_draw_kw_by_temp: Option<Vec<ThermalPoint>>,
    pub hp_min_temp_c: Option<f64>,
    pub precon_thermal_gain: Option<f64>,
    pub dc_cold_soak_curve: Option<Vec<ThermalPoint>>,
}

// Minimal dataset wrapper to parse only the vehicles array from seed.json.
#[derive(Deserialize)]
struct SeedDataset {
    vehicles: Vec<VehicleThermal>,
}

// ---------- Inputs / outputs -------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct ThermalInputs {
    pub temp_c: f64,
    pub preconditioned: bool,
    pub hvac_on: bool,
    pub speed_kph: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ThermalBreakdown {
    pub capacity_fraction: f64,
    pub hvac_kw: f64,
    pub dc_precon_factor: f64,
    pub dc_temp_factor: f64,
    pub rated_efficiency_whkm: f64,
    pub temp_clamped: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ThermalOutputs {
    pub range_km: f64,
    pub usable_kwh: f64,
    pub peak_dc_kw: f64,
    pub efficiency_whkm: f64,
    pub confidence: Confidence,
    pub computation_notes: Vec<String>,
    pub breakdown: ThermalBreakdown,
}

// ---------- Anchor curves (identical to thermal.ts) -------------------------

const CAPACITY_LFP: &[(f64, f64)] = &[
    (-40.0, 0.20), (-30.0, 0.35), (-20.0, 0.55), (-10.0, 0.75),
    (0.0, 0.90), (10.0, 0.97), (20.0, 1.00), (30.0, 1.00), (40.0, 0.98),
];
const CAPACITY_NMC: &[(f64, f64)] = &[
    (-40.0, 0.55), (-30.0, 0.68), (-20.0, 0.80), (-10.0, 0.88),
    (0.0, 0.95), (10.0, 0.98), (20.0, 1.00), (30.0, 1.00), (40.0, 0.98),
];
const CAPACITY_NCA: &[(f64, f64)] = &[
    (-40.0, 0.55), (-30.0, 0.68), (-20.0, 0.80), (-10.0, 0.88),
    (0.0, 0.95), (10.0, 0.98), (20.0, 1.00), (30.0, 1.00), (40.0, 0.98),
];
const CAPACITY_LMR: &[(f64, f64)] = &[
    (-40.0, 0.50), (-30.0, 0.64), (-20.0, 0.77), (-10.0, 0.86),
    (0.0, 0.94), (10.0, 0.98), (20.0, 1.00), (30.0, 1.00), (40.0, 0.97),
];
const CAPACITY_UNKNOWN: &[(f64, f64)] = &[
    (-40.0, 0.50), (-30.0, 0.62), (-20.0, 0.75), (-10.0, 0.85),
    (0.0, 0.93), (10.0, 0.97), (20.0, 1.00), (30.0, 1.00), (40.0, 0.97),
];

const HVAC_RESISTIVE: &[(f64, f64)] = &[
    (-40.0, 8.5), (-30.0, 7.5), (-20.0, 6.0), (-10.0, 4.5),
    (0.0, 3.0), (10.0, 1.2), (20.0, 0.3), (30.0, 2.0), (40.0, 4.2),
];
const HVAC_HEAT_PUMP: &[(f64, f64)] = &[
    (-40.0, 8.5), (-30.0, 5.5), (-20.0, 2.2), (-10.0, 1.5),
    (0.0, 1.0), (10.0, 0.5), (20.0, 0.2), (30.0, 1.2), (40.0, 3.0),
];

const DC_COLD_SOAKED: &[(f64, f64)] = &[
    (-40.0, 0.15), (-30.0, 0.25), (-20.0, 0.35), (-10.0, 0.50),
    (0.0, 0.70), (10.0, 0.88), (20.0, 0.95), (30.0, 0.98), (40.0, 0.90),
];
const DC_PRECONDITIONED: &[(f64, f64)] = &[
    (-40.0, 0.88), (-30.0, 0.93), (-20.0, 0.96), (-10.0, 0.98),
    (0.0, 0.99), (10.0, 1.00), (20.0, 1.00), (30.0, 0.98), (40.0, 0.92),
];

// ---------- Interpolation helper (faithful port of TS interp) ----------------

fn interp(curve: &[(f64, f64)], x: f64) -> f64 {
    if x <= curve[0].0 {
        return curve[0].1;
    }
    if x >= curve[curve.len() - 1].0 {
        return curve[curve.len() - 1].1;
    }
    for i in 0..curve.len() - 1 {
        let (x0, y0) = curve[i];
        let (x1, y1) = curve[i + 1];
        if x >= x0 && x <= x1 {
            let t = (x - x0) / (x1 - x0);
            return y0 + t * (y1 - y0);
        }
    }
    curve[curve.len() - 1].1
}

fn interp_points(points: &[ThermalPoint], x: f64) -> f64 {
    let curve: Vec<(f64, f64)> = points.iter().map(|p| (p.temp_c, p.value)).collect();
    interp(&curve, x)
}

// ---------- Confidence roll-up (mirrors rollupConfidence in thermal.ts) ------

fn rollup_confidence(base: &Confidence, temp: f64) -> Confidence {
    if temp <= -30.0 {
        return Confidence::Low;
    }
    if temp <= -25.0 {
        if *base == Confidence::High {
            return Confidence::Medium;
        }
    }
    if temp <= -20.0 {
        if *base == Confidence::Medium {
            return Confidence::Low;
        }
    }
    base.clone()
}

// ---------- Main computation (port of computeThermal) ------------------------

pub fn compute_thermal_impl(vehicle: &VehicleThermal, inputs: &ThermalInputs) -> ThermalOutputs {
    let temp = inputs.temp_c.max(-40.0).min(40.0);
    let speed = inputs.speed_kph.unwrap_or(100.0);
    let mut notes: Vec<String> = Vec::new();

    let rated_range = vehicle.range_km.value.unwrap_or(0.0);
    let rated_usable = vehicle
        .battery_kwh_usable
        .value
        .or(vehicle.battery_kwh_total.value)
        .unwrap_or(0.0);
    let rated_dc_peak = vehicle.dc_charge_kw_max.value.unwrap_or(0.0);

    let rated_efficiency = if rated_range > 0.0 && rated_usable > 0.0 {
        (rated_usable * 1000.0) / rated_range
    } else {
        175.0
    };

    // 1. Capacity fraction
    let cap_frac = if let Some(curve) = &vehicle.cold_derate_curve {
        if curve.len() >= 3 {
            notes.push("capacity: per-vehicle cold-derate curve".to_string());
            interp_points(curve, temp)
        } else {
            capacity_from_chemistry(&vehicle.battery_chemistry, temp, &mut notes)
        }
    } else {
        capacity_from_chemistry(&vehicle.battery_chemistry, temp, &mut notes)
    };
    let effective_kwh = rated_usable * cap_frac;

    // 2. HVAC draw
    let hvac_kw = if inputs.hvac_on {
        if let Some(curve) = &vehicle.hvac_draw_kw_by_temp {
            if curve.len() >= 3 {
                notes.push("HVAC: per-vehicle draw curve".to_string());
                interp_points(curve, temp)
            } else {
                hvac_from_global(vehicle, temp, &mut notes)
            }
        } else {
            hvac_from_global(vehicle, temp, &mut notes)
        }
    } else {
        0.0
    };

    // 3. Effective efficiency
    let hvac_wh_km = if speed > 0.0 { (hvac_kw * 1000.0) / speed } else { 0.0 };
    let effective_efficiency = rated_efficiency + hvac_wh_km;

    // 4. Adjusted range
    let range_km = if effective_efficiency > 0.0 {
        (effective_kwh * 1000.0) / effective_efficiency
    } else {
        0.0
    };

    // 5. DC peak factor
    let dc_temp_factor = dc_factor(vehicle, inputs.preconditioned, temp, &mut notes);
    let peak_dc_kw = rated_dc_peak * dc_temp_factor;

    // 6. Confidence roll-up
    let confidence = rollup_confidence(&vehicle.overall_confidence, temp);

    let dc_precon_factor = if inputs.preconditioned { 1.0 } else { dc_temp_factor };

    ThermalOutputs {
        range_km,
        usable_kwh: effective_kwh,
        peak_dc_kw,
        efficiency_whkm: effective_efficiency,
        confidence,
        computation_notes: notes,
        breakdown: ThermalBreakdown {
            capacity_fraction: cap_frac,
            hvac_kw,
            dc_precon_factor,
            dc_temp_factor,
            rated_efficiency_whkm: rated_efficiency,
            temp_clamped: temp,
        },
    }
}

fn capacity_from_chemistry(chem: &BatteryChemistry, temp: f64, notes: &mut Vec<String>) -> f64 {
    let curve = match chem {
        BatteryChemistry::Lfp => CAPACITY_LFP,
        BatteryChemistry::Nmc => CAPACITY_NMC,
        BatteryChemistry::Nca => CAPACITY_NCA,
        BatteryChemistry::Lmr => CAPACITY_LMR,
        BatteryChemistry::Unknown => CAPACITY_UNKNOWN,
    };
    notes.push(format!("capacity: {:?} chemistry default", chem));
    interp(curve, temp)
}

fn hvac_from_global(vehicle: &VehicleThermal, temp: f64, notes: &mut Vec<String>) -> f64 {
    let hp_min = vehicle.hp_min_temp_c.unwrap_or(-10.0);
    let has_hp = vehicle.has_heat_pump.value.unwrap_or(false);
    if has_hp && temp >= hp_min {
        notes.push("HVAC: global heat-pump curve".to_string());
        interp(HVAC_HEAT_PUMP, temp)
    } else {
        notes.push("HVAC: global resistive curve".to_string());
        interp(HVAC_RESISTIVE, temp)
    }
}

fn dc_factor(
    vehicle: &VehicleThermal,
    preconditioned: bool,
    temp: f64,
    notes: &mut Vec<String>,
) -> f64 {
    if !preconditioned {
        if let Some(curve) = &vehicle.dc_cold_soak_curve {
            if curve.len() >= 3 {
                notes.push("DC peak: per-vehicle cold-soak curve".to_string());
                return interp_points(curve, temp);
            }
        }
        notes.push("DC peak: global cold-soak curve".to_string());
        return interp(DC_COLD_SOAKED, temp);
    }
    // Preconditioned path
    let ideal = interp(DC_PRECONDITIONED, temp);
    if let Some(gain) = vehicle.precon_thermal_gain {
        let cold_soak = if let Some(curve) = &vehicle.dc_cold_soak_curve {
            if curve.len() >= 3 {
                interp_points(curve, temp)
            } else {
                interp(DC_COLD_SOAKED, temp)
            }
        } else {
            interp(DC_COLD_SOAKED, temp)
        };
        notes.push(format!("DC peak: preconditioned (gain={gain:.2})"));
        cold_soak + (ideal - cold_soak) * gain
    } else {
        notes.push("DC peak: global preconditioned curve".to_string());
        ideal
    }
}

// ---------- Lazy-loaded vehicle dataset --------------------------------------

pub static VEHICLES: Lazy<Vec<VehicleThermal>> = Lazy::new(|| {
    let raw = include_str!("../../src/data/seed.json");
    let dataset: SeedDataset = serde_json::from_str(raw).expect("thermal.rs: invalid seed.json");
    dataset.vehicles
});

// ---------- Tauri command ----------------------------------------------------

#[tauri::command]
#[tracing::instrument(level = "debug", skip_all, fields(vehicle_id, temp_c, hvac_on))]
pub fn compute_thermal(
    vehicle_id: String,
    temp_c: f64,
    preconditioned: bool,
    hvac_on: bool,
    speed_kph: Option<f64>,
) -> Result<ThermalOutputs, String> {
    let vehicle = VEHICLES
        .iter()
        .find(|v| v.id == vehicle_id)
        .ok_or_else(|| format!("vehicle not found: {vehicle_id}"))?;
    let inputs = ThermalInputs {
        temp_c,
        preconditioned,
        hvac_on,
        speed_kph,
    };
    Ok(compute_thermal_impl(vehicle, &inputs))
}

// ---------- Tests (golden cases mirroring thermal.test.ts) -------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture() -> VehicleThermal {
        VehicleThermal {
            id: "fixture".to_string(),
            battery_chemistry: BatteryChemistry::Nmc,
            has_heat_pump: CitedValue { value: Some(true) },
            range_km: CitedValue { value: Some(500.0) },
            battery_kwh_usable: CitedValue { value: Some(75.0) },
            battery_kwh_total: CitedValue { value: Some(80.0) },
            dc_charge_kw_max: CitedValue { value: Some(250.0) },
            overall_confidence: Confidence::High,
            cold_derate_curve: None,
            hvac_draw_kw_by_temp: None,
            hp_min_temp_c: None,
            precon_thermal_gain: None,
            dc_cold_soak_curve: None,
        }
    }

    fn medium_fixture() -> VehicleThermal {
        VehicleThermal {
            overall_confidence: Confidence::Medium,
            ..fixture()
        }
    }

    // 20°C baseline
    #[test]
    fn baseline_range_near_rated() {
        let v = fixture();
        let out = compute_thermal_impl(&v, &ThermalInputs { temp_c: 20.0, preconditioned: true, hvac_on: false, speed_kph: None });
        assert!((out.range_km - 500.0).abs() <= 5.0, "range {:.1} should be within 5 km of 500", out.range_km);
    }

    #[test]
    fn baseline_dc_peak_near_rated() {
        let v = fixture();
        let out = compute_thermal_impl(&v, &ThermalInputs { temp_c: 20.0, preconditioned: true, hvac_on: false, speed_kph: None });
        assert!((out.peak_dc_kw - 250.0).abs() <= 5.0, "DC peak {:.1} should be within 5 kW of 250", out.peak_dc_kw);
    }

    // -20°C cold-soaked with HVAC on
    #[test]
    fn winter_cold_soaked_range_drops() {
        let v = fixture();
        let out = compute_thermal_impl(&v, &ThermalInputs { temp_c: -20.0, preconditioned: false, hvac_on: true, speed_kph: None });
        assert!(out.range_km < 380.0, "cold-soaked range {:.1} should be < 380 km", out.range_km);
    }

    #[test]
    fn winter_cold_soaked_dc_drops() {
        let v = fixture();
        let out = compute_thermal_impl(&v, &ThermalInputs { temp_c: -20.0, preconditioned: false, hvac_on: true, speed_kph: None });
        assert!(out.peak_dc_kw < 100.0, "cold-soaked DC {:.1} should be < 100 kW", out.peak_dc_kw);
    }

    // rollupConfidence regression cases (mirrors C4 Vitest tests)
    #[test]
    fn rollup_minus10_high_stays_high() {
        assert_eq!(rollup_confidence(&Confidence::High, -10.0), Confidence::High);
    }

    #[test]
    fn rollup_minus20_high_stays_high() {
        assert_eq!(rollup_confidence(&Confidence::High, -20.0), Confidence::High);
    }

    #[test]
    fn rollup_minus26_high_demotes_medium() {
        assert_eq!(rollup_confidence(&Confidence::High, -26.0), Confidence::Medium);
    }

    #[test]
    fn rollup_minus30_always_low() {
        assert_eq!(rollup_confidence(&Confidence::High, -30.0), Confidence::Low);
        assert_eq!(rollup_confidence(&Confidence::Medium, -30.0), Confidence::Low);
    }

    #[test]
    fn rollup_minus20_medium_demotes_low() {
        assert_eq!(rollup_confidence(&Confidence::Medium, -20.0), Confidence::Low);
    }

    // Seed loading
    #[test]
    fn seed_loads_vehicles() {
        assert!(VEHICLES.len() >= 10, "seed should have >= 10 vehicles, got {}", VEHICLES.len());
    }

    #[test]
    fn seed_has_tesla_model3() {
        let found = VEHICLES.iter().any(|v| v.id.contains("tesla-model3"));
        assert!(found, "seed should contain a Tesla Model 3");
    }
}
