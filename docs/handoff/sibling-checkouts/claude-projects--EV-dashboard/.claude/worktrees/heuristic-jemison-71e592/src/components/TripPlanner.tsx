import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { brandById } from "../data";
import { VEHICLE_COLORS } from "../lib/compare-colors";
import type { Vehicle } from "../types";

interface ChargeStop {
  station_name: string;
  station_lat: number;
  station_lng: number;
  station_kw: number;
  network: string;
  soc_in_pct: number;
  soc_out_pct: number;
  charge_minutes: number;
  distance_from_origin_km: number;
}

interface VehicleTripPlan {
  vehicle_id: string;
  stops: ChargeStop[];
  total_distance_km: number;
  arrival_soc_pct: number;
  feasible: boolean;
  infeasible_reason?: string;
}

interface TripPlan {
  vehicles: VehicleTripPlan[];
  total_distance_km: number;
}

// Tauri invoke — lazy import so it doesn't break in browser dev server
async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  const { debugLog, debugError } = await import("../lib/debugLog");
  const t0 = performance.now();
  debugLog("invoke", `${cmd}_start`, { args });
  try {
    const result = await invoke<T>(cmd, args);
    const ms = Math.round(performance.now() - t0);
    debugLog("invoke", `${cmd}_ok`, { ms });
    return result;
  } catch (err) {
    const ms = Math.round(performance.now() - t0);
    debugError("invoke", `${cmd}_err`, { ms, error: String(err) });
    throw err;
  }
}

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

