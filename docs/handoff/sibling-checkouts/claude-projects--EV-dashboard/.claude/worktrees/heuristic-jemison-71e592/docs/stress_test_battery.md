# Stress test battery

A small set of canonical tasks used to deliberately probe a reasoning level's limits. When you want to know whether a model+effort can handle a class of work in this codebase, run the battery at that level and let the calibrator fold the results into the empirical learning loop.

## How it works

1. `python3 scripts/stress_test.py --suite quick` (default) prints a numbered checklist of 5 tasks. Each task includes:
   - **What to do** — a concrete instruction.
   - **Acceptance rubric** — the objective check that says pass or fail.
   - **Expected task tag** — which `task_complexity.py` bucket the result feeds into.
2. Work through each task in your current Claude Code session at the current model+effort.
3. After each task, log the outcome:
   ```
   python3 scripts/stress_test.py --record <task-id> --passed   # if rubric met
   python3 scripts/stress_test.py --record <task-id> --failed   # otherwise
   ```
   Each `--record` writes one observation row to `logs/stress_runs.jsonl` (gitignored).
4. After completing the suite:
   ```
   python3 scripts/stress_test.py --finish
   ```
   This runs `calibrate.py --include-stress` to fold the new observations into `cost_model.py` and `task_complexity.py` per the asymmetric aggression rules.

## When to run it

- First time you switch to a new model or effort level on this codebase.
- After a long stretch on a level that hasn't been probed in a while.
- Before relying on a level for a high-stakes task (so the recommender's recommendation is grounded).

You don't have to run the whole suite — `--task <id>` runs a single task. Useful when you only care about one tag.

## Quick suite — 5 canonical tasks

### `t1-rename` — symbol-rename across files

**What to do.** Rename the `cad` formatter in `src/lib/format.ts` to `formatCad` and update every call site so `tsc --noEmit` is still green.

**Rubric.** `npx tsc --noEmit` exits 0 after the rename. No remaining references to the old name (`grep -rn "\\bcad(" src/` returns nothing).

**Tag.** `rename-symbol`.

### `t2-test-mirror` — add a vitest case

**What to do.** Open `src/lib/labels.test.ts`. Add one new test case that checks `resolve(TERM.peakDc, true)` returns `"Fast charging speed"`.

**Rubric.** `npm test -- labels` shows the new test passing alongside the existing ones.

**Tag.** `test-addition`.

### `t3-summarize` — file summary

**What to do.** Read `src/components/CompareView.tsx` and write a 100–120 word summary describing what the component renders, the four tabs it owns, and which Zustand state it subscribes to.

**Rubric.** Summary mentions all four tab names (`Specs`, `Trip Plan`, `Map & Range`, `Used Market`), names the `useAppStore` import, and stays inside the 100–120 word window.

**Tag.** `documentation`.

### `t4-bug-fix` — pre-planted bug

**What to do.** A "fake bug" is documented in `specs/_stress/t4-bug-fix.md` (created when you first run the suite). Read the spec, write a failing test that reproduces it, then fix the bug so the test passes.

**Rubric.** New test exists, `npm test -- <suite>` was red before the fix, green after.

**Tag.** `bug-fix-clear-repro`.

### `t5-spec-stub` — write a 1-page spec

**What to do.** A short feature description is in `specs/_stress/t5-spec-stub.md`. Read it and write a complete spec following the project template (Goal, User-visible behavior, Acceptance criteria, Inputs/state touched, Outputs, Test plan).

**Rubric.** Spec contains all six template sections, written in plain English. Acceptance criteria are testable.

**Tag.** `spec-writing`.

## Adding new tasks to the battery

Edit `scripts/stress_test.py` `BATTERIES` dict. Each task is a Python dict with `id`, `tag`, `instruction`, `rubric`. Mirror the entry here in plain English when you add it. Keep the quick suite at ~5 tasks — longer is fine for a `--suite full` later.

## Why this exists

The constants in `cost_model.py` (TASK_TOKENS) and `task_complexity.py` (TASKS minimums) started as hand-tuned guesses. The empirical learning loop (calibrate.py) updates them from real milestones automatically. The stress test battery is the *active* probe that lets you generate observations on demand instead of waiting for milestones to accumulate naturally — useful for first-time level changes or before relying on a level for high-stakes work.
