"use client";

import { useEffect, useState } from "react";
import { loadScoredUnits, loadSpecs, specMap } from "@/lib/dataClient";
import { useBuyerContext } from "@/lib/buyerContext";
import { CompareGrid } from "@/components/CompareGrid";
import { fmtCad } from "@/lib/format";
import { MODEL_LABEL } from "@/lib/constants";
import type { ScoredUnit } from "@/lib/types";
import { plainLang } from "@/lib/plainLang";

type PageData = {
  scored: Awaited<ReturnType<typeof loadScoredUnits>>;
  specs: Awaited<ReturnType<typeof loadSpecs>>;
};

export default function ComparePage() {
  const { buyerContext } = useBuyerContext();
  const [data, setData] = useState<PageData | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadScoredUnits(buyerContext), loadSpecs()]).then(([scored, specs]) => {
      if (!cancelled) setData({ scored, specs });
    });
    return () => {
      cancelled = true;
    };
  }, [buyerContext]);

  if (!data) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-12 bg-bg-subtle rounded w-2/3" />
        <div className="h-96 bg-bg-subtle rounded" />
      </div>
    );
  }

  const { units, dealerById } = data.scored;
  const specByKey = specMap(data.specs);
  const unitsWithPaths = units.filter((u) => u.otdPaths?.finance || u.otdPaths?.lease);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Compare</h1>
        <p className="text-sm text-fg-muted">
          Pick 2–4 specific units to see their OTD math, deal score components, and incentive stacks side by side.
        </p>
      </div>
      <CompareGrid units={units} dealerById={dealerById} specByKey={specByKey} />
      {unitsWithPaths.length > 0 && (
        <PaymentMatrix units={unitsWithPaths} dealerById={dealerById} />
      )}
    </div>
  );
}

function PaymentMatrix({ units, dealerById }: { units: ScoredUnit[]; dealerById: Map<string, import("@/lib/types").Dealer> }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm uppercase tracking-wide text-fg-subtle">3-Path Payment Matrix</h2>
        <p className="text-xs text-fg-muted mt-0.5">Units with active finance or lease promos. Cash = full OTD. Finance/Lease = monthly (incl. tax where applicable).</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-bg-subtle text-xxs uppercase text-fg-subtle">
            <tr>
              <th className="px-3 py-2 text-left">Unit</th>
              <th className="px-3 py-2 text-right"><span title={plainLang("cash")} className="cursor-help underline decoration-dotted underline-offset-2">Cash</span> <span title={plainLang("OTD")} className="cursor-help underline decoration-dotted underline-offset-2">OTD</span></th>
              <th className="px-3 py-2 text-right"><span title={plainLang("finance")} className="cursor-help underline decoration-dotted underline-offset-2">Finance</span> /mo</th>
              <th className="px-3 py-2 text-right"><span title={plainLang("lease")} className="cursor-help underline decoration-dotted underline-offset-2">Lease</span> /mo (+ tax)</th>
              <th className="px-3 py-2 text-left">Dealer</th>
            </tr>
          </thead>
          <tbody>
            {units.map((u) => {
              const dealer = dealerById.get(u.dealerId);
              const fp = u.otdPaths?.finance;
              const lp = u.otdPaths?.lease;
              return (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <div className="font-medium">{MODEL_LABEL[u.model]}</div>
                    <div className="text-xxs text-fg-muted">{u.year} · {u.trim} · {u.drivetrain}</div>
                  </td>
                  <td className="px-3 py-2 text-right num">{fmtCad(u.otdCad)}</td>
                  <td className="px-3 py-2 text-right num">
                    {fp ? (
                      <span title={`${fp.termMonths} mo @ ${fp.aprPercent}% APR`}>
                        {fmtCad(Math.round(fp.monthlyPaymentCad))}/mo
                      </span>
                    ) : (
                      <span className="text-fg-subtle text-xxs">no promo</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right num">
                    {lp ? (
                      <span title={`${lp.termMonths} mo, residual ${lp.residualPercent}%`}>
                        {fmtCad(Math.round(lp.monthlyPaymentWithTaxCad))}/mo
                      </span>
                    ) : (
                      <span className="text-fg-subtle text-xxs">no promo</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-fg-muted">
                    {dealer ? `${dealer.name} · ${dealer.city}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
