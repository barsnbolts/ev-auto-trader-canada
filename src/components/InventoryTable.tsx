"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Dealer, ScoredUnit } from "@/lib/types";
import { MODEL_LABEL, GGH_CITIES, MODELS, SUPPORTED_YEARS, type Model } from "@/lib/constants";
import { fmtCad } from "@/lib/format";
import { effectivePreTaxValue } from "@/lib/scoring";
import { useFavorites } from "@/lib/useFavorites";
import { DealScoreBadge } from "./DealScoreBadge";
import { StatusChip } from "./StatusChip";
import { UnitDrawer } from "./UnitDrawer";

// Days since lastSeen — used to chip rows that haven't been re-confirmed
// recently. Anything > 7 days is at risk of being sold or pulled.
function daysSince(iso: string): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

// EVAP cap is the central 2026 buying-decision tool. We surface three
// states per unit: eligible (under cap, $5k applied to OTD), cliff
// (within $1,500 over the cap — small accessory cuts may unlock it), and
// over-cap (lost rebate, used for sorting and competitor benchmarking).
type EvapState = "eligible" | "cliff" | "over";
const CAP_CAD = 50000;
const CLIFF_BAND_CAD = 1500;
function evapStateFor(unit: ScoredUnit): EvapState {
  const hasEvap = unit.applicableIncentives.some((i) => i.id.startsWith("fed-evap"));
  if (hasEvap) return "eligible";
  // Post-OEM-cash effective contract value — matches scoring.ts cap check.
  const effective = effectivePreTaxValue(unit, unit.applicableIncentives);
  if (effective - CAP_CAD <= CLIFF_BAND_CAD) return "cliff";
  return "over";
}

function EvapChip({ state, unit }: { state: EvapState; unit: ScoredUnit }) {
  if (state === "eligible") {
    return (
      <div
        className="text-xxs text-accent mt-0.5 font-normal"
        title="Pre-tax transaction value ≤ $50,000 → $5,000 federal EVAP rebate already applied to OTD"
      >
        EVAP −$5k
      </div>
    );
  }
  if (state === "cliff") {
    const effective = effectivePreTaxValue(unit, unit.applicableIncentives);
    const over = Math.round(effective - CAP_CAD);
    return (
      <div
        className="text-xxs text-warn mt-0.5 font-normal"
        title="Within $1,500 of EVAP cap. Trimming dealer add-ons (admin, wheel locks, prep) might unlock the $5k rebate."
      >
        Cliff +${over}
      </div>
    );
  }
  return null;
}

type Props = {
  units: ScoredUnit[];
  dealerById: Map<string, Dealer>;
  dealerPressureByDealer: Record<string, number>;
  rangeByUnitId?: Record<string, number | null>;
};

type SortKey = "deal" | "otd" | "discount" | "perKm" | "newest" | "oldest";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "deal", label: "Best deal score" },
  { key: "otd", label: "Lowest OTD" },
  { key: "discount", label: "Biggest discount vs MSRP" },
  { key: "perKm", label: "Lowest $/km of range" },
  { key: "newest", label: "Newest listing" },
  { key: "oldest", label: "Longest on lot" },
];

// Aging signal: any prior-MY unit that's been sitting >90 days. Shoppers can
// usually negotiate hardest on these.
const CURRENT_MY = Math.max(...SUPPORTED_YEARS);
function isAgingOutgoing(year: number, daysOnLot?: number): boolean {
  return year < CURRENT_MY && (daysOnLot ?? 0) > 90;
}

// E-GMP ICCU recall family. Ioniq 5 spans 2025; EV6 + Ioniq 6 stop at 2024.
// Source: data/market-intel.json (kept in sync there).
function iccuAffected(model: Model, year: number): boolean {
  if (model === "EV6" && year >= 2022 && year <= 2024) return true;
  if (model === "Ioniq5" && year >= 2022 && year <= 2025) return true;
  if (model === "Ioniq6" && year >= 2023 && year <= 2024) return true;
  return false;
}

const VALID_SORTS: SortKey[] = ["deal", "otd", "discount", "perKm", "newest", "oldest"];

const CSV_COLS = [
  "model", "year", "trim", "drivetrain", "exteriorColor", "interiorColor",
  "msrp", "asking", "otd", "daysOnLot", "lastSeen", "status",
  "dealerName", "dealerCity", "dealerProvince", "dealerPhone", "pressure",
  "listingUrl",
] as const;

