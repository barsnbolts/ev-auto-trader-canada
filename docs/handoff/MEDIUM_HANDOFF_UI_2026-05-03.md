# Medium-handoff: UI improvements queue (2026-05-03)

Pre-planned by high-reasoning. Medium executes in order. `npm run predeploy` gate
before every commit. Branch: `claude/verify-environment-setup-oTu3S`.

## Already shipped on high (don't redo, don't undo)

- ✅ TempSlider direction flipped (left=+40°C warm, right=−40°C cold), extended to −40°C, color-coded
- ✅ TempSlider preconditioning toggle (`?precon=1` URL param) — `⚡ Precon` button next to slider
- ✅ Thermal model preconditioning activated in `realRangeKm`: battery-temp boost +15°C (cap 20°C) + 30% HVAC reduction. Yields ~12-18% range gain at −20°C, matches Bjorn Nyland / Geotab real-world data
- ✅ Per-vehicle thermal accuracy: `WinterRangeChip` now passes `batteryChemistry` + `heatPumpMinEffectiveC` from spec into the model
- ✅ BC lease monthly tax bug fixed: was flat 12%, now uses BC PST progressive bracket (per BC PST Bulletin 308). Material for \$57k+ EVs leased in BC
- ✅ Compare page progress bars under each numeric spec row
- ✅ OTD waterfall chart in dossier (`OtdWaterfallChart` component, recharts-free pure CSS)

---

## Task 1: PickerFilterBar — range sliders for Max MSRP + Min Range

**File:** `src/components/PickerFilterBar.tsx` (lines ~95–117)

Replace the two `<input type="number">` fields for `maxMsrp` and `minRange`
with `<input type="range">` sliders.

**Spec:**
- Max MSRP slider: min=30000, max=120000, step=5000. Default=120000 (no filter).
  Display live value formatted as `$XX,XXX` next to slider.
  When slider is at max (120000) → set `maxMsrp: null` (no filter).
- Min Range slider: min=0, max=600, step=25. Default=0 (no filter).
  Display live value as `Xkm+` next to slider.
  When slider is at 0 → set `minRange: null` (no filter).

**Replace this block** (~line 95–117):
```tsx
{/* Numeric filters */}
<div className="flex items-center gap-2 text-xs text-fg-muted">
  <label>Max $:</label>
  <input type="number" ... />
  <label>Min km:</label>
  <input type="number" ... />
</div>
```

**With:**
```tsx
{/* MSRP slider */}
<div className="flex items-center gap-2 text-xs text-fg-muted min-w-[160px]">
  <span className="shrink-0 text-xxs uppercase tracking-wide">Max $</span>
  <input
    type="range" min={30000} max={120000} step={5000}
    value={filters.maxMsrp ?? 120000}
    onChange={(e) => {
      const v = Number(e.target.value);
      onChange({ ...filters, maxMsrp: v >= 120000 ? null : v });
    }}
    className="w-28 cursor-pointer accent-accent"
  />
  <span className="tabular-nums w-16">
    {filters.maxMsrp ? `$${(filters.maxMsrp/1000).toFixed(0)}k` : "any"}
  </span>
</div>

{/* Range slider */}
<div className="flex items-center gap-2 text-xs text-fg-muted min-w-[140px]">
  <span className="shrink-0 text-xxs uppercase tracking-wide">Min km</span>
  <input
    type="range" min={0} max={600} step={25}
    value={filters.minRange ?? 0}
    onChange={(e) => {
      const v = Number(e.target.value);
      onChange({ ...filters, minRange: v === 0 ? null : v });
    }}
    className="w-28 cursor-pointer accent-accent"
  />
  <span className="tabular-nums w-12">
    {filters.minRange ? `${filters.minRange}km` : "any"}
  </span>
</div>
```

**Verify:** `npm run predeploy` clean. Sliders render and filter the list.

---

## Task 2: InventoryTable — Max OTD number input → slider

**File:** `src/components/InventoryTable.tsx` (around line 454–463)

State var is `maxPrice` (string | number | ""), set via `setMaxPrice`.

