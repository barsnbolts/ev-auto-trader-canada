// Charge-stop planner — given a vehicle, its current thermal state, a route,
// and available DCFC stations, produce an ordered list of charging stops with
// arrive/depart SoC and minutes. Plus total trip time.
//
// Simplification policy: we model stops as evenly-spaced legs, each ending at
// the DCFC station nearest to the ideal stop point along the route. Charging
// time uses the vehicle's published 20°C curve, scaled by the current slider's
// dc_temp_factor, to estimate average charging power in the 15→80% SoC window.

import type { Vehicle } from "../types";
import type { ThermalOutputs } from "./thermal";
import type { Station } from "./ocm";
import type { RouteResult } from "./osrm";

export interface ChargeStop {
  station: Station;
  leg_km: number;
  arrive_soc_pct: number;
  depart_soc_pct: number;
  minutes: number;
  approx_km_along_route: number;
}

export interface ChargePlan {
  vehicle_id: string;
  stops: ChargeStop[];
  drive_minutes: number;
  charge_minutes: number;
  total_minutes: number;
  start_soc_pct: number;
  final_soc_pct: number;
  feasible: boolean;
  note: string;
}

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function pointAtKm(polyline: [number, number][], targetKm: number): [number, number] | null {
  if (polyline.length === 0) return null;
  let accumulated = 0;
  for (let i = 1; i < polyline.length; i++) {
    const segKm = haversineKm(polyline[i - 1], polyline[i]);
    if (accumulated + segKm >= targetKm) {
      const t = segKm > 0 ? (targetKm - accumulated) / segKm : 0;
      const lat = polyline[i - 1][0] + t * (polyline[i][0] - polyline[i - 1][0]);
      const lng = polyline[i - 1][1] + t * (polyline[i][1] - polyline[i - 1][1]);
      return [lat, lng];
    }
    accumulated += segKm;
  }
  return polyline[polyline.length - 1];
}

function nearestStationAhead(
  idealPoint: [number, number],
  stations: Station[],
  maxDetourKm: number = 25,
): Station | null {
  let best: Station | null = null;
  let bestDist = Infinity;
  for (const s of stations) {
    const d = haversineKm(idealPoint, [s.lat, s.lng]);
    if (d < bestDist && d <= maxDetourKm) {
      best = s;
      bestDist = d;
    }
  }
  return best;
}

function averageChargingKw(vehicle: Vehicle, dcTempFactor: number, fromSoc: number, toSoc: number): number {
  // Estimate average charging kW between fromSoc% and toSoc% by integrating
  // the vehicle's 20C curve and scaling by the current cold/preconditioning factor.
  const curve = vehicle.charging_curve_20c;
  if (!curve || curve.length === 0) {
    // PHEVs or missing data — fall back to rated peak × factor × 0.7 (generic tapered avg).
    const peak = vehicle.dc_charge_kw_max.value ?? 50;
    return Math.max(1, peak * dcTempFactor * 0.7);
  }
  // Linear interp across the curve, averaged across the target SoC range.
  const sample = (soc: number) => {
    if (soc <= curve[0].soc_pct) return curve[0].kw;
    if (soc >= curve[curve.length - 1].soc_pct) return curve[curve.length - 1].kw;
    for (let i = 0; i < curve.length - 1; i++) {
      if (soc >= curve[i].soc_pct && soc <= curve[i + 1].soc_pct) {
        const t = (soc - curve[i].soc_pct) / (curve[i + 1].soc_pct - curve[i].soc_pct);
        return curve[i].kw + t * (curve[i + 1].kw - curve[i].kw);
      }
    }
    return curve[0].kw;
  };
  let total = 0;
  const steps = Math.max(1, Math.floor((toSoc - fromSoc) / 5));
  for (let i = 0; i < steps; i++) {
    const s = fromSoc + ((i + 0.5) * (toSoc - fromSoc)) / steps;
    total += sample(s);
  }
  const avg20 = total / steps;
  return Math.max(1, avg20 * dcTempFactor);
}

