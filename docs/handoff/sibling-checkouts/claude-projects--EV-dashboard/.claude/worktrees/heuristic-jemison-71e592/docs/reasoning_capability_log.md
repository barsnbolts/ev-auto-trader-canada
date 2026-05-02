# Reasoning capability log

Running log of what each reasoning level handled well or stumbled on in this codebase. Append new entries to the top. Future sessions read this before taking on similar tasks so they know what's realistic at their current level.

**Format per entry:**

```markdown
## YYYY-MM-DD — short task name

Model: Opus 4.7 / Sonnet 4.6 / Haiku 4.5
Level: max / high / medium / low
Outcome: ok / stumbled / failed
What worked / what didn't:
What to try differently next time at this level:
```

---

## Seeded examples (replace as real data comes in)

## 2026-04-24 — Cluster H planning + debug infra build

Model: Opus 4.7
Level: max
Outcome: ok
What worked: full plan drafted from ramble + research sweep, then executed H1–H7 in one session. Rust `tracing` crate wired in one pass after one compile fix (missing `json` feature flag). Vite middleware plugin for log sink added to `vite.config.ts` without breaking dev server.
What to try differently: research sweep in parallel with codebase exploration saved a round-trip. Keep that parallel-agent pattern.

## 2026-04-24 — Leaflet double-init fix (F3)

Model: Opus 4.7
Level: high
Outcome: ok
What worked: cancellation-flag pattern inside the `useEffect` async callback after the `_leaflet_id` guard alone didn't hold under React Strict Mode remounts.
What to try differently: the first fix attempt (checking `_leaflet_id`) was reasonable but incomplete. Next time, go straight to the cancellation-flag pattern when the problem involves async + `useEffect` + remount.

## Example — medium-mode failure mode (illustrative, not a real run)

Model: Sonnet 4.6
Level: medium
Outcome: stumbled
What worked: implemented the spec-listed row edits in CompareView cleanly.
What didn't: got partway through changing `thermal.ts` curve constants when the spec was ambiguous about the LFP vs NMC handling. Should have stopped and written `specs/unresolved/thermal-chemistry-branch.md` instead of guessing.
What to try differently at medium: if the spec doesn't name the chemistry branch, escalate — don't guess.

---

## Notes on level boundaries (from experience in this repo)

- **Max / Opus:** planning new clusters, writing specs for ambiguous features, triaging rambling feature requests into discrete workstreams, architectural refactors, physics model touches, unfamiliar Rust crate integration.
- **High / Opus:** implementing a well-written spec that spans 3+ files, debugging a race condition, tuning a new dependency.
- **Medium / Sonnet:** implementing a well-written spec that stays in 1–3 files, seed.json edits with citations, test additions, documentation, cleanup.
- **Low / Haiku:** formatting, string replacements, typo fixes, simple renames, queue ranking.
