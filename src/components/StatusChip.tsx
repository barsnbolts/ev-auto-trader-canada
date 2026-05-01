import type { UnitStatus } from "@/lib/types";

const LABEL: Record<UnitStatus, string> = {
  in_stock: "In stock",
  in_transit: "In transit",
  demo: "Demo",
  loaner: "Loaner",
  sold_pending: "Sale pending",
};

export function StatusChip({ status }: { status: UnitStatus }) {
  const cls =
    status === "in_stock"
      ? "chip-accent"
      : status === "in_transit"
      ? "chip-warn"
      : status === "demo" || status === "loaner"
      ? "chip-neutral"
      : "chip-bad";
  return <span className={cls}>{LABEL[status]}</span>;
}
