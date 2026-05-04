"use client";

// Phase C1: dock badge — count of units first-seen since the user last
// opened the app. Reads `lastAppOpenAt` from localStorage. Renders
// nothing visually; lifecycle-only component mounted in the layout.
//
// Web build is a no-op (setDockBadge guards on isTauri).

import { useEffect } from "react";
import unitsJson from "@/data/units.json";
import { setDockBadge } from "@/lib/tauriRuntime";

const KEY = "lastAppOpenAt";

export function DockBadgeSync() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const last = window.localStorage.getItem(KEY);
    const now = new Date().toISOString();
    let count = 0;
    if (last) {
      const cutoff = new Date(last).getTime();
      if (!Number.isNaN(cutoff)) {
        count = (unitsJson as Array<{ firstSeen?: string }>).filter((u) => {
          if (!u.firstSeen) return false;
          const t = new Date(u.firstSeen).getTime();
          return !Number.isNaN(t) && t > cutoff;
        }).length;
      }
    }
    setDockBadge(count);
    // Stamp open time AFTER computing count so the badge represents
    // "new since previous session", not "since now".
    window.localStorage.setItem(KEY, now);
  }, []);

  return null;
}
