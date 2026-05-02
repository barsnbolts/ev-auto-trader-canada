# Phase 1.8 — Integration Patch: Model + Agent Optimization

## What this is

This is **NOT** a standalone plan. It is a set of **integration patches** to the existing Phase 1.8 execution plan at:

`/Users/ianmcadam/.claude/plans/you-are-continuing-a-drifting-planet.md`

The original plan stays the source of truth for WHAT to build (Waves 1/2/3, files, commits, PR bodies). This patch refines HOW to execute (which model, which reasoning level, when to use subagents — fresh vs forked) based on research done during PR-C mid-flight on 2026-04-30.

Wave 1 (PR-A) already shipped under the original plan's medium-mode rules. This patch applies to Wave 2 (PR-C) remainder + Wave 3 (PR-B) only.

---

## Context

Operator (beginner, first project, paper-mode trading bot) raised the question mid-execution: should we switch from "Opus 4.7 manually toggling medium↔high, no subagents" to "Opus 4.7 high (1M context?) + optimized subagent fanout"? And how does the picture change at medium / high / xhigh / max effort levels?

Research clarified several earlier assumptions:
- 1M context premium was removed March 2026 (no rate premium — but volume cost still grows since context accumulates).
- Opus 4.7 has 5 effort levels: low / medium / high / xhigh / max. Same per-token rate; cost scales with output volume.
- Low-effort 4.7 ≈ medium-effort 4.6 quality. New tokenizer's +35% input mostly offset by dropping a tier.
- **Forked subagents reuse parent prompt cache → ~10% cost of fresh subagents**, AND are programmatically spawnable via `CLAUDE_CODE_FORK_SUBAGENT=1` env var. Trigger: omit `subagent_type` from `Agent(...)` tool call.
- Subagent parallelism cuts search time 30-40%, but heavy fanout adds 200-500% token overhead.
- Cache TTL is 5 min (down from 1 hour) — don't dawdle within a wave.
- Hooks (PreToolUse/PostToolUse/Stop) can prevent regenerate-cycles.

---

## Cost analysis (remaining work: PR-C resolution + PR-C completion + PR-B Wave 3)

Estimated envelope: ~600k input + ~120k output tokens cumulative.

| Mode | Description | Est. cost | Wall-time | Drift risk |
|---|---|---|---|---|
| A | Pure medium, no subagents (original plan default) | ~$5.40 (~$2 cached) | baseline | Medium |
| **B** | **High + 2-3 forked Sonnet subagents for research** | **~$4.50** (forks save ~$1 vs fresh) | **30-40% faster** | **Low** |
| B-fresh | High + 2-3 fresh Sonnet subagents | ~$5.40 | = B | Low |
| C | xhigh + selective subagents | ~$8 | +5% over B | Low |
| D | max + heavy parallel fanout | ~$18-25 | +2% over B | Low |
| E | High + 1M context + subagents | ~$7-8 | = B | Medium (no compaction) |
| F | Pure low effort | ~$3.90 | baseline | High (judgment risk on ECE math) |

**Mode B is now CHEAPER than Mode A** (forks reuse cache → ~10% input cost; main thread on high adds output tokens but the cache savings on subagents more than compensate) AND ships ~30-40% faster.

---

## Integration patches (apply post-approval, in order)

### Patch 1 — Append "Hard caps" block to memory file

Path: `/Users/ianmcadam/.claude/projects/-Users-ianmcadam-Documents-Claude-Trading-bot/memory/feedback_agent_optimization.md`

Action: APPEND this block at end of file:

```markdown

## Hard caps + fork mechanism (added 2026-04-30)

- Max 3 parallel subagents per main-thread message.
- Default subagent model: Sonnet 4.6 for research, Haiku 4.5 for grep-only, Opus 4.7 only when judgment is the deliverable.
- No subagents during pre-baked execution waves (info already in plan).
- Never leave subagent chains running unattended.
- Within a single turn, prefer batching all parallel calls in ONE message (cache reuse + true parallelism).
- **Forked vs fresh subagents:**
  - **Forked** = inherits parent's full conversation history, system prompt, tool definitions, cache. First request reuses parent prompt cache → effective input cost ~10% of fresh. Use when subagent benefits from project context.
  - **Fresh** = empty context, defined system prompt only. Use when isolation is the point (independent code review, cross-AI consensus).
  - **Spawn a fork:** call `Agent(description=..., prompt=..., model=...)` and OMIT the `subagent_type` parameter. Requires `CLAUDE_CODE_FORK_SUBAGENT=1` env var (set in `.claude/settings.local.json`).
  - **Spawn a fresh:** call `Agent(subagent_type="general-purpose"|"Explore"|"Plan"|...)` explicitly.
- Skills can declare `context: fork` in YAML frontmatter to always fork (declarative alternative).
```

