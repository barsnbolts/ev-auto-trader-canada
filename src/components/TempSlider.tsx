"use client";
/**
 * TempSlider — LEFT = warm (+40°C), RIGHT = cold (-40°C).
 *
 * Snappy: drag updates local state at GPU rate; URL syncs via 200ms debounce
 * (one SSR roundtrip per pause, not per pixel). Display label/color update
 * instantly off local state.
 *
 * URL params (router.replace, no scroll):
 *   ?tempC=N    outside temperature in °C (default 20 omits param)
 *   ?precon=1   battery + cabin preconditioning ON
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

const DEFAULT_TEMP = 20;
const DEBOUNCE_MS = 200;

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
  const [localTemp, setLocalTemp] = useState(initial);
  const [localPrecon, setLocalPrecon] = useState(preconditioned);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync if parent prop changes (e.g. user lands with different URL).
  useEffect(() => {
    setLocalTemp(initial);
  }, [initial]);
  useEffect(() => {
    setLocalPrecon(preconditioned);
  }, [preconditioned]);

  function pushUrl(temp: number, precon: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (temp === DEFAULT_TEMP) params.delete("tempC");
    else params.set("tempC", String(temp));
    if (precon) params.set("precon", "1");
    else params.delete("precon");
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  function scheduleUrl(temp: number, precon: boolean) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => pushUrl(temp, precon), DEBOUNCE_MS);
  }

  function onTempChange(next: number) {
    setLocalTemp(next);
    scheduleUrl(next, localPrecon);
  }

  function onPreconToggle() {
    const next = !localPrecon;
    setLocalPrecon(next);
    // Precon toggle is single-shot, push immediately for instant feedback.
    if (debounceRef.current) clearTimeout(debounceRef.current);
    pushUrl(localTemp, next);
  }

  function onReset() {
    setLocalTemp(DEFAULT_TEMP);
    setLocalPrecon(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    pushUrl(DEFAULT_TEMP, false);
  }

  const sliderValue = -localTemp;
  const label = localTemp >= 0 ? `+${localTemp}°C` : `${localTemp}°C`;
  const dirty = localTemp !== DEFAULT_TEMP || localPrecon;

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
        onChange={(e) => onTempChange(-Number(e.target.value))}
        className="flex-1 max-w-xs cursor-pointer accent-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 rounded-full"
        aria-label="Outside temperature in Celsius"
        aria-valuetext={label}
      />
      <span className="text-[#f87171] text-xxs shrink-0 hidden sm:inline">−40°C</span>
      <span
        className={`font-mono w-14 text-right tabular-nums shrink-0 font-medium transition-colors duration-150 ${tempColor(localTemp)} ${isPending ? "opacity-70" : ""}`}
      >
        {label}
      </span>

      <button
        type="button"
        role="switch"
        aria-checked={localPrecon}
        onClick={onPreconToggle}
        className={`shrink-0 ml-1 px-2 py-1 rounded text-xxs font-medium transition-all duration-150 border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
          localPrecon
            ? "bg-accent-dim/30 border-accent text-accent"
            : "bg-bg border-border text-fg-subtle hover:text-fg hover:bg-bg-hover"
        }`}
        title={
          localPrecon
            ? "Preconditioning ON — battery + cabin warmed before drive. Click to disable."
            : "Preconditioning OFF — cold-soaked vehicle. Click to enable (E-GMP Winter Mode)."
        }
      >
        ⚡ {localPrecon ? "Precon ON" : "Precon"}
      </button>

      {dirty && (
        <button
          onClick={onReset}
          className="text-xxs text-fg-subtle hover:text-fg transition shrink-0 ml-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 rounded"
          aria-label="Reset to defaults"
        >
          reset
        </button>
      )}
    </div>
  );
}
