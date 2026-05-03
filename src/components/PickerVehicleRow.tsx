"use client";

import type { Spec } from "@/lib/types";
import { readNumeric, readHeatPump } from "@/lib/types";
import { usePickerStore, pickerKey } from "@/store/picker";

function fmt(n: number | undefined, suffix: string): string {
  if (n == null) return "—";
  return `${n.toLocaleString()}${suffix}`;
}

interface Props {
  spec: Spec;
}

export function PickerVehicleRow({ spec }: Props) {
  const { selectedIds, addToTray, removeFromTray } = usePickerStore();
  const id = pickerKey(spec.model, spec.year, spec.trim, spec.drivetrain);
  const isSelected = selectedIds.includes(id);
  const atCap = selectedIds.length >= 4 && !isSelected;

  const rangeKm = spec.rangeEpaKm ? readNumeric(spec.rangeEpaKm) : spec.rangeKm;
  const batteryKwh =
    typeof spec.batteryKwh === "object" && spec.batteryKwh !== null
      ? readNumeric(spec.batteryKwh as Parameters<typeof readNumeric>[0])
      : typeof spec.batteryKwh === "number"
      ? spec.batteryKwh
      : undefined;
  const dcKw =
    spec.dcChargeMaxKw
      ? readNumeric(spec.dcChargeMaxKw)
      : spec.dcFastChargeKw;
  const hasHp = readHeatPump(spec.hasHeatPump);

  const buyUrl = `/inventory?make=${encodeURIComponent(spec.model)}&model=${encodeURIComponent(spec.model)}&trim=${encodeURIComponent(spec.trim)}`;

  return (
    <div
      className={`group flex items-center gap-4 px-4 py-3 border-l-2 transition hover:bg-bg-hover ${
        isSelected
          ? "border-l-accent bg-accent-dim/10"
          : "border-l-transparent"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-semibold text-fg">{spec.model}</span>
          <span className="text-xs text-fg-muted">{spec.year}</span>
          <span className="text-xs text-fg-subtle">· {spec.trim}</span>
          {spec.powertrain && (
            <span className="chip chip-accent">{spec.powertrain}</span>
          )}
          {spec.bodyStyle && (
            <span className="chip chip-neutral">{spec.bodyStyle}</span>
          )}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-fg-muted mt-1">
          <span>
            Drive: <span className="text-fg">{spec.drivetrain}</span>
          </span>
          {rangeKm != null && (
            <span>
              Range: <span className="text-fg">{fmt(rangeKm, " km")}</span>
              {spec.rangeProtocol && (
                <span className="text-fg-subtle ml-1">({spec.rangeProtocol})</span>
              )}
            </span>
          )}
          {batteryKwh != null && (
            <span>
              Battery: <span className="text-fg">{fmt(batteryKwh, " kWh")}</span>
            </span>
          )}
          {dcKw != null && (
            <span>
              DC: <span className="text-fg">{fmt(dcKw, " kW")}</span>
            </span>
          )}
          {spec.seats != null && (
            <span>
              Seats: <span className="text-fg">{spec.seats}</span>
            </span>
          )}
          {spec.msrpCad != null && (
            <span>
              MSRP: <span className="text-fg">${spec.msrpCad.toLocaleString()}</span>
            </span>
          )}
          {hasHp != null && (
            <span>
              Heat pump:{" "}
              <span className={hasHp ? "text-good" : "text-fg-muted"}>
                {hasHp ? "Yes" : "No"}
              </span>
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <a
          href={buyUrl}
          className="px-3 py-1.5 rounded text-xs font-medium bg-accent text-bg hover:opacity-90 transition whitespace-nowrap"
        >
          Buy this model
        </a>
        <button
          disabled={atCap}
          onClick={() => (isSelected ? removeFromTray(id) : addToTray(id))}
          className={`px-3 py-1.5 rounded text-xs font-medium transition whitespace-nowrap ${
            isSelected
              ? "bg-accent-dim text-accent border border-accent"
              : atCap
              ? "bg-bg border border-border text-fg-subtle cursor-not-allowed"
              : "bg-bg border border-border text-fg-muted hover:text-fg hover:bg-bg-hover"
          }`}
          title={atCap ? "Compare tray full (max 4)" : undefined}
        >
          {isSelected ? "✓ In tray" : "Add to compare"}
        </button>
      </div>
    </div>
  );
}