export function planRoute(
  vehicle: Vehicle,
  thermal: ThermalOutputs,
  route: RouteResult,
  stations: Station[],
  opts: {
    start_soc_pct?: number; // default 90%
    target_arrival_soc_pct?: number; // default 15%
    depart_soc_pct?: number; // default 80%
    ideal_leg_soc_window_pct?: number; // SoC consumed between stops, default 65
  } = {},
): ChargePlan {
  const start_soc = opts.start_soc_pct ?? 90;
  const arrival_target = opts.target_arrival_soc_pct ?? 15;
  const depart_soc = opts.depart_soc_pct ?? 80;
  const leg_window = opts.ideal_leg_soc_window_pct ?? 65;

  const distanceKm = route.distance_km;
  const rangeKm = thermal.range_km;
  const driveMin = route.duration_min;

  // Can we do it on one charge?
  const rangeFromStart = (rangeKm * (start_soc - arrival_target)) / 100;
  if (distanceKm <= rangeFromStart) {
    const kmConsumed = distanceKm;
    const socConsumed = (kmConsumed / rangeKm) * 100;
    return {
      vehicle_id: vehicle.id,
      stops: [],
      drive_minutes: driveMin,
      charge_minutes: 0,
      total_minutes: driveMin,
      start_soc_pct: start_soc,
      final_soc_pct: Math.max(0, start_soc - socConsumed),
      feasible: true,
      note: "No stops needed at current slider state.",
    };
  }

  // We need stops. Each leg consumes `leg_window` percent of SoC → leg_km = range * leg_window/100.
  const legKm = (rangeKm * leg_window) / 100;
  const numStops = Math.max(1, Math.ceil((distanceKm - rangeFromStart) / legKm));

  const stops: ChargeStop[] = [];
  const dcTempFactor = thermal.breakdown.dc_temp_factor;

  let current_soc = start_soc;
  let drivenKm = 0;
  let totalChargeMin = 0;

  for (let i = 0; i < numStops; i++) {
    const idealStopKm = rangeFromStart + i * legKm;
    const idealPoint = pointAtKm(route.polyline, idealStopKm);
    if (!idealPoint) break;
    const station = nearestStationAhead(idealPoint, stations, 30);
    if (!station) {
      return {
        vehicle_id: vehicle.id,
        stops,
        drive_minutes: driveMin,
        charge_minutes: totalChargeMin,
        total_minutes: driveMin + totalChargeMin,
        start_soc_pct: start_soc,
        final_soc_pct: current_soc,
        feasible: false,
        note: `No DCFC station within 30 km of ${Math.round(idealStopKm)} km mark — trip not feasible without detour.`,
      };
    }

    const legDrivenKm = idealStopKm - drivenKm;
    const socConsumed = (legDrivenKm / rangeKm) * 100;
    const arriveSoc = Math.max(0, current_soc - socConsumed);
    const stationKw = Math.min(station.max_kw, thermal.peak_dc_kw);
    const kwhToAdd = thermal.usable_kwh * (depart_soc - arriveSoc) / 100;
    const avgKw = Math.min(stationKw, averageChargingKw(vehicle, dcTempFactor, arriveSoc, depart_soc));
    const minutes = (kwhToAdd / avgKw) * 60;

    stops.push({
      station,
      leg_km: legDrivenKm,
      arrive_soc_pct: arriveSoc,
      depart_soc_pct: depart_soc,
      minutes,
      approx_km_along_route: idealStopKm,
    });
    totalChargeMin += minutes;
    current_soc = depart_soc;
    drivenKm = idealStopKm;
  }

  // Final leg to destination.
  const finalLegKm = distanceKm - drivenKm;
  const finalSocConsumed = (finalLegKm / rangeKm) * 100;
  const final_soc = Math.max(0, current_soc - finalSocConsumed);
  const feasible = final_soc >= arrival_target;

  return {
    vehicle_id: vehicle.id,
    stops,
    drive_minutes: driveMin,
    charge_minutes: totalChargeMin,
    total_minutes: driveMin + totalChargeMin,
    start_soc_pct: start_soc,
    final_soc_pct: final_soc,
    feasible,
    note: feasible
      ? `${stops.length} stop${stops.length === 1 ? "" : "s"} · arrive with ${Math.round(final_soc)}% SoC.`
      : `Arriving at ${Math.round(final_soc)}% SoC — below ${arrival_target}% safety threshold. Consider slower driving or an extra stop.`,
  };
}
