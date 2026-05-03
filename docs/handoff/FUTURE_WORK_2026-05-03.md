# Future-work backlog (2026-05-03)

> Captured during the post-V6 audit pass on **high reasoning**. Items are
> listed in rough ROI order: highest-value-per-token first, deferred
> nice-to-haves last. Each item names the files that would change and
> includes a token estimate so future Claude sessions can decide what to
> pull in given current budget.

## Already shipped this session (post-V6)

- **F1.5b** — backfilled 7 EV9/Ioniq9 specs sibling couldn't match (chargingCurve, batteryChemistry, rangeEpaKm × 7, +10 sibling-shape fields each). Affects ~22 listings including the largest single-trim count (12 Ioniq9 Performance Calligraphy). Commit `9a7d2a7c`.
- **rangeKm/rangeEpaKm consistency** — `/inventory` page Range column, `CompareGrid` Range/DC/AC columns now prefer `rangeEpaKm.value` then fall back to legacy `rangeKm`. Fixes silent stale-data bug where post-F1.5 cited values weren't surfacing through these consumers.

## Tier 1 — high-ROI, mechanical (Sonnet-cheap)

### F11. Wikipedia photo URLs for Ioniq9 + EV9 trims (~5k Sonnet)
- File: `data/vehicle-images.json`
- B2 phase populated images for shipped trims; **Ioniq9 trims still have no hero photos** (model launched 2026, was missed in original sweep). EV9 Light variants similarly missing.
- Action: Exa-search "Hyundai Ioniq 9 [trim] press photo Wikimedia Commons" + Kia EV9 equivalents; add 3 entries (Ioniq9 generic, Ioniq9 Calligraphy, EV9 generic).
- Verify: `/inventory` rows for these trims render `<img>` instead of placeholder.

### F12. Validate rangeEpaKm values for Ioniq9 + EV9 (~3k high)
- File: `data/specs.json`
- F1.5b carried over the existing `rangeKm` legacy values (510, 540, 620 for Ioniq9 trims; 370, 480 for EV9 Light variants). Hyundai's own Canadian site cites different numbers (~285 mi / 459 km for Calligraphy AWD, ~320 mi / 510 km for Preferred LR AWD, ~335 mi / 539 km for Preferred LR RWD).
- Action: Single Exa fetch per model; if Hyundai/Kia Canada showroom has updated to current EPA, replace `rangeEpaKm.value` (NOT `rangeKm` — preserve historical value as audit trail).
- ROI: Trust signal on dossier Battery Health + accurate WinterRangeChip math. Same reason F1.5b was worth doing.

### F13. Heat-pump researcher pass for the 7 backfilled specs (~3k high)
- Files: `data/heatpump-research-queue.json`, `data/specs.json`
- The 7 Ioniq9/EV9 Light trims were assigned `hasHeatPump: false` (Cold Weather Pkg option) by the original Phase A6 audit. **F1.5b did not re-verify.**
- Action: Confirm against current Hyundai/Kia Canada brochures; if heat pump is now standard on any Ioniq9 trim (per 2026 redesign), flip the flag. WinterRangeChip math depends on this.

### F14. `/intel` competing-EV table — add rangeEpaKm support if dataset grows (~2k)
- File: `src/app/intel/page.tsx:126`
- Currently uses `c.rangeKm` from `data/market-intel.json`. Schema is separate from our 31-spec dataset (intentional: market-intel tracks competitors, not our buying targets). Leave as-is until we expand the competing dataset.

## Tier 2 — feature work (planned, not started)

### F8. Trip planner with charge stops (~25k Sonnet)
- New route: `/trip-planner`
- Sibling `src/lib/osrm.ts` + `charge_plan.ts` ready to port verbatim
- UI: origin/destination inputs (Nominatim geocoder), route polyline overlay, charge-stop pins, total time/distance/cost summary
- Why deferred: Ian's buying window is 1-2 weeks; trip planner is a "month 2" feature that adds value once he has the car. Big spend for marginal pre-purchase utility.

### F9. Debug telemetry ring buffer (~5k, dev-only)
- File: new `src/lib/debugLog.ts` from sibling
- Captures last N tool calls / network requests / state mutations in-memory; `Cmd+Shift+D` toggles a panel. Sibling-style.
- Why deferred: dev convenience for me, not user-visible. Skip unless I'm debugging a recurring issue.

