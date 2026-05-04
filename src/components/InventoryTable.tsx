"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Dealer, ScoredUnit, Spec, BuyerContext } from "@/lib/types";
import { readHeatPump } from "@/lib/types";
import { realRangeKm } from "@/lib/thermal";
import { MODEL_LABEL, GGH_CITIES, MODELS, SUPPORTED_YEARS, type Model, type Province } from "@/lib/constants";
import { fmtCad } from "@/lib/format";
import { effectivePreTaxValue } from "@/lib/scoring";
import { useFavorites } from "@/lib/useFavorites";
import { usedListingsFor } from "@/lib/usedListingsLinks";
import { DealScoreBadge } from "./DealScoreBadge";
import { StatusChip } from "./StatusChip";
import { UnitDrawer } from "./UnitDrawer";
import { MiniChargingSparkline } from "./MiniChargingSparkline";
import { CrossSourceChip } from "./CrossSourceChip";
import { plainLang } from "@/lib/plainLang";
import { useTemp } from "@/lib/tempContext";
import vehicleImages from "../../data/vehicle-images.json";

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
        <span title={plainLang("EVAP")} className="cursor-help underline decoration-dotted underline-offset-2">EVAP</span> −$5k
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

// Vehicle hero image helper. Only Ioniq6 has a verified URL; others are null.
// Returns null when model isn't in JSON or url is null.
type VehicleImagesData = {
  images: Record<string, { url: string | null; alt: string }>;
};
const imgData = vehicleImages as VehicleImagesData;
function vehicleImageFor(model: Model): { url: string; alt: string } | null {
  const entry = imgData.images[model];
  if (!entry || !entry.url) return null;
  return { url: entry.url, alt: entry.alt };
}

// Heatpump chip — tri-state: true (no chip), false (red), null/undef (grey).
function HeatPumpChip({ hasHeatPump }: { hasHeatPump?: boolean | null }) {
  if (hasHeatPump === true) return null;
  if (hasHeatPump === false) {
    return (
      <span
        className="chip-bad block w-fit mt-1"
        title="No heat pump — resistive heat only. Expect 25–40% real-world range loss below −10°C."
      >
        ❌ No heat pump
      </span>
    );
  }
  // null or undefined
  return (
    <span
      className="chip-neutral block w-fit mt-1 text-fg-subtle"
      title="Heat pump status not yet researched for this trim."
    >
      ❓ Heat pump?
    </span>
  );
}

// Extract a plain number from a field that may be number | CitedValue<number> | undefined.
function extractNum(v: number | { value: number | null } | null | undefined): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v;
  return v.value;
}

