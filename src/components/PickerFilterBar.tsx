"use client";

export interface PickerFilters {
  search: string;
  powertrain: string[]; // "BEV" | "PHEV" | "EREV"
  bodyStyle: string[];
  drivetrain: string[]; // "RWD" | "AWD"
  maxMsrp: number | null;
  minRange: number | null;
}

export const DEFAULT_PICKER_FILTERS: PickerFilters = {
  search: "",
  powertrain: [],
  bodyStyle: [],
  drivetrain: [],
  maxMsrp: null,
  minRange: null,
};

const POWERTRAINS = ["BEV", "PHEV", "EREV"] as const;
const BODY_STYLES = ["Sedan", "Hatchback", "Crossover", "SUV", "Truck", "Minivan", "Wagon"] as const;
const DRIVETRAINS = ["RWD", "AWD"] as const;

function toggle<T extends string>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
}

interface Props {
  filters: PickerFilters;
  onChange: (f: PickerFilters) => void;
}

export function PickerFilterBar({ filters, onChange }: Props) {
  return (
    <div className="border-b border-border bg-bg-subtle/80 backdrop-blur-md sticky top-0 z-20">
      <div className="px-4 py-3 flex flex-wrap items-center gap-3">
        {/* Search */}
        <input
          type="text"
          placeholder="Search make or model…"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="w-56 bg-bg border border-border rounded-md px-3 py-1.5 text-sm text-fg placeholder-fg-subtle focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
        />

        {/* Type */}
        <div className="flex items-center gap-1">
          <span className="text-xxs text-fg-subtle mr-1 uppercase tracking-wide">Type:</span>
          {POWERTRAINS.map((p) => (
            <button
              key={p}
              onClick={() => onChange({ ...filters, powertrain: toggle(filters.powertrain, p) })}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                filters.powertrain.includes(p)
                  ? "bg-accent text-bg"
                  : "bg-bg border border-border text-fg-muted hover:text-fg hover:bg-bg-hover"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-xxs text-fg-subtle mr-1 uppercase tracking-wide">Body:</span>
          {BODY_STYLES.map((b) => (
            <button
              key={b}
              onClick={() => onChange({ ...filters, bodyStyle: toggle(filters.bodyStyle, b) })}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                filters.bodyStyle.includes(b)
                  ? "bg-accent text-bg"
                  : "bg-bg border border-border text-fg-muted hover:text-fg hover:bg-bg-hover"
              }`}
            >
              {b}
            </button>
          ))}
        </div>

        {/* Drivetrain */}
        <div className="flex items-center gap-1">
          <span className="text-xxs text-fg-subtle mr-1 uppercase tracking-wide">Drive:</span>
          {DRIVETRAINS.map((d) => (
            <button
              key={d}
              onClick={() => onChange({ ...filters, drivetrain: toggle(filters.drivetrain, d) })}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                filters.drivetrain.includes(d)
                  ? "bg-accent text-bg"
                  : "bg-bg border border-border text-fg-muted hover:text-fg hover:bg-bg-hover"
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        {/* Numeric filters */}
        <div className="flex items-center gap-2 text-xs text-fg-muted">
          <label>Max $:</label>
          <input
            type="number"
            placeholder="—"
            value={filters.maxMsrp ?? ""}
            onChange={(e) =>
              onChange({ ...filters, maxMsrp: e.target.value ? Number(e.target.value) : null })
            }
            className="bg-bg border border-border rounded px-2 py-1 text-fg w-24"
          />
          <label>Min km:</label>
          <input
            type="number"
            placeholder="—"
            value={filters.minRange ?? ""}
            onChange={(e) =>
              onChange({ ...filters, minRange: e.target.value ? Number(e.target.value) : null })
            }
            className="bg-bg border border-border rounded px-2 py-1 text-fg w-24"
          />
        </div>

        <button
          onClick={() => onChange(DEFAULT_PICKER_FILTERS)}
          className="ml-auto text-xs text-fg-subtle hover:text-fg underline transition"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
