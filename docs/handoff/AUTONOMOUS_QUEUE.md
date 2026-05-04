# AUTONOMOUS_QUEUE — pre-staged tasks for after the main TODO_INDEX queue empties

> **Read order:** finish `TODO_INDEX_2026-05-04.md` first (dock badge,
> Kijiji, Leasebusters). Then this. Then `AUTONOMOUS_MODE.md` for
> when this list also runs dry.
>
> **Each task here is concrete enough to ship without further planning.**
> File paths, expected diffs, test commands, token estimates. Pick any
> in any order — they're independent.

## How to use this list

1. Pick the highest unblocked item that fits your token budget.
2. Mark it in-progress in TodoWrite.
3. Execute exactly as described.
4. Run the verification command.
5. If pass: commit + push, append a `- [x] <id>: <commit-sha>` to this
   file, move to next.
6. If fail: revert, append `- [blocked] <id>: <reason>`, move on.

## Tier 2 — Quality wins (mechanical, ~3-8k each)

### Q1. Add `data-unit-id` attribute to inventory rows

**Files:** `src/components/InventoryTable.tsx`
**Why:** enables future Vitest / Playwright tests + makes Claude Preview
`preview_click` selectors stable.
**Diff:** find the `<tr>` row in InventoryTable that maps over units. Add
`data-unit-id={unit.id}`.
**Verify:**
```bash
npm run dev &
sleep 4
curl -s http://localhost:3000/inventory | grep -c 'data-unit-id="u-at-' # expect 100
```
**Tokens:** ~2k

---

### Q2. aria-label on icon-only buttons

**Files:** `src/components/RefreshButton.tsx`, `UnitVerifyChip.tsx`,
`CrossSourceChip.tsx`, `UnitPhotoGallery.tsx`
**Why:** a11y. Mac VoiceOver currently announces "button" without context.
**Diff:** add `aria-label="Refresh inventory"`, `aria-label="Verify availability"`,
`aria-label="Cross-source listings"`, `aria-label="Open photo gallery"`.
**Verify:** `grep -c "aria-label" src/components/*.tsx` — count goes up by 4.
**Tokens:** ~2k

---

### Q3. Console-log audit

**Files:** any with `console.log` left over from debug
**Why:** keeps the WebView console clean for real errors.
**Steps:**
```bash
cd ~/ev-auto-trader-canada
grep -rn "console\.log\|console\.debug" src/ | grep -v ".test."
```
For each line: either remove (if dev-only debug) or upgrade to
`console.warn` (if useful operational signal). Keep `console.warn` and
`console.error`.
**Verify:** count drops to 0 (or only intentional warns/errors remain).
**Tokens:** ~3k

---

### Q4. Dead-export sweep

**Files:** any in `src/`
**Why:** smaller bundles + clearer module boundaries.
**Steps:**
```bash
cd ~/ev-auto-trader-canada
# List all top-level exports
grep -rn "^export " src/ | grep -v ".test." > /tmp/all-exports.txt
# For each, check if anything imports it
while IFS= read -r line; do
  file=$(echo "$line" | cut -d: -f1)
  symbol=$(echo "$line" | grep -oE 'export (function|const|let|var|class|type|interface|default) [a-zA-Z_][a-zA-Z0-9_]*' | awk '{print $NF}')
  if [ -n "$symbol" ]; then
    count=$(grep -rn "import.*\b$symbol\b" src/ --include='*.ts' --include='*.tsx' | grep -v "$file" | wc -l)
    if [ "$count" -eq 0 ]; then
      echo "DEAD: $file -> $symbol"
    fi
  fi
done < /tmp/all-exports.txt
```
For each DEAD entry: remove or mark `@internal`. Skip Zod schemas (they
may be referenced via type-only imports the grep misses).
**Verify:** `npm run predeploy` clean after each removal.
**Tokens:** ~5k

---

### Q5. Bundle-size audit

**Why:** identify dynamic-import candidates.
**Steps:**
```bash
cd ~/ev-auto-trader-canada
BUILD_TARGET=tauri npm run build:tauri:web
du -sh out/_next/static/chunks/*.js | sort -h | tail -10 > /tmp/big-chunks.txt
cat /tmp/big-chunks.txt
```
Document findings in `docs/handoff/BUNDLE_AUDIT_<date>.md`. Identify top
3 chunks > 200KB. Pick one and dynamic-import its consumer.
**Tokens:** ~5k for audit, ~5k per dynamic-import migration

---

## Tier 3 — UX polish (~3-10k each)

