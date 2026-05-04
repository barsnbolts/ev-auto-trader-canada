// Server shell for /inventory/[id]/dossier. Static export emits one HTML
// file per unitId via generateStaticParams. The DossierClient handles all
// runtime data loading + buyer-context cookie reads + searchParams.

import unitsRaw from "@/data/units.json";
import { DossierClient } from "./DossierClient";

export function generateStaticParams() {
  return (unitsRaw as Array<{ id: string }>).map((u) => ({ id: u.id }));
}

export default async function DossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DossierClient unitId={id} />;
}
