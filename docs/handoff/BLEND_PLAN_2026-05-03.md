# BLEND PLAN — sibling EV dashboard → ev-auto-trader-canada (2026-05-03)

> Drafted on extra-high reasoning. Medium-tier executes. This doc is the
> source of truth for the merge — read top to bottom before dispatching
> any subagent. Update as phases ship.

## Why merge, not coexist

User has two repos solving adjacent problems:

- `~/ev-auto-trader-canada/` — pick-a-listing layer. 100 live AutoTrader.ca units, dealer pages, 3-path OTD, dossier per unit. Now deployed to Vercel (HEAD `84de1a68`, both branches).
- `~/Documents/Claude/Projects/EV dashboard/` — pick-a-model layer. 37 vehicles × 16 brands, thermal physics, charging curves, DCFC map, mom mode, iZEV wizard, battery degradation. Vite + Tauri. Locally only.

User intent (2026-05-03): unify both into one app, eventually its own
brand. Inevitably wrap in Tauri for Mac-native. Today: blend the data +
core derivations + UI patterns into ev-auto-trader-canada (the host),
deploy preview, validate. Deferred: Tauri shell migration + repo rename.

## Strategic decisions baked in

1. **Host = ev-auto-trader-canada.** Already on Vercel. Don't break momentum. Sibling's React tree ports cleanly into Next App Router via Server-Components-friendly refactors (most sibling components are already client-components).
2. **Blend, don't rewrite.** Lift sibling's `src/lib/*.ts` verbatim where possible. Adapt only at the data-shape boundary (sibling Vehicle ↔ our Spec).
3. **CitedValue spreads everywhere.** Adopting sibling's `CitedValue<T>` shape promotes our specs.json to provenance-tagged. This is cheap (additive) and unlocks confidence-tagged UI.
4. **Tauri-wrap is Phase Z, not Phase F.** Sibling's `src-tauri/` shell will copy into the merged repo when user is ready. Cookies → localStorage migration is the only real concern (BuyerContext currently uses cookies; that's the one architectural item to address before Tauri-wrap).
5. **Repo rename = Phase Z+1.** When merged scope outgrows the "auto-trader" name, `git mv` the repo + update Vercel project. Deferred until Tauri lands.
6. **Sibling repo stays read-only during merge.** No `cd` into it. Read tool with absolute path = surgical access. Never write back.

## File-by-file port catalogue (verified 2026-05-03)

### Sibling lib (port verbatim or with thin adapter)

| Sibling path | New path in our repo | Adapter needed? |
|---|---|---|
| `src/lib/thermal.ts` | `src/lib/thermal.ts` | No — pure TS |
| `src/lib/thermal.test.ts` | `src/lib/thermal.test.ts` | No — assertions |
| `src/lib/format.ts` | merge into our existing — keep ours, cherry-pick missing helpers | Yes (merge) |
| `src/lib/plainLang.ts` | `src/lib/plainLang.ts` | No |
| `src/lib/battery_degradation.ts` | `src/lib/battery_degradation.ts` | No |
| `src/lib/charge_plan.ts` | `src/lib/charge_plan.ts` | No |
| `src/lib/ocm.ts` | `src/lib/ocm.ts` | Yes — env var name `VITE_OCM_KEY` → `NEXT_PUBLIC_OCM_KEY` |
| `src/lib/osrm.ts` | `src/lib/osrm.ts` | No |
| `src/lib/debugLog.ts` | `src/lib/debugLog.ts` | No |

### Sibling components (port with Next.js client-component directive)

