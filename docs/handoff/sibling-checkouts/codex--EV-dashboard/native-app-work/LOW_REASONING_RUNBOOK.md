# LOW_REASONING_RUNBOOK.md

Use this when running cheaper/faster follow-up work.

## Start

Session hook tries to refresh `.codex/compact-context.md` automatically. If missing or stale, run:

```bash
plugins/caveman-skill/scripts/compact_context.py
```

Read only:

1. `.codex/compact-context.md` if present
2. `TASK_BOARD.md`
3. `DATA_CONTRACT.md`
4. `SOURCE_REGISTRY.md`
5. `plugins/caveman-skill/skills/caveman-skill/SKILL.md`

## Allowed Low Tasks

- Add seed fixtures.
- Add focused tests for existing behavior.
- Polish dashboard copy.
- Update docs/source registry.
- Add prompt variants.
- Add CSV sample files.
- Fix one obvious compiler error.

## Not Low Tasks

- New schema decisions.
- Live source strategy.
- Source legality/access decisions.
- Importer architecture changes.
- Release/signing/notarization.
- Anything requiring more than 8 active files.

## Verification

- Docs only: `plugins/caveman-skill/scripts/caveman_check.sh`
- Before handoff: `plugins/caveman-skill/scripts/compact_context.py`
- Code: `CLANG_MODULE_CACHE_PATH=.build/clang-module-cache swift build --product EVAutoTraderApp`
- Tests changed: build, then `CLANG_MODULE_CACHE_PATH=.build/clang-module-cache swift test`
- UI launch shell changed: `./script/build_and_run.sh --verify`

Run SwiftPM commands serially. If one is running, wait.

## Next Best Low Tasks

1. Add duplicate stock/VIN fixture rows once importer write-path exists.
2. Add dashboard copy polish and empty-state text.
3. Add more seeded Hyundai/Kia 2026 trims after source-backed verification.
4. Expand scope tests for Ontario/national modes without changing source strategy.

## Handoff Format

```text
Done: <one sentence>
Changed: <paths>
Verified: <commands>
Next: <one task>
```