// Winter range chip — only renders when tempC < 5 and spec data is available.
// Reads tempC + preconditioned from TempContext (synchronous client state) so
// drag updates are instant without any SSR roundtrip.
function WinterRangeChip({ spec }: { spec: Spec | undefined }) {
  const { tempC, preconditioned } = useTemp();
  if (tempC >= 5) return null;
  if (!spec) return null;
  // Prefer new citedValue rangeEpaKm, fall back to legacy rangeKm
  const epa = extractNum(spec.rangeEpaKm) ?? spec.rangeKm ?? null;
  if (epa == null) return null;
  // Prefer new citedValue batteryKwhUsable, fall back to batteryKwh (may be plain or cited)
  const battery = extractNum(spec.batteryKwhUsable) ?? extractNum(spec.batteryKwh);
  const hasHP = readHeatPump(spec.hasHeatPump);
  const chemistry = spec.batteryChemistry; // per-vehicle if known
  const hpMinC = extractNum(spec.heatPumpMinEffectiveC) ?? undefined;
  const km = realRangeKm({
    epaKm: epa,
    batteryKwh: battery,
    hasHeatPump: hasHP,
    tempC,
    chemistry,
    heatPumpMinEffectiveC: hpMinC,
    preconditioned,
  });
  if (km == null) return null;
  // Severity tiers
  let cls = "bg-blue-900 text-blue-200";
  let icon = "🌡";
  if (tempC < -15) {
    cls = "bg-red-900 text-red-200";
    icon = "🥶";
  } else if (tempC < -5) {
    cls = "bg-amber-900 text-amber-200";
    icon = "❄";
  }
  const ringCls = preconditioned ? " ring-1 ring-good/40" : "";
  const label = tempC >= 0 ? `+${tempC}°C` : `${tempC}°C`;
  const preconNote = preconditioned ? " (preconditioned)" : " (cold-soaked)";
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xxs ${cls}${ringCls} block w-fit mt-1`}
      title={`Estimated real-world range at ${label}${preconNote}. Chemistry: ${chemistry ?? "unknown"}. Heat pump: ${hasHP === true ? `yes (effective ≥${hpMinC ?? -20}°C)` : hasHP === false ? "no" : "unknown"}.`}
    >
      {icon} {label}: {Math.round(km)} km{preconditioned ? " ⚡" : ""}
    </span>
  );
}

// 3-path OTD badge row — compact inline pills under the price cell.
function OtdPathBadges({ unit }: { unit: ScoredUnit }) {
  const paths = unit.otdPaths;
  if (!paths) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-0.5">
      <span className="text-xxs text-fg-subtle">
        <span title={plainLang("cash")} className="cursor-help underline decoration-dotted underline-offset-2">Cash</span> {fmtCad(paths.cash.total)}
      </span>
      {paths.finance && (
        <span className="text-xxs text-accent" title={`${paths.finance.termMonths}mo @ ${paths.finance.aprPercent}% APR`}>
          · <span title={plainLang("finance")} className="cursor-help underline decoration-dotted underline-offset-2">Finance</span> {fmtCad(Math.round(paths.finance.monthlyPaymentCad))}/mo
        </span>
      )}
      {paths.lease && (
        <span className="text-xxs text-warn" title={`${paths.lease.termMonths}mo lease, residual ${paths.lease.residualPercent}%`}>
          · <span title={plainLang("lease")} className="cursor-help underline decoration-dotted underline-offset-2">Lease</span> {fmtCad(Math.round(paths.lease.monthlyPaymentWithTaxCad))}/mo
        </span>
      )}
    </div>
  );
}

type Props = {
  units: ScoredUnit[];
  dealerById: Map<string, Dealer>;
  dealerPressureByDealer: Record<string, number>;
  rangeByUnitId?: Record<string, number | null>;
  specByUnitId?: Record<string, Spec>;
  buyerContext?: BuyerContext;
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
  if (s.region !== "all") out.push({ key: "region", label: s.region === "ggh" ? "Greater Golden Horseshoe" : "All Ontario" });
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

export function InventoryTable({ units, dealerById, dealerPressureByDealer, rangeByUnitId, specByUnitId, buyerContext }: Props) {
  const province = buyerContext?.province ?? "ON";
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
      region: (rg === "ggh" || rg === "on" ? rg : "all") as "ggh" | "on" | "all",
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
    if (region !== "all") p.set("region", region);
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
          <option value="all">All Canada</option>
          <option value="on">All Ontario</option>
          <option value="ggh">Greater Golden Horseshoe</option>
        </select>
        <label className="flex items-center gap-2 text-fg-muted">
          <span className="shrink-0">Max OTD</span>
          <input
            type="range"
            min={30000}
            max={120000}
            step={500}
            value={maxPrice === "" ? 120000 : Number(maxPrice)}
            onChange={(e) => {
              const v = Number(e.target.value);
              setMaxPrice(v >= 120000 ? "" : v);
            }}
            className="w-28 cursor-pointer accent-accent"
          />
          <span className="tabular-nums w-14 text-fg">
            {maxPrice === "" || Number(maxPrice) >= 120000
              ? "any"
              : `$${(Number(maxPrice) / 1000).toFixed(0)}k`}
          </span>
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
          <span title={plainLang("EVAP")} className="cursor-help underline decoration-dotted underline-offset-2">EVAP</span>-eligible only
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
          <thead className="bg-bg-subtle/85 backdrop-blur-md text-xxs uppercase text-fg-subtle sticky top-0 z-10 shadow-sm shadow-black/20">
            <tr>
              <th className="px-2 py-2"></th>
              <th className="px-2 py-2"></th>
              <th className="px-3 py-2">Deal</th>
              <th className="px-3 py-2">Model / Trim</th>
              <th className="px-3 py-2">Year</th>
              <th className="px-3 py-2">Color</th>
              <th className="px-3 py-2 text-right"><span title={plainLang("msrp")} className="cursor-help underline decoration-dotted underline-offset-2">MSRP</span></th>
              <th className="px-3 py-2 text-right"><span title={plainLang("asking")} className="cursor-help underline decoration-dotted underline-offset-2">Asking</span></th>
              <th className="px-3 py-2 text-right"><span title={plainLang("OTD")} className="cursor-help underline decoration-dotted underline-offset-2">OTD</span></th>
              <th className="px-3 py-2 text-right" title="OTD ÷ EPA / NRCan range. Lower = more car per dollar.">$/km</th>
              <th className="px-3 py-2 text-right"><span title={plainLang("daysOnLot")} className="cursor-help underline decoration-dotted underline-offset-2">Days</span></th>
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
                  className={`border-t border-border cursor-pointer transition-colors duration-150 will-change-transform ${isActive ? "bg-accent-dim/20" : "card-hover"}`}
                  style={{ contain: "layout paint", contentVisibility: "auto", containIntrinsicSize: "0 64px" }}
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
                  <td className="px-1 py-1">
                    {(() => {
                      const img = vehicleImageFor(u.model);
                      if (!img) {
                        return <div className="w-12 h-8 bg-bg-subtle rounded" aria-hidden />;
                      }
                      return (
                        <Image
                          src={img.url}
                          alt={img.alt}
                          width={48}
                          height={32}
                          className="rounded object-cover"
                        />
                      );
                    })()}
                  </td>
                  <td className="px-3 py-2"><DealScoreBadge score={u.dealScore} /></td>
                  <td className="px-3 py-2">
                    <div className="font-medium flex items-center gap-1">
                      {MODEL_LABEL[u.model]}
                      {(() => {
                        const spec = specByUnitId?.[u.id];
                        const curve = spec?.chargingCurve;
                        const peak = extractNum(spec?.dcChargeMaxKw) ?? 230;
                        return curve && curve.length > 1 ? (
                          <MiniChargingSparkline curve={curve} peakKw={peak} />
                        ) : null;
                      })()}
                    </div>
                    <div className="text-xxs text-fg-muted">{u.trim} · {u.drivetrain}</div>
                    {(() => {
                      const spec = specByUnitId?.[u.id];
                      const r = rangeByUnitId?.[u.id];
                      const dc = extractNum(spec?.dcChargeMaxKw);
                      return (
                        <div className="flex gap-2 mt-1 text-xxs text-fg-muted">
                          <span className="text-fg font-medium num">{fmtCad(u.otdBreakdown.total)}</span>
                          {r != null && (
                            <span>
                              <span className="text-fg num">{r}</span>
                              <span className="text-fg-subtle"> km</span>
                            </span>
                          )}
                          {dc != null && (
                            <span>
                              <span className="text-fg num">{Math.round(dc)}</span>
                              <span className="text-fg-subtle"> kW</span>
                            </span>
                          )}
                        </div>
                      );
                    })()}
                    {specByUnitId && (
                      <HeatPumpChip hasHeatPump={readHeatPump(specByUnitId[u.id]?.hasHeatPump)} />
                    )}
                    {specByUnitId && (
                      <WinterRangeChip spec={specByUnitId[u.id]} />
                    )}
                    <CrossSourceChip
                      vin={u.vin ?? null}
                      year={u.year}
                      make={u.model.startsWith("Ioniq") ? "Hyundai" : "Kia"}
                      model={u.model}
                      trim={u.trim}
                      thisPriceCad={u.dealerAskingPrice}
                    />
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
                    {u.otdBreakdown.transportCost > 0 && (
                      <div
                        className="text-xxs text-warn font-normal"
                        title={`Includes ${fmtCad(u.otdBreakdown.transportCost)} transport estimate from ${dealer?.province ?? "out-of-province"} to ${u.otdBreakdown.salesTaxProvince}. Broker quotes can be 50-100% higher — verify before committing.`}
                      >
                        + {fmtCad(u.otdBreakdown.transportCost)} transport
                      </div>
                    )}
                    <EvapChip state={evapStateFor(u)} unit={u} />
                    <OtdPathBadges unit={u} />
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
                  <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-col items-end gap-1">
                      {u.listingUrl ? (
                        <a
                          href={u.listingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xxs text-accent hover:text-accent-strong inline-block px-1.5 py-0.5 border border-border rounded"
                          title="Open AutoTrader listing in new tab"
                        >
                          Listing ↗
                        </a>
                      ) : null}
                      <Link
                        href={`/inventory/${u.id}/dossier`}
                        className="text-xxs text-fg-muted hover:text-fg inline-block px-1.5 py-0.5 border border-border rounded"
                        title="Open negotiation dossier"
                      >
                        📄 Dossier
                      </Link>
                      <div className="flex gap-1">
                        {(() => {
                          const links = usedListingsFor(u.model, province as Province);
                          return (
                            <>
                              <a
                                href={links.autoTrader}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xxs text-fg-subtle hover:text-fg px-1 py-0.5 border border-border rounded"
                                title="Search used on AutoTrader"
                              >
                                AT
                              </a>
                              <a
                                href={links.kijiji}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xxs text-fg-subtle hover:text-fg px-1 py-0.5 border border-border rounded"
                                title="Search used on Kijiji"
                              >
                                KJ
                              </a>
                              <a
                                href={links.leasebusters}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xxs text-fg-subtle hover:text-fg px-1 py-0.5 border border-border rounded"
                                title={links.leasebustersIsManualSearch ? "Manual search — Leasebusters has no deep-link" : "Search on Leasebusters"}
                              >
                                LB{links.leasebustersIsManualSearch ? "*" : ""}
                              </a>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={16} className="px-3 py-12 text-center text-fg-muted">
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
