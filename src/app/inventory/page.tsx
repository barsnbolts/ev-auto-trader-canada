"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { loadScoredUnits, loadMeta, loadSpecs, specMap, specKey } from "@/lib/dataClient";
import { useBuyerContext } from "@/lib/buyerContext";
import { dealerPressureMap } from "@/lib/aggregations";
import { InventoryTable } from "@/components/InventoryTable";
import { UpdatedStamp } from "@/components/UpdatedStamp";
import { TempSlider } from "@/components/TempSlider";
import { TempProvider } from "@/lib/tempContext";
import type { Spec } from "@/lib/types";

type PageData = {
  scored: Awaited<ReturnType<typeof loadScoredUnits>>;
  meta: Awaited<ReturnType<typeof loadMeta>>;
  specs: Awaited<ReturnType<typeof loadSpecs>>;
};

function InventoryInner() {
  const sp = useSearchParams();
  const rawTemp = sp.get("tempC") != null ? Number(sp.get("tempC")) : 20;
  const tempC = Number.isNaN(rawTemp) ? 20 : Math.max(-40, Math.min(40, rawTemp));
  const preconditioned = sp.get("precon") === "1";
  const prefilterModel = sp.get("model");
  const prefilterTrim = sp.get("trim");

  const { buyerContext } = useBuyerContext();
  const [data, setData] = useState<PageData | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadScoredUnits(buyerContext), loadMeta(), loadSpecs()]).then(
      ([scored, meta, specs]) => {
        if (!cancelled) setData({ scored, meta, specs });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [buyerContext]);

  if (!data) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-12 bg-bg-subtle rounded w-2/3" />
        <div className="h-12 bg-bg-subtle rounded" />
        <div className="h-96 bg-bg-subtle rounded" />
      </div>
    );
  }

  const { units, dealers, dealerById } = data.scored;
  const { meta, specs } = data;
  const pressure = dealerPressureMap(units, dealers);
  const sm = specMap(specs);
  const rangeByUnitId: Record<string, number | null> = {};
  const specByUnitId: Record<string, Spec> = {};
  for (const u of units) {
    const s = sm.get(specKey(u.model, u.year, u.trim, u.drivetrain));
    rangeByUnitId[u.id] = s?.rangeEpaKm?.value ?? s?.rangeKm ?? null;
    if (s) specByUnitId[u.id] = s;
  }

  return (
    <TempProvider initialTempC={tempC} initialPreconditioned={preconditioned}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
            <p className="text-sm text-fg-muted">
              Filter, sort, and rank every tracked unit. Defaults to all of Canada.
              {prefilterModel && (
                <span className="ml-2 chip chip-accent">
                  {prefilterModel}
                  {prefilterTrim ? ` · ${prefilterTrim}` : ""}
                </span>
              )}
            </p>
          </div>
          <UpdatedStamp
            rows={[
              { label: "Units updated", iso: meta.unitsUpdatedAt },
              { label: "Dealers updated", iso: meta.dealersUpdatedAt },
            ]}
          />
        </div>
        <TempSlider />
        <InventoryTable
          units={units}
          dealerById={dealerById}
          dealerPressureByDealer={pressure}
          rangeByUnitId={rangeByUnitId}
          specByUnitId={specByUnitId}
        />
      </div>
    </TempProvider>
  );
}

export default function InventoryPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 animate-pulse">
          <div className="h-12 bg-bg-subtle rounded w-2/3" />
          <div className="h-12 bg-bg-subtle rounded" />
          <div className="h-96 bg-bg-subtle rounded" />
        </div>
      }
    >
      <InventoryInner />
    </Suspense>
  );
}
