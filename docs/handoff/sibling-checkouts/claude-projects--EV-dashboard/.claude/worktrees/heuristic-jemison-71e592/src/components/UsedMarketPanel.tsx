import { useState, useEffect } from "react";
import { brandById } from "../data";
import type { Vehicle } from "../types";

interface ExaResult {
  title: string;
  url: string;
  text?: string;
}

interface CachedResults {
  date: string; // YYYY-MM-DD
  results: ExaResult[];
  query: string;
}

interface VehicleUsedSearch {
  vehicleId: string;
  brand: string;
  model: string;
  yearStart: number;
  status: "idle" | "loading" | "ok" | "error" | "no-key";
  results: ExaResult[];
  query: string;
  error?: string;
}

const EXA_API_KEY = import.meta.env.VITE_EXA_API_KEY as string | undefined;
const CACHE_KEY = (vehicleId: string) => `ev-used-${vehicleId}`;
const TODAY = new Date().toISOString().slice(0, 10);

async function searchExa(query: string): Promise<ExaResult[]> {
  const resp = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": EXA_API_KEY!,
    },
    body: JSON.stringify({
      query,
      numResults: 5,
      useAutoprompt: true,
      type: "neural",
    }),
  });
  if (!resp.ok) throw new Error(`Exa API error: ${resp.status}`);
  const data = await resp.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.results ?? []).map((r: any) => ({
    title: r.title ?? r.url,
    url: r.url,
    text: r.text ?? r.snippet,
  }));
}

function loadCache(vehicleId: string): ExaResult[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY(vehicleId));
    if (!raw) return null;
    const cached: CachedResults = JSON.parse(raw);
    if (cached.date !== TODAY) return null; // expired
    return cached.results;
  } catch {
    return null;
  }
}

function saveCache(vehicleId: string, query: string, results: ExaResult[]) {
  try {
    localStorage.setItem(
      CACHE_KEY(vehicleId),
      JSON.stringify({ date: TODAY, results, query } satisfies CachedResults)
    );
  } catch {
    // localStorage quota — ignore silently
  }
}

interface UsedMarketPanelProps {
  vehicles: Vehicle[];
}

export function UsedMarketPanel({ vehicles }: UsedMarketPanelProps) {
  const [searches, setSearches] = useState<VehicleUsedSearch[]>([]);

  // Initialise search state on mount / when vehicles change
  useEffect(() => {
    const initial: VehicleUsedSearch[] = vehicles.map((v) => {
      const brand = brandById(v.brand_id)?.name ?? v.brand_id;
      if (!EXA_API_KEY) {
        return { vehicleId: v.id, brand, model: v.model, yearStart: v.year_start, status: "no-key", results: [], query: "" };
      }
      const cached = loadCache(v.id);
      if (cached) {
        const query = `${brand} ${v.model} ${v.year_start} used for sale Ontario Canada`;
        return { vehicleId: v.id, brand, model: v.model, yearStart: v.year_start, status: "ok", results: cached, query };
      }
      return { vehicleId: v.id, brand, model: v.model, yearStart: v.year_start, status: "idle", results: [], query: "" };
    });
    setSearches(initial);
  }, [vehicles]);

  // Kick off fetches for idle entries
  useEffect(() => {
    searches.forEach((s) => {
      if (s.status !== "idle") return;
      const query = `${s.brand} ${s.model} ${s.yearStart} used for sale Ontario Canada site:autotrader.ca OR site:kijiji.ca`;
      setSearches((prev) =>
        prev.map((x) => (x.vehicleId === s.vehicleId ? { ...x, status: "loading", query } : x))
      );
      searchExa(query)
        .then((results) => {
          saveCache(s.vehicleId, query, results);
          setSearches((prev) =>
            prev.map((x) => (x.vehicleId === s.vehicleId ? { ...x, status: "ok", results, query } : x))
          );
        })
        .catch((err: Error) => {
          setSearches((prev) =>
            prev.map((x) =>
              x.vehicleId === s.vehicleId ? { ...x, status: "error", error: err.message } : x
            )
          );
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searches.map((s) => `${s.vehicleId}:${s.status}`).join(",")]);

  if (searches.length === 0) return null;

  // No-key fallback (all entries will be no-key)
  if (searches[0]?.status === "no-key") {
    return (
      <div className="bg-ink-800 border border-ink-700 rounded-lg p-6 text-sm text-ink-400">
        <p className="mb-2 text-ink-300 font-medium">Used market search — no API key</p>
        <p>
          Add <code className="bg-ink-700 px-1 rounded text-ink-200">VITE_EXA_API_KEY=your_key</code> to{" "}
          <code className="bg-ink-700 px-1 rounded text-ink-200">.env.local</code> to enable live used-listing
          search via AutoTrader and Kijiji.
        </p>
        <p className="mt-2 text-ink-500 text-xs">See docs/external_keys.md for setup instructions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {searches.map((s) => (
        <div key={s.vehicleId} className="bg-ink-800 border border-ink-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-sm text-ink-100">
              {s.brand} {s.model}
            </h3>
            <span className="text-xs text-ink-500">Ontario · AutoTrader · Kijiji</span>
          </div>

          {s.status === "loading" && (
            <p className="text-xs text-ink-500">Searching…</p>
          )}
          {s.status === "error" && (
            <p className="text-xs text-accent-red">Search failed: {s.error}</p>
          )}
          {s.status === "ok" && s.results.length === 0 && (
            <p className="text-xs text-ink-500">No listings found.</p>
          )}
          {s.status === "ok" && s.results.length > 0 && (
            <ul className="space-y-2">
              {s.results.slice(0, 5).map((r, i) => (
                <li key={i} className="text-xs">
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-blue hover:underline line-clamp-1"
                    title={r.title}
                  >
                    {r.title}
                  </a>
                  {r.text && (
                    <p className="text-ink-500 mt-0.5 line-clamp-1">{r.text}</p>
                  )}
                </li>
              ))}
            </ul>
          )}

          {s.status === "ok" && (
            <p className="mt-3 text-[10px] text-ink-600">
              Cached {TODAY} · query: {s.query.slice(0, 60)}…
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
