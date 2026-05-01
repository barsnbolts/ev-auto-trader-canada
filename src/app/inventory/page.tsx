import { loadScoredUnits, loadMeta, loadSpecs, specMap, specKey } from "@/lib/data";
import { dealerPressureMap } from "@/lib/aggregations";
import { getBuyerProvince } from "@/lib/buyerProvinceServer";
import { InventoryTable } from "@/components/InventoryTable";
import { UpdatedStamp } from "@/components/UpdatedStamp";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const buyerProvince = await getBuyerProvince();
  const [{ units, dealers, dealerById }, meta, specs] = await Promise.all([
    loadScoredUnits(buyerProvince),
    loadMeta(),
    loadSpecs(),
  ]);
  const pressure = dealerPressureMap(units, dealers);
  const sm = specMap(specs);
  const rangeByUnitId: Record<string, number | null> = {};
  for (const u of units) {
    const s = sm.get(specKey(u.model, u.year, u.trim, u.drivetrain));
    rangeByUnitId[u.id] = s?.rangeKm ?? null;
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
      <InventoryTable
        units={units}
        dealerById={dealerById}
        dealerPressureByDealer={pressure}
        rangeByUnitId={rangeByUnitId}
      />
    </div>
  );
}