### Patch 2 — Enable fork mode via settings

Path: `/Users/ianmcadam/Documents/Claude/trading-bot/.claude/settings.local.json`

Action: Read existing file (create if missing). Add `env.CLAUDE_CODE_FORK_SUBAGENT = "1"`.

If file doesn't exist, create:
```json
{
  "env": {
    "CLAUDE_CODE_FORK_SUBAGENT": "1"
  }
}
```

If file exists with other content: merge the `env` block in. Use Read → Edit pattern, not blind overwrite.

This file is `settings.local.json` (project-scoped, git-ignored by default) — keeps blast radius limited to this project. Operator can promote to user-scope `~/.claude/settings.json` later if they like the pattern.

### Patch 3 — Insert new §2.5 into the original Phase 1.8 plan

Path: `/Users/ianmcadam/.claude/plans/you-are-continuing-a-drifting-planet.md`

Action: INSERT a new section between the existing §2 ("Model + agent strategy") and §3 ("Wave order"). The new section codifies Mode B as the operating mode for remaining waves.

```markdown

## 2.5 Model + agent operating mode (added 2026-04-30, mid-execution)

After Wave 1 (PR-A) shipped clean, operator + bot reviewed cost/speed trade-offs across 6 modes (medium/high/xhigh/max ± subagents ± 1M context, fresh vs forked). Adopted **Mode B (forked variant)** for remaining waves:

- **Main thread:** `claude-opus-4-7` (standard 200k context, NOT [1m]). The 1M premium was removed but volume cost still grows; 200k auto-compacts cleanly at ~190k.
- **Reasoning effort:** high for plan/judgment work, medium for mechanical work. Switch announced explicitly per task.
- **Subagents:** max 3 parallel forked Sonnet 4.6 agents per main-thread message, only for research/exploration that benefits from parallelism. Never during pre-baked execution.
- **Fork mechanism:** `CLAUDE_CODE_FORK_SUBAGENT=1` set in `.claude/settings.local.json`. Spawn a fork by calling `Agent(...)` and OMITTING `subagent_type`. Cache reuse → ~10% input cost vs fresh.
- **Token tracking:** `/cost` after each commit, log cumulative in `memory/medium-mode-execution-issues.md`.

### Mode B per-wave application

| Phase | Main reasoning | Subagent fanout | Fork or fresh? | Why |
|---|---|---|---|---|
| PR-C secret-scan debug | high | 2 parallel Sonnet | forked | Need project context (workflow files, recent commits) |
| PR-C completion (mechanical) | medium | none | n/a | Pre-baked |
| PR-B Wave 3 ECE math (🔴 HIGH ONLY) | high | 1 Sonnet `Plan` agent (validate math approach) | fresh (specify subagent_type="Plan") | Plan agent has structured output schema, fresh fits better |
| PR-B schema + routine + smoke | medium | none | n/a | Pre-baked |
| PR-B commits + PR | medium | none | n/a | Mechanical |

### Cost expectation

Remaining Phase 1.8 work (PR-C remainder + PR-B): ~$4-7 cumulative with forks. If `/cost` shows >$15, model math was wrong → revisit.

### Drop-down triggers (operator-facing announcements)

I (the executing agent) will announce model transitions explicitly:
- "Drop to medium — entering mechanical PR-C completion."
- "Back to high — starting PR-B ECE math."
- "Drop to medium — ECE math file written, rest of PR-B is mechanical."

### Verifying fork mode is active

After Patch 2 applied, verify with: `cat .claude/settings.local.json | grep FORK_SUBAGENT` → should show `"CLAUDE_CODE_FORK_SUBAGENT": "1"`. Restart Claude Code session if env var was added mid-session.
```

### Patch 4 — Append PR-C debug protocol to original plan §6.X

Path: `/Users/ianmcadam/.claude/plans/you-are-continuing-a-drifting-planet.md`

Action: After existing §6.11 ("PR-C title + body"), INSERT a new §6.12:

