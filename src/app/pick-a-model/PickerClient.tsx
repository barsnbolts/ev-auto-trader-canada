"use client";

import { useState } from "react";
import type { Spec } from "@/lib/types";
import { PickerFilterBar, DEFAULT_PICKER_FILTERS } from "@/components/PickerFilterBar";
import type { PickerFilters } from "@/components/PickerFilterBar";
import { PickerBrandList } from "@/components/PickerBrandList";
import { PickerCompareTray } from "@/components/PickerCompareTray";

interface Props {
  specs: Spec[];
}

export function PickerClient({ specs }: Props) {
  const [filters, setFilters] = useState<PickerFilters>(DEFAULT_PICKER_FILTERS);

  return (
    <>
      <PickerFilterBar filters={filters} onChange={setFilters} />
      <PickerBrandList specs={specs} filters={filters} />
      {/* Tray needs padding so last row isn't hidden behind it */}
      <div className="h-20" aria-hidden />
      <PickerCompareTray />
    </>
  );
}
