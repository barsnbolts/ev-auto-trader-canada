import type { ReactNode } from "react";

export function KpiTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: "accent" | "warn" | "bad";
}) {
  const valueClass =
    accent === "accent"
      ? "text-accent"
      : accent === "warn"
      ? "text-warn"
      : accent === "bad"
      ? "text-bad"
      : "text-fg";
  return (
    <div className="card p-4 flex flex-col gap-1">
      <div className="text-xxs uppercase tracking-wide text-fg-subtle">{label}</div>
      <div className={`text-2xl font-semibold num ${valueClass}`}>{value}</div>
      {sub && <div className="text-xs text-fg-muted">{sub}</div>}
    </div>
  );
}
