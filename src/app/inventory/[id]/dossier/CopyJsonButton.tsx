"use client";

// "Copy as JSON" button. Builds a self-contained snapshot of the unit +
// dealer + buyer context + computed OTD breakdown and writes it to the
// clipboard. Useful for sharing a deal with a friend / second opinion
// without losing any of the math.

import { useState } from "react";
import type { BuyerContext, Dealer, ScoredUnit, Spec } from "@/lib/types";

type Props = {
  unit: ScoredUnit;
  dealer: Dealer;
  spec: Spec | undefined;
  ctx: BuyerContext;
};

export function CopyJsonButton({ unit, dealer, spec, ctx }: Props) {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");

  async function copy() {
    const blob = {
      capturedAt: new Date().toISOString(),
      buyerContext: ctx,
      unit: {
        id: unit.id,
        model: unit.model,
        year: unit.year,
        trim: unit.trim,
        drivetrain: unit.drivetrain,
        msrpCad: unit.msrp,
        dealerAskingPriceCad: unit.dealerAskingPrice,
        otdCad: unit.otdCad,
        otdBreakdown: unit.otdBreakdown,
        dealScore: unit.dealScore,
        daysOnLot: unit.daysOnLot ?? null,
        vin: unit.vin ?? null,
        listingUrl: unit.listingUrl ?? null,
      },
      dealer: {
        id: dealer.id,
        name: dealer.name,
        brand: dealer.brand,
        city: dealer.city,
        province: dealer.province,
        phone: dealer.phone ?? null,
      },
      spec: spec
        ? {
            // Spec fields are CitedValue<T> shapes; surface raw value where present.
            batteryKwh: spec.batteryKwh ?? null,
            dcFastChargeKw: spec.dcFastChargeKw ?? null,
            hasHeatPump: spec.hasHeatPump ?? null,
            generationLabel: spec.generationLabel ?? null,
          }
        : null,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(blob, null, 2));
      setState("copied");
      setTimeout(() => setState("idle"), 1500);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2000);
    }
  }

  const label =
    state === "copied" ? "Copied!" : state === "error" ? "Copy failed" : "Copy as JSON";

  return (
    <button
      type="button"
      onClick={copy}
      className="text-xs px-3 py-1 border border-border rounded-md hover:bg-bg-subtle"
      title="Copy unit + dealer + OTD math to clipboard as JSON"
      aria-label="Copy dossier data as JSON"
    >
      {label}
    </button>
  );
}
