// Open Charge Map wrapper.
// https://openchargemap.org/site/develop/api
//
// Strategy:
// - If VITE_OCM_KEY is set, query /poi?boundingbox=... for DCFC stations
//   (LevelType >= 3) in the current map viewport.
// - Cache results in localStorage keyed by (bbox rounded + day), TTL 24 h.
// - Gracefully fall back to the hardcoded demo stations if the fetch fails
//   or no key is set.

import demoStations from "../data/dcfc_stations.json";

export interface Station {
  id: string;
  name: string;
  network: string;
  lat: number;
  lng: number;
  max_kw: number;
  stalls: number;
  status: string;
}

const DEMO: Station[] = (demoStations as { stations: Station[] }).stations;
const OCM_KEY = (import.meta as any).env?.VITE_OCM_KEY as string | undefined;
const CACHE_PREFIX = "ocm-cache-v1:";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function bboxKey(sw: [number, number], ne: [number, number]): string {
  // Round to 0.5° grid so nearby pans share a cache bucket.
  const round = (n: number) => (Math.round(n * 2) / 2).toFixed(1);
  const day = new Date().toISOString().slice(0, 10);
  return `${CACHE_PREFIX}${round(sw[0])},${round(sw[1])}:${round(ne[0])},${round(ne[1])}:${day}`;
}

function fromCache(key: string): Station[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.fetched_at == null) return null;
    if (Date.now() - parsed.fetched_at > CACHE_TTL_MS) return null;
    return parsed.stations as Station[];
  } catch {
    return null;
  }
}

function toCache(key: string, stations: Station[]): void {
  try {
    localStorage.setItem(key, JSON.stringify({ fetched_at: Date.now(), stations }));
  } catch {
    /* quota exceeded — silently skip */
  }
}

function mapOcmEntry(p: any): Station | null {
  const addr = p.AddressInfo ?? {};
  const conn = Array.isArray(p.Connections) ? p.Connections : [];
  if (!addr.Latitude || !addr.Longitude) return null;
  // Filter to DCFC only: LevelID 3 means "Level 3 (Fast)".
  const hasDcfc = conn.some((c: any) => c?.Level?.IsFastChargeCapable === true || c?.LevelID === 3);
  if (!hasDcfc) return null;
  const maxKw = conn.reduce((acc: number, c: any) => Math.max(acc, c?.PowerKW ?? 0), 0);
  if (maxKw < 30) return null; // exclude slow (< 30 kW) from DCFC view
  return {
    id: String(p.ID ?? addr.ID ?? `${addr.Latitude},${addr.Longitude}`),
    name: addr.Title ?? "Unnamed station",
    network: p.OperatorInfo?.Title ?? "Unknown",
    lat: addr.Latitude,
    lng: addr.Longitude,
    max_kw: Math.round(maxKw),
    stalls: p.NumberOfPoints ?? conn.length,
    status: p.StatusType?.IsOperational === false ? "offline" : "available",
  };
}

export async function fetchStations(
  sw: [number, number],
  ne: [number, number],
): Promise<{ stations: Station[]; source: "ocm" | "demo"; note?: string }> {
  if (!OCM_KEY) {
    return {
      stations: DEMO,
      source: "demo",
      note: "No VITE_OCM_KEY in .env.local — showing 15 hardcoded Ontario DCFC stations.",
    };
  }
  const key = bboxKey(sw, ne);
  const cached = fromCache(key);
  if (cached) {
    return { stations: cached, source: "ocm", note: "cache hit" };
  }
  try {
    const boundingbox = `(${sw[0]},${sw[1]}),(${ne[0]},${ne[1]})`;
    const url =
      `https://api.openchargemap.io/v3/poi?` +
      `output=json&maxresults=150&compact=true&verbose=false&levelid=3&` +
      `boundingbox=${encodeURIComponent(boundingbox)}&key=${encodeURIComponent(OCM_KEY)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OCM returned ${res.status}`);
    const arr = await res.json();
    const stations = Array.isArray(arr)
      ? arr.map(mapOcmEntry).filter((s): s is Station => !!s)
      : [];
    if (stations.length === 0) {
      return { stations: DEMO, source: "demo", note: "OCM returned no stations in bbox; demo fallback." };
    }
    toCache(key, stations);
    return { stations, source: "ocm" };
  } catch (err: any) {
    return {
      stations: DEMO,
      source: "demo",
      note: `OCM fetch failed (${err?.message ?? "unknown"}); demo fallback.`,
    };
  }
}
