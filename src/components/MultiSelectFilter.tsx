"use client";

// Lightweight multi-select dropdown for inventory filters. Empty selection
// = "no filter applied" (matches all) — sentinel-free design from the
// MEDIUM_HANDOFF_multiselect_2026-05-05.md spec.
//
// Click button to open popover with checkbox list. Click outside or Esc
// closes. Backed by a Set<T> in the parent component's state.

import { useEffect, useRef, useState } from "react";

type Option<T> = {
  value: T;
  label: string;
};

type Props<T extends string | number> = {
  /** Display label like "Models" — also used for empty-state text. */
  label: string;
  options: Option<T>[];
  /** Current selection. Empty Set = no filter. */
  selected: Set<T>;
  onChange: (next: Set<T>) => void;
  /** Optional fixed width for the trigger button. */
  triggerClassName?: string;
};

export default function MultiSelectFilter<T extends string | number>({
  label,
  options,
  selected,
  onChange,
  triggerClassName,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Show inline filter input when option count justifies it. Helps with
  // the trim list (15+ trims after model selection narrows it).
  const showFilter = options.length > 12;
  const visibleOptions =
    filter.trim() === ""
      ? options
      : options.filter((o) => o.label.toLowerCase().includes(filter.toLowerCase()));

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle(v: T) {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange(next);
  }

  function clearAll() {
    onChange(new Set());
  }

  const buttonText =
    selected.size === 0
      ? `All ${label.toLowerCase()}`
      : selected.size === 1
        ? `${label}: ${options.find((o) => o.value === [...selected][0])?.label ?? "(1)"}`
        : `${label} (${selected.size})`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`px-2 py-1.5 border border-border rounded text-left ${selected.size > 0 ? "bg-accent/10 border-accent/40" : ""} ${triggerClassName ?? ""}`}
      >
        {buttonText}
        <span className="ml-1 text-fg-subtle">▾</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 min-w-[12rem] max-h-72 overflow-auto bg-bg-subtle border border-border rounded shadow-lg p-2 text-xs">
          {showFilter && (
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={`Filter ${label.toLowerCase()}…`}
              className="w-full mb-1 px-2 py-1 text-xs"
              autoFocus
            />
          )}
          {selected.size > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="w-full text-left px-2 py-1 text-fg-subtle hover:text-fg hover:bg-border/50 rounded mb-1"
            >
              Clear all
            </button>
          )}
          {visibleOptions.length === 0 && (
            <div className="px-2 py-1 text-fg-subtle italic">No matches</div>
          )}
          {visibleOptions.map((o) => {
            const checked = selected.has(o.value);
            return (
              <label
                key={String(o.value)}
                className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-border/40 rounded"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(o.value)}
                />
                <span className={checked ? "text-fg" : "text-fg-muted"}>{o.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