```markdown

## 6.12 PR-C debug addendum (added 2026-04-30)

Secret-scan workflow timed out at 5m0s on PR #9 (PR-A baseline was 4m1s — 1s margin). Stop condition triggered after 2 attempts.

### Investigation protocol (Mode B with forks)

Two parallel forked Sonnet agents in one message:

```
[parallel call 1]
Agent(
  description="Workflow inspection",
  model="sonnet",
  prompt="Read .github/workflows/secret-scan.yml. Identify timeout-minutes,
         actions/checkout fetch-depth value, gitleaks step config. Compare
         to passing PR-A run config (no changes expected, but verify).
         Report: actual config + likely root cause of 5m timeout."
)

[parallel call 2]
Agent(
  description="gitleaks options research",
  model="sonnet",
  prompt="Research gitleaks-action README for fetch-depth, log-opts, scan
         scope flags. Identify minimal-change fix for PR scans (probably
         fetch-depth: 2). Report: recommended fix + ETA."
)
```

(Both omit `subagent_type` → become forks → reuse parent context cache.)

### Apply fix

Likely fix: change `fetch-depth: 0` → `fetch-depth: 2` in actions/checkout step inside secret-scan.yml. **Operator confirms before edit** (CI workflow modification per CLAUDE.md "Executing actions with care" rules).

### Re-run + merge

- Push fix to `feat/ibkr-prework-hybrid`
- Watch CI (`gh pr checks 9 --watch`)
- Squash-merge with `--delete-branch`
- `git checkout main && git pull`
- `bash scripts/health.sh` → 12/12
- `/cost` → log cumulative

### Lesson for memory log

Add entry to `memory/medium-mode-execution-issues.md`:
- What: secret-scan 5m timeout on PR-C; PR-A had 1s margin
- Why: gitleaks fetch-depth + repo growth; not a Mode-B-specific issue
- How resolved: fetch-depth fix, single retry
- Lesson: future PRs adding files >100 lines should preview CI on a draft PR first
```

### Patch 5 — Append Mode B note to original plan §7.X (ECE math fresh-Plan-agent step)

Path: `/Users/ianmcadam/.claude/plans/you-are-continuing-a-drifting-planet.md`

Action: After existing §7.3 ("Pre-baked file: scripts/ai-usage-score.py" with its 🔴 HIGH ONLY tag), INSERT a paragraph under the tag:

```markdown
🔴 HIGH ONLY before writing this file. Mode B addendum (2026-04-30): also spawn 1 FRESH Sonnet `Plan` agent BEFORE writing the file. Use `subagent_type="Plan"` explicitly (we want a fresh context for math validation — uncontaminated by main-thread assumptions). Prompt: "Validate the ECE + Bayesian update math in the spec below. Flag any subtle correctness issues. Cite formulae from academic ML calibration sources. Return: (a) any math errors, (b) any boundary-condition gaps, (c) recommended test cases." Read the agent's response, fold corrections into the file, THEN write.
```

---

## Files to modify (post-approval, summary)

**Patches 1-5 (Mode B, applied during Phase 1.8 execution):**

| Path | Change | Lines |
|---|---|---|
| `memory/feedback_agent_optimization.md` | Append "Hard caps + fork mechanism" block | +14 |
| `.claude/settings.local.json` | Add/merge `env.CLAUDE_CODE_FORK_SUBAGENT="1"` | +5 (if new) or +3 (if exists) |
| `you-are-continuing-a-drifting-planet.md` | Insert §2.5 + §6.12 + 1-paragraph §7.3 addendum | +110 |

Three files. ~125 lines total. Original Phase 1.8 plan structure preserved. All Wave 1 work + Wave 1 commits + Wave 1 commit history untouched.

**Patch 6 (Bypass-mode, separately applied):** see Patch 6's own "Files this patch creates/modifies" table. Adds `permissions.defaultMode: "bypassPermissions"` to `.claude/settings.local.json` (operator runs manually). Creates `memory/bypass-sessions.md` template + `logs/bypass-session-*.md` on stop conditions.

---

## Verification

After this plan exits + integration patches applied:
1. `/model` shows `claude-opus-4-7` (NOT [1m]). ✅ already done
2. `cat .claude/settings.local.json` shows `FORK_SUBAGENT: "1"`. **Operator may need to restart Claude Code** for env var to propagate to running session.
3. Re-read `you-are-continuing-a-drifting-planet.md` to confirm §2.5 + §6.12 + §7.3 patches integrated cleanly.
4. Run `/cost` to capture baseline before resuming PR-C.
5. Resume PR-C debug per §6.12 protocol (2 parallel forked Sonnet agents — omit subagent_type).
6. Apply gitleaks fix (operator confirms CI workflow edit).
7. Merge PR #9. Run `/cost`, log cumulative.
8. Wave 3 PR-B: follow §7.3 Mode B addendum (fresh Plan agent for ECE math validation, then write file).
9. End of Phase 1.8: `/cost` should show ~$4-7 cumulative for remainder.

