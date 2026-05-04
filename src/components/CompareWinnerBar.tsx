"use client";

interface WinEntry {
  name: string;
  wins: number;
}

interface Props {
  winCounts: WinEntry[];
  total: number;
}

export function CompareWinnerBar({ winCounts, total }: Props) {
  const sorted = [...winCounts].sort((a, b) => b.wins - a.wins);
  const leader = sorted[0];
  if (!leader || leader.wins === 0) return null;
  const tied = sorted.filter((w) => w.wins === leader.wins).length > 1;
  return (
    <div className="sticky bottom-4 z-20 mt-4 print:hidden">
      <div className="mx-auto max-w-fit px-4 py-2 rounded-full bg-bg border border-border shadow-lg text-xs flex items-center gap-3">
        <span className="text-good font-semibold">
          {tied ? "Tied" : `${leader.name} leads`}
        </span>
        <span className="text-fg-subtle">·</span>
        {winCounts.map(
          (w) =>
            w.wins > 0 && (
              <span key={w.name} className="tabular-nums">
                <span className="text-fg">{w.name}</span>
                <span className="text-fg-subtle">
                  {" "}
                  {w.wins}/{total}
                </span>
              </span>
            ),
        )}
      </div>
    </div>
  );
}
