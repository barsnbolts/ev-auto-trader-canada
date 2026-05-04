"use client";
/**
 * TempSlider — LEFT = warm (+40°C), RIGHT = cold (-40°C).
 *
 * Reads + writes pure client state via TempContext. No router refetch on
 * drag — chips and charts re-render synchronously off the same context.
 * URL syncs (debounced) via history.replaceState for shareable links.
 */
import { useTemp } from "@/lib/tempContext";

const DEFAULT_TEMP = 20;

function tempColor(t: number): string {
  if (t >= 10) return "text-good";
  if (t >= 0) return "text-fg-muted";
  if (t >= -15) return "text-[#60a5fa]";
  return "text-[#f87171]";
}

export function TempSlider() {
  const { tempC, preconditioned, setTempC, setPrecon, reset } = useTemp();
  const sliderValue = -tempC; // negate so left = warm
  const label = tempC >= 0 ? `+${tempC}°C` : `${tempC}°C`;
  const dirty = tempC !== DEFAULT_TEMP || preconditioned;

  return (
    <div className="flex items-center gap-2 px-3 py-2 text-xs select-none">
      <span className="text-fg-subtle shrink-0 text-xxs">Range at</span>
      <span className="text-good text-xxs shrink-0 hidden sm:inline">+40°C</span>
      <input
        type="range"
        min={-40}
        max={40}
        step={1}
        value={sliderValue}
        onChange={(e) => setTempC(-Number(e.target.value))}
        className="flex-1 max-w-xs cursor-pointer accent-accent rounded-full"
        aria-label="Outside temperature in Celsius"
        aria-valuetext={label}
      />
      <span className="text-[#f87171] text-xxs shrink-0 hidden sm:inline">−40°C</span>
      <span
        className={`font-mono w-14 text-right tabular-nums shrink-0 font-medium transition-colors duration-150 ${tempColor(tempC)}`}
      >
        {label}
      </span>

      <button
        type="button"
        role="switch"
        aria-checked={preconditioned}
        onClick={() => setPrecon(!preconditioned)}
        className={`shrink-0 ml-1 px-2 py-1 rounded text-xxs font-medium transition-all duration-150 border ${
          preconditioned
            ? "bg-accent-dim/30 border-accent text-accent"
            : "bg-bg border-border text-fg-subtle hover:text-fg hover:bg-bg-hover"
        }`}
        title={
          preconditioned
            ? "Preconditioning ON — battery + cabin warmed before drive. Click to disable."
            : "Preconditioning OFF — cold-soaked vehicle. Click to enable (E-GMP Winter Mode)."
        }
      >
        ⚡ {preconditioned ? "Precon ON" : "Precon"}
      </button>

      {dirty && (
        <button
          onClick={reset}
          className="text-xxs text-fg-subtle hover:text-fg transition shrink-0 ml-1 rounded"
          aria-label="Reset to defaults"
        >
          reset
        </button>
      )}
    </div>
  );
}
