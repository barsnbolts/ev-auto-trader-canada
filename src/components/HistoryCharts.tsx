"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export type SeriesPoint = { date: string } & Record<string, number | string>;

export function HistoryCountChart({
  data,
  series,
}: {
  data: SeriesPoint[];
  series: { key: string; label: string; color: string }[];
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid stroke="#23232b" strokeDasharray="3 3" />
          <XAxis dataKey="date" stroke="#71717a" fontSize={11} />
          <YAxis stroke="#71717a" fontSize={11} allowDecimals={false} />
          <Tooltip
            contentStyle={{
              background: "#16161a",
              border: "1px solid #2e2e38",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }} />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function HistoryPriceChart({ data }: { data: SeriesPoint[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid stroke="#23232b" strokeDasharray="3 3" />
          <XAxis dataKey="date" stroke="#71717a" fontSize={11} />
          <YAxis
            stroke="#71717a"
            fontSize={11}
            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            contentStyle={{
              background: "#16161a",
              border: "1px solid #2e2e38",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v: number) => `$${v.toLocaleString("en-CA")}`}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }} />
          <Line type="monotone" dataKey="EV6" stroke="#6ee7b7" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="Ioniq5" stroke="#fbbf24" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="Ioniq6" stroke="#60a5fa" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
