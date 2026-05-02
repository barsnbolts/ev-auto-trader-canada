# CHECKLIST.md

## Pre-Run Gate
- Repo root is correct.
- `PLAN.md` read.
- `MEMORY.md` read only if useful for the current queue item.
- `actual_run_effort`, `ceiling_effort`, and `task_effort` are explicit.
- Current `RUN_QUEUE` item has goal, allowed files, done rule, verify command, skip rule, and fallback.
- Control docs are not rewritten unless live state, verification truth, risk, or queue order changed.

## Per-Item Gate
- Work stays inside allowed files or has a one-line justification.
- No source/legal/access-control ambiguity.
- No broad schema, architecture, release, or toolchain decision.
- Verification is serialized.
- If blocked, log compactly, skip if safe, and continue to next queued item.

## Source Gate
- Serious source has owner, URL, terms/robots status, fields, rate limit, proof URL, cache rule, and stop rule.
- Source class is explicit: `OFFICIAL_OPEN_DATA`, `PUBLIC_OEM_ENDPOINT`, `DEALER_GROUP`, `MARKETPLACE`, or `BLOCKED`.
- Stop on login, CAPTCHA, robots block, Cloudflare challenge, private-token need, broad crawling, personal-data collection, or commercial-use ambiguity.
- Official/open catalog data keeps attribution and unknown-field notes.

## Medium-Long-Run Gate
- Continue across task/batch labels.
- Consume approved `MEDIUM` and `LOW` work until `STOP_CONDITIONS`.
- Do not pause after a verified item if another safe queued item remains.
- Stop only when queue is empty or a real blocker appears.

## Effort-Truth Gate
- Did the live model actually change? If no, do not say `actual_run_effort` changed.
- Did only `task_effort` change? Say so.
- Did next work exceed `ceiling_effort`? Emit handoff, do not fake an upgrade.
- Never auto-enter `XHIGH`.

## Token-Sweep Gate
- Completed item removed or compressed to one result line.
- `NEXT_RUN` is under 8 lines.
- `PLAN.md` stores active state only.
- `MEMORY.md` stores reusable learning only.
- `ISSUE_LOG.md` stores unresolved blockers only.
- `TESTING.md` stores proof truth only.
- Product progress beats more meta-polish unless the scheduler is failing.

## High-Cleanup Gate
- Run after a long medium batch, failed verification diagnosis, milestone boundary, or release/source/tooling decision.
- Prune stale queue items.
- Refresh hot paths.
- Preserve proof limits.
- Hand off to the cheapest safe next run.

## Tooling Gate
- SwiftPM/macOS build skills are appropriate for build, launch, telemetry, and test triage.
- Signing/packaging skills wait for release boundary.
- Caveman/Cavekit/Cavemem install requires explicit approval.
- External tooling failure cannot block local MVP product progress unless the user makes it a blocker.

## Release-Boundary Gate
- Direct-install `.app` path is verified.
- Signing/notarization decision is explicit.
- Full Xcode/toolchain needs are explicit.
- Runtime proof limitations are not hidden.
