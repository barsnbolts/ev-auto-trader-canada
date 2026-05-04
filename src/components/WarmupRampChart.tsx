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
import { realRangeRampCurve, type RealRangeParams } from "@/lib/thermal";

interface Props {
  params: Omit<RealRangeParams, "preconditioned">;
}

// First-10-min cold-start range penalty viz. Two lines: cold-soaked vs
// preconditioned, sampled at 0/5/10/15/20/30/45/60 min into the drive.
export function WarmupRampChart({ params }: Props) {
  if (params.tempC >= 5) return null;
  const cold = realRangeRampCurve({ ...params, preconditioned: false });
  const warm = realRangeRampCurve({ ...params, preconditioned: true });
  if (cold.length === 0 || warm.length === 0) return null;
  const data = cold.map((c, i) => ({
    minute: c.minute,
    "Cold-soaked": c.rangeKm,
    Preconditioned: warm[i]?.rangeKm ?? null,
  }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 4 }}>
        <XAxis
          dataKey="minute"
          tick={{ fontSize: 10 }}
          label={{
            value: "min into drive",
            position: "insideBottom",
            offset: -2,
            fontSize: 10,
          }}
        />
        <YAxis
          tick={{ fontSize: 10 }}
          label={{ value: "km", angle: -90, position: "insideLeft", fontSize: 10 }}
        />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: "10px" }} />
        <Line type="monotone" dataKey="Cold-soaked" stroke="#f87171" strokeWidth={2} dot={{ r: 2 }} />
        <Line type="monotone" dataKey="Preconditioned" stroke="#34d399" strokeWidth={2} dot={{ r: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
