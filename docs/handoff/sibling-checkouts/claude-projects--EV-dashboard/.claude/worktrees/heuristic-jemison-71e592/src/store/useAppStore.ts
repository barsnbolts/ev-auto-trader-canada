import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Powertrain, BodyStyle, DrivetrainVariant } from "../types";
import { DEBUG_ENABLED, debugLog } from "../lib/debugLog";

export interface Filters {
  powertrain: Powertrain[] | "all";
  body_style: BodyStyle[] | "all";
  drivetrain: DrivetrainVariant[] | "all";
  max_price_cad: number | null;
  min_range_km: number | null;
  search: string;
}

export type TouTier = "off_peak" | "mid_peak" | "on_peak";

export const TOU_RATES: Record<TouTier, { label: string; rate: number }> = {
  off_peak: { label: "Off-peak (9.2 ¢/kWh)", rate: 0.092 },
  mid_peak: { label: "Mid-peak (13.6 ¢/kWh)", rate: 0.136 },
  on_peak: { label: "On-peak (17.9 ¢/kWh)", rate: 0.179 },
};

interface AppState {
  // Filters & compare
  filters: Filters;
  compareIds: string[]; // max 4
  setFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  resetFilters: () => void;
  toggleCompare: (id: string) => void;
  clearCompare: () => void;

  // Thermal slider state
  temp_c: number; // -40..+40
  hvac_on: boolean;
  speed_kph: number;
  preconditioned: Record<string, boolean>; // vehicleId -> bool
  setTemp: (c: number) => void;
  setHvacOn: (v: boolean) => void;
  setSpeed: (v: number) => void;
  setPreconditioned: (id: string, v: boolean) => void;
  resetThermal: () => void;

  // Electricity rate (Ontario TOU)
  touTier: TouTier;
  setTouTier: (tier: TouTier) => void;

  // Plain / Geek display mode (mom mode)
  plainMode: boolean;
  setPlainMode: (v: boolean) => void;
}

const DEFAULT_FILTERS: Filters = {
  powertrain: "all",
  body_style: "all",
  drivetrain: "all",
  max_price_cad: null,
  min_range_km: null,
  search: "",
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      filters: DEFAULT_FILTERS,
      compareIds: [],
      setFilter: (key, value) =>
        set((s) => ({ filters: { ...s.filters, [key]: value } })),
      resetFilters: () => set({ filters: DEFAULT_FILTERS }),
      toggleCompare: (id) =>
        set((s) => {
          if (s.compareIds.includes(id)) {
            return { compareIds: s.compareIds.filter((x) => x !== id) };
          }
          if (s.compareIds.length >= 4) return s;
          return { compareIds: [...s.compareIds, id] };
        }),
      clearCompare: () => set({ compareIds: [] }),

      // Thermal defaults: 20 °C baseline, HVAC off, highway speed.
      temp_c: 20,
      hvac_on: false,
      speed_kph: 100,
      preconditioned: {},
      setTemp: (c) => set({ temp_c: Math.max(-40, Math.min(40, c)) }),
      setHvacOn: (v) => set({ hvac_on: v }),
      setSpeed: (v) => set({ speed_kph: Math.max(40, Math.min(130, v)) }),
      setPreconditioned: (id, v) =>
        set((s) => ({ preconditioned: { ...s.preconditioned, [id]: v } })),
      resetThermal: () =>
        set({ temp_c: 20, hvac_on: false, speed_kph: 100, preconditioned: {} }),

      // Electricity rate — Ontario Hydro One TOU 2026, default mid-peak.
      touTier: "mid_peak",
      setTouTier: (tier) => set({ touTier: tier }),

      // Plain / Geek display mode.
      plainMode: false,
      setPlainMode: (v) => set({ plainMode: v }),
    }),
    {
      name: "ev-store-v1",
      // Persist compare tray, filters, thermal settings, rate, and display mode — but not actions.
      partialize: (s) => ({
        compareIds: s.compareIds,
        filters: s.filters,
        temp_c: s.temp_c,
        hvac_on: s.hvac_on,
        speed_kph: s.speed_kph,
        touTier: s.touTier,
        plainMode: s.plainMode,
      }),
    },
  ),
);

// Debug-mode store change logger. No-op when VITE_DEBUG != "1".
if (DEBUG_ENABLED) {
  const PERSISTED_KEYS = [
    "compareIds",
    "filters",
    "temp_c",
    "hvac_on",
    "speed_kph",
    "touTier",
    "plainMode",
  ] as const;
  type Key = (typeof PERSISTED_KEYS)[number];
  let prev = useAppStore.getState();
  useAppStore.subscribe((next) => {
    const changed: Record<string, { before: unknown; after: unknown }> = {};
    for (const k of PERSISTED_KEYS) {
      if (prev[k as Key] !== next[k as Key]) {
        changed[k] = { before: prev[k as Key], after: next[k as Key] };
      }
    }
    if (Object.keys(changed).length > 0) {
      debugLog("store", "state_change", changed);
    }
    prev = next;
  });
}
