"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/** Stable tray key: model|year|trim|drivetrain */
export function pickerKey(
  model: string,
  year: number,
  trim: string,
  drivetrain: string,
): string {
  return `${model}|${year}|${trim}|${drivetrain}`;
}

interface PickerState {
  selectedIds: string[];
  addToTray: (id: string) => void;
  removeFromTray: (id: string) => void;
  clear: () => void;
}

export const usePickerStore = create<PickerState>()(
  persist(
    (set) => ({
      selectedIds: [],
      addToTray: (id) =>
        set((s) =>
          s.selectedIds.includes(id) || s.selectedIds.length >= 4
            ? s
            : { selectedIds: [...s.selectedIds, id] },
        ),
      removeFromTray: (id) =>
        set((s) => ({ selectedIds: s.selectedIds.filter((x) => x !== id) })),
      clear: () => set({ selectedIds: [] }),
    }),
    {
      name: "picker-tray-v1",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
