import { useEffect, useState, useCallback } from "react";
import {
  DEBUG_ENABLED,
  getBuffer,
  subscribe,
  clearBuffer,
  type DebugEvent,
} from "../lib/debugBus";

// Floating live-event overlay for debug sessions. Mounts unconditionally but
// renders null when VITE_DEBUG != "1" so production bundles stay small after
// dead-code elimination.

const FILTER_OPTIONS = ["all", "store", "invoke", "ui", "rust", "error"] as const;
type FilterOption = (typeof FILTER_OPTIONS)[number];

function formatTs(ts: number): string {
  const d = new Date(ts);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  const ss = d.getSeconds().toString().padStart(2, "0");
  const ms = d.getMilliseconds().toString().padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

export function DebugPanel() {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<DebugEvent[]>(() => getBuffer());
  const [filter, setFilter] = useState<FilterOption>("all");

  // Keyboard toggle — ⌘⇧D (meta+shift+D)
  useEffect(() => {
    if (!DEBUG_ENABLED) return;
    function onKey(e: KeyboardEvent) {
      if (e.metaKey && e.shiftKey && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Subscribe to new events when open
  useEffect(() => {
    if (!DEBUG_ENABLED || !open) return;
    setEvents(getBuffer());
    const unsub = subscribe((e) => {
      setEvents((prev) => [...prev.slice(-499), e]);
    });
    return unsub;
  }, [open]);

  const copyLogPath = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    const path = `logs/debug/${today}.jsonl`;
    navigator.clipboard?.writeText(path).catch(() => void 0);
  }, []);

  if (!DEBUG_ENABLED || !open) return null;

  const filtered =
    filter === "all"
      ? events
      : filter === "error"
        ? events.filter((e) => e.level === "error" || e.level === "warn")
        : events.filter((e) => e.source === filter);

  return (
    <div
      role="region"
      aria-label="Debug log overlay"
      className="fixed bottom-4 right-4 w-[520px] max-h-[70vh] bg-ink-900/95 border border-accent-blue/50 rounded-lg shadow-2xl text-xs font-mono z-[9999] flex flex-col backdrop-blur"
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-ink-700">
        <span className="text-accent-blue font-bold">DEBUG</span>
        <span className="text-ink-500">({events.length})</span>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterOption)}
          className="bg-ink-800 border border-ink-700 rounded px-1 py-0.5 text-ink-200 text-[10px]"
        >
          {FILTER_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            clearBuffer();
            setEvents([]);
          }}
          className="text-ink-400 hover:text-ink-100 text-[10px] px-1"
        >
          clear
        </button>
        <button
          onClick={copyLogPath}
          className="text-ink-400 hover:text-ink-100 text-[10px] px-1"
          title="Copy path of today's jsonl log to clipboard"
        >
          copy path
        </button>
        <button
          onClick={() => setOpen(false)}
          className="ml-auto text-ink-500 hover:text-ink-200 text-sm leading-none"
          aria-label="Close debug panel"
        >
          ×
        </button>
      </div>
      <div className="overflow-y-auto flex-1 p-2 space-y-0.5">
        {filtered.length === 0 ? (
          <div className="text-ink-600 py-4 text-center">
            no events (⌘⇧D toggles this panel)
          </div>
        ) : (
          filtered.slice(-200).map((e, i) => (
            <div
              key={`${e.ts}-${i}`}
              className={`whitespace-pre-wrap break-words ${
                e.level === "error"
                  ? "text-accent-red"
                  : e.level === "warn"
                    ? "text-accent-amber"
                    : "text-ink-300"
              }`}
            >
              <span className="text-ink-600">{formatTs(e.ts)}</span>{" "}
              <span className="text-accent-blue">[{e.source}]</span>{" "}
              <span className="text-ink-100">{e.event}</span>
              {e.payload !== undefined && (
                <span className="text-ink-400">
                  {" "}
                  {JSON.stringify(e.payload)}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
