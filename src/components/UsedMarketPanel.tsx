"use client";

import { useState } from "react";
import type { UsedMarketStat } from "@/lib/types";
import { MODEL_LABEL } from "@/lib/constants";
import { fmtCad } from "@/lib/format";

type Props = {
  statsLongRange: UsedMarketStat[];
  statsAllTrims: UsedMarketStat[];
  totalUsedCount: number;
};

export function UsedMarketPanel({ statsLongRange, statsAllTrims, totalUsedCount }: Props) {
  const [includeHalo, setIncludeHalo] = useState(false);
  const stats = includeHalo ? statsAllTrims : statsLongRange;

  return (
    <section className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm uppercase tracking-wide text-fg-subtle">Used-market negotiation leverage</h2>
          <p className="text-xxs text-fg-subtle mt-1">
            2023-2024 listings · {totalUsedCount} units · AutoTrader 2026-05-01
          </p>
        </div>
        <label className="flex items-center gap-1.5 text-xxs text-fg-muted cursor-pointer">
          <input
            type="checkbox"
            checked={includeHalo}
            onChange={(e) => setIncludeHalo(e.target.checked)}
          />
          Include GT / N / Performance trims in MSRP floor
        </label>
      </div>
      <table className="w-full">
        <thead className="bg-bg-subtle text-xxs uppercase text-fg-subtle">
          <tr>
            <th className="px-3 py-2 text-left">Model</th>
            <th className="px-3 py-2 text-right">Used count</th>
            <th className="px-3 py-2 text-right">Used median</th>
            <th className="px-3 py-2 text-right">Used range</th>
            <th className="px-3 py-2 text-right">Median km</th>
            <th className="px-3 py-2 text-right">New MSRP floor</th>
            <th className="px-3 py-2 text-right">Retention</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => (
            <tr key={s.model} className="border-t border-border">
              <td className="px-3 py-2">{MODEL_LABEL[s.model]}</td>
              <td className="px-3 py-2 text-right num">{s.count}</td>
              <td className="px-3 py-2 text-right num font-medium">{fmtCad(s.medianPriceCad)}</td>
              <td className="px-3 py-2 text-right num text-fg-subtle">
                {fmtCad(s.minPriceCad)} – {fmtCad(s.maxPriceCad)}
              </td>
              <td className="px-3 py-2 text-right num text-fg-subtle">{s.medianKm.toLocaleString()}</td>
              <td className="px-3 py-2 text-right num text-fg-subtle">
                {s.newMsrpFloorCad ? fmtCad(s.newMsrpFloorCad) : "—"}
              </td>
              <td
                className={`px-3 py-2 text-right num font-medium ${
                  s.retentionPercent != null && s.retentionPercent < 70 ? "text-bad" : ""
                }`}
              >
                {s.retentionPercent != null ? `${s.retentionPercent}%` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-4 py-3 text-xxs text-fg-subtle border-t border-border">
        Retention = used median ÷ lowest new MSRP. Lower = steeper depreciation = stronger lever
        when arguing a new-car discount. Default excludes GT / N / Performance halo trims because
        their $15-25k premium over the long-range floor distorts the number against typical
        long-range shoppers; toggle on to see them included.
      </p>
    </section>
  );
}
