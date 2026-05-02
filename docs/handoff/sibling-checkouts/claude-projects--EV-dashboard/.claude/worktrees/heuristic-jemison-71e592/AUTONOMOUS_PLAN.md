# Autonomous plan — live queue (v4)

**Rewritten 2026-04-23.** The old Phase 1–6 milestone list was rigid and got obsoleted as we learned (scrapers dropped, Exa adopted, computer-use unlocked, Chrome-MCP adopted). This replaces it with a **live priority queue**. Items stand alone, get re-ranked every time work completes, and can be added/dropped without ceremony.

## How this plan is used

1. **Start of work:** re-rank the queue (below). Pick the top READY item. Execute.
2. **End of milestone:** run `scripts/milestone.py <id> "<summary>"`. Then re-rank. Then pick again.
3. **Observing a bug, gap, or polish need:** insert an item into the queue with a short blurb. Don't stop executing.
4. **Learning obsoletes an item:** move it to the Graveyard with a one-line reason.

**Ranking formula** (applied by me, mentally, every cycle):

```
priority = value_to_ian × readiness / cost
```

Where:
- `value_to_ian` ∈ {1 low, 2 useful, 3 high, 4 critical} — how much this improves the buying decision tool
- `readiness` ∈ {0 blocked, 0.5 partial, 1 ready} — can I execute without waiting on Ian
- `cost` ∈ {1 quick ~30 min, 2 medium ~1h, 3 large ~2h+} — rough effort

Tie-breakers, in order: (a) unblocks-the-most-other-items, (b) most recently validated user interest, (c) builds momentum in the current thread of work.

## Item type prefixes

- **F** — feature (new capability users see)
- **B** — bug (something broken)
- **P** — polish (UX refinement, small CSS/copy)
- **D** — data (seed / dataset work)
- **I** — infra (tooling, automation, docs)

## Queue (ranked, live)

### ⚡ Now — top of queue

| # | ID | Title | Value | Cost | Ready | Notes |
|---|---|---|---|---|---|---|
| 1 | ~~D-01~~ | ~~Exa verification pass across all 20 vehicles~~ | — | — | — | **✅ DONE 2026-04-25** — 51 field patches across 24 vehicles + 1 deletion (Tesla Y RWD US-only); bare-MSRP convention applied |
| 2 | ~~F-04~~ | ~~"Why did this number change?" breakdown drawer on slider rows~~ | — | — | — | **✅ DONE 2026-04-24** — WhyDrawer.tsx + 4 vitest cases |
| 3 | ~~P-01~~ | ~~Header caption clips at narrow widths~~ | — | — | — | **✅ DONE 2026-04-24** — App.tsx flex-wrap + truncate |
| 4 | ~~D-02~~ | ~~Add Nissan Ariya (FWD + e-4ORCE AWD LR) to seed~~ | — | — | — | **✅ DONE 2026-04-24** — 22 vehicles, 10 brands |
| 5 | ~~D-03~~ | ~~Add Genesis GV60 (RWD + AWD LR) to seed~~ | — | — | — | **✅ DONE 2026-04-24** — Advanced AWD only; RWD not sold in Canada, Performance trim out-of-scope |

### 🟡 Next — ready but lower priority

| # | ID | Title | Value | Cost | Ready | Notes |
|---|---|---|---|---|---|---|
| 6 | ~~I-04~~ | ~~Direct-API research bindings (Exa + Apify Python clients in `scripts/`)~~ | — | — | — | **✅ DONE 2026-04-24** — research_client.py + 7 unit tests; .env.local loader; graceful fallback when keys unset |
| 7 | ~~I-05~~ | ~~Vehicle-research pipeline auto-merge: `apply_research.py <plan-json>` → seed.json patch~~ | — | — | — | **✅ DONE 2026-04-24** — apply_research.py + 6 unit tests; backup + atomic write + revert-on-validate-fail |
| 8 | ~~I-01~~ | ~~Git init + first commit~~ | — | — | — | **✅ DONE** — repo initialized; initial commit `17a5e93` landed |
| 9 | ~~I-02~~ | ~~Move memory from `.auto-memory/` reminders into CLAUDE.md cross-refs~~ | — | — | — | **✅ DONE (Cluster A A1/A3)** — canonical + in-repo memory bootstrapped |

### 🟠 Waiting — blocked on external input

| # | ID | Title | Value | Cost | Ready | Blocker |
|---|---|---|---|---|---|---|
| 11 | **F-05** | Map panel skeleton (Apple MapKit JS) | 3 | 2 | 0.5 | Needs MapKit JS key from Ian (free via Apple ID) |
| 12 | **F-06** | Range rings on map, driven by thermal model | 3 | 1 | 0 | Depends on F-05 |
| 13 | **F-07** | DCFC station pins from Open Charge Map | 2 | 2 | 0.5 | Needs OCM API key (free at openchargemap.org) |
| 14 | **F-08** | Trip planning — pick destination, see route + charge stops | 3 | 3 | 0 | Depends on F-05 and decision between ABRP API vs self-built |