If actual cost diverges sharply (>$15), log in `memory/medium-mode-execution-issues.md` and update Mode B math.

---

## Patch 6 — Bypass-mode execution protocol (added 2026-04-30)

### Purpose

Enable scoped `permissions.defaultMode: "bypassPermissions"` execution for THIS repo only, gated by a pre-approved plan. The plan IS the safety boundary. Bypass mode just removes per-action prompts so I can truck through pre-approved work without 50 confirmation prompts. Operator's choices for this design (this session):
- **Stop points:** only on errors / verification fails (no proactive pauses)
- **Hard guards:** scope violations only — operator wants intelligent judgment ("if you need genuine access into something to get something done during the bypass then it's OK")
- **Scope:** this repo only (project-scoped via `settings.local.json`)

### Why "plan as gate" (instead of per-action hooks)

Today's session hit 3 hook-induced blocks: PR #9 merge, `gh run list`, `bash scripts/check-ai-usage-smoke.sh`. Hooks have value (they caught the "skip PR #9" boundary correctly) but over-broaden after one denial → minutes of friction. A pre-approved plan moves the gate UP-STREAM: operator approves the plan once → bypass mode executes verbatim → only stops on real errors. Net: same safety floor, ~95% fewer prompts.

The trade-off operator accepted: destructive git ops (force push, reset --hard) and production boundaries (gh pr merge, BROKER=ibkr) are **NOT hard-prompted** in this design. They're authorized only when the plan section under execution explicitly calls for them. If I do them outside a plan-authorized step, that's a violation I'd flag against myself + stop.

### Activation method (operator runs manually — Self-Modification hook blocks me)

Operator runs the following to update `/Users/ianmcadam/Documents/Claude/trading-bot/.claude/settings.local.json`:

```bash
cat > /Users/ianmcadam/Documents/Claude/trading-bot/.claude/settings.local.json <<'EOF'
{
  "env": {
    "CLAUDE_CODE_FORK_SUBAGENT": "1"
  },
  "permissions": {
    "defaultMode": "bypassPermissions",
    "allow": [
      "Bash(mv \"/Users/ianmcadam/Documents/Claude/Trading bot\" /Users/ianmcadam/Documents/Claude/trading-bot)",
      "Read(//Users/ianmcadam/Documents/Claude/**)"
    ]
  }
}
EOF
```

Then restart Claude Code session (settings load at session start).

Verify: `cat .claude/settings.local.json | grep bypassPermissions` → should print the line.

This file is `settings.local.json` — git-ignored, project-scoped. Other Claude Code projects (anywhere outside this repo) are unaffected.

### Pre-flight checklist (every bypass session)

Before LAUNCHING a bypass-mode work session, operator confirms:

1. ☐ Approved plan exists at `~/.claude/plans/<plan-name>.md` (this file or a successor with explicit per-section pre-baked steps).
2. ☐ `git status` — clean working tree on a known branch (or branch the plan tells me to be on).
3. ☐ `bash scripts/health.sh` → `pass=12 fail=0` baseline.
4. ☐ `git log --oneline -5` → last commit is a known-good state.
5. ☐ Operator tells me explicitly which plan + which section to execute. Example: "Run §6.X of vast-humming-barto.md" or "Apply Patch 6 from this plan."

If any of 2-4 fails: do NOT enter bypass. Diagnose first.

### What I (the agent) do during bypass

**Operating principles (binding on me):**
1. The approved plan is the ONLY source of authorized actions. Anything not in the plan or not a direct dependency of an action in the plan = NOT authorized, and I pause.
2. Verbatim execution of pre-baked code blocks. No "improvements" or "let me clean this up while I'm here."
3. Run verification gates from the plan after every commit (typically `health.sh` + relevant smoke tests).
4. Read every file BEFORE editing it (still required by Edit tool).
5. Caveman style for commit messages (operator preference). Two-line bodies, not single-fragment.
6. Health.sh after every commit, not just per PR.
7. Never `--no-verify` on commit hooks.
8. Use parallel tool calls for independent file writes (efficiency, not bypass-specific).
9. If an Edit's OLD_TEXT doesn't match: STOP. Don't try to "guess and fix." File diverged from plan's expected state — operator decides.
10. If `health.sh` regresses: STOP. Don't try to fix unrelated breakage. Operator decides if it's wave-related.

