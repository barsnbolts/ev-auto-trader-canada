"use client";

// DC charging curve chart for the dossier page.
// Adapted from sibling EV dashboard's ChargingCurveChart.tsx (pure-SVG, multi-vehicle)
// into a single-vehicle recharts LineChart.
//
// Renders kW vs state-of-charge (%) from spec.chargingCurve.
// Returns null silently if data is absent — caller need not guard.

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { ChargingCurvePoint } from "@/lib/types";

interface Props {
  spec:
    | {
        chargingCurve?: ChargingCurvePoint[];
        dcChargeMaxKw?: { value: number | null } | number;
        model?: string;
        trim?: string;
      }
    | undefined;
}

function readDcMax(
  v: { value: number | null } | number | undefined,
): number | undefined {
  if (v == null) return undefined;
  if (typeof v === "number") return v;
  return v.value ?? undefined;
}

// Custom tooltip so we get "10% → 150 kW" style labels.
function CurveTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { value: number; payload: ChargingCurvePoint }[];
}) {
  if (!active || !payload?.length) return null;
  const pt = payload[0].payload;
  return (
    <div className="bg-surface border border-border rounded px-2 py-1 text-xs shadow-sm">
      <span className="text-fg-subtle">{pt.socPct}% SoC →</span>{" "}
      <span className="font-semibold text-fg">{pt.kw} kW</span>
    </div>
  );
}

export function ChargingCurveChart({ spec }: Props) {
  if (!spec?.chargingCurve?.length) return null;

  const data = [...spec.chargingCurve].sort((a, b) => a.socPct - b.socPct);
  const peakKw = Math.max(...data.map((p) => p.kw));
  const dcMax = readDcMax(spec.dcChargeMaxKw);

  // Y-axis ceiling: rated peak rounded up to nearest 50, at least 50 kW.
  const yMax = Math.max(50, Math.ceil((dcMax ?? peakKw) / 50) * 50);

  return (
    <div>
      <div className="mb-2">
        <span className="text-xs text-fg-subtle">
          DC charging curve (kW vs state-of-charge) · 20 °C reference
        </span>
        {dcMax && (
          <span className="ml-2 text-xs text-fg-muted">
            rated peak: <strong>{dcMax} kW</strong>
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 24, left: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" opacity={0.5} />
          <XAxis
            dataKey="socPct"
            type="number"
            domain={[0, 100]}
            ticks={[0, 20, 40, 60, 80, 100]}
            tickFormatter={(v) => `${v}%`}
            label={{
              value: "state of charge",
              position: "insideBottom",
              offset: -16,
              style: { fontSize: 10, fill: "var(--color-fg-muted, #9ca3af)" },
            }}
            tick={{ fontSize: 10 }}
          />
          <YAxis
            domain={[0, yMax]}
            tickFormatter={(v) => `${v}`}
            label={{
              value: "kW",
              angle: -90,
              position: "insideLeft",
              offset: -24,
              style: { fontSize: 10, fill: "var(--color-fg-muted, #9ca3af)" },
            }}
            tick={{ fontSize: 10 }}
          />
          <Tooltip content={<CurveTooltip />} />
          {/* Mark the 10–80% fast-charge window */}
          <ReferenceLine x={10} stroke="#6b7280" strokeDasharray="4 2" strokeWidth={1} />
          <ReferenceLine x={80} stroke="#6b7280" strokeDasharray="4 2" strokeWidth={1} />
          <Line
            type="monotone"
            dataKey="kw"
            stroke="#2a7cff"
            strokeWidth={2}
            dot={{ r: 3, fill: "#2a7cff" }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-xxs text-fg-muted mt-1">
        Dashed lines mark 10 % and 80 % SoC (typical fast-charge window).
        Actual peak kW varies by battery temperature and SoC entry point.
      </p>
    </div>
  );
}
