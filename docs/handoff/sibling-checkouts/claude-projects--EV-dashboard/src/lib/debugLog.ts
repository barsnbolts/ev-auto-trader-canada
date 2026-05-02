// Debug telemetry — client-side event recorder for bug hunting.
//
// Captures actions, state changes, errors, navigations, and fetch outcomes
// into an in-memory ring buffer. When the user downloads the log, we emit a
// JSONL file that Ian can save into the workspace folder — my sandbox can
// then read it and reproduce whatever happened.
//
// Off by default; toggle from the header. Zero overhead when off.

export type DebugEvent =
  | { t: string; kind: "action"; name: string; payload?: unknown }
  | { t: string; kind: "state"; path: string; before?: unknown; after?: unknown }
  | { t: string; kind: "error"; message: string; stack?: string; source?: string }
  | { t: string; kind: "fetch"; url: string; status: number; ms: number; ok: boolean }
  | { t: string; kind: "route"; from?: string; to: string }
  | { t: string; kind: "note"; text: string };

const MAX_EVENTS = 500;
let buffer: DebugEvent[] = [];
let enabled = false;
const listeners: Array<() => void> = [];

function nowIso(): string {
  return new Date().toISOString();
}

export function isEnabled(): boolean {
  return enabled;
}

export function setEnabled(v: boolean): void {
  enabled = v;
  if (v) push({ t: nowIso(), kind: "note", text: "debug log started" });
  else push({ t: nowIso(), kind: "note", text: "debug log paused" });
  notify();
}

export function subscribe(fn: () => void): () => void {
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}

function notify() {
  for (const fn of listeners) {
    try {
      fn();
    } catch {}
  }
}

export function push(e: DebugEvent): void {
  if (!enabled && e.kind !== "note") return;
  buffer.push(e);
  if (buffer.length > MAX_EVENTS) buffer = buffer.slice(-MAX_EVENTS);
  notify();
}

export function clear(): void {
  buffer = [];
  notify();
}

export function getEvents(): readonly DebugEvent[] {
  return buffer;
}

export function logAction(name: string, payload?: unknown): void {
  push({ t: nowIso(), kind: "action", name, payload });
}

export function logError(message: string, source?: string, stack?: string): void {
  push({ t: nowIso(), kind: "error", message, source, stack });
}

export function logFetch(url: string, status: number, ms: number): void {
  push({ t: nowIso(), kind: "fetch", url, status, ms, ok: status >= 200 && status < 400 });
}

/**
 * Wrap an action function so every call gets logged. Use in the Zustand store
 * setters to auto-capture state changes without changing call sites.
 */
export function wrap<A extends any[], R>(name: string, fn: (...args: A) => R): (...args: A) => R {
  return (...args: A) => {
    logAction(name, args.length === 1 ? args[0] : args);
    return fn(...args);
  };
}

/**
 * Install global error hooks. Call once at app startup.
 */
export function installGlobalHooks(): void {
  if (typeof window === "undefined") return;
  window.addEventListener("error", (ev) => {
    logError(ev.message, ev.filename, ev.error?.stack);
  });
  window.addEventListener("unhandledrejection", (ev) => {
    const reason = (ev as any).reason;
    logError(
      typeof reason === "string" ? reason : reason?.message ?? "unhandled promise rejection",
      "promise",
      reason?.stack,
    );
  });

  // Patch fetch so network calls get captured.
  const origFetch = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const started = performance.now();
    try {
      const res = await origFetch(...args);
      const url = typeof args[0] === "string" ? args[0] : (args[0] as Request).url;
      logFetch(url.slice(0, 200), res.status, performance.now() - started);
      return res;
    } catch (err: any) {
      const url = typeof args[0] === "string" ? args[0] : (args[0] as Request).url;
      logFetch(url.slice(0, 200), 0, performance.now() - started);
      throw err;
    }
  };
}

/**
 * Download the current buffer as a JSONL file. Ian drops the file into
 * the workspace folder; my sandbox reads it to see exactly what happened.
 */
export function downloadLog(): void {
  const lines = buffer.map((e) => JSON.stringify(e)).join("\n");
  const blob = new Blob([lines + "\n"], { type: "application/x-ndjson" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  a.download = `ev-debug-${ts}.jsonl`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
