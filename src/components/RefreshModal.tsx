"use client";

// Phase B: Refresh data modal — fires `run_refresh` Rust command which
// shells out to scripts/refresh_daily.sh and streams stdout/stderr lines
// over the `refresh-log` event channel. Modal renders a live log + final
// delta count when the script exits.

import { useEffect, useRef, useState } from "react";
import {
  invokeRunRefresh,
  isTauri,
  listenRefreshLog,
  type RefreshLogLine,
} from "@/lib/tauriRuntime";

type Phase = "idle" | "running" | "done" | "error";

export function RefreshModal({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [lines, setLines] = useState<RefreshLogLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isTauri) return;
    let unlisten: (() => void) | null = null;
    listenRefreshLog((line) => {
      setLines((prev) => [...prev, line]);
    }).then((u) => {
      unlisten = u;
    });
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [lines]);

  async function handleStart() {
    setPhase("running");
    setLines([]);
    setError(null);
    const r = await invokeRunRefresh();
    if (r.ok) setPhase("done");
    else {
      setPhase("error");
      setError(r.error ?? "unknown error");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 backdrop-blur">
      <div className="card max-w-2xl w-full mx-4 p-5 space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold">Refresh inventory</h2>
          <button
            onClick={onClose}
            className="text-xs text-fg-subtle hover:text-fg"
            disabled={phase === "running"}
          >
            ✕ Close
          </button>
        </div>

        {!isTauri && (
          <p className="text-sm text-fg-muted">
            Live refresh only available in the desktop app. Use{" "}
            <code className="text-xxs bg-bg-subtle px-1 py-0.5 rounded">npm run snapshot</code>{" "}
            from the terminal to refresh manually.
          </p>
        )}

        {isTauri && phase === "idle" && (
          <div className="space-y-3">
            <p className="text-sm text-fg-muted">
              Re-scrape AutoTrader, regenerate units.json, snapshot, and run predeploy.
              Takes 1-3 minutes. Errors halt the script.
            </p>
            <button
              onClick={handleStart}
              className="px-4 py-2 bg-accent text-bg rounded text-sm font-medium hover:opacity-90"
            >
              Start refresh
            </button>
          </div>
        )}

        {(phase === "running" || phase === "done" || phase === "error") && (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between text-xs">
              <span
                className={
                  phase === "running"
                    ? "text-warn"
                    : phase === "done"
                    ? "text-good"
                    : "text-bad"
                }
              >
                {phase === "running" && "⏳ Running…"}
                {phase === "done" && "✓ Refresh complete"}
                {phase === "error" && `✗ Refresh failed: ${error}`}
              </span>
              <span className="text-xxs text-fg-subtle num">{lines.length} log lines</span>
            </div>
            <div
              ref={logRef}
              role="log"
              aria-live="polite"
              aria-atomic="false"
              aria-label="Refresh script output"
              className="bg-bg-subtle rounded p-3 max-h-72 overflow-y-auto font-mono text-xxs leading-relaxed"
            >
              {lines.map((l, i) => (
                <div
                  key={i}
                  className={
                    l.level === "error"
                      ? "text-bad"
                      : l.level === "warn"
                      ? "text-warn"
                      : "text-fg-muted"
                  }
                >
                  <span className="text-fg-subtle">{l.ts}</span> {l.message}
                </div>
              ))}
              {lines.length === 0 && (
                <div className="text-fg-subtle italic">Waiting for output…</div>
              )}
            </div>
            {phase !== "running" && (
              <button
                onClick={() => {
                  setPhase("idle");
                  setLines([]);
                  setError(null);
                }}
                className="text-xs text-accent hover:text-accent-strong"
              >
                Run again
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
