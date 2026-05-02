import { loadScoredUnits, loadSpecs, specMap } from "@/lib/data";
import { getBuyerContext } from "@/lib/buyerContextServer";
import { CompareGrid } from "@/components/CompareGrid";

export const dynamic = "force-dynamic";

export default async function ComparePage() {
  const buyerContext = await getBuyerContext();
  const [{ units, dealerById }, specs] = await Promise.all([
    loadScoredUnits(buyerContext),
    loadSpecs(),
  ]);
  const specByKey = specMap(specs);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Compare</h1>
        <p className="text-sm text-fg-muted">
          Pick 2–4 specific units to see their OTD math, deal score components, and incentive stacks side by side.
        </p>
      </div>
      <CompareGrid units={units} dealerById={dealerById} specByKey={specByKey} />
    </div>
  );
}
