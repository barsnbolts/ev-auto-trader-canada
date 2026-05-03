import { loadSpecs } from "@/lib/data";
import { PickerClient } from "./PickerClient";

export const dynamic = "force-dynamic";

export default async function PickAModelPage() {
  const specs = await loadSpecs();

  return (
    <div className="space-y-2">
      <div className="px-4 py-4">
        <h1 className="text-2xl font-semibold tracking-tight">Pick a Model</h1>
        <p className="text-sm text-fg-muted mt-1">
          Browse every trim we track. Select up to 4 to compare specs, or jump straight to inventory for a model.
        </p>
      </div>
      <PickerClient specs={specs} />
    </div>
  );
}
