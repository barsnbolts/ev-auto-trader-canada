"use client";

import { useEffect, useState } from "react";
import type { Dealer, ScoredUnit } from "@/lib/types";
import { MODEL_LABEL } from "@/lib/constants";
import { fmtCad } from "@/lib/format";
import { StatusChip } from "./StatusChip";
import { DealScoreBadge } from "./DealScoreBadge";

type Props = {
  unit: ScoredUnit | null;
  dealer: Dealer | undefined;
  pressure: number;
  comparable: ScoredUnit | undefined;
  comparableDealer: Dealer | undefined;
  onClose: () => void;
  onNavigate?: (direction: -1 | 1) => void;
  position?: { index: number; total: number };
};

export function UnitDrawer({ unit, dealer, pressure, comparable, comparableDealer, onClose, onNavigate, position }: Props) {
  useEffect(() => {
    if (!unit) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && onNavigate) onNavigate(-1);
      else if (e.key === "ArrowRight" && onNavigate) onNavigate(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [unit, onClose, onNavigate]);

  if (!unit) return null;

  const draft = buildEmailDraft(unit, dealer, pressure, comparable, comparableDealer);

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 z-40"
        onClick={onClose}
        aria-hidden
      />
      <aside
        className="fixed inset-y-0 right-0 w-[520px] max-w-full bg-bg-elevated border-l border-border z-50 overflow-y-auto"
        role="dialog"
        aria-modal="true"
      >
        <header className="px-5 py-4 border-b border-border flex items-start justify-between gap-3 sticky top-0 bg-bg-elevated">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold">{MODEL_LABEL[unit.model]}</h2>
              <DealScoreBadge score={unit.dealScore} />
              <StatusChip status={unit.status} />
            </div>
            <div className="text-xs text-fg-muted mt-1">
              {unit.year} · {unit.trim} · {unit.drivetrain} · {unit.exteriorColor} / {unit.interiorColor}
            </div>
            {unit.vin && (
              <div className="text-xxs text-fg-subtle font-mono mt-0.5">VIN {unit.vin}</div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {onNavigate && position && position.total > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => onNavigate(-1)}
                  className="text-fg-muted hover:text-fg px-2 py-1"
                  aria-label="Previous unit"
                  title="Previous (←)"
                >
                  ‹
                </button>
                <span className="text-xxs text-fg-subtle num">
                  {position.index + 1} / {position.total}
                </span>
                <button
                  type="button"
                  onClick={() => onNavigate(1)}
                  className="text-fg-muted hover:text-fg px-2 py-1"
                  aria-label="Next unit"
                  title="Next (→)"
                >
                  ›
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-fg-muted hover:text-fg text-xl leading-none px-2"
              aria-label="Close (Esc)"
            >
              ×
            </button>
          </div>
        </header>

        <section className="px-5 py-4 border-b border-border">
          <h3 className="text-xxs uppercase tracking-wide text-fg-subtle mb-2">Out-the-door breakdown</h3>
          <dl className="text-sm space-y-1">
            <Row label="MSRP" value={unit.otdBreakdown.msrp} />
            <Row label="Freight + PDI" value={unit.otdBreakdown.freightPdi} />
            <Row
              label={unit.otdBreakdown.dealerAdjustment < 0 ? "Dealer discount" : "Dealer adjustment"}
              value={unit.otdBreakdown.dealerAdjustment}
              accentNegative
            />
            <Row label="A/C excise tax" value={unit.otdBreakdown.acExciseTax} />
            <Row label="RDPRM" value={unit.otdBreakdown.rdprm} />
            <Row label="OMVIC" value={unit.otdBreakdown.omvic} />
            <Row label="Tire stewardship" value={unit.otdBreakdown.tireStewardship} />
            <Row label="Gov licensing" value={unit.otdBreakdown.govLicensing} />
            <Row label="Sales tax" value={unit.otdBreakdown.salesTax} />
            <div className="border-t border-border pt-2 mt-2 flex justify-between">
              <dt className="font-semibold">OTD total</dt>
              <dd className="num font-semibold">{fmtCad(unit.otdBreakdown.total)}</dd>
            </div>
          </dl>
        </section>

        <section className="px-5 py-4 border-b border-border">
          <h3 className="text-xxs uppercase tracking-wide text-fg-subtle mb-2">
            Applicable incentives ({unit.applicableIncentives.length})
          </h3>
          {unit.applicableIncentives.length === 0 ? (
            <p className="text-sm text-fg-subtle">No incentives match this unit.</p>
          ) : (
            <ul className="space-y-2">
              {unit.applicableIncentives.map((inc) => (
                <li key={inc.id} className="text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={inc.status === "paused" ? "text-warn" : "text-fg"}>{inc.name}</span>
                    {inc.amountCad ? (
                      <span className="num text-fg-muted">{fmtCad(inc.amountCad)}</span>
                    ) : null}
                  </div>
                  {inc.notes && (
                    <p className="text-xxs text-fg-muted mt-0.5 leading-relaxed">{inc.notes}</p>
                  )}
                  {inc.source && inc.source.startsWith("http") && (
                    <a
                      href={inc.source}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xxs text-accent hover:text-accent-strong break-all"
                    >
                      {inc.source}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="px-5 py-4 border-b border-border">
          <h3 className="text-xxs uppercase tracking-wide text-fg-subtle mb-2">Dealer</h3>
          {dealer ? (
            <div className="text-sm space-y-0.5">
              <div className="font-medium">{dealer.name}</div>
              <div className="text-fg-muted">{dealer.address}</div>
              <div className="text-fg-muted">{dealer.city}, {dealer.province}{dealer.postal ? ` ${dealer.postal}` : ""}</div>
              {dealer.phone && <div className="text-fg-muted">{dealer.phone}</div>}
              <div className="text-xxs text-fg-subtle pt-1">
                Pressure score:{" "}
                <span className={pressure >= 70 ? "text-accent" : pressure >= 40 ? "text-warn" : "text-fg-muted"}>
                  {pressure}
                </span>
              </div>
              {dealer.inventoryUrl && (
                <a
                  href={dealer.inventoryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-accent hover:text-accent-strong break-all inline-block pt-1"
                >
                  {dealer.inventoryUrl}
                </a>
              )}
            </div>
          ) : (
            <p className="text-sm text-fg-subtle">Dealer not found.</p>
          )}
        </section>

        <section className="px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xxs uppercase tracking-wide text-fg-subtle">Negotiation draft</h3>
            <CopyButton text={draft} />
          </div>
          <pre className="text-xxs leading-relaxed bg-bg-subtle rounded p-3 whitespace-pre-wrap font-mono">{draft}</pre>
          {!comparable && (
            <p className="text-xxs text-fg-subtle mt-2">
              No comparable {unit.year} {unit.trim} found in current inventory to anchor the price ask.
            </p>
          )}
        </section>
      </aside>
    </>
  );
}

function Row({ label, value, accentNegative }: { label: string; value: number; accentNegative?: boolean }) {
  const cls = accentNegative && value < 0 ? "num text-accent" : "num text-fg-muted";
  return (
    <div className="flex justify-between">
      <dt className="text-fg-muted">{label}</dt>
      <dd className={cls}>{fmtCad(value)}</dd>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // clipboard blocked; ignore
        }
      }}
      className="text-xxs px-2 py-1 border border-border rounded hover:bg-bg-hover text-fg-muted"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// Caveman-style draft: short, blunt, fact-anchored. Days-on-lot, pressure score,
// and comparable cheapest unit are required injected facts.
function buildEmailDraft(
  unit: ScoredUnit,
  dealer: Dealer | undefined,
  pressure: number,
  comparable: ScoredUnit | undefined,
  comparableDealer: Dealer | undefined,
): string {
  const greet = dealer ? `Hi ${dealer.name} team,` : "Hi,";
  const stockLine = unit.stockNumber ? `stock #${unit.stockNumber}` : unit.vin ? `VIN ${unit.vin}` : "this unit";
  const days = unit.daysOnLot ?? 0;

  const aging = days > 90
    ? `Listing shows ${days} days on lot. That's aging stock.`
    : days > 30
      ? `Listing shows ${days} days on lot.`
      : "";

  const pressureNote = pressure >= 70
    ? `Your dealership has heavy ${unit.model} inventory right now (pressure score ${pressure}/100).`
    : pressure >= 40
      ? `Inventory depth here is moderate (pressure score ${pressure}/100).`
      : "";

  const compLine = comparable
    ? `Comparable ${comparable.year} ${comparable.trim} listed at ${fmtCad(comparable.dealerAskingPrice)} ${comparableDealer ? `(${comparableDealer.name}, ${comparableDealer.city})` : ""}. Asking ${fmtCad(comparable.otdCad)} OTD there.`
    : "";

  const askDelta = comparable && comparable.otdCad < unit.otdCad
    ? `Looking to match or beat ${fmtCad(comparable.otdCad)} OTD.`
    : `Looking for OTD under ${fmtCad(Math.round(unit.otdCad * 0.97))}.`;

  const lines = [
    greet,
    "",
    `Interested in your ${unit.year} ${MODEL_LABEL[unit.model]} ${unit.trim} ${unit.drivetrain} (${stockLine}).`,
    "",
    aging,
    pressureNote,
    compLine,
    "",
    askDelta,
    "Cash deal, financing pre-approved, ready to sign this week if numbers work.",
    "",
    "What's your best out-the-door?",
    "",
    "Thanks.",
  ].filter((l) => l !== undefined);

  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}
