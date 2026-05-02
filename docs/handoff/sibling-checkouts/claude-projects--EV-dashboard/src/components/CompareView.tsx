import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { vehicleById, brandById } from "../data";
import { cad, km, kw, kwh, kg, litres, cv } from "../lib/format";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { TempSlider } from "./TempSlider";
import { ChargingCurveChart } from "./ChargingCurveChart";
import { MapPanel } from "./MapPanel";
import { UsedListings } from "./UsedListings";
import { computeThermal, type ThermalOutputs } from "../lib/thermal";
import { labelFor } from "../lib/plainLang";
import { projectedRangeAtYear } from "../lib/battery_degradation";
import type { Vehicle } from "../types";

interface RowContext {
  electricity_cad_per_kwh: number;
}

interface Row {
  label: string;
  render: (v: Vehicle, t: ThermalOutputs, ctx: RowContext) => React.ReactNode;
  breakdown?: (v: Vehicle, t: ThermalOutputs, ctx: RowContext) => string; // F-04: optional drawer content
  section?: string;
}

// iZEV eligibility rule (as of 2026, with program paused).
// Logic reads: MSRP cap ≤ $55,000 for standard trims, ≤ $65,000 for select
// trucks/SUVs. Currently returns "Paused" because the program is itself paused,
// but structure stays for when incentives return.
function izevVerdict(v: Vehicle): string {
  const cap = v.body_style === "Truck" || v.body_style === "SUV" ? 65_000 : 55_000;
  const price = v.msrp_cad.value ?? 0;
  if (price === 0 || price == null) return "—";
  if (price > cap) return `No (${cap / 1000}k cap exceeded)`;
  return "Yes (if program active)";
}

