"use client";

import { usePickerStore } from "@/store/picker";
import type { Spec } from "@/lib/types";

interface Props {
  specs: Spec[];
}

export function PickerCompareTray({ specs }: Props) {
  const { selectedIds, removeFromTray, clear } = usePickerStore();

  if (selectedIds.length === 0) return null;

  /** Resolve tray IDs back to Spec objects for display labels. */
  function labelForId(id: string): string {
    const [model, year, trim] = id.split("|");
    return `${model} ${year} ${trim}`;
  }

  const compareHref = `/pick-a-model/compare?ids=${selectedIds.map(encodeURIComponent).join(",")}`;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-bg-subtle/95 border-t border-border backdrop-blur-md z-30 shadow-2xl">
      <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center gap-3">
        <div className="flex-1 flex flex-wrap gap-2">
          {selectedIds.map((id) => (
            <button
              key={id}
              onClick={() => removeFromTray(id)}
              className="group flex items-center gap-2 bg-bg border border-border rounded-md px-3 py-1.5 hover:bg-bg-hover transition"
              title="Remove from compare"
            >
              <span className="text-xs text-fg">{labelForId(id)}</span>
              <span className="text-fg-subtle group-hover:text-bad">×</span>
            </button>
          ))}
        </div>

        <div className="text-xxs text-fg-subtle shrink-0">
          {selectedIds.length} / 4
        </div>

        <button
          onClick={clear}
          className="text-xs text-fg-subtle hover:text-fg underline transition shrink-0"
        >
          Clear
        </button>

        <a
          href={compareHref}
          aria-disabled={selectedIds.length < 2}
          className={`px-4 py-1.5 rounded text-sm font-medium transition shrink-0 ${
            selectedIds.length >= 2
              ? "bg-accent text-bg hover:opacity-90"
              : "bg-bg border border-border text-fg-subtle cursor-not-allowed pointer-events-none"
          }`}
          title={selectedIds.length < 2 ? "Pick at least 2 to compare" : undefined}
        >
          Compare →
        </a>
      </div>
    </div>
  );
}
