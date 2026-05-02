import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import type { Vehicle } from "../types";
import type { ThermalOutputs } from "../lib/thermal";
import { fetchStations, type Station } from "../lib/ocm";
import { fetchRoute, type RouteResult } from "../lib/osrm";
import { ChargePlanPanel } from "./ChargePlanPanel";

const RING_COLORS = ["#2a7cff", "#1fb76b", "#f6a72a", "#e8453c"] as const;
const NETWORK_COLORS: Record<string, string> = {
  Tesla: "#cc0000",
  "Tesla Supercharger": "#cc0000",
  "Electrify Canada": "#1f8b4c",
  Electrify: "#1f8b4c",
  Ivy: "#6e56cf",
  "Ivy Charging Network": "#6e56cf",
  Flo: "#00a3ff",
  "FLO Networks": "#00a3ff",
  ChargePoint: "#ff9f2e",
  "ChargePoint Network": "#ff9f2e",
};

function colorFor(network: string): string {
  return NETWORK_COLORS[network] ?? "#888";
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function MapPanel({
  vehicles,
  thermals,
}: {
  vehicles: Vehicle[];
  thermals: Record<string, ThermalOutputs>;
}) {
  const { user_location, setUserLocation, trip_destination, setTripDestination } = useAppStore();
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const layersRef = useRef<any[]>([]);
  const [locationInput, setLocationInput] = useState("");
  const [destInput, setDestInput] = useState("");
  const [leafletReady, setLeafletReady] = useState(false);
  const [stations, setStations] = useState<Station[]>([]);
  const [stationSource, setStationSource] = useState<"ocm" | "demo" | "loading">("loading");
  const [stationNote, setStationNote] = useState<string>("");
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  // Wait for Leaflet.
  useEffect(() => {
    if (typeof L !== "undefined") {
      setLeafletReady(true);
      return;
    }
    const interval = setInterval(() => {
      if (typeof L !== "undefined") {
        setLeafletReady(true);
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Initialize map.
  useEffect(() => {
    if (!leafletReady || !mapRef.current || leafletMap.current) return;
    const m = L.map(mapRef.current, { zoomControl: true, attributionControl: true }).setView(
      [user_location.lat, user_location.lng],
      8,
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(m);
    m.on("click", (e: any) => {
      setUserLocation({ lat: e.latlng.lat, lng: e.latlng.lng, label: "Custom pin" });
    });
    leafletMap.current = m;
  }, [leafletReady, user_location.lat, user_location.lng, setUserLocation]);

  // Fetch stations whenever user location or largest range changes.
  useEffect(() => {
    const maxRangeKm = Math.max(100, ...vehicles.map((v) => thermals[v.id]?.range_km ?? 0));
    // bbox ≈ ±(range_km / 111) degrees latitude; longitude adjusted for cos(lat)
    const latDelta = maxRangeKm / 111;
    const lngDelta = maxRangeKm / (111 * Math.cos((user_location.lat * Math.PI) / 180));
    const sw: [number, number] = [user_location.lat - latDelta, user_location.lng - lngDelta];
    const ne: [number, number] = [user_location.lat + latDelta, user_location.lng + lngDelta];
    setStationSource("loading");
    fetchStations(sw, ne).then((res) => {
      setStations(res.stations);
      setStationSource(res.source);
      setStationNote(res.note ?? "");
    });
  }, [user_location.lat, user_location.lng, vehicles, thermals]);

  // Fetch route whenever destination changes.
  useEffect(() => {
    if (!trip_destination) {
      setRoute(null);
      return;
    }
    setRouteLoading(true);
    fetchRoute(
      [user_location.lat, user_location.lng],
      [trip_destination.lat, trip_destination.lng],
    ).then((r) => {
      setRoute(r);
      setRouteLoading(false);
    });
  }, [user_location.lat, user_location.lng, trip_destination]);

  // Redraw layers.
  useEffect(() => {
    if (!leafletMap.current) return;
    const m = leafletMap.current;
    for (const layer of layersRef.current) m.removeLayer(layer);
    layersRef.current = [];

    // User marker.
    const userMarker = L.marker([user_location.lat, user_location.lng], {
      icon: L.divIcon({
        className: "",
        html: `<div style="width:18px;height:18px;border-radius:9px;background:#fff;border:3px solid #2a7cff;box-shadow:0 0 0 3px rgba(42,124,255,.3);"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      }),
    })
      .bindPopup(`<strong>${user_location.label}</strong><br/>click map to move`)
      .addTo(m);
    layersRef.current.push(userMarker);

    // Range rings.
    vehicles.forEach((v, i) => {
      const thermal = thermals[v.id];
      if (!thermal?.range_km) return;
      const color = RING_COLORS[i % RING_COLORS.length];
      const circle = L.circle([user_location.lat, user_location.lng], {
        radius: thermal.range_km * 1000,
        color,
        fill: true,
        fillColor: color,
        fillOpacity: 0.04,
        weight: 2,
        dashArray: "4 6",
      })
        .bindPopup(
          `<strong>${v.model} ${v.trim_label}</strong><br/>${Math.round(thermal.range_km)} km at current slider state`,
        )
        .addTo(m);
      layersRef.current.push(circle);
    });

    // DCFC stations.
    const maxRange = Math.max(0, ...vehicles.map((v) => thermals[v.id]?.range_km ?? 0));
    stations.forEach((s) => {
      const distKm = haversineKm(user_location.lat, user_location.lng, s.lat, s.lng);
      if (maxRange > 0 && distKm > maxRange * 1.2) return;
      const color = colorFor(s.network);
      const marker = L.circleMarker([s.lat, s.lng], {
        radius: 6,
        color,
        fillColor: color,
        fillOpacity: s.status === "busy" ? 0.3 : 0.85,
        weight: 1,
      })
        .bindPopup(
          `<strong>${s.name}</strong><br/>${s.network} · ${s.max_kw} kW · ${s.stalls} stalls<br/><em>${s.status}</em>`,
        )
        .addTo(m);
      layersRef.current.push(marker);
    });

    // Trip: destination marker + route polyline.
    if (trip_destination) {
      const destMarker = L.marker([trip_destination.lat, trip_destination.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div style="width:14px;height:14px;border-radius:2px;background:#f6a72a;border:2px solid #fff;"></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        }),
      })
        .bindPopup(`<strong>Destination:</strong><br/>${trip_destination.label}`)
        .addTo(m);
      layersRef.current.push(destMarker);

      if (route) {
        const line = L.polyline(route.polyline, {
          color: "#f6a72a",
          weight: 3,
          dashArray: route.source === "osrm" ? undefined : "6 4",
        }).addTo(m);
        layersRef.current.push(line);
      }
    }

    m.setView([user_location.lat, user_location.lng], m.getZoom());
  }, [user_location, trip_destination, vehicles, thermals, stations, route]);

  const geocode = async (q: string): Promise<{ lat: number; lng: number; label: string } | null> => {
    if (!q.trim()) return null;
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q + ", Canada")}`;
      const res = await fetch(url, { headers: { "Accept-Language": "en" } });
      const arr = await res.json();
      if (!arr.length) return null;
      return { lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon), label: arr[0].display_name.split(",")[0] };
    } catch {
      return null;
    }
  };

  const crowFliesKm = trip_destination
    ? haversineKm(user_location.lat, user_location.lng, trip_destination.lat, trip_destination.lng)
    : 0;
  const drivingKm = route?.distance_km ?? 0;
  const drivingPct = crowFliesKm > 0 && drivingKm > 0 ? ((drivingKm / crowFliesKm - 1) * 100) : 0;

  return (
    <div className="bg-ink-800 rounded-lg border border-ink-700 p-4 mb-6">
      <div className="flex items-baseline gap-4 mb-3 flex-wrap">
        <h3 className="font-display text-sm uppercase tracking-widest text-ink-300">
          Map · range rings · charging stations
        </h3>
        <span className="text-xs text-ink-500">
          {stationSource === "loading"
            ? "loading stations…"
            : stationSource === "ocm"
              ? `${stations.length} live DCFC stations (Open Charge Map)`
              : `${stations.length} demo stations · ${stationNote}`}
        </span>
      </div>

      <div ref={mapRef} style={{ height: 360, borderRadius: 8, background: "#1a1a1f" }} />

      <div className="mt-3 grid md:grid-cols-2 gap-3 text-xs">
        <div>
          <label className="block text-ink-400 mb-1">Your location</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={user_location.label}
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              className="flex-1 bg-ink-700 border border-ink-600 rounded px-2 py-1 text-ink-100"
            />
            <button
              onClick={async () => {
                const loc = await geocode(locationInput);
                if (loc) {
                  setUserLocation(loc);
                  setLocationInput("");
                }
              }}
              className="bg-accent-blue/80 text-white rounded px-3 hover:bg-accent-blue"
            >
              Set
            </button>
          </div>
          <div className="text-ink-500 mt-1 font-mono">
            {user_location.lat.toFixed(4)}, {user_location.lng.toFixed(4)}
          </div>
        </div>
        <div>
          <label className="block text-ink-400 mb-1">Trip destination</label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={trip_destination?.label ?? "e.g., Ottawa or K1A 0A9"}
              value={destInput}
              onChange={(e) => setDestInput(e.target.value)}
              className="flex-1 bg-ink-700 border border-ink-600 rounded px-2 py-1 text-ink-100"
            />
            <button
              onClick={async () => {
                if (!destInput.trim()) {
                  setTripDestination(null);
                  return;
                }
                const dest = await geocode(destInput);
                if (dest) {
                  setTripDestination(dest);
                  setDestInput("");
                }
              }}
              className="bg-accent-amber/80 text-ink-900 rounded px-3 hover:bg-accent-amber font-medium"
            >
              Plan
            </button>
            {trip_destination && (
              <button
                onClick={() => setTripDestination(null)}
                className="bg-ink-700 text-ink-300 rounded px-3 hover:bg-ink-600"
              >
                Clear
              </button>
            )}
          </div>
          {trip_destination && (
            <div className="text-ink-500 mt-1 font-mono">
              {routeLoading
                ? "computing route…"
                : route?.source === "osrm"
                  ? `${Math.round(drivingKm)} km driving (${drivingPct >= 0 ? "+" : ""}${drivingPct.toFixed(0)}% vs straight-line) · ${Math.round(route.duration_min)} min`
                  : `${Math.round(crowFliesKm)} km straight-line${route?.note ? ` · ${route.note}` : ""}`}
            </div>
          )}
        </div>
      </div>

      {trip_destination && route && (
        <ChargePlanPanel vehicles={vehicles} thermals={thermals} route={route} stations={stations} />
      )}

      {trip_destination && (
        <div className="mt-4 border-t border-ink-700 pt-3">
          <div className="text-xs text-ink-400 mb-2">
            Can each car make the {Math.round(drivingKm || crowFliesKm)} km trip on one charge at current slider state?
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${vehicles.length}, minmax(0, 1fr))` }}>
            {vehicles.map((v, i) => {
              const t = thermals[v.id];
              const range = t?.range_km ?? 0;
              const tripKm = drivingKm || crowFliesKm;
              const margin = range - tripKm;
              const ok = margin >= 30;
              const color = ok ? "text-accent-green" : margin > 0 ? "text-accent-amber" : "text-accent-red";
              return (
                <div
                  key={v.id}
                  className="bg-ink-700/40 rounded px-3 py-2 text-xs border-l-2"
                  style={{ borderLeftColor: RING_COLORS[i % RING_COLORS.length] }}
                >
                  <div className="text-ink-200">{v.model}</div>
                  <div className="text-ink-400">{v.trim_label}</div>
                  <div className={`mt-1 font-mono ${color}`}>
                    {ok ? "✓ Yes" : margin > 0 ? "⚠ Tight" : "✗ No"}{" "}
                    <span className="text-ink-500">{margin >= 0 ? "+" : ""}{Math.round(margin)} km margin</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-[11px] text-ink-500 mt-2">
            {route?.source === "osrm" ? "Road distance from OSRM." : "Straight-line distance; real driving will be 10–25% longer."} Physics slider applies — heat/cold + HVAC + speed all factor in.
          </div>
        </div>
      )}
    </div>
  );
}
