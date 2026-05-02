# External resources

## APIs

- Apple MapKit JS — https://maps.developer.apple.com/token-maker (generate token, paste into `.env.local` as `VITE_APPLE_MAPKIT_TOKEN`). max 1yr validity. personal use only.
- Open Charge Map — https://openchargemap.org. free public API. key in `.env.local` as `VITE_OCM_API_KEY`. cache per-bbox 1hr.
- ABRP — https://abetterrouteplanner.com/resources/api. consumer free; premium $5/mo. api pricing not public; check E0. key as `VITE_ABRP_API_KEY`.
- Exa — via MCP. cache per-query 30 days.
- Claude-in-Chrome — DOM-aware validation. primary cluster-exit walkthrough path.
- scheduled-tasks MCP — `mcp__scheduled-tasks__create_scheduled_task`. for B5 monthly iZEV/MSRP drift.

## data sources (B1 thermal + B3 verification)

- Geotab Winter EV Range dataset — cold-weather derate curves. manual extraction.
- Recurrent Auto — fleet reports, degradation. https://www.recurrentauto.com
- Fastned — DCFC curves per model, published on blog
- P3 Charging Index — charging test reports
- Bjørn Nyland 1000 km Challenge — highway-speed standardized tests. YouTube + spreadsheet
- InsideEVs — winter range tests
- EV-Database.org — registry cross-reference
- EPA fueleconomy.gov — NA official
- NRCan FuelEconomy.ca — Canadian official

## tooling docs

- Claude Code hooks — https://code.claude.com/docs/en/hooks-guide (A15)
- Claude prompt caching — https://docs.claude.com/en/docs/build-with-claude/prompt-caching (§1.7)
- Tauri v2 icons — https://v2.tauri.app/develop/icons/ (A5)
- Tauri v2 macOS bundle — https://v2.tauri.app/distribute/macos-application-bundle/ (F4)

## in-project docs

- `CLAUDE.md` — codebase orientation, read first
- `SESSION_SUMMARY.md` — landing page
- `.resume.md` — volatile next-3-items (A17)
- `AUTONOMOUS_PLAN.md` — live queue
- `LEARNINGS.md` — dated prose log
- `PHASE_METRICS.md` — auto-generated from seed
- `specs/*.md` — per-cluster + per-feature acceptance criteria
