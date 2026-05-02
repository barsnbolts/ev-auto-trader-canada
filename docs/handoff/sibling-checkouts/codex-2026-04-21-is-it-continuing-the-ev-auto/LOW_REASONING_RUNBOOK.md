# LOW_REASONING_RUNBOOK.md

Use this when running cheaper/faster follow-up work. Despite the filename, this is the low/medium runbook.

## Start

Session hook tries to refresh `.codex/compact-context.md` automatically. If missing or stale, run:

```bash
plugins/caveman-skill/scripts/compact_context.py
```

The compactor estimates context load:
- below 40%: continue normally.
- 40-69%: safe area; compact, finish the current file, avoid broad reads.
- 70%+: danger; stop expansion, verify or pause, and resume from `.codex/safe-area.md`.

For long work, keep `.codex/active-files.txt` to one explicit file path per line. The compactor ignores untracked directory roots and uses this file to avoid false danger signals.

Read only:

1. `.codex/compact-context.md` if present
2. `.codex/safe-area.md` if present and context load is over 40%
3. `TASK_BOARD.md`
4. `DATA_CONTRACT.md`
5. `SOURCE_REGISTRY.md`
6. `plugins/caveman-skill/skills/caveman-skill/SKILL.md`

## Effort Routing

Default to medium when the task touches behavior. Drop to low only when the work is mechanical and already decided. Use high only for source/legal/schema/risk decisions or unclear failures.

Medium is the easiest default for this project because it avoids over-optimizing the optimization. Let the model decide downshifts after reading `.codex/safe-area.md`.

## Low Tasks

- Add seed fixtures.
- Add focused tests for existing behavior.
- Polish dashboard copy.
- Update docs/source registry.
- Add prompt variants.
- Add CSV sample files.
- Fix one obvious compiler error.

## Medium Tasks

- Add focused importer/store/persistence tests.
- Wire small UI actions to existing store methods.
- Add bounded parser/assembler/scoring fixes.
- Extend fixture coverage for known schemas.
- Add small persistence helpers when the schema is unchanged.
- Refine dashboard state and status copy when behavior is already clear.

Medium guardrails:
- Keep active files <= 8.
- Avoid live-source access decisions.
- Avoid schema resets.
- Verify after each bounded slice.
- Compact when context is above 40%.

## Not Low Or Medium

- New schema decisions.
- Live source strategy.
- Source legality/access decisions.
- Broad importer architecture changes.
- Release/signing/notarization.
- Anything requiring more than 8 active files.
- Unclear SwiftPM/runtime failures after one focused fix.

## Verification

- Docs only: `plugins/caveman-skill/scripts/caveman_check.sh`
- Before handoff: `plugins/caveman-skill/scripts/compact_context.py`
- Above 40% context: `plugins/caveman-skill/scripts/compact_context.py`, then continue from `.codex/safe-area.md`
- Code: `CLANG_MODULE_CACHE_PATH=.build/clang-module-cache swift build --product EVAutoTraderApp`
- Tests changed: build, then `CLANG_MODULE_CACHE_PATH=.build/clang-module-cache swift test`
- UI launch shell changed: `./script/build_and_run.sh --verify`

Run SwiftPM commands serially. If one is running, wait.

## Next Best Medium Tasks

1. Add official incentive re-verification pass after source/date checks.
2. Replace seeded example URLs with real imported research batches.
3. Add screenshot artifacts to README after macOS Screen Recording permission allows `--verify-ui` capture.

## Next Best Low Tasks

1. Polish dashboard copy and empty-state text.
2. Add more seeded Hyundai/Kia 2026 trims after source-backed verification.
3. Expand scope tests for Ontario/national modes without changing source strategy.
4. Update screenshots/README after launch verification.

## Handoff Format

```text
Done: <one sentence>
Changed: <paths>
Verified: <commands>
Next: <one task>
```