**Scope intelligence (operator: "be intelligent about scope"):**

Allowed cross-boundary access during bypass even though "scope = this repo only":
- READ `/Users/ianmcadam/.claude/plans/*.md` — the plan file itself, since I need to follow it.
- READ `/Users/ianmcadam/.claude/projects/-Users-ianmcadam-Documents-Claude-Trading-bot/memory/*.md` — operator's user-level memory (feedback files, MEMORY.md, medium-mode-execution-issues.md).
- WRITE/APPEND `/Users/ianmcadam/.claude/projects/-Users-ianmcadam-Documents-Claude-Trading-bot/memory/medium-mode-execution-issues.md` and `bypass-sessions.md` — operator-readable logs.
- READ user MEMORY.md.
- READ/WRITE `/Users/ianmcadam/.claude/plans/<plan-name>.md` ONLY when in plan mode (not in bypass execution mode).

NOT allowed during bypass (pause + ask operator):
- Any write to `~/.claude/settings*.json` or `~/.claude/skills/*` (self-modification — operator runs these manually).
- Any edit to files under `/etc`, `/usr`, `/private/var`, `/Library/`, or other system paths.
- Any edit to other repos under `/Users/ianmcadam/Documents/Claude/` that aren't `trading-bot/`.
- Network calls (curl/wget/gh api) to URLs not in `{github.com/barsnbolts/*, anthropic.com, perplexity.ai, finance.yahoo.com, generativelanguage.googleapis.com}`.
- `gh api POST/PATCH/DELETE` to any repo other than `barsnbolts/trading-bot`.
- Anything that flips bot's broker mode (`BROKER=ibkr`, `IBKR_PAPER=no` env writes) outside an explicit plan step.
- Any `git push --force` or `git reset --hard origin/*` outside an explicit plan step.

**Self-check rule (run before any action):**

> "Is this directly authorized by a numbered step in the approved plan, OR is it a verification gate the plan tells me to run, OR is it a recovery action for a verification fail described in the plan?"

If NO to all three → pause + ask operator.

### Stop conditions during bypass

Hard stop + pause for operator if any of:

