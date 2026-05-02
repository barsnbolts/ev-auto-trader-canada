# Project: EV Dashboard

personal-use Mac app. Canadian EV/PHEV/EREV comparison. not shipped. not distributed. no signing. Ian + mom only.

## finish line

full PROJECT_PLAN vision (phases 1–5). rigor first on 20 vehicles → high confidence + per-vehicle thermal data. then expand to 40. tauri `.app` in dock. mom-usable via plain/geek toggle.

## architectural decisions

- ritual loop in `scripts/milestone.py` = tsc → vitest → validate → metrics → git commit → learnings. red halts.
- writing style: plain english user-facing, caveman internal. see `docs/writing_style.md` (A8).
- specs in `specs/` precede code for every user-visible feature (§1.9 game plan).
- memory canonical location: `~/.claude/projects/-Users-ianmcadam-Documents-Claude-Projects-EV-dashboard/memory/`. this dir is the git-tracked mirror.
- external keys: MapKit JS + OCM + ABRP in `.env.local` (gitignored). feature-flag stubs until keys land. never blocks.
- ABRP vs self-built: dual engine via `VITE_ROUTE_ENGINE`. both paths ship. primary chosen at cluster E0.

## tracked risks

- thermal profile fields missing from all 20 vehicles — biggest rigor gap. B1 fixes.
- iZEV paused since early 2025; all show $0 w/ verify note. B5 schedules monthly recheck.
- all 2026 MSRPs low confidence. B3 Exa pass upgrades.
- tesla Y juniper placeholder; NA specs evolving. B4.

## worktree

on `claude/heuristic-jemison-71e592`. merge back to main post-cluster-A. per-cluster commits within worktree.
