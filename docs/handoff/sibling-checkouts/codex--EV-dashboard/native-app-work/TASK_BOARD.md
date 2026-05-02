# TASK_BOARD.md

## Current State

- Native SwiftUI app is the active implementation target.
- The empty `EV dashboard` folder is only a staging/workbench location in this session.
- Core architecture now has Hyundai/Kia 2025-2026 leverage models, SQLite v2 tables, seed records, scoring, prompt generation, import validation, and a native dashboard surface.
- Research import CSV fixtures now cover accepted Hyundai/Kia rows plus rejected outside-make, outside-year, missing-source, and gas-only rows.
- Leverage scoring now has coverage for stale marketplace evidence versus fresh direct dealer evidence.
- Import Review can import CSV/JSON Deep Research files, append accepted rows to inventory, write rejected rows to review, and store a research batch snapshot.
- Import merge collapses duplicate stock/VIN rows and same dealer/year/model/trim rows when stock is missing.
- Caveman Skill is available as a repo-local plugin at `plugins/caveman-skill`; low-reasoning runs should read `.codex/compact-context.md` and `LOW_REASONING_RUNBOOK.md` first.

## Next Medium Tasks

- Replace seeded example URLs with real imported research batches.
- Add official incentive re-verification pass before any real negotiation.
- Add visual QA/run verification on the real native app path.

## Next Low Tasks

- Run `plugins/caveman-skill/scripts/caveman_check.sh` before/after doc-only low tasks.
- Run `plugins/caveman-skill/scripts/compact_context.py` before switching to low reasoning or pausing after a long run.
- Add more Hyundai/Kia seed fixtures.
- Expand tests for national scope.
- Polish copy in dashboard panels.
- Add screenshots to README after app launches cleanly.

## Do Not Do

- Do not build a full dealer CRM.
- Do not invent financing numbers.
- Do not scrape login/CAPTCHA/private sources.
- Do not remove the older catalog/listing paths until the leverage dashboard is fully migrated.
