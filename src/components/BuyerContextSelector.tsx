"use client";

import { PROVINCES, PROVINCE_NAMES, type Province } from "@/lib/constants";
import { useBuyerContext } from "@/lib/buyerContext";
import { plainLang } from "@/lib/plainLang";

export function BuyerContextSelector() {
  const { buyerContext, setBuyerContext } = useBuyerContext();
  return (
    <div className="flex items-center gap-3 text-xxs text-fg-subtle ml-auto">
      <label className="flex items-center gap-1.5">
        <span title={plainLang("buyerContext")} className="cursor-help underline decoration-dotted underline-offset-2">Buying in</span>
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
        title={plainLang("loyalty")}
      >
        <input
          type="checkbox"
          checked={buyerContext.loyalty}
          onChange={(e) => setBuyerContext({ ...buyerContext, loyalty: e.target.checked })}
        />
        <span title={plainLang("loyalty")} className="cursor-help underline decoration-dotted underline-offset-2">Owns Hyundai/Kia</span>
      </label>
      <label
        className="flex items-center gap-1 cursor-pointer"
        title={plainLang("conquest")}
      >
        <input
          type="checkbox"
          checked={buyerContext.conquest}
          onChange={(e) => setBuyerContext({ ...buyerContext, conquest: e.target.checked })}
        />
        <span title={plainLang("conquest")} className="cursor-help underline decoration-dotted underline-offset-2">Owns competing</span>
      </label>
    </div>
  );
}
