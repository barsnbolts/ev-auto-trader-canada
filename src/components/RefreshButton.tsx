"use client";

// Tauri-only "Refresh inventory" button. Renders as null in the web build
// so it's invisible on Vercel — only the desktop app surfaces it.

import { useEffect, useState } from "react";
import { isTauri } from "@/lib/tauriRuntime";
import { RefreshModal } from "./RefreshModal";

export function RefreshButton() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  // Defer detection to client; SSR/static renders return null first paint.
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isTauri) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="nav-link cursor-pointer"
        title="Re-scrape AutoTrader, snapshot, predeploy"
      >
        ⟳ Refresh
      </button>
      {open && <RefreshModal onClose={() => setOpen(false)} />}
    </>
  );
}
