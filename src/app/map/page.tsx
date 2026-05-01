import { loadScoredUnits } from "@/lib/data";
import { dealerPressureMap } from "@/lib/aggregations";
import { DealerMapClient } from "@/components/DealerMapClient";

export const dynamic = "force-static";

export default async function MapPage() {
  const { units, dealers } = await loadScoredUnits();
  const pressure = dealerPressureMap(units, dealers);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Map</h1>
        <p className="text-sm text-fg-muted">
          Each dot is a dealer. Size = inventory depth. Color = pressure score. Click for unit list.
        </p>
      </div>
      <DealerMapClient dealers={dealers} units={units} pressureByDealer={pressure} />
    </div>
  );
}
