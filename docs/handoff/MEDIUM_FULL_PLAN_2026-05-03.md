# Medium Full Plan — 2026-05-03 (after high-tier sweep)

This is the complete, self-contained plan for medium-tier execution.
Supersedes `MEDIUM_HANDOFF_UI_2026-05-03.md` (kept for history).

**Branch:** `claude/verify-environment-setup-oTu3S`
**Cwd:** `~/ev-auto-trader-canada` (every Bash starts with `cd ~/ev-auto-trader-canada &&`)
**HEAD at handoff:** `72ed3e8b` (will move with next commit)
**Predeploy gate:** `npm run predeploy` (now runs `typecheck → thermal-audit → build` — all three must pass)

---

## What's already shipped on high (don't redo / don't undo)

### Math correctness
- ✅ **Thermal model is per-vehicle accurate** — `realRangeKm` + `computeThermalFull` thread `batteryChemistry`, `heatPumpMinEffectiveC` from each spec
- ✅ **Preconditioning physics activated** — battery temp +15°C boost (capped 20°C) + 30% HVAC reduction. Yields 17-24% gain at -20°C across all 31 specs (matches Bjorn Nyland telemetry)
- ✅ **Soft heat-pump transition** — 5°C linear blend zone above the cutoff. No more 14% range cliff at the cutoff temp
- ✅ **All 28 E-GMP heat-pump specs** have `heatPumpMinEffectiveC: -25` (Medium confidence, source = Hyundai E-GMP technical reference). Cutoff was previously defaulting to -20°C
- ✅ **BC lease monthly tax** uses BC PST progressive bracket (was flat 12%, now per BC PST Bulletin 308). Material for $57k+ EVs leased in BC
- ✅ **`scripts/validate_thermal_specs.py`** — auto-audits every spec for required fields + physical-plausibility bands. Wired into `npm run predeploy`. Future spec edits that violate thermal-input rules WILL fail the gate

### UI
- ✅ **TempSlider** — left=+40°C warm, right=−40°C cold, extended to −40°C, color-coded label, `⚡ Precon` toggle button (writes `?precon=1` URL param)
- ✅ **WinterRangeChip** — uses per-vehicle chemistry + cutoff + precon state, tooltip shows full thermal context
- ✅ **Compare spec bars** — inline progress bars under every numeric spec row in `/pick-a-model/compare`
- ✅ **OTD waterfall chart** — visual breakdown in dossier (`OtdWaterfallChart` component, pure CSS, no recharts dep)
- ✅ **Project CLAUDE.md** at repo root — operating rules + anti-hallucination protocol

---

## Medium task queue (execute in order; predeploy + commit + push after each)

### Task M1: Filter range sliders (PickerFilterBar)

**File:** `src/components/PickerFilterBar.tsx` (lines ~95-117)

Replace the `<input type="number">` for `maxMsrp` and `minRange` with sliders.

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

**Verify:** sliders render, drag updates list, predeploy clean.
**Commit:** `feat(ui): replace MSRP/range number inputs with sliders in PickerFilterBar`

---

### Task M2: Inventory Max OTD slider

**File:** `src/components/InventoryTable.tsx` (around line 454-463)

Replace the Max OTD `<input type="number">` with a slider:

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

**Commit:** `feat(ui): replace Max OTD number input with slider in InventoryTable`

---

### Task M3: Compare sticky winner bar

**Files:** Modify `src/app/pick-a-model/compare/page.tsx` + create `src/components/CompareWinnerBar.tsx`