### U1. Keyboard shortcuts on dossier

**Files:** `src/app/inventory/[id]/dossier/page.tsx` (add a hooks file:
`src/lib/useKeyboardShortcuts.ts`)
**Diff:** add a `useEffect` that listens for keydown:
- `←` → router.push to prev unit
- `→` → router.push to next unit
- `c` → copy dealer phone via Clipboard API
- `Escape` → router.back()

For prev/next, sort all unit IDs and pick neighbor. ScoredUnit ordering
already deterministic.

**Verify:** open a dossier, press →, route changes to next unit's dossier.
**Tokens:** ~5k

---

### U2. CrossSourceChip empty-state hint

**Files:** `src/components/CrossSourceChip.tsx`
**Why:** users don't know if "no chip" means "no match found" vs "not
yet checked." Add a faint "—" with tooltip when no cross-listing exists
but data was scraped recently.
**Diff:** when `cross == null`, render `<span title="No cross-source matches">·</span>`
in muted color (use the existing `text-fg-subtle` class). Hide entirely
if no scrape has run yet (check meta-static.json's last cross-source
update timestamp).
**Verify:** view inventory; rows without cross-listings show the dot,
hover reveals tooltip.
**Tokens:** ~3k

---

### U3. Print stylesheet polish

**Files:** `src/app/inventory/[id]/dossier/page.tsx` + a new
`src/app/inventory/[id]/dossier/print.css` (or a `@media print` block in
the existing CSS).
**Why:** dossier looks fine on screen but prints with weird page breaks.
**Diff:** add `@media print { ... }` rules:
- hide nav, refresh button, cross-source chip
- force chart containers to `print-color-adjust: exact`
- `page-break-inside: avoid` on big sections
- larger base font for paper readability

**Verify:** `Cmd+P` from Tauri app → preview shows clean 1-2 page layout.
**Tokens:** ~3k

---

### U4. Native menu bar (macOS)

**Files:** `src-tauri/src/lib.rs` — add a `tauri::menu::Menu` definition
**Why:** native Cmd+R = run_refresh, Cmd+P = print, Cmd+W = close.
**Diff:** in `setup` closure, build a Menu via tauri::menu API, set as
window menu. Wire `Cmd+R` to `run_refresh`, `Cmd+P` to `webview.print()`.
**Verify:** menu bar appears with EV.trader CA / File / Edit / View / Window / Help.
**Tokens:** ~6k

---

### U5. URL-encoded inventory filters

**Files:** `src/app/inventory/page.tsx` and `InventoryTable` filter chips
**Why:** so `?make=Hyundai&model=Ioniq+5&tempC=-15` is bookmarkable.
**Diff:** audit each filter chip — does its state live in URL or only
React state? If only React, push to URL via useRouter().
**Verify:** apply 3 filters, copy URL, paste in a new tab → same filters applied.
**Tokens:** ~5k

---

### U6. Compare-tray Tauri persistence test

**Files:** `src/store/picker.ts` — verify Zustand persist works in Tauri
**Why:** localStorage in WKWebView app data dir survives relaunch.
**Steps:**
1. Open the .app
2. Add 3 units to compare tray
3. Quit Tauri (Cmd+Q)
4. Relaunch
5. Tray should still show those 3 units
If broken: check Zustand persist storage adapter, may need IndexedDB
fallback for WKWebView edge cases.
**Tokens:** ~2k for verification, ~5k if fix needed

---

## Tier 4 — Testing infra (~10-20k each)

### T1. Vitest install + thermal model tests

