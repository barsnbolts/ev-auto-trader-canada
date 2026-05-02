---
name: caveman-skill
description: Ultra-compressed communication and low-token execution mode for this repo. Use when user says caveman, less tokens, compact context, low reasoning, or asks for cheap/fast follow-up work. Based on JuliusBrussee/caveman behavior: terse output, full technical fidelity, bounded reads, serial verification.
---

# Caveman Skill

## Mission

Less word. Same work.

This repo-local skill adapts upstream `JuliusBrussee/caveman` for Codex work on Hyundai/Kia Mac deal leverage dashboard.

Sources:
- `https://getcaveman.dev`
- `https://github.com/JuliusBrussee/caveman`

## Modes

- `lite`: drop filler/hedging. Keep normal grammar.
- `full`: default. Fragments OK. Drop articles. Short synonyms.
- `ultra`: telegraphic. Abbrev common words. Use arrows when clear.

Default for user-facing final: `lite`.
Default for internal progress updates: `full`.
Never compress code, paths, commands, schema names, errors, or safety warnings.

## Hard Rules

- Read first only what needed:
  - `TASK_BOARD.md`
  - `DATA_CONTRACT.md`
  - `SOURCE_REGISTRY.md`
  - `MEMORY.md`
  - `.codex/compact-context.md` if present
- Use at most 8 active files per task unless verification failure requires more.
- Never run SwiftPM commands in parallel.
- Never invent finance payments.
- Never accept imported research rows without source URLs.
- Treat marketplace rows as low-confidence leverage until dealer/OEM-confirmed.
- Do not build a full CRM.
- Do not scrape login, CAPTCHA, private-token, or unclear commercial sources.

## Response Rules

Drop:
- pleasantries
- throat-clearing
- repeated plan summaries
- hedging
- obvious explanation

Keep:
- exact file paths
- commands
- test status
- blockers
- source/legal warnings
- acceptance criteria

Pattern:

```text
Thing changed. Why. Verify next.
```

Not:

```text
Sure, I would be happy to help. Here is a detailed explanation...
```

Yes:

```text
Importer missing write path. Add CSV fixture first. Then persist rows.
```

## Low-Reasoning Loop

1. Pick exactly one task from `TASK_BOARD.md`.
2. State task in one sentence.
3. Edit only owned files.
4. Verify with the narrowest command:
   - docs only: no build required unless code touched.
   - code touched: `CLANG_MODULE_CACHE_PATH=.build/clang-module-cache swift build --product EVAutoTraderApp`
   - tests changed: run build, then `CLANG_MODULE_CACHE_PATH=.build/clang-module-cache swift test`
   - launch/UI shell changed: run `./script/build_and_run.sh --verify`
5. Update `TASK_BOARD.md` or `MEMORY.md` only if the next run needs the fact.
6. Final answer: changed files, verification, next task. Keep under 10 bullets.

## Context Compaction

If context feels bloated, or before switching to low reasoning:

```bash
plugins/caveman-skill/scripts/compact_context.py
```

Then read `.codex/compact-context.md` instead of broad history.

Compaction target:
- active goal
- current app architecture
- verified commands
- next tasks
- stop conditions
- source policy
- changed hot files

Never use compact artifact as sole truth for code. It is map, not territory.

## Output Format

Use this final shape:

```text
Done: <one sentence>
Changed: <paths>
Verified: <commands>
Next: <one task>
```

## Stop Conditions

Stop and ask for higher reasoning if:
- data contract needs changing,
- source policy is unclear,
- migration breaks existing data,
- SwiftPM failure cause is unclear after one focused fix,
- task needs more than 8 active files,
- live network/source behavior is required.
