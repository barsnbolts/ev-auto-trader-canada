import Link from "next/link";
import { loadSnapshots, loadMeta } from "@/lib/data";
import { fmtDate } from "@/lib/format";
import { MODELS, MODEL_LABEL } from "@/lib/constants";
import { HistoryCountChart, HistoryPriceChart, type SeriesPoint } from "@/components/HistoryCharts";
import { UpdatedStamp } from "@/components/UpdatedStamp";

export const dynamic = "force-static";

export default async function HistoryPage() {
  const [snapshots, meta] = await Promise.all([loadSnapshots(), loadMeta()]);

  if (snapshots.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">History</h1>
          <p className="text-sm text-fg-muted">
            Inventory and price trends over time, built from scheduled snapshots of the live data.
          </p>
        </div>
        <div className="card p-8 text-center space-y-2">
          <p className="text-fg-muted">No snapshots yet.</p>
          <p className="text-xs text-fg-subtle">
            Run <code className="text-accent">npm run snapshot</code> to capture the current state into{" "}
            <code className="text-accent">/data/snapshots/</code>. Each run appends one timestamped JSON file.
          </p>
        </div>
      </div>
    );
  }

  const countData: SeriesPoint[] = snapshots.map((s) => {
    const point: SeriesPoint = { date: s.takenAt.slice(0, 10) };
    for (const model of MODELS) {
      point[model] = s.units.filter((u) => u.model === model).length;
    }
    return point;
  });

  const priceData: SeriesPoint[] = snapshots.map((s) => {
    const point: SeriesPoint = { date: s.takenAt.slice(0, 10) };
    for (const model of MODELS) {
      const subset = s.units.filter((u) => u.model === model);
      point[model] = subset.length
        ? Math.round(subset.reduce((sum, u) => sum + u.askingPrice, 0) / subset.length)
        : 0;
    }
    return point;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">History</h1>
          <p className="text-sm text-fg-muted">
            {snapshots.length} snapshot{snapshots.length === 1 ? "" : "s"} from {fmtDate(snapshots[0].takenAt)} → {fmtDate(snapshots[snapshots.length - 1].takenAt)}
          </p>
        </div>
        <UpdatedStamp rows={[{ label: "Latest snapshot", iso: meta.lastSnapshotAt }]} />
      </div>

      <section className="card p-4 space-y-2">
        <h2 className="text-sm uppercase tracking-wide text-fg-subtle">Inventory count over time</h2>
        <HistoryCountChart
          data={countData}
          series={[
            { key: "EV6", label: MODEL_LABEL.EV6, color: "#6ee7b7" },
            { key: "Ioniq5", label: MODEL_LABEL.Ioniq5, color: "#fbbf24" },
            { key: "Ioniq6", label: MODEL_LABEL.Ioniq6, color: "#60a5fa" },
          ]}
        />
      </section>

      <section className="card p-4 space-y-2">
        <h2 className="text-sm uppercase tracking-wide text-fg-subtle">Average asking price over time</h2>
        <HistoryPriceChart data={priceData} />
      </section>

      <section className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm uppercase tracking-wide text-fg-subtle">Snapshot ledger</h2>
        </div>
        <table className="w-full">
          <thead className="bg-bg-subtle text-xxs uppercase text-fg-subtle">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2 text-right">Total units</th>
              <th className="px-3 py-2 text-right">EV6</th>
              <th className="px-3 py-2 text-right">Ioniq 5</th>
              <th className="px-3 py-2 text-right">Ioniq 6</th>
            </tr>
          </thead>
          <tbody>
            {snapshots.slice().reverse().map((s) => (
              <tr key={s.takenAt} className="border-t border-border">
                <td className="px-3 py-2">{fmtDate(s.takenAt)}</td>
                <td className="px-3 py-2 text-right num font-medium">{s.unitCount}</td>
                {MODELS.map((m) => (
                  <td key={m} className="px-3 py-2 text-right num">
                    {s.units.filter((u) => u.model === m).length}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="text-xxs text-fg-subtle">
        Append a new snapshot any time with <code className="text-accent">npm run snapshot</code>.{" "}
        <Link href="/inventory" className="text-accent hover:text-accent-strong">View current inventory →</Link>
      </p>
    </div>
  );
}