In `PickerComparePage`, after `const rows = buildRows(selected);` insert:
```typescript
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

Render `<CompareWinnerBar winCounts={winCounts} total={highlightedRowCount} />` after the footnote `<p>`.

Create `src/components/CompareWinnerBar.tsx`:
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

**Commit:** `feat(ui): sticky winner summary bar on /pick-a-model/compare`

---

### Task M4: WinterRangeChip prominence boost

**File:** `src/components/InventoryTable.tsx` (around line 114-160 — the `WinterRangeChip` function)

Add severity tiers based on tempC:
- `tempC >= 5`: render null (already does)
- `tempC >= -5`: existing blue chip (no change)
- `tempC >= -15`: amber chip — `bg-amber-900 text-amber-200`, icon `❄`
- `tempC < -15`: red chip — `bg-red-900 text-red-200`, icon `🥶`
- If `preconditioned=true`: append "⚡" to label and add green outline `ring-1 ring-good/40`

Replace the existing className construction inside `WinterRangeChip` with a tier function. Keep the tooltip logic unchanged.

**Commit:** `feat(ui): WinterRangeChip severity tiers + precon visual indicator`

---

### Task M5: Inventory hero stats

**File:** `src/components/InventoryTable.tsx` (in the row render, the model+trim `<td>` around line 615-626)

After the existing `<HeatPumpChip>` and `<WinterRangeChip>` lines, add a 3-stat hero strip showing OTD · range · DC kW:

```tsx
<div className="flex gap-3 mt-1 text-xxs text-fg-muted">
  <span className="text-fg font-medium num">{fmtCad(u.otdBreakdown.total)}</span>
  {rangeByUnitId?.[u.id] && (
    <span>
      <span className="text-fg num">{rangeByUnitId[u.id]}</span>
      <span className="text-fg-subtle"> km</span>
    </span>
  )}
  {specByUnitId?.[u.id]?.dcChargeMaxKw && (
    <span>
      <span className="text-fg num">{Math.round(specByUnitId[u.id].dcChargeMaxKw.value)}</span>
      <span className="text-fg-subtle"> kW</span>
    </span>
  )}
