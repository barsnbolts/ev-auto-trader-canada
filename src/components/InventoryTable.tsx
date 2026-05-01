"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Dealer, ScoredUnit } from "@/lib/types";
import { MODEL_LABEL, GGH_CITIES, MODELS, type Model } from "@/lib/constants";
import { fmtCad } from "@/lib/format";
import { DealScoreBadge } from "./DealScoreBadge";
import { StatusChip } from "./StatusChip";
import { UnitDrawer } from "./UnitDrawer";

type Props = {
  units: ScoredUnit[];
  dealerById: Map<string, Dealer>;
  dealerPressureByDealer: Record<string, number>;
};

type SortKey = "deal" | "otd" | "discount" | "newest" | "oldest";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "deal", label: "Best deal score" },
  { key: "otd", label: "Lowest OTD" },
  { key: "discount", label: "Biggest discount vs MSRP" },
  { key: "newest", label: "Newest listing" },
  { key: "oldest", label: "Longest on lot" },
];

// Aging signal: any prior-MY unit that's been sitting >90 days. Shoppers can
// usually negotiate hardest on these.
const CURRENT_MY = 2026;
function isAgingOutgoing(year: number, daysOnLot?: number): boolean {
  return year < CURRENT_MY && (daysOnLot ?? 0) > 90;
}

const VALID_SORTS: SortKey[] = ["deal", "otd", "discount", "newest", "oldest"];

const CSV_COLS = [
  "model", "year", "trim", "drivetrain", "exteriorColor", "interiorColor",
  "msrp", "asking", "otd", "daysOnLot", "status",
  "dealerName", "dealerCity", "dealerProvince", "pressure",
] as const;

