# Learnings log

Chronological record of what worked, what didn't, and what to change next. Dense, dated, actionable. Updated after every significant work-queue item in `AUTONOMOUS_PLAN.md`.

---

## 2026-04-23 · Milestone ROI-GATE-V1 completed ✅

Token-ROI discipline system installed: token_roi.py (preflight/log/dashboard/gate/budget/spend), wired into milestone.py step 8, batch_ritual.py step 8, kickoff.py. snapshot.py auto-rotates to tar.gz archive. Prune-Snapshots.command for Mac-side cleanup. CLAUDE.md 'Token-ROI discipline' section with 7 hard rules. GAME_PLAN_V4_addendum.md with 30+ fresh ideas across 12 sections covering compression heuristics, shopping JOURNAL, quote tracker, dealer-negotiation scripts, memoization cache, confidence decay, and decisions journal.

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-23 · Milestone GAMEPLAN-V3 completed ✅

Game plan v3 addendum shipped — comprehensive pre-planning upgrade. Cost tracker (calibrates estimates from real data, backfilled 21 entries, revealed 'data' milestones = ~103k subagent tokens, 'feature' = 0). Caveman directive added to CLAUDE.md + d01_verify.md (14-21% output-token savings compounding). Deep-audit harness (scripts/deep_audit.py, 15 dimensions, fast/full modes) caught 2 real TS errors + 12 unused exports on first run — fixed. Added sections on testing-depth matrix, pre-planning YAML template (entry/exit/rollback/validation fields), 10 code-organization patterns, Stream E financing/lease/pricing data layer (40+ variables + 4-phase scope), standing 10-question clarification protocol. Honest admission: v2 'hours' were vibe-based; replaced with tokens + tool calls + chat-turns as real units.

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-23 · Batch I-DBG retrospective 📊

Debug panel rounds out the project. Every user interaction + fetch + error is now captureable on demand. This plus Chrome-MCP screenshotting means I have three layers of visibility into the running app: passive memory (telemetry file), active inspection (Chrome DOM+screenshot), and structured logs (subagent audit trail). Feature-complete milestone for the app phase.

*Auto-appended by batch_ritual.py at batch close. Edit freely.*

## 2026-04-23 · Milestone I-DBG completed ✅

Debug/telemetry mode shipped. src/lib/debugLog.ts — ring buffer (500 events), global error + unhandled-rejection hooks, patched window.fetch to capture every network request (URL, status, ms), action recorder wired into all Zustand setters. src/components/DebugPanel.tsx — bottom-right floating panel: toggle checkbox, live counts (N actions · M errors · K fetch-fails), expandable 60-event tail with colored kind labels, 'Download JSONL' button, Clear button. Off by default, zero overhead when off (early return). When Ian toggles on and uses the app, every click/slider-move/filter-change becomes an event; errors show red; failed fetches show amber. Downloaded file goes into Downloads by default but Ian can move it to the workspace — my sandbox can read it next turn to see exactly what happened. Closes the full debug loop Ian asked for.

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-23 · Batch BATCH-FINAL retrospective 📊

All 6 batches now closed. Mega-session: 22 milestones, 37 vehicles, 16 brands, 30H/6M/1L confidence, 2 subagent prompt templates evolved through 3 runs, inter-batch ritual proven, validator gates stayed green throughout. App now has every feature originally scoped: physics slider, charging curves, cost-per-km, map with range rings, charge-stop planner, trip verdict, battery degradation projection, iZEV wizard, mom mode, used-market links, and Tauri packaging path. Graceful degradation on OCM/OSRM means it works TODAY without Ian's key and upgrades to live data the moment he adds it.

*Auto-appended by batch_ritual.py at batch close. Edit freely.*

## 2026-04-23 · Milestone BATCH-3 completed ✅

