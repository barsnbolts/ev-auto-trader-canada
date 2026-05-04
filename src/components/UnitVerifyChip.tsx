"use client";

// Per-unit "verify availability" chip — Phase B feature.
// In Tauri, calls `run_verify_unit` Rust command which spawns
// scripts/verify_unit.py to re-fetch the AutoTrader listing. In the web
// build, the chip renders disabled with a hover tooltip explaining why.

import { useState } from "react";
import { invokeVerifyUnit, isTauri, type VerifyResult } from "@/lib/tauriRuntime";
import { fmtCad } from "@/lib/format";

type State = "idle" | "running" | "verified" | "removed" | "error";

export function UnitVerifyChip({ unitId }: { unitId: string }) {
  const [state, setState] = useState<State>("idle");
  const [result, setResult] = useState<VerifyResult | null>(null);

  if (!isTauri) {
    return (
      <span
        className="inline-block chip-neutral text-xxs text-fg-subtle cursor-help"
        title="Live verify only available in the desktop app. Click the AutoTrader link to verify manually."
      >
        ⚪ Verify (desktop only)
      </span>
    );
  }

  async function handleClick() {
    setState("running");
    const r = await invokeVerifyUnit(unitId);
    if (!r) {
      setState("error");
      setResult({ unitId, status: "error", error: "no response" });
      return;
    }
    setResult(r);
    if (r.status === "active") setState("verified");
    else if (r.status === "removed") setState("removed");
    else setState("error");
  }

  if (state === "running") {
    return <span className="inline-block chip-neutral text-xxs text-fg-muted">⏳ Verifying…</span>;
  }
  if (state === "verified" && result) {
    const priceStr = result.askingPrice != null ? ` · ${fmtCad(result.askingPrice)}` : "";
    return (
      <button
        onClick={handleClick}
        className="inline-block chip-good text-xxs cursor-pointer"
        title={`Verified ${result.scrapedAt ?? "just now"}. Click to re-verify.`}
      >
        ✓ Listed{priceStr}
      </button>
    );
  }
  if (state === "removed") {
    return (
      <span
        className="inline-block chip-bad text-xxs"
        title="AutoTrader returned 404/410 — listing has been removed."
      >
        ✗ Removed
      </span>
    );
  }
  if (state === "error" && result) {
    return (
      <button
        onClick={handleClick}
        className="inline-block chip-warn text-xxs cursor-pointer"
        title={`Verify failed: ${result.error ?? "unknown"}. Click to retry.`}
      >
        ⚠ Verify failed
      </button>
    );
  }
  return (
    <button
      onClick={handleClick}
      className="inline-block chip-neutral text-xxs text-fg-muted hover:text-fg cursor-pointer"
      title="Re-fetch the AutoTrader listing to confirm it's still live."
    >
      ⟳ Verify availability
    </button>
  );
}
