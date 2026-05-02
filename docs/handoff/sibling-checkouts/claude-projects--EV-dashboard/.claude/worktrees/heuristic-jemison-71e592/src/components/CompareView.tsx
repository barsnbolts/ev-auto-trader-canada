import { useState } from "react";
import { useAppStore, TOU_RATES, type TouTier } from "../store/useAppStore";
import { vehicleById, brandById } from "../data";
import { cad, km, kw, kwh, kg, litres, cv, drivetrain } from "../lib/format";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { TempSlider } from "./TempSlider";
import { ChargingCurveChart } from "./ChargingCurveChart";
import { MapPanel } from "./MapPanel";
import { TripPlanner } from "./TripPlanner";
import { UsedMarketPanel } from "./UsedMarketPanel";
import { FeatureFlag } from "./FeatureFlag";
import { CreditsPanel } from "./CreditsPanel";
import { WhyDrawer } from "./WhyDrawer";
import { debugLog } from "../lib/debugLog";
import { computeThermal, type ThermalOutputs } from "../lib/thermal";
import { projectedRangeKm, profileFor } from "../lib/degradation";
import { incentivePaused, incentivePausedDisclaimer } from "../lib/incentives";
import { TERM, resolve, type BiLabel } from "../lib/labels";
import type { Vehicle } from "../types";

type CompareTab = "specs" | "trip" | "map" | "used";

interface Row {
  label: string | BiLabel;
  render: (v: Vehicle, t: ThermalOutputs, rateCad: number) => React.ReactNode;
  section?: string | BiLabel;
  /** When set, wraps the row cells in a paused FeatureFlag overlay. */
  paused?: string;
}