Used market surface shipped pragmatic: pre-filled search links per vehicle to AutoTrader.ca (Ontario filter, 15 results, sorted by price) + Kijiji cars + EV-Database. Each vehicle card shows 'New $X · 3-yr used ≈ $0.7X' quick depreciation anchor. Opens results live in a new tab — no scraping, no ToS risk, no staleness. Ian can drill in directly. Left a chat escape hatch ('Ask Claude in chat...') so user-initiated Exa-heavy searches can still happen on demand but aren't required for the basic flow. Integrates into CompareView below the map panel.

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-23 · Milestone BATCH-4 completed ✅

Charge-stop planner shipped. src/lib/charge_plan.ts — simulates trip given vehicle, thermal state, route polyline, stations: computes stops as evenly-spaced legs each consuming ~65% SoC window, picks nearest station within 30 km of ideal stop point, computes minutes-per-stop via per-vehicle charging_curve_20c integrated across 15→80% SoC (scaled by current dc_temp_factor from slider). Returns {stops, drive_min, charge_min, total_min, feasibility, note}. src/components/ChargePlanPanel.tsx renders per-vehicle plan with FASTEST badge; shows each stop's station name, arrive/depart SoC, minutes, charging power. Wired into MapPanel below the destination input, shows when destination set and route fetched. Uses OSRM route from BATCH-2 for real road distance. All deeply integrated with physics slider: colder/HVAC-on trips get more stops, each longer.

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-23 · Milestone BATCH-2 completed ✅

Live integrations shipped with graceful fallback. src/lib/ocm.ts — Open Charge Map wrapper: fetches DCFC stations in viewport, localStorage-cached per bbox+day with 24h TTL, filters to LevelID 3, maps OCM payload to Station schema. Falls back to demo data if VITE_OCM_KEY missing or fetch fails. src/lib/osrm.ts — OSRM routing wrapper via public demo server, decodes polyline-5 geometry, cached per (origin,dest) for 7d, falls back to straight-line haversine on failure. MapPanel.tsx rebuilt to use fetchStations + fetchRoute asynchronously; shows 'live DCFC stations (OCM)' or 'demo stations' label; trip panel shows 'X km driving (+Y% vs straight-line) · Z min' when OSRM succeeds. Works end-to-end RIGHT NOW without key (degrades cleanly); drops in full functionality the moment Ian adds VITE_OCM_KEY.

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-23 · Batch BATCH-6 retrospective 📊

Shipping infrastructure done. Changelog is now derived from LEARNINGS (single source of truth). Tauri config simplified to drag-install-only. RELEASING.md has the 4-step flow for Ian's Mac. Remaining session-end work: update SESSION_SUMMARY with full session arc for Ian's AFK return.

*Auto-appended by batch_ritual.py at batch close. Edit freely.*

## 2026-04-23 · Milestone BATCH-6 completed ✅

Packaging + ops scaffolding. (1) scripts/changelog.py auto-generates CHANGELOG.md from LEARNINGS entries (dates grouped, first-sentence summaries). Ran it: produced versioned changelog. (2) RELEASING.md — step-by-step playbook for Tauri desktop build on Ian's Mac: icon generation, npm run tauri:build (3-6 min first compile), Gatekeeper bypass, install to /Applications. (3) Slimmed tauri.conf.json to drag-install-only (.app target, Productivity category). Rust compile has to happen on Ian's Mac — sandbox can't. Snapshot rotation already handled by batch_ritual.py.

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-23 · Batch BATCH-5 retrospective 📊

Decision experience layer shipped. Breakdown drawer + mom mode + battery degradation + iZEV wizard. Biggest insight: the drawer pattern is really the right way to handle transparency — instead of hiding 'why' behind tooltips, make it expandable inline. Now every Adjusted row can show its formula on click. Mom mode is a surprisingly cheap feature (one label lookup); should roll out to every UI text string in a future polish pass.

*Auto-appended by batch_ritual.py at batch close. Edit freely.*

## 2026-04-23 · Milestone BATCH-5 completed ✅

