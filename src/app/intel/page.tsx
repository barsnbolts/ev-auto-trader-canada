import { loadMarketIntel, loadTaxesAndFees, loadScoredUnits } from "@/lib/data";
import { fmtCad, fmtDate } from "@/lib/format";
import { MODEL_LABEL, PROVINCE_NAMES } from "@/lib/constants";
import type { Province } from "@/lib/constants";

export const dynamic = "force-static";

export default async function IntelPage() {
  const [intel, fees, { units }] = await Promise.all([
    loadMarketIntel(),
    loadTaxesAndFees(),
    loadScoredUnits(),
  ]);

  if (!intel || !fees) {
    return (
      <div className="card p-6 text-fg-muted">
        Market intel data not yet seeded. Add <code>data/market-intel.json</code> and
        <code>data/taxes-and-fees.json</code> to populate this page.
      </div>
    );
  }

  // Cheapest EVAP-eligible E-GMP unit, used as the cross-comparison anchor
  // for the competitor table. If we have no eligible units, fall back to
  // the cheapest unit overall.
  const evapEligible = units.filter((u) => u.applicableIncentives.some((i) => i.id.startsWith("fed-evap")));
  const anchorPool = evapEligible.length > 0 ? evapEligible : units;
  const anchor = anchorPool.length > 0
    ? [...anchorPool].sort((a, b) => a.otdCad - b.otdCad)[0]
    : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Market intel</h1>
        <p className="text-sm text-fg-muted">
          Recall families, warranty terms, competitor benchmarks, and Canadian
          taxation/fee structure. Use as negotiation context.
        </p>
      </div>

      {/* Recall families */}
      <section className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm uppercase tracking-wide text-fg-subtle">
            Recall risk: ICCU on E-GMP cars
          </h2>
        </div>
        <ul className="divide-y divide-border">
          {intel.knownIssues.map((issue, i) => (
            <li key={i} className="px-4 py-3 space-y-2">
              <div className="flex items-baseline justify-between flex-wrap gap-2">
                <div>
                  <span className="font-medium">
                    {issue.model ? MODEL_LABEL[issue.model] : "All E-GMP"}
                  </span>
                  <span className="text-fg-muted text-xs ml-2">{issue.yearRange}</span>
                </div>
                <SeverityChip severity={issue.severity} />
              </div>
              <p className="text-sm text-fg-muted leading-relaxed">{issue.issue}</p>
              {issue.resolution && (
                <p className="text-xs text-fg-subtle leading-relaxed border-l-2 border-border pl-3">
                  <span className="font-medium text-fg-muted">Resolution:</span> {issue.resolution}
                </p>
              )}
              {(issue.warrantyExtensionYears || issue.warrantyExtensionKm) && (
                <div className="text-xxs text-accent">
                  Warranty extension: {issue.warrantyExtensionYears} yr / {(issue.warrantyExtensionKm ?? 0).toLocaleString("en-CA")} km
                </div>
              )}
              {issue.source && (
                <a
                  href={issue.source}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xxs text-accent hover:text-accent-strong break-all"
                >
                  {issue.source}
                </a>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Competitor benchmarks */}
      <section className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm uppercase tracking-wide text-fg-subtle">
            Cross-shop benchmarks (post-EVAP)
          </h2>
          {anchor && (
            <p className="text-xxs text-fg-subtle mt-1">
              Anchored against your cheapest{" "}
              {evapEligible.length > 0 ? "EVAP-eligible" : "tracked"} unit:{" "}
              <span className="text-fg-muted">
                {MODEL_LABEL[anchor.model]} {anchor.trim} at {fmtCad(anchor.otdCad)} OTD
              </span>
            </p>
          )}
        </div>
        <table className="w-full text-sm">
          <thead className="bg-bg-subtle text-xxs uppercase text-fg-subtle">
            <tr>
              <th className="px-3 py-2 text-left">Model</th>
              <th className="px-3 py-2 text-right">MSRP</th>
              <th className="px-3 py-2 text-right">Range</th>
              <th className="px-3 py-2">EVAP</th>
              <th className="px-3 py-2 text-right">Effective MSRP</th>
            </tr>
          </thead>
          <tbody>
            {intel.competingEvs.map((c, i) => {
              const eff = c.qualifiesForEvap && c.msrpCad ? c.msrpCad - 5000 : c.msrpCad;
              return (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-2">
                    <div className="font-medium">{c.make} {c.model}</div>
                    <div className="text-xxs text-fg-muted">
                      {c.year} {c.drivetrain}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right num">{c.msrpCad ? fmtCad(c.msrpCad) : "—"}</td>
                  <td className="px-3 py-2 text-right num">{c.rangeKm ? `${c.rangeKm} km` : "—"}</td>
                  <td className="px-3 py-2">
                    {c.qualifiesForEvap ? (
                      <span className="chip-accent">−$5,000 ✓</span>
                    ) : (
                      <span className="chip-bad">over cap</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right num font-medium">
                    {eff ? fmtCad(eff) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* Warranty terms */}
      <section className="grid md:grid-cols-2 gap-3">
        <div className="card p-4">
          <h3 className="text-xxs uppercase tracking-wide text-fg-subtle mb-2">Battery warranty</h3>
          <dl className="text-sm space-y-1">
            <Row label="Kia">{intel.warrantyTerms.kiaBatteryYears} yr / {intel.warrantyTerms.kiaBatteryKm.toLocaleString("en-CA")} km</Row>
            <Row label="Hyundai">{intel.warrantyTerms.hyundaiBatteryYears} yr / {intel.warrantyTerms.hyundaiBatteryKm.toLocaleString("en-CA")} km</Row>
          </dl>
        </div>
        {intel.warrantyTerms.iccuExtensionYears && (
          <div className="card p-4 border-l-4 border-accent">
            <h3 className="text-xxs uppercase tracking-wide text-fg-subtle mb-2">
              ICCU extended coverage
            </h3>
            <dl className="text-sm space-y-1">
              <Row label="Coverage">
                {intel.warrantyTerms.iccuExtensionYears} yr / {intel.warrantyTerms.iccuExtensionKm?.toLocaleString("en-CA")} km
              </Row>
              <Row label="Applies to">All E-GMP cars in the recall family above</Row>
            </dl>
          </div>
        )}
      </section>

      {/* Taxes + fees */}
      <section className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm uppercase tracking-wide text-fg-subtle">
            Sales tax + dealer-fee structure
          </h2>
        </div>
        <div className="grid md:grid-cols-2 divide-x divide-border">
          <div className="p-4">
            <h3 className="text-xxs uppercase tracking-wide text-fg-subtle mb-2">Sales tax by province</h3>
            <table className="w-full text-sm">
              <tbody>
                {Object.entries(fees.salesTaxByProvince).map(([prov, t]) => {
                  const total = t.ratePercent ?? ((t.gstPercent ?? 0) + (t.pstPercent ?? 0) + (t.qstPercent ?? 0));
                  return (
                    <tr key={prov} className="border-t border-border first:border-t-0">
                      <td className="py-1.5 pr-3 text-fg-muted">
                        {PROVINCE_NAMES[prov as Province] ?? prov}
                      </td>
                      <td className="py-1.5 pr-3 text-xxs text-fg-subtle">{t.type}</td>
                      <td className="py-1.5 text-right num">{total}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <h3 className="text-xxs uppercase tracking-wide text-fg-subtle mb-2">
                Ontario per-deal fees (post-tax line items)
              </h3>
              <dl className="text-sm space-y-1">
                <Row label="A/C excise">{fmtCad(fees.ontarioDealerFees.acExciseTaxCad)}</Row>
                <Row label="OMVIC">{fmtCad(fees.ontarioDealerFees.omvicCad)}</Row>
                <Row label="Tire stewardship">{fmtCad(fees.ontarioDealerFees.tireStewardshipCad)}</Row>
                <Row label="Gov licensing">{fmtCad(fees.ontarioDealerFees.govLicensingCad)}</Row>
              </dl>
            </div>
            <div>
              <h3 className="text-xxs uppercase tracking-wide text-fg-subtle mb-2">BC progressive PST</h3>
              <table className="w-full text-xs">
                <tbody>
                  {fees.bcVehicleSurtaxBrackets.map((b, i) => (
                    <tr key={i} className="border-t border-border first:border-t-0">
                      <td className="py-1 text-fg-muted">
                        {fmtCad(b.minPriceCad)} – {b.maxPriceCad ? fmtCad(b.maxPriceCad) : "∞"}
                      </td>
                      <td className="py-1 text-right num">{b.ratePercent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xxs text-fg-subtle mt-1">5% federal GST stacks on top.</p>
            </div>
          </div>
        </div>
      </section>

      {/* OEM May 2026 subventions */}
      {intel.oemSubventions2026May && (
        <section className="grid md:grid-cols-2 gap-3">
          {intel.oemSubventions2026May.Kia && (
            <div className="card p-4">
              <h3 className="text-xxs uppercase tracking-wide text-fg-subtle mb-2">Kia May 2026</h3>
              <dl className="text-sm space-y-1">
                {intel.oemSubventions2026May.Kia.loyaltyRateReductionPercent !== undefined && (
                  <Row label="Loyalty rate reduction">
                    {intel.oemSubventions2026May.Kia.loyaltyRateReductionPercent}%
                  </Row>
                )}
                {intel.oemSubventions2026May.Kia.militaryCad !== undefined && (
                  <Row label="Military benefit">{fmtCad(intel.oemSubventions2026May.Kia.militaryCad)}</Row>
                )}
                {intel.oemSubventions2026May.Kia.mobilityCad !== undefined && (
                  <Row label="Mobility allowance">{fmtCad(intel.oemSubventions2026May.Kia.mobilityCad)}</Row>
                )}
              </dl>
            </div>
          )}
          {intel.oemSubventions2026May.Hyundai && (
            <div className="card p-4">
              <h3 className="text-xxs uppercase tracking-wide text-fg-subtle mb-2">Hyundai May 2026</h3>
              <dl className="text-sm space-y-1">
                {intel.oemSubventions2026May.Hyundai.springDriveBonusMaxCad !== undefined && (
                  <Row label="Spring Drive Bonus (max)">
                    {fmtCad(intel.oemSubventions2026May.Hyundai.springDriveBonusMaxCad)}
                  </Row>
                )}
                {intel.oemSubventions2026May.Hyundai.leaseSecurityDepositCad !== undefined && (
                  <Row label="Lease security deposit">
                    {fmtCad(intel.oemSubventions2026May.Hyundai.leaseSecurityDepositCad)}
                  </Row>
                )}
                {intel.oemSubventions2026May.Hyundai.leaseAnnualKm !== undefined && (
                  <Row label="Lease annual km">
                    {intel.oemSubventions2026May.Hyundai.leaseAnnualKm.toLocaleString("en-CA")} km · ${intel.oemSubventions2026May.Hyundai.leaseOverageCadPerKm}/km over
                  </Row>
                )}
                {intel.oemSubventions2026May.Hyundai.loyaltyLeaseRateReductionPercent !== undefined && (
                  <Row label="Loyalty lease rate cut">
                    {intel.oemSubventions2026May.Hyundai.loyaltyLeaseRateReductionPercent}%
                  </Row>
                )}
              </dl>
            </div>
          )}
        </section>
      )}

      {intel.endOfMonthSignal && (
        <section className="card p-4 border-l-4 border-warn">
          <h3 className="text-xxs uppercase tracking-wide text-warn mb-1">Timing signal</h3>
          <p className="text-sm text-fg-muted leading-relaxed">{intel.endOfMonthSignal}</p>
        </section>
      )}

      <p className="text-xxs text-fg-subtle text-right">
        Intel verified {fmtDate(intel.lastVerified)} · taxes/fees verified {fmtDate(fees.lastVerified)}
      </p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-fg-muted text-xs">{label}</dt>
      <dd className="text-fg num text-sm text-right">{children}</dd>
    </div>
  );
}

function SeverityChip({ severity }: { severity: "low" | "medium" | "high" }) {
  if (severity === "high") return <span className="chip-bad">High severity</span>;
  if (severity === "medium") return <span className="chip-warn">Medium</span>;
  return <span className="chip-neutral">Low</span>;
}
