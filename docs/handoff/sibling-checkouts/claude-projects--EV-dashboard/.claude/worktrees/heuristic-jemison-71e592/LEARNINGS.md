# Learnings log

Chronological record of what worked, what didn't, and what to change next. Dense, dated, actionable. Updated after every significant work-queue item in `AUTONOMOUS_PLAN.md`.

---

## 2026-04-25 · Milestone N-FINAL completed ✅

Cluster N v2 final handoff: .resume.md updated with 51-vehicle 23-brand recap. All 14 phases complete (Phase 0 bookkeeping + Phase 1 infra + Phase 2 D-01 + Phase 3 D-04 7-batch + Phase 4 F-09 + Phase 5 skip-key-gated + Phase 6 handoff). Deferred: F-05/06/07/08 H8c (Ian keys + manual git). Next session: Cluster J/K architectural OR run refresh_used_market.py after EXA_API_KEY set.

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-25 · Milestone F-09 completed ✅

refresh_used_market.py cache-warmer for UsedMarketPanel.tsx. Reads seed (38 unique brand-model pairs), pre-fetches Exa queries, writes public/used-market-cache.json. Without EXA_API_KEY: writes empty stub with warning - UI gracefully falls through. With key: nightly cron via scheduled-tasks MCP can keep cache fresh. UsedMarketPanel.tsx already wired client-side; this adds server-side pre-warm.

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-25 · Milestone D-04 completed ✅

27 new vehicles 24->51 + 12 brands 11->23. 7 batches inline Exa research. 4 skips not-sold-in-CA (Tesla Y RWD, Porsche Taycan base RWD, BMW i5 eDrive40, Honda Prologue FWD). Brand-name fixes porsche/honda. Spectre body Coupe->Sedan for schema. apply_research atomic + validate green per batch. Bare-MSRP convention with iZEV=0 + Ontario=0 disclaimers.

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-25 · Self-optimization sweep #6

All clean. No drift detected.

## 2026-04-25 · Milestone D-01 completed ✅

Exa-verify all 24 vehicles via 5 parallel agents → 51 field patches + 1 deletion (Tesla Model Y Juniper LR RWD: US-only). Bare-MSRP convention applied. ALL ≥3-source corrections applied per Ian policy. Wrong-trim fixes (VW ID.4 Pro vs Pro S, Equinox 2LT vs 3LT). Net: 23 vehicles, all 3 D-01 fields now mostly High confidence.

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-24 · Milestone P1-INFRA completed ✅

Cluster N v2 Phase 1: I-09 changelog.py (auto from git log) + I-08 health badge in queue.py + I-10 snapshot.py (chromium headless or Chrome.app fallback) + I-13 milestone memory rsync to ~/.claude/backups + F-11 incentivePaused flag + paused disclaimer + P-02 audit (no leaks). milestone.py 13->16 steps.

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-24 · Milestone N-PLAN completed ✅

Cluster N v2 plan + quiet hint hook + d04_list.json (30 confirmed CA vehicles) + AUTONOMOUS_PLAN bookkeeping (H8a/H8b done, I-05 to I-09) + iZEV weekly cron via scheduled-tasks MCP

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-24 · Milestone I-06 completed ✅

scripts/quiet.py — RTK-style output compressor (tsc/vitest/cargo/git specializations) + 14 unit tests + milestone.py wired automatically + CLAUDE.md docs. Project-scoped, no external install. Implements most-effective tip from rtk-ai/rtk roundup

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-24 · Milestone F-10 completed ✅

degradation.ts chemistry-aware Recurrent profiles (NMC/NCA/LFP/LMR/UNKNOWN). Year-1 step + annual decay model. CompareView 5/8/10yr rows now use it. 13 new vitest cases (19 total in file). LFP outperforms NMC test included

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-24 · Self-optimization sweep #5

All clean. No drift detected.

## 2026-04-24 · Milestone I-04 completed ✅

research_client.py — Exa + Apify Python bindings, .env.local loader, 7 unit tests, --status / --search / --fetch CLI. Graceful no-key fallback. Docs in external_keys.md §4

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-24 · Milestone D-04 completed ✅

DEMO of parallel-research pipeline: 6 agents in parallel → merged JSON → apply_research.py → Hyundai Kona Electric SX2 Preferred (24 vehicles total). Total wall-clock ~70s vs ~4× serial. Backup written; validate green

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-24 · Milestone I-05 completed ✅

apply_research.py + 6 unit tests — closes parallel-research pipeline. Validates result schema, atomic seed.json patch, backup + revert on validate.py red

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-24 · Milestone RESEARCH-INFRA completed ✅

