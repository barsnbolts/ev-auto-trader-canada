import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { debugLog } from "../lib/debugLog";
import type { Vehicle } from "../types";
import type { ThermalOutputs } from "../lib/thermal";

/**
 * F-04 — "Why did this number change?" breakdown drawer.
 *
 * Collapsible panel under the slider that explains the four levers driving the
 * adjusted-for-conditions rows: capacity fraction, HVAC draw, DC pre-condition
 * factor, DC temp factor. One column per compared vehicle.
 */
export function WhyDrawer({
  vehicles,
  thermals,
}: {
  vehicles: Vehicle[];
  thermals: Record<string, ThermalOutputs>;
}) {
  const [open, setOpen] = useState(false);
  const { temp_c, hvac_on, preconditioned } = useAppStore();

  const toggle = () => {
    debugLog("ui", "why_drawer_toggle", { open: !open, temp_c, hvac_on });
    setOpen(!open);
  };

  return (
    <div className="mt-3">
      <button
        onClick={toggle}
        className="text-xs text-ink-400 hover:text-ink-200 underline underline-offset-2 decoration-dotted"
        aria-expanded={open}
      >
        {open ? "Hide" : "Why these numbers?"}
      </button>

      {open && (
        <div className="mt-3 rounded border border-ink-700 bg-ink-800/60 p-4 text-xs">
          <p className="text-ink-300 mb-3 max-w-2xl">
            Each row below shows the underlying lever the physics model uses at{" "}
            <span className="text-ink-100">{temp_c}°C</span>
            {hvac_on ? " with HVAC on" : " with HVAC off"}. Cold and HVAC eat
            range; preconditioning rescues fast-charging speed.
          </p>

          <div
            className="grid gap-0"
            style={{
              gridTemplateColumns: `220px repeat(${vehicles.length}, minmax(150px, 1fr))`,
            }}
          >
            <BreakdownHeader vehicles={vehicles} />

            <BreakdownRow
              label="Battery capacity available"
              hint="Cold lithium chemistry can't deliver its full rated energy. 1.00 = full; 0.80 = 80% of rated kWh available right now."
              values={vehicles.map((v) => {
                const f = thermals[v.id].breakdown.capacity_fraction;
                return `${(f * 100).toFixed(0)}%`;
              })}
            />

            <BreakdownRow
              label="HVAC draw (cabin heat / cool)"
              hint="kW pulled by climate control at this temp. Heat-pump cars stay efficient down to their floor temp; resistive heat draws ~5–8 kW in deep cold."
              values={vehicles.map((v) => {
                const kw = thermals[v.id].breakdown.hvac_kw;
                return kw === 0 ? "off" : `${kw.toFixed(1)} kW`;
              })}
            />

            <BreakdownRow
              label="DC charging — preconditioning"
              hint="1.00 = battery already warmed before plug-in; lower = cold-soaked penalty applied to the curve."
              values={vehicles.map((v) => {
                const pre = preconditioned[v.id] ?? true;
                const f = thermals[v.id].breakdown.dc_precon_factor;
                return `${f.toFixed(2)}× (${pre ? "preconditioned" : "cold"})`;
              })}
            />

            <BreakdownRow
              label="DC charging — temp factor"
              hint="Combined effect of ambient temperature on peak DC speed. 1.00 = warm sweet spot; 0.30 = deep-winter trickle."
              values={vehicles.map((v) => {
                const f = thermals[v.id].breakdown.dc_temp_factor;
                return `${f.toFixed(2)}×`;
              })}
            />

            <BreakdownRow
              label="Rated efficiency (no penalties)"
              hint="Wh per km the EPA test produced. Compare against the consumption row above to see how much slider conditions cost."
              values={vehicles.map((v) => {
                const e = thermals[v.id].breakdown.rated_efficiency_whkm;
                return `${Math.round(e)} Wh/km`;
              })}
            />
          </div>

          <p className="text-ink-500 mt-4 max-w-2xl">
            Note: confidence drops to Low past −30°C or above 40°C — slider
            extremes outrun the calibration data.
          </p>
        </div>
      )}
    </div>
  );
}

function BreakdownHeader({ vehicles }: { vehicles: Vehicle[] }) {
  return (
    <>
      <div className="py-2 px-1 text-[11px] uppercase tracking-widest text-ink-500 border-b border-ink-700">
        Lever
      </div>
      {vehicles.map((v) => (
        <div
          key={v.id}
          className="py-2 px-1 text-[11px] uppercase tracking-widest text-ink-500 border-b border-ink-700"
        >
          {v.model} <span className="text-ink-600">{v.trim_label}</span>
        </div>
      ))}
    </>
  );
}

function BreakdownRow({
  label,
  hint,
  values,
}: {
  label: string;
  hint: string;
  values: string[];
}) {
  return (
    <>
      <div
        className="py-2 px-1 text-ink-300 border-b border-ink-800"
        title={hint}
      >
        {label}
      </div>
      {values.map((val, i) => (
        <div
          key={i}
          className="py-2 px-1 text-ink-100 border-b border-ink-800 font-mono"
        >
          {val}
        </div>
      ))}
    </>
  );
}
