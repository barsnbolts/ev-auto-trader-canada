# Task complexity map

Reference for which reasoning level handles which task. The authoritative data lives in `scripts/task_complexity.py`. This document is a human-readable mirror.

Levels (low → high): `low`, `medium`, `high`, `xhigh`, `max`.
Models (small → big): `haiku`, `sonnet`, `opus`.

A task fits the current session if **both** effort *and* model meet the minimum.

## Quick check (one command)

```bash
python3 scripts/check_level.py --task spec-writing
```

Exit 0 → fits. Exit 1 → mismatch (printed reason).

## Categories

### Architecture / planning — High + Opus minimum

| Task tag | Min effort | Min model | Why |
|---|---|---|---|
| `cluster-planning` | max | opus | designing a new cluster end-to-end |
| `spec-writing` | high | opus | ambiguity → design judgment |
| `architectural-refactor` | high | opus | cross-file invariants must hold |
| `physics-model-change` | high | opus | load-bearing IP, golden tests must stay green |
| `rust-crate-integration` | high | opus | unfamiliar APIs + compile error judgment |
| `external-api-design` | high | opus | hard-to-reverse contract decisions |

### Spec-driven implementation — Medium + Sonnet OK

| Task tag | Min effort | Min model | Why |
|---|---|---|---|
| `spec-implementation` | medium | sonnet | spec already decided what to build |
| `data-update` | medium | sonnet | seed.json edits with cited sources |
| `bug-fix-clear-repro` | medium | sonnet | repro narrows the search |
| `test-addition` | medium | sonnet | shape mirrors existing tests |
| `ui-tweak-single-file` | medium | sonnet | small JSX/CSS changes |
| `chrome-mcp-validation` | medium | sonnet | scripted browser exercise |
| `documentation` | medium | sonnet | docs need clarity, not deep judgment |
| `research-deep` | medium | sonnet | parallel-dispatch fan-out; each agent reasons short |
| `ui-tweak-multi-file` | medium | sonnet | JSX/CSS spanning ≥2 files |

### Mechanical cleanup — Low + Haiku OK

| Task tag | Min effort | Min model | Why |
|---|---|---|---|
| `milestone-ritual` | low | haiku | deterministic script invocation |
| `caveman-commit-message` | low | haiku | rote summary |
| `dead-code-archive` | low | haiku | `git mv` after grep verifies no callers |
| `rename-symbol` | low | haiku | deterministic search-and-replace |
| `queue-rerank` | low | haiku | scripted |
| `typo-fix` | low | haiku | trivial |
| `format-fix` | low | haiku | trivial |

## How to update this list

1. Edit `scripts/task_complexity.py`'s `TASKS` dict.
2. Mirror the change here.
3. Add an entry to `docs/reasoning_capability_log.md` if a real task taught you the boundary.

## Heuristics for "do I have a tag?"

- If the AUTONOMOUS_PLAN item description uses words like *plan*, *spec*, *design*, *architecture*, *refactor*, *physics*, *new cluster* → tag it `spec-writing` or `architectural-refactor`.
- *Implement*, *fix*, *update*, *add field*, *seed* → `spec-implementation` / `data-update`.
- *Archive*, *rename*, *typo*, *format*, *commit* → cleanup tags.
- If you can't tell, fall back to `default` (= medium / sonnet) — permissive, still fences off `low/haiku` from genuinely hard work.