function csvEscape(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function exportCsv(
  units: ScoredUnit[],
  dealerById: Map<string, Dealer>,
  pressureByDealer: Record<string, number>,
) {
  const header = CSV_COLS.join(",");
  const rows = units.map((u) => {
    const d = dealerById.get(u.dealerId);
    return [
      u.model, u.year, u.trim, u.drivetrain, u.exteriorColor, u.interiorColor,
      u.msrp, u.dealerAskingPrice, u.otdCad, u.daysOnLot ?? "", u.status,
      d?.name ?? "", d?.city ?? "", d?.province ?? "", pressureByDealer[u.dealerId] ?? 0,
    ].map(csvEscape).join(",");
  });
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const a = document.createElement("a");
  a.href = url;
  a.download = `ev-inventory-${today}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function InventoryTable({ units, dealerById, dealerPressureByDealer }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initial = useMemo(() => {
    const m = searchParams.get("model");
    const y = searchParams.get("year");
    const dt = searchParams.get("dt");
    const rg = searchParams.get("region");
    const mp = searchParams.get("maxOtd");
    const po = searchParams.get("pressure");
    const so = searchParams.get("sort");
    return {
      model: (m && (MODELS as readonly string[]).includes(m) ? (m as Model) : "all") as Model | "all",
      year: (y && ["2024", "2025", "2026"].includes(y) ? Number(y) : "all") as number | "all",
      drivetrain: (dt === "RWD" || dt === "AWD" ? dt : "all") as "RWD" | "AWD" | "all",
      region: (rg === "on" || rg === "all" ? rg : "ggh") as "ggh" | "on" | "all",
      maxPrice: (mp && !Number.isNaN(Number(mp)) ? Number(mp) : "") as number | "",
      pressureOnly: po === "1",
      sort: ((so && VALID_SORTS.includes(so as SortKey)) ? (so as SortKey) : "deal") as SortKey,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [model, setModel] = useState<Model | "all">(initial.model);
  const [year, setYear] = useState<number | "all">(initial.year);
  const [drivetrain, setDrivetrain] = useState<"RWD" | "AWD" | "all">(initial.drivetrain);
  const [region, setRegion] = useState<"ggh" | "on" | "all">(initial.region);
  const [maxPrice, setMaxPrice] = useState<number | "">(initial.maxPrice);
  const [pressureOnly, setPressureOnly] = useState(initial.pressureOnly);
  const [sort, setSort] = useState<SortKey>(initial.sort);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const p = new URLSearchParams();
    if (model !== "all") p.set("model", model);
    if (year !== "all") p.set("year", String(year));
    if (drivetrain !== "all") p.set("dt", drivetrain);
    if (region !== "ggh") p.set("region", region);
    if (maxPrice !== "") p.set("maxOtd", String(maxPrice));
    if (pressureOnly) p.set("pressure", "1");
    if (sort !== "deal") p.set("sort", sort);
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [model, year, drivetrain, region, maxPrice, pressureOnly, sort, pathname, router]);

  const filtered = useMemo(() => {
    return units
      .filter((u) => {
        if (model !== "all" && u.model !== model) return false;
        if (year !== "all" && u.year !== year) return false;
        if (drivetrain !== "all" && u.drivetrain !== drivetrain) return false;
        const dealer = dealerById.get(u.dealerId);
        if (!dealer) return false;
        if (region === "ggh" && (dealer.province !== "ON" || !GGH_CITIES.includes(dealer.city))) return false;
        if (region === "on" && dealer.province !== "ON") return false;
        if (maxPrice && u.otdCad > Number(maxPrice)) return false;
        if (pressureOnly && (dealerPressureByDealer[dealer.id] ?? 0) < 50) return false;
        return true;
      })
      .sort((a, b) => {
        if (sort === "deal") return b.dealScore - a.dealScore;
        if (sort === "otd") return a.otdCad - b.otdCad;
        if (sort === "discount") {
          const da = (a.msrp - a.dealerAskingPrice) / a.msrp;
          const db = (b.msrp - b.dealerAskingPrice) / b.msrp;
          return db - da;
        }
        if (sort === "newest") return new Date(b.firstSeen).getTime() - new Date(a.firstSeen).getTime();
        return new Date(a.firstSeen).getTime() - new Date(b.firstSeen).getTime();
      });
  }, [units, dealerById, dealerPressureByDealer, model, year, drivetrain, region, maxPrice, pressureOnly, sort]);

  const selected = useMemo(
    () => (selectedId ? units.find((u) => u.id === selectedId) ?? null : null),
    [selectedId, units],
  );

  // Cheapest other listing of same model+year+trim — anchors the price ask in
  // the negotiation draft.
  const comparable = useMemo(() => {
    if (!selected) return undefined;
    return units
      .filter((u) =>
        u.id !== selected.id &&
        u.model === selected.model &&
        u.year === selected.year &&
        u.trim === selected.trim,
      )
      .sort((a, b) => a.otdCad - b.otdCad)[0];
  }, [selected, units]);

  return (
    <div className="card overflow-hidden">
      <div className="p-3 border-b border-border flex flex-wrap items-center gap-2 text-xs">
        <select
          value={model}
          onChange={(e) => setModel(e.target.value as Model | "all")}
          className="px-2 py-1.5"
        >
          <option value="all">All models</option>
          <option value="EV6">{MODEL_LABEL.EV6}</option>
          <option value="Ioniq5">{MODEL_LABEL.Ioniq5}</option>
          <option value="Ioniq6">{MODEL_LABEL.Ioniq6}</option>
        </select>
        <select
          value={year}
          onChange={(e) => setYear(e.target.value === "all" ? "all" : Number(e.target.value))}
          className="px-2 py-1.5"
        >
          <option value="all">All years</option>
          <option value={2024}>2024</option>
          <option value={2025}>2025</option>
          <option value={2026}>2026</option>
        </select>
        <select
          value={drivetrain}
          onChange={(e) => setDrivetrain(e.target.value as "RWD" | "AWD" | "all")}
          className="px-2 py-1.5"
        >
          <option value="all">RWD + AWD</option>
          <option value="RWD">RWD only</option>
          <option value="AWD">AWD only</option>
        </select>
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value as "ggh" | "on" | "all")}
          className="px-2 py-1.5"
        >
          <option value="ggh">Greater Golden Horseshoe</option>
          <option value="on">All Ontario</option>
          <option value="all">All Canada</option>
        </select>
        <label className="flex items-center gap-1 text-fg-muted">
          Max OTD
          <input
            type="number"
            inputMode="numeric"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder="65000"
            className="w-24 px-2 py-1.5 num"
          />
        </label>
        <label className="flex items-center gap-1.5 text-fg-muted cursor-pointer">
          <input
            type="checkbox"
            checked={pressureOnly}
            onChange={(e) => setPressureOnly(e.target.checked)}
          />
          High-pressure dealers only
        </label>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="px-2 py-1.5 ml-auto"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>{`Sort: ${s.label}`}</option>
          ))}
        </select>
        <span className="text-fg-subtle">{filtered.length} units</span>
        <button
          type="button"
          onClick={() => exportCsv(filtered, dealerById, dealerPressureByDealer)}
          className="px-2 py-1.5 border border-border rounded text-fg-muted hover:bg-bg-hover"
          disabled={filtered.length === 0}
        >
          Export CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-bg-subtle text-xxs uppercase text-fg-subtle">
            <tr>
              <th className="px-3 py-2">Deal</th>
              <th className="px-3 py-2">Model / Trim</th>
              <th className="px-3 py-2">Year</th>
              <th className="px-3 py-2">Color</th>
              <th className="px-3 py-2 text-right">MSRP</th>
              <th className="px-3 py-2 text-right">Asking</th>
              <th className="px-3 py-2 text-right">OTD</th>
              <th className="px-3 py-2 text-right">Days</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Dealer</th>
              <th className="px-3 py-2 text-right">Pressure</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const dealer = dealerById.get(u.dealerId);
              const pressure = dealerPressureByDealer[u.dealerId] ?? 0;
              return (
                <tr
                  key={u.id}
                  className="border-t border-border card-hover cursor-pointer"
                  onClick={() => setSelectedId(u.id)}
                >
                  <td className="px-3 py-2"><DealScoreBadge score={u.dealScore} /></td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{MODEL_LABEL[u.model]}</div>
                    <div className="text-xxs text-fg-muted">{u.trim} · {u.drivetrain}</div>
                  </td>
                  <td className="px-3 py-2 num">{u.year}</td>
                  <td className="px-3 py-2 text-xs">
                    <div>{u.exteriorColor}</div>
                    <div className="text-fg-subtle">{u.interiorColor}</div>
                  </td>
                  <td className="px-3 py-2 text-right num">{fmtCad(u.msrp)}</td>
                  <td className="px-3 py-2 text-right num">
                    {fmtCad(u.dealerAskingPrice)}
                    {u.dealerAskingPrice < u.msrp && (
                      <div className="text-xxs text-accent">
                        −{fmtCad(u.msrp - u.dealerAskingPrice)}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right num font-medium">{fmtCad(u.otdCad)}</td>
                  <td className="px-3 py-2 text-right num">{u.daysOnLot ?? "—"}</td>
                  <td className="px-3 py-2 space-y-1">
                    <StatusChip status={u.status} />
                    {isAgingOutgoing(u.year, u.daysOnLot) && (
                      <span className="chip-warn block w-fit">Aging MY{String(u.year).slice(-2)}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <div className="font-medium">{dealer?.name ?? "—"}</div>
                    <div className="text-fg-subtle">{dealer?.city}, {dealer?.province}</div>
                  </td>
                  <td className="px-3 py-2 text-right num">
                    <span className={pressure >= 70 ? "text-accent" : pressure >= 40 ? "text-warn" : "text-fg-muted"}>
                      {pressure}
                    </span>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-12 text-center text-fg-muted">
                  No units match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <UnitDrawer
        unit={selected}
        dealer={selected ? dealerById.get(selected.dealerId) : undefined}
        pressure={selected ? dealerPressureByDealer[selected.dealerId] ?? 0 : 0}
        comparable={comparable}
        comparableDealer={comparable ? dealerById.get(comparable.dealerId) : undefined}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
