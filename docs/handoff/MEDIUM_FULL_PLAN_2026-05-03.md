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
