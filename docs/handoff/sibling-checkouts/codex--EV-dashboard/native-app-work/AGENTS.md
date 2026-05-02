# AGENTS.md

## Start
- Read `PLAN.md` first.
- Read `MEMORY.md` only when the queue item depends on hot paths, proof strategy, token ROI, or a blocker pattern.
- Read only files named by the current `RUN_QUEUE` item plus justified extras.
- If more than 8 active files are needed, explain why in one line before continuing.

## Effort Truth
- `actual_run_effort` is the live window/model truth.
- `ceiling_effort` is the highest task class the live run may consume.
- `task_effort` is the current queue item class and may be lower than `actual_run_effort`.
- Never imply the live model upgraded/downgraded when only task routing changed.
- Never auto-enter `XHIGH`; emit a handoff instead.

## Medium Long Run
- Default target is `MEDIUM_LONG_RUN`.
- Use `RUN_QUEUE`, not chat history, as the execution source.
- Task/batch IDs are labels only; never stop because a label changed.
- `MEDIUM` consumes approved `MEDIUM` and `LOW` items until `STOP_CONDITIONS`.
- If a queued item becomes non-medium, log one compact blocker, skip it, and continue to the next safe item.
- `HIGH` is for boundary setup, failed-verification diagnosis, source/tooling/release decisions, and final cleanup.
- Freeze mature control docs; update them only when state, verification truth, risks, or queue order changes.

## Source Safety
- Classify every serious source as `OFFICIAL_OPEN_DATA`, `PUBLIC_OEM_ENDPOINT`, `DEALER_GROUP`, `MARKETPLACE`, or `BLOCKED`.
- Before implementing a new source, record a compact source card in `PLAN.md` or `ISSUE_LOG.md` if it affects current work.
- Stop on login, CAPTCHA, robots block, Cloudflare challenge, private-token dependency, unclear terms, broad crawling, personal-data collection, or commercial-use ambiguity.
- Local MVP source use stays low-volume, user-initiated, provenance-preserving, and non-commercial.

## Token ROI
- Use Caveman `lite` by default: fewer words, same work.
- Preserve exact commands, file paths, code identifiers, output schemas, risks, and stop conditions.
- Do not restate stable rules during normal runs.
- After every verified item, token-sweep: prune completed queue detail, compact `NEXT_RUN`, update only changed state, and keep `PLAN.md` active-only.
- Keep `MEMORY.md` reusable-pattern-only; keep `ISSUE_LOG.md` blocker-only; keep `TESTING.md` proof-truth-only.
- Prefer product progress over further control-system polishing unless the scheduler is stale, contradictory, or failing.

## Tools
- Use SwiftPM/macOS build skills for build, launch, telemetry, and test-triage work.
- Use signing/packaging skills only at release boundary.
- Do not use unrelated plugins or spawn subagents unless the user explicitly asks.
- Do not install Caveman/Cavekit/Cavemem or any global tool without explicit approval.

## Verification
- Run SwiftPM commands serially; never build/test/launch-verify in parallel.
- Use the current queue item's verify command.
- Default build: `CLANG_MODULE_CACHE_PATH=.build/clang-module-cache swift build --product EVAutoTraderApp`.
- Runtime launch proof: `./script/build_and_run.sh --verify`.
- Runtime event proof: `./script/build_and_run.sh --telemetry`.
- Treat `swift test` as package-test build signal until runtime assertion execution is proven.

## Stop
- Stop on unclear verification failure, source/legal/access ambiguity, broad schema/architecture change, release/signing decision, user decision, unexpected broad file need, no safe queued work, or `XHIGH` requirement.
- Do not stop for task/batch label changes when the next queued item is approved inside the current ceiling.

## Output
- Keep output compact.
- Normal result: `TASK_RESULT` and `NEXT_RUN`, including `actual_run_effort`, `ceiling_effort`, and `task_effort`.
- Escalation: `EFFORT_ESCALATION` and `NEXT_RUN`, including all 3 effort fields.

## Tiny Run
```text
Continue from PLAN.md.
Reasoning: MEDIUM.
Run MEDIUM_LONG_RUN from RUN_CURSOR until STOP_CONDITIONS.
Read only queue-item files.
Skip blocked items and continue.
Verify serially.
Token-sweep after every verified item.
Return compact TASK_RESULT and NEXT_RUN with actual_run_effort, ceiling_effort, task_effort.
```