**Files:** `package.json`, new `src/lib/thermal.test.ts`,
`vitest.config.ts`
**Steps:**
```bash
cd ~/ev-auto-trader-canada
npm install --save-dev vitest @vitest/ui
```
Add to package.json scripts:
```json
"test": "vitest",
"test:run": "vitest run"
```
Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "path";
export default defineConfig({
  test: { globals: true, environment: "node" },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
```
Create `src/lib/thermal.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { realRangeKm } from "./thermal";  // adjust import to actual export

describe("thermal model", () => {
  const ioniq5 = {  // approximate stub matching Spec shape
    rangeEpaKm: 488,
    batteryKwh: 84,
    hasHeatPump: true,
    consumptionKwhPer100km: 17.2,
  };

  it("at 20°C: ~95% of EPA range", () => {
    expect(realRangeKm(ioniq5, 20)).toBeGreaterThan(440);
    expect(realRangeKm(ioniq5, 20)).toBeLessThan(500);
  });

  it("at -10°C: ~70% of EPA range with heat pump", () => {
    expect(realRangeKm(ioniq5, -10)).toBeGreaterThan(300);
    expect(realRangeKm(ioniq5, -10)).toBeLessThan(380);
  });

  it("at -20°C: < 65% of EPA range even with heat pump", () => {
    expect(realRangeKm(ioniq5, -20)).toBeLessThan(330);
  });

  it("no heat pump degrades cold-weather range further", () => {
    const noHP = { ...ioniq5, hasHeatPump: false };
    expect(realRangeKm(noHP, -10)).toBeLessThan(realRangeKm(ioniq5, -10));
  });
});
```
**Verify:** `npm test -- --run` exit=0
**Tokens:** ~10k

---

### T2. Vitest scoring + crossListings tests

**Files:** new `src/lib/scoring.test.ts`, `src/lib/crossListings.test.ts`
**Diff:** import `computeOtd`, `applicableIncentives`, `cheapestCash`,
`leaseTakeover`. Use known fixtures from data files. Snapshot key outputs.
**Verify:** `npm test -- --run` clean.
**Tokens:** ~10k

---

### T3. Schema-drift catcher

**Files:** new `scripts/validate_data_schemas.py`
**Why:** cron mutates data/*.json nightly. If a field type drifts, the
React app fails at parse time, not at refresh time.
**Diff:** Python script that imports each JSON file and validates against
the matching Zod schema (extract via simple TS-to-Python schema lift, or
write parallel Python validators). Run as part of `predeploy`.
**Verify:** intentionally break a record (e.g., `dealerAskingPrice: "fifty"`),
re-run script, expect exit ≠ 0.
**Tokens:** ~12k

---

## Tier 5 — Documentation (~3-8k each)

### D1. JSDoc on `src/lib/types.ts` exports

**Files:** `src/lib/types.ts`
**Diff:** add 1-line `/** */` above each exported Zod schema describing
what it represents and where it's used.
**Verify:** `grep -c "/\*\*" src/lib/types.ts` ≥ 10
**Tokens:** ~3k

---

### D2. Architecture diagram

**Files:** new `docs/ARCHITECTURE.md`
**Diff:** ASCII tree of: routes → page components → child components →
hooks → libs → data files → Tauri commands. Identify Phase A/B/C/D layer
each piece belongs to.
**Verify:** humans can read top-to-bottom and understand data flow.
**Tokens:** ~5k

---

### D3. Component README per > 200-line component

**Files:** one `<Name>.md` adjacent to each big component
**Why:** entry point for next session understanding what the component owns.
**Diff:** 5-line summary: what it renders, key props, state it owns,
what it depends on, what depends on it.
**Verify:** ≥ 3 README files exist next to InventoryTable, dossier
page.tsx, and CompareTray.
**Tokens:** ~6k

---

## Tier 6 — Speculative / wait for user (DO NOT auto-execute)

These are big enough to need explicit user approval.

- **D-bis: Hyundai Click-to-Buy + Kia D2C Media** (~95k)
- **Phase E: OEM dealer API direct** (~60-80k)
- **Tauri sidecar Rust IPC for Imperva-bypass fetch** (~25k)
- **Custom domain on Vercel** (~5k but config change, needs DNS access)
- **Mobile responsive pass** (~30k, biggest UX shift)
- **Add Apify scraper for AutoTrader** (paid; budget-gated)

If you spot one of these is needed mid-loop: append to this file under a
`### Discovered (waiting for user)` section, with a one-paragraph
why-now context.

## Done log

Track shipped items here so the next session knows what's left.

- [ ] Q1: data-unit-id
- [ ] Q2: aria-label
- [ ] Q3: console-log audit
- [ ] Q4: dead-export sweep
- [ ] Q5: bundle-size audit
- [ ] U1: keyboard shortcuts
- [ ] U2: CrossSourceChip empty state
- [ ] U3: print stylesheet
- [ ] U4: native menu bar
- [ ] U5: URL-encoded filters
- [ ] U6: compare-tray persistence test
- [ ] T1: Vitest + thermal tests
- [ ] T2: Vitest scoring + crossListings tests
- [ ] T3: schema-drift catcher
- [ ] D1: JSDoc on types
- [ ] D2: architecture diagram
- [ ] D3: component READMEs

After all 17 ship: re-prime via `AUTONOMOUS_MODE.md` § "When the ladder
is exhausted (it never really is)" — re-grep TODO/FIXME, walk routes
again, refresh stale data, etc.
