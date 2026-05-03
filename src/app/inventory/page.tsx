import { loadScoredUnits, loadMeta, loadSpecs, specMap, specKey } from "@/lib/data";
import { dealerPressureMap } from "@/lib/aggregations";
import { getBuyerContext } from "@/lib/buyerContextServer";
import { InventoryTable } from "@/components/InventoryTable";
import { UpdatedStamp } from "@/components/UpdatedStamp";
import { TempSlider } from "@/components/TempSlider";
import type { Spec } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tempC?: string; make?: string; model?: string; trim?: string }>;
}) {
  const sp = await searchParams;
  const rawTemp = sp.tempC != null ? Number(sp.tempC) : 20;
  const tempC = Number.isNaN(rawTemp) ? 20 : Math.max(-30, Math.min(40, rawTemp));

  // Pre-filter hint from /pick-a-model "Buy this model" deep-link.
  // sp.make / sp.model / sp.trim are accepted query params; surfaced in the
  // heading so the user sees the active filter context even before the table
  // client-side filtering is wired to these params.
  const prefilterModel = sp.model ?? null;
  const prefilterTrim = sp.trim ?? null;

  const buyerContext = await getBuyerContext();
  const [{ units, dealers, dealerById }, meta, specs] = await Promise.all([
    loadScoredUnits(buyerContext),
    loadMeta(),
    loadSpecs(),
  ]);
  const pressure = dealerPressureMap(units, dealers);
  const sm = specMap(specs);
  const rangeByUnitId: Record<string, number | null> = {};
  const specByUnitId: Record<string, Spec> = {};
  for (const u of units) {
    const s = sm.get(specKey(u.model, u.year, u.trim, u.drivetrain));
    // Prefer cited EPA range when available (post-F1.5b: all 31 specs carry it),
    // fall back to legacy rangeKm field for any spec without an EPA citation.
    rangeByUnitId[u.id] = s?.rangeEpaKm?.value ?? s?.rangeKm ?? null;
    if (s) specByUnitId[u.id] = s;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
          <p className="text-sm text-fg-muted">
            Filter, sort, and rank every tracked unit. Defaults to the Greater Golden Horseshoe.
            {prefilterModel && (
              <span className="ml-2 chip chip-accent">
                {prefilterModel}{prefilterTrim ? ` · ${prefilterTrim}` : ""}
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
      <TempSlider initial={tempC} />
      <InventoryTable
        units={units}
        dealerById={dealerById}
        dealerPressureByDealer={pressure}
        rangeByUnitId={rangeByUnitId}
        specByUnitId={specByUnitId}
        tempC={tempC}
      />
    </div>
  );
}
