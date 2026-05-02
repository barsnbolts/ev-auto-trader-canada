import { useEffect, useRef, useState, useCallback } from "react";
import "leaflet/dist/leaflet.css";
import type { Vehicle } from "../types";
import type { ThermalOutputs } from "../lib/thermal";
import { VEHICLE_COLORS } from "../lib/compare-colors";
import { debugLog } from "../lib/debugLog";

// Leaflet is lazy-imported in useEffect to ensure it has access to window.
import type * as L from "leaflet";

// Fix broken icon paths under Vite asset bundling (known gotcha)
function fixLeafletIcons(leaflet: typeof L) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (leaflet.Icon.Default.prototype as any)._getIconUrl;
  leaflet.Icon.Default.mergeOptions({
    iconUrl: "/leaflet-markers/marker-icon.png",
    iconRetinaUrl: "/leaflet-markers/marker-icon-2x.png",
    shadowUrl: "/leaflet-markers/marker-shadow.png",
  });
}

// Default map center: Toronto City Hall
const DEFAULT_CENTER: [number, number] = [43.6532, -79.3832];

// 15 hardcoded Ontario DCFC stations (fallback when no OCM API key).
// Locations are well-known DCFC sites; power levels approximate.
interface Station {
  id: string;
  name: string;
  lat: number;
  lng: number;
  kw: number;
  network: string;
}

const ONTARIO_DCFC_FALLBACK: Station[] = [
  { id: "on-01", name: "Electrify Canada — Square One", lat: 43.593, lng: -79.642, kw: 350, network: "Electrify Canada" },
  { id: "on-02", name: "Electrify Canada — Erin Mills", lat: 43.551, lng: -79.715, kw: 350, network: "Electrify Canada" },
  { id: "on-03", name: "Tesla Supercharger — Toronto (Bay St)", lat: 43.648, lng: -79.381, kw: 250, network: "Tesla" },
  { id: "on-04", name: "Tesla Supercharger — Mississauga", lat: 43.612, lng: -79.637, kw: 250, network: "Tesla" },
  { id: "on-05", name: "Petro-Canada DCFC — Burlington", lat: 43.316, lng: -79.797, kw: 100, network: "Petro-Canada" },
  { id: "on-06", name: "Tesla Supercharger — Hamilton", lat: 43.257, lng: -79.870, kw: 250, network: "Tesla" },
  { id: "on-07", name: "Electrify Canada — Kitchener", lat: 43.449, lng: -80.492, kw: 350, network: "Electrify Canada" },
  { id: "on-08", name: "Tesla Supercharger — London", lat: 42.984, lng: -81.249, kw: 250, network: "Tesla" },
  { id: "on-09", name: "Electrify Canada — Guelph", lat: 43.545, lng: -80.247, kw: 350, network: "Electrify Canada" },
  { id: "on-10", name: "Petro-Canada DCFC — Brampton", lat: 43.685, lng: -79.762, kw: 100, network: "Petro-Canada" },
  { id: "on-11", name: "Tesla Supercharger — Oshawa", lat: 43.897, lng: -78.865, kw: 250, network: "Tesla" },
  { id: "on-12", name: "Electrify Canada — Kingston", lat: 44.233, lng: -76.481, kw: 350, network: "Electrify Canada" },
  { id: "on-13", name: "Tesla Supercharger — Barrie", lat: 44.389, lng: -79.690, kw: 250, network: "Tesla" },
  { id: "on-14", name: "Electrify Canada — Ottawa (Trainyards)", lat: 45.410, lng: -75.668, kw: 350, network: "Electrify Canada" },
  { id: "on-15", name: "Petro-Canada DCFC — Sudbury", lat: 46.494, lng: -81.001, kw: 100, network: "Petro-Canada" },
];

interface MapPanelProps {
  vehicles: Vehicle[];
  thermals: Record<string, ThermalOutputs>;
  center?: [number, number];
}

