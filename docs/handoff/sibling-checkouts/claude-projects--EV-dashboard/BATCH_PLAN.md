# Remaining work — batched plan (v1)

**Purpose.** With 14 milestones closed and the core app functional (physics slider, charging curves, cost, map, range rings, DCFC pins, trip-distance check, compare view, persistence, 15H/4M/1L data, monitoring layer), the remaining work now collapses into **six coherent batches**. Each batch is ~2–4 hours of focused work, self-contained, and leaves the app materially more useful when it lands.

The old ~25-item queue is superseded by this document. Small items (P-01, I-17, etc.) are already absorbed or deferred.

---

## Batch 1 — Dataset maturity (expand to 40+ vehicles) ✅

**Goal.** Grow the curated seed from 20 → ~40 verified vehicles, covering ~95% of mainstream + premium Canadian cross-shopping.

**Success criteria.**
- Seed has ≥35 distinct vehicle entries.
- DataHealth pill reads ≥25 H (High) out of ~40.
- Thermal validator stays 6/6 green.
- Every new vehicle has all required fields filled with High or Medium confidence on range/DC/battery; Low only where data genuinely doesn't exist.

**Dependencies.** None external. D-01 verify template is proven.

**Work items.**
- 15–20 new vehicle entries covering the gap: Nissan Ariya (RWD + e-4ORCE), Genesis GV60 (2 variants), BMW i4 (eDrive40 + xDrive40), Kia EV9 (AWD Land + Earth trims — LR-only rules), Volvo XC60 Recharge (PHEV), Subaru Solterra (AWD only), Toyota bZ4X (FWD + AWD), Chevy Blazer EV (RWD + AWD), Honda Prologue (FWD + AWD), Lucid Air Pure + Air Touring, Mercedes EQS sedan, Audi Q6 e-tron Performance.
- Also: Kia Niro PHEV, Chrysler Pacifica PHEV, Volvo XC90 Recharge PHEV (broaden PHEV coverage).
- Each entry: brand, model, generation, trim, battery, chemistry, range + protocol, DC/AC, port, seats, cargo, tow, weight, heat pump y/n, thermal mgmt, charging_curve_20c (5 points), MSRP CAD, rebates, overall confidence.

**Approach.**
- Single subagent dispatch with "spec authoring" prompt (new template — extends d01_verify).
- Subagent returns JSON array of complete vehicle records with citations.
- I validate via `scripts/validate_vehicle_records.py` (new, simple: check required fields + plausible ranges), apply via seed merge script.
- Run metrics + thermal validator.
- Log subagent run to `logs/subagent_runs/`.

**Validation.** `validate_thermal.py` must stay green across added vehicles. `metrics.py` integrity check must pass. Visual spot-check in Chrome that new vehicles show up in BrandList.

**Estimated cost.** 3 h (1.5 h subagent time + 1 h apply/fix + 0.5 h verify).

**Blockers.** None.

**What Ian provides.** Nothing. Optionally: say "skip X brand, it's not Canadian-sold."

---

## Batch 2 — Live data integrations (OCM + OSRM)

**Goal.** Replace hardcoded demo data with live APIs where feasible — map becomes truthful instead of illustrative.

**Success criteria.**
- Map shows real DCFC stations within the range rings, fetched on-demand from Open Charge Map.
- Geocoding still uses Nominatim (already live).
- Trip line uses OSRM for actual road distance (not straight-line).
- "As-the-crow-flies" label changes to "driving distance" with a short "vs straight-line +X%" delta.
- Gracefully degrades to hardcoded demo stations if OCM is unreachable.

**Dependencies.** Ian provides a free Open Charge Map API key from openchargemap.org (one-time, ~2 minutes).

**Work items.**
- `src/lib/ocm.ts` — wrapper for OCM's `/poi` endpoint, filtered to LevelType ≥ 3 (DCFC only).
- Store OCM key in `.env.local` (Vite picks up `VITE_OCM_KEY`).
- Viewport-based fetching: when map bounds change, query OCM for stations in that bounding box. Cache results for 24 h keyed by (bbox, zoom).
- Fallback to `dcfc_stations.json` if key missing or fetch fails.
- `src/lib/osrm.ts` — wrapper for OSRM's public demo server for routing (polite usage, 1 req/trip, cache results).
- Update `MapPanel.tsx` to show polyline along road instead of straight line, and use road distance in trip verdict.
- Add a small "driving distance +X%" hover pill next to the crow-flies number.

**Approach.** All-direct work, no subagent. Small-ish code change (~250 lines).

**Validation.**
- Chrome-MCP test: set destination to Ottawa, verify polyline bends along highway (OSRM), not straight line.
- With OCM key absent, confirm fallback demo stations still render.
- With OCM key present, confirm real stations appear inside the range ring.

**Estimated cost.** 2 h.

**Blockers.** OCM key from Ian. Script ready either way; degraded mode makes it non-blocking.

