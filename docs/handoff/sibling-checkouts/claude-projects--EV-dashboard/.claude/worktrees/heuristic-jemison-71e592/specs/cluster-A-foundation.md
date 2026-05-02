# Cluster A — Foundation

## Goal

Make the autonomous build loop reliable. Every milestone becomes a real save-point. Every future Claude session reads a healthy memory + queue. Testing is baked in so no subsequent cluster ships broken code. Doc drift that existed at the start of this session gets reconciled.

Without Cluster A, every subsequent cluster accumulates silent breakage. With it, every cluster has a green ritual gate.

## User-visible behavior

Ian notices nothing immediately in the app — it looks identical. The gains are underneath:

- Terminal shows green/red pipeline runs when Claude completes work.
- Commits land per milestone, each one a rollback point.
- `.auto-memory/` exists and will be picked up by every future session (both the canonical path and the project-local mirror).
- SESSION_SUMMARY no longer lies about `.auto-memory/`.
- PROJECT_PLAN no longer references dropped shipping infra.
- Tauri desktop build stops failing on missing icons.
- A fresh checkout can be verified in one command: `scripts/smoke.sh`.

## Acceptance criteria

1. `scripts/smoke.sh` runs green end-to-end (`npm install` → `npm run build` → `tsc --noEmit` → `npm test` → `python3 scripts/validate.py` → `python3 scripts/metrics.py`).
2. `.auto-memory/` contains 4 files + README; `user.md` names Ian's first-timer status. Canonical memory path also populated.
3. `scripts/milestone.py` runs: `tsc` → `vitest` → `validate` → `metrics` → `git add -A && git commit` → LEARNINGS append → timestamp bump → `queue.py` re-rank. Any red halts the pipeline.
4. `.claude/settings.json` hooks fire on edits: tsc on `*.ts?(x)`, validate on seed.json, physics tests on thermal.ts. Destructive Bash commands (`rm -rf`, `git reset --hard`, `git push --force`) are blocked and prompt.
5. Vitest installed + wired; `thermal.test.ts` migrated from hand-written asserts to proper Vitest suite. `npm test` runs it.
6. Zod schema for `Vehicle` + `CitedValue` validates seed.json at import (`src/data/index.ts`). One intentional bad record triggers a visible error.
7. `scripts/queue.py` parses AUTONOMOUS_PLAN.md, prints top-3 ready items, writes `.queue_top3.md`. Session-start hook prints its contents.
8. PROJECT_PLAN.md, SESSION_SUMMARY.md, AUTONOMOUS_PLAN.md consistent. META_IMPROVEMENTS.md absorbed into queue and archived with a "superseded" header. `.resume.md` split out of SESSION_SUMMARY for cache-friendliness.
9. Tauri icon set generated from a 1024×1024 transparent-padded PNG. `npm run tauri build` produces a `.app` (even if unused this cluster).
10. `docs/writing_style.md` documents plain-English-for-user vs caveman-for-internal rule. CLAUDE.md references it.
11. `docs/external_keys.md` walks Ian through MapKit token-maker, OCM key signup, ABRP key signup. Screenshot placeholders.
12. 60 golden-value physics test cases (5 vehicles × 3 temps × 2 precon × 2 hvac) passing in Vitest.
13. 3 component snapshot tests (ConfidenceBadge, CompareView, FilterBar) passing.
14. `scripts/self_audit.py` wired to trigger every 5 milestones from milestone.py.
15. `logs/token_usage.md` exists with Cluster A row.
16. Git log shows one caveman-style commit per A-item; final commit leaves tree clean.

## Inputs / state touched

**New directories:** `.auto-memory/`, `specs/`, `docs/`, `logs/`.

**New files:**
- `.auto-memory/user.md`, `feedback.md`, `project.md`, `reference.md`, `README.md`
- `specs/cluster-A-foundation.md` (this file)
- `docs/writing_style.md`, `docs/external_keys.md`
- `logs/token_usage.md`
- `scripts/queue.py`, `scripts/validate.py`, `scripts/smoke.sh`, `scripts/self_audit.py`
- `.claude/settings.json`
- `.resume.md`
- Tauri icon set under `src-tauri/icons/`
- `src/data/schema.ts` (Zod schemas)
- Vitest config + snapshot test files

**Modified files:**
- `scripts/milestone.py` — expanded ritual
- `src/data/index.ts` — Zod validation at import
- `src/lib/thermal.test.ts` — migrated to Vitest
- `package.json` — devDeps (vitest, @testing-library/react, zod), `test` script
- `CLAUDE.md` — writing-style rule reference; canonical memory path
- `SESSION_SUMMARY.md` — remove `.auto-memory/` lie; point to `.resume.md`; dedupe
- `PROJECT_PLAN.md` — drop shipping infra; link to Graveyard
- `AUTONOMOUS_PLAN.md` — absorb META_IMPROVEMENTS items
- `META_IMPROVEMENTS.md` — prepend "superseded" header

## Outputs

- Green smoke-test pipeline callable from one command.
- Memory files ready for cross-session inheritance.
- Queue automation producing `.queue_top3.md`.
- Per-milestone commit trail.
- Hook-driven quality gates on every file edit.

## Dependencies

None. This is the foundation cluster.

## Test plan

- **Layer 1 (tsc):** runs via milestone.py + PostToolUse hook; must be green.
- **Layer 2 (vitest):** installed via A10; golden-value physics (A12) and snapshot (A13) tests land here.
- **Layer 3 (Zod):** A16 schema catches shape violations at seed.json import.
- **Layer 4 (validate.py):** A7 rules; runs via milestone.py + PostToolUse hook on seed.json.
- **Layer 5 (golden-value physics):** A12 — 60 cases on thermal.ts.
- **Layer 6 (component snapshot):** A13 — ConfidenceBadge + CompareView + FilterBar.
- **Layer 7 (Chrome-MCP):** cluster-exit walkthrough: app loads, no console errors, all existing UI still works.
- **Layer 8 (smoke.sh):** A11 — runs all above as one command. Must be green to declare cluster done.

## Open questions

- None blocking this cluster. Mom's accessibility specifics surface in Cluster F; architectural decisions for Cluster E (ABRP vs self-built) also deferred to E0.

## Done when

- `scripts/smoke.sh` → green
- `.queue_top3.md` → printing the first items of Cluster B
- Chrome-MCP validation walkthrough: app loads clean, compare-view functional
- Final git log: ~18 caveman commits, each tagged to an A-item
- Ian reads the Cluster A recap and says "yes move to B"

## Changelog

- 2026-04-23: initial spec from game-plan §1.9 example, expanded.
