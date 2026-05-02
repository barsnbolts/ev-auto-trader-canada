// In-memory pub/sub for debug events. Zero cost when VITE_DEBUG is not "1".
// Events are broadcast to all subscribers (DebugPanel overlay, optional file writer).

export interface DebugEvent {
  ts: number;          // Date.now()
  level: "info" | "warn" | "error";
  source: string;      // "store" | "invoke" | "ui" | "rust" | ...
  event: string;       // short name, e.g. "slider_change"
  payload?: unknown;   // arbitrary JSON-serializable data
}

type Listener = (e: DebugEvent) => void;

const BUFFER_LIMIT = 500;

let buffer: DebugEvent[] = [];
const listeners = new Set<Listener>();

export const DEBUG_ENABLED =
  typeof import.meta !== "undefined" &&
  import.meta.env?.VITE_DEBUG === "1";

export function emit(e: Omit<DebugEvent, "ts"> & { ts?: number }): void {
  if (!DEBUG_ENABLED) return;
  const full: DebugEvent = { ts: Date.now(), ...e };
  buffer.push(full);
  if (buffer.length > BUFFER_LIMIT) buffer = buffer.slice(-BUFFER_LIMIT);
  for (const l of listeners) {
    try {
      l(full);
    } catch {
      /* swallow listener errors so the app isn't broken by debug code */
    }
  }
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getBuffer(): DebugEvent[] {
  return buffer.slice();
}

export function clearBuffer(): void {
  buffer = [];
}
