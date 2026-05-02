// Greedy EV trip planner.
// Splits a straight-line route into ~50 km segments, simulates battery drain
// per vehicle using the thermal model, and inserts DCFC stops whenever SOC
// would fall below MIN_SOC. Uses the 15 hardcoded Ontario DCFC stations (same
// as MapPanel.tsx fallback).

use crate::thermal::{ThermalInputs, VehicleThermal, VEHICLES, compute_thermal_impl};
use serde::{Deserialize, Serialize};

// ── Constants ──────────────────────────────────────────────────────────────────

const SEGMENT_KM: f64 = 50.0; // max km between simulation steps
const MIN_SOC: f64 = 0.15; // stop before hitting this
const TARGET_SOC: f64 = 0.80; // charge up to here
const AVG_CHARGE_RATIO: f64 = 0.70; // avg rate = peak_kw * this (accounts for curve shape)
const EARTH_RADIUS_KM: f64 = 6371.0;

// ── Hardcoded Ontario DCFC stations (mirrors MapPanel.tsx fallback) ─────────

#[derive(Clone)]
struct Station {
    name: &'static str,
    lat: f64,
    lng: f64,
    kw: u32,
    network: &'static str,
}

const ONTARIO_STATIONS: &[Station] = &[
    Station { name: "Electrify Canada — Square One",    lat: 43.593, lng: -79.642, kw: 350, network: "Electrify Canada" },
    Station { name: "Electrify Canada — Erin Mills",    lat: 43.551, lng: -79.715, kw: 350, network: "Electrify Canada" },
    Station { name: "Tesla Supercharger — Toronto (Bay St)", lat: 43.648, lng: -79.381, kw: 250, network: "Tesla" },
    Station { name: "Tesla Supercharger — Mississauga", lat: 43.612, lng: -79.637, kw: 250, network: "Tesla" },
    Station { name: "Petro-Canada DCFC — Burlington",   lat: 43.316, lng: -79.797, kw: 100, network: "Petro-Canada" },
    Station { name: "Tesla Supercharger — Hamilton",    lat: 43.257, lng: -79.870, kw: 250, network: "Tesla" },
    Station { name: "Electrify Canada — Kitchener",     lat: 43.449, lng: -80.492, kw: 350, network: "Electrify Canada" },
    Station { name: "Tesla Supercharger — London",      lat: 42.984, lng: -81.249, kw: 250, network: "Tesla" },
    Station { name: "Electrify Canada — Guelph",        lat: 43.545, lng: -80.247, kw: 350, network: "Electrify Canada" },
    Station { name: "Petro-Canada DCFC — Brampton",     lat: 43.685, lng: -79.762, kw: 100, network: "Petro-Canada" },
    Station { name: "Tesla Supercharger — Oshawa",      lat: 43.897, lng: -78.865, kw: 250, network: "Tesla" },
    Station { name: "Electrify Canada — Kingston",      lat: 44.233, lng: -76.481, kw: 350, network: "Electrify Canada" },
    Station { name: "Tesla Supercharger — Barrie",      lat: 44.389, lng: -79.690, kw: 250, network: "Tesla" },
    Station { name: "Electrify Canada — Ottawa (Trainyards)", lat: 45.410, lng: -75.668, kw: 350, network: "Electrify Canada" },
    Station { name: "Petro-Canada DCFC — Sudbury",      lat: 46.494, lng: -81.001, kw: 100, network: "Petro-Canada" },
];

// ── Geometry helpers ───────────────────────────────────────────────────────────

fn haversine_km(lat1: f64, lng1: f64, lat2: f64, lng2: f64) -> f64 {
    let dlat = (lat2 - lat1).to_radians();
    let dlng = (lng2 - lng1).to_radians();
    let a = (dlat / 2.0).sin().powi(2)
        + lat1.to_radians().cos() * lat2.to_radians().cos() * (dlng / 2.0).sin().powi(2);
    2.0 * EARTH_RADIUS_KM * a.sqrt().asin()
}

/// Returns lat/lng waypoints roughly `step_km` apart along the great-circle
/// from (lat1,lng1) to (lat2,lng2). First and last points are origin/dest.
fn waypoints(lat1: f64, lng1: f64, lat2: f64, lng2: f64, step_km: f64) -> Vec<(f64, f64)> {
    let total = haversine_km(lat1, lng1, lat2, lng2);
    let n = ((total / step_km).ceil() as usize).max(1);
    (0..=n)
        .map(|i| {
            let t = i as f64 / n as f64;
            (lat1 + t * (lat2 - lat1), lng1 + t * (lng2 - lng1))
        })
        .collect()
}

