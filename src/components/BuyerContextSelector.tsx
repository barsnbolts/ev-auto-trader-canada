"use client";

import { PROVINCES, PROVINCE_NAMES, type Province } from "@/lib/constants";
import { useBuyerContext } from "@/lib/buyerContext";

export function BuyerContextSelector() {
  const { buyerContext, setBuyerContext } = useBuyerContext();
  return (
    <div className="flex items-center gap-3 text-xxs text-fg-subtle ml-auto">
      <label className="flex items-center gap-1.5">
        Buying in
        <select
          value={buyerContext.province}
          onChange={(e) => setBuyerContext({ ...buyerContext, province: e.target.value as Province })}
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
      <label
        className="flex items-center gap-1 cursor-pointer"
        title="Eligible for Hyundai/Kia loyalty cash"
      >
        <input
          type="checkbox"
          checked={buyerContext.loyalty}
          onChange={(e) => setBuyerContext({ ...buyerContext, loyalty: e.target.checked })}
        />
        Owns Hyundai/Kia
      </label>
      <label
        className="flex items-center gap-1 cursor-pointer"
        title="Eligible for conquest cash (current owner of Toyota/Honda/Tesla/etc.)"
      >
        <input
          type="checkbox"
          checked={buyerContext.conquest}
          onChange={(e) => setBuyerContext({ ...buyerContext, conquest: e.target.checked })}
        />
        Owns competing
      </label>
    </div>
  );
}
