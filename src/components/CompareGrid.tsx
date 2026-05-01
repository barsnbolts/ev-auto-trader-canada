"use client";

import { useMemo, useState } from "react";
import type { Dealer, Incentive, ScoredUnit } from "@/lib/types";
import { MODEL_LABEL } from "@/lib/constants";
import { fmtCad, fmtPercent } from "@/lib/format";
import { DealScoreBadge } from "./DealScoreBadge";
import { StatusChip } from "./StatusChip";

type Props = {
  units: ScoredUnit[];
  dealerById: Map<string, Dealer>;
};

export function CompareGrid({ units, dealerById }: Props) {
  const [picked, setPicked] = useState<string[]>([]);

  const togglePick = (id: string) => {
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  };

  const selected = useMemo(
    () => picked.map((id) => units.find((u) => u.id === id)).filter(Boolean) as ScoredUnit[],
    [picked, units],
  );

  return (
    <div className="space-y-6">
      <div className="card p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm uppercase tracking-wide text-fg-subtle">Pick 2–4 units to compare</h2>
          <span className="text-xs text-fg-muted">{selected.length} selected</span>
        </div>
        <div className="mt-3 max-h-72 overflow-y-auto divide-y divide-border">
          {units.map((u) => {
            const d = dealerById.get(u.dealerId);
            const checked = picked.includes(u.id);
            const disabled = !checked && picked.length >= 4;
            return (
              <label
                key={u.id}
                className={`flex items-center gap-3 py-2 px-1 text-sm cursor-pointer ${disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-bg-hover"}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => togglePick(u.id)}
                />
                <DealScoreBadge score={u.dealScore} />
                <span className="font-medium">{MODEL_LABEL[u.model]}</span>
                <span className="text-fg-muted">{u.year} {u.trim} {u.drivetrain}</span>
                <span className="ml-auto num text-fg-muted">{fmtCad(u.otdCad)}</span>
                <span className="text-xxs text-fg-subtle w-44 truncate">{d?.name} · {d?.city}</span>
              </label>
            );
          })}
        </div>
      </div>

      {selected.length >= 2 && (
        <CompareTable selected={selected} dealerById={dealerById} />
      )}

      {selected.length === 1 && (
        <div className="card p-6 text-center text-fg-muted">
          Pick one more unit to compare.
        </div>
      )}
      {selected.length === 0 && (
        <div className="card p-6 text-center text-fg-muted">
          Select 2–4 units above to see a side-by-side breakdown.
        </div>
      )}
    </div>
  );
}

function CompareTable({
  selected,
  dealerById,
}: {
  selected: ScoredUnit[];
  dealerById: Map<string, Dealer>;
}) {
  const ROWS: { label: string; render: (u: ScoredUnit, dealer?: Dealer) => React.ReactNode }[] = [
    { label: "Model", render: (u) => MODEL_LABEL[u.model] },
    { label: "Year", render: (u) => u.year },
    { label: "Trim", render: (u) => u.trim },
    { label: "Drivetrain", render: (u) => u.drivetrain },
    { label: "Exterior", render: (u) => u.exteriorColor },
    { label: "Interior", render: (u) => u.interiorColor },
    { label: "Status", render: (u) => <StatusChip status={u.status} /> },
    { label: "Days on lot", render: (u) => u.daysOnLot ?? "—" },
    { label: "MSRP", render: (u) => <span className="num">{fmtCad(u.msrp)}</span> },
    { label: "Freight + PDI", render: (u) => <span className="num">{fmtCad(u.freightPdi)}</span> },
    {
      label: "Asking",
      render: (u) => (
        <span className="num">
          {fmtCad(u.dealerAskingPrice)}
          {u.dealerAskingPrice < u.msrp && (
            <span className="ml-1 text-xxs text-accent">−{fmtCad(u.msrp - u.dealerAskingPrice)}</span>
          )}
        </span>
      ),
    },
    {
      label: "Sales tax",
      render: (u) => <span className="num">{fmtCad(u.otdBreakdown.salesTax)}</span>,
    },
    {
      label: "OTD total",
      render: (u) => <span className="num font-semibold text-fg">{fmtCad(u.otdCad)}</span>,
    },
    {
      label: "Deal score",
      render: (u) => <DealScoreBadge score={u.dealScore} />,
    },
    {
      label: "  Price vs MSRP",
      render: (u) => <span className="num text-fg-muted">{u.dealScoreBreakdown.priceVsMsrp}</span>,
    },
    {
      label: "  Days score",
      render: (u) => <span className="num text-fg-muted">{u.dealScoreBreakdown.daysOnLot}</span>,
    },
    {
      label: "  Dealer pressure",
      render: (u) => <span className="num text-fg-muted">{u.dealScoreBreakdown.dealerPressure}</span>,
    },
    {
      label: "  Incentive stack",
      render: (u) => <span className="num text-fg-muted">{u.dealScoreBreakdown.incentiveStack}</span>,
    },
    {
      label: "Active incentives",
      render: (u) => incentivesSummary(u.applicableIncentives),
    },
    {
      label: "Dealer",
      render: (_u, d) =>
        d ? (
          <span>
            <span className="font-medium">{d.name}</span>
            <span className="block text-xxs text-fg-subtle">{d.city}, {d.province}{d.phone ? ` · ${d.phone}` : ""}</span>
          </span>
        ) : "—",
    },
  ];

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm uppercase tracking-wide text-fg-subtle">Side-by-side</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-bg-subtle text-xxs uppercase text-fg-subtle">
            <tr>
              <th className="px-3 py-2 sticky left-0 bg-bg-subtle">Field</th>
              {selected.map((u) => (
                <th key={u.id} className="px-3 py-2 min-w-[180px]">
                  {MODEL_LABEL[u.model]}
                  <div className="text-fg-muted text-xxs normal-case font-normal">
                    {u.year} {u.trim}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.label} className="border-t border-border">
                <td className="px-3 py-2 text-fg-muted whitespace-nowrap sticky left-0 bg-bg-elevated">
                  {row.label}
                </td>
                {selected.map((u) => (
                  <td key={u.id} className="px-3 py-2 align-top">
                    {row.render(u, dealerById.get(u.dealerId))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function incentivesSummary(incs: Incentive[]) {
  if (incs.length === 0) return <span className="text-fg-subtle">none</span>;
  return (
    <ul className="space-y-0.5">
      {incs.map((i) => (
        <li key={i.id} className="text-xs">
          <span className={i.status === "paused" ? "text-warn" : "text-fg"}>
            {i.name}
          </span>
          {i.amountCad ? <span className="num text-fg-muted ml-1">· {fmtCad(i.amountCad)}</span> : null}
          {i.aprPercent ? <span className="num text-fg-muted ml-1">· {fmtPercent(i.aprPercent)}/{i.termMonths}mo</span> : null}
        </li>
      ))}
    </ul>
  );
}
