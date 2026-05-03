"use client";

import { useState } from "react";

const FEDERAL = {
  label: "Federal iZEV",
  amount: "$0",
  note: "program paused 2025",
  updated: "2025-01-15",
  source: "tc.canada.ca",
};

const PROVINCIAL_BEV: { province: string; amount: string; note?: string }[] = [
  { province: "Ontario", amount: "$0" },
  { province: "Quebec", amount: "$7,000" },
  { province: "British Columbia", amount: "$4,000", note: "income-tested ≤ $80k" },
  { province: "Alberta", amount: "$0" },
  { province: "Manitoba", amount: "$0" },
  { province: "Saskatchewan", amount: "$0" },
  { province: "Nova Scotia", amount: "$3,000" },
  { province: "New Brunswick", amount: "$5,000" },
  { province: "PEI", amount: "$5,000" },
  { province: "Newfoundland", amount: "$0" },
  { province: "Yukon / NT / NU", amount: "$5,000" },
];

export function IzevExplainer() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xxs text-fg-subtle hover:text-fg underline decoration-dotted underline-offset-2"
        title="View Canadian EV rebate status by province"
      >
        🇨🇦 rebates
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-bg-subtle border border-border rounded shadow-lg p-3 text-xxs z-20">
          {/* header */}
          <div className="flex items-start justify-between mb-2">
            <span className="font-semibold text-fg">Canadian EV Rebates</span>
            <button
              onClick={() => setOpen(false)}
              className="text-fg-subtle hover:text-fg leading-none ml-2"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* federal */}
          <div className="mb-2 pb-2 border-b border-border">
            <div className="flex items-baseline justify-between">
              <span className="text-fg-subtle">{FEDERAL.label}</span>
              <span className="font-medium text-fg">{FEDERAL.amount}</span>
            </div>
            <div className="text-fg-subtle mt-0.5">
              {FEDERAL.note} · updated {FEDERAL.updated}
            </div>
            <div className="text-fg-subtle">src: {FEDERAL.source}</div>
          </div>

          {/* provincial */}
          <div className="mb-1 text-fg-subtle font-medium">Provincial (BEV)</div>
          <table className="w-full border-collapse">
            <tbody>
              {PROVINCIAL_BEV.map(({ province, amount, note }) => (
                <tr key={province} className="border-b border-border last:border-0">
                  <td className="py-0.5 text-fg-subtle pr-2">{province}</td>
                  <td className="py-0.5 text-fg text-right font-medium">{amount}</td>
                  {note && (
                    <td className="py-0.5 text-fg-subtle pl-1 text-right">{note}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-2 text-fg-subtle">
            Amounts shown for BEV. PHEV rebates differ (e.g. BC PHEVs eligible; QC PHEVs eligible at lower tier). Info only — verify before purchase.
          </div>
        </div>
      )}
    </div>
  );
}
