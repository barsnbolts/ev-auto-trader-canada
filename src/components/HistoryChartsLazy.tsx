"use client";

// Lazy-loaded recharts wrappers for /history. Reuses the same recharts
// dynamic-import trick as DossierClient — keeps recharts (~384 kB chunk)
// out of the main /history First Load JS, only fetched on client mount.
//
// API mirrors HistoryCharts.tsx so /history server component can keep
// importing { HistoryCountChart, HistoryPriceChart } from this module
// instead of the static one.

import dynamic from "next/dynamic";
import type { SeriesPoint } from "./HistoryCharts";

const chartFallback = (
  <div className="h-64 w-full animate-pulse rounded-md bg-bg-elevated" aria-hidden />
);

export const HistoryCountChart = dynamic(
  () => import("./HistoryCharts").then((m) => m.HistoryCountChart),
  { ssr: false, loading: () => chartFallback },
);

export const HistoryPriceChart = dynamic(
  () => import("./HistoryCharts").then((m) => m.HistoryPriceChart),
  { ssr: false, loading: () => chartFallback },
);

export type { SeriesPoint };
