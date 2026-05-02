import type { Vehicle, Brand } from "../types";
import { allBrands, allVehicles } from "../data";
import { useAppStore } from "../store/useAppStore";
import { VehicleRow } from "./VehicleRow";
import { useMemo } from "react";

function vehiclesForBrand(brand: Brand, vehicles: Vehicle[]) {
  return vehicles
    .filter((v) => v.brand_id === brand.id)
    .sort((a, b) => a.model.localeCompare(b.model) || a.trim_label.localeCompare(b.trim_label));
}

export function BrandList() {
  const { filters } = useAppStore();

  const filtered = useMemo(() => {
    return allVehicles.filter((v) => {
      if (filters.powertrain !== "all" && !filters.powertrain.includes(v.powertrain))
        return false;
      if (filters.body_style !== "all" && !filters.body_style.includes(v.body_style))
        return false;
      if (filters.drivetrain !== "all" && !filters.drivetrain.includes(v.drivetrain_variant))
        return false;
      if (filters.max_price_cad != null) {
        const p = v.msrp_cad.value;
        if (p != null && p > filters.max_price_cad) return false;
      }
      if (filters.min_range_km != null) {
        const r = v.range_km.value;
        if (r == null || r < filters.min_range_km) return false;
      }
      if (filters.search.trim()) {
        const q = filters.search.toLowerCase();
        const hay = `${v.model} ${v.trim_label} ${v.generation_label}`.toLowerCase();
        const brand = allBrands.find((b) => b.id === v.brand_id);
        const brandName = brand?.name.toLowerCase() ?? "";
        if (!hay.includes(q) && !brandName.includes(q)) return false;
      }
      return true;
    });
  }, [filters]);

  const brandsInOrder = useMemo(
    () =>
      [...allBrands].sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  return (
    <div className="divide-y divide-ink-700">
      {brandsInOrder.map((brand) => {
        const list = vehiclesForBrand(brand, filtered);
        if (list.length === 0) return null;
        return (
          <section key={brand.id}>
            <header className="px-6 py-2 bg-ink-800/60 border-b border-ink-700 sticky top-[56px] z-10 backdrop-blur">
              <h2 className="font-display text-sm uppercase tracking-widest text-ink-300">
                {brand.name}
                <span className="ml-2 text-ink-400 text-xs normal-case tracking-normal">
                  {list.length} {list.length === 1 ? "trim" : "trims"}
                </span>
              </h2>
            </header>
            <div>
              {list.map((v) => (
                <VehicleRow key={v.id} vehicle={v} />
              ))}
            </div>
          </section>
        );
      })}

      {filtered.length === 0 && (
        <div className="p-12 text-center text-ink-400">
          No vehicles match the current filters.
        </div>
      )}
    </div>
  );
}
