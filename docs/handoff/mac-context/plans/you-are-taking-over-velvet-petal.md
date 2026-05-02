# Trading-Bot Optimization Roadmap — LOCKED PLAN v4

> **v4 changes from v3**: Added meta-planning layer — reasoning-level auto-detection,
> per-wave model/agent matrix, fast-execution playbook, token-efficiency tactics.
> v3's wave content unchanged; v4 wraps it with execution intelligence.

## Context

v1.0-paper shipped. PRs #1+#2 merged. Holiday gates, versioned hooks, auto-merge disabled, skills wired, CI Gates 1-8, secret-scan + backup + uptime workflows, clock.sh exit-code distinction. 46 cloud connectors removed via Chrome MCP.

Operator request: "make this entire process / workload substantially more efficient and optimized" + "spend time now so it can be super fast later with the same level of accuracy." Translation: extra-high reasoning NOW to plan, then medium reasoning EXECUTES the plan fast.

---

# META: REASONING-LEVEL AUTO-DETECTION

## Signals from operator messages → which reasoning level to use

When the operator sends a message, classify it and pick the right reasoning level. Default to whatever the runtime gave you; switch only when signals are strong.

| Signal in operator message | Action | Reasoning |
|---|---|---|
| "go fast", "let's roll", "ship it", short imperatives, just a verb | medium | Mechanical execution; plan already exists |
| "review", "check", "audit", "what's wrong" | high | Diagnostic / analytical work |
| "design", "architect", "rethink", "what if we…", "redesign" | extra-high | Synthesis-heavy; needs full context |
| "plan the next steps", "deep preplanning", "optimize" | extra-high | Multi-axis optimization, needs full context |
| "use the headroom", "really think" | extra-high | Explicit signal |
| "tldr", "short", "one line" | medium | Brevity over depth |
| Operator pastes a stack trace / error | high | Debugging needs reasoning, not synthesis |
| Operator asks a factual question ("is X done?") | medium | Lookup, no synthesis |
| Operator describes ambiguous problem space | extra-high | Needs deep exploration |
| Operator says "do whatever you think" | high | Decisions matter, mechanical doesn't suffice |
| Operator says "automate everything" | medium for execution + extra-high for the up-front planning | Two-phase |

**Auto-detection caveat**: I cannot change my own reasoning level mid-session. The operator sets it via the runtime. But I CAN:
- Recognize a mismatch ("operator gave me medium reasoning but this needs extra-high to do well") and surface it: "This task is synthesis-heavy. Want to bump to extra-high before I dive in?"
- Pre-decide which TOOLS / AGENTS to use based on the inferred level (e.g., dispatch more subagents at medium because main thread is cheaper to defer)
- Adjust verbosity, depth of planning, and number of clarifying questions

## Reasoning-level execution profiles

### Medium (Opus 4.7 medium)
- Default for executing a pre-existing plan
- Use subagents AGGRESSIVELY: anything >2 tool calls of mechanical work goes to a Haiku/Sonnet subagent
- Prefer pre-drafted Edit operations from the plan; don't re-think the diff
- Skip verifier subagents on trivial changes; trust the plan
- Batch read+edit+commit per file in parallel where possible
- Lower TodoWrite granularity (skip updates for trivial state changes)
- Cap planning prose to 1-2 sentences before each tool call
- If a decision is ambiguous, default to the plan's recommendation. Surface only blockers.

### High (Opus 4.7 high — current default)
- Default for diagnostic / analytical work
- Use 1-2 subagents per phase, mostly Sonnet-tier for comprehension
- Verifier subagent after security-critical changes
- Re-read files when entering a new phase to refresh context
- Ask clarifying questions when 2+ valid interpretations exist
- Token budget: balanced. Spend on synthesis, save on busywork.

### Extra-high (Opus 4.7 with 1M context)
- Default for planning / architecture / multi-axis optimization
- Use 3-5 parallel subagents per phase (max useful parallelism)
- Multiple Plan agents to stress-test designs
- Adversarial verifier passes
- Read everything that might be relevant up-front
- Pre-draft exact diffs + commit messages + PR descriptions in the plan file
- Token budget: spend liberally — the goal is to set up cheap execution later

## Wave reasoning-level mapping

| Wave | Recommended reasoning | Subagent strategy | Why |
|---|---|---|---|
| 4 — CI hardening + script cleanup | medium | None — execute pre-drafted diffs | Plan has exact old_strings / new_strings; mechanical |
| 4b — Chrome MCP re-paste + model tuning | medium | None — run the playbook below | UI loop, no synthesis needed |
| 5 — Slash commands | medium | None — 3 small new files | Plan has full file contents |
| 7 — Memory rotation + Pages | high | 1 verifier (Sonnet) after rotate.yml runs | Rotation has data-loss risk; verify |
| 8 — Docs | medium | None | Templated edits |
| 9 — Operator handoff | medium | None | Surface state, no decisions |

If operator drops to medium reasoning, every wave becomes pure-mechanical execution. If they upgrade mid-flight ("go re-think the rotation policy"), I escalate the affected wave to high.

---

# META: TOKEN-EFFICIENCY PLAYBOOK

## Front-load reads

At session start (or wave start), batch-read everything I'll touch in one parallel block. Don't re-read files later unless they were modified.

**Wave 4 reads (single message, parallel)**:
- `.github/workflows/ci.yml`
- `scripts/health.sh`
- `scripts/capability.sh`
- `routines/{pre-market,market-open,midday,weekly-review}.md`
- `scripts/ibkr.sh` (lines 250-280 only)

