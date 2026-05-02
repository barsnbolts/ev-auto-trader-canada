import { useAppStore } from "../store/useAppStore";
import { drivetrain } from "../lib/format";
import type { Powertrain, BodyStyle, DrivetrainVariant } from "../types";

const POWERTRAINS: Powertrain[] = ["BEV", "PHEV", "EREV"];
const BODY_STYLES: BodyStyle[] = [
  "Sedan",
  "Hatchback",
  "Crossover",
  "SUV",
  "Truck",
  "Minivan",
  "Wagon",
];
const DRIVETRAINS: DrivetrainVariant[] = ["SINGLE_MOTOR", "AWD"];

export function FilterBar() {
  const { filters, setFilter, resetFilters } = useAppStore();

  const togglePowertrain = (p: Powertrain) => {
    const current = filters.powertrain === "all" ? [] : filters.powertrain;
    const next = current.includes(p)
      ? current.filter((x) => x !== p)
      : [...current, p];
    setFilter("powertrain", next.length === 0 ? "all" : next);
  };

  const toggleBody = (b: BodyStyle) => {
    const current = filters.body_style === "all" ? [] : filters.body_style;
    const next = current.includes(b)
      ? current.filter((x) => x !== b)
      : [...current, b];
    setFilter("body_style", next.length === 0 ? "all" : next);
  };

  const toggleDrivetrain = (d: DrivetrainVariant) => {
    const current = filters.drivetrain === "all" ? [] : filters.drivetrain;
    const next = current.includes(d)
      ? current.filter((x) => x !== d)
      : [...current, d];
    setFilter("drivetrain", next.length === 0 ? "all" : next);
  };

  const isActivePowertrain = (p: Powertrain) =>
    filters.powertrain !== "all" && filters.powertrain.includes(p);
  const isActiveBody = (b: BodyStyle) =>
    filters.body_style !== "all" && filters.body_style.includes(b);
  const isActiveDrivetrain = (d: DrivetrainVariant) =>
    filters.drivetrain !== "all" && filters.drivetrain.includes(d);

  return (
    <div className="border-b border-ink-700 bg-ink-800/80 backdrop-blur-md sticky top-0 z-20">
      <div className="px-6 py-3 flex flex-wrap items-center gap-4">
        <input
          type="text"
          placeholder="Search make or model…"
          value={filters.search}
          onChange={(e) => setFilter("search", e.target.value)}
          className="bg-ink-700 border border-ink-600 rounded-md px-3 py-1.5 text-sm text-ink-100 placeholder-ink-400 focus:outline-none focus:border-accent-blue w-64"
        />

        <div className="flex items-center gap-1">
          <span className="text-xs text-ink-400 mr-1">Type:</span>
          {POWERTRAINS.map((p) => (
            <button
              key={p}
              onClick={() => togglePowertrain(p)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                isActivePowertrain(p)
                  ? "bg-accent-blue text-white"
                  : "bg-ink-700 text-ink-300 hover:bg-ink-600"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-xs text-ink-400 mr-1">Body:</span>
          {BODY_STYLES.map((b) => (
            <button
              key={b}
              onClick={() => toggleBody(b)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                isActiveBody(b)
                  ? "bg-accent-blue text-white"
                  : "bg-ink-700 text-ink-300 hover:bg-ink-600"
              }`}
            >
              {b}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <span className="text-xs text-ink-400 mr-1">Drive:</span>
          {DRIVETRAINS.map((d) => (
            <button
              key={d}
              onClick={() => toggleDrivetrain(d)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                isActiveDrivetrain(d)
                  ? "bg-accent-blue text-white"
                  : "bg-ink-700 text-ink-300 hover:bg-ink-600"
              }`}
            >
              {drivetrain(d)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-ink-400">
          <label>Max $:</label>
          <input
            type="number"
            placeholder="—"
            value={filters.max_price_cad ?? ""}
            onChange={(e) =>
              setFilter(
                "max_price_cad",
                e.target.value ? Number(e.target.value) : null,
              )
            }
            className="bg-ink-700 border border-ink-600 rounded px-2 py-1 text-ink-100 w-24"
          />
          <label>Min km:</label>
          <input
            type="number"
            placeholder="—"
            value={filters.min_range_km ?? ""}
            onChange={(e) =>
              setFilter(
                "min_range_km",
                e.target.value ? Number(e.target.value) : null,
              )
            }
            className="bg-ink-700 border border-ink-600 rounded px-2 py-1 text-ink-100 w-24"
          />
        </div>

        <button
          onClick={resetFilters}
          className="ml-auto text-xs text-ink-400 hover:text-ink-100 underline"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
