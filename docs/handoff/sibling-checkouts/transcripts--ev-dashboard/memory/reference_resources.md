---
name: EV Dashboard external resources
description: External systems, APIs, and documentation the project depends on
type: reference
originSessionId: d92199a2-b04d-4c16-8bc7-83b46b7a1128
---
# External APIs and services

- **Apple MapKit JS** — maps, geocoding. Personal-use free tier. Token via Apple Developer account; easier path is the token-maker tool at https://maps.developer.apple.com/token-maker (avoids JWT-signing code). Token validity max 1 year. Key goes in `.env.local` as `VITE_APPLE_MAPKIT_TOKEN`.
- **Open Charge Map** — DCFC station data. Free public API at https://openchargemap.org with a courteous-use policy (no hard rate limit). Key in `.env.local` as `VITE_OCM_API_KEY`. Cache responses per-bounding-box for 1 hour.
- **A Better Route Planner (ABRP)** — EV route planning. Consumer tier is free; Premium $5/mo or $50/yr. API details at https://abetterrouteplanner.com/resources/api (pricing not publicly listed — check at Cluster E0). Key in `.env.local` as `VITE_ABRP_API_KEY`.
- **Exa web search** — on-demand spec verification and used-market queries. Available via MCP in this environment. Cache per-query for 30 days (per-vehicle monthly drift check).
- **Claude-in-Chrome extension** — DOM-aware browser control. Primary UI validation path for every cluster exit walkthrough.
- **Scheduled tasks MCP** — `mcp__scheduled-tasks__create_scheduled_task` — for monthly iZEV/MSRP drift checks (Cluster B5).

# Data sources (for B1 thermal profile population and B3 verification)

- **Geotab Winter EV Range dataset** — cold-weather range derate curves. Published reports; manual extraction.
- **Recurrent Auto fleet reports** — real-world range observations across seasons; battery degradation data. Published at https://www.recurrentauto.com.
- **Fastned DCFC charging data** — published charging curves per model on their blog.
- **P3 Charging Index** — charging test reports.
- **Bjørn Nyland 1000 km Challenge** — standardized highway-speed range tests. YouTube + a spreadsheet tracker.
- **InsideEVs independent tests** — winter range tests.
- **EV-Database.org** — cross-reference registry.
- **EPA fueleconomy.gov** — official NA range/efficiency figures.
- **NRCan FuelEconomy.ca** — Canadian official efficiency figures.

# Documentation references

- **Claude Code hooks** — https://code.claude.com/docs/en/hooks-guide — for A15.
- **Claude prompt caching** — https://docs.claude.com/en/docs/build-with-claude/prompt-caching — informs §1.7 doc structure.
- **Tauri v2 icons** — https://v2.tauri.app/develop/icons/ — for A5.
- **Tauri v2 macOS bundle** — https://v2.tauri.app/distribute/macos-application-bundle/ — for F4.

# In-project documentation

- `CLAUDE.md` — codebase orientation (read first by fresh Claude sessions).
- `SESSION_SUMMARY.md` — landing page with Stage + Resume pointer.
- `.resume.md` — tiny volatile file with "next 3 items" (A17).
- `AUTONOMOUS_PLAN.md` — live priority queue.
- `LEARNINGS.md` — dated prose log.
- `PHASE_METRICS.md` — auto-generated from seed.json.
- `specs/*.md` — per-cluster + per-feature acceptance criteria (§1.9 of the game plan).
