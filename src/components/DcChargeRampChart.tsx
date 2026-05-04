"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { dcChargeRamp } from "@/lib/thermal";
import type { Spec } from "@/lib/types";
import { readNumeric } from "@/lib/types";

interface Props {
  spec: Spec;
  tempC: number;
  preconditioned: boolean;
  chargerKwOptions?: number[];
}

// Per-charger × precon × ambient charging-power ramp. Lines = charger levels.
export function DcChargeRampChart({
  spec,
  tempC,
  preconditioned,
  chargerKwOptions = [50, 150, 250, 350],
}: Props) {
  const bat = readNumeric(spec.batteryKwhUsable) ?? readNumeric(spec.batteryKwh);
  const peak = readNumeric(spec.dcChargeMaxKw);
  if (!bat || !peak) return null;

  const baseParams = {
    chargingCurve: spec.chargingCurve,
    dcPeakKw: peak,
    batteryKwh: bat,
    ambientTempC: tempC,
    preconditioned,
    batteryThermalMassKjPerKwh: spec.batteryThermalMassKjPerKwh,
    heatLossCoeffKwPerC: spec.heatLossCoeffKwPerC,
    packHeaterKw: spec.packHeaterKw,
    chargingArchitectureVolts: spec.chargingArchitectureVolts,
  } as const;

  const ramps = chargerKwOptions.map((c) => ({
    label: `${c} kW`,
    points: dcChargeRamp({ ...baseParams, chargerMaxKw: c }),
  }));

  const maxMin = Math.max(...ramps.map((r) => r.points.length));
  if (maxMin === 0) return null;

  const data: Record<string, number | string>[] = [];
  for (let m = 0; m < maxMin; m++) {
    const row: Record<string, number | string> = { minute: m };
    for (const r of ramps) {
      const pt = r.points[m];
      if (pt) row[r.label] = Math.round(pt.kw);
    }
    data.push(row);
  }

  const colors: Record<string, string> = {
    "50 kW": "#94a3b8",
    "150 kW": "#60a5fa",
    "250 kW": "#34d399",
    "350 kW": "#f59e0b",
  };

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}>
        <XAxis
          dataKey="minute"
          tick={{ fontSize: 10 }}
          label={{ value: "min", position: "insideBottom", offset: -2, fontSize: 10 }}
        />
        <YAxis
          tick={{ fontSize: 10 }}
          label={{ value: "kW", angle: -90, position: "insideLeft", fontSize: 10 }}
        />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: "10px" }} />
        {ramps.map((r) => (
          <Line
            key={r.label}
            type="monotone"
            dataKey={r.label}
            stroke={colors[r.label] ?? "#a3a3a3"}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
