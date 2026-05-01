// Aggregations / KPIs derived from the scored unit set. Pure functions so they
// can run in either server or client components.

import { dealerPressureIndex } from "./scoring";
import type { Dealer, InventoryUnit, ScoredUnit } from "./types";
import type { Model } from "./constants";
import { GGH_CITIES } from "./constants";

export function dealerPressureMap(
  units: InventoryUnit[],
  dealers: Dealer[],
): Record<string, number> {
  const byDealer = new Map<string, InventoryUnit[]>();
  for (const u of units) {
    const arr = byDealer.get(u.dealerId) ?? [];
    arr.push(u);
    byDealer.set(u.dealerId, arr);
  }
  const out: Record<string, number> = {};
  for (const dealer of dealers) {
    const dealerUnits = byDealer.get(dealer.id) ?? [];
    if (dealerUnits.length === 0) {
      out[dealer.id] = 0;
      continue;
    }
    // Use average pressure across units at the dealer as the dealer-level signal.
    const sum = dealerUnits.reduce(
      (s, u) => s + dealerPressureIndex(u, dealerUnits),
      0,
    );
    out[dealer.id] = Math.round((sum / dealerUnits.length) * 100);
  }
  return out;
}

export function inGGH(unit: ScoredUnit, dealerById: Map<string, Dealer>): boolean {
  const d = dealerById.get(unit.dealerId);
  if (!d) return false;
  return d.province === "ON" && GGH_CITIES.includes(d.city);
}

export type ModelKpis = {
  model: Model;
  totalCanada: number;
  totalGgh: number;
  lowestOtdCanada: number | null;
  lowestOtdGgh: number | null;
  bestDealScoreCanada: number | null;
  avgDaysOnLotCanada: number;
};

export function computeKpis(
  units: ScoredUnit[],
  dealerById: Map<string, Dealer>,
  models: Model[],
): ModelKpis[] {
  return models.map((model) => {
    const all = units.filter((u) => u.model === model);
    const ggh = all.filter((u) => inGGH(u, dealerById));
    const lowestOtdCanada = all.length ? Math.min(...all.map((u) => u.otdCad)) : null;
    const lowestOtdGgh = ggh.length ? Math.min(...ggh.map((u) => u.otdCad)) : null;
    const bestDealScoreCanada = all.length ? Math.max(...all.map((u) => u.dealScore)) : null;
    const avgDaysOnLotCanada = all.length
      ? Math.round(all.reduce((s, u) => s + (u.daysOnLot ?? 0), 0) / all.length)
      : 0;
    return {
      model,
      totalCanada: all.length,
      totalGgh: ggh.length,
      lowestOtdCanada,
      lowestOtdGgh,
      bestDealScoreCanada,
      avgDaysOnLotCanada,
    };
  });
}

export type ProvinceRollup = {
  province: string;
  count: number;
  countByModel: Record<Model, number>;
};

export function provinceRollup(
  units: ScoredUnit[],
  dealerById: Map<string, Dealer>,
): ProvinceRollup[] {
  const by = new Map<string, ProvinceRollup>();
  for (const u of units) {
    const d = dealerById.get(u.dealerId);
    if (!d) continue;
    const existing = by.get(d.province) ?? {
      province: d.province,
      count: 0,
      countByModel: { EV6: 0, Ioniq5: 0, Ioniq6: 0, EV9: 0, Ioniq9: 0 },
    };
    existing.count += 1;
    existing.countByModel[u.model] += 1;
    by.set(d.province, existing);
  }
  return [...by.values()].sort((a, b) => b.count - a.count);
}
