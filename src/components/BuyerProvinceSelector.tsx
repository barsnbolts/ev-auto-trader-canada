"use client";

import { PROVINCES, PROVINCE_NAMES, type Province } from "@/lib/constants";
import { useBuyerProvince } from "@/lib/buyerProvince";

// Lives in the global nav so every page (home, inventory, compare, dealer)
// reflects the same buyer-province assumption. Selecting a different
// province re-issues the cookie + reloads — server components recompute
// OTD using the new tax basis + transport-cost line.
export function BuyerProvinceSelector() {
  const { buyerProvince, setBuyerProvince } = useBuyerProvince();
  return (
    <label className="flex items-center gap-1.5 text-xxs text-fg-subtle ml-auto">
      Buying in
      <select
        value={buyerProvince}
        onChange={(e) => setBuyerProvince(e.target.value as Province)}
        className="px-1.5 py-0.5 text-xs"
        title="OTD math uses this province's sales tax + adds a transport-cost line for cross-province dealers"
      >
        {PROVINCES.map((p) => (
          <option key={p} value={p}>
            {PROVINCE_NAMES[p]}
          </option>
        ))}
      </select>
    </label>
  );
}