### 🔵 Considered later — useful, not urgent

| # | ID | Title | Value | Cost | Ready | Notes |
|---|---|---|---|---|---|---|
| 15 | ~~D-04~~ | ~~Bulk seed expansion to ~40 vehicles~~ | — | — | — | **✅ DONE 2026-04-25** — 27 new vehicles 24→51, 12 new brands 11→23. Bare-MSRP. 4 CA-only skips. |
| 16 | ~~F-09~~ | ~~Used-market surface — Exa to pull AutoTrader/Kijiji listings~~ | — | — | — | **✅ DONE 2026-04-25** — UsedMarketPanel.tsx client-side wired + `scripts/refresh_used_market.py` server-side cache-warmer |
| 17 | ~~F-10~~ | ~~Battery degradation projection (Recurrent data)~~ | — | — | — | **✅ DONE 2026-04-24** — `src/lib/degradation.ts` chemistry-aware + 19 vitest cases |
| 18 | ~~F-11~~ | ~~Incentive eligibility wizard per vehicle (iZEV MSRP caps)~~ | — | — | — | **✅ DONE 2026-04-25** — `src/lib/incentives.ts` + paused disclaimer in CompareView |
| 19 | ~~I-03~~ | ~~Scheduled monthly iZEV status check via Exa~~ | — | — | — | **✅ DONE 2026-04-25** — weekly Wed 9:09am cron via scheduled-tasks MCP, logs to `logs/izev_status_check.md` |
| 20 | ~~P-02~~ | ~~Mom-friendly mode — plain-English labels~~ | — | — | — | **✅ DONE (Cluster F)** — labels.ts BiLabel system + plainMode toggle. Audit 2026-04-25 confirmed no raw enum leaks. |
| 21 | ~~I-09~~ | ~~CHANGELOG.md — user-readable per-cluster change log~~ | — | — | — | **✅ DONE 2026-04-25** — `scripts/changelog.py` auto-generates from git log, wired into milestone step 14 |
| 22 | ~~I-08~~ | ~~Health dashboard in SESSION_SUMMARY~~ | — | — | — | **✅ DONE 2026-04-25** — `scripts/queue.py` injects 4-check 🟢 badge in SESSION_SUMMARY header |
| 23 | ~~I-10~~ | ~~Screenshot archive~~ | — | — | — | **✅ DONE 2026-04-25** — `scripts/snapshot.py` chromium-headless, milestone step 15, graceful skip |
| 24 | ~~I-13~~ | ~~Auto-memory backup~~ | — | — | — | **✅ DONE 2026-04-25** — milestone step 16 rsync to `~/.claude/backups/ev-dashboard_<ts>/` |
| 25 | **K-03** | Playwright E2E harness — replaces drive_app.py log-replay | 2 | 2 | 1 | Real button-driving instead of log inspection. Zero external keys. 5+ canonical scenarios |
| 26 | **I-14** | Add `scripts/quiet.py` to PreToolUse hook auto-rewrite (transparent wrapping) | 2 | 1 | 1 | Currently hint-only. Auto-wrap would save 70-95% of verbose Bash output without needing me to remember |
| 27 | **I-15** | OpenEV Data importer (open-ev-data/open-ev-data-dataset Apache 2.0) — automate seed expansion | 3 | 3 | 1 | Cross-validates seed against community dataset. Cuts manual maintenance ~70% |
| 28 | **I-16** | `validate.py --openev-check` rule: every seed vehicle matches an OpenEV row, diffs flagged | 2 | 1 | 0.5 | Depends on I-15 |
| 29 | **K-01** | OSRM/Mapbox real road routing for trip planner v2 | 3 | 3 | 0.5 | Replaces straight-line haversine. Needs Mapbox key OR self-hosted OSRM Docker |
| 30 | **K-02** | Historical Ontario weather overlay for trip planner | 2 | 2 | 1 | NRCan + Environment Canada climate normals (free public API) |
| 31 | **J-01** | MapLibre GL swap behind `VITE_MAP=maplibre` feature flag | 2 | 3 | 1 | 40-60% FPS on Apple Silicon (Metal). Defer until Leaflet feels slow |

### 🪦 Graveyard (dropped, kept for history)

- **Old 2c-g** — Python scraper framework, OEM site scrapers, merge/reconcile logic, Refresh button wiring. *Dropped because: Exa web search replaces the per-source scraping need for a personal-use dataset of 20–60 vehicles. One Exa query beats a 1000-line scraper framework.*
- **Old 4a-c** — AutoTrader/Kijiji scrapers, dedupe DB. *Dropped because: same Exa substitution logic, plus these sites are hostile to scraping. Replaced by F-09.*
- **Old 6b-e** — Code signing, notarization, auto-update, .dmg release, security review. *Dropped because: personal tool, not a shipped product. Ian confirmed 2026-04-23.*

## Principles (do not re-litigate)

