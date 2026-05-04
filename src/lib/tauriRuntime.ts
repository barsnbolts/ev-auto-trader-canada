"use client";

// Runtime detection + safe wrapper for Tauri-only APIs. Web build returns
// null/false from every helper; Tauri build forwards to @tauri-apps/api.
//
// All Tauri imports are dynamic so the web bundle doesn't ship the IPC
// glue. Treat null returns as "feature unavailable" in the UI.

export const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export type RefreshLogLine = { ts: string; level: "info" | "warn" | "error"; message: string };

export type VerifyResult = {
  unitId: string;
  status: "active" | "removed" | "error" | "challenged";
  httpStatus?: number;
  askingPrice?: number | null;
  scrapedAt?: string;
  error?: string;
  note?: string;
};

export async function invokeRunRefresh(): Promise<{ ok: boolean; error?: string }> {
  if (!isTauri) return { ok: false, error: "not running in Tauri" };
  const { invoke } = await import("@tauri-apps/api/core");
  try {
    await invoke<void>("run_refresh");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function invokeVerifyUnit(unitId: string): Promise<VerifyResult | null> {
  if (!isTauri) return null;
  const { invoke } = await import("@tauri-apps/api/core");
  try {
    const raw = await invoke<string>("run_verify_unit", { unitId });
    return JSON.parse(raw) as VerifyResult;
  } catch (e) {
    return { unitId, status: "error", error: String(e) };
  }
}

export async function listenRefreshLog(
  cb: (line: RefreshLogLine) => void,
): Promise<() => void> {
  if (!isTauri) return () => {};
  const { listen } = await import("@tauri-apps/api/event");
  const unlisten = await listen<RefreshLogLine>("refresh-log", (e) => cb(e.payload));
  return () => unlisten();
}
