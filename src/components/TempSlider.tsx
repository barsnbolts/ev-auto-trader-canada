"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export function TempSlider({ initial }: { initial: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setTemp(t: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (t === 20) params.delete("tempC");
    else params.set("tempC", String(t));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2 text-xs">
      <label className="text-fg-subtle">Temperature</label>
      <input
        type="range"
        min={-30}
        max={40}
        step={5}
        defaultValue={initial}
        onChange={(e) => setTemp(Number(e.target.value))}
        className="flex-1 max-w-md"
        aria-label="Outside temperature in Celsius"
      />
      <span className="font-mono w-12 text-right">
        {initial >= 0 ? `+${initial}` : initial}°C
      </span>
    </div>
  );
}
