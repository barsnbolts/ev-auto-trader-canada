"use client";

import dynamic from "next/dynamic";
import type { Dealer, ScoredUnit } from "@/lib/types";

const DealerMap = dynamic(
  () => import("./DealerMap").then((m) => m.DealerMap),
  {
    ssr: false,
    loading: () => <div className="card p-12 text-center text-fg-muted">Loading map…</div>,
  },
);

export function DealerMapClient(props: {
  dealers: Dealer[];
  units: ScoredUnit[];
  pressureByDealer: Record<string, number>;
}) {
  return <DealerMap {...props} />;
}
