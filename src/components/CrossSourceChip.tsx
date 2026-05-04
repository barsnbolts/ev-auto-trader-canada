"use client";

// Phase D UI: surfaces cross-source pricing intelligence as a chip
// next to a unit (inventory row + dossier header).
//
// Three states:
//   1. Cheaper on Kijiji  → green chip "−$X on Kijiji"
//   2. Lease takeover     → blue chip "$Y/mo · Z mo left on Leasebusters"
//   3. No cross-source data → render null (silence is golden)

import { fmtCad } from "@/lib/format";
import { cheapestCash, leaseTakeover, lookupCrossSource } from "@/lib/crossListings";

type Props = {
  vin?: string | null;
  year: number;
  make: string;
  model: string;
  trim?: string | null;
  km?: number | null;
  thisPriceCad: number;
};

export function CrossSourceChip({ vin, year, make, model, trim, km, thisPriceCad }: Props) {
  const entry = lookupCrossSource({ vin, year, make, model, trim, km });
  if (!entry) return null;

  const cheapest = cheapestCash(entry);
  const lease = leaseTakeover(entry);

  // Same listing as ours (same source/stockId match) → don't surface as "cheaper elsewhere"
  const meaningfulCash =
    cheapest && cheapest.priceCad != null && cheapest.priceCad < thisPriceCad - 100;

  if (!meaningfulCash && !lease) return null;

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {meaningfulCash && cheapest && (
        <a
          href={cheapest.url}
          target="_blank"
          rel="noreferrer"
          className="inline-block chip-accent text-xxs"
          title={`${cheapest.source} · ${cheapest.dealerName ?? "—"}`}
        >
          −{fmtCad(thisPriceCad - cheapest.priceCad!)} on {sourceLabel(cheapest.source)}
        </a>
      )}
      {lease && lease.monthlyPaymentCad != null && (
        <a
          href={lease.url}
          target="_blank"
          rel="noreferrer"
          className="inline-block chip-accent text-xxs"
          title={`${lease.cashIncentiveCad ? `Cash incentive ${fmtCad(lease.cashIncentiveCad)} · ` : ""}${lease.dealerName ?? "Leasebusters"}`}
        >
          {fmtCad(lease.monthlyPaymentCad)}/mo · {lease.monthsRemaining ?? "?"} mo left
        </a>
      )}
    </span>
  );
}

function sourceLabel(s: string): string {
  switch (s) {
    case "kijiji_autos":
      return "Kijiji";
    case "leasebusters":
      return "Leasebusters";
    case "hyundai_dealer":
      return "Hyundai dealer";
    case "kia_dealer":
      return "Kia dealer";
    case "autotrader":
      return "AutoTrader";
    default:
      return s;
  }
}