7 reads in parallel. ~30s wall-clock vs sequential 7×30s = 3.5 minutes.

## Skip read+edit ping-pong with Write

For NEW files (workflows, slash commands, scripts/rotate-memory.py): use `Write` directly with full content from the plan. No Read needed. One round-trip vs. multi-round-trip.

For EXISTING files with multiple non-overlapping edits (routines/*.md STEP 0.5 dedup): batch all 4 Edit calls in one assistant turn since Edit is atomic per call and old_strings don't overlap.

## Avoid TodoWrite churn at medium reasoning

Update todos at wave boundaries only, not after every tool call. The system reminders are advisory — ignore for trivial tasks.

## Prefer Edit over re-Write

For a 5-line diff in a 200-line file: Edit (1 old_string + 1 new_string). For complete rewrites: Write. The plan-locked content makes this decision in advance.

## Cap subagent prompts at 700 words

Beyond 700, the agent's synthesis quality drops. If I need more context, summarize first.

## Cite-evidence requirement on every subagent

Every subagent prompt ends with "Cite file:line for every claim." Stops confident-wrong findings.

## Use ToolSearch in bulk

Lazy-loaded tools should be loaded once, in a single ToolSearch call, with multiple `select:` names. Don't make 5 separate ToolSearch calls for 5 tools.

Bulk-load command for trading-bot work:
```
ToolSearch query="select:AskUserQuestion,TodoWrite,WebSearch,ExitPlanMode" max_results=10
```
For Chrome MCP work:
```
ToolSearch query="claude-in-chrome" max_results=15  # bulk via keyword
```

## Use Monitor / `until` loops, not chained sleep

For waiting on CI: `until ! gh pr checks N | grep -q pending; do sleep 15; done` is one Bash call that gets a notification when done. Sleep+poll loops cost more.

## Don't repeat work across sessions

`mcp__ccd_session_mgmt__search_session_transcripts` (lazy-loaded) lets me grep prior sessions for context. Use BEFORE re-deriving past decisions. Especially relevant if operator brings up something we discussed previously.

## Pre-compute everything that's deterministic

The plan should contain:
- Exact commit messages (already does)
- Exact PR descriptions (already does)
- Exact verifier subagent prompts (add this)
- Exact bash command sequences for verification (add this)

When executing, copy-paste from the plan. No re-derivation.

---

# META: SPEED PLAYBOOK (wall-clock optimization)

## Parallel agent dispatch

3-5 parallel Explore agents in one message. Synthesize in main thread. Beats sequential 5x.

## Parallel Edit / Write ops on different files

Within one assistant turn, multiple Edit/Write calls on DIFFERENT files run concurrently. Group by file boundary; serialize only same-file edits.

## Background Bash for CI watching

`Bash run_in_background=true` for the `until` loop. Keep working in main thread; get notified.

## Skip verifier when low risk

Plan classifies each wave's risk. If LOW (Wave 5 slash commands) or MEDIUM-with-CI-coverage (Wave 4 hardening) — skip the human-time verifier subagent. Trust CI green. If HIGH (Wave 7 rotation), do the verifier.

## ScheduleWakeup for genuine delays

If waiting for an hour-long process, use ScheduleWakeup with delaySeconds=1800 (~30 min cache cycle). Don't poll every minute.

## Chrome MCP loop optimization

Cloud routines list page reuses refs across navigations. Extract the per-routine trigger IDs once:
- watchdog: trig_016vuj1HkdxybvJCe2kd9QX3
- weekly-review: trig_013Qap3JWKfEHUKVzFjsm2Pm
- midday: trig_01AzqVVqThZWhw9b4aH93MJN
- market-open: trig_01SpqcqmjNhfNHCVfT4NZKeP
- pre-market: trig_01BENs3ZQ5sLm6svWQn6LtXf
- daily-summary: trig_01WFqRVZyYA8xqAXRjcNPzbr

Direct-navigate to `claude.ai/code/routines/<trig_id>` skips the routines-list click step. Saves ~2s per routine = 12s × 6 routines.

## browser_batch every multi-step UI flow

ALWAYS prefer browser_batch over individual Chrome MCP tool calls. The system reminder confirms it's significantly faster.

---

# META: CONTEXT-COLLAPSE PLAYBOOK

Aggressive context management. The conversation context is the most expensive resource. Burn it on synthesis, save it everywhere else.

## Chapter marks at every phase boundary

Use `mcp__ccd_session__mark_chapter` at:
- Plan → Execute transition
- Each Wave start (4 → 4b → 5 → 7 → 8 → 9)
- Major sub-phase shifts (e.g., "Wave 4 commits" → "Wave 4 PR + CI watch")
- Verifier-pass complete

A typical session here = ~5-7 chapters. Each chapter visually separates context I can unload mentally. The TOC also lets the operator jump.

## Spawn-task for out-of-scope items

Anything I notice mid-execution that's worth doing but NOT in the current wave: `mcp__ccd_session__spawn_task`. Pre-condition the prompt to be self-contained (the spawned session has zero context).

Examples for this roadmap:
- If I notice a calendar.sh silent-fail during Wave 4 — spawn_task: "Audit calendar.sh + vix.sh + research.sh for silent-fail patterns; replace `2>/dev/null` with explicit error handling"
- If polygon.sh becomes urgent later — spawn_task: "Implement scripts/polygon.sh matching yfinance.sh JSON contract; wire $BARSNBOLTS_PRICE_PROVIDER switch in clock.sh"
- ibkr.sh remaining branches — spawn_task: "Implement ibkr.sh history (line 275 returns []), snapshot persistence (line 284), peak/opened_date tracking (lines 127-128)"

Each is a separate ~30-min session that doesn't bloat THIS session's context.

## Plan file IS the durable context

Don't hold the plan in scrollback. Re-read the plan file at any chapter boundary. The plan is canonical — if scrollback says X but plan says Y, plan wins.

Likewise: every operator decision goes into the plan's "Operator decisions (LOCKED)" section. If I forget mid-execution why I'm doing something, re-read the plan, not the chat history.

## Memory files survive auto-compaction

If a session auto-compacts (Anthropic runtime does this when context gets near limit), only "memorable" items survive:
- The plan file (filesystem persists)
- TodoWrite state (persists)
- memory/*.md files (persists)
- Anything in CLAUDE.md (loaded on every new session)

So critical context goes into one of those. Ephemeral context (subagent verbatim outputs, intermediate reasoning) is fine to lose.

## Subagent output norms

Every subagent prompt must end with a length cap (300-700 words). The agent's job is to **return the answer, not the work**. Verbose subagent outputs eat main-thread context.

Bad: "Read this file and tell me everything you find."
Good: "Read this file. Return only file:line citations for matches of pattern X. <300 words."

## Tool-output budget conventions

- `git log` → always `| head -N` or `--oneline -N` (default `-10`)
- `gh run list` → `--limit 5`
- `cat <large-file>` → never. Use `head` / `tail` / `Read offset/limit`
- `grep` → `-m 50` cap matches
- `ls -R` → use `find -maxdepth N` instead
- `gh api ... | jq` — narrow query at the API level, not after
- File reads via Read tool: use `offset/limit` if file is >300 lines and I only need a section

## TodoWrite for work-state, not narrative

Todos = imperatives in present-active form, single line. NOT a place to journal. Bad: "Discovered that the watchdog auto-merge logic has a subtle bug where..." (this is narrative; goes in scrollback or plan). Good: "Fix watchdog auto-merge bug (line 75)" (imperative; tracked).

Update todos at WAVE boundaries, not after every tool call. The system reminders nagging me to update are advisory.

## Auto-compaction safety

If I sense I'm close to context limit:
1. Mark a chapter
2. Update todos with current wave + what's next
3. Append a short "checkpoint" to plan file noting current state
4. Continue executing

After a compaction event:
1. Re-read plan file (always)
2. Re-read TodoWrite state (always)
3. Skim CLAUDE.md (loaded automatically)
4. memory/*.md if relevant to the wave

I can resume execution because the plan file has exact diffs, exact commit messages, exact verifier prompts. No re-derivation needed.

## Cross-session continuity

`mcp__ccd_session_mgmt__search_session_transcripts` (lazy-loaded) lets me grep PRIOR sessions for context. Use it BEFORE re-deriving. Especially:
- "What did the operator say about X last session?"
- "Where did we leave off?"
- "Did we already audit Y?"

But only when the question is narrow. For broad rediscovery, just re-read the plan + memory.

## What NOT to context-collapse

Never collapse:
- Locked operator decisions (plan file)
- Unfinished work that's not in todos (capture before collapsing)
- Verifier PASS/FAIL for current wave (commit to plan or todos)
- Anything operator explicitly said to remember

Risk: aggressive collapse = lost decisions. Plan file is the safety net.

---

# META: AUTOMATION RULES (when to ask vs decide)

## Always-ask (operator-only by safety)
- Modifying security permissions or access controls
- Permanent deletions
- Financial transactions
- Modifying system files
- Creating new accounts
- Sharing or forwarding sensitive content

## Always-decide (mechanical or pre-locked)
- File edits matching the plan exactly
- CI gate additions (LOW risk; CI catches errors)
- New file creation matching the plan
- Verifier subagent dispatch
- Reading files for context

## Decide-with-disclosure (default to plan, surface change)
- Workflow ordering tweaks
- Commit message style
- Branch naming
- Verifier subagent prompts (use plan template)

## Surface-and-pause (the 3-question rule)
If a wave hits >2 ambiguities or unexpected blockers, pause and use AskUserQuestion (max 3 questions). Don't keep guessing.

## Operator-style anti-patterns to NEVER do
- Don't ask "Should I proceed?" — just proceed if mechanical
- Don't ask "Is the plan good?" — that's what ExitPlanMode is for
- Don't ask 5 small questions in a row — bundle into 2-3 max via AskUserQuestion

---

# OPERATOR DECISIONS (LOCKED — no further questions)

- **Slash command name**: `/snapshot` (not `/status` — overlaps with `/health`)
- **Memory rotation threshold**: 90 days
- **Telegram digest mode**: out of scope
- **Polygon.sh**: out of scope (operator does later)
- **ibkr.sh full impl**: out of scope EXCEPT close-all `SCRIPT=$0` ordering bug
- **Rejection-log SHA fingerprint**: out of scope
- **Direct push to main**: forbidden by guard. Feature branches + PRs only.
- **Branch naming**: `audit/wave-N-<short-name>`
- **Commit style**: conventional prefix + descriptive (matches existing repo style)

---

# WAVE 4 — CI hardening + script cleanup (PR #3, MEDIUM reasoning)

**Pre-execution batch read** (single message, 7 parallel reads):
1. `.github/workflows/ci.yml`
2. `scripts/health.sh`
3. `scripts/capability.sh`
4. `routines/pre-market.md`
5. `routines/market-open.md`
6. `routines/midday.md`
7. `routines/weekly-review.md`
(scripts/ibkr.sh I'll read just the close-all section, lines 250-280)

## 4.1 CI Gate 9 — TRADING-STRATEGY direct-edit guard

File: `.github/workflows/ci.yml`. Insert as new step before `Summary` (currently at end of file).

**INSERTION POINT**: after Gate 8 path-write-guard, before `- name: Summary`.

```yaml
      # --- Gate 9: TRADING-STRATEGY.md direct-edit guard ---
      # Closes adversarial-finding (a) from v1.0-paper audit. The strategy-edit
      # policy in weekly-review.md says "If memory/TRADING-STRATEGY.md is modified
      # on main without a strategy v$N commit message: ABORT — INCIDENT". Now
      # CI-enforced, not prose-only.
      - name: TRADING-STRATEGY direct-edit guard
        if: github.ref == 'refs/heads/main' || github.base_ref == 'main'
        run: |
          DIFF_FILES=$(git diff-tree --no-commit-id --name-only -r HEAD)
          if echo "$DIFF_FILES" | grep -qx 'memory/TRADING-STRATEGY.md'; then
            MSG=$(git log -1 --pretty=%B | head -1)
            if ! echo "$MSG" | grep -qE '^strategy v[0-9]+ '; then
              echo "FAIL: memory/TRADING-STRATEGY.md modified outside a 'strategy v\$N' commit."
              echo "  Commit message: $MSG"
              echo "  Strategy edits must flow through strategy-proposals/v\$N branch + PR."
              echo "  See routines/weekly-review.md STEP 5b."
              exit 1
            fi
            echo "OK: TRADING-STRATEGY.md change matches expected 'strategy v\$N' commit pattern."
          else
            echo "SKIP: no TRADING-STRATEGY.md changes in this commit"
          fi
```

## 4.2 CI Gate 8 — anchored regex (avoid hotfix false-positives)

File: `.github/workflows/ci.yml`. EXACT EDIT:
- old_string: `if echo "$MSG" | grep -qE 'pre-market research|midday scan'; then`
- new_string: `if echo "$MSG" | grep -qE '^(pre-market research|midday scan|EOD snapshot|weekly review|watchdog incident|watchdog tg-state|market-open trades|strategy v[0-9])'; then`

Anchored at start `^`. Catches all routine-authored commit prefixes. Operator hotfix commits like `"fix: pre-market clock bug"` don't match.

## 4.3 CI Gate 10 — state.sh smoke-test

File: `.github/workflows/ci.yml`. Insert AFTER Gate 9, BEFORE `Summary`.

```yaml
      # --- Gate 10: state.sh smoke-test (integrity) ---
      # Closes adversarial-finding (b). Catches no-op state.sh replacement that would
      # otherwise pass all CI gates.
      - name: state.sh smoke-test
        run: |
          MODE=$(bash scripts/state.sh mode 2>/dev/null || echo "")
          if [[ -z "$MODE" ]]; then
            echo "FAIL: scripts/state.sh mode returned empty (corrupted or replaced?)"
            exit 1
          fi
          case "$MODE" in
            active|paused|exits_only|reduced|emergency_flatten)
              echo "OK: state.sh mode=$MODE"
              ;;
            *)
              echo "FAIL: scripts/state.sh mode returned unexpected value: $MODE"
              exit 1
              ;;
          esac
```

## 4.4 health.sh `eval` → `bash -c`

File: `scripts/health.sh:16`. EXACT EDIT:
- old_string: `  if eval "$cond" >/dev/null 2>&1; then`
- new_string: `  if bash -c "$cond" >/dev/null 2>&1; then`

## 4.5 capability.sh `prose` subcommand + dedupe STEP 0.5

File: `scripts/capability.sh`. Insert new case branch before line 91 `*)`.

EXACT EDIT in `scripts/capability.sh`:
- old_string:
```
    [[ $(rank "$TIER") -ge $(rank "$required") ]] && exit 0 || exit 1
    ;;
  *)
```
- new_string:
```
    [[ $(rank "$TIER") -ge $(rank "$required") ]] && exit 0 || exit 1
    ;;
  prose)
    # Print the tier-aware prose block routines paste in STEP 0.5.
    # Dedup: routines call `bash scripts/capability.sh prose` instead of duplicating.
    cat <<EOF
TIER=$TIER
Branch behavior per tier:
- premium: deep research, all optional steps
- standard: focused, required + most optional
- light: mechanical only, skip research-heavy steps
EOF
    ;;
  *)
```

In 4 routines (pre-market.md, market-open.md, midday.md, weekly-review.md), replace STEP 0.5:

EXACT EDIT (per routine — same old_string in all 4):
- old_string:
```
STEP 0.5 — CAPABILITY TIER:
  TIER=$(bash scripts/capability.sh)
  Branch behavior per tier:
  - premium: deep research, all optional steps
  - standard: focused, required + most optional
  - light: mechanical only, skip research-heavy steps
```
- new_string:
```
STEP 0.5 — CAPABILITY TIER:
  bash scripts/capability.sh prose
```

Saves ~18 duplicated lines.

## 4.6 ibkr.sh close-all SCRIPT-ordering bug

File: `scripts/ibkr.sh:260-272`. EXACT EDIT:
- old_string:
```
  close-all)
    bash "$0" positions | python3 -c '
import sys, json, subprocess, os
p = json.load(sys.stdin)
closed = []
for sym in list(p.keys()):
    r = subprocess.run(["bash", os.environ["SCRIPT"], "close", sym], capture_output=True)
    if r.returncode == 0:
        closed.append(sym)
print(json.dumps({"closed": closed}, indent=2))
' 2>&1
    SCRIPT="$0"
    ;;
```
- new_string:
```
  close-all)
    SCRIPT="$0"
    bash "$0" positions | SCRIPT="$SCRIPT" python3 -c '
import sys, json, subprocess, os
p = json.load(sys.stdin)
closed = []
for sym in list(p.keys()):
    r = subprocess.run(["bash", os.environ["SCRIPT"], "close", sym], capture_output=True)
    if r.returncode == 0:
        closed.append(sym)
print(json.dumps({"closed": closed}, indent=2))
' 2>&1
    ;;
```

## Wave 4 commit + PR

Branch: `audit/wave-4-hardening`. Two semantic commits:

**Commit A** (CI gates + health.sh):
```
feat: CI Gates 9+10 + Gate 8 anchor + health.sh eval→bash -c

Wave 4 hardening pass closing adversarial findings (a), (b), (c), (e):
- Gate 9: TRADING-STRATEGY direct-edit guard (was prose-only in weekly-review.md)
- Gate 10: state.sh smoke-test (catches no-op replacement)
- Gate 8: anchored regex prevents operator-hotfix false-positives
- health.sh: eval → bash -c (closes wrapper-audit deferred WARN)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

**Commit B** (capability.sh prose + 4 routines + ibkr.sh):
```
feat: capability.sh prose subcommand + dedupe STEP 0.5 + fix ibkr.sh close-all

Routine prompt dedup: 4 routines (pre-market, market-open, midday, weekly-review)
now call `bash scripts/capability.sh prose` instead of duplicating the STEP 0.5
prose block. Saves ~18 lines × no functional change.

ibkr.sh close-all: SCRIPT="$0" was set AFTER the python3 block read it from
os.environ. Fixed by setting before + passing explicitly via env. Latent bug
that would surface only when BROKER=ibkr is enabled.

NOTE: this changes the routine .md files. Cloud routines are full-text
snapshots, NOT transclusions. Wave 4b (Chrome MCP) re-pastes the 4 affected
routines into claude.ai/code/routines so their live instructions match.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

PR title: `audit: wave 4 — CI hardening + dedup + ibkr.sh close-all bug`

## Wave 4 verification (auto)

After PR merges:
```bash
# Local verify capability.sh prose works
bash scripts/capability.sh prose
# Local verify state.sh mode still works
bash scripts/state.sh mode
# Local verify health.sh runs without eval warning
bash scripts/health.sh | head -10
```

CI verifies Gates 9 + 10 are present (they're present-or-fail).

---

# WAVE 4b — Chrome MCP re-paste + model tuning (MEDIUM reasoning, 1 session)

**Critical timing**: ASAP after Wave 4 merges, BEFORE Monday's first scheduled cron.

## 4b.1 Re-paste 4 dedup'd routines

For pre-market, market-open, midday, weekly-review:
1. `mcp__Claude_in_Chrome__navigate` to `https://claude.ai/code/routines/<trig_id>` (use the ID list above)
2. browser_batch: read_page, click pencil edit (coord [1336, 21]), wait 2s, find "Instructions textarea"
3. browser_batch: clear textarea (triple_click + delete), paste full content of `routines/<slug>.md`, click Save

## 4b.2 Tune models on 6 routines

In the same edit modal (after re-paste for the 4, separately for daily-summary + watchdog):

| Routine | New model |
|---|---|
| daily-summary | Claude Haiku 4.5 |
| watchdog | Claude Haiku 4.5 |
| market-open | Claude Sonnet 4.6 |
| midday | Claude Sonnet 4.6 |
| pre-market | (stays Opus 4.7 1M) |
| weekly-review | (stays Opus 4.7 1M) |

For each routine: open edit modal → click Model dropdown (find via `mcp__Claude_in_Chrome__find` with query "Model dropdown") → click target option → Save.

## 4b.3 Smoke-test

After all 6 saved: trigger watchdog Run Now (lowest-risk: read-only, Haiku-tier). Wait 60-90s for heartbeat commit on main + Telegram message.

If Haiku errors: fall back to Sonnet 4.6 for watchdog. Same edit flow, repeat for daily-summary if needed.

**Estimated cost reduction**: 60-70% on weekly bot operating cost.

---

# WAVE 5 — Slash commands (PR #4, MEDIUM reasoning)

3 new files. `Write` tool, full content from below.

## 5.1 `.claude/commands/backtest.md`
```markdown
---
description: Run a backtest. Usage: /backtest [days=90] [--proposal "<one-line change>"]
---

Argument hint: $ARGUMENTS

Run `bash backtest/run-backtest.sh ${ARGUMENTS:-90}`.

Read the output and summarize in caveman-mode (3 lines max):
- Total return % vs SPY benchmark
- Sharpe ratio + max drawdown
- vs latest baseline (if --proposal was passed: show before/after Sharpe delta)

Read-only diagnostic. Do NOT commit.
```

## 5.2 `.claude/commands/snapshot.md`
```markdown
---
description: One-shot point-in-time view. Health + portfolio + state + recent commits.
---

Read-only snapshot. Output sections in order:

## Health
bash scripts/health.sh

## Portfolio
bash scripts/sim.sh account
bash scripts/sim.sh positions

## State
cat state/state.yaml

## Recent activity
git log --oneline -5

At the top of output, add a 3-line caveman summary:
- Equity: $X (Δday%)
- Mode: <state.yaml mode>
- Last commit: <timestamp + message>

Do NOT commit.
```

## 5.3 `.claude/commands/strategy.md`
```markdown
---
description: Print current trading strategy. Read-only.
---

cat memory/TRADING-STRATEGY.md

Display only. Do NOT commit. Do NOT propose changes.
```

Branch: `audit/wave-5-slash-commands`. Single commit:
```
feat: add /backtest /snapshot /strategy slash commands

Operator QoL — three read-only commands closing the slash-command coverage gap.
- /backtest wraps backtest/run-backtest.sh with optional --proposal arg
- /snapshot aggregates /health + /portfolio + state.yaml + recent commits
- /strategy displays memory/TRADING-STRATEGY.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

## Wave 5 verification

In a local Claude Code session: `/backtest 30`, `/snapshot`, `/strategy`. Expect all complete clean.

---

# WAVE 7 — Memory rotation + dashboard URL (PR #5, HIGH reasoning)

**HIGH reasoning** because data-loss potential in rotate-memory.py — verifier required.

## 7.1 New `.github/workflows/rotate.yml` + `scripts/rotate-memory.py`

`scripts/rotate-memory.py` (new file, ~80 lines):
```python
#!/usr/bin/env python3
"""Rotate memory files. Move entries older than --threshold-days to memory/archive/."""
import argparse, datetime, os, pathlib, re, sys

# Files we rotate. Each tuple: (file path, entry-header regex, date-extractor lambda)
TARGETS = [
    ("memory/TRADE-LOG.md",
     re.compile(r"^## (Day \d+ — )?(\d{4}-\d{2}-\d{2})", re.M),
     lambda m: datetime.date.fromisoformat(m.group(2))),
    ("memory/RESEARCH-LOG.md",
     re.compile(r"^## (\d{4}-\d{2}-\d{2})", re.M),
     lambda m: datetime.date.fromisoformat(m.group(1))),
    ("DAILY-SUMMARY.md",
     re.compile(r"^## (\d{4}-\d{2}-\d{2}) ", re.M),
     lambda m: datetime.date.fromisoformat(m.group(1))),
]

def rotate(path, header_re, date_fn, cutoff):
    p = pathlib.Path(path)
    if not p.exists():
        print(f"[skip] {path} not present")
        return
    text = p.read_text()
    matches = list(header_re.finditer(text))
    if not matches:
        print(f"[skip] {path} no entry headers found")
        return

    # Find first entry NEWER than cutoff. Everything before it is archived.
    keep_start = None
    for m in matches:
        if date_fn(m) >= cutoff:
            keep_start = m.start()
            break
    if keep_start == 0:
        print(f"[noop] {path} all entries fresh")
        return
    if keep_start is None:
        # All entries are old. Don't rotate everything — keep the last 1 for context.
        keep_start = matches[-1].start()

    archive_block = text[:keep_start].rstrip() + "\n"
    keep_block = text[keep_start:]

    # Find header (everything before first entry) — keep in live file
    header = text[:matches[0].start()]
    # Live file: header + recent entries
    p.write_text(header + keep_block.lstrip())

    # Archive: by month of oldest entry being archived
    first_archived_date = date_fn(matches[0])
    archive_filename = f"{p.stem}-{first_archived_date.strftime('%Y-%m')}.md"
    archive_path = pathlib.Path("memory/archive") / archive_filename
    archive_path.parent.mkdir(parents=True, exist_ok=True)

    if archive_path.exists():
        archive_path.write_text(archive_path.read_text() + "\n" + archive_block)
    else:
        archive_path.write_text(f"# {p.name} archive — entries before {first_archived_date}\n\n{archive_block}")

    print(f"[rotated] {path}: archived {len([m for m in matches if date_fn(m) < cutoff])} entries → {archive_path}")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--threshold-days", type=int, default=90)
    args = ap.parse_args()
    cutoff = datetime.date.today() - datetime.timedelta(days=args.threshold_days)
    print(f"Rotation cutoff: {cutoff} (entries older are archived)")
    for path, header_re, date_fn in TARGETS:
        rotate(path, header_re, date_fn, cutoff)

if __name__ == "__main__":
    main()
```

`.github/workflows/rotate.yml` (new file):
```yaml
name: Memory Rotation

# Archives entries older than 90 days from grow-only memory files into
# memory/archive/{file}-YYYY-MM.md so live files stay scan-fast.
# Sunday 06:00 UTC, before backup.yml at 08:00 UTC, so the weekly backup
# release artifact captures the rotation.

on:
  schedule:
    - cron: '0 6 * * 0'
  workflow_dispatch:

permissions:
  contents: write

jobs:
  rotate:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Rotate
        run: |
          mkdir -p memory/archive
          python3 scripts/rotate-memory.py --threshold-days 90

      - name: Commit if changed
        run: |
          if [[ -n "$(git status --porcelain memory/ DAILY-SUMMARY.md)" ]]; then
            git config user.name "trading-bot[rotate]"
            git config user.email "noreply@anthropic.com"
            git add memory/ DAILY-SUMMARY.md
            git commit -m "rotate memory $(date +%Y-%m-%d): archive entries >90d"
            git push origin HEAD:main
          else
            echo "Nothing to rotate."
          fi
```

## 7.2 New `.github/workflows/pages.yml` + `scripts/dashboard.sh` fix

`scripts/dashboard.sh:13` EXACT EDIT:
- old_string: `ROOT="$(cd "$(dirname "$0")/.." && pwd)"`
- new_string: `export ROOT="$(cd "$(dirname "$0")/.." && pwd)"`

`scripts/dashboard.sh:23` EXACT EDIT:
- old_string: `ROOT = os.environ.get("ROOT", "/Users/ianmcadam/Documents/Claude/trading-bot")`
- new_string: `ROOT = os.environ["ROOT"]  # required; bash side exports this. Fail loudly if missing.`

`.github/workflows/pages.yml` (new file):
```yaml
name: Deploy Dashboard

on:
  push:
    branches: [main]
    paths:
      - 'state/**'
      - 'memory/TRADE-LOG.md'
      - 'scripts/dashboard.sh'
      - '.github/workflows/pages.yml'
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Build dashboard.html
        env:
          ROOT: ${{ github.workspace }}
          BROKER: sim
        run: |
          bash scripts/dashboard.sh
          ls -la dashboard.html
          mkdir -p _site
          cp dashboard.html _site/index.html

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: _site

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

## 7.3 GitHub Pages activation (operator-side or Chrome MCP)

`github.com/barsnbolts/trading-bot/settings/pages` → Source: "GitHub Actions". One-time. URL becomes `https://barsnbolts.github.io/trading-bot/`.

## Wave 7 commit + PR

Branch: `audit/wave-7-rotation-pages`. Two commits:

**Commit A**: `feat: memory rotation workflow + scripts/rotate-memory.py`
**Commit B**: `feat: GitHub Pages dashboard deploy + dashboard.sh ROOT export`

PR title: `audit: wave 7 — memory rotation + Pages dashboard`

## Wave 7 verification (HIGH reasoning, includes verifier)

Verifier subagent prompt (pre-drafted):
```
Repo: /Users/ianmcadam/Documents/Claude/trading-bot
Branch: audit/wave-7-rotation-pages

Verify:
1. scripts/rotate-memory.py with --threshold-days 90 against current memory/* — would it move ANY entries today? (current TRADE-LOG.md has 1 entry from a few days ago; should NOT rotate)
2. Test with --threshold-days 1: would it rotate yesterday's entries? Confirm the archive filename + content structure are correct.
3. Read scripts/dashboard.sh post-edit — confirm `export ROOT=` is on line 13 and python heredoc reads `os.environ["ROOT"]` without fallback.
4. Read .github/workflows/pages.yml — confirm `ROOT: ${{ github.workspace }}` is in the env block.
5. Read .github/workflows/rotate.yml — confirm cron is `0 6 * * 0` (before backup.yml's `0 8 * * 0`).

Output: 5 PASS/FAIL with file:line citations. Hard cap 300 words.
```

After PR merges + GH Pages activated:
```bash
gh workflow run pages.yml --repo barsnbolts/trading-bot
gh workflow run rotate.yml --repo barsnbolts/trading-bot
```
Both should complete green. After ~60s, fetch the dashboard URL and confirm content.

---

# WAVE 8 — Documentation (PR #6 same commit-batch as Wave 9 setup, MEDIUM)

## 8.1 SECURITY.md updates

EXACT EDITS to close findings.

Append to "Operator Security Recommendations" (after item 8 from PR #1):
```
9. **CI hardening (April 2026 audit)**:
   - Gate 9 enforces TRADING-STRATEGY.md direct-edit policy (closes adversarial-finding (a))
   - Gate 10 smoke-tests scripts/state.sh integrity (closes adversarial-finding (b))
   - Gate 8 anchored regex prevents operator-hotfix false-positives (closes adversarial-finding (c))
   - health.sh `eval` replaced with `bash -c` (closes wrapper-audit deferred WARN, finding (e))
   - Secret-scan workflow on every branch + daily cron is the structural backstop for any --no-verify bypass (finding (f), accepted)
   - Rejection-log semantic-equivalence remains LLM-judged (finding (d), accepted)
```

Update Wrapper Audit Results table: change health.sh row `WARN (deferred)` → `PASS` with note `eval $cond → bash -c $cond, no functional change to hardcoded callsites`.

## 8.2 CLAUDE.md updates

EXACT EDITS:
- Update slash-commands list to include /backtest, /snapshot, /strategy (placement: same section that lists /portfolio, /trade, etc.)
- Add new section `## Memory Rotation` after the `## Capability Tier System` section:
```
## Memory Rotation

`memory/TRADE-LOG.md`, `memory/RESEARCH-LOG.md`, and `DAILY-SUMMARY.md` grow-only.
Sunday 06:00 UTC `.github/workflows/rotate.yml` archives entries >90 days to
`memory/archive/{file}-YYYY-MM.md`. Live files stay scan-fast for routines.
Operator: nothing to do. Archive files searchable via git grep across history.
```

## 8.3 New `memory/HANDOFF-v1.0-final.md`

Documents:
- All 6 PRs merged (#1-#6)
- Cost reduction landed
- Hardening status
- Operator-only items remaining (TG token rotate)
- Next milestones (BROKER=ibkr migration; pre-impl checklist references in this file)

## Wave 8 commit + PR

Branch: `audit/wave-8-docs`. Single commit. PR title: `docs: wave 8 — SECURITY + CLAUDE + handoff doc`.

---

# WAVE 9 — Final operator handoff

## 9.1 Me-side via Chrome MCP (BEFORE operator handoff)

After all PRs merged + Pages activated:
1. `gh release list --repo barsnbolts/trading-bot --limit 3` — confirm backup-2026-04-28+ exists
2. `gh workflow run pages.yml --repo barsnbolts/trading-bot` then wait, then curl Pages URL — confirm dashboard live
3. `gh workflow run rotate.yml --repo barsnbolts/trading-bot` — confirm dry-run reports nothing to rotate
4. `gh issue list --label uptime --state open` — confirm no false-positives

## 9.2 Operator-only

1. **Revoke + replace TG_TOKEN** via @BotFather → `/revoke` @barsnbolts_trading_bot → save → claude.ai/code BARSNBOLTS env → replace
2. **Activate GitHub Pages**: github.com/barsnbolts/trading-bot/settings/pages → Source: GitHub Actions
3. **Delete leaked-token chat session**

## 9.3 Me-side AFTER operator rotates token

1. Trigger watchdog Run Now via Chrome MCP
2. Wait 60-90s
3. Confirm fresh heartbeat commit + Telegram message + dashboard URL still serves correctly

## 9.4 Final summary message

Single message to operator with:
- All PRs merged with links
- Cost reduction quantified
- Findings closed/accepted summary
- Operator action items (#9.2)
- Next steps (BROKER=ibkr prep doc location)

---

# OUT OF SCOPE (P3, document only)

| Item | Why deferred |
|---|---|
| ibkr.sh full implementation | Only when flipping BROKER. HANDOFF-v1.0-final.md has the prep checklist. |
| polygon.sh stub | Only on observed YF outages. Migration steps in CLOUD-DEPLOY.md. |
| Rejection-log SHA fingerprint | Operator decision deferred. SECURITY.md documents acceptance. |
| Telegram digest mode | Operator hasn't expressed pain. ~6-12 messages/day acceptable. |
| --no-verify post-fact detection | No clean CI solution. secret-scan.yml is structural backstop. |
| iOS native dashboard | GH Pages serves on mobile. Native overkill. |

---

# CRITICAL FILES

- `.github/workflows/ci.yml` — Wave 4 (Gates 8-anchor, 9, 10)
- `scripts/health.sh` — Wave 4.4
- `scripts/capability.sh` — Wave 4.5 (prose subcommand)
- `routines/{pre-market,market-open,midday,weekly-review}.md` — Wave 4.5 (STEP 0.5 dedup)
- `scripts/ibkr.sh` — Wave 4.6
- `.claude/commands/{backtest,snapshot,strategy}.md` — Wave 5
- New `.github/workflows/rotate.yml` — Wave 7.1
- New `scripts/rotate-memory.py` — Wave 7.1
- New `.github/workflows/pages.yml` — Wave 7.2
- `scripts/dashboard.sh` — Wave 7.2 (export ROOT, remove fallback)
- `SECURITY.md`, `CLAUDE.md` — Wave 8
- New `memory/HANDOFF-v1.0-final.md` — Wave 8.3

---

# RISK REGISTER

| Risk | Wave | Severity | Mitigation |
|---|---|---|---|
| Wave 4.5 dedup orphans cloud routines | 4 → 4b | HIGH | Run 4b same session as 4 merges. Window <30 min. |
| Haiku model can't handle daily-summary prompt | 4b | LOW | Watchdog canary first; rollback to Sonnet 4.6 if errors |
| pages.yml fails on dashboard.sh ROOT fallback | 7 | MEDIUM | Pre-fix dashboard.sh export + remove fallback (in plan) |
| rotate-memory.py mistakenly archives recent entries | 7 | MEDIUM | Verifier subagent + 90-day threshold + dry-run on workflow_dispatch first |
| Gate 9 false-positives on hotfix commits | 4 | LOW | Anchored `^strategy v[0-9]+` regex. Tested in plan. |
| TRADING-STRATEGY.md merge commit edge case | 4 | LOW | PR squash inherits "strategy v$N" title — passes Gate 9 |
| Polygon migration becomes urgent | post-9 | LOW | YF stable. CLOUD-DEPLOY.md has migration steps. |

---

# EXECUTION ORDER (single sitting)

```
1. Wave 4 → branch audit/wave-4-hardening → 2 commits → PR #3 → CI green → merge
2. Wave 4b → Chrome MCP (re-paste 4 routines + tune all 6 models + watchdog Run Now smoke)
3. Wave 5 → branch audit/wave-5-slash-commands → 1 commit → PR #4 → CI green → merge
4. Wave 7 → branch audit/wave-7-rotation-pages → 2 commits → PR #5 → CI green → verifier subagent → merge
5. Wave 7 ops → activate GH Pages (operator UI or Chrome MCP) + workflow_dispatch tests
6. Wave 8 → branch audit/wave-8-docs → 1 commit → PR #6 → CI green → merge
7. Wave 9.1 → me-side verifications (Pages live, rotation dry-run, etc.)
8. Wave 9.2 → operator-only items surfaced (TG rotate + Pages activate + delete session)
9. Wave 9.3 → after operator rotates: final smoke-test via Chrome MCP
10. Wave 9.4 → final summary message
```

Estimated: 4 PRs (#3-#6), ~2 hours wall-clock execution at MEDIUM reasoning. Faster if reasoning bumps to HIGH for Wave 7's verifier.

After Wave 9, repository in steady state. Operator only revisits for: strategy decisions, IBKR flip, capacity changes.