</div>
```

Note: `u.otdBreakdown.total` is the correct field path (verified in `src/lib/types.ts` line 437). `dcChargeMaxKw` is a CitedValue — read via `.value`.

**Commit:** `feat(ui): inventory row 3-stat hero (OTD · range · DC kW)`

---

### Task M6: Inventory snappy polish

**File:** `src/components/InventoryTable.tsx`

Find rows / cards / buttons that lack smooth transitions. Add `transition` / `transition-colors` Tailwind classes where currently missing on hover states. Specifically check:
- Row `:hover` should have a `transition-colors duration-150` for the bg shift
- Filter buttons: ensure `transition` is on every clickable

This is cosmetic. 5-10 minute pass. Don't restructure anything.

**Commit:** `refactor(ui): smooth hover transitions on inventory + filter bar`

---

### Task M7 (only if M1-M6 finish smoothly): Charging ramp viz on inventory hover

**Premise:** Many specs have `chargingCurve: ChargingCurvePoint[]` (kW vs SoC%). The dossier already renders a full `ChargingCurveChart`. Inventory rows could surface a tiny inline sparkline.

**Approach:** Create `src/components/MiniChargingSparkline.tsx` ("use client"). Takes `chargingCurve: {socPct, kw}[]` + `dcMaxKw`. Renders a 60×16 SVG with the curve, no axes, no labels. Color the line `stroke-accent`. Render in the inventory row's model cell when curve is present, with a `title="DC charging curve — peak X kW"` tooltip.

**File for the sparkline:**
```tsx
"use client";
interface Props { curve: { socPct: number; kw: number }[]; peakKw: number; }
export function MiniChargingSparkline({ curve, peakKw }: Props) {
  if (curve.length < 2) return null;
  const w = 60, h = 16;
  const points = curve.map(p => `${(p.socPct/100)*w},${h - (p.kw/peakKw)*h}`).join(" ");
  return (
    <svg width={w} height={h} className="inline-block ml-1 align-middle" aria-hidden>
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent" />
    </svg>
  );
}
```

Render inside the model cell `<td>` next to the trim line:
```tsx
{specByUnitId?.[u.id]?.chargingCurve && (
  <MiniChargingSparkline
    curve={specByUnitId[u.id].chargingCurve!}
    peakKw={specByUnitId[u.id].dcChargeMaxKw?.value ?? 230}
  />
)}
```

**Commit:** `feat(ui): inline charging-curve sparkline on inventory rows`

---

### Task M8b: DC charging ramp viz in dossier (HIGH-physics already shipped)

**Physics shipped on high.** `src/lib/thermal.ts` exports two new functions:
- `dcChargeRamp(params)` — full minute-by-minute simulation using thermal physics:
  heat-in (I²R losses + pack heater) − heat-out (Newton's law of cooling) = pack temp delta. Returns `[{minute, kw, socPct, batteryTempC, kwhAdded}]`.
- `dcMinutesToAddKm(params, targetKm, ratedRangeKm)` — convenience: minutes to add a target distance.

**Per-vehicle thermal characteristics** added to `Spec` schema (all optional):
- `batteryThermalMassKjPerKwh` (default 10.0) — heavier packs warm/cool slower
- `heatLossCoeffKwPerC` — pack-to-ambient conduction
- `packHeaterKw` — active battery heater (E-GMP: 5.5 kW; some EVs: 0)
- `chargingArchitectureVolts` — 400 or 800 (E-GMP is 800V)
- `batteryPreconditioning` — `"manual"` | `"nav-based"` | `"auto"` | `"none"`

All 31 current E-GMP specs have these set: 800V, 10.5 kJ/°C/kWh, 5.5 kW heater, manual/nav-based per year/trim.

**Validation results** (Ioniq 5 LR RWD, 81.9 kWh, 235 kW peak with E-GMP overrides applied):

| Scenario | Model | Real-world target |
|---|---|---|
| -10°C cold-soaked, 250 kW, 10→80% | 34 min | 30-35 min ✓ |
| -10°C precon, 250 kW | 20 min | 16-22 min ✓ |
| -10°C cold, 50 kW | 69 min | 75-110 min (close) |
| -10°C just-drove 30min, 250 kW | 22 min | 18-25 min ✓ |
| +5°C cold, 250 kW | 23 min | 22-30 min ✓ |
| +25°C warm, 250 kW | 20 min | 16-22 min ✓ |
| -20°C cold, 250 kW | 48 min | 35-55 min ✓ |

7/9 within band, 2 close. Sources: Bjorn Nyland EV6/Ioniq 5 cold-charging tests; P3 Charging Index 2024-2025 cold runs; Fastned per-model database.

**Medium task — render the ramp:** create `src/components/DcChargeRampChart.tsx` ("use client", recharts). Takes `spec: Spec`, `tempC: number`, `preconditioned: boolean`, `chargerKwOptions: number[] = [50, 150, 250, 350]`. Shows a line per charger level, x-axis minutes, y-axis kW. Runs `dcChargeRamp` for each charger × precon combination.

```tsx
"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { dcChargeRamp } from "@/lib/thermal";
import type { Spec } from "@/lib/types";
import { readNumeric } from "@/lib/types";

interface Props { spec: Spec; tempC: number; preconditioned: boolean; }

