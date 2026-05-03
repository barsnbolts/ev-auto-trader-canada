// Battery health projection panel for the dossier page.
// Uses the linear degradation model from lib/battery_degradation.ts.
// Renders Year-3 and Year-5 projected range + loss percentage.
// Returns null (or a "pending" note) when required fields are missing.

import { retentionAtYear, projectedRangeAtYear, type BatteryChemistry } from "@/lib/battery_degradation";
import type { Spec } from "@/lib/types";

interface Props {
  spec: Spec | undefined;
  /** The unit being viewed — used for display name only */
  unit?: { model: string; trim?: string; year?: number };
}

type RangeSource = "epa" | "legacy" | "missing";

function readRangeKm(spec: Spec): { km: number | undefined; src: RangeSource } {
  // Prefer EPA-rated CitedValue range, fall back to flat rangeKm.
  // Track which source was used so the UI can flag carryover values.
  if (spec.rangeEpaKm?.value != null) return { km: spec.rangeEpaKm.value, src: "epa" };
  if (spec.rangeKm != null) return { km: spec.rangeKm, src: "legacy" };
  return { km: undefined, src: "missing" };
}

export function BatteryHealthPanel({ spec }: Props) {
  if (!spec) return null;

  const chem = spec.batteryChemistry as BatteryChemistry | undefined;
  const { km: ratedRangeKm, src: rangeSrc } = readRangeKm(spec);

  // All three fields must be present for projections.
  if (!chem || !ratedRangeKm) {
    return (
      <p className="text-xs text-fg-muted italic">
        Battery health projection — research pending (chemistry or rated range not yet confirmed).
      </p>
    );
  }

  const y3Retention = retentionAtYear(chem, 3);
  const y5Retention = retentionAtYear(chem, 5);
  const y3Km = Math.round(projectedRangeAtYear(ratedRangeKm, chem, 3));
  const y5Km = Math.round(projectedRangeAtYear(ratedRangeKm, chem, 5));
  const y3Loss = Math.round((1 - y3Retention) * 100);
  const y5Loss = Math.round((1 - y5Retention) * 100);

  // Chemistry label for display
  const chemLabel: Record<BatteryChemistry, string> = {
    LFP: "LFP (most durable)",
    NMC: "NMC",
    NCA: "NCA",
    LMR: "LMR",
    UNKNOWN: "unknown chemistry",
  };

  return (
    <div>
      <table className="w-full text-sm">
        <tbody>
          <tr>
            <td className="py-1 pr-4 text-fg-subtle">Rated range</td>
            <td className="py-1 tabular-nums">{ratedRangeKm} km</td>
          </tr>
          <tr>
            <td className="py-1 pr-4 text-fg-subtle">Battery chemistry</td>
            <td className="py-1">{chemLabel[chem]}</td>
          </tr>
          <tr>
            <td className="py-1 pr-4 text-fg-subtle">Year 3 (est.)</td>
            <td className="py-1 tabular-nums">
              {y3Km} km{" "}
              <span className="text-fg-muted text-xs">({y3Loss}% loss)</span>
            </td>
          </tr>
          <tr>
            <td className="py-1 pr-4 text-fg-subtle">Year 5 (est.)</td>
            <td className="py-1 tabular-nums">
              {y5Km} km{" "}
              <span className="text-fg-muted text-xs">({y5Loss}% loss)</span>
            </td>
          </tr>
        </tbody>
      </table>
      <p className="text-xxs text-fg-muted mt-1">
        Linear model · {Math.round((1 - retentionAtYear(chem, 1)) * 100 * 10) / 10}%/yr · Recurrent Auto 2024 fleet data.
        Actual loss varies with charging habits and climate.
        {chem === "LFP" && " LFP chemistry degrades slower than NMC — strong long-term value."}
        {chem === "NMC" && " NMC is common in Korean EVs; warranty covers ≥70% capacity for 8 yr / 160 000 km."}
        {rangeSrc === "legacy" && (
          <>
            {" "}
            <em>Data: Medium confidence — rated range from legacy field, not cited EPA value.</em>
          </>
        )}
      </p>
    </div>
  );
}
