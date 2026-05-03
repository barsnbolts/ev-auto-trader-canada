"use client";
/**
 * TempSlider — LEFT = warm (+40°C), RIGHT = cold (-40°C).
 * Internally negated so HTML range increases L→R while displayed temp decreases.
 *
 * URL params (both via router.replace, no page reload):
 *   ?tempC=N      — outside temperature in °C (default 20 → param omitted)
 *   ?precon=1     — battery + cabin preconditioning ON (default off → param omitted)
 *
 * Preconditioning toggle is a small ⚡ button next to the slider. When on,
 * the thermal model treats the battery as ~15°C warmer (capped at 20°C) and
 * cabin HVAC draw as ~30% lower — modeling the typical Hyundai/Kia E-GMP
 * "Battery Conditioning" + cabin pre-heat behaviour.
 */
import { useRouter, usePathname, useSearchParams } from "next/navigation";

const DEFAULT_TEMP = 20;

function tempColor(t: number): string {
  if (t >= 10) return "text-good";
  if (t >= 0) return "text-fg-muted";
  if (t >= -15) return "text-[#60a5fa]";
  return "text-[#f87171]";
}

interface Props {
  initial: number;
  preconditioned?: boolean;
}

export function TempSlider({ initial, preconditioned = false }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParams(patch: { tempC?: number | null; precon?: boolean | null }) {
    const params = new URLSearchParams(searchParams.toString());
    if (patch.tempC !== undefined) {
      if (patch.tempC === null || patch.tempC === DEFAULT_TEMP) params.delete("tempC");
      else params.set("tempC", String(patch.tempC));
    }
    if (patch.precon !== undefined) {
      if (patch.precon) params.set("precon", "1");
      else params.delete("precon");
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const sliderValue = -initial; // negate so left = warm
  const label = initial >= 0 ? `+${initial}°C` : `${initial}°C`;

  return (
    <div className="flex items-center gap-2 px-3 py-2 text-xs select-none">
      <span className="text-fg-subtle shrink-0 text-xxs">Range at</span>
      <span className="text-good text-xxs shrink-0 hidden sm:inline">+40°C</span>
      <input
        type="range"
        min={-40}
        max={40}
        step={5}
        value={sliderValue}
        onChange={(e) => updateParams({ tempC: -Number(e.target.value) })}
        className="flex-1 max-w-xs cursor-pointer accent-accent"
        aria-label="Outside temperature in Celsius"
        aria-valuetext={label}
      />
      <span className="text-[#f87171] text-xxs shrink-0 hidden sm:inline">−40°C</span>
      <span className={`font-mono w-14 text-right tabular-nums shrink-0 font-medium ${tempColor(initial)}`}>
        {label}
      </span>

      {/* Preconditioning toggle */}
      <button
        type="button"
        role="switch"
        aria-checked={preconditioned}
        onClick={() => updateParams({ precon: !preconditioned })}
        className={`shrink-0 ml-1 px-2 py-1 rounded text-xxs font-medium transition border ${
          preconditioned
            ? "bg-accent-dim/30 border-accent text-accent"
            : "bg-bg border-border text-fg-subtle hover:text-fg hover:bg-bg-hover"
        }`}
        title={
          preconditioned
            ? "Preconditioning ON — battery + cabin warmed before drive (typical: +8-15% range at -20°C). Click to disable."
            : "Preconditioning OFF — cold-soaked vehicle (worst case). Click to model preconditioning ON (E-GMP Winter Mode)."
        }
      >
        ⚡ {preconditioned ? "Precon ON" : "Precon"}
      </button>

      {(initial !== DEFAULT_TEMP || preconditioned) && (
        <button
          onClick={() => updateParams({ tempC: DEFAULT_TEMP, precon: false })}
          className="text-xxs text-fg-subtle hover:text-fg transition shrink-0 ml-1"
          aria-label="Reset to defaults"
        >
          reset
        </button>
      )}
    </div>
  );
}
