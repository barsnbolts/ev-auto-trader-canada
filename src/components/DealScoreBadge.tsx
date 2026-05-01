export function DealScoreBadge({ score }: { score: number }) {
  const cls =
    score >= 70
      ? "chip-accent"
      : score >= 45
      ? "chip-warn"
      : "chip-bad";
  return <span className={cls}>{score}</span>;
}
