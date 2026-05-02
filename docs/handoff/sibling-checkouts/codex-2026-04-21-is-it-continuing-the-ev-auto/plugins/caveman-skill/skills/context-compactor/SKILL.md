---
name: context-compactor
description: Use to compact repo context before low-reasoning continuation, after long implementation runs, before handoff, or whenever context bloat hurts progress. Creates .codex/compact-context.md from repo-local truth files and git/code summaries.
---

# Context Compactor

## Goal

Make next run cheap.

## Run

```bash
plugins/caveman-skill/scripts/compact_context.py
```

Output:

```text
.codex/compact-context.md
.codex/safe-area.md
```

## Use

Next agent reads:

1. `.codex/compact-context.md`
2. `TASK_BOARD.md`
3. `DATA_CONTRACT.md`
4. `SOURCE_REGISTRY.md`

Avoid reading full chat history or broad source tree unless task needs it.

## When

- whenever estimated context load is over 40%
- before switching to low reasoning
- after architecture changes
- after verification pass
- after source research
- before pause/handoff
- when more than 8 files are active
- automatically on Codex session start/resume via `.codex/hooks.json` when hooks are honored

## Zones

- `normal`: below 40%; continue normally, compact before handoff.
- `safe-area`: 40-69%; compact now, finish current file, avoid broad reads.
- `danger`: 70%+; stop expansion, verify or pause, resume only from `.codex/safe-area.md`.

## Active Files

The script ignores untracked directory roots because this repo may be mostly untracked during local build-up.
If the repo has no tracked files yet, the script also ignores raw untracked files for load estimates.
During long work, write explicit paths to:

```text
.codex/active-files.txt
```

One path per line. These paths count toward the 40% safe-area threshold.

## Safety

Compact context is map, not truth. For exact behavior, inspect source file.