| Sibling component | New path | Notes |
|---|---|---|
| `BrandList.tsx` | `src/components/BrandList.tsx` | Used on `/pick-a-model` |
| `FilterBar.tsx` | `src/components/PickerFilterBar.tsx` | Renamed to disambiguate from inventory filters |
| `VehicleRow.tsx` | `src/components/PickerVehicleRow.tsx` | Renamed |
| `CompareTray.tsx` | `src/components/CompareTray.tsx` | Replaces ad-hoc compare in our /compare |
| `CompareView.tsx` | `src/components/CompareView.tsx` | Used inside our /compare page |
| `ConfidenceBadge.tsx` | `src/components/ConfidenceBadge.tsx` | Renders CitedValue confidence |
| `TempSlider.tsx` | `src/components/TempSlider.tsx` | Rendered in /inventory page level |
| `ChargingCurveChart.tsx` | `src/components/ChargingCurveChart.tsx` | Dossier integration |
| `ChargePlanPanel.tsx` | `src/components/ChargePlanPanel.tsx` | New /trip page (Phase F8) |
| `MapPanel.tsx` | `src/components/MapPanel.tsx` | /map + dealer pages |
| `DataHealth.tsx` | `src/components/DataHealth.tsx` | /intel page augment |
| `DebugPanel.tsx` | `src/components/DebugPanel.tsx` | Dev-only, /debug route |
| `UsedListings.tsx` | merge with our `usedListingsLinks.ts` — keep ours | Skip — we have it |

### Sibling data (port + reshape)

| Sibling path | What to do |
|---|---|
| `src/data/seed.json` (4170 lines, 37 vehicles) | Reshape into our `data/specs.json` schema with CitedValue preserved. Currently we have 27 hand-curated entries; merge so new entries fill gaps + existing entries gain CitedValue provenance |
| `src/data/dcfc_stations.json` | Copy as-is to `data/dcfc_stations.json` — fallback when OCM key absent |
| `src/data/new_vehicles.json` | Inspect — likely a queue of vehicles to research. May port to our `heatpump-research-queue.json` style |

### Sibling routes (no app/ dir; map to our App Router)

Sibling is single-page (Vite). Its functionality lives inside `src/App.tsx` + components. We map functionality → our existing or new routes:

| Sibling functionality | Our route |
|---|---|
| Brand list + filter + compare flow | NEW `/pick-a-model/page.tsx` |
| Temperature slider | Top of `/inventory/page.tsx` (page-level filter) |
| Compare tray | augments existing `/compare/page.tsx` |
| Charging curve panel | inside `/inventory/[id]/dossier/page.tsx` |
| DCFC map | inside `/map/page.tsx` (currently mostly empty) |
| Trip planner | NEW `/trip/page.tsx` (Phase F8) |
| Debug panel | NEW `/debug/page.tsx` (Phase F9, dev-only) |

## Schema changes (do once, all phases consume)

**`src/lib/types.ts` augmentation:**

```ts
// ADDITIVE — no existing field changes
export type CitedValue<T> = {
  value: T | null;
  source?: { url: string; name: string; accessed: string };
  confidence: "High" | "Medium" | "Low";
  notes?: string;
};

export type ChargingCurvePoint = { socPct: number; powerKw: number };

export type ThermalProfile = {
  hasHeatPump: CitedValue<boolean>;
  heatPumpCutoffC?: CitedValue<number>;
  // ...other fields per sibling shape
};

export interface Spec {
  // existing fields preserved
  model: string;
  year: number;
  trim: string;
  drivetrain: string;
  hasHeatPump?: boolean | null;
  // NEW fields (all optional — back-compat)
  batteryKwh?: CitedValue<number>;
  rangeEpaKm?: CitedValue<number>;
  motorPowerKw?: CitedValue<number>;
  acceleration0To100s?: CitedValue<number>;
  dcChargeMaxKw?: CitedValue<number>;
  dcCharge10to80MinNominal?: CitedValue<number>;
  acChargeMaxKw?: CitedValue<number>;
  weightKg?: CitedValue<number>;
  cargoLitres?: CitedValue<number>;
  dragCoefficient?: CitedValue<number>;
  thermalProfile?: ThermalProfile;
  chargingCurve?: ChargingCurvePoint[];
}
```

