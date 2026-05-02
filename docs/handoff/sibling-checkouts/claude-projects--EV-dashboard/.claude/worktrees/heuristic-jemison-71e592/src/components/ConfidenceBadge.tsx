import type { Confidence } from "../types";

const STYLES: Record<Confidence, string> = {
  High: "bg-accent-green/15 text-accent-green border-accent-green/30",
  Medium: "bg-accent-amber/15 text-accent-amber border-accent-amber/30",
  Low: "bg-accent-red/15 text-accent-red border-accent-red/30",
};

const TOOLTIPS: Record<Confidence, string> = {
  High: "High confidence: two or more independent sources agree on this number.",
  Medium: "Medium confidence: from a single source or only partially independently verified.",
  Low: "Low confidence: estimated, extrapolated, or sparse data — treat as approximate.",
};

export function ConfidenceBadge({
  level,
  compact = false,
}: {
  level: Confidence;
  compact?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${STYLES[level]}`}
      title={TOOLTIPS[level]}
    >
      {compact ? level.charAt(0) : level}
    </span>
  );
}
