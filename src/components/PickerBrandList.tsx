"use client";

import { useMemo } from "react";
import type { Spec } from "@/lib/types";
import { readNumeric } from "@/lib/types";
import { MODEL_BRAND } from "@/lib/constants";
import { PickerVehicleRow } from "./PickerVehicleRow";
import type { PickerFilters } from "./PickerFilterBar";
import type { Model } from "@/lib/constants";

function brandOf(model: string): string {
  return MODEL_BRAND[model as Model] ?? model;
}

interface Props {
  specs: Spec[];
  filters: PickerFilters;
}

export function PickerBrandList({ specs, filters }: Props) {
  const filtered = useMemo(() => {
    return specs.filter((s) => {
      if (filters.powertrain.length > 0 && s.powertrain) {
        if (!filters.powertrain.includes(s.powertrain)) return false;
      }
      if (filters.bodyStyle.length > 0 && s.bodyStyle) {
        if (!filters.bodyStyle.includes(s.bodyStyle)) return false;
      }
      if (filters.drivetrain.length > 0) {
        if (!filters.drivetrain.includes(s.drivetrain)) return false;
      }
      if (filters.maxMsrp != null && s.msrpCad != null) {
        if (s.msrpCad > filters.maxMsrp) return false;
      }
      if (filters.minRange != null) {
        const r = s.rangeEpaKm ? readNumeric(s.rangeEpaKm) : s.rangeKm;
        if (r == null || r < filters.minRange) return false;
      }
      if (filters.search.trim()) {
        const q = filters.search.toLowerCase();
        const hay = `${brandOf(s.model)} ${s.model} ${s.trim} ${s.year}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [specs, filters]);

  const brands = useMemo(() => {
    const set = new Set(filtered.map((s) => brandOf(s.model)));
    return [...set].sort();
  }, [filtered]);

  if (filtered.length === 0) {
    return (
      <div className="p-12 text-center text-fg-subtle">
        No models match the current filters.
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {brands.map((brand) => {
        const brandSpecs = filtered
          .filter((s) => brandOf(s.model) === brand)
          .sort((a, b) => a.model.localeCompare(b.model) || a.year - b.year || a.trim.localeCompare(b.trim));

        return (
          <section key={brand}>
            <header className="px-4 py-2 bg-bg-subtle/60 border-b border-border sticky top-[52px] z-10 backdrop-blur">
              <h2 className="text-sm font-semibold uppercase tracking-widest text-fg-muted">
                {brand}
                <span className="ml-2 text-xxs text-fg-subtle normal-case tracking-normal font-normal">
                  {brandSpecs.length} {brandSpecs.length === 1 ? "trim" : "trims"}
                </span>
              </h2>
            </header>
            <div>
              {brandSpecs.map((s) => (
                <PickerVehicleRow
                  key={`${s.model}-${s.year}-${s.trim}-${s.drivetrain}`}
                  spec={s}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