ScoredUnit gets no new stored fields. Thermal range / charge time are
derived at render time from `spec + temperatureC`.

## Phases

### Phase F1 — Specs port (Sonnet, ~30k tokens)

**Goal.** Lift sibling `src/data/seed.json` into our `data/specs.json` schema. Add CitedValue provenance. Cover 37 vehicles total (currently 27 entries).

**Files modified.**
- `src/lib/types.ts` — add CitedValue, ChargingCurvePoint, ThermalProfile, augment Spec
- `data/specs.json` — rewrite with merged + reshaped entries

**Verify.**
- `loadScoredUnits` resolves all 100 unit→spec joins (current state: 97/100; F1 must not regress)
- `npm run predeploy` clean
- `jq '[.[] | select(.batteryKwh != null)] | length' data/specs.json` ≥ 27

**Files NOT touched.** No component edits. No incentives.json touch. Pure data + types.

### Phase F2 — Thermal model + winter-range chip (Sonnet, ~15k tokens)

**Goal.** Surface real-world cold-weather range per row. Single biggest UX win for ON winter buyers.

**Files modified.**
- `src/lib/thermal.ts` — port verbatim from sibling
- `src/lib/thermal.test.ts` — port verbatim
- `src/components/TempSlider.tsx` — port + adapt for Next client component
- `src/store/temperature.ts` (NEW) — Zustand store for temperature filter (single source for /inventory + dossier)
- `src/app/inventory/page.tsx` — render `<TempSlider />` above the table
- `src/components/InventoryTable.tsx` — add winter-range chip per row at the chip area near HeatPumpChip

**Chip behaviour:**

```
@ +20°C: 488 km  (no chip — default)
@ -10°C: 372 km  (chip: 🌡 −10°C: 372 km, blue)
@ -20°C: 312 km  (chip: 🥶 −20°C: 312 km, red)
```

**Verify.**
- Slider visible at top of /inventory; flipping temp re-renders chip values
- `thermal.test.ts` runs (assertions against published curves)
- npm run predeploy clean

**File-collision note.** F2 owns InventoryTable. F3 must NOT touch it.

### Phase F3 — Mom-mode plain-language pass (Sonnet, ~10k tokens)

**Goal.** Hover tooltips on every jargon term so Mom (secondary user) can read the dashboard without a glossary.

**Files modified.**
- `src/lib/plainLang.ts` — port from sibling, extend with our terms (OTD, freight & PDI, money factor, residualPercent, capCost, etc.)
- `src/components/UnitDrawer.tsx` — wrap labels in `<span title={plainLang(term)}>`
- `src/app/inventory/[id]/dossier/page.tsx` — same
- `src/app/compare/page.tsx` — same
- `src/components/BuyerContextSelector.tsx` — same

**File-collision note.** F3 must NOT touch InventoryTable (F2 owns it). InventoryTable plain-language work happens in Phase G via separate dispatch.

**Verify.**
- Hover any column header / label → tooltip appears
- npm run predeploy clean

### Phase F4 — Charging curve overlay (Sonnet, ~12k tokens)

**Goal.** Dossier shows DCFC time 10→80% per unit, plus a curve plot.

**Files modified.**
- `src/components/ChargingCurveChart.tsx` — port from sibling
- `src/app/inventory/[id]/dossier/page.tsx` — render under tabs

**Depends on.** F1 (chargingCurve field on Spec).

**Verify.**
- Open `/inventory/u-at-bdbc6d9d/dossier` (Ioniq5 LR) — curve renders, "10→80%: 18 min" badge visible

### Phase F5 — `/pick-a-model` page (Sonnet, ~25k tokens)

**Goal.** New top-of-funnel page where Ian picks a model BEFORE diving into 100 listings.

