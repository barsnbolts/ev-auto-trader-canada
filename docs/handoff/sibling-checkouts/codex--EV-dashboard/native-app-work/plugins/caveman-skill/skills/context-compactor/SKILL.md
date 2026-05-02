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
```

## Use

Next agent reads:

1. `.codex/compact-context.md`
2. `TASK_BOARD.md`
3. `DATA_CONTRACT.md`
4. `SOURCE_REGISTRY.md`

Avoid reading full chat history or broad source tree unless task needs it.

## When

- before switching to low reasoning
- after architecture changes
- after verification pass
- after source research
- before pause/handoff
- when more than 8 files are active
- automatically on Codex session start/resume via `.codex/hooks.json` when hooks are honored

## Safety

Compact context is map, not truth. For exact behavior, inspect source file.