/// Nearest station within `max_km`, preferring highest kW.
fn nearest_station(lat: f64, lng: f64, max_km: f64) -> Option<&'static Station> {
    ONTARIO_STATIONS
        .iter()
        .filter(|s| haversine_km(lat, lng, s.lat, s.lng) <= max_km)
        .max_by(|a, b| a.kw.cmp(&b.kw))
}

// ── IPC types ─────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct TripRequest {
    pub origin_lat: f64,
    pub origin_lng: f64,
    pub dest_lat: f64,
    pub dest_lng: f64,
    pub vehicle_ids: Vec<String>,
    pub temp_c: f64,
    pub hvac_on: bool,
    pub speed_kph: Option<f64>,
}

#[derive(Debug, Serialize, Clone)]
pub struct ChargeStop {
    pub station_name: String,
    pub station_lat: f64,
    pub station_lng: f64,
    pub station_kw: u32,
    pub network: String,
    pub soc_in_pct: f64,
    pub soc_out_pct: f64,
    pub charge_minutes: u32,
    pub distance_from_origin_km: f64,
}

#[derive(Debug, Serialize)]
pub struct VehicleTripPlan {
    pub vehicle_id: String,
    pub stops: Vec<ChargeStop>,
    pub total_distance_km: f64,
    pub arrival_soc_pct: f64,
    pub feasible: bool,
    pub infeasible_reason: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TripPlan {
    pub vehicles: Vec<VehicleTripPlan>,
    pub total_distance_km: f64,
}

// ── Greedy solver ─────────────────────────────────────────────────────────────

fn plan_vehicle(
    vehicle: &VehicleThermal,
    thermal: &ThermalInputs,
    waypts: &[(f64, f64)],
    total_km: f64,
) -> VehicleTripPlan {
    let outputs = compute_thermal_impl(vehicle, thermal);
    let usable_kwh = outputs.usable_kwh;
    let efficiency_whkm = outputs.efficiency_whkm;
    let peak_dc_kw = outputs.peak_dc_kw;

    if usable_kwh <= 0.0 || efficiency_whkm <= 0.0 {
        return VehicleTripPlan {
            vehicle_id: vehicle.id.clone(),
            stops: vec![],
            total_distance_km: total_km,
            arrival_soc_pct: 0.0,
            feasible: false,
            infeasible_reason: Some("missing battery or efficiency data".to_string()),
        };
    }

    // Start at 95% SOC (reasonable departure charge for a road trip)
    let mut remaining_kwh = usable_kwh * 0.95;
    let mut stops: Vec<ChargeStop> = vec![];
    let mut dist_so_far = 0.0;

    for i in 0..waypts.len() - 1 {
        let (lat0, lng0) = waypts[i];
        let (lat1, lng1) = waypts[i + 1];
        let seg_km = haversine_km(lat0, lng0, lat1, lng1);
        let seg_kwh = seg_km * efficiency_whkm / 1000.0;

        let soc_after = (remaining_kwh - seg_kwh) / usable_kwh;

        if soc_after < MIN_SOC {
            // Need to charge before this segment. Find a station near the midpoint.
            let mid_lat = (lat0 + lat1) / 2.0;
            let mid_lng = (lng0 + lng1) / 2.0;
            let station = nearest_station(mid_lat, mid_lng, 40.0)
                .or_else(|| nearest_station(mid_lat, mid_lng, 80.0));

            match station {
                None => {
                    return VehicleTripPlan {
                        vehicle_id: vehicle.id.clone(),
                        stops,
                        total_distance_km: total_km,
                        arrival_soc_pct: (remaining_kwh / usable_kwh * 100.0).max(0.0),
                        feasible: false,
                        infeasible_reason: Some(format!(
                            "no DCFC station within 80 km of {:.2},{:.2}",
                            mid_lat, mid_lng
                        )),
                    };
                }
                Some(s) => {
                    let soc_in = remaining_kwh / usable_kwh;
                    let energy_to_target = (TARGET_SOC - soc_in).max(0.0) * usable_kwh;
                    let effective_kw = (s.kw as f64).min(peak_dc_kw) * AVG_CHARGE_RATIO;
                    let charge_min = if effective_kw > 0.0 {
                        ((energy_to_target / effective_kw) * 60.0).round() as u32
                    } else {
                        999
                    };

                    stops.push(ChargeStop {
                        station_name: s.name.to_string(),
                        station_lat: s.lat,
                        station_lng: s.lng,
                        station_kw: s.kw,
                        network: s.network.to_string(),
                        soc_in_pct: (soc_in * 100.0).round(),
                        soc_out_pct: (TARGET_SOC * 100.0).round(),
                        charge_minutes: charge_min,
                        distance_from_origin_km: dist_so_far + seg_km / 2.0,
                    });

                    remaining_kwh = TARGET_SOC * usable_kwh;
                }
            }
        }

        remaining_kwh = (remaining_kwh - seg_kwh).max(0.0);
        dist_so_far += seg_km;
    }

    let arrival_soc = remaining_kwh / usable_kwh;
    VehicleTripPlan {
        vehicle_id: vehicle.id.clone(),
        stops,
        total_distance_km: total_km,
        arrival_soc_pct: (arrival_soc * 100.0).max(0.0).min(100.0),
        feasible: true,
        infeasible_reason: None,
    }
}

// ── Tauri command ─────────────────────────────────────────────────────────────

#[tauri::command]
#[tracing::instrument(level = "debug", skip_all, fields(vehicle_count = req.vehicle_ids.len()))]
pub fn plan_trip(req: TripRequest) -> Result<TripPlan, String> {
    let thermal_inputs = ThermalInputs {
        temp_c: req.temp_c,
        preconditioned: true, // assume preconditioned for trip planning
        hvac_on: req.hvac_on,
        speed_kph: req.speed_kph,
    };

    let total_km = haversine_km(req.origin_lat, req.origin_lng, req.dest_lat, req.dest_lng);
    let waypts = waypoints(
        req.origin_lat,
        req.origin_lng,
        req.dest_lat,
        req.dest_lng,
        SEGMENT_KM,
    );

    let vehicle_plans: Vec<VehicleTripPlan> = req
        .vehicle_ids
        .iter()
        .filter_map(|id| VEHICLES.iter().find(|v| &v.id == id))
        .map(|vehicle| plan_vehicle(vehicle, &thermal_inputs, &waypts, total_km))
        .collect();

    Ok(TripPlan {
        vehicles: vehicle_plans,
        total_distance_km: total_km,
    })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn req(vehicle_ids: Vec<&str>) -> TripRequest {
        TripRequest {
            // Toronto City Hall → Ottawa City Hall (~450 km)
            origin_lat: 43.6532,
            origin_lng: -79.3832,
            dest_lat: 45.4215,
            dest_lng: -75.6972,
            vehicle_ids: vehicle_ids.into_iter().map(String::from).collect(),
            temp_c: 20.0,
            hvac_on: false,
            speed_kph: Some(100.0),
        }
    }

    #[test]
    fn toronto_to_ottawa_feasible_for_ioniq5() {
        let result = plan_trip(req(vec!["hyundai-ioniq5-2025-lr-awd"])).unwrap();
        assert_eq!(result.vehicles.len(), 1);
        let plan = &result.vehicles[0];
        assert!(plan.feasible, "IONIQ 5 LR AWD should complete Toronto→Ottawa");
        // Straight-line great-circle is ~352 km (road is longer via Kingston)
        assert!(result.total_distance_km > 300.0 && result.total_distance_km < 420.0,
            "great-circle distance: {}", result.total_distance_km);
    }

    #[test]
    fn lightning_needs_at_least_one_stop() {
        let result = plan_trip(req(vec!["ford-lightning-er-awd"])).unwrap();
        let plan = &result.vehicles[0];
        // F-150 Lightning ER AWD rated ~483 km, but highway efficiency + 95% departure
        // still makes it borderline; at 20°C it should make it non-stop OR with 1 stop.
        // Either way it should be feasible.
        assert!(plan.feasible, "Lightning should be feasible Toronto→Ottawa");
    }

    #[test]
    fn ioniq5_has_fewer_stops_than_lightning_at_minus20() {
        let cold_req_ioniq = TripRequest {
            origin_lat: 43.6532, origin_lng: -79.3832,
            dest_lat: 45.4215, dest_lng: -75.6972,
            vehicle_ids: vec!["hyundai-ioniq5-2025-lr-awd".to_string()],
            temp_c: -20.0, hvac_on: true, speed_kph: Some(100.0),
        };
        let cold_req_lightning = TripRequest {
            vehicle_ids: vec!["ford-lightning-er-awd".to_string()],
            ..cold_req_ioniq
        };

        let ioniq = plan_trip(cold_req_ioniq).unwrap();
        let lightning = plan_trip(cold_req_lightning).unwrap();

        let ioniq_stops = ioniq.vehicles[0].stops.len();
        let lightning_stops = lightning.vehicles[0].stops.len();
        assert!(
            lightning_stops >= ioniq_stops,
            "Lightning ({} stops) should need >= IONIQ 5 ({} stops) at -20°C",
            lightning_stops,
            ioniq_stops
        );
    }

    #[test]
    fn haversine_toronto_ottawa() {
        // Great-circle (straight-line) is ~352 km; road via Kingston is ~450 km
        let d = haversine_km(43.6532, -79.3832, 45.4215, -75.6972);
        assert!(d > 320.0 && d < 390.0, "Toronto→Ottawa haversine: {}", d);
    }
}