**What Ian provides.** `VITE_OCM_KEY=<key>` added to a `.env.local` file in the project root.

---

## Batch 3 — Used-market surface

**Goal.** On demand, show real-world used listings for any vehicle in the compare view. Ian and his mom can see "what does this actually cost to buy right now?"

**Success criteria.**
- Every vehicle in the compare view has a "Show used listings" button.
- Click dispatches an Exa subagent (async) that returns top 10 AutoTrader.ca + Kijiji listings.
- UI shows: ask price, year, km, province, listing URL, asking vs seed MSRP delta.
- Sort by price / by km / by location.
- "Deal watch" mini-feature: save a saved search, auto-refresh via scheduled task (monthly).
- Graceful "no results found" when hostile sites block.

**Dependencies.** Exa web search (already wired). Subagent pattern (proven).

**Work items.**
- `scripts/prompt_templates/used_listings.md` — new template v1.
- `src/components/UsedListings.tsx` — panel. Has internal state for loading/results/error.
- `src/lib/usedListingsCache.ts` — localStorage cache keyed by vehicle_id+day, TTL 24 h.
- Backend scheduler (for deal watch): `scripts/deal_watch.py` — reads saved-searches JSON, dispatches subagent per entry, diffs against yesterday, logs new listings.
- Integrate button + panel into CompareView (below map, above spec table).
- Log each subagent run.

**Approach.** Subagent-heavy. One subagent dispatch per vehicle click (user-initiated). Results cached client-side.

**Validation.**
- Click button on Tesla Model 3 LR AWD, verify ≥3 listings return within 60 s with URLs that resolve.
- Listings are real (spot-check a URL — it should point to an actual listing).
- Cache hit on second click in same day returns instantly.

**Estimated cost.** 3 h.

**Blockers.** Exa coverage of AutoTrader/Kijiji is imperfect. Fallback: "no listings found — try AutoTrader.ca directly" with outbound link.

**What Ian provides.** Nothing.

---

## Batch 4 — Trip-planning precision (charge-stop planner)

**Goal.** Upgrade the "trip distance check" to a full charge-plan: which DCFC stations do I stop at? How long does each stop take? What's total trip time?

**Success criteria.**
- For a selected destination, each vehicle gets an ordered list of charge stops.
- Each stop: station name, kW, arrive-at-SoC, depart-at-SoC, minutes at stop.
- Total: drive time + charging time + margin.
- Physics slider applies (cold trip = more stops, each slower).
- Render stops as pins on the map with labels.
- Compare tab shows "fastest route" vehicle highlighted.

**Dependencies.** Batch 2 (OSRM routing). Batch 1 nice-to-have (more vehicles).

**Work items.**
- `src/lib/charge_plan.ts` — simulation function. Input: vehicle, thermal_state, route_polyline, starting_soc. Output: ordered list of stops with arrive/depart SoC + minutes.
- Algorithm: walk the polyline, depleting SoC per thermal model's Wh/km. When SoC hits 15% (configurable), pick closest DCFC station ahead. Compute charging time via per-vehicle charge_curve (integrate kWh added / kW available over SoC range). Target depart SoC = 80% or enough-to-reach-next-stop+15%, whichever less.
- `src/components/ChargePlanPanel.tsx` — display component.
- Integrate into MapPanel: plot stops on map as numbered pins along the route.
- Trip verdict shifts from "km margin" to "total time" comparison.

**Approach.** Pure TS logic + new component. Uses existing thermal.ts + charging_curve data.

**Validation.** Pick Toronto → Ottawa (450 km). Verify every vehicle has a plan; plans with longer ranges have fewer stops; summer preconditioned = faster total; winter cold-soaked = more stops. Manual cross-check against ABRP's published plans (if Ian wants, we can invoke ABRP-style comparison).

**Estimated cost.** 4 h. Highest-complexity batch.

**Blockers.** Depends on Batch 2 having OCM stations (otherwise only 15 demo stations, too sparse for long trips).

**What Ian provides.** OCM key (same as Batch 2).

---

## Batch 5 — Decision experience layer (polish + power features) ✅

**Goal.** Final UX refinements that make the app feel like a decision tool, not a dataset viewer. Small things that compound.

**Success criteria.**
- Breakdown drawer on any adjusted-range number (F-04).
- Mom-friendly mode toggle (jargon off, plain labels) (P-02).
- Vehicle photos in compare cards (hotlinked from Wikipedia or OEM static URLs).
- 5/8/10-year battery degradation projection per vehicle (F-10).
- Federal iZEV / Ontario eligibility micro-wizard per vehicle (F-11).
- Compare view exports to PDF via browser print (or a small jsPDF integration).
- WCAG 2.1 AA quick pass (color contrast, keyboard nav).

**Dependencies.** None structural.

