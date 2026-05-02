# Cluster F — Mom mode + accessibility + design sweep + packaging

## Goal

Turn a working technical tool into a polished Mac app that Ian's mom can use without a tutorial. Accessibility, plain language, design refinement, Tauri packaging, and final code review gate the merge to main.

## User-visible behavior

- **Plain/Geek toggle** — a pill in the app header lets any user flip between technical labels ("BEV", "kWh", "Wh/km") and plain-English equivalents ("Electric only", "battery size", "energy used per km"). Persists across sessions.
- **Accessibility improvements** — every interactive element has a visible focus ring; contrast meets WCAG 2.1 AA; slider and icon buttons have ARIA labels.
- **Tauri packaging** — double-clicking `Start-Desktop-App.command` launches a proper Mac .app with a dock icon; no browser window needed.
- **User guide** — `docs/user_guide.md` is a short walkthrough Ian can read to mom (or she can read herself). In-app credits page.
- **Design polish** — spacing/typography tokens locked; before/after screenshots show the improvement.

## Acceptance criteria

1. Plain/Geek toggle pill visible in App.tsx header; toggles persist via localStorage.
2. In Plain mode: "BEV" shows as "Electric only", "kWh" as "battery size", "kW" as "charging speed", row labels in CompareView use plain equivalents.
3. `tsc` passes with `plainMode: boolean` in store and `BiLabel` type in labels.ts.
4. WCAG 2.1 AA: all text ≥ 4.5:1 contrast ratio, all inputs/buttons have ARIA labels, focus rings visible.
5. `npm run tauri build` completes without error; `.app` launches and passes smoke test.
6. `docs/user_guide.md` exists with at least: add vehicles, compare, read the range numbers, trip planning, plain mode.
7. Chrome-MCP regression: all 4 tabs (Specs/Trip/Map/Used) work after F-items land.
8. `/caveman-review` sweep run; all 🔴 findings addressed.
9. `scripts/smoke.sh` green.

## Inputs / state touched

- **New files:** `src/lib/labels.ts`, `docs/user_guide.md`, `src/components/CreditsPanel.tsx`
- **Modified:** `src/store/useAppStore.ts` (add `plainMode`, `setPlainMode`, persist), `src/App.tsx` (toggle pill), `src/components/VehicleRow.tsx` (plain labels), `src/components/CompareView.tsx` (BiLabel in ROWS), `tailwind.config.js` (token lock)

## Outputs

`.app` in `~/Applications/`. Plain mode. Accessible UI. `docs/user_guide.md`.

## Dependencies

Clusters A–E complete ✅.

## Test plan

- Layer 1: `tsc --noEmit` — BiLabel type, plainMode in store, no `any` escapes
- Layer 2: Vitest — add test that `TERM.bev.plain === "Electric only"` and `TERM.bev.geek === "BEV"`
- Layer 6: Chrome-MCP — screenshot Plain mode on, Plain mode off; both tabs OK
- Layer 7: Tauri build → `.app` launches → smoke.sh passes

## Open questions

- **Mom's specific accessibility needs** — plain language only, or also low-vision / motor / cognitive accommodations? Ask Ian at F2 boundary before running WCAG audit.

## Done when

- [ ] F1: labels.ts + toggle + VehicleRow + CompareView plain labels
- [ ] F2: accessibility audit complete (pending Ian input on mom's needs)
- [ ] F3: Chrome-MCP regression sweep green
- [ ] F4: `npm run tauri build` → `.app` tested
- [ ] F5: `docs/user_guide.md` + CreditsPanel
- [ ] F6: design elegance sweep, tailwind tokens locked
- [ ] F7: `/caveman-review` sweep, findings triaged
- [ ] F8: final milestone, PR, merge to main

## Changelog

- 2026-04-23: initial spec, Cluster F kickoff.
