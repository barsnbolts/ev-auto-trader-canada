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
//
// Print styles live in globals.css under @media print and
// in src/app/inventory/[id]/dossier/dossier.module.css for layout.
//
// MEDIUM TODO (cosmetic-only — every data dep is wired):
//   - tighten talking-points wording per Ian's voice
//   - add a small "comparable" table column for province
//   - decide whether to surface heatPump status (depends on 3.1 landing)
//
// HIGH-only follow-ups:
//   - swap dealer phone source from enrichment to Apify when 2.2 lands

import { notFound } from "next/navigation";
import Link from "next/link";
import { loadScoredUnits, loadSpecs, loadUsedListings, computeUsedMarketStats } from "@/lib/data";
import { getBuyerContext } from "@/lib/buyerContextServer";
import { fmtCad, fmtDate } from "@/lib/format";
import type { ScoredUnit } from "@/lib/types";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function DossierPage({ params }: PageProps) {
  const { id } = await params;
  const ctx = await getBuyerContext();
  const [{ units, dealerById }, specs, used] = await Promise.all([
    loadScoredUnits(ctx.province),
    loadSpecs(),
    loadUsedListings(),
  ]);

  const unit = units.find((u) => u.id === id);
  if (!unit) return notFound();
  const dealer = dealerById.get(unit.dealerId);
  if (!dealer) return notFound();

  // Same-trim same-year cohort nationwide — top 3 cheaper or comparable by OTD
  const cohort = units
    .filter((u) => u.id !== unit.id && u.model === unit.model && u.trim === unit.trim && u.year === unit.year)
    .sort((a, b) => a.otdCad - b.otdCad)
    .slice(0, 3);

  // Same-trim depth + age at THIS dealer
  const sameTrimAtDealer = units.filter(
    (u) => u.dealerId === dealer.id && u.model === unit.model && u.trim === unit.trim,
  );
  const avgDaysAtDealer = sameTrimAtDealer.length
    ? Math.round(
        sameTrimAtDealer.reduce((s, u) => s + (u.daysOnLot ?? 0), 0) / sameTrimAtDealer.length,
      )
    : 0;

  // Used-market context for this nameplate
  const usedStats = computeUsedMarketStats(used, specs).find((s) => s.model === unit.model);

  return (
    <div className="dossier max-w-3xl mx-auto px-6 py-8 print:py-2 print:px-0 print:max-w-none">
      <div className="flex items-center justify-between print:hidden mb-4">
        <Link href="/inventory" className="text-xs text-fg-muted hover:text-fg">← Back to inventory</Link>
        <PrintButton />
      </div>

      <Header unit={unit} dealer={dealer} />
      <OtdSection unit={unit} ctx={ctx} />
      <CohortSection unit={unit} cohort={cohort} />
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

function Header({ unit, dealer }: { unit: ScoredUnit; dealer: { name: string; city: string; province: string; phone?: string } }) {
  return (
    <header className="border-b border-border pb-4">
      <h1 className="text-2xl font-semibold">{unit.year} {unit.model} {unit.trim}</h1>
      <div className="mt-1 text-sm text-fg-subtle">
        {unit.exteriorColor} / {unit.interiorColor}
        {unit.vin && ` · VIN ${unit.vin}`}
        {unit.stockNumber && ` · Stock #${unit.stockNumber}`}
      </div>
      <div className="mt-2 text-sm">
        <strong>{dealer.name}</strong> — {dealer.city}, {dealer.province}
        {dealer.phone && ` · ${dealer.phone}`}
      </div>
      {unit.listingUrl && (
        <a href={unit.listingUrl} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline print:hidden">
          Listing on AutoTrader ↗
        </a>
      )}
    </header>
  );
}

function OtdSection({ unit, ctx }: { unit: ScoredUnit; ctx: { province: string } }) {
  const b = unit.otdBreakdown;
  const row = (label: string, value: number, isCredit = false) => (
    <tr>
      <td className="py-1 pr-4">{label}</td>
      <td className="py-1 text-right tabular-nums">
        {isCredit ? "−" : ""}{fmtCad(Math.abs(value))}
      </td>
    </tr>
  );
  return (
    <Section title={`Out-the-door (taxed in ${ctx.province})`}>
      <table className="w-full text-sm">
        <tbody>
          {row("MSRP", b.msrp)}
          {row("Freight + PDI", b.freightPdi)}
          {row(b.dealerAdjustment >= 0 ? "Dealer markup" : "Dealer discount", b.dealerAdjustment, b.dealerAdjustment < 0)}
          {row("AC excise", b.acExciseTax)}
          {row("OMVIC + tire stewardship + RDPRM + licensing", b.omvic + b.tireStewardship + b.rdprm + b.govLicensing)}
          {b.transportCost > 0 && row(`Transport from ${unit.dealerId.split("-")[0].toUpperCase()}`, b.transportCost)}
          {row(`Sales tax (${b.salesTaxProvince})`, b.salesTax)}
          {b.incentivesApplied.map((i) => (
            <tr key={i.id} className="text-good">
              <td className="py-1 pr-4">− {i.name}</td>
              <td className="py-1 text-right tabular-nums">−{fmtCad(i.amountCad)}</td>
            </tr>
          ))}
          <tr className="border-t border-border font-semibold">
            <td className="py-2 pr-4">Total OTD</td>
            <td className="py-2 text-right tabular-nums">{fmtCad(b.total)}</td>
          </tr>
        </tbody>
      </table>
    </Section>
  );
}

function CohortSection({ unit, cohort }: { unit: ScoredUnit; cohort: ScoredUnit[] }) {
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
          <tr><th className="text-left py-1">Dealer</th><th className="text-right">Asking</th><th className="text-right">OTD</th><th className="text-right">Δ vs this</th></tr>
        </thead>
        <tbody>
          {cohort.map((c) => (
            <tr key={c.id}>
              <td className="py-1 pr-4">{c.dealerId}</td>
              <td className="text-right tabular-nums">{fmtCad(c.dealerAskingPrice)}</td>
              <td className="text-right tabular-nums">{fmtCad(c.otdCad)}</td>
              <td className={`text-right tabular-nums ${c.otdCad < unit.otdCad ? "text-good" : "text-fg-muted"}`}>
                {c.otdCad < unit.otdCad ? "−" : "+"}{fmtCad(Math.abs(c.otdCad - unit.otdCad))}
              </td>
            </tr>
          ))}
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
        {avgDays > 0 && (<>, averaging <strong>{avgDays} days</strong> on lot.</>)}
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