const ROWS: Row[] = [
  { section: "Identity", label: "Generation", render: (v) => v.generation_label },
  { label: "Trim", render: (v) => v.trim_label },
  { label: "Powertrain", render: (v) => v.powertrain },
  { label: "Body style", render: (v) => v.body_style },
  { label: "Drivetrain", render: (v) => v.drivetrain_variant === "AWD" ? "AWD" : "Single-motor (RWD/FWD)" },

  // Adjusted for slider conditions
  {
    section: "Adjusted for conditions",
    label: "Range @ slider",
    render: (v, t) => (
      <span>
        {km(t.range_km)}{" "}
        <ConfidenceBadge
          level={t.confidence}
          compact
          notes={`Physics model output at current slider state. Rated range from seed: ${v.range_km.value ?? "—"} km (${v.range_protocol}).`}
        />
      </span>
    ),
    breakdown: (_v, t) =>
      `Rated efficiency: ${Math.round(t.breakdown.rated_efficiency_whkm)} Wh/km\n` +
      `× capacity retained at temp: ${Math.round(t.breakdown.capacity_fraction * 100)}%\n` +
      `+ HVAC adds: ${t.breakdown.hvac_kw.toFixed(1)} kW → ${Math.round(((t.breakdown.hvac_kw * 1000) / 100))} Wh/km at 100 km/h\n` +
      `= effective ${Math.round(t.efficiency_whkm)} Wh/km → ${Math.round(t.range_km)} km range`,
  },
  {
    label: "Effective usable",
    render: (_v, t) => kwh(t.usable_kwh),
    breakdown: (_v, _t) =>
      `Battery capacity × temperature factor = usable kWh now.\n` +
      `Chemistry and cold-derate curve determine the fraction.`,
  },
  {
    label: "Peak DC @ slider",
    render: (_v, t) => kw(t.peak_dc_kw),
    breakdown: (_v, t) =>
      `Rated DC peak × temperature factor ${t.breakdown.dc_temp_factor.toFixed(2)} = ${Math.round(t.peak_dc_kw)} kW.\n` +
      `Preconditioning removes most of the cold penalty.`,
  },
  {
    label: "Effective consumption",
    render: (_v, t) => `${Math.round(t.efficiency_whkm)} Wh/km`,
  },
  {
    label: "Capacity retained",
    render: (_v, t) => `${Math.round(t.breakdown.capacity_fraction * 100)}%`,
  },
  {
    label: "HVAC draw",
    render: (_v, t) => t.breakdown.hvac_kw === 0 ? "off" : `${t.breakdown.hvac_kw.toFixed(1)} kW`,
  },
  {
    label: "Cost per 100 km",
    render: (_v, t, ctx) => {
      const dollars = (t.efficiency_whkm / 1000) * ctx.electricity_cad_per_kwh * 100;
      const cents = Math.round(ctx.electricity_cad_per_kwh * 100);
      return (
        <span>
          ${dollars.toFixed(2)}{" "}
          <span className="text-ink-500 text-xs">@ {cents}¢/kWh</span>
        </span>
      );
    },
  },

  // Battery degradation projection (F-10)
  {
    section: "Battery life projection",
    label: "Range at 5 yr",
    render: (v) => {
      const r = v.range_km.value;
      if (r == null) return "—";
      return km(projectedRangeAtYear(r, v.battery_chemistry, 5));
    },
    breakdown: (v) =>
      `Chemistry: ${v.battery_chemistry}. ` +
      `Based on Recurrent Auto fleet data for typical use (20,000 km/yr, mixed DC+L2 charging).`,
  },
  {
    label: "Range at 8 yr",
    render: (v) => {
      const r = v.range_km.value;
      if (r == null) return "—";
      return km(projectedRangeAtYear(r, v.battery_chemistry, 8));
    },
  },
  {
    label: "Range at 10 yr",
    render: (v) => {
      const r = v.range_km.value;
      if (r == null) return "—";
      return km(projectedRangeAtYear(r, v.battery_chemistry, 10));
    },
  },

  // Baseline spec rows
  { section: "Range & battery (rated)", label: "Rated range", render: (v) => <span>{km(cv(v.range_km))} <span className="text-ink-400 text-xs">({v.range_protocol})</span></span> },
  { label: "Battery (usable)", render: (v) => kwh(cv(v.battery_kwh_usable)) },
  { label: "Battery (total)", render: (v) => kwh(cv(v.battery_kwh_total)) },
  { label: "Chemistry", render: (v) => v.battery_chemistry },
  { label: "Heat pump", render: (v) => cv(v.has_heat_pump) ? "Yes" : "No" },
  { label: "Thermal mgmt", render: (v) => v.thermal_management.replace("_", " ") },

  { section: "Charging (rated)", label: "Peak DC rated", render: (v) => kw(cv(v.dc_charge_kw_max)) },
  { label: "Max AC", render: (v) => kw(cv(v.ac_charge_kw_max)) },
  { label: "Port", render: (v) => v.port_type },

  { section: "Utility", label: "Seats", render: (v) => String(v.seats) },
  { label: "Cargo (seats up)", render: (v) => litres(cv(v.cargo_l_seats_up)) },
  { label: "Cargo (seats down)", render: (v) => litres(cv(v.cargo_l_seats_down)) },
  { label: "Tow rating", render: (v) => kg(cv(v.tow_rating_kg)) },
  { label: "Curb weight", render: (v) => kg(cv(v.weight_kg)) },

  { section: "Cost & incentives", label: "MSRP", render: (v) => cad(cv(v.msrp_cad)) },
  { label: "Federal iZEV", render: (v) => cad(cv(v.federal_izev_cad)) },
  { label: "Ontario rebate", render: (v) => cad(cv(v.provincial_rebate_cad_on)) },
  {
    label: "iZEV eligible",
    render: (v) => izevVerdict(v),
    breakdown: (v) =>
      `iZEV federal rebate (when active) requires MSRP ≤ ` +
      `$${v.body_style === "Truck" || v.body_style === "SUV" ? "65,000 (truck/SUV cap)" : "55,000 (standard cap)"}.\n` +
      `This vehicle's MSRP: $${v.msrp_cad.value?.toLocaleString() ?? "—"}.\n` +
      `Program currently paused (early 2025); verify transport.canada.ca before purchase.`,
  },
];

