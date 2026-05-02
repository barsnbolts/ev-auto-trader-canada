import type { Vehicle } from "../types";
import { useAppStore } from "../store/useAppStore";
import { cad, km, kw } from "../lib/format";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { TERM, POWERTRAIN_PLAIN, PROTOCOL_PLAIN } from "../lib/labels";

export function VehicleRow({ vehicle }: { vehicle: Vehicle }) {
  const { compareIds, toggleCompare, plainMode } = useAppStore();
  const isSelected = compareIds.includes(vehicle.id);
  const atCap = compareIds.length >= 4 && !isSelected;

  const powertrainLabel = plainMode
    ? (POWERTRAIN_PLAIN[vehicle.powertrain] ?? vehicle.powertrain)
    : vehicle.powertrain;

  const protocolLabel = plainMode
    ? (PROTOCOL_PLAIN[vehicle.range_protocol] ?? vehicle.range_protocol)
    : vehicle.range_protocol;

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
          <ConfidenceBadge level={vehicle.overall_confidence} compact />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-ink-400 mt-0.5">
          <span>
            <span className="text-ink-300">{powertrainLabel}</span> ·{" "}
            {vehicle.body_style} · {vehicle.drivetrain_variant === "AWD" ? "AWD" : "RWD/FWD"}
          </span>
          <span>
            {plainMode ? TERM.range.plain : TERM.range.geek}:{" "}
            <span className="text-ink-100">{km(vehicle.range_km.value)}</span>{" "}
            ({protocolLabel})
          </span>
          <span>
            {plainMode ? TERM.peakDc.plain : TERM.peakDc.geek}:{" "}
            <span className="text-ink-100">{kw(vehicle.dc_charge_kw_max.value)}</span>
          </span>
          <span>
            {plainMode ? TERM.port.plain : TERM.port.geek}:{" "}
            <span className="text-ink-100">{vehicle.port_type}</span>
          </span>
          <span>
            {plainMode ? TERM.msrp.plain : TERM.msrp.geek}:{" "}
            <span className="text-ink-100">{cad(vehicle.msrp_cad.value)}</span>
          </span>
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
        aria-label={
          isSelected
            ? `Remove ${vehicle.model} from comparison`
            : atCap
              ? "Compare tray full (max 4 vehicles)"
              : `Add ${vehicle.model} to comparison`
        }
      >
        {isSelected ? "✓ Comparing" : atCap ? "Tray full (4)" : "Add to compare"}
      </button>
    </div>
  );
}
