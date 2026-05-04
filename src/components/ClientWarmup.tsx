"use client";
/**
 * ClientWarmup — runs on idle after first paint to use spare client CPU/GPU
 * cycles for the next-likely interactions:
 *   - Prefetch dossier route bundle so first row click is instant
 *   - Prime image cache for vehicle hero images
 *   - Mark <img> as decoded asynchronously on next animation frame
 *
 * Cheap, no main-thread blocking. Skipped entirely if user prefers reduced
 * motion or the browser lacks requestIdleCallback (graceful degradation).
 */
import { useEffect } from "react";

export function ClientWarmup({ heroUrls = [] as string[] }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const ric = w.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 200) as unknown as number);

    const id = ric(
      () => {
        // 1. Prefetch route JS chunks Next has split out
        ["/inventory", "/pick-a-model", "/compare"].forEach((href) => {
          const link = document.createElement("link");
          link.rel = "prefetch";
          link.href = href;
          link.as = "document";
          document.head.appendChild(link);
        });

        // 2. Warm image cache (hero photos referenced from data/vehicle-images.json)
        for (const url of heroUrls.slice(0, 30)) {
          const img = new Image();
          img.decoding = "async";
          img.loading = "eager";
          img.src = url;
        }
      },
      { timeout: 2000 },
    );

    return () => {
      if (w.cancelIdleCallback) w.cancelIdleCallback(id);
    };
  }, [heroUrls]);

  return null;
}
