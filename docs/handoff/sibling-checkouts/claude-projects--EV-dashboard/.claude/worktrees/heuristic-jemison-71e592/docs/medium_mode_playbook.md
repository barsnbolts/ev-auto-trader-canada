# Medium-mode playbook

*For Claude sessions running at Medium reasoning on this project. Written on Max at Cluster H so future medium-me has guardrails.*

## The short version

Medium can ship clean work if the task is already decided. Medium stumbles when it has to *decide* the task. Your north star: a good spec is half the job; do what the spec says, nothing more, and stop.

## What medium does well here (go ahead, no ask)

- **Implement a fully-written spec.** If `specs/<id>-<name>.md` exists with acceptance criteria, write the code. Tests enforce the spec.
- **Data updates to seed.json** that have cited sources in hand. `validate.py` is the safety net.
- **Style fixes, refactors with tests.** Rename a symbol, extract a helper, tidy a component — if `npm test` and `cargo test` are green before and after, you are fine.
- **Fix a bug with a clear repro.** If Ian says "the slider doesn't update the Map tab on Safari", go fix it. Write a test if possible.
- **Chrome-MCP validation sweeps.** Open app, click through, screenshot, write observations to LEARNINGS.
- **Run `scripts/milestone.py` at the end of every change.** If it halts red, fix the underlying issue before continuing.
- **Append to `docs/reasoning_capability_log.md`** when a task feels hard or you had to retry — that log guides future sessions.

## What medium should NOT attempt alone (stop and defer to High)

- **Changes to `src/lib/thermal.ts` or `src-tauri/src/thermal.rs`** — the physics model is load-bearing. Golden-value regression tests protect against silent drift but only if you don't change the curves.
- **Architectural refactors** across three or more files — extract a spec first, save to `specs/unresolved/<name>.md`, then stop.
- **New Tauri commands or new Rust modules** — set up needs High-level judgment on API shape.
- **Merging worktree branches, force pushes, git resets** — destructive. Ask.
- **Deleting files that are not obviously abandoned.** If in doubt, move to `_archive/` instead of `rm`.
- **Dependency upgrades** beyond patch versions (unless already tested).

## How to decompose a feature so medium can ship it

1. **Start from a spec.** If none exists, write one — but a spec is a *design* artifact. Writing a spec is High-level work. If you are medium and the spec is missing, flag it: create `specs/unresolved/<feature>.md` with open questions and stop.
2. **Slice small.** One PR = one acceptance criterion. Do not bundle unrelated changes.
3. **Test first when you can.** A failing test in `src/lib/*.test.ts` or `src-tauri/src/*.rs` gives you a target; turn it green.
4. **Ship via the ritual.** `scripts/milestone.py` runs tsc, vitest, cargo test, drive_app --smoke, validate, metrics, queue, commit. Red halts. Green is the only exit.

## When stuck

You are "stuck" after three genuinely different tries at the same error. The pattern:

1. Read the error carefully. Ninety percent of the time the message names the fix.
2. If not, grep the repo for a similar pattern that works. Copy its shape.
3. If still not, WebSearch — check `docs/research/` first in case someone already looked it up.
4. If *still* not, **escalate**. Write `specs/unresolved/<problem>.md` with:
   - What you were trying to do
   - What you tried
   - Why each attempt failed
   - The specific thing you cannot decide

Then stop. The next High session picks it up.

## When to ask Ian vs. when to proceed

| Situation | Action |
|-----------|--------|
| You are about to delete or overwrite something you did not create | Ask |
| You are about to push to a remote | Ask |
| You are about to run `git reset --hard` or anything with `-f` | Ask |
| Spec has an acceptance criterion you cannot satisfy | Ask |
| You have a fix but it changes behavior the spec did not mention | Ask |
| Error toasting on a UI change Ian requested | Fix and continue |
| Test failures on code you wrote in this turn | Fix and continue |
| A new external API key is needed | Ask; stub with feature flag per `docs/external_keys.md` |

## Self-check rituals (do these every turn)

- After every file edit: `npx tsc --noEmit` on the touched path.
- After every `src/lib/*.ts` change: `npm test -- <file>` for the sibling test.
- After every `src-tauri/src/*.rs` change: `cargo check --manifest-path src-tauri/Cargo.toml`.
- At the end of a task: `scripts/milestone.py <id> "<caveman summary>"`.

## Token budget

- Caveman style for chat replies (`docs/writing_style.md` rules). Short. Drop filler.
- Do not re-read the whole game plan every turn. Read `.resume.md` and `.queue_top3.md` only.
- Do not re-explore the codebase if `CLAUDE.md` already has the answer.
- Use Grep for known symbols, Glob for known paths. Agents only for open-ended exploration.

## Heuristics for "this smells like High work"

- "I'm not sure which of these three options is right" — that is a decision, escalate.
- The spec doesn't exist and writing one would take >10 minutes.
- The physics model would change shape.
- Three files open and each depends on choices in the others.
- You are tempted to add a comment that says "this might need revisiting".

If two or more of the above are true, drop a note in `specs/unresolved/` and stop. High picks it up.
