"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { Dealer, ScoredUnit, Spec, FinanceBreakdown, LeaseBreakdown } from "@/lib/types";
import { readHeatPump } from "@/lib/types";
import { MODEL_LABEL } from "@/lib/constants";
import { fmtCad } from "@/lib/format";
import { effectivePreTaxValue } from "@/lib/scoring";
import { StatusChip } from "./StatusChip";
import { DealScoreBadge } from "./DealScoreBadge";
import { plainLang } from "@/lib/plainLang";

// Heatpump chip — tri-state, matches InventoryTable styling.
function HeatPumpChip({ hasHeatPump }: { hasHeatPump?: boolean | null }) {
  if (hasHeatPump === true) return null;
  if (hasHeatPump === false) {
    return (
      <span
        className="chip-bad text-xxs"
        title="No heat pump — resistive heat only. Expect 25–40% real-world range loss below −10°C."
      >
        ❌ No heat pump
      </span>
    );
  }
  return (
    <span
      className="chip-neutral text-xxs text-fg-subtle"
      title="Heat pump status not yet researched for this trim."
    >
      ❓ Heat pump?
    </span>
  );
}

// Finance path detail table.
function FinanceTab({ fb }: { fb: FinanceBreakdown }) {
  return (
    <dl className="text-sm space-y-1">
      <div className="flex justify-between"><dt className="text-fg-muted">APR</dt><dd className="num">{fb.aprPercent}%</dd></div>
      <div className="flex justify-between"><dt className="text-fg-muted">Term</dt><dd className="num">{fb.termMonths} mo</dd></div>
      <div className="flex justify-between"><dt className="text-fg-muted">Down payment</dt><dd className="num">{fmtCad(fb.downPaymentCad)}</dd></div>
      <div className="flex justify-between"><dt className="text-fg-muted">Amount financed</dt><dd className="num">{fmtCad(fb.amountFinancedCad)}</dd></div>
      <div className="flex justify-between"><dt className="text-fg-muted">Total interest</dt><dd className="num text-warn">{fmtCad(fb.totalInterestCad)}</dd></div>
      <div className="border-t border-border pt-2 mt-2 flex justify-between">
        <dt className="font-semibold">Monthly payment</dt>
        <dd className="num font-semibold">{fmtCad(Math.round(fb.monthlyPaymentCad))}/mo</dd>
      </div>
      <div className="flex justify-between text-xs text-fg-muted">
        <dt>Total cost</dt>
        <dd className="num">{fmtCad(fb.totalCostCad)}</dd>
      </div>
    </dl>
  );
}

// Lease path detail table.
function LeaseTab({ lb }: { lb: LeaseBreakdown }) {
  return (
    <dl className="text-sm space-y-1">
      <div className="flex justify-between"><dt className="text-fg-muted">APR equiv.</dt><dd className="num">{lb.aprPercent}%</dd></div>
      <div className="flex justify-between"><dt className="text-fg-muted">Term</dt><dd className="num">{lb.termMonths} mo</dd></div>
      <div className="flex justify-between"><dt className="text-fg-muted"><span title={plainLang("residualPercent")} className="cursor-help underline decoration-dotted underline-offset-2">Residual</span></dt><dd className="num">{lb.residualPercent}% · {fmtCad(lb.residualBuyoutCad)}</dd></div>
      <div className="flex justify-between"><dt className="text-fg-muted"><span title={plainLang("capCost")} className="cursor-help underline decoration-dotted underline-offset-2">Cap cost</span></dt><dd className="num">{fmtCad(lb.capCostCad)}</dd></div>
      <div className="flex justify-between"><dt className="text-fg-muted"><span title={plainLang("capReduction")} className="cursor-help underline decoration-dotted underline-offset-2">Signing down</span></dt><dd className="num">{fmtCad(lb.capCostReductionCad)}</dd></div>
      <div className="flex justify-between"><dt className="text-fg-muted">Security deposit</dt><dd className="num">{fmtCad(lb.securityDepositCad)}</dd></div>
      <div className="flex justify-between"><dt className="text-fg-muted">Annual km</dt><dd className="num">{lb.annualMileageKm.toLocaleString("en-CA")} km</dd></div>
      <div className="flex justify-between"><dt className="text-fg-muted">Overage</dt><dd className="num">{fmtCad(lb.overageCadPerKm)}/km</dd></div>
      <div className="border-t border-border pt-2 mt-2 flex justify-between">
        <dt className="font-semibold">Monthly (+ tax)</dt>
        <dd className="num font-semibold">{fmtCad(Math.round(lb.monthlyPaymentWithTaxCad))}/mo</dd>
      </div>
      <div className="flex justify-between text-xs text-fg-muted">
        <dt>Total lease cost</dt>
        <dd className="num">{fmtCad(lb.totalLeaseCostCad)}</dd>
      </div>
    </dl>
  );
}