const ROWS: Row[] = [
  // Identity
  { section: "Identity", label: TERM.generation, render: (v) => v.generation_label },
  { label: TERM.trim, render: (v) => v.trim_label },
  { label: TERM.powertrainRow, render: (v) => v.powertrain },
  { label: TERM.bodyStyle, render: (v) => v.body_style },
  { label: TERM.drivetrain, render: (v) => drivetrain(v.drivetrain_variant) },

  // Adjusted for slider conditions (physics-model outputs)
  {
    section: { geek: "Adjusted for conditions", plain: "How it performs right now" },
    label: TERM.rangeSlider,
    render: (_v, t) => (
      <span>
        {km(t.range_km)}{" "}
        <ConfidenceBadge level={t.confidence} compact />
      </span>
    ),
  },
  {
    label: TERM.usable,
    render: (_v, t) => kwh(t.usable_kwh),
  },
  {
    label: TERM.peakDcSlider,
    render: (_v, t) => kw(t.peak_dc_kw),
  },
  {
    label: TERM.consumption,
    render: (_v, t) => `${Math.round(t.efficiency_whkm)} Wh/km`,
  },
  {
    label: TERM.costPer100,
    render: (_v, t, rateCad) => {
      const cost = t.efficiency_whkm * 0.1 * rateCad;
      return <span>${cost.toFixed(2)}</span>;
    },
  },
  {
    label: TERM.retained,
    render: (_v, t) => `${Math.round(t.breakdown.capacity_fraction * 100)}%`,
  },
  {
    label: TERM.hvacDraw,
    render: (_v, t) => t.breakdown.hvac_kw === 0 ? "off" : `${t.breakdown.hvac_kw.toFixed(1)} kW`,
  },

  // Baseline spec rows
  {
    section: { geek: "Range & battery (rated)", plain: "Range & battery (official)" },
    label: TERM.ratedRange,
    render: (v) => <span>{km(cv(v.range_km))} <span className="text-ink-400 text-xs">({v.range_protocol})</span></span>,
  },
  { label: TERM.batteryUsable, render: (v) => kwh(cv(v.battery_kwh_usable)) },
  { label: TERM.batteryTotal, render: (v) => kwh(cv(v.battery_kwh_total)) },
  { label: TERM.chemistry, render: (v) => v.battery_chemistry },
  { label: TERM.heatPump, render: (v) => cv(v.has_heat_pump) ? "Yes" : "No" },
  { label: TERM.thermalMgmt, render: (v) => v.thermal_management.replace("_", " ") },

  {
    section: { geek: "Charging (rated)", plain: "Charging speeds (official)" },
    label: TERM.peakDcRated,
    render: (v) => kw(cv(v.dc_charge_kw_max)),
  },
  { label: TERM.maxAc, render: (v) => kw(cv(v.ac_charge_kw_max)) },
  { label: TERM.port, render: (v) => v.port_type },

  { section: "Utility", label: TERM.seats, render: (v) => String(v.seats) },
  { label: TERM.cargoSeatsUp, render: (v) => litres(cv(v.cargo_l_seats_up)) },
  { label: TERM.cargoSeatsDown, render: (v) => litres(cv(v.cargo_l_seats_down)) },
  { label: TERM.towRating, render: (v) => kg(cv(v.tow_rating_kg)) },
  { label: TERM.curbWeight, render: (v) => kg(cv(v.weight_kg)) },

  { section: "Cost", label: TERM.msrp, render: (v) => cad(cv(v.msrp_cad)) },
  {
    label: TERM.federal,
    paused: incentivePaused ? incentivePausedDisclaimer : undefined,
    render: (v) => cad(cv(v.federal_izev_cad)),
  },
  { label: TERM.provincial, render: (v) => cad(cv(v.provincial_rebate_cad_on)) },

  // Degradation projections — F-10 chemistry-aware Recurrent-calibrated profile.
  // Fleet medians; individual variation high so the badge stays Low.
  {
    section: TERM.degradation,
    label: TERM.rangeAt5yr,
    render: (v) => {
      const base = cv(v.range_km);
      if (!base) return "—";
      const projected = projectedRangeKm(base, v.battery_chemistry, 5);
      const profile = profileFor(v.battery_chemistry);
      return (
        <span title={profile.sourceLabel}>
          {km(projected)}{" "}
          <ConfidenceBadge level="Low" compact />
        </span>
      );
    },
  },
  {
    label: TERM.rangeAt8yr,
    render: (v) => {
      const base = cv(v.range_km);
      if (!base) return "—";
      const projected = projectedRangeKm(base, v.battery_chemistry, 8);
      const profile = profileFor(v.battery_chemistry);
      return (
        <span title={profile.sourceLabel}>
          {km(projected)}{" "}
          <ConfidenceBadge level="Low" compact />
        </span>
      );
    },
  },
  {
    label: TERM.rangeAt10yr,
    render: (v) => {
      const base = cv(v.range_km);
      if (!base) return "—";
      const projected = projectedRangeKm(base, v.battery_chemistry, 10);
      const profile = profileFor(v.battery_chemistry);
      return (
        <span title={profile.sourceLabel}>
          {km(projected)}{" "}
          <ConfidenceBadge level="Low" compact />
        </span>
      );
    },
  },
];

