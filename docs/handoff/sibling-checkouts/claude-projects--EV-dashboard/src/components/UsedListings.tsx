import type { Vehicle } from "../types";

// Build an AutoTrader.ca URL pre-filled with this vehicle's make/model.
// AutoTrader's URL scheme is a bit opaque; we use the search string route
// that's guaranteed to work even if the mkId/mdl params don't match.
import { brandById } from "../data";

function autoTraderUrl(v: Vehicle): string {
  const brand = brandById(v.brand_id);
  const q = encodeURIComponent(`${brand?.name ?? ""} ${v.model}`);
  return `https://www.autotrader.ca/cars/?srchtyp=advanced&prv=Ontario&prx=-1&kwd=${q}&rcp=15&rcs=0&srt=4&showcpo=ShowCpo&inMarket=advancedSearch`;
}

function kijijiUrl(v: Vehicle): string {
  const brand = brandById(v.brand_id);
  const q = encodeURIComponent(`${brand?.name ?? ""} ${v.model}`);
  return `https://www.kijiji.ca/b-cars-trucks/ontario/${q}/k0c174l9004`;
}

function evAutoUrl(v: Vehicle): string {
  // EV-specific marketplace, nicer UX for EV shopping.
  const brand = brandById(v.brand_id);
  const q = encodeURIComponent(`${brand?.name ?? ""} ${v.model}`);
  return `https://www.ev-database.org/cheatsheet/range-electric-car?search=${q}`;
}

export function UsedListings({ vehicles }: { vehicles: Vehicle[] }) {
  return (
    <div className="bg-ink-800 rounded-lg border border-ink-700 p-4 mb-6">
      <div className="flex items-baseline gap-4 mb-3 flex-wrap">
        <h3 className="font-display text-sm uppercase tracking-widest text-ink-300">
          Used market · live search
        </h3>
        <span className="text-xs text-ink-500">
          opens search results in a new tab · Ontario filter applied
        </span>
      </div>

      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${vehicles.length}, minmax(0, 1fr))` }}>
        {vehicles.map((v) => {
          const msrp = v.msrp_cad.value;
          // Rough used-value anchor: MSRP × 0.70 at 3 years old (industry avg for modern EVs).
          const usedAnchor = msrp ? Math.round(msrp * 0.70) : null;
          return (
            <div key={v.id} className="bg-ink-700/40 rounded p-3 text-xs">
              <div className="text-ink-200">{v.model}</div>
              <div className="text-ink-400">{v.trim_label}</div>
              {msrp != null && (
                <div className="text-ink-500 mt-1 font-mono">
                  New ${msrp.toLocaleString()}
                  {usedAnchor != null && (
                    <>
                      {" "}· 3-yr used ≈ ${usedAnchor.toLocaleString()}
                    </>
                  )}
                </div>
              )}
              <div className="mt-3 flex flex-col gap-1.5">
                <a
                  href={autoTraderUrl(v)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-accent-blue/80 text-white rounded px-2 py-1 text-center hover:bg-accent-blue"
                >
                  Search AutoTrader.ca
                </a>
                <a
                  href={kijijiUrl(v)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-ink-600 text-ink-100 rounded px-2 py-1 text-center hover:bg-ink-500"
                >
                  Search Kijiji
                </a>
                <a
                  href={evAutoUrl(v)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink-400 text-center hover:text-ink-200 underline"
                >
                  EV-Database specs
                </a>
              </div>
              <div className="text-[11px] text-ink-500 mt-2">
                Live sites — listings update hourly. Filter in-page for km, year, price.
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 text-[11px] text-ink-500">
        <strong className="text-ink-400">Ask Claude in chat</strong> if you want a deeper used-market scan —
        Exa can search multiple sources for you and summarize the top listings with price/km deltas against seed MSRP.
      </div>
    </div>
  );
}