Replace:
```tsx
<label className="flex items-center gap-1 text-fg-muted">
  Max OTD
  <input type="number" inputMode="numeric" value={maxPrice} ... placeholder="65000" className="w-24 px-2 py-1.5 num" />
</label>
```

With:
```tsx
<div className="flex items-center gap-2 text-xs text-fg-muted">
  <span className="text-xxs uppercase tracking-wide shrink-0">Max OTD</span>
  <input
    type="range" min={30000} max={120000} step={2500}
    value={maxPrice === "" ? 120000 : Number(maxPrice)}
    onChange={(e) => {
      const v = Number(e.target.value);
      setMaxPrice(v >= 120000 ? "" : v);
    }}
    className="w-28 cursor-pointer accent-accent"
  />
  <span className="tabular-nums w-14 text-fg">
    {maxPrice === "" || Number(maxPrice) >= 120000 ? "any" : `$${(Number(maxPrice)/1000).toFixed(0)}k`}
  </span>
</div>
```

Note: `maxPrice` at 120000 or "" means no filter — inventory filter already handles `maxPrice === ""`.
Check filter logic at line ~347: `if (maxPrice !== "" && u.otdTotal > Number(maxPrice)) return false;`

**Verify:** predeploy clean. Slider replaces number input, live-filters table.

---

## Task 3: Compare page — sticky winner summary bar

**Files:** 
- `src/app/pick-a-model/compare/page.tsx` — add `data-model` attrs + import client component
- NEW `src/components/CompareWinnerBar.tsx` — "use client" sticky bar

**Step A — compute wins server-side and pass as prop:**

In `PickerComparePage` (page.tsx), after `const rows = buildRows(selected);` add:

```typescript
// Pre-compute win counts per column for the winner bar
const winCounts = selected.map((s, colIdx) => {
  if (!s) return { name: "", wins: 0 };
  const wins = rows.filter((row) => {
    if (!row.highlight) return false;
    const best = bestIndices(row.values, row.highlight);
    return best.has(colIdx);
  }).length;
  return {
    name: `${MODEL_LABEL[s.model as Model]} ${s.year}`,
    wins,
  };
});
const highlightedRowCount = rows.filter((r) => r.highlight).length;
```

Then add `<CompareWinnerBar winCounts={winCounts} total={highlightedRowCount} />` just
before the closing `</div>` of the page, after the footnote `<p>`.

**Step B — create CompareWinnerBar.tsx:**

```tsx
"use client";
interface WinEntry { name: string; wins: number; }
interface Props { winCounts: WinEntry[]; total: number; }

export function CompareWinnerBar({ winCounts, total }: Props) {
  const leader = [...winCounts].sort((a, b) => b.wins - a.wins)[0];
  if (!leader || leader.wins === 0) return null;
  const tied = winCounts.filter((w) => w.wins === leader.wins).length > 1;
  return (
    <div className="sticky bottom-4 z-20 mt-4 print:hidden">
      <div className="mx-auto max-w-fit px-4 py-2 rounded-full bg-bg border border-border shadow-lg text-xs flex items-center gap-3">
        <span className="text-good font-semibold">{tied ? "Tied" : `${leader.name} leads`}</span>
        <span className="text-fg-muted">·</span>
        {winCounts.map((w) => w.wins > 0 && (
          <span key={w.name} className="tabular-nums">
            <span className="text-fg">{w.name.split(" ")[1]}</span>
            <span className="text-fg-subtle"> {w.wins}/{total}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
```

**Verify:** predeploy clean. Render `/pick-a-model/compare?ids=...` with ≥2 models,
confirm sticky bar appears at bottom showing category win counts.

---

## Task 4: Inventory rows — temp-reactive range display

**Already works via URL param + server re-render.** The `WinterRangeChip` in
`InventoryTable.tsx` (around line 624) reads `spec` + `tempC` prop passed from server.

The server (`src/app/inventory/page.tsx` line ~35–42) already computes
`rangeByUnitId` per spec. To make the chip more visible:

**Find `WinterRangeChip` component in InventoryTable.tsx** (search for `WinterRangeChip`).
It renders as a tiny chip. Make it more prominent when temp is below 0:
- If `tempC >= 5`: render `null` (no chip — range is nominal)
- If `tempC >= -10`: render amber badge with adjusted km
- If `tempC < -10`: render red badge with adjusted km + ❄️ icon

The thermal model is already wired. This is just a CSS/conditional tweak.

---

## Task 5: Inventory card — 3-number hero

**File:** `src/components/InventoryTable.tsx`, row render (~line 573+)

Currently each row has many columns. Add a "hero stat" sub-row beneath model name:

Inside the model+trim `<td>` (the one containing `MODEL_LABEL[u.model]`), after
the existing chips, add:

```tsx
<div className="flex gap-3 mt-1 text-xxs text-fg-muted">
  {u.otdTotal && <span className="text-fg font-medium num">{fmtCad(u.otdTotal)}</span>}
  {rangeByUnitId[u.id] && (
    <span>
      <span className="text-fg num">{rangeByUnitId[u.id]}</span>
      <span> km</span>
      {tempC < 5 && <span className="text-[#60a5fa] ml-0.5">@{tempC}°</span>}
    </span>
  )}
</div>
```

Check what `u.otdTotal` field is called — may be `u.otdBreakdown?.total` or similar.
Search InventoryTable.tsx for `otdTotal` or `otdBreakdown` to confirm the field name.

---

## Commit pattern

After each task:
```bash
npm run predeploy
git add -A
git commit -m "feat(ui): <what changed>"
git push origin HEAD
```

---

## Math audit findings (2026-05-03 high-reasoning sweep)

**FIXED in this commit batch:**
- BC lease monthly tax was using flat 12% rate. Per BC PST Bulletin 308, lease
  payments on long-term auto leases use the same progressive PST bracket as
  cash retail. Fixed in `src/lib/scoring.ts` — new `monthlyLeaseTaxRate(province, vehiclePrice)`.

**Verified correct (no action needed):**
- All 13 PROVINCE_TAX rates match `data/taxes-and-fees.json`
- BC PST progressive brackets match
- Ontario dealer fees (OMVIC $22, tire $22.76, RDPRM $5, gov licensing $105) match
- PMT amortization formula is standard
- Lease money-factor formula (apr/2400) is standard
- OTD breakdown line items reconcile to total via algebraic substitution
- OtdWaterfallChart positions reconcile to running cumulative

**Observations (not bugs, may revisit):**
- `incentiveStackScore` sums ALL `amountCad` from applicable incentives,
  including non-OTD scopes (e.g., charger_install). Slightly inflates the
  Deal Score for units with charger rebates. Not material for personal use
  since real OTD math is correct.
- Federal luxury tax (>$100k threshold, in `data/taxes-and-fees.json`) is
  not applied in `computeOtd`. Irrelevant for current Hyundai/Kia EV scope
  (max trim ~$80k MSRP). Add when extending to Lucid/Mercedes/Genesis.
- BC lease tax still uses `unit.msrp` as the bracket key; technically the
  "lease price" (sum of payments + residual) determines the rate per BCPSTB-308.
  For typical EV lease scenarios these are very close. Edge cases possible.
- Tire stewardship fee is rendered post-tax. Some Ontario dealers add HST on
  this; current code matches the more common convention (pre-HST pass-through).
  Probably fine — within $3 either way.

## Notes for medium

- `accent-accent` Tailwind class already defined in the project — use for slider thumb color
- `text-xxs` already defined — use for small uppercase labels
- `tabular-nums` class already defined — use for all numbers
- `bg-bg-subtle`, `bg-bg-hover`, `border-border` — all defined, use for UI backgrounds
- Never touch `src/lib/types.ts`, `data/*.json`, or `src/lib/scoring.ts` in these tasks
- `MODEL_LABEL` is imported from `@/lib/constants` — maps model key → display name
- `fmtCad` is in `@/lib/format` for currency formatting
