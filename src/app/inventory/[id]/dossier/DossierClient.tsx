"use client";

// Per-unit negotiation dossier — a single printable page Ian can reference
// during a dealer call. URL: /inventory/<unitId>/dossier
//
// Sections (top to bottom):
//   1. Header — model / trim / year / VIN / colors / dealer + city
//   2. OTD breakdown — itemized, buyer-province tax, transport line
//   3. Comparable units nationwide — same model+trim+year, $ + km away
//   4. Dealer pressure — same-trim depth + avg days-on-lot at this dealer
//   5. Used-market reference — median used price + retention % for nameplate
//   6. Talking points — pre-written, numbers interpolated

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams, notFound, useRouter } from "next/navigation";
import Link from "next/link";
import { loadScoredUnits, loadSpecs, loadUsedListings, computeUsedMarketStats } from "@/lib/dataClient";
import { useBuyerContext } from "@/lib/buyerContext";
import { fmtCad, fmtDate } from "@/lib/format";
import type { ScoredUnit, Spec, FinanceBreakdown, LeaseBreakdown } from "@/lib/types";
import { readHeatPump } from "@/lib/types";
import { PrintButton } from "./PrintButton";
import { UnitVerifyChip } from "@/components/UnitVerifyChip";
import { UnitPhotoGallery } from "@/components/UnitPhotoGallery";
import { CrossSourceChip } from "@/components/CrossSourceChip";
import { plainLang } from "@/lib/plainLang";
import dynamic from "next/dynamic";
import { BatteryHealthPanel } from "@/components/BatteryHealthPanel";
import { OtdWaterfallChart } from "@/components/OtdWaterfallChart";

// Lazy-load recharts-backed charts so the ~384 kB recharts chunk doesn't
// ship in the dossier's initial bundle. Each chart loads on demand when
// its section enters the DOM. ssr:false is required because recharts
// touches `window` at import-time. Falls back to a small placeholder
// while the chunk fetches.
const chartFallback = (
  <div className="h-48 w-full bg-bg-subtle rounded animate-pulse" />
);
const ChargingCurveChart = dynamic(
  () => import("@/components/ChargingCurveChart").then((m) => m.ChargingCurveChart),
  { ssr: false, loading: () => chartFallback },
);
const WarmupRampChart = dynamic(
  () => import("@/components/WarmupRampChart").then((m) => m.WarmupRampChart),
  { ssr: false, loading: () => chartFallback },
);
const DcChargeRampChart = dynamic(
  () => import("@/components/DcChargeRampChart").then((m) => m.DcChargeRampChart),
  { ssr: false, loading: () => chartFallback },
);
import { readNumeric } from "@/lib/types";

type PageData = {
  scored: Awaited<ReturnType<typeof loadScoredUnits>>;
  specs: Awaited<ReturnType<typeof loadSpecs>>;
  used: Awaited<ReturnType<typeof loadUsedListings>>;
};