**Files modified.**
- `src/app/pick-a-model/page.tsx` (NEW) — server component, loads specs + minimal listing-availability ("12 listings on AutoTrader.ca")
- `src/components/BrandList.tsx`, `PickerFilterBar.tsx`, `PickerVehicleRow.tsx` (NEW, ports from sibling) — client components
- `src/store/picker.ts` (NEW) — Zustand: filter state + compare tray
- "Pick this model" button → navigates to `/inventory?make=X&model=Y&trim=Z`
- `src/app/inventory/page.tsx` — accept query params for prefilter

**Verify.**
- Open `/pick-a-model` — 37 vehicle library renders by brand
- Filter (e.g., range > 400 km AND DCFC > 200 kW) — list narrows
- Click Ioniq5 LR → drops on `/inventory?...` filtered view

### Phase F6 — Battery degradation projection (Sonnet, ~8k tokens)

**Goal.** Resale-risk panel in dossier: "Year 3: 462 km (5% degradation). Year 5: 444 km (9%)."

**Files modified.**
- `src/lib/battery_degradation.ts` — port verbatim
- `src/app/inventory/[id]/dossier/page.tsx` — add panel

### Phase F7 — DCFC pin map (Sonnet, ~20k tokens)

**Goal.** /map page becomes useful: dealer pins + DCFC pins + driving radius from buyer location.

**Files modified.**
- `src/lib/ocm.ts` — port + swap env var name
- `src/components/MapPanel.tsx` — port (Leaflet + OSM tiles, no API key)
- `src/app/map/page.tsx` — rewrite to render MapPanel
- `src/app/dealer/[id]/page.tsx` — add "Nearby DCFC" subsection

**User action needed.** Set `NEXT_PUBLIC_OCM_KEY` in Vercel env vars. Falls back to bundled `data/dcfc_stations.json` (15 demo pins) when unset.

### Phase F8 — Trip planner (Sonnet, ~25k tokens, optional)

**Goal.** Plan a road trip with a chosen unit; compute charge stops along the route.

**Files modified.**
- `src/lib/osrm.ts`, `src/lib/charge_plan.ts` — port
- `src/components/ChargePlanPanel.tsx` — port
- `src/app/trip/page.tsx` (NEW)

**Skip if scope-tight.** Personal-use, low-frequency feature.

### Phase F9 — Debug telemetry (Sonnet, ~5k tokens, dev-only)

**Goal.** Ring buffer of telemetry events, surfaced at /debug.

**Files modified.**
- `src/lib/debugLog.ts`, `src/components/DebugPanel.tsx` — port
- `src/app/debug/page.tsx` — gate behind `process.env.NODE_ENV === "development"`

### Phase F10 — Mom-mode for InventoryTable (Sonnet, ~5k tokens)

**Goal.** Apply F3's plainLang to InventoryTable headers + chip tooltips. Deferred from F3 to avoid file collision with F2.

### Phase G — iZEV wizard inline (Sonnet, ~5k tokens)

**Goal.** Small explainer: "Federal iZEV: $0 today (program paused). Provincial: ON $0, BC $4,000 (PHEV only), QC $7,000."

**Files modified.**
- `src/components/IzevExplainer.tsx` (NEW)
- `src/components/BuyerContextSelector.tsx` — link to explainer

### Phase Z — Tauri-wrap (deferred, multi-day)

When user wants Mac-native:
1. Cookies → localStorage migration (BuyerContext is the one persistent client state)
2. Copy sibling `src-tauri/` directory + `Cargo.toml` + `tauri.conf.json` into our repo
3. Update `package.json` scripts (`tauri:dev`, `tauri:build`)
4. First Tauri build (3-5 min Rust compile)
5. App icon generation: `npm run tauri icon <512.png>`

Vercel deploy stays live during Tauri-wrap. Both ship paths coexist.

### Phase Z+1 — Repo rename (deferred)

`git mv` the repo. Update:
- Vercel project name (dashboard, not CLI)
- Both branch protection rules
- launchd plist Label
- POST_HIGH_RESUME and all handoff docs