1. `bash scripts/health.sh` returns anything other than `pass=12 fail=0`.
2. Pre-commit hook (`check-secrets.sh`, doc-policy-drift, skill-drift) flags anything.
3. CI on a pushed branch goes red.
4. Any verification gate in the plan fails twice on the same fix attempt.
5. Edit tool reports `OLD text doesn't match` (file diverged from plan's expected state).
6. Trading wrapper breaks (`scripts/sim.sh`, `yfinance.sh`, `state.sh`, `clock.sh`) — these are NEVER in plan scope.
7. `state/state.yaml mode` flips unexpectedly during execution.
8. Any of the "NOT allowed" scope items above is needed to make progress.
9. I find a contradiction in the plan I can't resolve from context alone.
10. Subagent returns an error or contradicts the plan's spec.
11. `scripts/check-secrets.sh` flags anything in any commit.

When stopped, write `logs/bypass-session-$(date +%Y%m%d-%H%M).md`:
```
# Bypass session stopped: <timestamp>
**Plan:** <path + section>
**Trigger:** <which stop condition fired>
**Last successful commit:** <SHA + msg>
**Failing command output:**
<paste output>
**What I tried before stopping:**
- <action 1>
- <action 2>
**Operator decision needed:** <yes/no, what's the question>
```

Send `bash scripts/notify.sh "[BYPASS-STOP] <one-line>"` if `TG_TOKEN` set.

### Recovery from a bad bypass session

If operator inspects + finds bad commits:

```bash
# Local rollback (commits not yet pushed)
git reset --hard <last-known-good-SHA>

# Remote branch rollback (if pushed but not merged)
git push origin --delete <bad-branch>

# If a bad PR was merged to main (worst case)
git revert <merge-commit-SHA>
git push origin main
```

After ANY rollback: `bash scripts/check-secrets.sh history HEAD~20..HEAD` to confirm secrets didn't leak.

### Logging

Every bypass session appends one entry to `memory/bypass-sessions.md` (NEW file in `/Users/ianmcadam/Documents/Claude/trading-bot/memory/`, not user-level):

```
## YYYY-MM-DD HH:MM — <plan section executed>

**Plan ref:** <path + section ID>
**Started from SHA:** <git SHA>
**Ended at SHA:** <git SHA, or "rolled back to <SHA>">
**Commits added:** <count>
**Stops triggered:** <count> (reasons: <list>)
**Outcome:** clean | partial | rolled-back
**Notes:** <one-line summary>
```

Template gets created on first bypass session.

### Post-bypass review (operator)

After a bypass session ends:

1. Read `memory/bypass-sessions.md` last entry.
2. Read any `logs/bypass-session-*.md` files written during the session.
3. Run `git log <start-SHA>..HEAD --oneline` — verify commits match plan expectations.
4. Run `bash scripts/health.sh` → confirm 12/12.
5. If fully clean: continue. If anomalies: roll back per recovery section.

### Trade-offs operator accepted (transparency)

By choosing minimal hard guards + plan-as-gate model:

✅ ~95% fewer permission prompts during pre-approved work
✅ Faster execution (no hook denial → re-prompt cycles)
✅ Plan stays as the single source of truth for what's authorized
✅ Repo-scoped — other projects unaffected

⚠️ Destructive git ops (force push, reset --hard, branch delete) are NOT hard-prompted. Authorized only via plan steps. If I do them outside a plan step, that's my error and I'd self-flag — but the safety floor is "the plan is correct" not "the hook will catch me."
⚠️ `gh pr merge` to main is NOT hard-prompted. If a plan section says "merge", I merge once CI is green.
⚠️ Live-trade flips are still blocked by the bot's own logic (PROJECT-CONTEXT criteria: 6+ months paper data required) — this is a code-level guard, not a hook.

### Files this patch creates/modifies when applied

| Path | Change | Lines | Who applies |
|---|---|---|---|
| `.claude/settings.local.json` | Add `permissions.defaultMode: "bypassPermissions"` + retain Patch 2 fork env var | +6 | Operator (Self-Modification hook blocks me) |
| `memory/bypass-sessions.md` | NEW (template auto-created on first bypass session) | template only | Agent (first bypass session) |
| `logs/bypass-session-*.md` | NEW (created on stop conditions) | per-session | Agent |

### Cross-references

- Stop conditions overlap with original plan §4.5 (universal protocols) — bypass adds to that list, doesn't replace.
- Scope intelligence rule applies on TOP of original plan §10 (out-of-scope items). Plan §10 items still need explicit operator approval even in bypass.
- This patch does NOT change the model + reasoning protocol from §2.5. Bypass mode + Mode B (forked Sonnet subagents) are independent + can compose.
- Patch 6 is FORWARD-LOOKING — it does not retroactively apply to PR #9 / PR #10 (already shipped/awaiting merge under non-bypass rules).

### Verification (after operator applies Patch 6)

1. `cat .claude/settings.local.json | grep bypassPermissions` → prints the line.
2. Restart Claude Code session.
3. Operator launches a session, names a plan + section ("Run §X of plan-name.md").
4. Agent confirms: reads plan section, verifies pre-flight checklist passes, then proceeds without per-action prompts.
5. Agent runs to completion or stops on a stop-condition.
6. Operator reviews `memory/bypass-sessions.md` last entry.

### When to USE bypass mode (advisory)

- ✅ Executing a pre-baked plan section with mechanical work + clear verification gates.
- ✅ Long sequences of mechanical edits (file rewrites, doc updates, test additions).
- ✅ Wave-style work where the plan has explicit commit boundaries.

### When to NOT use bypass mode (advisory)

- ❌ Exploratory work / design / research where actions are not pre-determined.
- ❌ Touching trading wrappers (`sim.sh`, `yfinance.sh`, etc.) — high-blast-radius zone.
- ❌ First-time integration with a new external API.
- ❌ Strategy edits (those go via `strategy-proposals/v$N` PR per RISK-CONFIG.md regardless of bypass).
- ❌ Live-trade flip work (always operator-driven).

---

## Optional add-on (deferred, not blocking)

`barkain/claude-code-workflow-orchestration` plugin saves ~6.6K tokens at SessionStart via lazy-loaded orchestrator. Install via `claude plugin install workflow-orchestrator@barkain-plugins`. **Defer until after Phase 1.8 ships** — installing a plugin mid-execution adds risk we don't need.
