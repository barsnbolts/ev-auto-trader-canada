# Cluster E — Trip Planning + Used Market + Degradation

## Goal

Give Ian (and eventually mom) three answers the Specs tab can't:
1. "Will this EV make it to Ottawa without stopping?" → Trip planner with per-vehicle charge stop plan.
2. "How much do these cars actually sell for used in Ontario?" → Used market panel via Exa.
3. "How bad will the range be in 5 years?" → Degradation rows in the compare table.

## E0 — Route engine decision (made 2026-04-24)

ABRP Planning API has no public free tier; pricing is custom/enterprise (confirmed by fetching abetterrouteplanner.com/resources/api). Only their Telemetry API (live car data sync) is free, which is unrelated.

**Decision: self-built Rust greedy solver as primary.** `VITE_ROUTE_ENGINE=abrp|selfbuilt` env flag wired so Ian can swap in an ABRP key later. Geocoding via Nominatim (free, no key).

## Items

### E1 — Used market panel (F-09)

**What:** `src/components/UsedMarketPanel.tsx` shown as a 4th tab "Used Market" in CompareView.

Per compared vehicle:
- Exa search: `"${brand} ${model} ${year} used for sale Ontario Canada site:autotrader.ca OR site:kijiji.ca"`
- Display: 3–5 listing links (title + price if parseable), fallback "no results found".
- Cache 24hr per vehicle ID in `localStorage` with key `ev-used-${vehicleId}-${date}`.
- No-key fallback: neutral message "Used market search requires Exa API access — no key configured."

### E2 — Trip planner (F-08)

**What:** `src/components/TripPlanner.tsx` shown as 3rd tab "Trip Plan" in CompareView.

UI: Two text inputs (origin + destination, geocoded via Nominatim), "Plan Trip" button. Below: per-vehicle results card showing charge stops (location, SOC-in, SOC-out, minutes, cost estimate).

Rust backend: `src-tauri/src/trip_planner.rs` + Tauri command `plan_trip`.

**Algorithm (greedy):**
1. Geocode origin + destination via Nominatim (called from frontend, passed as lat/lng).
2. Build route waypoints: direct great-circle line divided into 50 km segments.
3. For each vehicle: simulate battery state along segments using `compute_thermal` outputs. When predicted SOC at next segment endpoint < 20%, insert a stop at the nearest OCM DCFC station within 15 km of the route.
4. At each stop: compute charge time to 80% SOC using the vehicle's charging curve.
5. Return list of stops with: station name, SOC-in, SOC-out, charge_minutes, cost_cad (rate from TOU tier).

**Fallback:** `VITE_ROUTE_ENGINE=abrp` + `VITE_ABRP_API_KEY` → call ABRP API instead of Rust solver.

### E3 — Battery degradation rows (F-10)

**What:** Add 3 rows to CompareView ROWS array: "Range at 5 yr", "Range at 8 yr", "Range at 10 yr".

Formula: `rated_range_km × (1 - degradation_annual)^years`. Show with Low confidence badge (degradation is fleet-average; individual variation is high).

Requires:
- New `degradation_annual?: number` field in `Vehicle` type (optional, defaults to 0.02 = 2%/yr which is the Recurrent fleet average).
- Add field to all 20 vehicles in seed.json (use 0.02 default; note vehicles with known better/worse degradation if data available).

### E4 — iZEV scaffold (F-11)

**What:** `FeatureFlag` component that wraps children with a "paused" overlay card.

Usage: wrap the iZEV rebate row(s) in CompareView. The overlay shows "iZEV paused as of March 2025 — check back when policy resumes."

Off by default (no toggle — just always shows the paused card). This blocks the feature from looking broken while the program is paused.

## Acceptance criteria

1. CompareView has 4 tabs: Specs / Trip Plan / Map & Range / Used Market.
2. Degradation rows appear in Specs tab: at 5/8/10 yr, values decrease year-over-year. Low badge shown.
3. iZEV rows show "paused" overlay instead of values.
4. Trip planner: enter "Toronto" + "Ottawa" → plan renders for each vehicle with ≥1 charge stop for F-150 Lightning (shortest range).
5. F-150 Lightning has ≥1 more stop than Tesla Model 3 LR AWD on the same Toronto→Ottawa run.
6. Used market panel renders either listings or graceful no-key message (no crash).
7. All TypeScript, cargo test, vitest green. validate.py green.

## Inputs / state touched

- `src/types.ts` — add `degradation_annual?: number`
- `src/data/seed.json` — add degradation_annual to all 20 vehicles
- `src/components/CompareView.tsx` — add Trip Plan + Used Market tabs; add degradation rows; wrap iZEV
- `src/components/TripPlanner.tsx` — new
- `src/components/UsedMarketPanel.tsx` — new
- `src-tauri/src/trip_planner.rs` — new
- `src-tauri/src/main.rs` — register plan_trip command
- `src/store/useAppStore.ts` — no changes (TOU rate already in store)

## Dependencies

- Cluster D complete ✅ (Rust thermal plugin, MapPanel, Leaflet already in place)
- Nominatim API (free, no key needed)
- Exa MCP tool for E1

## Test plan

- Layer 1 (tsc): new types, new components
- Layer 2 (vitest): degradation formula unit test (3 vehicles × 3 years = 9 assertions)
- Layer 3 (cargo test): `plan_trip` golden case: Toronto→Ottawa, IONIQ 5 LR AWD, ≥0 stops; Lightning ≥1 stop
- Layer 7 (Chrome-MCP): walkthrough all 4 tabs, trip plan renders, degradation rows visible

## Done when

- [ ] 4 tabs in CompareView: Specs / Trip Plan / Map & Range / Used Market
- [ ] Degradation rows at 5/8/10 yr in Specs tab
- [ ] iZEV paused overlay
- [ ] Trip plan: Toronto→Ottawa renders stops per vehicle
- [ ] Used market: Exa results or graceful fallback
- [ ] `tsc --noEmit` clean
- [ ] `cargo test` green (includes trip_planner tests)
- [ ] `vitest` 55+ passing
- [ ] milestone.py E5 committed

## Changelog

- 2026-04-24: initial spec. E0 decision: self-built solver (ABRP enterprise-priced).