Working titles to consider: `canada-ev`, `ev-canada`, `ev-buyers-canada`. User picks.

## Token budget summary

| Phase | Tokens | Tier | When |
|---|---|---|---|
| F1 (specs) | 30k | Sonnet | TODAY (parallel batch 1) |
| F2 (thermal) | 15k | Sonnet | TODAY (parallel batch 1) |
| F3 (mom-mode lib) | 10k | Sonnet | TODAY (parallel batch 1) |
| F4 (charging curve) | 12k | Sonnet | session 2 |
| F5 (pick-a-model) | 25k | Sonnet | session 2 |
| F6 (degradation) | 8k | Sonnet | session 3 |
| F7 (DCFC map) | 20k | Sonnet | session 3 |
| F8 (trip) | 25k | Sonnet | session 4 (optional) |
| F9 (debug) | 5k | Sonnet | session 4 (optional) |
| F10 (mom-mode for InventoryTable) | 5k | Sonnet | session 4 |
| G (iZEV) | 5k | Sonnet | session 4 |
| **Phase F+G total** | **~160k Sonnet** | | 4 sessions |
| Phase Z (Tauri) | multi-day | Mixed | future Stream |

## Today's execution (medium tier)

After this plan lands, medium dispatches **Phase F1+F2+F3 as 3 parallel Sonnet subagents** in a single message. Each prompt is self-contained with file paths + verification commands. After all 3 return, medium does:

1. `npm run predeploy` (gate)
2. Curl + grep smoke on /inventory + /pick-a-model not yet (F5 is later) + dossier
3. If clean: commit `feat(F1+F2+F3): blend phase 1 — specs + thermal + mom-mode`
4. Push to both branches
5. Request user reauth for `vercel --yes` preview deploy
6. On user OK: deploy → live preview URL
7. Update POST_HIGH_RESUME + this BLEND_PLAN with status

## Dispatch prompts (paste-ready for medium tier)

### F1 dispatch prompt

```
You are Sonnet executing Phase F1 of BLEND_PLAN_2026-05-03.md.

Goal: port sibling EV dashboard's seed.json into ev-auto-trader-canada's
specs.json, augmenting Spec with CitedValue<T> provenance.

Sibling source (READ-ONLY, never write):
- /Users/ianmcadam/Documents/Claude/Projects/EV dashboard/src/data/seed.json (4170 lines)
- /Users/ianmcadam/Documents/Claude/Projects/EV dashboard/src/types.ts (CitedValue + Vehicle shape)

Files to modify:
- /Users/ianmcadam/ev-auto-trader-canada/src/lib/types.ts (add CitedValue, ChargingCurvePoint, ThermalProfile types; augment Spec interface — see BLEND_PLAN §"Schema changes")
- /Users/ianmcadam/ev-auto-trader-canada/data/specs.json (rewrite to include all 37 sibling vehicles + preserve our 27 existing entries with CitedValue augmentation where sibling has overlap)

Verify:
1. node -e 'JSON.parse(require("fs").readFileSync("data/specs.json"))' (no parse error)
2. jq 'length' data/specs.json (≥ 35)
3. node -e 'const s=require("./data/specs.json"); const u=require("./data/units.json"); const k=(x)=>`${x.model}|${x.year}|${x.trim}`; const have=new Set(s.map(k)); const miss=u.filter(x=>!have.has(k(x))); console.log("missing:", miss.length)' (≤ 3 — A6 baseline)
4. cd /Users/ianmcadam/ev-auto-trader-canada && npm run predeploy

Commit + push: feat(F1): specs port — 37 vehicles + CitedValue provenance.
Push to both claude/verify-environment-setup-oTu3S AND claude/resume-ev-trader-dashboard-xmD1P.
```

### F2 dispatch prompt

