"use client";

interface Props {
  curve: { socPct: number; kw: number }[];
  peakKw: number;
}

// Tiny inline sparkline of the DC charging curve (kW vs SoC%).
// 60×16 SVG, no axes/labels — visual flavor only. Tooltip carries detail.
export function MiniChargingSparkline({ curve, peakKw }: Props) {
  if (!curve || curve.length < 2) return null;
  const w = 60;
  const h = 16;
  const points = curve
    .map((p) => {
      const x = (p.socPct / 100) * w;
      const y = h - (p.kw / Math.max(peakKw, 1)) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      width={w}
      height={h}
      className="inline-block ml-1 align-middle text-accent"
      aria-hidden
    >
      <title>{`DC charging curve — peak ${Math.round(peakKw)} kW`}</title>
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}