function csvEscape(val: string | number | undefined | null): string {
  if (val === undefined || val === null) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function modelBreakdown(units: ScoredUnit[]): string {
  const counts: Record<Model, number> = { EV6: 0, Ioniq5: 0, Ioniq6: 0, EV9: 0, Ioniq9: 0 };
  for (const u of units) counts[u.model] += 1;
  return (Object.keys(counts) as Model[])
    .filter((m) => counts[m] > 0)
    .map((m) => `${counts[m]} ${MODEL_LABEL[m]}`)
    .join(", ");
}

function activeFilterChips(s: {
  model: Model | "all";
  year: number | "all";
  drivetrain: "RWD" | "AWD" | "all";
  region: "ggh" | "on" | "all";
  maxPrice: number | "";
  pressureOnly: boolean;
  evapOnly: boolean;
  query: string;
}): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  if (s.model !== "all") out.push({ key: "model", label: MODEL_LABEL[s.model] });
  if (s.year !== "all") out.push({ key: "year", label: `MY ${s.year}` });
  if (s.drivetrain !== "all") out.push({ key: "drivetrain", label: s.drivetrain });
  if (s.region !== "ggh") out.push({ key: "region", label: s.region === "on" ? "All Ontario" : "All Canada" });
  if (s.maxPrice !== "") out.push({ key: "maxPrice", label: `≤ $${s.maxPrice.toLocaleString("en-CA")}` });
  if (s.pressureOnly) out.push({ key: "pressureOnly", label: "High pressure" });
  if (s.evapOnly) out.push({ key: "evapOnly", label: "EVAP eligible" });
  if (s.query.trim()) out.push({ key: "query", label: `"${s.query.trim()}"` });
  return out;
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
      u.msrp, u.dealerAskingPrice, u.otdCad, u.daysOnLot ?? "", u.lastSeen, u.status,
      d?.name ?? "", d?.city ?? "", d?.province ?? "", d?.phone ?? "", pressureByDealer[u.dealerId] ?? 0,
      u.listingUrl ?? "",
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

export function InventoryTable({ units, dealerById, dealerPressureByDealer, rangeByUnitId }: Props) {
  const rangeFor = (id: string): number | null => rangeByUnitId?.[id] ?? null;
  const perKmFor = (u: ScoredUnit): number | null => {
    const r = rangeFor(u.id);
    return r && r > 0 ? u.otdCad / r : null;
  };
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
    const ev = searchParams.get("evap");
    const so = searchParams.get("sort");
    const q = searchParams.get("q");
    const uid = searchParams.get("u");
    return {
      model: (m && (MODELS as readonly string[]).includes(m) ? (m as Model) : "all") as Model | "all",
      year: (y && SUPPORTED_YEARS.map(String).includes(y) ? Number(y) : "all") as number | "all",
      drivetrain: (dt === "RWD" || dt === "AWD" ? dt : "all") as "RWD" | "AWD" | "all",
      region: (rg === "on" || rg === "all" ? rg : "ggh") as "ggh" | "on" | "all",
      maxPrice: (mp && !Number.isNaN(Number(mp)) ? Number(mp) : "") as number | "",
      pressureOnly: po === "1",
      evapOnly: ev === "1",
      sort: ((so && VALID_SORTS.includes(so as SortKey)) ? (so as SortKey) : "deal") as SortKey,
      query: q ?? "",
      unitId: uid ?? null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [model, setModel] = useState<Model | "all">(initial.model);
  const [year, setYear] = useState<number | "all">(initial.year);
  const [drivetrain, setDrivetrain] = useState<"RWD" | "AWD" | "all">(initial.drivetrain);
  const [region, setRegion] = useState<"ggh" | "on" | "all">(initial.region);
  const [maxPrice, setMaxPrice] = useState<number | "">(initial.maxPrice);
  const [pressureOnly, setPressureOnly] = useState(initial.pressureOnly);
  const [evapOnly, setEvapOnly] = useState(initial.evapOnly);
  const [sort, setSort] = useState<SortKey>(initial.sort);
  const [query, setQuery] = useState<string>(initial.query);
  const [selectedId, setSelectedId] = useState<string | null>(initial.unitId);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const { isFavorite, toggle: toggleFavorite, count: favoriteCount } = useFavorites();

  useEffect(() => {
    const p = new URLSearchParams();
    if (model !== "all") p.set("model", model);
    if (year !== "all") p.set("year", String(year));
    if (drivetrain !== "all") p.set("dt", drivetrain);
    if (region !== "ggh") p.set("region", region);
    if (maxPrice !== "") p.set("maxOtd", String(maxPrice));
    if (pressureOnly) p.set("pressure", "1");
    if (evapOnly) p.set("evap", "1");
    if (sort !== "deal") p.set("sort", sort);
    if (query.trim()) p.set("q", query.trim());
    if (selectedId) p.set("u", selectedId);
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [model, year, drivetrain, region, maxPrice, pressureOnly, evapOnly, sort, query, selectedId, pathname, router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
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
        if (evapOnly && evapStateFor(u) !== "eligible") return false;
        if (favoritesOnly && !isFavorite(u.id)) return false;
        if (q) {
          const hay = `${u.trim} ${u.exteriorColor} ${u.interiorColor} ${u.vin ?? ""} ${u.stockNumber ?? ""} ${dealer.name} ${dealer.city}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
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
        if (sort === "perKm") {
          const pa = perKmFor(a);
          const pb = perKmFor(b);
          if (pa == null && pb == null) return 0;
          if (pa == null) return 1;
          if (pb == null) return -1;
          return pa - pb;
        }
        if (sort === "newest") return new Date(b.firstSeen).getTime() - new Date(a.firstSeen).getTime();
        return new Date(a.firstSeen).getTime() - new Date(b.firstSeen).getTime();
      });
  }, [units, dealerById, dealerPressureByDealer, model, year, drivetrain, region, maxPrice, pressureOnly, evapOnly, favoritesOnly, isFavorite, sort, query]);

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
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search trim, color, dealer, VIN…"
          className="px-2 py-1.5 w-56"
        />
        <select
          value={model}
          onChange={(e) => setModel(e.target.value as Model | "all")}
          className="px-2 py-1.5"
        >
          <option value="all">All models</option>
          {MODELS.map((m) => (
            <option key={m} value={m}>{MODEL_LABEL[m]}</option>
          ))}
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
        <label
          className="flex items-center gap-1.5 text-fg-muted cursor-pointer"
          title="Pre-tax transaction value ≤ $50,000 — qualifies for $5,000 federal EVAP rebate"
        >
          <input
            type="checkbox"
            checked={evapOnly}
            onChange={(e) => setEvapOnly(e.target.checked)}
          />
          EVAP-eligible only
        </label>
        <label
          className="flex items-center gap-1.5 text-fg-muted cursor-pointer"
          title="Show only units you've starred"
        >
          <input
            type="checkbox"
            checked={favoritesOnly}
            onChange={(e) => setFavoritesOnly(e.target.checked)}
            disabled={favoriteCount === 0}
          />
          Favorites only ({favoriteCount})
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
        <span className="text-fg-subtle" title={modelBreakdown(filtered)}>
          {filtered.length} units{filtered.length > 0 && ` · ${modelBreakdown(filtered)}`}
        </span>
        <button
          type="button"
          onClick={() => exportCsv(filtered, dealerById, dealerPressureByDealer)}
          className="px-2 py-1.5 border border-border rounded text-fg-muted hover:bg-bg-hover"
          disabled={filtered.length === 0}
        >
          Export CSV
        </button>
      </div>
      {activeFilterChips({ model, year, drivetrain, region, maxPrice, pressureOnly, evapOnly, query }).length > 0 && (
        <div className="px-3 py-2 border-b border-border flex flex-wrap items-center gap-1.5 text-xxs">
          <span className="text-fg-subtle uppercase tracking-wide">Active:</span>
          {activeFilterChips({ model, year, drivetrain, region, maxPrice, pressureOnly, evapOnly, query }).map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => {
                if (c.key === "model") setModel("all");
                else if (c.key === "year") setYear("all");
                else if (c.key === "drivetrain") setDrivetrain("all");
                else if (c.key === "region") setRegion("ggh");
                else if (c.key === "maxPrice") setMaxPrice("");
                else if (c.key === "pressureOnly") setPressureOnly(false);
                else if (c.key === "evapOnly") setEvapOnly(false);
                else if (c.key === "query") setQuery("");
              }}
              className="chip-neutral hover:bg-bg-hover"
            >
              {c.label} ×
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setModel("all"); setYear("all"); setDrivetrain("all"); setRegion("ggh");
              setMaxPrice(""); setPressureOnly(false); setEvapOnly(false); setQuery("");
            }}
            className="text-fg-muted hover:text-fg ml-1 underline"
          >
            Clear all
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-bg-subtle text-xxs uppercase text-fg-subtle">
            <tr>
              <th className="px-2 py-2"></th>
              <th className="px-3 py-2">Deal</th>
              <th className="px-3 py-2">Model / Trim</th>
              <th className="px-3 py-2">Year</th>
              <th className="px-3 py-2">Color</th>
              <th className="px-3 py-2 text-right">MSRP</th>
              <th className="px-3 py-2 text-right">Asking</th>
              <th className="px-3 py-2 text-right">OTD</th>
              <th className="px-3 py-2 text-right" title="OTD ÷ EPA / NRCan range. Lower = more car per dollar.">$/km</th>
              <th className="px-3 py-2 text-right">Days</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Dealer</th>
              <th className="px-3 py-2 text-right">Pressure</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const dealer = dealerById.get(u.dealerId);
              const pressure = dealerPressureByDealer[u.dealerId] ?? 0;
              const isActive = u.id === selectedId;
              const fav = isFavorite(u.id);
              const stale = daysSince(u.lastSeen) > 7;
              return (
                <tr
                  key={u.id}
                  className={`border-t border-border cursor-pointer ${isActive ? "bg-accent-dim/20" : "card-hover"}`}
                  onClick={() => setSelectedId(u.id)}
                >
                  <td className="px-2 py-2 text-center">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(u.id); }}
                      className={`text-base leading-none ${fav ? "text-warn" : "text-fg-subtle hover:text-fg-muted"}`}
                      title={fav ? "Remove from favorites" : "Add to favorites"}
                      aria-label={fav ? "Unstar" : "Star"}
                    >
                      {fav ? "★" : "☆"}
                    </button>
                  </td>
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
                    {u.msrpSource === "asking-fallback" && (
                      <div
                        className="text-xxs text-warn"
                        title="Trim parser couldn't confidently bucket this listing. MSRP shown is the asking price (so discount math reads as $0 off). Verify trim and MSRP on the OEM configurator before quoting."
                      >
                        MSRP unverified
                      </div>
                    )}
                    {u.msrpSource === "default-table" && (
                      <div
                        className="text-xxs text-fg-subtle"
                        title="MSRP came from the curated DEFAULT_MSRP table, not specs.json. Reasonable but not authoritative — confirm on the OEM configurator if discount is decisive."
                      >
                        MSRP est.
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right num font-medium">
                    {fmtCad(u.otdCad)}
                    <EvapChip state={evapStateFor(u)} unit={u} />
                  </td>
                  <td className="px-3 py-2 text-right num text-xs" title={rangeFor(u.id) ? `Range ${rangeFor(u.id)} km (NRCan/EPA combined)` : "Range spec missing"}>
                    {(() => {
                      const p = perKmFor(u);
                      return p ? `$${p.toFixed(0)}` : "—";
                    })()}
                  </td>
                  <td className="px-3 py-2 text-right num">{u.daysOnLot ?? "—"}</td>
                  <td className="px-3 py-2 space-y-1">
                    <StatusChip status={u.status} />
                    {isAgingOutgoing(u.year, u.daysOnLot) && (
                      <span className="chip-warn block w-fit">Aging MY{String(u.year).slice(-2)}</span>
                    )}
                    {stale && (
                      <span
                        className="chip-neutral block w-fit text-fg-subtle"
                        title={`Last seen ${daysSince(u.lastSeen)} days ago — may have sold. Verify before quoting.`}
                      >
                        Stale {daysSince(u.lastSeen)}d
                      </span>
                    )}
                    {iccuAffected(u.model, u.year) && (
                      <span
                        className="chip-bad block w-fit"
                        title="E-GMP ICCU recall family. Demand written confirmation that ICCU software flash + module inspection have been completed before contracting. 15-yr/290k-km warranty extension applies."
                      >
                        ICCU recall
                      </span>
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
                  <td className="px-3 py-2 text-right">
                    {u.listingUrl ? (
                      <a
                        href={u.listingUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xxs text-accent hover:text-accent-strong inline-block px-1.5 py-0.5 border border-border rounded"
                        title="Open AutoTrader listing in new tab"
                      >
                        Listing ↗
                      </a>
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={14} className="px-3 py-12 text-center text-fg-muted">
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
        onNavigate={(dir) => {
          if (!selected || filtered.length === 0) return;
          const idx = filtered.findIndex((u) => u.id === selected.id);
          if (idx === -1) return;
          const next = (idx + dir + filtered.length) % filtered.length;
          setSelectedId(filtered[next].id);
        }}
        position={
          selected
            ? {
                index: Math.max(0, filtered.findIndex((u) => u.id === selected.id)),
                total: filtered.length,
              }
            : undefined
        }
      />
    </div>
  );
}
