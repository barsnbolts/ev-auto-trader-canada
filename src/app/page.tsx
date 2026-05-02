import Link from "next/link";
import { loadScoredUnits, loadMeta, loadUsedListings, loadSpecs, computeUsedMarketStats } from "@/lib/data";
import { getBuyerProvince } from "@/lib/buyerProvinceServer";
import { computeKpis, dealerPressureMap, inGGH, provinceRollup } from "@/lib/aggregations";
import { MODELS, MODEL_LABEL, MODEL_BRAND, PROVINCE_NAMES } from "@/lib/constants";
import { fmtCad, relativeDays } from "@/lib/format";
import { effectivePreTaxValue } from "@/lib/scoring";
import { KpiTile } from "@/components/KpiTile";
import { DealScoreBadge } from "@/components/DealScoreBadge";
import { UsedMarketPanel } from "@/components/UsedMarketPanel";
import type { ModelKpis } from "@/lib/aggregations";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const buyerProvince = await getBuyerProvince();
  const { units, dealers, dealerById, incentives } = await loadScoredUnits(buyerProvince);
  const meta = await loadMeta();
  const [usedListings, specs] = await Promise.all([loadUsedListings(), loadSpecs()]);
  const usedStatsLongRange = computeUsedMarketStats(usedListings, specs, false);
  const usedStatsAllTrims = computeUsedMarketStats(usedListings, specs, true);
  const kpis = computeKpis(units, dealerById, [...MODELS]);
  const pressure = dealerPressureMap(units, dealers);
  const provinces = provinceRollup(units, dealerById);

  // Filter out units with ask > MSRP + $5k (likely trim-mismatch or stale
  // DEFAULT_MSRP) — those poison "best deals" with false discount math.
  // See BLOCKERS_MEDIUM.md item F.
  const topDeals = [...units]
    .filter((u) => u.dealerAskingPrice <= u.msrp + 5000)
    .sort((a, b) => b.dealScore - a.dealScore)
    .slice(0, 8);
  const gghCount = units.filter((u) => inGGH(u, dealerById)).length;
  const activeIncentives = incentives.filter((i) => i.status === "active").length;
  const pausedIncentives = incentives.filter((i) => i.status === "paused").length;

  // EVAP-aware shopping signals. Eligible = unit's applicable list contains a
  // fed-evap-* row (cap test happens upstream in scoring.ts). Cliff = within
  // $1,500 over the cap → trimming dealer add-ons may unlock the rebate.
  // Surface incentives ending within 7 days at the top — these are the ones
  // dealers will use to pressure ("offer ends Friday") and the ones to lock
  // in fast if they apply.
  const now = Date.now();
  const SEVEN_DAYS_MS = 7 * 86_400_000;
  const expiringSoon = incentives.filter((i) => {
    if (i.status !== "active" || !i.effectiveUntil) return false;
    const t = new Date(i.effectiveUntil).getTime();
    if (Number.isNaN(t)) return false;
    return t > now && t - now <= SEVEN_DAYS_MS;
  }).sort((a, b) =>
    new Date(a.effectiveUntil ?? 0).getTime() - new Date(b.effectiveUntil ?? 0).getTime(),
  );

  const evapEligibleUnits = units.filter((u) => u.applicableIncentives.some((i) => i.id.startsWith("fed-evap")));
  const cliffUnits = units.filter((u) => {
    if (u.applicableIncentives.some((i) => i.id.startsWith("fed-evap"))) return false;
    const effective = effectivePreTaxValue(u, u.applicableIncentives);
    return effective > 50000 && effective - 50000 <= 1500;
  });
  const lowestEvapOtd = evapEligibleUnits.length
    ? Math.min(...evapEligibleUnits.map((u) => u.otdCad))
    : null;

  const highPressureDealers = dealers
    .map((d) => ({ d, score: pressure[d.id] ?? 0, count: units.filter((u) => u.dealerId === d.id).length }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">EV market dashboard — Canada</h1>
          <p className="text-sm text-fg-muted">
            Kia EV6, EV9 · Hyundai Ioniq 5, 6, 9 (all trims incl. GT / N / Performance). GTA-prioritized.
          </p>
          <p className="text-xxs text-fg-subtle mt-1">
            All OTD math assumes you&rsquo;re buying as a <span className="text-accent">{buyerProvince}</span> resident
            (sales tax + cross-province transport line). Switch via the selector top-right.
          </p>
        </div>
        <div className="text-xxs text-fg-subtle text-right space-y-0.5">
          <div>Inventory updated {relativeDays(meta.unitsUpdatedAt)}</div>
          <div>Incentives updated {relativeDays(meta.incentivesUpdatedAt)}</div>
          <div>{meta.snapshotCount} historical snapshot{meta.snapshotCount === 1 ? "" : "s"}</div>
        </div>
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiTile
          label="Units in GTA / GGH"
          value={gghCount}
          sub={`${units.length} nationwide`}
          accent="accent"
        />
        <KpiTile
          label="EVAP-eligible units"
          value={evapEligibleUnits.length}
          sub={lowestEvapOtd ? `Lowest OTD ${fmtCad(lowestEvapOtd)}` : "none under $50k cap"}
          accent={evapEligibleUnits.length > 0 ? "accent" : undefined}
        />
        <KpiTile
          label="Dealers tracked"
          value={dealers.length}
          sub={`${dealers.filter((d) => d.province === "ON").length} in Ontario`}
        />
        <KpiTile
          label="Best deal score"
          value={topDeals[0]?.dealScore ?? "—"}
          sub={topDeals[0] ? `${MODEL_LABEL[topDeals[0].model]} · ${topDeals[0].trim}` : "no units"}
          accent="accent"
        />
      </section>

      {expiringSoon.length > 0 && (
        <section className="card p-4 border-l-4 border-bad">
          <h2 className="text-sm font-semibold text-bad">
            Incentives expiring within 7 days — {expiringSoon.length}
          </h2>
          <ul className="mt-2 grid md:grid-cols-2 gap-1.5 text-xs">
            {expiringSoon.slice(0, 8).map((i) => {
              const days = Math.ceil((new Date(i.effectiveUntil ?? 0).getTime() - now) / 86_400_000);
              return (
                <li key={i.id} className="flex items-baseline justify-between gap-2 border-t border-border pt-1.5">
                  <span className="truncate" title={i.notes ?? i.name}>{i.name}</span>
                  <span className="num text-bad shrink-0">{days}d</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {cliffUnits.length > 0 && (
        <section className="card p-4 border-l-4 border-warn">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-sm font-semibold text-warn">
                Trim cliff alert — {cliffUnits.length} unit{cliffUnits.length === 1 ? "" : "s"} within $1,500 of the EVAP cap
              </h2>
              <p className="text-xxs text-fg-muted mt-1">
                These units sit just over the federal $50,000 transaction-value cap. Trimming
                dealer add-ons (admin fee, wheel locks, prep/protection) might bring them
                under and unlock $5,000.
              </p>
            </div>
            <Link href="/inventory?evap=&region=all" className="text-xs text-accent hover:text-accent-strong">
              See cliff units →
            </Link>
          </div>
          <ul className="mt-3 grid md:grid-cols-2 gap-2 text-xs">
            {cliffUnits.slice(0, 6).map((u) => {
              const d = dealerById.get(u.dealerId);
              const effective = effectivePreTaxValue(u, u.applicableIncentives);
              const over = Math.round(effective - 50000);
              return (
                <li key={u.id} className="flex items-baseline justify-between gap-2 border-t border-border pt-1.5">
                  <Link href={`/inventory?u=${u.id}&region=all`} className="hover:text-accent-strong truncate">
                    {MODEL_LABEL[u.model]} {u.trim} <span className="text-fg-subtle">· {d?.city}</span>
                  </Link>
                  <span className="num text-warn shrink-0">+${over.toLocaleString("en-CA")}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-sm uppercase tracking-wide text-fg-subtle mb-3">Model mix</h2>
        <ModelMixBars kpis={kpis} />
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-wide text-fg-subtle mb-3">Per-model snapshot</h2>
        <div className="grid md:grid-cols-3 gap-3">
          {kpis.map((k) => (
            <div key={k.model} className="card p-4 space-y-3">
              <div className="flex items-baseline justify-between">
                <h3 className="font-semibold">{MODEL_LABEL[k.model]}</h3>
                <span className="chip chip-neutral">{MODEL_BRAND[k.model]}</span>
              </div>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <span className="text-fg-muted">In GGH</span>
                <span className="num text-right">{k.totalGgh}</span>
                <span className="text-fg-muted">Canada-wide</span>
                <span className="num text-right">{k.totalCanada}</span>
                <span className="text-fg-muted">Lowest OTD (GGH)</span>
                <span className="num text-right">{k.lowestOtdGgh ? fmtCad(k.lowestOtdGgh) : "—"}</span>
                <span className="text-fg-muted">Lowest OTD (CA)</span>
                <span className="num text-right">{k.lowestOtdCanada ? fmtCad(k.lowestOtdCanada) : "—"}</span>
                <span className="text-fg-muted">Best deal score</span>
                <span className="num text-right text-accent">{k.bestDealScoreCanada ?? "—"}</span>
                <span className="text-fg-muted">Avg days on lot</span>
                <span className="num text-right">{k.avgDaysOnLotCanada}</span>
              </div>
              <Link
                href={`/inventory?model=${k.model}`}
                className="text-xs text-accent hover:text-accent-strong"
              >
                See {MODEL_LABEL[k.model]} inventory →
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm uppercase tracking-wide text-fg-subtle">Top deals right now</h2>
            <Link href="/inventory" className="text-xs text-accent hover:text-accent-strong">View all →</Link>
          </div>
          <table className="w-full">
            <thead className="bg-bg-subtle text-xxs uppercase text-fg-subtle">
              <tr>
                <th className="px-3 py-2">Score</th>
                <th className="px-3 py-2">Model · Trim</th>
                <th className="px-3 py-2 text-right">OTD</th>
                <th className="px-3 py-2 text-right">vs MSRP</th>
                <th className="px-3 py-2 text-right">Days</th>
                <th className="px-3 py-2">Dealer</th>
              </tr>
            </thead>
            <tbody>
              {topDeals.map((u) => {
                const d = dealerById.get(u.dealerId);
                const delta = u.msrp - u.dealerAskingPrice;
                return (
                  <tr key={u.id} className="border-t border-border card-hover">
                    <td className="px-3 py-2"><DealScoreBadge score={u.dealScore} /></td>
                    <td className="px-3 py-2">
                      <Link href={`/inventory?u=${u.id}&region=all`} className="block hover:text-accent-strong">
                        <div className="font-medium">{MODEL_LABEL[u.model]}</div>
                        <div className="text-xxs text-fg-muted">{u.year} {u.trim}</div>
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right num">{fmtCad(u.otdCad)}</td>
                    <td className="px-3 py-2 text-right num">
                      {delta > 0 ? <span className="text-accent">−{fmtCad(delta)}</span> : <span className="text-fg-subtle">at MSRP</span>}
                    </td>
                    <td className="px-3 py-2 text-right num">{u.daysOnLot ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">
                      <div>{d?.name}</div>
                      <div className="text-fg-subtle">{d?.city}, {d?.province}</div>
                      {u.listingUrl && (
                        <a
                          href={u.listingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xxs text-accent hover:text-accent-strong inline-block mt-0.5"
                        >
                          AutoTrader ↗
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm uppercase tracking-wide text-fg-subtle">High-pressure dealers</h2>
            <p className="text-xxs text-fg-subtle mt-1">
              Composite of inventory depth + days on lot. Where to push hardest on price.
            </p>
          </div>
          <ul className="divide-y divide-border">
            {highPressureDealers.map((row) => (
              <li key={row.d.id}>
                <Link
                  href={`/dealer/${row.d.id}`}
                  className="px-4 py-2.5 flex items-center justify-between card-hover"
                >
                  <div>
                    <div className="font-medium text-sm">{row.d.name}</div>
                    <div className="text-xxs text-fg-subtle">
                      {row.d.city}, {row.d.province} · {row.count} unit{row.count === 1 ? "" : "s"}
                    </div>
                  </div>
                  <span className={`num font-semibold ${row.score >= 70 ? "text-accent" : row.score >= 40 ? "text-warn" : "text-fg-muted"}`}>
                    {row.score}
                  </span>
                </Link>
              </li>
            ))}
            {highPressureDealers.length === 0 && (
              <li className="px-4 py-6 text-center text-fg-muted text-sm">No dealer data yet.</li>
            )}
          </ul>
        </div>
      </section>

      <UsedMarketPanel
        statsLongRange={usedStatsLongRange}
        statsAllTrims={usedStatsAllTrims}
        totalUsedCount={usedListings.length}
      />

      <section className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm uppercase tracking-wide text-fg-subtle">National stock by province</h2>
        </div>
        <table className="w-full">
          <thead className="bg-bg-subtle text-xxs uppercase text-fg-subtle">
            <tr>
              <th className="px-3 py-2">Province</th>
              <th className="px-3 py-2 text-right">Total</th>
              {MODELS.map((m) => (
                <th key={m} className="px-3 py-2 text-right">{MODEL_LABEL[m]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {provinces.map((p) => (
              <tr key={p.province} className="border-t border-border">
                <td className="px-3 py-2">{PROVINCE_NAMES[p.province as keyof typeof PROVINCE_NAMES] ?? p.province}</td>
                <td className="px-3 py-2 text-right num font-medium">{p.count}</td>
                {MODELS.map((m) => (
                  <td key={m} className="px-3 py-2 text-right num">{p.countByModel[m]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

const MIX_COLORS: Record<string, string> = {
  EV6: "bg-accent",
  Ioniq5: "bg-warn",
  Ioniq6: "bg-fg-muted",
  EV9: "bg-accent-strong",
  Ioniq9: "bg-bad",
};

function ModelMixBars({ kpis }: { kpis: ModelKpis[] }) {
  const totalCanada = kpis.reduce((s, k) => s + k.totalCanada, 0);
  const totalGgh = kpis.reduce((s, k) => s + k.totalGgh, 0);
  return (
    <div className="card p-4 space-y-4">
      <MixRow label="Greater Golden Horseshoe" total={totalGgh} kpis={kpis} field="totalGgh" />
      <MixRow label="Canada-wide" total={totalCanada} kpis={kpis} field="totalCanada" />
      <div className="flex gap-4 text-xxs text-fg-subtle pt-1">
        {kpis.map((k) => (
          <span key={k.model} className="flex items-center gap-1.5">
            <span className={`inline-block w-2 h-2 rounded ${MIX_COLORS[k.model]}`} />
            {MODEL_LABEL[k.model]}
          </span>
        ))}
      </div>
    </div>
  );
}

function MixRow({
  label,
  total,
  kpis,
  field,
}: {
  label: string;
  total: number;
  kpis: ModelKpis[];
  field: "totalCanada" | "totalGgh";
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-xxs text-fg-subtle mb-1">
        <span className="uppercase tracking-wide">{label}</span>
        <span className="num">{total} unit{total === 1 ? "" : "s"}</span>
      </div>
      <div className="flex w-full h-3 rounded overflow-hidden bg-bg-subtle">
        {total === 0 ? null : kpis.map((k) => {
          const count = k[field];
          if (count === 0) return null;
          const pct = (count / total) * 100;
          return (
            <div
              key={k.model}
              className={MIX_COLORS[k.model]}
              style={{ width: `${pct}%` }}
              title={`${MODEL_LABEL[k.model]}: ${count} (${pct.toFixed(0)}%)`}
            />
          );
        })}
      </div>
    </div>
  );
}