**Work items.**
- `src/components/ThermalBreakdownDrawer.tsx` — click/hover expands a drawer showing rated → capacity fraction → minus HVAC → effective efficiency → range.
- `src/components/JargonToggle.tsx` + `src/lib/plainLang.ts` — maps "DC fast-charging peak" → "fastest charging speed", etc.
- Vehicle photos: add `photo_url` to Vehicle schema (optional); bulk-find via subagent (Wikipedia Commons search).
- `src/lib/battery_degradation.ts` — per-chemistry curve: NMC ~0.9% per 10k km, LFP ~0.5% per 10k km, LMR ~0.7%. Apply at typical 20k km/year, plot graph.
- `src/components/IncentiveWizard.tsx` — per-vehicle Y/N: does it beat iZEV MSRP cap? Does Ontario rebate apply? (Both currently zero, but wire the logic in so when incentives return it works.)
- PDF export: `html2pdf.js` via CDN (small lib, no npm install).
- Accessibility: run `design:accessibility-review` skill on the app screenshots; fix top findings.

**Approach.** Mostly direct code + one subagent for photo URLs.

**Validation.** Visual QA via Chrome-MCP for each new feature. Accessibility-review skill output.

**Estimated cost.** 4 h.

**Blockers.** None.

**What Ian provides.** Optionally: specific "deal breakers" he wants as a filter row (e.g., must tow 1500 kg, must have heat pump) to inform the jargon/wizard copy.

---

## Batch 6 — Tauri desktop packaging + operations ✅

**Goal.** Ian opens "EV Dashboard" from his Applications folder like any other app. App self-maintains via scheduled tasks.

**Success criteria.**
- Double-clicking builds and launches a real .app bundle.
- Icon in Dock, native Mac window chrome.
- Scheduled task runs monthly: checks iZEV rebate status via Exa, writes update into a `pending_review/` folder for Ian to review.
- CHANGELOG.md auto-generated from LEARNINGS + milestone history.
- Snapshot rotation: keep last 30 seed.json versions, archive older ones.

**Dependencies.** Ian's Mac has Rust installed (from First-Time-Setup.command). Tauri bundler runs on his side.

**Work items.**
- Fix `src-tauri/tauri.conf.json` icon paths (generate minimal icons or use placeholder).
- App icon: SVG-based, simple "⚡" glyph on dark background, converted to .icns via Tauri CLI.
- `npm run tauri:build` produces a `.app` bundle (unsigned, that's fine for personal use).
- Script: `scripts/changelog.py` — reads LEARNINGS.md headings, groups by date, writes versioned CHANGELOG.md.
- Scheduled task via `schedule` skill: monthly iZEV Exa check.
- Snapshot rotation in `scripts/snapshot.py`: prune snapshots older than the 30 most recent.
- Release doc: `RELEASING.md` — short playbook for Ian.

**Approach.** Most work is config + small scripts. The Tauri build itself has to run on Ian's Mac (Rust compile).

**Validation.** Ian double-clicks `Start-Desktop-App.command`. A Mac window opens. Icon shows in Dock. Everything works.

**Estimated cost.** 2 h (+ Rust compile time on his Mac).

**Blockers.** The Tauri build happens on his machine. I can't validate the .app ships.

**What Ian provides.** Runs `npm run tauri:build` on his Mac and shares the outcome.

---

## Batch sequencing & dependencies

```
Batch 1 (dataset maturity)  ──┐
                              │
Batch 2 (live integrations) ──┤─→ Batch 4 (trip-planning precision)
                              │
Batch 3 (used market) ────────┤
                              │
Batch 5 (decision layer) ─────┤
                              │
Batch 6 (Tauri + ops) ────────┘ (run last; everything else should be stable)
```

**Recommended order:** 1 → 2 → 4 → 3 → 5 → 6. Dataset first (makes every other batch more useful), then the live-integration backbone, then the features that ride on it, then polish, then ship.

**Alternate fast path** if Ian wants to skip some: 1 → 5 → 6 (dataset + polish + ship) gets a solid personal-use app without needing OCM/OSRM integration. Batches 2/3/4 become nice-to-haves.

---

## Open questions for Ian (decide before starting)

1. **OCM key** — want to register for one now (free, 2 min)? Unblocks Batches 2 and 4.
2. **Batch 1 brand list** — any brands to skip (e.g., Lucid is very low-volume in Canada)?
3. **PDF export** — is "print to PDF from Chrome" enough, or build a dedicated export flow?
4. **Tauri** — do you want a real `.app` at the end, or is web-mode forever fine?
5. **Used-market data sensitivity** — AutoTrader/Kijiji scraping is ToS-ambiguous; Exa's searches should be fine but I want your sign-off to proceed.

---

## How this document evolves

- When a batch ships, mark its section `✅ DONE` with a one-line outcome and a link to the milestone entry in LEARNINGS.md.
- When a new idea emerges mid-batch, add it to the appropriate batch's work-items list (don't create a seventh batch).
- If a batch balloons beyond 5 h of actual work, split it in-place and re-estimate.