Decision experience layer shipped in one patch. (F-04) Breakdown drawers on every adjusted-for-conditions row + iZEV eligibility row — click row label, drawer expands showing contributing factors (capacity fraction, HVAC draw, DC factor, formula). (P-02) Mom-mode toggle in header — swaps jargon labels via src/lib/plainLang.ts (20+ label mappings). (F-10) Battery degradation projection — new 'Battery life projection' section with 5/8/10-yr range estimates per chemistry (LFP 0.8%/yr, NMC 1.8%/yr, NCA/LMR 2.0-2.2%/yr, per Recurrent fleet data). (F-11) iZEV eligibility wizard — reads MSRP vs category cap, returns Yes/No with reason; program-paused caveat in drawer. Persist middleware covers mom_mode. All validator gates still green.

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-23 · Batch BATCH-1 retrospective 📊

Subagent authoring template worked; 17 records at ~7.6k tokens each on average. Key lesson: the author-template v2 should include a complete example record inline and force drivetrain_variant with a schema reminder (one field was missed). Thermal validator holds green across 17 unverified new vehicles because chemistry curves are generic — more important than per-vehicle calibration. PHEV coverage jumped 1→4.

*Auto-appended by batch_ritual.py at batch close. Edit freely.*

## 2026-04-23 · Milestone BATCH-1 completed ✅

Dataset matured from 20 → 37 vehicles across 9 → 16 brands via subagent author. 7 new brands (Nissan, Genesis, BMW, Volvo, Subaru, Honda, Chrysler) + extended Kia, Toyota, Chevrolet. Subagent produced clean JSON via Write tool (130k tokens, 17 records). Minor fix: bmw-i4-xdrive40-awd was missing drivetrain_variant field; auto-patched from id pattern. Thermal validator still 6/6 green. PHEV coverage 1→4.

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-23 · Milestone F-MAP completed ✅

Mega-patch: map panel + range rings + DCFC stations + trip-distance check in one batch. Leaflet via CDN, OpenStreetMap tiles (free, no key). Default Toronto center, click-to-move. Concentric range rings per compared vehicle live-scale with thermal model. 15 hardcoded Ontario DCFC stations (Tesla/Electrify Canada/Ivy/Flo/ChargePoint) filtered to within 1.2x of the largest range. Nominatim geocoding for destination lookup. Trip verdict per vehicle: ✓ Yes / ⚠ Tight / ✗ No with km margin. Covers F-05, F-06, F-07, and partial F-08 in one patch. MapKit JS key avoided by using OSM instead.

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-23 · Milestone F-hp completed ✅

Per-vehicle heat_pump_min_effective_c override wired through. Default stays -20°C; vehicles can override via an optional CitedValue<number> field. Applied 4 evidence-backed overrides: Tesla Model 3 RWD/AWD and Model Y Juniper → -30°C (octovalve patent + community winter testing); Rivian R1S Gen 2 → -25°C (integrated thermal redesign). The thermal validator caught 2 SPECULATIVE overrides I initially applied (Polestar -15, VW ID.4 -15) that pushed Polestar prediction out of its Recurrent-fleet-data anchor range — fixed by removing them. This is exactly what the validator is supposed to do: catch uncalibrated guesses before they ship. System passes 6/6 anchors again.

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-23 · Milestone F-03 completed ✅

