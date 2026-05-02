import { useEffect, useState } from "react";
import {
  isEnabled,
  setEnabled,
  subscribe,
  getEvents,
  clear,
  downloadLog,
  type DebugEvent,
} from "../lib/debugLog";

const KIND_COLORS: Record<DebugEvent["kind"], string> = {
  action: "text-accent-blue",
  state: "text-ink-300",
  error: "text-accent-red",
  fetch: "text-accent-green",
  route: "text-accent-amber",
  note: "text-ink-400",
};

export function DebugPanel() {
  const [, bump] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [onState, setOn] = useState(isEnabled());

  useEffect(() => subscribe(() => bump((n) => n + 1)), []);

  const events = getEvents();
  const errors = events.filter((e) => e.kind === "error").length;
  const actions = events.filter((e) => e.kind === "action").length;
  const fetches = events.filter((e) => e.kind === "fetch" && !e.ok).length;

  return (
    <div className="fixed bottom-0 right-0 z-50 pointer-events-none">
      <div className="pointer-events-auto m-3 bg-ink-800/95 backdrop-blur border border-ink-700 rounded-lg shadow-2xl w-96">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-ink-700">
          <label className="flex items-center gap-1 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={onState}
              onChange={(e) => {
                setEnabled(e.target.checked);
                setOn(e.target.checked);
              }}
              className="accent-accent-blue"
            />
            <span className="text-ink-200">Debug log</span>
          </label>
          <span className="text-[11px] text-ink-500">
            {actions}a · {errors ? (
              <span className="text-accent-red">{errors}err</span>
            ) : "0err"}
            {fetches > 0 && (
              <span className="text-accent-amber"> · {fetches} fetch-fail</span>
            )}
          </span>
          <div className="ml-auto flex gap-1">
            <button
              onClick={() => setExpanded((x) => !x)}
              className="text-xs text-ink-400 hover:text-ink-100 px-1"
            >
              {expanded ? "▾" : "▸"}
            </button>
          </div>
        </div>

        {expanded && (
          <>
            <div className="max-h-64 overflow-y-auto text-[11px] font-mono px-3 py-2">
              {events.length === 0 && (
                <div className="text-ink-500">
                  {onState ? "Waiting for events…" : "Toggle on to start capturing."}
                </div>
              )}
              {events.slice(-60).reverse().map((e, i) => (
                <div key={i} className="py-0.5 whitespace-pre-wrap break-all">
                  <span className="text-ink-500">{e.t.slice(11, 19)}</span>{" "}
                  <span className={KIND_COLORS[e.kind]}>{e.kind}</span>{" "}
                  {e.kind === "action" && (
                    <span className="text-ink-200">
                      {e.name}
                      {e.payload !== undefined && (
                        <span className="text-ink-500"> {JSON.stringify(e.payload).slice(0, 100)}</span>
                      )}
                    </span>
                  )}
                  {e.kind === "error" && (
                    <span className="text-accent-red">
                      {e.message}
                      {e.source && <span className="text-ink-500"> @ {e.source}</span>}
                    </span>
                  )}
                  {e.kind === "fetch" && (
                    <span className={e.ok ? "text-ink-300" : "text-accent-amber"}>
                      {e.status} · {Math.round(e.ms)}ms · {e.url.slice(0, 80)}
                    </span>
                  )}
                  {e.kind === "note" && (
                    <span className="text-ink-400">{e.text}</span>
                  )}
                  {e.kind === "route" && (
                    <span className="text-ink-300">→ {e.to}</span>
                  )}
                  {e.kind === "state" && (
                    <span className="text-ink-400">{e.path}</span>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-1 px-3 py-2 border-t border-ink-700">
              <button
                onClick={downloadLog}
                disabled={events.length === 0}
                className="text-xs bg-accent-blue/80 hover:bg-accent-blue text-white rounded px-2 py-1 disabled:opacity-40"
              >
                Download JSONL
              </button>
              <button
                onClick={clear}
                className="text-xs bg-ink-700 hover:bg-ink-600 text-ink-200 rounded px-2 py-1"
              >
                Clear
              </button>
              <span className="ml-auto text-[10px] text-ink-500 self-center">
                {events.length} / 500 events
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