export function CompareView({ onClose }: { onClose: () => void }) {
  const {
    compareIds,
    temp_c,
    hvac_on,
    speed_kph,
    preconditioned,
    electricity_cad_per_kwh,
    mom_mode,
  } = useAppStore();
  const [openDrawer, setOpenDrawer] = useState<string | null>(null);

  const vehicles = compareIds
    .map((id) => vehicleById(id))
    .filter((v): v is Vehicle => !!v);

  if (vehicles.length === 0) return null;

  const thermals: Record<string, ThermalOutputs> = {};
  for (const v of vehicles) {
    thermals[v.id] = computeThermal(v, {
      temp_c,
      preconditioned: preconditioned[v.id] ?? true,
      hvac_on,
      speed_kph,
    });
  }

  const ctx: RowContext = { electricity_cad_per_kwh };

  return (
    <div className="fixed inset-0 z-40 bg-ink-900 overflow-auto">
      <header className="sticky top-0 bg-ink-800/95 backdrop-blur border-b border-ink-700 px-6 py-3 flex items-center gap-4 z-10">
        <h1 className="font-display text-lg">{mom_mode ? "Side-by-side" : "Compare"}</h1>
        <span className="text-xs text-ink-400">{vehicles.length} vehicles</span>
        <button onClick={onClose} className="ml-auto text-ink-300 hover:text-ink-100 text-sm">
          ← Back
        </button>
      </header>

      <div className="p-6">
        {/* Vehicle cards */}
        <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: `200px repeat(${vehicles.length}, minmax(220px, 1fr))` }}>
          <div />
          {vehicles.map((v) => {
            const b = brandById(v.brand_id);
            return (
              <div key={v.id} className="bg-ink-800 rounded-lg p-4 border border-ink-700">
                <div className="text-xs uppercase tracking-wider text-ink-400">{b?.name}</div>
                <div className="font-display text-lg text-ink-100">{v.model}</div>
                <div className="text-sm text-ink-300">{v.trim_label}</div>
                <div className="mt-2 flex items-center gap-2">
                  <ConfidenceBadge level={v.overall_confidence} notes={v.notes} />
                  <span className="text-xs text-ink-500">{mom_mode ? "data quality" : "seed data"}</span>
                </div>
              </div>
            );
          })}
        </div>

        <TempSlider vehicles={vehicles} />
        <ChargingCurveChart vehicles={vehicles} thermals={thermals} />
        <MapPanel vehicles={vehicles} thermals={thermals} />
        <UsedListings vehicles={vehicles} />

        <div className="grid gap-0" style={{ gridTemplateColumns: `200px repeat(${vehicles.length}, minmax(220px, 1fr))` }}>
          {ROWS.map((row, i) => (
            <RowBlock
              key={i}
              row={row}
              rowKey={`row-${i}`}
              vehicles={vehicles}
              thermals={thermals}
              ctx={ctx}
              mom={mom_mode}
              openDrawer={openDrawer}
              setOpenDrawer={setOpenDrawer}
            />
          ))}
        </div>

        <div className="mt-10 text-xs text-ink-400 max-w-3xl">
          {mom_mode ? (
            <>
              <strong className="text-ink-300">Plain-English mode on.</strong>{" "}
              Technical terms swapped for everyday words. Uncheck "Plain English" in the top bar to see full spec names.
            </>
          ) : (
            <>
              <strong className="text-ink-300">How the slider works:</strong> the Adjusted-for-conditions rows run through a physics
              model calibrated against Geotab, Recurrent, Fastned, and Bjorn Nyland winter data. Confidence drops to Low at slider
              extremes where data is thin — never fabricated precision. Click a row to see the breakdown.
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function RowBlock({
  row,
  rowKey,
  vehicles,
  thermals,
  ctx,
  mom,
  openDrawer,
  setOpenDrawer,
}: {
  row: Row;
  rowKey: string;
  vehicles: Vehicle[];
  thermals: Record<string, ThermalOutputs>;
  ctx: RowContext;
  mom: boolean;
  openDrawer: string | null;
  setOpenDrawer: (k: string | null) => void;
}) {
  const isOpen = openDrawer === rowKey;
  const hasBreakdown = !!row.breakdown;
  const label = labelFor(row.label, mom);

  return (
    <>
      {row.section && (
        <div className="col-span-full py-2 mt-4 text-[11px] uppercase tracking-widest text-ink-500 border-b border-ink-700">
          {labelFor(row.section, mom)}
        </div>
      )}
      <button
        type="button"
        onClick={() => hasBreakdown && setOpenDrawer(isOpen ? null : rowKey)}
        className={`text-left py-2 px-1 text-sm border-b border-ink-800 ${hasBreakdown ? "text-ink-300 hover:text-ink-100 cursor-pointer" : "text-ink-400 cursor-default"}`}
        title={hasBreakdown ? "Click to see breakdown" : undefined}
        aria-expanded={hasBreakdown ? isOpen : undefined}
      >
        {hasBreakdown && <span className="text-ink-500 mr-1">{isOpen ? "▾" : "▸"}</span>}
        {label}
      </button>
      {vehicles.map((v) => (
        <div
          key={v.id}
          className="py-2 px-1 text-sm text-ink-100 border-b border-ink-800 font-mono"
        >
          {row.render(v, thermals[v.id], ctx)}
        </div>
      ))}
      {isOpen && hasBreakdown && (
        <div className="col-span-full bg-ink-800/60 border-l-2 border-accent-blue/50 px-4 py-3 text-xs text-ink-300 whitespace-pre-line">
          {vehicles.map((v, i) => (
            <div key={v.id} className={i > 0 ? "mt-3 pt-3 border-t border-ink-700" : ""}>
              <div className="text-ink-200 font-medium">{v.model} {v.trim_label}</div>
              <div className="text-ink-400 mt-1">{row.breakdown!(v, thermals[v.id], ctx)}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
