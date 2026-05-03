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
  searchParams: Promise<{ tempC?: string }>;
}) {
  const sp = await searchParams;
  const rawTemp = sp.tempC != null ? Number(sp.tempC) : 20;
  const tempC = Number.isNaN(rawTemp) ? 20 : Math.max(-30, Math.min(40, rawTemp));

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
    rangeByUnitId[u.id] = s?.rangeKm ?? null;
    if (s) specByUnitId[u.id] = s;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
          <p className="text-sm text-fg-muted">
            Filter, sort, and rank every tracked unit. Defaults to the Greater Golden Horseshoe.
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