export function CompareView({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<CompareTab>("specs");
  const { compareIds, temp_c, hvac_on, speed_kph, preconditioned, touTier, setTouTier, clearCompare } = useAppStore();
  const rateCad = TOU_RATES[touTier].rate;
  const vehicles = compareIds
    .map((id) => vehicleById(id))
    .filter((v): v is Vehicle => !!v);

  if (vehicles.length === 0) return null;

  // Compute thermal outputs for each vehicle once per render.
  const thermals: Record<string, ThermalOutputs> = {};
  for (const v of vehicles) {
    thermals[v.id] = computeThermal(v, {
      temp_c,
      preconditioned: preconditioned[v.id] ?? true,
      hvac_on,
      speed_kph,
    });
  }

  return (
    <div className="fixed inset-0 z-40 bg-ink-900 overflow-auto">
      <header className="sticky top-0 bg-ink-800/95 backdrop-blur border-b border-ink-700 px-6 py-3 flex flex-wrap items-center gap-4 z-10">
        <h1 className="font-display text-lg shrink-0">Compare</h1>
        <span className="text-xs text-ink-400 shrink-0">
          {vehicles.length} vehicles
        </span>
        <label className="flex items-center gap-2 text-xs text-ink-400 shrink-0">
          Rate:
          <select
            value={touTier}
            onChange={(e) => setTouTier(e.target.value as TouTier)}
            className="bg-ink-700 border border-ink-600 rounded px-2 py-1 text-ink-100 text-xs"
          >
            {(Object.keys(TOU_RATES) as TouTier[]).map((tier) => (
              <option key={tier} value={tier}>{TOU_RATES[tier].label}</option>
            ))}
          </select>
        </label>
        <button
          onClick={() => { clearCompare(); onClose(); }}
          className="text-xs text-ink-500 hover:text-accent-red transition-colors shrink-0"
        >
          Clear saved comparison
        </button>
        <button
          onClick={onClose}
          className="ml-auto text-ink-300 hover:text-ink-100 text-sm shrink-0"
        >
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
                  <ConfidenceBadge level={v.overall_confidence} />
                  <span className="text-xs text-ink-500">seed data</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Slider panel — always visible; affects both Specs and Map tabs */}
        <TempSlider vehicles={vehicles} />

        {/* F-04 — Why these numbers? breakdown drawer */}
        <WhyDrawer vehicles={vehicles} thermals={thermals} />

        {/* Tab bar */}
        <div className="flex gap-1 mt-6 mb-4 border-b border-ink-700 pb-0">
          {([
            { id: "specs", label: "Specs" },
            { id: "trip",  label: "Trip Plan" },
            { id: "map",   label: "Map & Range" },
            { id: "used",  label: "Used Market" },
          ] as const).map(({ id, label }) => (
            <button
              key={id}
              onClick={() => {
                debugLog("ui", "compare_tab_change", { from: activeTab, to: id });
                setActiveTab(id);
              }}
              className={`px-4 py-2 text-sm font-medium rounded-t transition-colors ${
                activeTab === id
                  ? "bg-ink-800 text-ink-100 border border-b-ink-800 border-ink-700 -mb-px"
                  : "text-ink-400 hover:text-ink-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab: Specs */}
        {activeTab === "specs" && (
          <>
            {/* Charging curve overlay */}
            <ChargingCurveChart vehicles={vehicles} thermals={thermals} />

            {/* Spec rows */}
            <div className="grid gap-0" style={{ gridTemplateColumns: `200px repeat(${vehicles.length}, minmax(220px, 1fr))` }}>
              {ROWS.map((row, i) => (
                <RowBlock key={i} row={row} vehicles={vehicles} thermals={thermals} rateCad={rateCad} />
              ))}
            </div>

            <div className="mt-10 text-xs text-ink-400 max-w-3xl">
              <strong className="text-ink-300">How the slider works:</strong> the
              Adjusted-for-conditions rows run through a physics model calibrated
              against Geotab, Recurrent, Fastned, and Bjorn Nyland winter data.
              Battery capacity derates with cold by chemistry; HVAC draw is reduced
              for vehicles with heat pumps down to their operating floor.
              Preconditioning removes the DC-fast-charge cold penalty.
              Confidence drops to Low at slider extremes where data is thin —
              never fabricated precision.
            </div>
          </>
        )}

        {/* Tab: Trip Plan */}
        {activeTab === "trip" && (
          <TripPlanner vehicles={vehicles} />
        )}

        {/* Tab: Map & Range */}
        {activeTab === "map" && (
          <MapPanel vehicles={vehicles} thermals={thermals} />
        )}

        {/* Tab: Used Market */}
        {activeTab === "used" && (
          <UsedMarketPanel vehicles={vehicles} />
        )}

        <CreditsPanel />
      </div>
    </div>
  );
}

function RowBlock({
  row,
  vehicles,
  thermals,
  rateCad,
}: {
  row: Row;
  vehicles: Vehicle[];
  thermals: Record<string, ThermalOutputs>;
  rateCad: number;
}) {
  const { plainMode } = useAppStore();
  return (
    <>
      {row.section && (
        <div className="col-span-full py-2 mt-4 text-[11px] uppercase tracking-widest text-ink-500 border-b border-ink-700">
          {resolve(row.section, plainMode)}
        </div>
      )}
      <div className="py-2 px-1 text-sm text-ink-400 border-b border-ink-800">
        {resolve(row.label, plainMode)}
      </div>
      {vehicles.map((v) => (
        <div
          key={v.id}
          className="py-2 px-1 text-sm text-ink-100 border-b border-ink-800 font-mono"
        >
          {row.paused ? (
            <FeatureFlag pausedMessage={row.paused}>
              {row.render(v, thermals[v.id], rateCad)}
            </FeatureFlag>
          ) : (
            row.render(v, thermals[v.id], rateCad)
          )}
        </div>
      ))}
    </>
  );
}
