import { loadScoredUnits } from "@/lib/data";
import { dealerPressureMap } from "@/lib/aggregations";
import { InventoryTable } from "@/components/InventoryTable";

export const dynamic = "force-static";

export default async function InventoryPage() {
  const { units, dealers, dealerById } = await loadScoredUnits();
  const pressure = dealerPressureMap(units, dealers);

  // Convert Map -> plain object so it can be passed across the server/client boundary.
  const dealerByIdObj = Object.fromEntries(dealerById);
  const dealerByIdMap = new Map(Object.entries(dealerByIdObj));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
        <p className="text-sm text-fg-muted">
          Filter, sort, and rank every tracked unit. Defaults to the Greater Golden Horseshoe.
        </p>
      </div>
      <InventoryTable
        units={units}
        dealerById={dealerByIdMap}
        dealerPressureByDealer={pressure}
      />
    </div>
  );
}
