# CLAUDE.md — EV Dashboard project

**For any Claude session starting fresh on this codebase.** Read this first. Then SESSION_SUMMARY.md for current stage. Everything else links from there.

## What this is

A personal-use Mac app for Ian McAdam (Ontario, first-time EV buyer) to compare every EV / PHEV / EREV for sale in Canada. New and used. Not a shipped product — no signing, no distribution, no auto-update. Ian runs it on his MacBook Pro; he and his mom use it to research his next vehicle.

## Non-negotiable principles

1. **Scientific rigor.** Every number displayed is cited and tagged with confidence (High / Medium / Low). Never fabricate precision — mark Low and move on.
2. **Traceability.** Every claim has a `source` field pointing to the URL it came from, with the date accessed. Stored inline in seed.json.
3. **Personal use only.** If a proposal smells like "for shipping," kill it. No code signing, notarization, or distribution infra.
4. **Scope discipline.** Long-range trims only: longest-range single-motor variant + longest-range AWD variant. Skip base trims, skip performance trims. Distinct entries per generation.

## Codebase map

```
EV dashboard/
├── CLAUDE.md                       ← you are here
├── SESSION_SUMMARY.md              ← current stage, resume pointer
├── PROJECT_PLAN.md                 ← strategic plan (what/why/scope)
├── AUTONOMOUS_PLAN.md              ← tactical milestone board + rituals
├── LEARNINGS.md                    ← dated prose log (append-only)
├── PHASE_METRICS.md                ← auto-generated; DO NOT hand-edit
├── README.md                       ← quickstart for running the app
├── First-Time-Setup.command        ← double-click: installs dev tools
├── Start-EV-Dashboard.command      ← double-click: launches web-mode app
├── Start-Desktop-App.command       ← double-click: launches Tauri desktop app
├── scripts/
│   ├── metrics.py                  ← regenerates PHASE_METRICS.md
│   └── milestone.py                ← ritual runner — call after every milestone
├── src/                            ← React + TypeScript frontend
│   ├── types.ts                    ← Vehicle, CitedValue, etc.
│   ├── lib/
│   │   ├── format.ts               ← CAD/km/kW/kWh formatters
│   │   ├── thermal.ts              ← PHYSICS MODEL (core IP)
│   │   └── thermal.test.ts         ← sanity assertions
│   ├── data/seed.json              ← the 20-vehicle curated dataset
│   ├── store/useAppStore.ts        ← Zustand: filters + compare tray
│   └── components/
│       ├── FilterBar.tsx
│       ├── BrandList.tsx
│       ├── VehicleRow.tsx
│       ├── CompareTray.tsx
│       ├── CompareView.tsx
│       └── ConfidenceBadge.tsx
└── src-tauri/                      ← Rust + Tauri desktop shell
```

## Tech stack choices — and why

| Layer | Choice | Why |
|---|---|---|
| Desktop shell | Tauri 2 | Apple Silicon native, tiny bundle, far better than Electron on Mac |
| UI | React + TS + Vite | AI-coding-friendly, fast HMR |
| Styling | Tailwind + custom tokens | Clean dark-showroom aesthetic; no shadcn because not needed at this size |
| State | Zustand | Minimal boilerplate for filter + compare state |
| Local DB | SQLite (Phase 2+) | File-based, zero-config, perfect for ~60-row dataset |
| Scrapers | Python + Playwright (Phase 2) | Best scraping ecosystem; mostly deferred in favor of on-demand Exa verification |
| Data source | Hand-curated seed.json w/ citations (Phase 1) → Exa verification (Phase 2b) | Personal use = one user = no scrape infra needed |
| Physics model | Pure TS, parameterized per vehicle | Published curves (Geotab, Recurrent, Fastned, Bjorn Nyland, P3) |

## Data model

`seed.json` → `Vehicle[]`. Every measured field is a `CitedValue<T>`:

```ts
{
  value: T | null,
  source?: { url, name, accessed: "YYYY-MM-DD" },
  confidence: "High" | "Medium" | "Low",
  notes?: string
}
```

See `src/types.ts` for the full shape.

**Generations matter.** IONIQ 5 pre-2025 and IONIQ 5 2025+ are *different vehicles* in this data. Never collapse them — battery size, thermal system, and charging curve all change.

## The self-learning system

Five linked documents. Update rituals are automated — don't hand-patch these unless fixing prose:

1. `SESSION_SUMMARY.md` — landing page, links everything
2. `LEARNINGS.md` — append-only dated log (auto-appended by `scripts/milestone.py`)
3. `PHASE_METRICS.md` — **auto-generated** by `scripts/metrics.py`
4. `AUTONOMOUS_PLAN.md` — milestone board + rituals protocol
5. `.auto-memory/` — cross-session memory (user profile, feedback, project context)

**The ritual on milestone completion:**

```bash
python3 scripts/milestone.py 3b "Slider wired into compare view, live-updating"
```

Runs metrics regeneration + LEARNINGS append + SESSION_SUMMARY timestamp bump. Always run this; never skip.

## Validation workflow (Chrome-MCP)

After any UI change:

1. Ensure dev server is running (`Start-EV-Dashboard.command` double-click on Ian's Mac)
2. Claude-in-Chrome extension tabs_context_mcp → find the localhost tab
3. Navigate, screenshot, read_console for errors, read_page for interactive refs
4. Click/drag to exercise the new interaction
5. Screenshot the result
6. Log observations to LEARNINGS.md via milestone.py

## What NOT to do

- Don't invent data. Mark Low confidence and move on.
- Don't rewrite Phase 1 files without a specific reason.
- Don't add features for shipping (signing, notarization, auto-update).
- Don't add vehicles outside the Long-Range-trim scope.
- Don't collapse vehicle generations.
- Don't hand-edit `PHASE_METRICS.md`.
- Don't use computer-use when Claude-in-Chrome will do.

## Starting a new session

```
1. Read this file (CLAUDE.md)
2. Read SESSION_SUMMARY.md for current stage + "Resume here"
3. Skim LEARNINGS.md top 3 entries for recent context
4. Proceed.
```

## Response style — caveman-concise by default

Respond like smart caveman. Cut all filler, keep technical substance.

- Drop articles (a, an, the), filler (just, really, basically, actually).
- Drop pleasantries (sure, certainly, happy to).
- No hedging. Fragments fine. Short synonyms.
- Technical terms stay exact. Code blocks unchanged.
- Pattern: [thing] [action] [reason]. [next step].

*Applies to chat responses AND subagent prompts on this project. Exception: user-facing UI copy is natural English; LEARNINGS.md prose stays prose. Measured savings on coding tasks: 14–21% output tokens (Exa-confirmed 2026-04-23).*

## Estimating work — use token budgets, not hours

"Hours" as planning unit is unreliable in agent-collaborative work. Use instead:
- Subagent dispatches × median tokens (see `scripts/cost_tracker.py analyze`)
- Number of tool calls / file writes expected
- Chat-turn count (a rough sense of user-experienced length)

Historical calibration (updated automatically):
- **Data milestone** (e.g., seed-authoring batch): ~100–130k subagent tokens, 1 dispatch
- **Feature milestone** (direct code): 0 subagent tokens, 3–8 file writes
- **Infra/polish milestone**: 0 subagent tokens, 1–4 file writes
- Run `python3 scripts/cost_tracker.py analyze` for live numbers.

## Token-ROI discipline — always on

Every non-trivial operation must justify its cost. Hard rules:

1. **Pre-flight before any subagent dispatch or bulk read.** Run `python3 scripts/token_roi.py preflight <op_kind>` — if it prints EXPENSIVE, consider direct_code, batching, or a narrower prompt.
2. **Prefer Edit over Write.** Edit sends the diff; Write sends the whole file. Never rewrite a >50-line file just to change 5 lines.
3. **Prefer Grep+Glob+Read(offset,limit) over full-file reads.** If you only need one function, don't slurp the whole file.
4. **Skip subagents for <10k-token work.** Direct code wins. Subagents amortize over big jobs, not small ones.
5. **Milestone close runs the ROI gate.** `milestone.py` step 8 refuses close if spend > 2× peer median for kind (override: `TOKEN_ROI_OVERRIDE=1`).
6. **Doc bloat budget.** Always-loaded docs (CLAUDE.md + SESSION_SUMMARY.md + MEMORY.md) must total ≤ 8k tokens. Offload everything else.
7. **Log significant ops.** `token_roi.py log <kind> <est> <actual> <value 1-5> "<note>"` — future decisions get smarter the more we feed the ledger.

Run `python3 scripts/token_roi.py dashboard` any time to see spend, ROI-by-kind, and bloat score.

---

# Handover — Claude Code takeover reference

*Added 2026-04-23 on migration from Cowork. This section is stack + state reference so any fresh Claude Code session can orient without hunting.*

## Stack and versions

| Layer | Choice | Version |
|---|---|---|
| Frontend runtime | React + React-DOM | 18.3.1 |
| Language | TypeScript (strict) | 5.6.3 |
| Bundler/dev server | Vite | 5.4.10, port **1420** (strict) |
| Styling | Tailwind CSS | 3.4.14 (+ postcss 8, autoprefixer 10) |
| State | Zustand (`persist`) | 4.5.5 |
| Mapping | Leaflet + OpenStreetMap tiles | CDN-loaded, no key |
| Desktop shell | Tauri 2 (Rust) | crate `tauri` 2, cli 2.1 |
| Rust edition | 2021 | toolchain ≥ 1.70 |
| Scripts runtime | Python 3 | stdlib only — no pip deps |
| Package manager | npm | install with `npm install` |

No `pip`/`poetry` deps. All tooling (metrics, validators, rituals) is stdlib Python.

## Directory map (key folders)

```
EV dashboard/
├── src/                 React + TS frontend
│   ├── App.tsx, main.tsx, types.ts, index.css
│   ├── components/      14 .tsx files (CompareView, MapPanel, TempSlider…)
│   ├── lib/             thermal.ts (physics), ocm.ts, osrm.ts, charge_plan.ts,
│   │                    battery_degradation.ts, debugLog.ts, format.ts,
│   │                    plainLang.ts, thermal.test.ts
│   ├── data/            seed.json (37 vehicles, 5919 lines), dcfc_stations.json,
│   │                    new_vehicles.json, index.ts
│   └── store/           useAppStore.ts (Zustand + persist middleware)
├── src-tauri/           Rust desktop shell (Cargo.toml, tauri.conf.json)
├── scripts/             11 Python ritual/validator scripts (see below)
├── snapshots/           timestamped seed.json copies + archive/*.tar.gz
├── logs/                milestone_costs.jsonl, operation_ledger.jsonl,
│                        daily_budget.json, subagent_runs/*.json
├── reports/             deep-audit outputs
└── *.command            double-click launchers (macOS)
```

## Entry points — exact commands

Dev (web): `npm install && npm run dev` → http://localhost:1420

Dev (desktop window): `npm install && npm run tauri:dev` (first Rust compile 3–5 min)

Production desktop bundle: `npm run tauri:build` → `src-tauri/target/release/bundle/macos/EV Dashboard.app`

Double-click launchers (already executable): `./First-Time-Setup.command`, `./Start-EV-Dashboard.command`, `./Start-Desktop-App.command`, `./Prune-Snapshots.command`.

Ritual scripts (always from project root):

```
python3 scripts/kickoff.py                           # dashboard
python3 scripts/milestone.py <id> "<summary>"        # after any milestone
python3 scripts/batch_ritual.py <id> "<retro>"       # after a batch close
python3 scripts/metrics.py                           # regen PHASE_METRICS.md
python3 scripts/validate_system.py                   # consistency gate
python3 scripts/validate_thermal.py                  # physics-model anchor tests (6)
python3 scripts/token_roi.py dashboard               # ROI pulse
python3 scripts/cost_tracker.py analyze              # spend-by-kind medians
python3 scripts/snapshot.py --diff                   # seed snapshot + rotate
python3 scripts/deep_audit.py fast                   # 5-dimension sweep
python3 scripts/changelog.py                         # regen CHANGELOG.md
```

## Environment variables (names only)

Read from Vite `envPrefix: ["VITE_", "TAURI_"]`. All optional — app runs with none set.

| Name | Purpose | Behavior if unset |
|---|---|---|
| `VITE_OCM_KEY` | Open Charge Map API key for live DCFC pins | falls back to 15 demo stations in `dcfc_stations.json` |
| `TAURI_DEBUG` | Tauri dev build mode | unminified + sourcemaps when set |
| `TOKEN_ROI_OVERRIDE` | bypass milestone ROI gate when spend > 2× median | gate blocks milestone close when unset |

Place a `.env.local` in project root (git-ignored) for any of the above.

## External APIs / data sources

| Service | What for | Auth | Fallback |
|---|---|---|---|
| Open Charge Map | Live DCFC station query by bbox | API key (`VITE_OCM_KEY`) | static `dcfc_stations.json` (15 demo pins) |
| OSRM demo server | Road-distance routing between two lat/lng | none | haversine straight-line |
| Nominatim (OSM) | Free-form destination geocoding | none | user types lat/lng manually |
| OpenStreetMap tiles | Leaflet basemap | none | n/a |
| AutoTrader.ca · Kijiji · EV-Database | Used-market deep-link search only — no scraping | none | n/a |
| Exa web search | On-demand spec verification during sessions | API key (via MCP) | manual Exa in chat |

## Project state — what's live

Every feature from the original scope is shipped. Feature-complete as of 2026-04-23. See SESSION_SUMMARY.md for the full list.

37 vehicles, 16 brands, 30 High / 6 Medium / 1 Low confidence. Compare tray (up to 4), plain-English "mom mode," temperature slider −40 → +40 °C with per-vehicle heat-pump cutoff overrides, charging-curve overlay, range rings, DCFC pins, OSRM trip routing with charge-stop planner, iZEV eligibility wizard, battery-degradation projection, used-market deep-links, debug telemetry ring-buffer.

Six batches closed; 23 milestones shipped including the just-closed **ROI-GATE-V1** which wired token-ROI discipline into every ritual.

## Partially built / known gaps

- **iZEV** is coded as $0 federal, Ontario $0 provincial. Accurate as of 2026-04-23; needs re-check if federal program resumes.
- **Tesla Model Y Juniper** is a Low-confidence placeholder — refresh or remove when NA specs stabilize.
- **Rivian Canadian availability** — MSRP estimates are Medium confidence; distribution is evolving.
- **Vehicle photos** — no images in seed; deferred "resolve Wikipedia Commons URLs per vehicle" ticket.
- **CI / GitHub Actions** — none. Repo is local-only.
- **Runtime schema validation (zod/valibot)** — not wired; TS types enforce at compile time only.
- **Vitest harness** — not installed; `thermal.test.ts` exists as assertions, runs ad hoc via ts-node.
- **Stream E Phase 1a (Leasebusters)** — green-lit, not started. Budget ~130k subagent tokens.
- **JOURNAL.md shopping log + quote CSV tracker** — proposed in GAME_PLAN_V4 §4.1–4.2, not built.
- **App icon / signed `.app`** — not built; `npm run tauri icon <512.png>` would generate it.
- **Pending deletions the sandbox couldn't make**: `snapshots/` has 16 loose `.json` files; `snapshots/archive/*.tar.gz` already contains 11 of them. Run `./Prune-Snapshots.command` to clean up.

## Known bugs / TODOs

No known runtime bugs. Deep-audit (last run) flagged 12 unused TypeScript exports — cosmetic, non-blocking. Two TS errors were fixed this session (`_t` underscore rename, unused `brand` variable in UsedListings).

Uncommitted changes: 15 modified files + 1 new `GAME_PLAN_V4_addendum.md` + 1 new `Prune-Snapshots.command` + 1 new `scripts/token_roi.py` + misc logs. See `git status`. Safe to commit as a single "ROI-GATE-V1 + v4 addendum" bundle.

## Coding conventions

- Strict TS. `noUnusedLocals` + `noUnusedParameters` both on — any unused import fails `npm run build`.
- `CitedValue<T>` for every measured number: `{ value, source: { url, name, accessed }, confidence, notes? }`.
- One generation = one vehicle entry. Never collapse pre-2025 IONIQ 5 with 2025+ refresh.
- `long_range_awd` vs `long_range_single_motor` trim split only. No base or performance trims.
- Tailwind utility classes inline; no CSS modules. Custom palette `ink-*`, `accent-*` in `tailwind.config.js`.
- Python ritual scripts: stdlib only, type hints, docstrings at top, `main()` with `sys.exit`.
- Filenames: kebab-case for `.command`, snake_case for `.py`, PascalCase for React components.
- Caveman prompting for subagent dispatch (see §"Response style").

## Cowork bits that must be re-created in Claude Code

- `.auto-memory/` folder with per-type markdown files — port user-level items (`user_profile.md`, `feedback_communication.md`, `feedback_autonomous_execution.md`, `feedback_full_gas_mode.md`) into `~/.claude/CLAUDE.md`. Project-scoped items (`feedback_scientific_rigor.md`, `feedback_browser_scope.md`, `project_ev_dashboard.md`) are already reflected in this CLAUDE.md.
- Skills/plugins: re-add Exa MCP, Claude-in-Chrome MCP as needed.
- No Cowork-specific code inside `src/` — application is portable.

## Canonical folder path

The project folder is what Cowork mounted as `/sessions/eloquent-bold-newton/mnt/EV dashboard/`. On the user's Mac this is the folder they selected when opening Cowork (named **`EV dashboard`**). The sandbox doesn't know the host-side absolute path — the user should right-click the folder in Finder and copy its path, or drag it onto the Claude Code window.
