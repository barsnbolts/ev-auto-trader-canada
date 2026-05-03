"use client";
/**
 * TempSlider — LEFT = warm (+40°C), RIGHT = cold (-40°C).
 * Internally negated so HTML range increases L→R while displayed temp decreases.
 * Writes ?tempC= URL param via router.replace. Default 20°C removes the param.
 */
import { useRouter, usePathname, useSearchParams } from "next/navigation";

const DEFAULT_TEMP = 20;

function tempColor(t: number): string {
  if (t >= 10) return "text-good";
  if (t >= 0) return "text-fg-muted";
  if (t >= -15) return "text-[#60a5fa]";
  return "text-[#f87171]";
}

export function TempSlider({ initial }: { initial: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setTemp(t: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (t === DEFAULT_TEMP) params.delete("tempC");
    else params.set("tempC", String(t));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  // Negate: slider left (-40 internal) → displayed +40°C warm
  const sliderValue = -initial;
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
        onChange={(e) => setTemp(-Number(e.target.value))}
        className="flex-1 max-w-xs cursor-pointer accent-accent"
        aria-label="Outside temperature in Celsius"
        aria-valuetext={label}
      />
      <span className="text-[#f87171] text-xxs shrink-0 hidden sm:inline">−40°C</span>
      <span className={`font-mono w-14 text-right tabular-nums shrink-0 font-medium ${tempColor(initial)}`}>
        {label}
      </span>
      {initial !== DEFAULT_TEMP && (
        <button
          onClick={() => setTemp(DEFAULT_TEMP)}
          className="text-xxs text-fg-subtle hover:text-fg transition shrink-0 ml-1"
          aria-label="Reset to default temperature"
        >
          reset
        </button>
      )}
    </div>
  );
}
