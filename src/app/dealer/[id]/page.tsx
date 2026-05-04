// Server shell for /dealer/[id]. Static export emits one HTML file per
// dealerId via generateStaticParams. The DealerClient handles all
// runtime data loading + buyer-context cookie reads.

import unitsRaw from "@/data/dealers.json";
import { DealerClient } from "./DealerClient";

export function generateStaticParams() {
  return (unitsRaw as Array<{ id: string }>).map((d) => ({ id: d.id }));
}

export default async function DealerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DealerClient dealerId={id} />;
}
