# TASK_BOARD.md

## Current State

- Native SwiftUI app is the active implementation target.
- The empty `EV dashboard` folder is only a staging/workbench location in this session.
- Core architecture now has Hyundai/Kia 2025-2026 leverage models, SQLite v2 tables, seed records, scoring, prompt generation, import validation, and a native dashboard surface.
- Research import CSV fixtures now cover accepted Hyundai/Kia rows plus rejected outside-make, outside-year, missing-source, and gas-only rows.
- Leverage scoring now has coverage for stale marketplace evidence versus fresh direct dealer evidence.
- Import Review can import CSV/JSON Deep Research files, append accepted rows to inventory, write rejected rows to review, and store a research batch snapshot.
- Import merge collapses duplicate stock/VIN rows and same dealer/year/model/trim rows when stock is missing.
- Import parsing now handles quoted commas/newlines, rejects unsupported source types, rejects EREV/gas-only scope drift, requires observed date and confidence notes, and guards suspicious prices.
- Importer persistence round-trip coverage now exercises `InventoryStore.importResearchFile` against a temporary database.
- Visual QA verification mode exists at `./script/build_and_run.sh --verify-ui`; it verifies launch and captures screenshots when macOS Screen Recording permission allows it.
- Official incentive re-verification was completed on 2026-05-01. Live federal incentive source is Transport Canada EVAP, not closed iZEV; seeded EVAP matching is narrowed to official-list Hyundai/Kia models and every EVAP claim still needs dealer confirmation.
- Hyundai/Kia valid import fixture now uses public dealer/OEM source URLs instead of example URLs. Seed finance offers are empty until an APR/payment offer is source-backed.
- README now reflects the Hyundai/Kia leverage dashboard and includes the latest verified `--verify-ui` screenshot.
- Dashboard and menu-bar copy now uses research-batch/import-review/source-backed-listing language instead of older live-source-run catalog wording.
- Caveman Skill is available as a repo-local plugin at `plugins/caveman-skill`; low-reasoning runs should read `.codex/compact-context.md` and `LOW_REASONING_RUNBOOK.md` first.

## Next Medium Tasks

- Import a fresh user-supplied ChatGPT/Gemini research batch and verify accepted/rejected row counts against source URLs.
- Recheck OEM/dealer monthly offers immediately before negotiation because Hyundai/Kia special offers can change by province and expiry.

## Next Low Tasks

- Run `plugins/caveman-skill/scripts/caveman_check.sh` before/after doc-only low tasks.
- Run `plugins/caveman-skill/scripts/compact_context.py` before switching to low reasoning or pausing after a long run.
- Add more Hyundai/Kia seed fixtures.
- Expand tests for national scope.

## Do Not Do

- Do not build a full dealer CRM.
- Do not invent financing numbers.
- Do not scrape login/CAPTCHA/private sources.
- Do not remove the older catalog/listing paths until the leverage dashboard is fully migrated.