function DossierInner({ unitId }: { unitId: string }) {
  const sp = useSearchParams();
  const router = useRouter();
  const tempC = sp.get("tempC") != null ? Number(sp.get("tempC")) : 20;
  const preconditioned = sp.get("precon") === "1";
  const { buyerContext: ctx } = useBuyerContext();
  const [data, setData] = useState<PageData | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadScoredUnits(ctx), loadSpecs(), loadUsedListings()]).then(
      ([scored, specs, used]) => {
        if (!cancelled) setData({ scored, specs, used });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [ctx]);

  // Keyboard shortcuts on dossier:
  //   ←   navigate to previous unit (by score order)
  //   →   navigate to next unit
  //   c   copy dealer phone to clipboard
  //   Esc back to inventory
  useEffect(() => {
    if (!data) return;
    const ids = data.scored.units.map((u) => u.id);
    const idx = ids.indexOf(unitId);
    const dealer = data.scored.dealerById.get(
      data.scored.units.find((u) => u.id === unitId)?.dealerId ?? "",
    );
    function onKey(e: KeyboardEvent) {
      // Skip when user is typing in an input/textarea/contentEditable
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowLeft" && idx > 0) {
        e.preventDefault();
        router.push(`/inventory/${ids[idx - 1]}/dossier`);
      } else if (e.key === "ArrowRight" && idx >= 0 && idx < ids.length - 1) {
        e.preventDefault();
        router.push(`/inventory/${ids[idx + 1]}/dossier`);
      } else if (e.key === "c" && dealer?.phone) {
        e.preventDefault();
        navigator.clipboard?.writeText(dealer.phone).catch(() => {});
      } else if (e.key === "Escape") {
        e.preventDefault();
        router.push("/inventory");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [data, unitId, router]);

  if (!data) {
    return (
      <div className="dossier max-w-3xl mx-auto px-6 py-8 animate-pulse space-y-4">
        <div className="h-12 bg-bg-subtle rounded w-2/3" />
        <div className="h-48 bg-bg-subtle rounded" />
        <div className="h-64 bg-bg-subtle rounded" />
      </div>
    );
  }

  const { units, dealerById } = data.scored;
  const { specs, used } = data;
  const unit = units.find((u) => u.id === unitId);
  if (!unit) return notFound();
  const dealer = dealerById.get(unit.dealerId);
  if (!dealer) return notFound();

  const specForUnit = specs.find(
    (s) => s.model === unit.model && s.year === unit.year && s.trim === unit.trim && s.drivetrain === unit.drivetrain,
  );

  const cohort = units
    .filter((u) => u.id !== unit.id && u.model === unit.model && u.trim === unit.trim && u.year === unit.year)
    .sort((a, b) => a.otdCad - b.otdCad)
    .slice(0, 3);

  const sameTrimAtDealer = units.filter(
    (u) => u.dealerId === dealer.id && u.model === unit.model && u.trim === unit.trim,
  );
  const avgDaysAtDealer = sameTrimAtDealer.length
    ? Math.round(sameTrimAtDealer.reduce((s, u) => s + (u.daysOnLot ?? 0), 0) / sameTrimAtDealer.length)
    : 0;

  const usedStats = computeUsedMarketStats(used, specs).find((s) => s.model === unit.model);

  return (
    <div className="dossier max-w-3xl mx-auto px-6 py-8 print:py-2 print:px-0 print:max-w-none">
      <div className="flex items-center justify-between print:hidden mb-4">
        <Link href="/inventory" className="text-xs text-fg-muted hover:text-fg">← Back to inventory</Link>
        <PrintButton />
      </div>

      <Header unit={unit} dealer={dealer} spec={specForUnit} />
      <UnitPhotoGallery unitId={unit.id} />
      <OtdSection unit={unit} ctx={ctx} dealer={dealer} />
      <TechSpecsSection spec={specForUnit} unit={unit} />
      <ThermalSection spec={specForUnit} tempC={tempC} preconditioned={preconditioned} />
      <CohortSection unit={unit} cohort={cohort} dealerById={dealerById} />
      <DealerPressureSection
        dealerName={dealer.name}
        sameTrimCount={sameTrimAtDealer.length}
        avgDays={avgDaysAtDealer}
      />
      {usedStats && <UsedMarketSection stats={usedStats} unit={unit} />}
      <TalkingPoints unit={unit} dealer={dealer} cohort={cohort} avgDaysAtDealer={avgDaysAtDealer} />

      <p className="text-xxs text-fg-muted mt-8 print:mt-4">
        Generated {fmtDate(new Date().toISOString())} · Buyer-province: {ctx.province}
        {ctx.loyalty && " · loyalty"}{ctx.conquest && " · conquest"}
      </p>
    </div>
  );
}

export function DossierClient({ unitId }: { unitId: string }) {
  return (
    <Suspense
      fallback={
        <div className="dossier max-w-3xl mx-auto px-6 py-8 animate-pulse space-y-4">
          <div className="h-12 bg-bg-subtle rounded w-2/3" />
          <div className="h-48 bg-bg-subtle rounded" />
          <div className="h-64 bg-bg-subtle rounded" />
        </div>
      }
    >
      <DossierInner unitId={unitId} />
    </Suspense>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 print:mt-3 print:break-inside-avoid">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-fg-subtle border-b border-border pb-1 mb-3">
        {title}
      </h2>
      {children}
    </section>
  );
}

function TechSpecsSection({ spec, unit }: { spec?: Spec; unit: ScoredUnit }) {
  if (!spec) return null;
  const hasCurve = spec.chargingCurve && spec.chargingCurve.length > 0;
  const hasRange = spec.rangeEpaKm?.value != null || spec.rangeKm != null;
  const hasBattery = hasRange;
  if (!hasCurve && !hasBattery) return null;

  return (
    <Section title="Vehicle facts">
      {hasBattery && (
        <div className="mb-4">
          <h3 className="text-xs font-semibold text-fg-subtle uppercase tracking-wide mb-2">
            Battery health (estimated)
          </h3>
          <BatteryHealthPanel spec={spec} unit={unit} />
        </div>
      )}
      {hasCurve && (
        <div>
          <h3 className="text-xs font-semibold text-fg-subtle uppercase tracking-wide mb-2">
            DC charging curve (10→80%)
          </h3>
          <ChargingCurveChart spec={spec} />
        </div>
      )}
    </Section>
  );
}

function ThermalSection({
  spec,
  tempC,
  preconditioned,
}: {
  spec?: Spec;
  tempC: number;
  preconditioned: boolean;
}) {
  if (!spec) return null;
  const epa = readNumeric(spec.rangeEpaKm) ?? spec.rangeKm ?? null;
  const battery: number | null =
    readNumeric(spec.batteryKwhUsable) ??
    (typeof spec.batteryKwh === "number"
      ? spec.batteryKwh
      : readNumeric(spec.batteryKwh as Parameters<typeof readNumeric>[0])) ??
    null;
  const hpMinC = readNumeric(spec.heatPumpMinEffectiveC) ?? undefined;
  if (epa == null) return null;

  const showWarmup = tempC < 5;
  const hasCurve = spec.chargingCurve && spec.chargingCurve.length > 0;
  const hasDcPeak = readNumeric(spec.dcChargeMaxKw) != null;
  const showDcRamp = hasCurve || hasDcPeak;
  if (!showWarmup && !showDcRamp) return null;

  return (
    <>
      {showWarmup && (
        <Section title={`Cold-start range ramp at ${tempC}°C`}>
          <p className="text-xs text-fg-muted mb-2">
            Why a Sunday-morning short trip burns more than rated. Cold-soaked battery
            + cabin heat-up surge cost the most in the first 10–15 min, then range
            converges to steady-state. Preconditioning erases most of the early-trip penalty.
          </p>
          <WarmupRampChart
            params={{
              epaKm: epa,
              batteryKwh: battery,
              hasHeatPump: readHeatPump(spec.hasHeatPump),
              tempC,
              chemistry: spec.batteryChemistry,
              heatPumpMinEffectiveC: hpMinC,
            }}
          />
        </Section>
      )}
      {showDcRamp && (
        <Section
          title={`DC charging ramp at ${tempC}°C (${preconditioned ? "preconditioned" : "cold-soaked"})`}
        >
          <p className="text-xs text-fg-muted mb-2">
            Effective charging power as the battery warms during the session. Cold-soaked packs
            take 10–20 min to reach peak; preconditioned arrive ready-to-go. Charger choice matters:
            the 50 kW line is flat (charger-limited); higher-power chargers warm the pack faster.
          </p>
          <DcChargeRampChart spec={spec} tempC={tempC} preconditioned={preconditioned} />
        </Section>
      )}
    </>
  );
}

function HeatPumpChip({ hasHeatPump }: { hasHeatPump?: boolean | null }) {
  if (hasHeatPump === true) return null;
  if (hasHeatPump === false) {
    return (
      <span
        className="inline-block chip-bad text-xs mt-1 print:border print:border-red-500 print:text-red-600"
        title="No heat pump — resistive heat only. Expect 25–40% real-world range loss below −10°C."
      >
        ❌ No heat pump
      </span>
    );
  }
  return (
    <span
      className="inline-block chip-neutral text-xs text-fg-subtle mt-1"
      title="Heat pump status not yet researched for this trim."
    >
      ❓ Heat pump?
    </span>
  );
}

function Header({ unit, dealer, spec }: { unit: ScoredUnit; dealer: { name: string; city: string; province: string; phone?: string }; spec?: Spec }) {
  return (
    <header className="border-b border-border pb-4">
      <h1 className="text-2xl font-semibold">{unit.year} {unit.model} {unit.trim}</h1>
      <div className="mt-1 text-sm text-fg-subtle">
        {unit.exteriorColor} / {unit.interiorColor}
        {unit.vin && ` · VIN ${unit.vin}`}
        {unit.stockNumber && ` · Stock #${unit.stockNumber}`}
      </div>
      {spec !== undefined && <HeatPumpChip hasHeatPump={readHeatPump(spec.hasHeatPump)} />}
      <div className="mt-2 text-sm">
        <strong>{dealer.name}</strong> — {dealer.city}, {dealer.province}
        {dealer.phone && ` · ${dealer.phone}`}
      </div>
      {unit.listingUrl && (
        <a href={unit.listingUrl} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline print:hidden">
          Listing on AutoTrader ↗
        </a>
      )}
      <div className="mt-2 print:hidden flex flex-wrap gap-2">
        <UnitVerifyChip unitId={unit.id} />
        <CrossSourceChip
          vin={unit.vin ?? null}
          year={unit.year}
          make={unit.model.startsWith("Ioniq") ? "Hyundai" : "Kia"}
          model={unit.model}
          trim={unit.trim}
          thisPriceCad={unit.dealerAskingPrice}
        />
      </div>
    </header>
  );
}

function OtdSection({ unit, ctx, dealer }: { unit: ScoredUnit; ctx: { province: string }; dealer: { province: string } }) {
  const b = unit.otdBreakdown;
  const row = (label: React.ReactNode, value: number, isCredit = false) => (
    <tr>
      <td className="py-1 pr-4">{label}</td>
      <td className="py-1 text-right tabular-nums">
        {isCredit ? "−" : ""}{fmtCad(Math.abs(value))}
      </td>
    </tr>
  );
  const fp = unit.otdPaths?.finance;
  const lp = unit.otdPaths?.lease;
  return (
    <Section title={`Out-the-door (taxed in ${ctx.province})`}>
      <div className="mb-3">
        <div className="text-xxs uppercase tracking-wide text-fg-subtle mb-2">Cash</div>
        <div className="mb-4 print:hidden">
          <OtdWaterfallChart
            total={b.total}
            steps={[
              { label: "MSRP", amount: b.msrp },
              { label: "Freight + PDI", amount: b.freightPdi },
              ...(b.dealerAdjustment !== 0 ? [{
                label: b.dealerAdjustment < 0 ? "Dealer discount" : "Dealer markup",
                amount: b.dealerAdjustment,
                isCredit: b.dealerAdjustment < 0,
              }] : []),
              { label: "Fees & excise", amount: b.acExciseTax + b.omvic + b.tireStewardship + b.rdprm + b.govLicensing },
              ...(b.transportCost > 0 ? [{ label: "Transport est.", amount: b.transportCost }] : []),
              { label: `Tax (${b.salesTaxProvince})`, amount: b.salesTax },
              ...b.incentivesApplied.map((i) => ({
                label: i.name,
                amount: -i.amountCad,
                isCredit: true,
              })),
              { label: "OTD (cash)", amount: b.total, isTotal: true },
            ]}
          />
        </div>
        <table className="w-full text-sm">
          <tbody>
            {row(<span title={plainLang("msrp")} className="cursor-help underline decoration-dotted underline-offset-2">MSRP</span>, b.msrp)}
            {row(<span title={plainLang("freightPdi")} className="cursor-help underline decoration-dotted underline-offset-2">Freight + PDI</span>, b.freightPdi)}
            {row(b.dealerAdjustment >= 0 ? "Dealer markup" : "Dealer discount", b.dealerAdjustment, b.dealerAdjustment < 0)}
            {row("AC excise", b.acExciseTax)}
            {row("OMVIC + tire stewardship + RDPRM + licensing", b.omvic + b.tireStewardship + b.rdprm + b.govLicensing)}
            {b.transportCost > 0 && row(`Transport (${dealer.province} → ${b.salesTaxProvince}, est)`, b.transportCost)}
            {row(`Sales tax (${b.salesTaxProvince})`, b.salesTax)}
            {b.incentivesApplied.map((i) => (
              <tr key={i.id} className="text-good">
                <td className="py-1 pr-4">− {i.name}</td>
                <td className="py-1 text-right tabular-nums">−{fmtCad(i.amountCad)}</td>
              </tr>
            ))}
            <tr className="border-t border-border font-semibold">
              <td className="py-2 pr-4">Total <span title={plainLang("OTD")} className="cursor-help underline decoration-dotted underline-offset-2">OTD</span> (cash)</td>
              <td className="py-2 text-right tabular-nums">{fmtCad(b.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {fp ? (
        <FinanceSection fb={fp} />
      ) : (
        <p className="text-xs text-fg-subtle mb-2 italic">No finance promo on this trim.</p>
      )}
      {lp ? (
        <LeaseSection lb={lp} />
      ) : (
        <p className="text-xs text-fg-subtle italic">No lease promo on this trim.</p>
      )}
    </Section>
  );
}

function FinanceSection({ fb }: { fb: FinanceBreakdown }) {
  return (
    <div className="mt-3 print:mt-2">
      <div className="text-xxs uppercase tracking-wide text-fg-subtle mb-1">Finance ({fb.termMonths} mo @ {fb.aprPercent}% APR)</div>
      <table className="w-full text-sm">
        <tbody>
          <tr><td className="py-1 pr-4">Down payment</td><td className="py-1 text-right tabular-nums">{fmtCad(fb.downPaymentCad)}</td></tr>
          <tr><td className="py-1 pr-4">Amount financed</td><td className="py-1 text-right tabular-nums">{fmtCad(fb.amountFinancedCad)}</td></tr>
          <tr><td className="py-1 pr-4">Total interest</td><td className="py-1 text-right tabular-nums">{fmtCad(fb.totalInterestCad)}</td></tr>
          <tr className="border-t border-border font-semibold">
            <td className="py-2 pr-4">Monthly payment</td>
            <td className="py-2 text-right tabular-nums">{fmtCad(Math.round(fb.monthlyPaymentCad))}/mo</td>
          </tr>
          <tr className="text-xs text-fg-muted">
            <td className="pr-4">Total cost</td>
            <td className="text-right tabular-nums">{fmtCad(fb.totalCostCad)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function LeaseSection({ lb }: { lb: LeaseBreakdown }) {
  return (
    <div className="mt-3 print:mt-2">
      <div className="text-xxs uppercase tracking-wide text-fg-subtle mb-1">Lease ({lb.termMonths} mo, residual {lb.residualPercent}%)</div>
      <table className="w-full text-sm">
        <tbody>
          <tr><td className="py-1 pr-4"><span title={plainLang("capCost")} className="cursor-help underline decoration-dotted underline-offset-2">Cap cost</span></td><td className="py-1 text-right tabular-nums">{fmtCad(lb.capCostCad)}</td></tr>
          <tr><td className="py-1 pr-4"><span title={plainLang("capReduction")} className="cursor-help underline decoration-dotted underline-offset-2">Signing down</span></td><td className="py-1 text-right tabular-nums">{fmtCad(lb.capCostReductionCad)}</td></tr>
          <tr><td className="py-1 pr-4"><span title={plainLang("residualPercent")} className="cursor-help underline decoration-dotted underline-offset-2">Residual buyout</span></td><td className="py-1 text-right tabular-nums">{fmtCad(lb.residualBuyoutCad)}</td></tr>
          <tr><td className="py-1 pr-4">Annual km</td><td className="py-1 text-right tabular-nums">{lb.annualMileageKm.toLocaleString("en-CA")} km</td></tr>
          <tr><td className="py-1 pr-4">Overage</td><td className="py-1 text-right tabular-nums">{fmtCad(lb.overageCadPerKm)}/km</td></tr>
          <tr className="border-t border-border font-semibold">
            <td className="py-2 pr-4">Monthly (incl. tax)</td>
            <td className="py-2 text-right tabular-nums">{fmtCad(Math.round(lb.monthlyPaymentWithTaxCad))}/mo</td>
          </tr>
          <tr className="text-xs text-fg-muted">
            <td className="pr-4">Total lease cost</td>
            <td className="text-right tabular-nums">{fmtCad(lb.totalLeaseCostCad)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function CohortSection({ unit, cohort, dealerById }: { unit: ScoredUnit; cohort: ScoredUnit[]; dealerById: Map<string, { name: string; city: string; province: string }> }) {
  if (cohort.length === 0) {
    return (
      <Section title="Comparable units nationwide">
        <p className="text-sm text-fg-muted">No other {unit.year} {unit.model} {unit.trim} units in inventory right now.</p>
      </Section>
    );
  }
  return (
    <Section title="Comparable units (same trim, same year)">
      <table className="w-full text-sm">
        <thead className="text-xxs uppercase text-fg-muted">
          <tr>
            <th className="text-left py-1">Dealer</th>
            <th className="text-left py-1">Location</th>
            <th className="text-right"><span title={plainLang("asking")} className="cursor-help underline decoration-dotted underline-offset-2">Asking</span></th>
            <th className="text-right"><span title={plainLang("OTD")} className="cursor-help underline decoration-dotted underline-offset-2">OTD</span></th>
            <th className="text-right">Δ vs this</th>
          </tr>
        </thead>
        <tbody>
          {cohort.map((c) => {
            const d = dealerById.get(c.dealerId);
            return (
              <tr key={c.id}>
                <td className="py-1 pr-3">{d?.name ?? c.dealerId}</td>
                <td className="py-1 pr-3 text-fg-muted text-xs">{d ? `${d.city}, ${d.province}` : ""}</td>
                <td className="text-right tabular-nums">{fmtCad(c.dealerAskingPrice)}</td>
                <td className="text-right tabular-nums">{fmtCad(c.otdCad)}</td>
                <td className={`text-right tabular-nums ${c.otdCad < unit.otdCad ? "text-good" : "text-fg-muted"}`}>
                  {c.otdCad < unit.otdCad ? "−" : "+"}{fmtCad(Math.abs(c.otdCad - unit.otdCad))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Section>
  );
}

function DealerPressureSection({ dealerName, sameTrimCount, avgDays }: { dealerName: string; sameTrimCount: number; avgDays: number }) {
  return (
    <Section title="Dealer pressure">
      <p className="text-sm">
        <strong>{dealerName}</strong> currently holds <strong>{sameTrimCount}</strong> unit{sameTrimCount === 1 ? "" : "s"} of this exact trim
        {avgDays > 0 && (<>, averaging <strong>{avgDays} <span title={plainLang("daysOnLot")} className="cursor-help underline decoration-dotted underline-offset-2">days on lot</span></strong>.</>)}
      </p>
      <p className="text-xs text-fg-muted mt-1">
        {sameTrimCount >= 3 && avgDays >= 60 && "High pressure — they need to move metal."}
        {sameTrimCount >= 3 && avgDays < 60 && "Moderate — deep stock but moving."}
        {sameTrimCount < 3 && avgDays >= 60 && "Low — single aging unit; less urgency."}
        {sameTrimCount < 3 && avgDays < 60 && "Low — fresh stock."}
      </p>
    </Section>
  );
}

function UsedMarketSection({ stats, unit }: { stats: { medianPriceCad: number; medianKm: number; retentionPercent: number | null; count: number }; unit: ScoredUnit }) {
  return (
    <Section title="Used-market reference">
      <p className="text-sm">
        Median used <strong>{unit.model}</strong> ({stats.count} listings):
        <strong> {fmtCad(stats.medianPriceCad)}</strong> at <strong>{stats.medianKm.toLocaleString("en-CA")} km</strong>
        {stats.retentionPercent !== null && (<> · retention <strong>{stats.retentionPercent}%</strong> vs lowest new MSRP</>)}.
      </p>
      <p className="text-xs text-fg-muted mt-1">
        Use as depreciation evidence. Lower retention = stronger lever for new-car discount.
      </p>
    </Section>
  );
}

function TalkingPoints({ unit, dealer, cohort, avgDaysAtDealer }: { unit: ScoredUnit; dealer: { name: string; province: string }; cohort: ScoredUnit[]; avgDaysAtDealer: number }) {
  const cheapest = cohort[0];
  const points: string[] = [];
  if (unit.dealerAskingPrice > unit.msrp && unit.msrpSource !== "asking-fallback") {
    points.push(`Asking ${fmtCad(unit.dealerAskingPrice)} on a ${fmtCad(unit.msrp)} MSRP — that's ${fmtCad(unit.dealerAskingPrice - unit.msrp)} above invoice. Where's the room?`);
  }
  if (cheapest && cheapest.otdCad < unit.otdCad) {
    points.push(`Same ${unit.year} ${unit.trim} elsewhere is OTD ${fmtCad(cheapest.otdCad)} — ${fmtCad(unit.otdCad - cheapest.otdCad)} less than your number.`);
  }
  if (avgDaysAtDealer >= 60) {
    points.push(`These have averaged ${avgDaysAtDealer} days on your lot — what would it take to move it this week?`);
  }
  if (unit.applicableIncentives.length > 0) {
    const inc = unit.applicableIncentives.map((i) => i.name).join(", ");
    points.push(`Confirm stack: ${inc}.`);
  }
  if (points.length === 0) {
    points.push(`Lead with: "${dealer.name} is on my shortlist — what flexibility do you have on the OTD?"`);
  }
  return (
    <Section title="Talking points">
      <ol className="list-decimal list-inside space-y-1 text-sm">
        {points.map((p, i) => <li key={i}>{p}</li>)}
      </ol>
    </Section>
  );
}
