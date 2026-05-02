import type { Vehicle } from "../types";
import { useAppStore } from "../store/useAppStore";
import { cad, km, kw } from "../lib/format";
import { ConfidenceBadge } from "./ConfidenceBadge";

export function VehicleRow({ vehicle }: { vehicle: Vehicle }) {
  const { compareIds, toggleCompare } = useAppStore();
  const isSelected = compareIds.includes(vehicle.id);
  const atCap = compareIds.length >= 4 && !isSelected;

  return (
    <div
      className={`group flex items-center gap-4 px-6 py-3 border-l-2 transition hover:bg-ink-700/40 ${
        isSelected
          ? "border-l-accent-blue bg-accent-blue/5"
          : "border-l-transparent"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-base text-ink-100">
            {vehicle.model}
          </span>
          <span className="text-xs text-ink-400">
            {vehicle.generation_label}
          </span>
          <span className="text-xs text-ink-300">· {vehicle.trim_label}</span>
          <ConfidenceBadge
            level={vehicle.overall_confidence}
            compact
            notes={vehicle.notes}
          />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-ink-400 mt-0.5">
          <span>
            <span className="text-ink-300">{vehicle.powertrain}</span> ·{" "}
            {vehicle.body_style} · {vehicle.drivetrain_variant === "AWD" ? "AWD" : "RWD/FWD"}
          </span>
          <span>Range: <span className="text-ink-100">{km(vehicle.range_km.value)}</span> ({vehicle.range_protocol})</span>
          <span>Peak DC: <span className="text-ink-100">{kw(vehicle.dc_charge_kw_max.value)}</span></span>
          <span>Port: <span className="text-ink-100">{vehicle.port_type}</span></span>
          <span>MSRP: <span className="text-ink-100">{cad(vehicle.msrp_cad.value)}</span></span>
        </div>
      </div>

      <button
        disabled={atCap}
        onClick={() => toggleCompare(vehicle.id)}
        className={`px-3 py-1.5 rounded text-xs font-medium transition whitespace-nowrap ${
          isSelected
            ? "bg-accent-blue text-white"
            : atCap
              ? "bg-ink-700 text-ink-500 cursor-not-allowed"
              : "bg-ink-700 text-ink-200 hover:bg-ink-600"
        }`}
        title={atCap ? "Compare tray full (max 4)" : undefined}
      >
        {isSelected ? "✓ Comparing" : "Add to compare"}
      </button>
    </div>
  );
}
