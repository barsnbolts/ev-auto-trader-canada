const cadFormatter = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});

const cadCentsFormatter = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

export function fmtCad(n: number, opts: { cents?: boolean } = {}): string {
  return opts.cents ? cadCentsFormatter.format(n) : cadFormatter.format(n);
}

export function fmtPercent(n: number, digits = 2): string {
  return `${n.toFixed(digits)}%`;
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Coerce an ISO timestamp (or date) to its YYYY-MM-DD prefix.
 * Centralizes the `iso.slice(0, 10)` idiom used in chart series binning,
 * snapshot dedup keys, and any "what day did X happen" comparison. Robust
 * to inputs already in YYYY-MM-DD form (returns unchanged).
 */
export function isoDay(iso: string): string {
  return iso.slice(0, 10);
}

export function relativeDays(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return "1 month ago";
  return `${months} months ago`;
}
