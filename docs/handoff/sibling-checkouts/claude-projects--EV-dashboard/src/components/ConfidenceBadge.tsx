import type { Confidence, Source } from "../types";

const STYLES: Record<Confidence, string> = {
  High: "bg-accent-green/15 text-accent-green border-accent-green/30",
  Medium: "bg-accent-amber/15 text-accent-amber border-accent-amber/30",
  Low: "bg-accent-red/15 text-accent-red border-accent-red/30",
};

const PLAIN_ENGLISH: Record<Confidence, string> = {
  High: "High confidence — cross-verified across two or more independent sources (EPA, manufacturer, community testing).",
  Medium: "Medium confidence — sourced from the manufacturer or a single reputable third party. Usually correct, occasionally needs a refresh.",
  Low: "Low confidence — provisional or changing fast (e.g., brand-new model year, volatile pricing). Always verify before buying.",
};

export function ConfidenceBadge({
  level,
  compact = false,
  source,
  notes,
}: {
  level: Confidence;
  compact?: boolean;
  source?: Source;
  notes?: string;
}) {
  // Build a richer plain-English tooltip. Native `title` renders as plain
  // text on hover, so we join with newlines for readability.
  const parts: string[] = [PLAIN_ENGLISH[level]];
  if (source?.name) {
    parts.push(`Source: ${source.name}`);
    if (source.accessed) parts.push(`Accessed: ${source.accessed}`);
  }
  if (notes) parts.push(`Notes: ${notes}`);
  const title = parts.join("\n\n");

  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide cursor-help ${STYLES[level]}`}
      title={title}
    >
      {compact ? level.charAt(0) : level}
    </span>
  );
}