1. **Scientific rigor.** Every number cited, every confidence flagged honestly. Never fabricate precision.
2. **Personal use only.** No shipping infra, no signing, no distribution.
3. **Long-range trims only.** Longest single-motor + longest AWD per generation. No base, no performance.
4. **Generation-aware.** IONIQ 5 pre-2025 ≠ IONIQ 5 2025+. Always separate entries.
5. **Glanceable docs.** If a doc takes >30 seconds to read, it's decayed.
6. **Full-gas execution.** When autonomy is granted, chain items. No asking to confirm.

## Capability ledger (what I can do on Ian's Mac)

✅ Workspace folder mount · Chrome-MCP on localhost · Computer-use (with per-app grants) · Exa web search · Scheduled tasks · `.command` launchers · `init` / `/review` / `/security-review` skills · Memory system · Ritual scripts (`metrics.py`, `milestone.py`)

⏸️ Needs Ian's one-time action to unlock: Apple MapKit JS key · Open Charge Map key · ABRP key (if we choose that path)

## History — completed items

- ✅ **1a–e** — MVP scaffold, 20-vehicle seed, compare view, setup/launcher `.command` files, seed expansion (14→20)
- ✅ **2a** — Data-quality validator `scripts/metrics.py` (auto-generates PHASE_METRICS.md with integrity check)
- ✅ **3a** — Thermal physics model `src/lib/thermal.ts` + unit test
- ✅ **3b** — Temperature/preconditioning slider wired into CompareView
- ✅ **3c** — Charging-curve overlay chart (pure-SVG, no deps) live-updating with slider
- ✅ **I-00** — Self-learning rituals (metrics.py, milestone.py, SESSION_SUMMARY, LEARNINGS protocol)
- ✅ **I-**(meta) — CLAUDE.md for codebase orientation
- ✅ **F-02** — Cost-per-100 km + TOU dropdown in CompareView (Cluster C)
- ✅ **F-03** — ConfidenceBadge title tooltips (Cluster C)
- ✅ **B-01** — Compare tray persistence via Zustand persist middleware (Cluster C)
- ✅ **H1–H11** — Caveman policy, debug logging, automation harness, recommender, stress test battery, empirical learning loop (Cluster H)
- 🔄 **Cluster A (in progress 2026-04-23)** — full rework of the autonomous loop. Specs, memory bootstrap, Vitest, Zod runtime validation, extended milestone.py ritual, Claude Code hooks, queue automation, data-integrity validator, caveman writing style, doc drift fixed. See `specs/cluster-A-foundation.md` and `.claude/plans/this-project-was-being-gentle-adleman.md`.

## Post-F roadmap (Clusters H–M) — appended 2026-04-24

Cluster H (token ROI + autonomy + roadmap v2) is complete. Items below are the standing backlog for future sessions. Full cluster specs live in `.claude/plans/this-project-was-being-gentle-adleman.md` under "Future roadmap".

### H8 — cleanup (safe for medium)
- ~~**H8a**~~ ✅ DONE 2026-04-24 — `scripts/inject_thermal_profiles.py` archived to `scripts/_archive/`; no live references
- ~~**H8b**~~ ✅ DONE (Cluster F) — VehicleRow.tsx already disables button + tooltip when tray full (4)
- **H8c** (value=2, cost=1) — Ian merges worktree into master (manual `git stash` + `git merge --no-ff`, see `.resume.md`)

### Cluster I — OpenEV Data integration
- **I-01** (value=3, cost=3) — OpenEV Data importer + seed merge script (Apache 2.0 upstream @ open-ev-data/open-ev-data-dataset)
- **I-02** (value=2, cost=1) — `validate.py` rule: every seed vehicle matches an OpenEV Data row; diffs flagged in `logs/diffs/`

### Cluster J — MapLibre Metal
- **J-01** (value=2, cost=3) — MapLibre GL swap behind `VITE_MAP=maplibre` feature flag (defer until Leaflet feels slow)

### Cluster K — Real routing + weather + E2E
- **K-01** (value=3, cost=3) — OSRM self-hosted or Mapbox Directions integration for trip planner v2
- **K-02** (value=2, cost=2) — historical Ontario weather overlay for trip-planner confidence
- **K-03** (value=2, cost=2) — Playwright E2E harness, replaces `drive_app.py` log-replay

### Cluster L — Live inventory
- **L-01** (value=3, cost=2) — Apify PlugShare scraper for Ontario DCFC live availability
- **L-02** (value=3, cost=2) — Exa-backed AutoTrader/Kijiji used-listings cache (24-h localStorage)

### Cluster M — SwiftUI rewrite (Ian-decision only)
- **M-01** (value=?, cost=8) — SwiftUI prototype (only if app still feels "website-in-a-window" after I–L)

## Cadence for re-ranking

- **After every milestone:** re-rank queue (usually small adjustments).
- **After Ian expresses a new preference:** insert relevant item near top, re-rank.
- **After observing a bug:** insert as B-### with value ≥2 if user-visible, run to fix if cost=1.
- **After every 5 completed items:** consider invoking `/consolidate-memory` and doing a deeper pruning pass.
- **End of session:** update SESSION_SUMMARY with top-3 next items.
