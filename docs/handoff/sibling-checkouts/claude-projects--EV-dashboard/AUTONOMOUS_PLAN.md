# Autonomous plan (v5 — batched)

**Rewritten 2026-04-23** after F-MAP shipped. The old milestone-queue was getting unwieldy (38+ items, much overlap). Remaining work now collapses into **6 large batches** defined in [`BATCH_PLAN.md`](./BATCH_PLAN.md). This document is the thin tactical view; open `BATCH_PLAN.md` for the full pre-planning per batch.

## Current state (as of F-MAP close)

- **14 milestones shipped** this session: 1a-e · 2a · 3a-c · B-01 · F-02 · P-01 · I-04 · I-17 · I-VAL · D-01 · D-01-ext · I-INT · F-03 · F-hp · F-MAP
- **Data health:** 15 High / 4 Medium / 1 Low across 20 vehicles · thermal validator 6/6 green · 8 snapshots on disk · 2 subagent run logs · 0 integrity issues
- **Features live:** brand-grouped directory, filter bar, compare tray (persisted), physics-driven slider, charging-curve overlay, cost-per-100km, Leaflet map, range rings, DCFC pins, trip-distance check, confidence tooltips, per-vehicle heat-pump cutoff override
- **Monitoring:** every subagent dispatch is logged; prompt templates are versioned; `kickoff.py` gives one-command dashboard; milestone.py enforces metrics + system validation + thermal validator + snapshot gates

## Remaining work — 6 batches

Full details: [`BATCH_PLAN.md`](./BATCH_PLAN.md). TL;DR:

| # | ID | Summary | Est | Blocker |
|---|---|---|---|---|
| 1 | **BATCH-1** | Dataset maturity — 20 → 40 vehicles via subagent + verify pipeline | 3h | none |
| 2 | **BATCH-2** | Live integrations — Open Charge Map API + OSRM routing | 2h | OCM free API key |
| 3 | **BATCH-3** | Used market — Exa-backed AutoTrader/Kijiji listings per vehicle | 3h | none |
| 4 | **BATCH-4** | Trip-planning precision — full charge-stop planner | 4h | BATCH-2 |
| 5 | **BATCH-5** | Decision experience — breakdown drawer, jargon toggle, photos, degradation, incentive wizard, PDF, a11y | 4h | none |
| 6 | **BATCH-6** | Tauri packaging + ops — .app bundle, scheduled tasks, changelog, snapshot rotation | 2h | Ian's Mac runs Rust compile |

**Recommended order:** 1 → 2 → 4 → 3 → 5 → 6 (dataset first, backbone next, features on top, polish, ship).

**Fast path if time-constrained:** 1 → 5 → 6 (skips OCM/OSRM, gets a fully usable personal-use app).

## How to pick the next batch

At the start of any session, answer four questions in order:

1. **Is the validator green?** (`python3 scripts/kickoff.py` — check thermal + system)
2. **Any un-closed milestone from last session?** Finish it first.
3. **Have Ian's blockers for Batch N resolved?** If yes, go. If no, skip to next-unblocked batch.
4. **If multiple batches are unblocked,** pick by: most-dependent-batch-first (unblocks more downstream) × highest value to decision-making.

## Rituals (unchanged from v4)

- Every milestone ends with `python3 scripts/milestone.py <id> "<summary>"`.
- Every seed data change auto-runs metrics via milestone.py pipeline.
- Every 5 milestones → consider `/consolidate-memory`.
- Every session end → update SESSION_SUMMARY Stage + Resume.

## Subagent protocol

- Prompts versioned in `scripts/prompt_templates/`. Current templates: `d01_verify.md`.
- Every dispatch logged to `logs/subagent_runs/<date>-<milestone>.json` with `improvements_for_next_run` so future runs learn.
- Large data ops (D-04 next up, used-market searches) go through subagents to keep main context small.

## Principles (invariants)

1. Scientific rigor — every number cited, every confidence flagged.
2. Personal use only — no shipping infra.
3. Long-range trims only + generation-aware.
4. Glanceable docs (>30 seconds = decayed).
5. Full-gas execution when autonomy granted.
6. Validator failures are blocking — fix before closing a milestone.

## Capability ledger

✅ Workspace mount · Chrome-MCP on localhost · Computer-use · Exa web search · Subagent dispatch · Scheduled tasks · Memory system · Ritual scripts (metrics, milestone, snapshot, validate_system, validate_thermal, kickoff, apply_d01_ext) · Git initial commit

⏸️ Needs Ian action: OCM API key (for Batch 2/4) · Apple MapKit JS key (now optional — OSM works) · ABRP key (optional, if we choose that routing engine)

## Graveyard (items dropped for good)

- Old Phase 2 scrapers (2c-g) — Exa replaced them.
- Old Phase 4 AutoTrader/Kijiji direct scrapers — absorbed into Batch 3 as Exa-backed.
- Code signing / notarization / security review / .dmg distribution — personal use only.
- Individual milestones P-01, I-17, F-03, F-hp, F-04, F-05-8 — rolled into Batches 5 and F-MAP where applicable.
- 3 separate D-* items — merged into Batch 1.
