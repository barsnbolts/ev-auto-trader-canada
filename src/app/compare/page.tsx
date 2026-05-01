import { loadScoredUnits } from "@/lib/data";
import { CompareGrid } from "@/components/CompareGrid";

export const dynamic = "force-static";

export default async function ComparePage() {
  const { units, dealerById } = await loadScoredUnits();
  // Pass a serialized map across the boundary.
  const dealerByIdMap = new Map(dealerById);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Compare</h1>
        <p className="text-sm text-fg-muted">
          Pick 2–4 specific units to see their OTD math, deal score components, and incentive stacks side by side.
        </p>
      </div>
      <CompareGrid units={units} dealerById={dealerByIdMap} />
    </div>
  );
}
