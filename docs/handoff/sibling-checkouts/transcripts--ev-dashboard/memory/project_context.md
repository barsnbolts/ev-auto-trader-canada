---
name: EV Dashboard project context
description: Scope, finish line, autonomy model, and architectural decisions for the EV Dashboard project
type: project
originSessionId: d92199a2-b04d-4c16-8bc7-83b46b7a1128
---
# Scope

Personal-use Mac app for Ian McAdam (Ontario, first-time EV buyer) to compare every EV / PHEV / EREV sold in Canada — new and used. Not a shipped product. No signing, no notarization, no distribution infra. Ian runs it on his MacBook Pro; he and his mom use it to research his next vehicle.

# Finish line

**Full PROJECT_PLAN vision (Phases 1–5).** Data rigor + physics + map + trip planning + used-market. Deep rigor on 20 vehicles first (all to High confidence with per-vehicle thermal data), then expand to 40 later. Delivered as a Tauri `.app` in Ian's dock. Mom-usable via a "Plain/Geek" mode toggle.

**Why:** Ian needs to actually pick a vehicle. The app has to be trustworthy enough that he and his mom can open it and reach a buying decision without second-guessing the numbers.

# How to apply

- Non-negotiable: every displayed number is cited with provenance (`CitedValue<T>`) and a confidence flag (High/Medium/Low).
- Non-negotiable: long-range trims only, generation-aware entries (IONIQ 5 pre-2025 ≠ IONIQ 5 2025+).
- Scope-discipline: if a proposal smells like "for shipping" (signing, notarization, auto-update, .dmg distribution) → kill it.
- Six execution clusters (A–F). Each starts with a spec in `specs/`; each ends with a plain-English recap + Chrome-MCP screenshots + green smoke test.

# Architectural decisions (locked in)

- **Ritual loop.** `scripts/milestone.py` runs tsc → vitest → validate.py → metrics.py → git commit → LEARNINGS append → queue re-rank. Red halts. Every milestone is a real save-point.
- **Memory.** This directory (canonical Claude Code memory) is the source of truth for cross-session user/project/feedback/reference memory. The project's docs' references to `.auto-memory/` will be updated to point here (A3).
- **Writing style.** Two voices: plain English for user-facing (recaps, user_guide, questions to Ian) and caveman for internal (commits, scripts, queue items, LEARNINGS mechanical entries). See `docs/writing_style.md` (written in A8).
- **Specs.** Every cluster and every user-visible feature gets a short markdown spec in `specs/`. Specs define acceptance criteria; tests enforce them.
- **Reasoning-mode strategy.** Sonnet 4.6 default, Opus 4.7 only for architectural decisions / recaps / reviews / conflict resolution.
- **External-key strategy.** MapKit JS + OCM + ABRP keys all go in `.env.local` (gitignored). Features ship behind feature-flag stubs that render a "get your key here" card until the key lands. Never blocks execution on Ian's schedule.
- **ABRP vs self-built routing.** Start with ABRP behind `VITE_ROUTE_ENGINE=abrp`; code a Mapbox+OCM+thermal fallback behind `VITE_ROUTE_ENGINE=selfbuilt`. Both paths ship. Decision on primary engine at Cluster E0 (depends on ABRP API pricing for personal use).

# Key risks tracked

- **Thermal profile fields missing** from every vehicle in seed.json — the physics model was running on hardcoded defaults. Fixed in Cluster B1–B2.
- **iZEV federal rebate paused** as of early 2025; 2026 status unclear. All vehicles show $0 with "verify" notes. Monthly scheduled task (B5) checks for policy changes.
- **All 2026 MSRPs Low confidence.** Phase 2 Exa verification (B3) upgrades where cross-confirmed.
- **Tesla Model Y Juniper placeholder.** NA specs still evolving as of Apr 2026; may stay Medium with wider ranges.

# Cluster status (as of 2026-04-24)

All six clusters complete:
- ✅ A — Foundation (ritual, memory, Vitest, Zod, hooks)
- ✅ B — Data rigor (20-vehicle thermal profiles, Exa verification)
- ✅ C — Physics + cost (cost/100km, tray persist, tooltips)
- ✅ D — Map + range rings (Rust thermal plugin, Leaflet, DCFC pins)
- ✅ E — Trip planning + used market + degradation (4-tab CompareView, Rust trip solver)
- ✅ F — Mom mode + accessibility + Tauri .app build

**Why:** Cluster F delivered: Plain/Geek toggle (labels.ts BiLabel), global focus-visible ring (WCAG), CreditsPanel, user guide, tailwind token lock, 8.1MB ARM64 Tauri .app.

**Pending (Ian action):** Merge worktree `claude/heuristic-jemison-71e592` into master (master has uncommitted changes, needs manual stash/commit before merge).

**F2 deep accessibility audit** deferred — needs Ian's answer: does mom have low vision, motor, or cognitive accessibility needs beyond plain language?

**Optional Cluster G** (SwiftUI rewrite) — Ian decides after using the app for a few weeks.

# Worktree

`claude/heuristic-jemison-71e592` — all Clusters A-F committed here. Branch ready to merge into master. See `.resume.md` for merge instructions.
