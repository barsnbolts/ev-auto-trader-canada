import { useMemo } from "react";
import { allVehicles } from "../data";
import type { Confidence } from "../types";

// Compact "data health" pill in the main header. Shows at-a-glance confidence
// breakdown across the whole seed. Hover for a plain-English summary. The
// idea: if the breakdown is 0 High / 19 Med / 1 Low, that's a visible
// reminder to run the Exa verification pass. Once High counts grow, the pill
// shifts color, signaling dataset maturity.

const DOT_COLORS: Record<Confidence, string> = {
  High: "bg-accent-green",
  Medium: "bg-accent-amber",
  Low: "bg-accent-red",
};

export function DataHealth() {
  const stats = useMemo(() => {
    let h = 0, m = 0, l = 0;
    for (const v of allVehicles) {
      if (v.overall_confidence === "High") h++;
      else if (v.overall_confidence === "Medium") m++;
      else l++;
    }
    return { h, m, l, total: allVehicles.length };
  }, []);

  const pctHigh = stats.total > 0 ? Math.round((stats.h / stats.total) * 100) : 0;
  const tooltip =
    `${stats.total} vehicles · ${stats.h} High, ${stats.m} Medium, ${stats.l} Low confidence ` +
    `(${pctHigh}% High). Run the Exa verification pass to promote Medium → High.`;

  return (
    <div
      className="flex items-center gap-1.5 bg-ink-700/40 rounded px-2 py-1 text-xs"
      title={tooltip}
    >
      <span className="text-ink-400 mr-1">data</span>
      <span className={`inline-block w-2 h-2 rounded-full ${DOT_COLORS.High}`} />
      <span className="text-ink-200 font-mono">{stats.h}</span>
      <span className={`inline-block w-2 h-2 rounded-full ${DOT_COLORS.Medium} ml-1`} />
      <span className="text-ink-200 font-mono">{stats.m}</span>
      <span className={`inline-block w-2 h-2 rounded-full ${DOT_COLORS.Low} ml-1`} />
      <span className="text-ink-200 font-mono">{stats.l}</span>
    </div>
  );
}
