import type { Vehicle } from "../types";
import type { ThermalOutputs } from "../lib/thermal";

// Pure-SVG chart — no external dependency. Shows each vehicle's DC charging
// curve (kW vs SoC%). Curves scale DOWN by the current thermal_factor so the
// chart LIVE-UPDATES with the slider: preconditioned = near-rated, cold-soaked
// = flattened. The flat curve at extreme cold is the most visceral demo in the
// whole app.

const COLORS = [
  "#2a7cff", // accent-blue
  "#1fb76b", // accent-green
  "#f6a72a", // accent-amber
  "#e8453c", // accent-red
] as const;

const W = 720;
const H = 320;
const PAD_LEFT = 48;
const PAD_RIGHT = 24;
const PAD_TOP = 16;
const PAD_BOTTOM = 40;
const PLOT_W = W - PAD_LEFT - PAD_RIGHT;
const PLOT_H = H - PAD_TOP - PAD_BOTTOM;

function xForSoc(soc: number): number {
  return PAD_LEFT + (soc / 100) * PLOT_W;
}

function yForKw(kw: number, maxKw: number): number {
  return PAD_TOP + PLOT_H - (kw / maxKw) * PLOT_H;
}

export function ChargingCurveChart({
  vehicles,
  thermals,
}: {
  vehicles: Vehicle[];
  thermals: Record<string, ThermalOutputs>;
}) {
  // Build per-vehicle scaled curves.
  const scaledCurves = vehicles.map((v, i) => {
    const thermal = thermals[v.id];
    const factor = thermal?.breakdown.dc_temp_factor ?? 1;
    const points = v.charging_curve_20c.map((p) => ({
      soc: p.soc_pct,
      kw: p.kw * factor,
    }));
    return { vehicle: v, points, color: COLORS[i % COLORS.length] };
  });

  // Determine Y-axis max from the largest rated peak (not the scaled one) so
  // the axis stays steady as the slider moves — easier to read.
  const maxKw = Math.max(
    100,
    ...vehicles.map((v) => v.dc_charge_kw_max.value ?? 100),
  );

  // Rounded Y ticks.
  const yTickCount = 5;
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) =>
    Math.round((maxKw / yTickCount) * i),
  );

  const xTicks = [0, 20, 40, 60, 80, 100];

  return (
    <div className="bg-ink-800 rounded-lg border border-ink-700 p-4 mb-6">
      <div className="flex items-baseline gap-4 mb-2">
        <h3 className="font-display text-sm uppercase tracking-widest text-ink-300">
          DC charging curves
        </h3>
        <span className="text-xs text-ink-500">
          kW vs state-of-charge · scales with the conditions slider above
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        className="block"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Y grid + labels */}
        {yTicks.map((t) => {
          const y = yForKw(t, maxKw);
          return (
            <g key={`y${t}`}>
              <line
                x1={PAD_LEFT}
                x2={W - PAD_RIGHT}
                y1={y}
                y2={y}
                stroke="#26262d"
                strokeWidth={1}
              />
              <text
                x={PAD_LEFT - 6}
                y={y + 4}
                textAnchor="end"
                fontSize="10"
                fill="#6b6b78"
                fontFamily="ui-monospace, SF Mono, monospace"
              >
                {t}
              </text>
            </g>
          );
        })}

        {/* X grid + labels */}
        {xTicks.map((t) => {
          const x = xForSoc(t);
          return (
            <g key={`x${t}`}>
              <line
                x1={x}
                x2={x}
                y1={PAD_TOP}
                y2={PAD_TOP + PLOT_H}
                stroke="#26262d"
                strokeWidth={1}
              />
              <text
                x={x}
                y={PAD_TOP + PLOT_H + 14}
                textAnchor="middle"
                fontSize="10"
                fill="#6b6b78"
                fontFamily="ui-monospace, SF Mono, monospace"
              >
                {t}%
              </text>
            </g>
          );
        })}

        {/* Axis labels */}
        <text
          x={PAD_LEFT - 30}
          y={PAD_TOP + PLOT_H / 2}
          textAnchor="middle"
          transform={`rotate(-90 ${PAD_LEFT - 30} ${PAD_TOP + PLOT_H / 2})`}
          fontSize="10"
          fill="#a0a0ac"
        >
          kW
        </text>
        <text
          x={PAD_LEFT + PLOT_W / 2}
          y={H - 6}
          textAnchor="middle"
          fontSize="10"
          fill="#a0a0ac"
        >
          state of charge
        </text>

        {/* Curves */}
        {scaledCurves.map(({ vehicle, points, color }) => {
          if (points.length === 0) return null;
          const d = points
            .map((p, idx) => {
              const x = xForSoc(p.soc);
              const y = yForKw(p.kw, maxKw);
              return `${idx === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .join(" ");
          return (
            <g key={vehicle.id}>
              <path d={d} fill="none" stroke={color} strokeWidth={2} />
              {points.map((p, idx) => (
                <circle
                  key={idx}
                  cx={xForSoc(p.soc)}
                  cy={yForKw(p.kw, maxKw)}
                  r={3}
                  fill={color}
                />
              ))}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2">
        {scaledCurves.map(({ vehicle, color }) => {
          const thermal = thermals[vehicle.id];
          const peakAdjusted = thermal?.peak_dc_kw ?? vehicle.dc_charge_kw_max.value ?? 0;
          const peakRated = vehicle.dc_charge_kw_max.value ?? 0;
          const diff = peakRated > 0 ? Math.round((peakAdjusted / peakRated) * 100) : 100;
          return (
            <div key={vehicle.id} className="flex items-center gap-2 text-xs">
              <span
                className="inline-block w-3 h-3 rounded-sm"
                style={{ backgroundColor: color }}
              />
              <span className="text-ink-200">
                {vehicle.model}{" "}
                <span className="text-ink-400">{vehicle.trim_label}</span>
              </span>
              <span className="text-ink-500 font-mono">
                {Math.round(peakAdjusted)} kW peak{" "}
                <span className="text-ink-600">({diff}% of rated)</span>
              </span>
            </div>
          );
        })}
      </div>

      {vehicles.some((v) => v.charging_curve_20c.length === 0) && (
        <div className="mt-2 text-[11px] text-ink-500">
          Some vehicles don't yet have charging-curve data in the seed; they'll appear once added.
        </div>
      )}
    </div>
  );
}