research playbook + research.py + research_vehicle.py — parallel-dispatch default. Source matrix, Exa+Apify+WebSearch tool inventory, vehicle-spec sweep template (6 disjoint agents). New task tags: research-deep + ui-tweak-multi-file

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-24 · Milestone D-03 completed ✅

add Genesis GV60 Advanced AWD (E-GMP 77.4 kWh) — 23 vehicles, 11 brands. Performance trim skipped per project rule; RWD not sold in Canada

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-24 · Self-optimization sweep #4

All clean. No drift detected.

## 2026-04-24 · Milestone P-01 completed ✅

header right-pill flex-wraps + caption truncates so nothing clips at narrow widths

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-24 · Milestone F-04 completed ✅

WhyDrawer collapsible breakdown panel — 4 levers + rated efficiency, per-vehicle columns, 4 vitest cases

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-24 · Milestone D-02 completed ✅

add Nissan Ariya FWD + e-4ORCE AWD (87 kWh) — 22 vehicles, 10 brands

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-24 · Milestone H11 completed ✅

stress-test + empirical learning loop: observation.py NDJSON helper + calibrate.py with conservative-down/eager-up rules + 8 unit-test scenarios + stress_test.py canonical battery + docs + milestone steps 11/12 + apply_calibration in cost_model+task_complexity

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-24 · Milestone H10 completed ✅

bidirectional model recommender: cost_model.py + recommend_model.py + 6 unittest branches + queue.py grouped deferred summary + milestone step 10 + CLAUDE.md policy + level_recs/deferred_tasks logs gitignored

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-24 · Self-optimization sweep #3

All clean. No drift detected.

## 2026-04-24 · Milestone H9 completed ✅

auto-detect reasoning level: detect_level.py reads Claude Desktop session JSON for active model+effort; check_level.py gates tasks via task_complexity.py min-level table; queue.py --respect-level filters queue by inferred task tag; CLAUDE.md task-boundary policy documented

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-24 · Milestone H8 completed ✅

H8a archive inject_thermal_profiles.py + H8b 5th-vehicle visible Tray-full label + cluster-I spec for OpenEV importer (medium-implementable)

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-24 · Milestone H-cluster completed ✅

token ROI + autonomy: caveman-everywhere + debug logging (Vite sink plugin + Rust tracing + DebugPanel overlay ⌘⇧D) + drive_app log-replay harness + medium playbook + research capture + roadmap v2 (Clusters I-M)

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-24 · Milestone F-cluster completed ✅

Cluster F complete: user_guide.md, CreditsPanel, global focus rings, tailwind token lock, Tauri .app 8.1MB ARM64 build success; F2 accessibility paused for Ian input

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-24 · Milestone F-1 completed ✅

plain/geek mode: labels.ts + toggle + VehicleRow + CompareView BiLabel; Leaflet double-init fix; tray persist verified

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-24 · Self-optimization sweep #2

All clean. No drift detected.

## 2026-04-24 · Milestone F1 completed ✅

F1: labels.ts + plainMode + Plain/Geek toggle pill + BiLabel rows in CompareView

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-24 · Milestone E5 completed ✅

E-cluster: 4-tab CompareView + Rust trip planner + used market + degradation rows + iZEV scaffold

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-24 · Milestone D5 completed ✅

D-cluster: Leaflet map + per-vehicle range rings + DCFC pins + CompareView tab bar + Rust thermal plugin

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-24 · Milestone D-cluster completed ✅

D0 Rust thermal plugin 11 tests green. D1 ext keys done. D2-D4 MapPanel Leaflet range rings 15 Ontario DCFC pins. CompareView tab bar Specs+Map. cargo test in milestone ritual. Rust 1.95 brew upgrade.

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-24 · Milestone C-cluster completed ✅

cluster-C: F-02 cost/100km+TOU dropdown, B-01 persist middleware, F-03 badge tooltips, C4 rollupConfidence fix, C6 drivetrain prettifier+empty state

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-23 · Self-optimization sweep #1

All clean. No drift detected.

## 2026-04-23 · Milestone cluster-B completed ✅

thermal profiles all 20 vehicles + B2 per-vehicle thermal.ts + B3 exa pass 17 corrections + B4 juniper deep-dive + B5 drift monitor + caveman skills installed

*Auto-appended by milestone.py. Edit freely to add detail.*

## 2026-04-23 · Milestone cluster-A completed ✅

foundation — memory rituals tests zod hooks docs. smoke.sh green. 50/50 tests. commit 27b1fc4.

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
