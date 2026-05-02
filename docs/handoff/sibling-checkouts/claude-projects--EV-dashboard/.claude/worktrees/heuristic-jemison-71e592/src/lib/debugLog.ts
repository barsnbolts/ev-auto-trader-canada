// High-level debug logging API. Usage:
//   import { debugLog } from "@/lib/debugLog";
//   debugLog("store", "compareIds_change", { before, after });
//
// Behavior:
//   - When VITE_DEBUG !== "1": every call is a no-op (tree-shakeable in release).
//   - When VITE_DEBUG === "1":
//       1. Emits to the in-memory debugBus (consumed by DebugPanel overlay).
//       2. console.debug with a compact prefix so raw dev-tools inspection works too.
//       3. Fires a fetch POST to /__debug_log (handled by Vite plugin in dev) that
//          appends the event to logs/debug/<YYYY-MM-DD>.jsonl. Failures are silent.

import { DEBUG_ENABLED, emit, type DebugEvent } from "./debugBus";

type Level = DebugEvent["level"];

const LOG_ENDPOINT = "/__debug_log";

function post(event: DebugEvent): void {
  // fire-and-forget; ignore network errors
  try {
    fetch(LOG_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
      keepalive: true,
    }).catch(() => {
      /* swallow */
    });
  } catch {
    /* swallow */
  }
}

export function debugLog(
  source: string,
  event: string,
  payload?: unknown,
  level: Level = "info",
): void {
  if (!DEBUG_ENABLED) return;
  const e: DebugEvent = {
    ts: Date.now(),
    level,
    source,
    event,
    payload,
  };
  emit(e);
  // Compact console mirror so devtools network-throttled scenarios still see something.
  const tag = `[${source}:${event}]`;
  if (level === "error") console.error(tag, payload ?? "");
  else if (level === "warn") console.warn(tag, payload ?? "");
  else console.debug(tag, payload ?? "");
  post(e);
}

export function debugWarn(source: string, event: string, payload?: unknown): void {
  debugLog(source, event, payload, "warn");
}

export function debugError(source: string, event: string, payload?: unknown): void {
  debugLog(source, event, payload, "error");
}

// Re-export for convenience
export { DEBUG_ENABLED };