export function DcChargeRampChart({ spec, tempC, preconditioned }: Props) {
  const bat = readNumeric(spec.batteryKwhUsable) ?? readNumeric(spec.batteryKwh);
  const peak = readNumeric(spec.dcChargeMaxKw);
  if (!bat || !peak) return null;

  const baseParams = {
    chargingCurve: spec.chargingCurve,
    dcPeakKw: peak,
    batteryKwh: bat,
    ambientTempC: tempC,
    preconditioned,
    batteryThermalMassKjPerKwh: spec.batteryThermalMassKjPerKwh,
    heatLossCoeffKwPerC: spec.heatLossCoeffKwPerC,
    packHeaterKw: spec.packHeaterKw,
  } as const;

  const chargers = [50, 150, 250, 350];
  const ramps = chargers.map((c) => ({
    label: `${c} kW`,
    points: dcChargeRamp({ ...baseParams, chargerMaxKw: c }),
  }));

  // Stitch into chart-friendly format: rows by minute, columns per charger
  const maxMin = Math.max(...ramps.map((r) => r.points.length));
  const data: Record<string, number | string>[] = [];
  for (let m = 0; m < maxMin; m++) {
    const row: Record<string, number | string> = { minute: m };
    for (const r of ramps) {
      const pt = r.points[m];
      if (pt) row[r.label] = pt.kw;
    }
    data.push(row);
  }

  const colors: Record<string, string> = {
    "50 kW": "#94a3b8",
    "150 kW": "#60a5fa",
    "250 kW": "#34d399",
    "350 kW": "#f59e0b",
  };

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <XAxis dataKey="minute" tick={{ fontSize: 10 }} label={{ value: "min", position: "insideBottom", offset: -2, fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} label={{ value: "kW", angle: -90, position: "insideLeft", fontSize: 10 }} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: "10px" }} />
        {ramps.map((r) => (
          <Line key={r.label} type="monotone" dataKey={r.label} stroke={colors[r.label]} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
```

Render in dossier under or near the existing `ChargingCurveChart`:
```tsx
<Section title={`DC charging ramp at ${tempC}°C (${preconditioned ? "preconditioned" : "cold-soaked"})`}>
  <p className="text-xs text-fg-muted mb-2">
    Effective charging power ramps as the battery warms. Cold-soaked vehicles take 10-20 min
    to reach peak; preconditioned arrive ready-to-go. Charger choice matters: the 50 kW line
    is flat (charger-limited); higher-power chargers warm the pack faster.
  </p>
  <DcChargeRampChart spec={spec} tempC={tempC} preconditioned={preconditioned} />
</Section>
```

**Verify:** dossier renders 4 lines (50/150/250/350 kW); cold-soaked at -10°C shows clear ramp on 250+ kW lines; preconditioned at +20°C shows flat near-peak. Predeploy clean.

**Commit:** `feat(ui): DC charging ramp chart in dossier (per-charger × precon × ambient)`

---

### Task M8: Warm-up ramp curve viz in dossier (HIGH-physics already shipped)

**Physics already shipped on high.** `src/lib/thermal.ts` exports two new functions:
- `realRangeRampKm(params)` — range at minute T of cold-soaked drive
- `realRangeRampCurve(params)` — array of `{minute, rangeKm}` sample points for plotting

Validated numbers (Ioniq 5 SE LR @ -20°C):
- t=0 cold-soaked: 267 km → preconditioned: 420 km (+57% gain)
- t=10 min: 310 → 429 (+38%)
- t=60 min: 383 → 438 (+14%)

Calibrated against Bjorn Nyland EV6 cold telemetry + Hyundai Bluelink reports.

**Medium task:** create `src/components/WarmupRampChart.tsx` ("use client", uses recharts):

```tsx
"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { realRangeRampCurve, type RealRangeParams } from "@/lib/thermal";

interface Props { params: Omit<RealRangeParams, "preconditioned" | "minutesElapsed">; tempC: number; }

export function WarmupRampChart({ params, tempC }: Props) {
  if (tempC >= 5) return null;
  const cold = realRangeRampCurve({ ...params, tempC, preconditioned: false });
  const warm = realRangeRampCurve({ ...params, tempC, preconditioned: true });
  const data = cold.map((c, i) => ({ minute: c.minute, "Cold-soaked": c.rangeKm, "Preconditioned": warm[i].rangeKm }));
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <XAxis dataKey="minute" tick={{ fontSize: 10 }} label={{ value: "min into drive", position: "insideBottom", offset: -2, fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} label={{ value: "km", angle: -90, position: "insideLeft", fontSize: 10 }} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: "10px" }} />
        <Line type="monotone" dataKey="Cold-soaked" stroke="#f87171" strokeWidth={2} dot={{ r: 2 }} />
        <Line type="monotone" dataKey="Preconditioned" stroke="#34d399" strokeWidth={2} dot={{ r: 2 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

Render in `src/app/inventory/[id]/dossier/page.tsx` as a new section under the OTD breakdown:

```tsx
{tempC < 5 && spec && (
  <Section title={`Cold-start range ramp at ${tempC}°C`}>
    <p className="text-xs text-fg-muted mb-2">
      Why a Sunday-morning short trip burns more than rated. Cold-soaked battery
      + cabin heat-up surge cost the most in the first 10-15 min, then range
      converges to steady-state. Preconditioning erases most of the early-trip penalty.
    </p>
    <WarmupRampChart params={...} tempC={tempC} />
  </Section>
)}
```

Pass `params` derived from `spec` (epaKm, batteryKwh, hasHeatPump, chemistry, heatPumpMinEffectiveC) — same extraction pattern as `WinterRangeChip`.

**Verify:** dossier renders the chart at temps below 5°C; predeploy clean.
**Commit:** `feat(ui): warm-up ramp chart in dossier — first-10-min cold-start penalty viz`

---

### Task M9: Trip planner — algorithm shipped (high), UI deferred to high session

**High-tier algorithm spec (don't implement yet — needs OSRM integration):**

Inputs: `start: {lat,lng}`, `dest: {lat,lng}`, `unit: ScoredUnit`, `tempC`, `preconditioned: boolean`, `targetArrivalSocPct: number = 20`.

Algorithm:
1. Call OSRM `/route` with start + dest → get `totalDistanceKm`, `polyline`
2. Compute usable range at given temp:
   `rangeKm = realRangeKm({ ...specToParams(unit.spec), tempC, preconditioned })`
3. Available range with safety margin:
   `usableRangeKm = rangeKm * (1 - targetArrivalSocPct/100)` (e.g., arrive at 20% SoC)
4. If `totalDistanceKm <= usableRangeKm`: return `[{leg: 0→dest}]` (no charging)
5. Else find charge stops:
   a. Stop locations should be at ~70-80% of `usableRangeKm` from prior position to leave a safety buffer
   b. Use OCM API or `data/dcfc_stations.json` (15 stations bundled) to find stations within 10 km of the polyline at each target distance
   c. Pick the station with highest `peakKw` matching the unit's port type
   d. Estimate charge time: integrate `unit.spec.chargingCurve` from arrival SoC to ~80% SoC
6. Output: `{legs: [{from, to, km, arrivalSocPct}], stops: [{station, chargeMinutes, kwAdded}], totalTimeMin}`

**Required additions:**
- `src/lib/tripPlanner.ts` — algorithm
- `src/lib/osrm.ts` — fetch wrapper
- `src/components/TripPlanner.tsx` — UI (route input, map render)
- `src/app/trip/page.tsx` — new route

**Recommended punt:** algorithm is straightforward but UI + map integration is ~25k of work. Defer until after the buying decision unless user explicitly prioritizes. The algorithm spec above is sufficient for a future medium session to implement directly.

---

### Task M10: Tauri migration — cookie → localStorage audit (HIGH already done)

**Cookie touchpoints inventoried:**

Server-side reads (5 routes — all call `getBuyerContext()`):
- `src/app/page.tsx:16`
- `src/app/inventory/page.tsx:28`
- `src/app/dealer/[id]/page.tsx:19`
- `src/app/compare/page.tsx:12`
- `src/app/inventory/[id]/dossier/page.tsx:43`

Server cookie machinery:
- `src/lib/buyerContextServer.ts` — uses `cookies()` from `next/headers`

Client-side state machinery:
- `src/lib/buyerContext.ts` — `useBuyerContext()` hook reads/writes `document.cookie`
- `src/components/BuyerContextSelector.tsx` — only consumer

**Migration strategy for Tauri (Option A — static export + client-only state):**

Tauri's webview cannot use Next.js server components or `next/headers`. Migration recipe:

1. **Convert affected routes to client-rendered:**
   - Add `"use client";` to top of all 5 route files
   - Replace `await getBuyerContext()` with `useEffect` reading `localStorage` (or use a Zustand store)
   - Remove `await loadScoredUnits(buyerContext)` server call; load JSON via static import + recompute client-side
   - This requires moving `computeOtd` / `applicableIncentives` calls to client (they're already pure functions — should work)

2. **Replace `buyerContextServer.ts`:**
   - Delete the file
   - Add `getBuyerContextClient()` that reads `localStorage["buyer-context"]` with the same Zod parse logic
   - Update `useBuyerContext()` to write to `localStorage` instead of `document.cookie`

3. **Static export config:**
   - `next.config.mjs`: add `output: 'export'`
   - Remove `export const dynamic = "force-dynamic"` from all routes (incompatible with static export)
   - All `searchParams` reads stay client-side via `useSearchParams()`

4. **Tauri shell:**
   - `npm install @tauri-apps/cli @tauri-apps/api`
   - `npx tauri init` — creates `src-tauri/`
   - Configure `tauri.conf.json` to point at the static export output
   - `npm run build && npx tauri build` produces a signed `.app`

**Token estimate:** ~50k medium for the full migration. Schema-wise nothing breaks; pure function calls move from server to client.

**Recommended punt:** defer until post-purchase. The web app at the Vercel preview URL works fine for the buying decision. Tauri is a polish item.

---

### Task M11: Battery supplier + cell chemistry verification per spec (research)

**Why this matters:** thermal accuracy depends on the actual cell chemistry. Hyundai/Kia E-GMP currently uses SK On NCM811 (8:1:1 nickel-cobalt-manganese ratio) on most trims, but specific trim/year/region combinations may differ:

- Some 2024+ EV9 trims reportedly use SK On NCM712 (lower nickel for cost)
- Future Hyundai/Kia models may add LG Energy Solution or CATL as second source
- LFP cells (lower energy density, much better cold tolerance) may appear on entry-level trims

The thermal model's `CAPACITY_CURVES` already has separate LFP / NMC / NCA / LMR curves. Currently all 31 specs are tagged `NMC` — accurate for the broad chemistry family but not the specific cell variant.

**Medium task:**

1. Add two optional fields to `SpecSchema` in `src/lib/types.ts`:
   ```ts
   batterySupplier: z.enum(["SK_On", "LGES", "CATL", "Samsung_SDI", "Panasonic", "BYD", "UNKNOWN"]).optional(),
   cellChemistryDetail: z.string().optional(), // e.g., "NCM811", "NCM712", "LFP-LFP280", "NCA"
   ```

2. For each of the 31 specs in `data/specs.json`, research the actual cell supplier + chemistry detail. Sources:
   - Hyundai/Kia press releases (model launch announcements)
   - SK On / LG Energy Solution / CATL press releases
   - EV-Database.org (detailed per-trim specs)
   - InsideEVs / Battery University deep-dives
   - Hyundai service training documents (often surface specific cell info)

3. Cite the source URL + date accessed in spec entry.

4. If chemistry detail differs from NMC family (e.g., LFP appears), update `batteryChemistry` field accordingly. The thermal model picks the right capacity curve automatically.

**Token budget:** ~15k medium (research + per-spec edits + commit).

**Don't proceed if:** sources can't confirm at High confidence — leave as Medium with a note. Don't guess.

---

### Task M12: Battery preconditioning capability data per spec

**Quick note alongside M11.** All 31 specs currently have `batteryPreconditioning` set heuristically based on year + trim. Real per-trim data should be verified:

- Pre-2024 Hyundai/Kia: manual button only
- 2024+ models with nav: nav-based (auto-precondition when destination is fast charger entered into nav)
- Some markets/regions enabled it later than others

Source: Hyundai/Kia owner's manuals, software-update notes, model-year change documents.

**Token budget:** ~5k medium (read 5-10 owner's manual snippets, update 31 specs).

---

## Discipline rules for medium tier (binding)

1. **Verify before claim.** Every "predeploy clean" / "pushed" claim must be backed by an actually-run check.
2. **`npm run predeploy` after every functional change.** Now runs typecheck + thermal-audit + build. All three must pass.
3. **One Bash chain, not three.** `git add -A && git commit -m "…" && git push origin HEAD` is ONE call.
4. **Caveman in chat.** Drop articles, filler. Code stays normal English.
5. **No subagents.** All M-tasks are <10k tokens of work. Direct execution.
6. **No spec edits without source.** If a thermal value changes, queue source must back it. Validator will reject silent changes.
7. **Edit > Write.** Only Write for new files (M3 CompareWinnerBar, M7 MiniChargingSparkline).
8. **Read absolute paths.** Cwd resets to wrong folder after every Bash; always `cd ~/ev-auto-trader-canada &&`.
9. **Branch lock.** `claude/verify-environment-setup-oTu3S`. No `main`. No `--no-verify`. No force-push.
10. **Stop and ask if blocked.** Don't escalate to high tier internally — surface to user.

## Stop conditions (halt + ping user)

- Predeploy fails twice in a row on the same task
- Thermal audit returns ERROR (means a spec edit broke physical plausibility)
- Tests would require >10k tokens of new work
- About to write outside `~/ev-auto-trader-canada/`
- About to push to `main`
- Any subagent dispatch impulse

---

## Math validation surfaces (now permanent)

- `npm run thermal-audit` — runs anytime, validates 31 specs across all temperature bands
- `npm run predeploy` — gates every commit
- `data/heatpump-research-queue.json` — source-of-truth for heat-pump bool + cutoff per spec; merge via `scripts/merge_heatpump_research.py`
- `data/specs.json` is the consumer; never hand-edit thermal fields, run merge script

If a future spec is added (e.g., expanding to Tesla/VW/Polestar):
1. Add to specs.json with full thermal fields (chemistry, hasHeatPump, heatPumpMinEffectiveC if applicable)
2. Run `npm run thermal-audit`
3. If audit fails, re-verify the source data before forcing through

The bands ARE permissive enough to accept Tesla NCA, MEB NMC, BMW NMC, Lucid NCA, Polestar NMC. LFP vehicles will produce lower retention numbers but still pass since the LFP capacity curve is calibrated.

---

## Out of scope (future high-tier work)

| Item | Why deferred | Token budget |
|---|---|---|
| Warm-up ramp curve (per-vehicle range over first 10-30 min from cold-soaked) | Needs physics decision: model first-segment HVAC peak vs averaged trip. Visualize as inline ramp chart in dossier? | ~15k high + 10k medium |
| Full charging-curve overlay on dossier deal-paths | ChargingCurveChart already in dossier; could expose interactivity (hover to see kW at SoC) | ~10k medium |
| O3: Snapshot retention pruning | Defer until disk pressure | ~5k medium |
| F8: Trip planner (OSRM + charge stops) | Major feature, separate plan | ~25k mixed |
| Tauri standalone wrap | Post-purchase. Main blocker = cookie → localStorage migration for `getBuyerContext()` | ~30k high + 50k medium |
| Federal luxury tax application | Irrelevant for current Hyundai/Kia EV scope (max ~$80k) | ~5k medium when scope expands |
| Tesla / VW / Polestar / Lucid / Genesis spec port | Buying scope is currently Hyundai/Kia only | ~20k medium per brand |

---

## Final notes for medium

- The thermal model is now **architecturally complete**. Any future spec that adheres to the schema + passes `npm run thermal-audit` will produce accurate range estimates across the full -40 to +40°C slider range. No new physics code needs to be written for new makes/models.
- If user asks "is the range accurate for X vehicle?" → run `python3 scripts/validate_thermal_specs.py` and check the output. If pass, the model is producing physics-plausible numbers.
- If user asks for a new feature, scan this doc + `MEDIUM_HANDOFF_UI_2026-05-03.md` first to see if it's already queued.
- HEAD will move; refer to `git log --oneline -10` for current state, not memorized SHAs.
