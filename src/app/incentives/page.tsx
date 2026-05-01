import { loadIncentives, loadMeta } from "@/lib/data";
import { fmtCad, fmtDate, fmtPercent } from "@/lib/format";
import type { Incentive, IncentiveScope } from "@/lib/types";
import { PROVINCE_NAMES } from "@/lib/constants";
import { UpdatedStamp } from "@/components/UpdatedStamp";

export const dynamic = "force-static";

const SCOPE_LABEL: Record<IncentiveScope, string> = {
  federal: "Federal",
  provincial: "Provincial",
  manufacturer_cash: "Manufacturer cash",
  loyalty: "Loyalty",
  conquest: "Conquest",
  lease_promo: "Lease promo",
  finance_promo: "Finance promo",
  charger_install: "Charger install",
};

const SCOPE_ORDER: IncentiveScope[] = [
  "federal",
  "provincial",
  "manufacturer_cash",
  "loyalty",
  "conquest",
  "lease_promo",
  "finance_promo",
  "charger_install",
];

export default async function IncentivesPage() {
  const [incentives, meta] = await Promise.all([loadIncentives(), loadMeta()]);
  const byScope = new Map<IncentiveScope, Incentive[]>();
  for (const i of incentives) {
    const arr = byScope.get(i.scope) ?? [];
    arr.push(i);
    byScope.set(i.scope, arr);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Incentives & financing</h1>
          <p className="text-sm text-fg-muted">
            Federal, provincial, manufacturer, lease/finance, and home-charger rebates. Always re-verify before signing — sources linked when available.
          </p>
        </div>
        <UpdatedStamp rows={[{ label: "Incentives updated", iso: meta.incentivesUpdatedAt }]} />
      </div>
      {SCOPE_ORDER.filter((scope) => byScope.has(scope)).map((scope) => (
        <section key={scope} className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-baseline justify-between">
            <h2 className="font-semibold">{SCOPE_LABEL[scope]}</h2>
            <span className="text-xxs text-fg-subtle">
              {byScope.get(scope)?.length ?? 0} program{byScope.get(scope)?.length === 1 ? "" : "s"}
            </span>
          </div>
          <ul className="divide-y divide-border">
            {byScope.get(scope)!.map((inc) => (
              <li key={inc.id} className="px-4 py-3 flex flex-wrap items-start gap-x-6 gap-y-2">
                <div className="flex-1 min-w-[280px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{inc.name}</span>
                    <StatusPill status={inc.status} />
                  </div>
                  <div className="text-xxs text-fg-subtle mt-0.5 flex flex-wrap gap-x-3">
                    {inc.appliesTo?.provinces?.length && (
                      <span>
                        {inc.appliesTo.provinces
                          .map((p) => PROVINCE_NAMES[p])
                          .join(", ")}
                      </span>
                    )}
                    {inc.appliesTo?.models?.length && (
                      <span>{inc.appliesTo.models.join(" · ")}</span>
                    )}
                    {inc.effectiveUntil && (
                      <span>Until {fmtDate(inc.effectiveUntil)}</span>
                    )}
                    <span>Verified {fmtDate(inc.lastVerified)}</span>
                  </div>
                  {inc.notes && (
                    <p className="text-xxs text-fg-muted mt-1.5 leading-relaxed max-w-2xl">
                      {inc.notes}
                    </p>
                  )}
                  {inc.source && (
                    <a
                      href={inc.source.startsWith("http") ? inc.source : undefined}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xxs text-accent hover:text-accent-strong mt-1 inline-block break-all"
                    >
                      {inc.source}
                    </a>
                  )}
                </div>
                <div className="text-right num">
                  {inc.amountCad ? (
                    <div className="text-lg font-semibold">{fmtCad(inc.amountCad)}</div>
                  ) : null}
                  {inc.aprPercent !== undefined && (
                    <div className="text-sm">
                      {fmtPercent(inc.aprPercent)} {inc.termMonths ? `/ ${inc.termMonths} mo` : ""}
                    </div>
                  )}
                  {inc.monthlyPaymentExample && (
                    <div className="text-xxs text-fg-muted">
                      ~{fmtCad(inc.monthlyPaymentExample)}/mo
                      {inc.downPaymentExample !== undefined && ` · ${fmtCad(inc.downPaymentExample)} down`}
                    </div>
                  )}
                  {inc.residualPercent !== undefined && (
                    <div className="text-xxs text-fg-muted">{fmtPercent(inc.residualPercent, 0)} residual</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function StatusPill({ status }: { status: Incentive["status"] }) {
  if (status === "active") return <span className="chip-accent">Active</span>;
  if (status === "paused") return <span className="chip-warn">Paused</span>;
  if (status === "upcoming") return <span className="chip-neutral">Upcoming</span>;
  return <span className="chip-bad">Ended</span>;
}