```
You are Sonnet executing Phase F2 of BLEND_PLAN_2026-05-03.md.

Goal: port sibling thermal physics model + add winter-range chip per
row in /inventory.

Sibling source (READ-ONLY):
- /Users/ianmcadam/Documents/Claude/Projects/EV dashboard/src/lib/thermal.ts
- /Users/ianmcadam/Documents/Claude/Projects/EV dashboard/src/lib/thermal.test.ts
- /Users/ianmcadam/Documents/Claude/Projects/EV dashboard/src/components/TempSlider.tsx

Files to create/modify:
- src/lib/thermal.ts (port verbatim — pure TS)
- src/lib/thermal.test.ts (port — assertions)
- src/components/TempSlider.tsx (port + add "use client" directive; replace Zustand store import path if needed)
- src/store/temperature.ts (NEW — Zustand store for current temp; persist to localStorage)
- src/app/inventory/page.tsx (render <TempSlider /> above InventoryTable)
- src/components/InventoryTable.tsx (add WinterRangeChip rendered next to HeatPumpChip at line ~580; reads spec + temperatureFromStore + computes via thermal.realRangeKm)

Chip behaviour:
- temp ≥ +5°C → no chip
- temp 0 to +5°C → grey: "🌡 [tempC]: [km] km"
- temp -10 to 0°C → blue: same format
- temp ≤ -10°C → red: "🥶 [tempC]: [km] km"

Verify:
1. cd /Users/ianmcadam/ev-auto-trader-canada && npm run predeploy
2. npm run dev & ; sleep 5 ; curl -s http://localhost:3000/inventory > /tmp/inv.html ; grep -oc "TempSlider\|temperature\|🥶\|🌡" /tmp/inv.html (≥ 5)
3. pkill -f "next dev"

Commit + push: feat(F2): thermal model + winter-range chip.

DO NOT TOUCH src/lib/plainLang.ts or any file Phase F3 owns.
```

### F3 dispatch prompt

```
You are Sonnet executing Phase F3 of BLEND_PLAN_2026-05-03.md.

Goal: port sibling plainLang.ts and apply tooltips across non-InventoryTable UI.

Sibling source (READ-ONLY):
- /Users/ianmcadam/Documents/Claude/Projects/EV dashboard/src/lib/plainLang.ts

Files to create/modify:
- src/lib/plainLang.ts (port; extend with our terms: "OTD", "freight & PDI", "money factor", "residualPercent", "capCost", "buyerContext", "loyalty", "conquest")
- src/components/UnitDrawer.tsx (wrap labels in tooltip spans)
- src/app/inventory/[id]/dossier/page.tsx (same)
- src/app/compare/page.tsx (same)
- src/components/BuyerContextSelector.tsx (same)

DO NOT TOUCH src/components/InventoryTable.tsx (Phase F2 owns it).
DO NOT TOUCH any thermal.ts or temperature store (Phase F2 owns those).

Verify:
1. cd /Users/ianmcadam/ev-auto-trader-canada && npm run predeploy
2. grep -c "plainLang\|title=" src/components/UnitDrawer.tsx (≥ 1)

Commit + push: feat(F3): mom-mode plain-language tooltips (excl. InventoryTable).
```

## Stop conditions for medium

- 2 consecutive predeploy failures across F1/F2/F3 → halt + ping user
- Any Sonnet subagent exceeds 60k tokens → halt + ping user
- File collision detected post-merge → halt + revert + ping user
- Vercel deploy reauth denied → push branch state, log status, halt clean

## Caveat — sibling repo never gets cd'd

Read tool with absolute path is the ONLY allowed access pattern to
`/Users/ianmcadam/Documents/Claude/Projects/EV dashboard/`. Never
run any command with cwd inside it. CLAUDE.md non-negotiable rule.

## Status

- Plan written: 2026-05-03 (extra-high)
- Awaiting: user approval to proceed; user reauth for Vercel preview deploy after F1+F2+F3 land
- Next executor: medium-tier session, dispatches the 3 prompts above in parallel