export function MapPanel({ vehicles, thermals, center = DEFAULT_CENTER }: MapPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const ringLayersRef = useRef<L.Circle[]>([]);
  const pinLayersRef = useRef<L.Marker[]>([]);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Lazy-load Leaflet (it accesses window at import time)
  useEffect(() => {
    if (typeof window === "undefined" || mapRef.current) return;

    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || mapRef.current) return;

      fixLeafletIcons(L);

      const container = containerRef.current;
      if (!container) return;

      const map = L.map(container, {
        center,
        zoom: 8,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);

      mapRef.current = map;
      setMapReady(true);
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update range rings whenever vehicles or thermals change
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    import("leaflet").then((L) => {
      const map = mapRef.current;
      if (!map) return;

      // Remove old rings
      ringLayersRef.current.forEach((c) => c.remove());
      ringLayersRef.current = [];

      debugLog("ui", "rings_update", {
        vehicleCount: vehicles.length,
        ranges: vehicles.map((v) => ({ id: v.id, km: thermals[v.id]?.range_km })),
      });
      vehicles.forEach((v, idx) => {
        const thermal = thermals[v.id];
        if (!thermal) return;
        const color = VEHICLE_COLORS[idx % VEHICLE_COLORS.length];
        const rangeKm = thermal.range_km;

        // 100% range ring
        const ring100 = L.circle(center, {
          radius: rangeKm * 1000,
          color,
          weight: 2,
          fillOpacity: 0.04,
          fillColor: color,
        }).addTo(map);
        ring100.bindTooltip(`${v.model} ${v.trim_label} — ${Math.round(rangeKm)} km`);

        // 50% range ring
        const ring50 = L.circle(center, {
          radius: (rangeKm * 0.5) * 1000,
          color,
          weight: 1,
          dashArray: "4 4",
          fillOpacity: 0.02,
          fillColor: color,
        }).addTo(map);
        ring50.bindTooltip(`${v.model} ${v.trim_label} — 50% (${Math.round(rangeKm * 0.5)} km)`);

        ringLayersRef.current.push(ring100, ring50);
      });
    });
  }, [mapReady, vehicles, thermals, center]);

  // Place charger pins (hardcoded fallback; OCM live data in a future pass)
  const loadPins = useCallback(
    (L: typeof import("leaflet"), stations: Station[]) => {
      const map = mapRef.current;
      if (!map) return;

      pinLayersRef.current.forEach((m) => m.remove());
      pinLayersRef.current = [];

      stations.forEach((station) => {
        const marker = L.marker([station.lat, station.lng]).addTo(map);
        marker.on("click", () => {
          debugLog("ui", "station_click", {
            id: station.id,
            kw: station.kw,
            network: station.network,
          });
          setSelectedStation(station);
        });
        marker.bindTooltip(`${station.network} — ${station.kw} kW`);
        pinLayersRef.current.push(marker);
      });
    },
    [],
  );

  useEffect(() => {
    if (!mapReady) return;
    import("leaflet").then((L) => loadPins(L, ONTARIO_DCFC_FALLBACK));
  }, [mapReady, loadPins]);

  return (
    <div className="relative">
      {/* Map container */}
      <div
        ref={containerRef}
        className="w-full rounded-lg overflow-hidden border border-ink-700"
        style={{ height: "420px" }}
      />

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-4">
        {vehicles.map((v, idx) => {
          const color = VEHICLE_COLORS[idx % VEHICLE_COLORS.length];
          const thermal = thermals[v.id];
          return (
            <div key={v.id} className="flex items-center gap-2 text-xs text-ink-300">
              <span
                className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              <span>
                {v.model} {v.trim_label}
                {thermal && (
                  <span className="text-ink-500 ml-1">
                    {Math.round(thermal.range_km)} km
                  </span>
                )}
              </span>
            </div>
          );
        })}
        <div className="flex items-center gap-2 text-xs text-ink-500">
          <span className="text-base">⚡</span>
          DCFC stations (15 Ontario fallback)
        </div>
      </div>

      {/* Station sidecar */}
      {selectedStation && (
        <div className="mt-3 bg-ink-800 border border-ink-700 rounded-lg p-4 text-sm">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-medium text-ink-100">{selectedStation.name}</div>
              <div className="text-ink-400 mt-1">
                {selectedStation.network} · {selectedStation.kw} kW
              </div>
            </div>
            <button
              onClick={() => setSelectedStation(null)}
              className="text-ink-500 hover:text-ink-300 text-lg leading-none ml-4"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
