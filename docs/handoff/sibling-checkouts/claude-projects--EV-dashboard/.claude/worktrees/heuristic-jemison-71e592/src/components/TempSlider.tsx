import { useAppStore } from "../store/useAppStore";
import type { Vehicle } from "../types";

export function TempSlider({ vehicles }: { vehicles: Vehicle[] }) {
  const {
    temp_c,
    hvac_on,
    speed_kph,
    preconditioned,
    setTemp,
    setHvacOn,
    setSpeed,
    setPreconditioned,
    resetThermal,
  } = useAppStore();

  return (
    <div className="bg-ink-800 rounded-lg border border-ink-700 p-4 mb-6">
      <div className="flex items-baseline gap-4 mb-3">
        <h3 className="font-display text-sm uppercase tracking-widest text-ink-300">
          Conditions
        </h3>
        <span className="text-xs text-ink-500">
          physics-model driven · updates every field below
        </span>
        <button
          onClick={resetThermal}
          className="ml-auto text-xs text-ink-400 hover:text-ink-100 underline"
        >
          Reset to 20 °C
        </button>
      </div>

      {/* Temperature slider */}
      <div className="mb-4">
        <div className="flex items-baseline gap-4 mb-1">
          <label className="text-xs text-ink-400 w-28">Ambient temp</label>
          <div className="flex-1 flex items-center gap-3">
            <span className="text-xs text-ink-500 w-10 text-right">−40 °C</span>
            <input
              type="range"
              min={-40}
              max={40}
              step={1}
              value={temp_c}
              onChange={(e) => setTemp(Number(e.target.value))}
              className="flex-1 accent-accent-blue"
            />
            <span className="text-xs text-ink-500 w-10">+40 °C</span>
          </div>
          <span className="font-mono text-base text-ink-100 w-16 text-right">
            {temp_c >= 0 ? "+" : ""}
            {temp_c} °C
          </span>
        </div>
      </div>

      {/* HVAC toggle + speed */}
      <div className="flex items-center gap-6 mb-4">
        <label className="flex items-center gap-2 text-xs text-ink-300 cursor-pointer">
          <input
            type="checkbox"
            checked={hvac_on}
            onChange={(e) => setHvacOn(e.target.checked)}
            className="accent-accent-blue"
          />
          HVAC on (heating / AC)
        </label>
        <label className="flex items-center gap-2 text-xs text-ink-300">
          Speed
          <input
            type="number"
            min={40}
            max={130}
            value={speed_kph}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="bg-ink-700 border border-ink-600 rounded px-2 py-1 w-20 text-ink-100 font-mono"
          />
          <span className="text-ink-500">km/h</span>
        </label>
      </div>

      {/* Per-vehicle preconditioning toggles */}
      <div className="border-t border-ink-700 pt-3">
        <div className="text-xs text-ink-400 mb-2">
          Battery preconditioned (for DC fast charging):
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${vehicles.length}, minmax(0, 1fr))` }}>
          {vehicles.map((v) => {
            const isPrecon = preconditioned[v.id] ?? true;
            return (
              <label
                key={v.id}
                className="flex items-center gap-2 text-xs text-ink-200 cursor-pointer bg-ink-700/50 rounded px-2 py-1.5 hover:bg-ink-700"
              >
                <input
                  type="checkbox"
                  checked={isPrecon}
                  onChange={(e) => setPreconditioned(v.id, e.target.checked)}
                  className="accent-accent-blue"
                />
                <span className="truncate" title={`${v.model} ${v.trim_label}`}>
                  {v.model} <span className="text-ink-400">{v.trim_label}</span>
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
