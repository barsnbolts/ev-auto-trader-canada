"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadScoredUnits } from "@/lib/dataClient";
import { dealerPressureMap } from "@/lib/aggregations";
import { useBuyerContext } from "@/lib/buyerContext";
import { MODEL_LABEL, PROVINCE_NAMES } from "@/lib/constants";
import { fmtCad } from "@/lib/format";
import { DealScoreBadge } from "@/components/DealScoreBadge";
import { StatusChip } from "@/components/StatusChip";

type PageData = Awaited<ReturnType<typeof loadScoredUnits>>;

export function DealerClient({ dealerId }: { dealerId: string }) {
  const { buyerContext } = useBuyerContext();
  const [data, setData] = useState<PageData | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadScoredUnits(buyerContext).then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
  }, [buyerContext]);

  if (!data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-12 bg-bg-subtle rounded w-2/3" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-bg-subtle rounded" />
          ))}
        </div>
        <div className="h-64 bg-bg-subtle rounded" />
      </div>
    );
  }

  const { units, dealers } = data;
  const dealer = dealers.find((d) => d.id === dealerId);
  if (!dealer) notFound();

  const dealerUnits = units
    .filter((u) => u.dealerId === dealer.id)
    .sort((a, b) => b.dealScore - a.dealScore);
  const pressure = dealerPressureMap(units, dealers)[dealer.id] ?? 0;

  const lowestOtd = dealerUnits.length ? Math.min(...dealerUnits.map((u) => u.otdCad)) : null;
  const avgDays = dealerUnits.length
    ? Math.round(dealerUnits.reduce((s, u) => s + (u.daysOnLot ?? 0), 0) / dealerUnits.length)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/inventory" className="text-xs text-accent hover:text-accent-strong">← All inventory</Link>
        <h1 className="text-2xl font-semibold tracking-tight mt-1">{dealer.name}</h1>
        <p className="text-sm text-fg-muted">
          {dealer.brand} dealer · {dealer.address}, {dealer.city}, {PROVINCE_NAMES[dealer.province]}
          {dealer.postal ? ` ${dealer.postal}` : ""}
          {dealer.phone ? ` · ${dealer.phone}` : ""}
        </p>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label="Units in stock" value={dealerUnits.length} />
        <Tile label="Pressure score" value={pressure} accent={pressure >= 70 ? "accent" : pressure >= 40 ? "warn" : undefined} />
        <Tile label="Lowest OTD" value={lowestOtd ? fmtCad(lowestOtd) : "—"} />
        <Tile label="Avg days on lot" value={avgDays} />
      </section>

      {dealer.inventoryUrl && !dealer.inventoryUrl.startsWith("VERIFY") && (
        <a
          href={dealer.inventoryUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-accent hover:text-accent-strong inline-block"
        >
          Visit dealer site →
        </a>
      )}

      <section className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-sm uppercase tracking-wide text-fg-subtle">All units at this dealer</h2>
        </div>
        {dealerUnits.length === 0 ? (
          <p className="px-4 py-8 text-center text-fg-muted text-sm">No tracked units.</p>
        ) : (
          <table className="w-full">
            <thead className="bg-bg-subtle text-xxs uppercase text-fg-subtle">
              <tr>
                <th className="px-3 py-2">Score</th>
                <th className="px-3 py-2">Model · Trim</th>
                <th className="px-3 py-2">Year</th>
                <th className="px-3 py-2">Color</th>
                <th className="px-3 py-2 text-right">Asking</th>
                <th className="px-3 py-2 text-right">OTD</th>
                <th className="px-3 py-2 text-right">Days</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {dealerUnits.map((u) => (
                <tr key={u.id} className="border-t border-border card-hover">
                  <td className="px-3 py-2"><DealScoreBadge score={u.dealScore} /></td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/inventory?u=${u.id}&region=all`}
                      className="block hover:text-accent-strong"
                    >
                      <div className="font-medium">{MODEL_LABEL[u.model]}</div>
                      <div className="text-xxs text-fg-muted">{u.trim} · {u.drivetrain}</div>
                    </Link>
                  </td>
                  <td className="px-3 py-2 num">{u.year}</td>
                  <td className="px-3 py-2 text-xs">
                    <div>{u.exteriorColor}</div>
                    <div className="text-fg-subtle">{u.interiorColor}</div>
                  </td>
                  <td className="px-3 py-2 text-right num">{fmtCad(u.dealerAskingPrice)}</td>
                  <td className="px-3 py-2 text-right num font-medium">{fmtCad(u.otdCad)}</td>
                  <td className="px-3 py-2 text-right num">{u.daysOnLot ?? "—"}</td>
                  <td className="px-3 py-2"><StatusChip status={u.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Tile({ label, value, accent }: { label: string; value: string | number; accent?: "accent" | "warn" }) {
  const cls = accent === "accent" ? "text-accent" : accent === "warn" ? "text-warn" : "text-fg";
  return (
    <div className="card p-3">
      <div className="text-xxs uppercase tracking-wide text-fg-subtle">{label}</div>
      <div className={`text-2xl font-semibold mt-1 num ${cls}`}>{value}</div>
    </div>
  );
}
