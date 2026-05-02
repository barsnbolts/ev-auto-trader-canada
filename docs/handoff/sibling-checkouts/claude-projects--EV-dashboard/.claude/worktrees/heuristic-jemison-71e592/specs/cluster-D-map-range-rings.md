# Cluster D — Map + Range Rings + Rust Thermal Plugin

## Goal

Give Ian a visual, physics-grounded answer to "can I get there in winter?" — a map that shows
how far each compared vehicle can go under current slider conditions, live-updating as he adjusts
temperature or HVAC. Also: port the thermal model to Rust so the trip planner (Cluster E) has a
native-speed computation layer.

## User-visible behavior

1. A "Map & Range" tab appears in CompareView beside the existing "Specs" tab.
2. Switching to the tab shows an interactive Leaflet map centered on Toronto.
3. Each compared vehicle gets two concentric circles on the map: 50% range and 100% range
   (radii derived from the physics slider, not rated range).
4. Rings are color-coded by vehicle slot (blue / amber / green / red). Each color matches
   the vehicle's position in the compare tray.
5. Moving the temperature slider or toggling HVAC updates the ring radii live.
6. 15 Ontario DCFC charging stations appear as pins. Clicking a pin opens a sidecar showing
   station name, power level, and network.
7. When `VITE_OCM_API_KEY` is set, live pins load from the Open Charge Map API and replace
   the hardcoded fallback on map move (debounced).

## Acceptance criteria

1. Map renders in the "Map & Range" tab with Leaflet tiles, no console errors.
2. Range rings appear for each compared vehicle.
3. Ring radii update when the temperature slider changes (not just on mount).
4. IONIQ 5 ring radius > F-150 Lightning ring radius at 0°C (longer rated range + better chemistry).
5. At least 15 Ontario DCFC pins are visible (hardcoded fallback).
6. Clicking a pin opens the sidecar with station name and power level.
7. `cargo test` green: Rust thermal model matches TypeScript outputs within 1 km / 1 kW for
   the 6 golden cases.
8. `tsc --noEmit` clean.
9. `npm test` green (no regressions in existing Vitest suite).

## Inputs / state touched

- New files: `src/components/MapPanel.tsx`, `src/lib/compare-colors.ts`,
  `src-tauri/src/thermal.rs`
- Modified files: `src-tauri/src/main.rs`, `src-tauri/Cargo.toml`,
  `src/components/CompareView.tsx`, `scripts/milestone.py`
- New env var: `VITE_OCM_API_KEY` (optional; hardcoded fallback when absent)
- New env var: `VITE_APPLE_MAPKIT_TOKEN` (optional; Leaflet used when absent)
- npm deps: `leaflet`, `@types/leaflet`

## Dependencies

- Cluster C complete (compare state, thermal model, TOU) ✅
- `leaflet` npm package installed

## Test plan

- Layer 1 (tsc): MapPanel.tsx + thermal.rs types must be clean.
- Layer 2 (vitest): no regressions; no new TS tests added (Rust has its own tests).
- Layer 7 (cargo test): 6 golden cases in `thermal.rs #[cfg(test)]` module.
- Manual: drag slider −20 °C → rings shrink; click pin → sidecar.

## Open questions

- MapKit JS token: Ian generates async; Leaflet covers the no-key case entirely.
- OCM API key: Ian registers free at openchargemap.org; hardcoded fallback covers the no-key case.

## Done when

- [ ] `cargo test` green (Rust thermal golden cases)
- [ ] `npm test` green (no TS regressions)
- [ ] `tsc --noEmit` clean
- [ ] Map renders in CompareView "Map & Range" tab
- [ ] Rings update live with slider
- [ ] 15+ Ontario pins visible
- [ ] Milestone commit landed

## Changelog

- 2026-04-23: initial spec, Cluster D kickoff.