### F7.5. Live OCM data swap (~3k + user action)
- File: `src/components/DealerMap.tsx` (already imports static `dcfc_stations.json`)
- Action: when `process.env.NEXT_PUBLIC_OCM_KEY` is set in Vercel dashboard, fetch live stations within map bounds via Open Charge Map API; fall back to static 15-station demo otherwise.
- Blocker: Ian must add `NEXT_PUBLIC_OCM_KEY` to Vercel env vars (free key from openchargemap.org).
- Code shape:
  ```ts
  const stations = process.env.NEXT_PUBLIC_OCM_KEY
    ? await fetchOcm(bbox)
    : STATIC_STATIONS;
  ```

## Tier 3 — code quality / polish

### F15. Dossier `Vehicle facts` panel — surface "research pending" more cleanly (~2k)
- File: `src/components/BatteryHealthPanel.tsx`
- Currently renders `<p>research pending</p>` when chemistry/range missing. With F1.5b all 31 specs are covered, so this branch is now defensive-only. Consider tightening to show a tiny "_data: Medium confidence_" footnote when values came from `rangeKm` carryover instead of cited rangeEpaKm.

### F16. Picker component naming consistency (~1k)
- Sibling repo named these `BrandList`, `FilterBar`, `VehicleRow`, `CompareTray`. We renamed to `Picker*` to avoid collision. Working fine — but the **PickerCompareTray** uses Zustand while the **CompareGrid** in the inventory area uses a separate compare-bar driven by URL params. Two different "compare" UIs co-exist intentionally (one for shopping models, one for shopping individual units), but a doc comment in each would prevent future-Claude confusion.

### F17. tsconfig.json — turn on noUnusedLocals + noUnusedParameters? (~3k cleanup)
- Sibling repo has these on; ours does not. Pre-commit hook runs `tsc --noEmit` so we'd catch them, but Next.js build doesn't fail on unused imports. Risk: minor cleanup churn. Reward: tighter codebase. Defer.

### F18. Drop `motorKw`/`motorHp` legacy fields once all consumers migrate (~5k)
- Sibling shape has only `motorKw` (CitedValue<number>) — no `motorHp`. Ours has both as plain numbers. CompareGrid uses both. Once we standardize, drop `motorHp` and let CompareGrid compute it (`motorKw * 1.341`).

## Tier 4 — strategic / multi-day (deferred)

### Z. Tauri-wrap (multi-day rewrite)
- Sibling has full Tauri 2 desktop shell. Wrap-up steps:
  1. Add `src-tauri/` config (port from sibling)
  2. Migrate cookie-based BuyerContext to localStorage (Tauri has no SSR cookies)
  3. Convert SSR routes to client-rendered (or keep dual-mode with `next export`)
  4. Code-sign + notarize? Per CLAUDE.md "personal use only" rule: skip. App runs unsigned via right-click → Open.
- ROI: standalone Mac app, no `npm run dev` needed. Nice-to-have, not required.

### Z+1. Repo rename
- Once Tauri-wrap lands, the project becomes "EV Trader" or similar (covers both inventory + dashboard scopes). Rename: `ev-auto-trader-canada` → `ev-trader` (or user's preferred name).
- Mechanical: GitHub UI → Settings → rename. Update remote in local clone.

## Tier 5 — operational / housekeeping

### O1. Vercel production-branch override (1 user action)
- Currently every push to `claude/verify-environment-setup-oTu3S` produces a preview deploy. Promote to prod is manual (`vercel deploy --prod` or dashboard).
- One-time: in Vercel dashboard → Settings → Git → Production Branch → set to `claude/verify-environment-setup-oTu3S`. Future pushes auto-deploy to prod.

### O2. Daily refresh launchd verification (~1k)
- `com.evautotrader.refresh` was loaded 2026-05-03. First fire: 7am ET tomorrow.
- Action next session: `launchctl list | grep evautotrader` should show non-zero PID; `tail logs/cron.log` should show successful first run. If it failed, debug.

### O3. Snapshot retention pruning
- `data/snapshots/` accumulates one file per day. After 90 days that's 90 files; we don't currently prune. Add a `Prune-Snapshots.command` analog or extend `refresh_daily.sh` to keep last 30 + monthly archives.
- Defer until disk pressure shows up.

## Token budget projections

If user picks one of:
- **Tier 1 sweep** (F11+F12+F13): ~10k high + ~5k Sonnet, 30 min wall
- **F8 trip planner**: ~25k Sonnet (mostly mechanical port), 45 min wall
- **F17 strict-TS audit**: ~15k high (catching cleanup spread across files)
- **Z Tauri-wrap**: multi-day, separate planning session

Recommend Tier 1 sweep next — every item is small, surfaces directly to user-visible UX, and validates the F1.5b backfill held up under real data scrutiny.
