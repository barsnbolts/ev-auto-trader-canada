# Cluster C — Physics + Cost + Bugs

## Goal

Turn the physics model into a cost calculator, fix a known accuracy bug, make
confidence badges actually explain themselves, and persist the compare tray so
it survives a reload. Ian should leave Cluster C able to see "I'll spend
$3.80/100 km to drive my IONIQ 6 in January" — a number that means something.

## User-visible behavior

| Change | What Ian / mom notice |
|---|---|
| **F-02** Cost-per-100 km | New row in CompareView: "Cost / 100 km" with a TOU-rate dropdown (off-peak / mid-peak / on-peak). Updates live with the slider. |
| **B-01** Tray persistence | Add 3 vehicles, close the browser, reopen — tray still shows those 3 vehicles. "Clear saved comparison" button in the compare header removes them. |
| **F-03** Confidence tooltips | Hover any H / M / L badge → readable tooltip: "High: two or more independent sources agree on this number" etc. |
| **C4** rollupConfidence fix | At −10 °C and −20 °C, High-confidence vehicles stay High (not demoted to Low). Model becomes honest at genuine extremes only (≤ −30 °C or above 40 °C). |
| **C6** UI polish | Drivetrain label reads "All-Wheel Drive" not "AWD"; empty filter state shows a helpful message; header no longer wraps on 1280 px viewport. |

## Acceptance criteria

1. CompareView shows a "Cost / 100 km (est.)" row; value = `efficiency_whkm × 0.1 × rate`.
2. TOU dropdown (3 options: off-peak 9.2 ¢, mid-peak 13.6 ¢, on-peak 17.9 ¢ Hydro One 2026) lives in the store; default mid-peak.
3. Cost row updates when slider temp changes.
4. Zustand store persists `compareIds`, `filters`, `temp_c`, `hvac_on`, `speed_kph`, `electricityRateCadPerKwh` to localStorage under key `ev-store-v1`.
5. Reload with 3 vehicles in tray → tray still shows 3 vehicles.
6. "Clear saved comparison" button in CompareView header calls `clearCompare()`.
7. ConfidenceBadge `title` attr reads: High → "High confidence: two or more independent sources agree.", Medium → "Medium confidence: numbers from a single source or with partial independent verification.", Low → "Low confidence: estimated, extrapolated, or sparse data — treat as approximate."
8. `rollupConfidence(-10, "High")` → "High". `rollupConfidence(-20, "High")` → "High". `rollupConfidence(-26, "High")` → "Medium". `rollupConfidence(-30, "High")` → "Low".
9. Drivetrain enum prettifier in FilterBar / CompareView: AWD → "All-wheel drive", RWD → "Rear-wheel drive", FWD → "Front-wheel drive", "AWD+FWD" → "Dual-motor AWD".
10. FilterBar empty state: "No vehicles match these filters — try broadening your search." with a reset button.

## Inputs / state touched

- `src/store/useAppStore.ts` — add persist middleware + `electricityRateCadPerKwh` + `setElectricityRate`
- `src/components/CompareView.tsx` — cost row + rate dropdown + Clear button
- `src/components/ConfidenceBadge.tsx` — enhanced title text
- `src/lib/thermal.ts` — `rollupConfidence` threshold rewrite
- `src/lib/thermal.test.ts` — add rollupConfidence cases
- `src/components/FilterBar.tsx` — drivetrain prettifier + empty state
- `src/types.ts` — no changes needed

## Outputs

- Cost-per-100 km visible in compare grid
- Tray survives reload
- Confidence badges explain themselves on hover
- Accurate confidence at realistic Canadian winter temps
- Cleaner filter UI

## Dependencies

- Zustand `persist` middleware is bundled with zustand — no new packages
- All physics model changes are pure TS — covered by Vitest

## Test plan

- Layer 1: `tsc --noEmit` after every file edit (hook fires)
- Layer 2: Vitest — add 4 `rollupConfidence` unit cases (acceptance criterion 8)
- Layer 5: existing 50 golden-value tests must still pass after rollupConfidence fix
- Layer 6: ConfidenceBadge snapshot must update (re-snapshot with new title text)
- Layer 7: Chrome-MCP — load app, add 3 vehicles, change rate to on-peak, check cost row, reload, verify tray persists

## Open questions

None — all decisions covered in §1.6 defaults (rate choices, persist key, drivetrain labels).

## Done when

- `tsc ✅ · vitest N/N ✅ · validate.py ✅ · smoke.sh 🟢 ✅`
- Chrome-MCP: cost row visible, tray persists, tooltip readable on hover
- Cluster C recap delivered to Ian

## Changelog

- 2026-04-24: initial spec
