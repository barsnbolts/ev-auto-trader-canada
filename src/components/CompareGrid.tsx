"use client";

import { useMemo, useState } from "react";
import type { Dealer, Incentive, ScoredUnit, Spec } from "@/lib/types";
import { MODEL_LABEL } from "@/lib/constants";
import { fmtCad, fmtPercent } from "@/lib/format";
import { effectivePreTaxValue } from "@/lib/scoring";
import { DealScoreBadge } from "./DealScoreBadge";
import { StatusChip } from "./StatusChip";

type Props = {
  units: ScoredUnit[];
  dealerById: Map<string, Dealer>;
  specByKey?: Map<string, Spec>;
};

function specLookupKey(u: ScoredUnit): string {
  return `${u.model}|${u.year}|${u.trim}|${u.drivetrain}`;
}

export function CompareGrid({ units, dealerById, specByKey }: Props) {
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
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm uppercase tracking-wide text-fg-subtle">Pick 2–4 units to compare</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-fg-muted">{selected.length} selected</span>
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => setPicked([])}
                className="text-xxs text-fg-muted hover:text-fg underline"
              >
                Clear
              </button>
            )}
          </div>
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
        <CompareTable
          selected={selected}
          dealerById={dealerById}
          specByKey={specByKey}
          onRemove={(id) => setPicked((prev) => prev.filter((p) => p !== id))}
        />
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
  specByKey,
  onRemove,
}: {
  selected: ScoredUnit[];
  dealerById: Map<string, Dealer>;
  specByKey?: Map<string, Spec>;
  onRemove: (id: string) => void;
}) {
  const lookupSpec = (u: ScoredUnit): Spec | undefined =>
    specByKey?.get(specLookupKey(u));
  const numOrDash = (n?: number, suffix = "") =>
    n === undefined ? <span className="text-fg-subtle">—</span> : <span className="num">{n}{suffix}</span>;

  type Row = {
    label: string;
    render: (u: ScoredUnit, dealer?: Dealer) => React.ReactNode;
    rank?: { value: (u: ScoredUnit) => number | undefined; lowerIsBetter?: boolean };
  };

  const ROWS: Row[] = [
    { label: "Model", render: (u) => MODEL_LABEL[u.model] },
    { label: "Year", render: (u) => u.year },
    { label: "Trim", render: (u) => u.trim },
    { label: "Drivetrain", render: (u) => u.drivetrain },
    { label: "Exterior", render: (u) => u.exteriorColor },
    { label: "Interior", render: (u) => u.interiorColor },
    { label: "Status", render: (u) => <StatusChip status={u.status} /> },
    { label: "Days on lot", render: (u) => u.daysOnLot ?? "—" },
    { label: "Range (km)", render: (u) => numOrDash(lookupSpec(u)?.rangeKm), rank: { value: (u) => lookupSpec(u)?.rangeKm } },
    { label: "Battery (kWh)", render: (u) => numOrDash(lookupSpec(u)?.batteryKwh), rank: { value: (u) => lookupSpec(u)?.batteryKwh } },
    { label: "DC fast (kW)", render: (u) => numOrDash(lookupSpec(u)?.dcFastChargeKw), rank: { value: (u) => lookupSpec(u)?.dcFastChargeKw } },
    { label: "AC charge (kW)", render: (u) => numOrDash(lookupSpec(u)?.acChargeKw), rank: { value: (u) => lookupSpec(u)?.acChargeKw } },
    {
      label: "Power (kW / hp)",
      render: (u) => {
        const s = lookupSpec(u);
        if (!s?.motorKw && !s?.motorHp) return <span className="text-fg-subtle">—</span>;
        return <span className="num">{s.motorKw ?? "—"} / {s.motorHp ?? "—"}</span>;
      },
      rank: { value: (u) => lookupSpec(u)?.motorKw },
    },
    { label: "0–100 km/h (s)", render: (u) => numOrDash(lookupSpec(u)?.zeroToHundredSec), rank: { value: (u) => lookupSpec(u)?.zeroToHundredSec, lowerIsBetter: true } },
    { label: "Cargo (L)", render: (u) => numOrDash(lookupSpec(u)?.cargoLitres), rank: { value: (u) => lookupSpec(u)?.cargoLitres } },
    { label: "Curb weight (kg)", render: (u) => numOrDash(lookupSpec(u)?.weightKg), rank: { value: (u) => lookupSpec(u)?.weightKg, lowerIsBetter: true } },
    { label: "Seats", render: (u) => numOrDash(lookupSpec(u)?.seats) },
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
      rank: { value: (u) => u.dealerAskingPrice, lowerIsBetter: true },
    },
    {
      label: "Sales tax",
      render: (u) => <span className="num">{fmtCad(u.otdBreakdown.salesTax)}</span>,
    },
    {
      label: "OTD total",
      render: (u) => <span className="num font-semibold text-fg">{fmtCad(u.otdCad)}</span>,
      rank: { value: (u) => u.otdCad, lowerIsBetter: true },
    },
    {
      label: "EVAP eligible",
      render: (u) => {
        const eligible = u.applicableIncentives.some((i) => i.id.startsWith("fed-evap"));
        if (eligible) return <span className="chip-accent">$5,000 ✓</span>;
        const effective = effectivePreTaxValue(u, u.applicableIncentives);
        const over = Math.round(effective - 50000);
        if (over > 0 && over <= 1500) return <span className="chip-warn">+${over} cliff</span>;
        return <span className="text-fg-subtle text-xs">${over.toLocaleString("en-CA")} over cap</span>;
      },
      rank: { value: (u) => (u.applicableIncentives.some((i) => i.id.startsWith("fed-evap")) ? 1 : 0) },
    },
    {
      label: "Cash incentives",
      render: (u) => {
        const lines = u.otdBreakdown.incentivesApplied;
        if (lines.length === 0) return <span className="text-fg-subtle">none</span>;
        return (
          <div className="space-y-0.5">
            {lines.map((l) => (
              <div key={l.id} className="text-xs flex justify-between gap-2">
                <span className="text-fg-muted truncate" title={l.name}>{l.name}</span>
                <span className="num text-accent">−{fmtCad(l.amountCad)}</span>
              </div>
            ))}
            <div className="text-xs flex justify-between border-t border-border/50 pt-0.5 mt-0.5">
              <span className="text-fg-muted font-medium">Total off OTD</span>
              <span className="num font-medium text-accent">−{fmtCad(u.otdBreakdown.incentivesTotalCad)}</span>
            </div>
          </div>
        );
      },
      rank: { value: (u) => u.otdBreakdown.incentivesTotalCad },
    },
    {
      label: "Deal score",
      render: (u) => <DealScoreBadge score={u.dealScore} />,
      rank: { value: (u) => u.dealScore },
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
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      {MODEL_LABEL[u.model]}
                      <div className="text-fg-muted text-xxs normal-case font-normal">
                        {u.year} {u.trim}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(u.id)}
                      className="text-fg-subtle hover:text-fg text-base leading-none"
                      aria-label={`Remove ${MODEL_LABEL[u.model]} ${u.year} ${u.trim}`}
                      title="Remove from compare"
                    >
                      ×
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => {
              const winnerId = bestUnitId(row, selected);
              return (
              <tr key={row.label} className="border-t border-border">
                <td className="px-3 py-2 text-fg-muted whitespace-nowrap sticky left-0 bg-bg-elevated">
                  {row.label}
                </td>
                {selected.map((u) => (
                  <td
                    key={u.id}
                    className={`px-3 py-2 align-top ${u.id === winnerId ? "bg-accent-dim" : ""}`}
                  >
                    {row.render(u, dealerById.get(u.dealerId))}
                  </td>
                ))}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function bestUnitId(
  row: { rank?: { value: (u: ScoredUnit) => number | undefined; lowerIsBetter?: boolean } },
  selected: ScoredUnit[],
): string | null {
  if (!row.rank) return null;
  const scored = selected
    .map((u) => ({ id: u.id, v: row.rank!.value(u) }))
    .filter((x): x is { id: string; v: number } => typeof x.v === "number");
  if (scored.length === 0) return null;
  const best = row.rank.lowerIsBetter
    ? scored.reduce((a, b) => (b.v < a.v ? b : a))
    : scored.reduce((a, b) => (b.v > a.v ? b : a));
  // Don't highlight if all units tie — no signal.
  if (scored.every((s) => s.v === best.v)) return null;
  return best.id;
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
