"use client";

/**
 * OtdWaterfallChart — visualises the OTD cash-path build-up using a
 * horizontal stacked-bar waterfall. No recharts needed: pure CSS divs,
 * server-renderable if hydration is stripped, but kept "use client" for
 * future interactivity.
 *
 * Layout: each step is a labelled row with a proportional bar segment.
 * Credits (negative values) render as a green bar going left from the
 * running-total position.
 */

interface WaterfallStep {
  label: string;
  amount: number;     // positive = addition, negative = credit
  isCredit?: boolean; // if true, render as green credit segment
  isTotal?: boolean;  // if true, render as a full standalone bar
}

interface Props {
  steps: WaterfallStep[];
  total: number;
}

function fmtCad(n: number): string {
  return "$" + Math.abs(Math.round(n)).toLocaleString("en-CA");
}

export function OtdWaterfallChart({ steps, total }: Props) {
  // Running cumulative position in chart units (0..total)
  let running = 0;

  // Compute each bar's left offset and width as percentages of total.
  const bars = steps.map((step) => {
    if (step.isTotal) {
      return { left: 0, width: 100, step, running: 0 };
    }
    const prevRunning = running;
    running += step.amount; // may go above total briefly (credits pull back)
    if (step.isCredit || step.amount < 0) {
      // Credit: bar starts at post-credit position, extends right
      const left = Math.max(0, (running / total) * 100);
      const width = Math.max(0, (Math.abs(step.amount) / total) * 100);
      return { left, width, step, running: prevRunning };
    } else {
      const left = Math.max(0, (prevRunning / total) * 100);
      const width = Math.max(0, (step.amount / total) * 100);
      return { left, width, step, running: prevRunning };
    }
  });

  return (
    <div className="space-y-1.5 text-xs">
      {bars.map(({ left, width, step }, idx) => {
        const isCredit = step.isCredit || step.amount < 0;
        const isTotal = step.isTotal;
        const barColor = isTotal
          ? "bg-accent/70"
          : isCredit
          ? "bg-good/70"
          : "bg-fg-muted/30";
        const textColor = isCredit ? "text-good" : isTotal ? "text-accent" : "text-fg";
        const sign = isCredit ? "−" : isTotal ? "" : "+";

        return (
          <div key={idx} className={`flex items-center gap-2 ${isTotal ? "mt-2 pt-2 border-t border-border" : ""}`}>
            {/* Label */}
            <div className={`w-40 shrink-0 truncate ${isTotal ? "font-semibold text-fg" : "text-fg-muted"}`}>
              {step.label}
            </div>

            {/* Bar track */}
            <div className="flex-1 relative h-3 bg-bg-subtle rounded-full overflow-hidden">
              <div
                className={`absolute top-0 h-full rounded-full ${barColor} transition-all`}
                style={{
                  left: isTotal ? "0%" : `${left}%`,
                  width: `${width}%`,
                }}
              />
            </div>

            {/* Amount */}
            <div className={`w-20 text-right tabular-nums shrink-0 ${textColor} ${isTotal ? "font-semibold" : ""}`}>
              {sign}{fmtCad(step.amount)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
