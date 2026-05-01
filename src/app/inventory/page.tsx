import { loadScoredUnits, loadMeta } from "@/lib/data";
import { dealerPressureMap } from "@/lib/aggregations";
import { InventoryTable } from "@/components/InventoryTable";
import { UpdatedStamp } from "@/components/UpdatedStamp";

export const dynamic = "force-static";

export default async function InventoryPage() {
  const [{ units, dealers, dealerById }, meta] = await Promise.all([
    loadScoredUnits(),
    loadMeta(),
  ]);
  const pressure = dealerPressureMap(units, dealers);

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
      />
    </div>
  );
}

