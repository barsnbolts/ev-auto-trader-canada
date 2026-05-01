import Link from "next/link";
import { loadScoredUnits, loadMeta } from "@/lib/data";
import { computeKpis, dealerPressureMap, inGGH, provinceRollup } from "@/lib/aggregations";
import { MODELS, MODEL_LABEL, MODEL_BRAND, PROVINCE_NAMES } from "@/lib/constants";
import { fmtCad, relativeDays } from "@/lib/format";
import { KpiTile } from "@/components/KpiTile";
import { DealScoreBadge } from "@/components/DealScoreBadge";

export const dynamic = "force-static";

export default async function Dashboard() {
  const { units, dealers, dealerById, incentives } = await loadScoredUnits();
  const meta = await loadMeta();
  const kpis = computeKpis(units, dealerById, [...MODELS]);
  const pressure = dealerPressureMap(units, dealers);
  const provinces = provinceRollup(units, dealerById);

  const topDeals = [...units].sort((a, b) => b.dealScore - a.dealScore).slice(0, 8);
  const gghCount = units.filter((u) => inGGH(u, dealerById)).length;
  const activeIncentives = incentives.filter((i) => i.status === "active").length;
  const pausedIncentives = incentives.filter((i) => i.status === "paused").length;

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
            Kia EV6 · Hyundai Ioniq 5 · Hyundai Ioniq 6 (incl. N + GT trims). GTA-prioritized.
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
          label="Active incentives"
          value={activeIncentives}
          sub={pausedIncentives > 0 ? `${pausedIncentives} paused` : undefined}
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
                      <div className="font-medium">{MODEL_LABEL[u.model]}</div>
                      <div className="text-xxs text-fg-muted">{u.year} {u.trim}</div>
                    </td>
                    <td className="px-3 py-2 text-right num">{fmtCad(u.otdCad)}</td>
                    <td className="px-3 py-2 text-right num">
                      {delta > 0 ? <span className="text-accent">−{fmtCad(delta)}</span> : <span className="text-fg-subtle">at MSRP</span>}
                    </td>
                    <td className="px-3 py-2 text-right num">{u.daysOnLot ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">
                      <div>{d?.name}</div>
                      <div className="text-fg-subtle">{d?.city}, {d?.province}</div>
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
              <li key={row.d.id} className="px-4 py-2.5 flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">{row.d.name}</div>
                  <div className="text-xxs text-fg-subtle">
                    {row.d.city}, {row.d.province} · {row.count} unit{row.count === 1 ? "" : "s"}
                  </div>
                </div>
                <span className={`num font-semibold ${row.score >= 70 ? "text-accent" : row.score >= 40 ? "text-warn" : "text-fg-muted"}`}>
                  {row.score}
                </span>
              </li>
            ))}
            {highPressureDealers.length === 0 && (
              <li className="px-4 py-6 text-center text-fg-muted text-sm">No dealer data yet.</li>
            )}
          </ul>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm uppercase tracking-wide text-fg-subtle">National stock by province</h2>
        </div>
        <table className="w-full">
          <thead className="bg-bg-subtle text-xxs uppercase text-fg-subtle">
            <tr>
              <th className="px-3 py-2">Province</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-right">EV6</th>
              <th className="px-3 py-2 text-right">Ioniq 5</th>
              <th className="px-3 py-2 text-right">Ioniq 6</th>
            </tr>
          </thead>
          <tbody>
            {provinces.map((p) => (
              <tr key={p.province} className="border-t border-border">
                <td className="px-3 py-2">{PROVINCE_NAMES[p.province as keyof typeof PROVINCE_NAMES] ?? p.province}</td>
                <td className="px-3 py-2 text-right num font-medium">{p.count}</td>
                <td className="px-3 py-2 text-right num">{p.countByModel.EV6}</td>
                <td className="px-3 py-2 text-right num">{p.countByModel.Ioniq5}</td>
                <td className="px-3 py-2 text-right num">{p.countByModel.Ioniq6}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
