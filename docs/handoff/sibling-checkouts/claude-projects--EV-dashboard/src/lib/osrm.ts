// OSRM routing wrapper.
// Public demo server: https://router.project-osrm.org
// Polite usage: 1 request per trip, client-side cache per (origin, dest).
//
// Returns:
//   - polyline (decoded [lat,lng] pairs)
//   - distance_km (road distance)
//   - duration_min
//   - fallback straight-line if the fetch fails

export interface RouteResult {
  polyline: [number, number][];
  distance_km: number;
  duration_min: number;
  source: "osrm" | "straight";
  note?: string;
}

const CACHE_PREFIX = "osrm-cache-v1:";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function cacheKey(a: [number, number], b: [number, number]): string {
  const r = (n: number) => n.toFixed(4);
  return `${CACHE_PREFIX}${r(a[0])},${r(a[1])}->${r(b[0])},${r(b[1])}`;
}

// Tiny polyline-5 decoder for OSRM's default geometry format.
function decodePolyline5(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let b: number, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;
    shift = 0; result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
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

export async function fetchRoute(
  origin: [number, number],
  destination: [number, number],
): Promise<RouteResult> {
  const key = cacheKey(origin, destination);
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Date.now() - parsed.fetched_at < CACHE_TTL_MS) {
        return { ...parsed.result, note: "cache hit" };
      }
    }
  } catch {
    /* noop */
  }

  try {
    const coords = `${origin[1]},${origin[0]};${destination[1]},${destination[0]}`;
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=polyline`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OSRM returned ${res.status}`);
    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route) throw new Error("no route returned");
    const result: RouteResult = {
      polyline: decodePolyline5(route.geometry),
      distance_km: route.distance / 1000,
      duration_min: route.duration / 60,
      source: "osrm",
    };
    try {
      localStorage.setItem(key, JSON.stringify({ fetched_at: Date.now(), result }));
    } catch {
      /* noop */
    }
    return result;
  } catch (err: any) {
    // Straight-line fallback.
    return {
      polyline: [origin, destination],
      distance_km: haversineKm(origin, destination),
      duration_min: (haversineKm(origin, destination) / 100) * 60, // assume 100 km/h
      source: "straight",
      note: `OSRM unavailable (${err?.message ?? "unknown"}); using straight-line distance.`,
    };
  }
}