async function geocode(query: string): Promise<{ lat: number; lng: number; name: string } | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ", Ontario, Canada")}&format=json&limit=1`;
  try {
    const resp = await fetch(url, {
      headers: { "Accept-Language": "en", "User-Agent": "EV-Dashboard-personal/1.0" },
    });
    const results: NominatimResult[] = await resp.json();
    if (!results.length) return null;
    return {
      lat: parseFloat(results[0].lat),
      lng: parseFloat(results[0].lon),
      name: results[0].display_name.split(",")[0],
    };
  } catch {
    return null;
  }
}

interface TripPlannerProps {
  vehicles: Vehicle[];
}

export function TripPlanner({ vehicles }: TripPlannerProps) {
  const { temp_c, hvac_on, speed_kph } = useAppStore();
  const [origin, setOrigin] = useState("Toronto");
  const [destination, setDestination] = useState("Ottawa");
  const [status, setStatus] = useState<"idle" | "geocoding" | "planning" | "ok" | "error">("idle");
  const [plan, setPlan] = useState<TripPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [geocodedNames, setGeocodedNames] = useState<{ origin: string; dest: string } | null>(null);

  async function handlePlan() {
    if (!vehicles.length) return;
    if (!IS_TAURI) {
      setError("Trip planning requires the Tauri desktop app. Launch via Start-Desktop-App.command.");
      setStatus("error");
      return;
    }
    setStatus("geocoding");
    setError(null);
    setPlan(null);

    const [originGeo, destGeo] = await Promise.all([geocode(origin), geocode(destination)]);
    if (!originGeo) { setError(`Could not geocode "${origin}"`); setStatus("error"); return; }
    if (!destGeo)   { setError(`Could not geocode "${destination}"`); setStatus("error"); return; }

    setGeocodedNames({ origin: originGeo.name, dest: destGeo.name });
    setStatus("planning");

    try {
      const result = await tauriInvoke<TripPlan>("plan_trip", {
        req: {
          origin_lat: originGeo.lat,
          origin_lng: originGeo.lng,
          dest_lat: destGeo.lat,
          dest_lng: destGeo.lng,
          vehicle_ids: vehicles.map((v) => v.id),
          temp_c,
          hvac_on,
          speed_kph: speed_kph ?? 100,
        },
      });
      setPlan(result);
      setStatus("ok");
    } catch (e) {
      setError(String(e));
      setStatus("error");
    }
  }

  return (
    <div className="space-y-6">
      {/* Input row */}
      <div className="bg-ink-800 border border-ink-700 rounded-lg p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-40">
            <label className="block text-xs text-ink-400 mb-1">From</label>
            <input
              type="text"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="e.g. Toronto"
              className="w-full bg-ink-700 border border-ink-600 rounded px-3 py-2 text-sm text-ink-100 focus:outline-none focus:border-accent-blue"
            />
          </div>
          <div className="flex-1 min-w-40">
            <label className="block text-xs text-ink-400 mb-1">To</label>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. Ottawa"
              className="w-full bg-ink-700 border border-ink-600 rounded px-3 py-2 text-sm text-ink-100 focus:outline-none focus:border-accent-blue"
            />
          </div>
          <button
            onClick={handlePlan}
            disabled={status === "geocoding" || status === "planning"}
            className="px-4 py-2 bg-accent-blue text-white text-sm font-medium rounded hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === "geocoding" ? "Locating…" : status === "planning" ? "Planning…" : "Plan Trip"}
          </button>
        </div>

        {geocodedNames && status === "ok" && (
          <p className="text-xs text-ink-500 mt-2">
            {geocodedNames.origin} → {geocodedNames.dest} ·{" "}
            {Math.round(plan?.total_distance_km ?? 0)} km great-circle · uses slider conditions
          </p>
        )}
      </div>

      {/* Error */}
      {status === "error" && (
        <div className="text-sm text-accent-red bg-ink-800 border border-ink-700 rounded-lg p-4">
          {error}
        </div>
      )}

      {/* Results */}
      {status === "ok" && plan && (
        <div className="space-y-4">
          {plan.vehicles.map((vPlan, idx) => {
            const vehicle = vehicles.find((v) => v.id === vPlan.vehicle_id);
            const brand = vehicle ? brandById(vehicle.brand_id)?.name : vPlan.vehicle_id;
            const color = VEHICLE_COLORS[idx % VEHICLE_COLORS.length];

            return (
              <div
                key={vPlan.vehicle_id}
                className="bg-ink-800 border border-ink-700 rounded-lg overflow-hidden"
              >
                {/* Vehicle header */}
                <div
                  className="px-4 py-3 flex items-center justify-between border-b border-ink-700"
                  style={{ borderLeftWidth: 3, borderLeftColor: color, borderLeftStyle: "solid" }}
                >
                  <div>
                    <span className="text-sm font-medium text-ink-100">
                      {brand} {vehicle?.model}
                    </span>
                    <span className="text-xs text-ink-400 ml-2">{vehicle?.trim_label}</span>
                  </div>
                  <div className="text-xs text-ink-400">
                    {vPlan.stops.length === 0 ? (
                      <span className="text-green-400">No stops needed</span>
                    ) : (
                      <span>{vPlan.stops.length} charge stop{vPlan.stops.length !== 1 ? "s" : ""}</span>
                    )}
                    {" · "}arrives at{" "}
                    <span className={vPlan.arrival_soc_pct < 10 ? "text-accent-red" : "text-ink-200"}>
                      {Math.round(vPlan.arrival_soc_pct)}%
                    </span>
                  </div>
                </div>

                {/* Stops */}
                {!vPlan.feasible ? (
                  <div className="px-4 py-3 text-sm text-accent-red">
                    Trip not feasible: {vPlan.infeasible_reason ?? "unknown reason"}
                  </div>
                ) : vPlan.stops.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-ink-500">
                    Enough range to complete without stopping.
                  </div>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-ink-500 border-b border-ink-700">
                        <th className="px-4 py-2 text-left font-normal">Station</th>
                        <th className="px-4 py-2 text-right font-normal">km</th>
                        <th className="px-4 py-2 text-right font-normal">SOC in</th>
                        <th className="px-4 py-2 text-right font-normal">SOC out</th>
                        <th className="px-4 py-2 text-right font-normal">Charge</th>
                        <th className="px-4 py-2 text-right font-normal">kW</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vPlan.stops.map((stop, si) => (
                        <tr key={si} className="border-b border-ink-800 hover:bg-ink-700/30">
                          <td className="px-4 py-2 text-ink-200">{stop.station_name}</td>
                          <td className="px-4 py-2 text-right font-mono text-ink-300">
                            {Math.round(stop.distance_from_origin_km)}
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-accent-red">
                            {Math.round(stop.soc_in_pct)}%
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-green-400">
                            {Math.round(stop.soc_out_pct)}%
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-ink-200">
                            {stop.charge_minutes} min
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-ink-400">
                            {stop.station_kw}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}

          <p className="text-xs text-ink-500">
            Route is straight-line great-circle · DCFC stations from 15-station Ontario fallback ·
            charges to 80% · efficiency from physics model at slider conditions
          </p>
        </div>
      )}
    </div>
  );
}