type Props = {
  unit: ScoredUnit | null;
  dealer: Dealer | undefined;
  pressure: number;
  comparable: ScoredUnit | undefined;
  comparableDealer: Dealer | undefined;
  onClose: () => void;
  onNavigate?: (direction: -1 | 1) => void;
  position?: { index: number; total: number };
  spec?: Spec;
};

export function UnitDrawer({ unit, dealer, pressure, comparable, comparableDealer, onClose, onNavigate, position, spec }: Props) {
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
  const [otdTab, setOtdTab] = useState<"cash" | "finance" | "lease">("cash");

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
            {spec !== undefined && (
              <div className="mt-1">
                <HeatPumpChip hasHeatPump={readHeatPump(spec.hasHeatPump)} />
              </div>
            )}
            <div className="flex items-center gap-2 mt-2">
              {unit.listingUrl && (
                <a
                  href={unit.listingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 border border-accent rounded text-accent hover:bg-accent hover:text-bg"
                  title="Open original AutoTrader listing in new tab"
                >
                  View AutoTrader listing ↗
                </a>
              )}
              <Link
                href={`/inventory/${unit.id}/dossier`}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 border border-border rounded text-fg-muted hover:text-fg hover:bg-bg-subtle"
                title="Print-friendly negotiation dossier — OTD breakdown, comparables, talking points"
              >
                Dossier ↗
              </Link>
            </div>
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
          <div className="flex items-center gap-1 mb-3">
            {(["cash", "finance", "lease"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setOtdTab(tab)}
                title={plainLang(tab)}
                className={`text-xxs px-2 py-1 rounded border ${otdTab === tab ? "border-accent text-accent" : "border-border text-fg-muted hover:text-fg"}`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          {otdTab === "cash" && (
            <dl className="text-sm space-y-1">
              <Row label={<span title={plainLang("msrp")} className="cursor-help underline decoration-dotted underline-offset-2">MSRP</span>} value={unit.otdBreakdown.msrp} />
              <Row label={<span title={plainLang("freightPdi")} className="cursor-help underline decoration-dotted underline-offset-2">Freight + PDI</span>} value={unit.otdBreakdown.freightPdi} />
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
              <Row
                label={`Sales tax (${unit.otdBreakdown.salesTaxProvince})`}
                value={unit.otdBreakdown.salesTax}
              />
              {unit.otdBreakdown.transportCost > 0 && (
                <Row
                  label={`Transport (${dealer?.province ?? "?"} → ${unit.otdBreakdown.salesTaxProvince}, est)`}
                  value={unit.otdBreakdown.transportCost}
                />
              )}
              {unit.otdBreakdown.incentivesApplied.length > 0 && (
                <div className="pt-1 mt-1 border-t border-border/50">
                  <div className="text-xxs text-fg-subtle mb-1">Cash incentives applied</div>
                  {unit.otdBreakdown.incentivesApplied.map((line) => (
                    <div key={line.id} className="flex justify-between text-xs">
                      <dt className="text-fg-muted truncate pr-2" title={line.name}>
                        {line.name}
                      </dt>
                      <dd className="num text-accent">−{fmtCad(line.amountCad)}</dd>
                    </div>
                  ))}
                </div>
              )}
              <div className="border-t border-border pt-2 mt-2 flex justify-between">
                <dt className="font-semibold">
                  <span title={plainLang("OTD")} className="cursor-help underline decoration-dotted underline-offset-2">OTD</span> total
                </dt>
                <dd className="num font-semibold">{fmtCad(unit.otdBreakdown.total)}</dd>
              </div>
            </dl>
          )}
          {otdTab === "finance" && (
            unit.otdPaths?.finance
              ? <FinanceTab fb={unit.otdPaths.finance} />
              : <p className="text-sm text-fg-subtle">No finance promo on this trim.</p>
          )}
          {otdTab === "lease" && (
            unit.otdPaths?.lease
              ? <LeaseTab lb={unit.otdPaths.lease} />
              : <p className="text-sm text-fg-subtle">No lease promo on this trim.</p>
          )}
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
              <Link href={`/dealer/${dealer.id}`} className="font-medium hover:text-accent-strong">
                {dealer.name} →
              </Link>
              <div className="text-fg-muted">{dealer.address}</div>
              <div className="text-fg-muted">{dealer.city}, {dealer.province}{dealer.postal ? ` ${dealer.postal}` : ""}</div>
              {dealer.phone && (
                <div className="text-fg-muted">
                  <a
                    href={`tel:${dealer.phone.replace(/[^0-9+]/g, "")}`}
                    className="text-accent hover:text-accent-strong"
                  >
                    {dealer.phone} ↗
                  </a>
                </div>
              )}
              <div className="text-xxs text-fg-subtle pt-1">
                Pressure score:{" "}
                <span className={pressure >= 70 ? "text-accent" : pressure >= 40 ? "text-warn" : "text-fg-muted"}>
                  {pressure}
                </span>
              </div>
              {dealer.inventoryUrl && !dealer.inventoryUrl.startsWith("VERIFY") && (
                <a
                  href={dealer.inventoryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-accent hover:text-accent-strong break-all inline-block pt-1"
                >
                  Dealer site ↗
                </a>
              )}
            </div>
          ) : (
            <p className="text-sm text-fg-subtle">Dealer not found.</p>
          )}
        </section>

        {(unit.isDemo || unit.demoKm) && (
          <section className="px-5 py-3 border-b border-border bg-warn/5">
            <h3 className="text-xxs uppercase tracking-wide text-warn mb-1">Demo unit</h3>
            <p className="text-xs text-fg-muted leading-relaxed">
              {unit.demoKm
                ? `${unit.demoKm.toLocaleString()} km already on the clock — warranty start date has shifted forward. Demo cars typically discount 8-15% off MSRP per OEM rules; if dealer isn't there, walk.`
                : "Marked as demo. Confirm km, warranty start date, and demo discount in writing before signing."}
            </p>
          </section>
        )}

        <section className="px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xxs uppercase tracking-wide text-fg-subtle">Negotiation draft</h3>
            <div className="flex items-center gap-1.5">
              {dealer && (
                <a
                  href={`mailto:?subject=${encodeURIComponent(
                    `${unit.year} ${MODEL_LABEL[unit.model]} ${unit.trim} — out-the-door inquiry`,
                  )}&body=${encodeURIComponent(draft)}`}
                  className="text-xxs px-2 py-1 border border-border rounded hover:bg-bg-hover text-fg-muted"
                  title="Open in your mail client with draft pre-filled"
                >
                  Email
                </a>
              )}
              <CopyButton text={draft} />
            </div>
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

function Row({ label, value, accentNegative }: { label: React.ReactNode; value: number; accentNegative?: boolean }) {
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

  // EVAP context. The cap is the central 2026 negotiation handle. Effective
  // contract value subtracts known OEM cash so a $58k Limited AWD with $16k
  // bonus reads as a $42k contract (and qualifies for EVAP). If unit is
  // just over the cap post-bonus, ask the dealer to trim accessories/admin.
  const effectivePreTax = effectivePreTaxValue(unit, unit.applicableIncentives);
  const evapEligible = unit.applicableIncentives.some((i) => i.id.startsWith("fed-evap"));
  const overCap = effectivePreTax - 50000;
  const evapLine = evapEligible
    ? `Effective pre-tax contract value of ${fmtCad(effectivePreTax)} qualifies for the $5,000 federal EVAP rebate — already in the OTD figure above.`
    : overCap > 0 && overCap <= 1500
      ? `Effective pre-tax contract value of ${fmtCad(effectivePreTax)} sits ${fmtCad(overCap)} over the $50,000 EVAP cap. Trimming admin/wheel-locks/prep to bring it under the cap unlocks $5,000 in federal rebate (~${fmtCad(Math.round(5000 * 1.13))} after Ontario HST).`
      : overCap > 1500
        ? `Note this trim is ${fmtCad(overCap)} over the federal EVAP cap, so it doesn't get the $5,000 rebate. Equivalent post-rebate competitor: Equinox EV 2LT AWD at ${fmtCad(44699)} OTD-ish (Chevy MSRP $49,699 minus $5,000 EVAP).`
        : "";

  const lines = [
    greet,
    "",
    `Interested in your ${unit.year} ${MODEL_LABEL[unit.model]} ${unit.trim} ${unit.drivetrain} (${stockLine}).`,
    "",
    aging,
    pressureNote,
    compLine,
    evapLine,
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
