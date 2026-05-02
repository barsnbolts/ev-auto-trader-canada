import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Powertrain, BodyStyle, DrivetrainVariant } from "../types";
import { logAction } from "../lib/debugLog";

export interface Filters {
  powertrain: Powertrain[] | "all";
  body_style: BodyStyle[] | "all";
  drivetrain: DrivetrainVariant[] | "all";
  max_price_cad: number | null;
  min_range_km: number | null;
  search: string;
}

interface AppState {
  // Filters & compare
  filters: Filters;
  compareIds: string[]; // max 4
  setFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  resetFilters: () => void;
  toggleCompare: (id: string) => void;
  clearCompare: () => void;

  // Thermal slider state (Phase 3b)
  temp_c: number; // -40..+40
  hvac_on: boolean;
  speed_kph: number;
  preconditioned: Record<string, boolean>; // vehicleId -> bool
  setTemp: (c: number) => void;
  setHvacOn: (v: boolean) => void;
  setSpeed: (v: number) => void;
  setPreconditioned: (id: string, v: boolean) => void;
  resetThermal: () => void;

  // Cost (F-02)
  electricity_cad_per_kwh: number; // e.g. 0.17 for 17¢/kWh (Ontario typical)
  setElectricityRate: (rate: number) => void;

  // Map + trip (F-MAP)
  user_location: { lat: number; lng: number; label: string };
  setUserLocation: (loc: { lat: number; lng: number; label: string }) => void;
  trip_destination: { lat: number; lng: number; label: string } | null;
  setTripDestination: (d: { lat: number; lng: number; label: string } | null) => void;

  // Mom mode — plain-English label swap (P-02)
  mom_mode: boolean;
  setMomMode: (v: boolean) => void;
}

const DEFAULT_FILTERS: Filters = {
  powertrain: "all",
  body_style: "all",
  drivetrain: "all",
  max_price_cad: null,
  min_range_km: null,
  search: "",
};

// `persist` middleware syncs the non-function fields of the store to
// localStorage under the key below. This keeps compareIds, filters, and slider
// state alive across page reloads and HMR, so:
//   - multi-vehicle compare selections don't evaporate when Vite HMR re-runs
//   - the user's last slider position survives a browser refresh
//   - the same tab can be left open for days and pick up where it left off
//
// Only data fields are persisted (via `partialize`); setter functions are
// rehydrated from the factory below on next load.
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      filters: DEFAULT_FILTERS,
      compareIds: [],
      setFilter: (key, value) => {
        logAction("setFilter", { key, value });
        set((s) => ({ filters: { ...s.filters, [key]: value } }));
      },
      resetFilters: () => {
        logAction("resetFilters");
        set({ filters: DEFAULT_FILTERS });
      },
      toggleCompare: (id) => {
        logAction("toggleCompare", { id });
        set((s) => {
          if (s.compareIds.includes(id)) {
            return { compareIds: s.compareIds.filter((x) => x !== id) };
          }
          if (s.compareIds.length >= 4) return s;
          return { compareIds: [...s.compareIds, id] };
        });
      },
      clearCompare: () => {
        logAction("clearCompare");
        set({ compareIds: [] });
      },

      // Thermal defaults: 20 °C baseline, HVAC off, highway speed, all preconditioned.
      temp_c: 20,
      hvac_on: false,
      speed_kph: 100,
      preconditioned: {},
      setTemp: (c) => {
        logAction("setTemp", c);
        set({ temp_c: Math.max(-40, Math.min(40, c)) });
      },
      setHvacOn: (v) => { logAction("setHvacOn", v); set({ hvac_on: v }); },
      setSpeed: (v) => { logAction("setSpeed", v); set({ speed_kph: Math.max(40, Math.min(130, v)) }); },
      setPreconditioned: (id, v) => {
        logAction("setPreconditioned", { id, v });
        set((s) => ({ preconditioned: { ...s.preconditioned, [id]: v } }));
      },
      resetThermal: () => {
        logAction("resetThermal");
        set({ temp_c: 20, hvac_on: false, speed_kph: 100, preconditioned: {} });
      },

      // Ontario time-of-use average, off-peak is ~8.7¢, on-peak ~18.2¢ (2025).
      // 17¢ is a reasonable rough blend for typical home charging.
      electricity_cad_per_kwh: 0.17,
      setElectricityRate: (rate) =>
        set({ electricity_cad_per_kwh: Math.max(0, rate) }),

      // Default "home" location: downtown Toronto. User can reset from the map panel.
      user_location: { lat: 43.6532, lng: -79.3832, label: "Toronto, ON" },
      setUserLocation: (loc) => set({ user_location: loc }),
      trip_destination: null,
      setTripDestination: (d) => set({ trip_destination: d }),

      mom_mode: false,
      setMomMode: (v) => set({ mom_mode: v }),
    }),
    {
      name: "ev-dashboard-state",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // Only the data keys — not the setter functions.
      partialize: (state) => ({
        filters: state.filters,
        compareIds: state.compareIds,
        temp_c: state.temp_c,
        hvac_on: state.hvac_on,
        speed_kph: state.speed_kph,
        preconditioned: state.preconditioned,
        electricity_cad_per_kwh: state.electricity_cad_per_kwh,
        user_location: state.user_location,
        trip_destination: state.trip_destination,
        mom_mode: state.mom_mode,
      }),
    },
  ),
);