Confidence-badge tooltips upgraded to plain English so anyone (including Ian's mom) can read them. H/M/L now explain themselves: 'High confidence — cross-verified across two or more independent sources', 'Medium — sourced from manufacturer or single reputable third party', 'Low — provisional or changing fast; always verify before buying'. Badge now accepts optional source + notes props and renders them in the hover tooltip. Applied to VehicleRow (overall_confidence) and CompareView (both vehicle card + adjusted-range row). Chrome find confirmed tooltip text renders. Pairs naturally with the DataHealth pill built in I-VAL — dots in header give counts, hover on any row-level badge gives plain explanation.

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-23 · Milestone I-INT completed ✅

Integrated monitoring + learning + prompt-evolution layer across all systems. Built: (1) logs/subagent_runs/ with backfilled entries for D-01 pilot + D-01-ext — every dispatch now has audit JSON with inputs, outcome, usage, and improvements_for_next_run. (2) scripts/prompt_templates/d01_verify.md — versioned prompt evolution (v1→v1.1 documented, v2 planned). (3) scripts/kickoff.py — one-command dashboard showing stage, top queue, seed health, validator status, recent subagent runs, recent learnings. (4) validate_system.py now audits subagent log JSON structure too. End state: every agent dispatch has an inspectable record; prompt templates evolve deliberately; one command ('kickoff') surfaces full system state.

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-23 · Milestone D-01-ext completed ✅

Extended Exa verification across remaining 15 vehicles × 3 fields. Subagent produced 20 field updates, 1 value correction (Mach-E ER AWD range 467→483 km per InsideEVs EPA), and confirmed Model Y Juniper NA specs are still emergent (kept Low with Canadian-availability caveat). Combined pilot + ext: 9→15 vehicles at overall High confidence. Data Health pill shows 15H/4M/1L. All MSRPs stay Low confidence (pricing decays monthly; some dropped 4-15% since seed was written). Thermal anchor validator still 6/6 green through the data shifts.

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-23 · Milestone D-01 completed ✅

PILOT D-01 Exa verification pass: dispatched subagent to verify 5 vehicles × 3 fields (range_km, dc_charge_kw_max, msrp_cad) against web sources. Results: 2 value corrections (IONIQ 5 SE RWD peak DC 258→233 kW [RWD vs AWD mixup]; Kia EV6 LR AWD range 450→475 km [2025 refresh bump]). 6 field confidence upgrades (ranges + DC peaks for Tesla Model 3 AWD, IONIQ 5 RWD, F-150 Lightning, EV6 AWD). 4 MSRP disagreements confirmed — all seed MSRPs drift 4-16% from current Canadian pricing; KEEPING at Low confidence because pricing decays monthly and no live-price integration yet. Overall: 9 vehicles rolled up to High confidence (pill now shows 9H/10M/1L, up from 0/19/1). Thermal validator still green. Template proven for rest of seed.

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-23 · Milestone I-VAL completed ✅

Three validation-infrastructure upgrades shipped together: (1) scripts/validate_thermal.py anchor-test harness — caught real drift on first run (hpMinC was -10°C, too conservative for modern heat pumps; fixed to -20°C, all 6 anchors now green). (2) scripts/snapshot.py — every milestone writes timestamped seed copy to snapshots/. (3) DataHealth.tsx — live confidence breakdown pill in main header shows '0 H / 19 M / 1 L' at a glance; hover tooltip explains. The thermal validator is now wired into milestone.py's gate so model drift fails the ritual. The snapshot is also wired in — every close writes a version. The Data Health pill makes seed maturity visible every session, creating constant gentle pressure to run D-01.

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-23 · Milestone I-17 completed ✅

Validator now warns if any memory file's originSessionId frontmatter field looks malformed (too short, contains whitespace). Runs clean against current 6 memory files.

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-23 · Milestone P-01 completed ✅

Header caption no longer clips at narrow widths — added flex-wrap to the main header and whitespace-normal to the right-side caption. Also dropped the redundant 'Phase 1' label from the subtitle (no longer accurate, we're well past Phase 1).

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-23 · Milestone F-02 completed ✅

Cost-per-100km row added to Adjusted-for-Conditions section. Formula: efficiency_whkm / 1000 × $/kWh × 100. User-editable electricity rate input in TempSlider panel (default 0.17 $/kWh, Ontario blended). Rate persists to localStorage via B-01. Validated live in Chrome: F-150 Lightning $4.32, IONIQ 5 RWD $2.73, Tesla Model 3 AWD $2.26 — math back-checks exactly against stored efficiency values. Polish: show cents (not round to whole dollars) and clean '17¢/kWh' suffix (no stray $).

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-23 · Milestone B-01 completed ✅

Zustand persist middleware added to useAppStore. State synced to localStorage under 'ev-dashboard-state' (version 1). Partialize excludes setter functions. Validated end-to-end in Chrome: clicked Add-to-compare → localStorage populated; location.reload() → localStorage and UI state both persisted. Root cause of compare-tray-loses-state (noted during 3b validation) is fixed. Also means slider position, filter state, and HVAC/precon toggles survive refresh — big UX win.

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-23 · Milestone I-04 completed ✅ — deepened self-learning loop

Three additions that make the self-learning layer actually enforce itself, not just log:

1. **`scripts/validate_system.py`** — cross-checks every feedback artifact (memory frontmatter, MEMORY.md index orphans, SESSION_SUMMARY broken links, CLAUDE.md codebase-map claims, queue row parsing, LEARNINGS chronology, PHASE_METRICS vs seed agreement). Exit 1 on any errors; the milestone ritual refuses to close on error.

2. **Enhanced `scripts/milestone.py`** — now runs a 5-step pipeline with fail-fast: metrics regen → system validation (gate) → LEARNINGS append → SESSION_SUMMARY touch → top-3 queue preview. Adds explicit reflection prompts at the end so "headroom for learning optimization" is behavioral-by-design, not wishful.

3. **End-to-end test passed.** Ran ritual in test mode; validator caught two real drift issues (wrong MEMORY_DIR path, duplicate I-01 queue ID) that I fixed before the run went green. This is exactly the feedback loop I wanted.

**Why this matters:** without the validator, the self-learning system could rot silently — memory files could drift from MEMORY.md, PHASE_METRICS could lose sync with seed, learnings could go out of order. Now any drift fails the milestone gate. The "learning programs feed into each other" ask is now literally mechanical: metrics feeds validator feeds milestone feeds summary feeds queue.

**Failure mode caught by the test:** I had duplicate I-01 rows in the queue (legacy from v4 draft). Validator flagged it. Took ~5 seconds to fix.

**Reflection on the loop itself:** the validator should probably also check that every memory file's `originSessionId` frontmatter field (added by the linter) is actually valid. Not urgent; added as I-17 in the queue.

**Git-in-sandbox limitation discovered:** my sandbox can commit once (initial commit `17a5e93` succeeded) but subsequent commits fail because `.git/index.lock` can't be removed via `rm` — filesystem mount returns "Operation not permitted" on the lock files. The initial git process left lock files behind and I can't clear them. This means milestone.py's future auto-commit step can't be driven from my sandbox; Ian's Mac terminal can handle commits natively (`git commit -am "milestone X"`). Amending the I-04 plan to note: auto-commit is a local-Mac affordance, not a sandbox one.

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-23 · Milestone 3c completed ✅

Charging-curve overlay chart built as pure-SVG component (no dependency). Scales live with slider: F-150 Lightning at 20°C preconditioned shows 150 kW plateau tapering to 55 kW@80%; at -20°C cold-soaked, curve flattens to ~52 kW peak, tapering to ~20 kW. Directly addresses the 'ramp speeds' ask. Legend shows real-time peak + percentage of rated. Validated in Chrome via screenshots.

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-23 · Milestone 3b completed ✅

Temperature + preconditioning slider wired into CompareView. Every row in the 'Adjusted for conditions' section updates live from the physics model in src/lib/thermal.ts. Validated via Claude-in-Chrome at +20°C baseline and −20°C cold-soaked: F-150 Lightning drops 515→333 km, 150→53 kW DC peak, confidence auto-downgrades to Low at temp extremes. All four visible outputs back-calculate to the model's curve parameters within 1 km / 1 kW tolerance.

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-23 · Phase 1 scaffold complete

**Worked well:**
- `CitedValue<T>` schema for every data field. Forces discipline at author time instead of bolting provenance on later.
- Confidence badges exposed in the UI — makes the honesty visible, not hidden in JSON.
- Generation-aware entries (separate IONIQ 5 pre-2025 / 2025+) — already catches differences other comparison sites collapse.
- Splitting the app into web-dev mode and Tauri-desktop mode. Ian can get instant feedback via `npm run dev` without needing Rust to compile first.

**Didn't work / to change:**
- The seed.json grew to ~500 lines for 14 vehicles. At 60+ vehicles this will be unwieldy in a single file — split into per-brand JSON files in Phase 2.
- My 2026 MSRP knowledge is dated. Every MSRP is Low confidence. Phase 2 scraper must refresh these before any purchase decision.

**Next time:**
- When adding scrapers, store raw responses as test fixtures under `scrapers/fixtures/` so we can add unit tests without requiring network.
- Every field added should go through a `validate.py` check before landing in the dataset.

## 2026-04-23 · Seed expansion 14 → 20 (Milestone 1e) ✅

Added 6 vehicles across 2 new brands (Volkswagen, Polestar). Total: 9 brands, 20 vehicles.
Powertrain mix: 19 BEV / 1 PHEV. Body mix: 12 Crossover / 6 Sedan / 1 Truck / 1 SUV.
Drivetrain mix: 11 AWD / 9 single-motor — close to even, which validates the two-trim-per-model rule.
Confidence: 19 Medium / 1 Low (Tesla Model Y Juniper placeholder).

**Observation:** seed.json is now ~1,000 lines. At 60 vehicles it will be painful to hand-edit. Phase 2 should split it into per-brand files OR move to SQLite entirely.

## 2026-04-23 · Thermal physics model built (Milestone 3a) 🟡

`src/lib/thermal.ts` is in and has a sanity-check test alongside (`thermal.test.ts`).
The model takes vehicle + {temp_c, preconditioned, hvac_on, speed_kph} and returns adjusted range, usable kWh, peak DC kW, efficiency, plus a confidence downgrade at extreme temps.
Parameter curves come from Geotab, Recurrent, Fastned, P3, and Bjorn Nyland data — all cited inline.

**Can't verify the test actually passes in this sandbox** (no `tsx` installed). Needs one run of `npx tsx src/lib/thermal.test.ts` on your Mac after `npm install`. Add to Milestone 3b checklist.

**Observation:** the confidence-rollup function currently uses hard thresholds (distance from 20 °C) which is crude. Real refinement: fit a per-vehicle calibration curve against published winter-test anchor points in Phase 3d, and let the model report an absolute-uncertainty band instead of a three-level badge.

## 2026-04-23 · Shifted plan to milestone-sliced structure

Ian rightly pointed out that big phases = few review gates = weak learning signal. Plan rewritten (v3) with 25+ small milestones, each ending in a LEARNINGS update. This also makes the skills — especially `/review` — more useful because they can be applied to each slice.

## 2026-04-23 · Self-learning system optimization pass

Ian asked for a deep check on the feedback/self-learning systems. Audit found three real gaps:

1. **Metrics were hand-updated** — risk of drifting from reality. **Fixed:** `scripts/metrics.py` regenerates `PHASE_METRICS.md` from `seed.json` deterministically. Data integrity check is now automated (0 issues found on current seed).
2. **No single landing page** — four docs meant anyone (including future-me) had to crawl all of them to know where we are. **Fixed:** `SESSION_SUMMARY.md` created as the one-stop index.
3. **Plan split between two docs** — `PROJECT_PLAN.md` (strategic) and `AUTONOMOUS_PLAN.md` (tactical milestones) didn't cross-reference cleanly. Partially addressed by `SESSION_SUMMARY.md` linking both; full reconciliation deferred to avoid churn.

**What's now guaranteed to never go stale:**
- PHASE_METRICS.md (auto-generated; run the script)
- Data integrity status (validated in the same run)
- Project links (all flow from SESSION_SUMMARY)

**Still manual (accepted):**
- LEARNINGS.md — prose reflection by design; automating it would dilute signal.
- Milestone status flags in AUTONOMOUS_PLAN.md — could mechanically update from git commits one day, but too much ceremony for now.

**Skill gap identified:** `init` skill isn't invoked yet. A generated `CLAUDE.md` would compound for every future session. Worth running next session start.

**Teaching moment:** the learning layer works best when it's cheap to consult. If a doc takes >30 seconds to figure out, it's already decayed. The optimization target is *glanceability*.

## 2026-04-23 · Phase 1 visually validated ✅

Chrome extension connected. Drove `localhost:1420` via Claude-in-Chrome, navigated, screenshotted, clicked three "Add to compare" buttons, opened the compare view.

**What worked on first try (zero iterations):**
- Navigation + page load — no console errors, only Vite connect + React DevTools nudge.
- Dark theme rendering — ink-900 background, accent colors, typography all as designed.
- Brand-grouped directory — Chevrolet, Ford, Hyundai, Kia, Polestar groups with correct trim counts.
- Filter bar — search, Powertrain pills (BEV/PHEV/EREV), Body pills, Max $/Min km inputs, Reset.
- Vehicle rows — model, generation label, trim label, MEDIUM confidence badge, spec summary line, "Add to compare" button.
- Compare tray (bottom sticky) — three vehicles stacked as removable chips, "3 / 4" counter, Clear + Compare buttons; Compare disabled until ≥2 selected.
- Compare view (fullscreen) — vehicle cards with brand/model/trim/confidence, sectioned spec table (IDENTITY, RANGE & BATTERY, CHARGING), mono-font values, ← Back button.

**Minor polish to address later (none blocking):**
- `SINGLE_MOTOR` shows as raw enum in compare view's Drivetrain row. Want pretty-print → "Single-motor (RWD/FWD)".
- Header-right caption "Long-range trims only · Generation-aware · All numbers cited" clips at narrow widths. CSS flex-wrap.

**Workflow lesson:** Claude-in-Chrome extension is the right tool. DOM-aware clicks via `ref_N` are 100% reliable, screenshots crisp, console readable. Computer-use's pixel-level approach would have been fragile and slow by comparison. Recommend: for all UI milestones going forward, Chrome-MCP is the default validation path.

## 2026-04-23 · Capability audit + workflow change

Ian added connectors and capabilities. Big unlocks for the project:
1. **Computer use** — I can see his screen, click, drag. Ends the "it should work" era; every UI milestone now gets visual verification.
2. **Claude in Chrome** — DOM-aware browser control. Much faster than pixel-level computer use for testing a web app. This becomes the primary validation path for `npm run dev`.
3. **Exa web search** — replaces most of the scraper framework for personal use. On-demand spec verification instead of batch scraping. Confidence upgrades become achievable.
4. **`init` / `/review` / `/security-review`** — already available as bundled skills; I was wrong earlier to treat them as installable.

**Plan revision:** Phase 2 rewritten. Scraper-heavy sections deferred; Exa verification is the new Milestone 2b. Every milestone now ends with a Chrome-MCP or computer-use visual check instead of theoretical "should work."

**Teaching moment:** before proposing external infrastructure (scrapers, etc.) always audit what's already available. A one-off Exa query beats a 1000-line scraper framework when you only need verification for 20 vehicles.

## 2026-04-23 · Major scope simplification — personal tool, not a shipped product

Ian clarified this is a private tool for him and his mom to help with his EV purchase decision. Nobody else will ever install it. Implications I absorbed:

- Dropped all of Phase 6's shipping infra (signing, notarization, auto-update, security-review, .dmg distribution). Old Phase 6 had 5 items; new Phase 6 has 2, both optional.
- Tauri demoted from "required" to "nice-to-have dock icon." The web-app path is a perfectly valid endpoint.
- Scraper work simplified — no need for rotating-proxy complexity; personal use = low request volume.
- Added a NEW Phase 6 item: accessibility pass for non-technical users (his mom). Jargon-heavy spec tables aren't great for showing a parent.

**Teaching moment I want to remember:** scope clarifications compound. I spent tokens earlier describing "signed .dmg," "Apple Developer $99/yr," "Phase 5 routing engine tradeoffs" — a lot of that was for a product audience that doesn't exist here. Lesson: before proposing sophisticated infrastructure, ask "is this being shipped?" — the answer reshapes the plan.

## Caveats I want a human to review

- **iZEV status as of 2026-04-23.** I've coded every federal incentive as $0 with a note. If iZEV resumes mid-2026, every vehicle's `federal_izev_cad` field needs re-evaluation.
- **Ontario provincial rebate.** Coded as $0, High confidence. If this changes, update seed + scraper rules.
- **Tesla Model Y Juniper.** Listed as a Low-confidence placeholder. Kill or refresh once NA specs stabilize.
- **Rivian Canadian availability.** Their Canadian distribution is evolving; MSRP estimates are weak.
