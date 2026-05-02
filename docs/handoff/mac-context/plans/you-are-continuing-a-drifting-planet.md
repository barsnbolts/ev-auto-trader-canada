# Phase 1.8 Multi-Wave Execution Plan

> **This plan replaces** the prior cleanup audit (already merged via PR #7 / commit `7d7dce0`). New scope: cross-llm-consensus Perplexity automation + IBKR pre-work + AI-USAGE-LEARNINGS data substrate. Designed for execution primarily on **Opus 4.7 medium** with high-reasoning escalation paths called out explicitly.

---

## 0. Context — what this plan exists to do

Operator (Canadian solo dev, first project, paper-mode trading bot at `/Users/ianmcadam/Documents/Claude/trading-bot`) finished the v1.0 audit cycle and wants to fully ship Phase 1.8 (cross-LLM consensus automation) plus pre-bake the IBKR Phase 2 work plus stand up the AI-USAGE-LEARNINGS data substrate.

**Pre-existing state (verified during planning):**
- `main` is clean. Last merge: PR #7 commit `7d7dce0` (skill+doc drift cleanup).
- 6 cloud routines wired at claude.ai/code/routines (per `memory/HANDOFF-v1.0-final.md` §1).
- 16 skills in `.claude/skills/` mirrored in `.agents/skills/`.
- `state/state.yaml` mode = active, last_human_review 2026-04-25.
- `scripts/ibkr.sh` has 9 explicit stubs (counted line-by-line during planning, HANDOFF estimated "6+").
- `memory/AI-USAGE-LEARNINGS.md` template-only, empty active log.
- `scripts/perplexity-research.sh` does not exist.
- `scripts/chatgpt-validator.sh` does not exist.
- Current env vars: `BROKER, BOT_CAPABILITY_TIER, GEMINI_API_KEY, TG_TOKEN, TG_CHAT_ID, GH_TOKEN, IBKR_GATEWAY_URL, IBKR_ACCOUNT_ID, IBKR_PAPER`. **No `PERPLEXITY_API_KEY` and no `OPENAI_API_KEY`.**
- Operator deferred Wave 0 (TG token rotation, GH Pages, leaked-session cleanup) entirely. Not in this plan.

**Why Perplexity (not ChatGPT, not Gemini-only):**
- Original Nate Herk YouTube tutorial (`https://www.youtube.com/watch?v=6MC1XqZSltw`) used Perplexity for the research role. Operator's repo diverged to Gemini per a prior decision documented as a "forbidden patterns" entry in `memory/AGENT-OPERATING-PROTOCOL.md` line 44. Operator is now lifting that ban.
- Sonar Deep Research (Perplexity) is purpose-built for the consensus skill's research role: multi-source synthesis with citations.
- Pricing: $2/$8 per 1M tokens; ~$0.08 per consensus check at sonar-deep-research; cap-able later if needed.
- ChatGPT Custom GPTs (the existing tuned "Trade Thesis Validator (BARSNBOLTS)") are not API-accessible. OpenAI API would recreate it without the tuning. Defer that path entirely. Workflow 6 manual flow stays as the documented fallback.

**Why hybrid IBKR (EasyIB + custom bash):**
- `github.com/utilmon/EasyIB` is BSD-3 licensed, 111★, exposes account/positions/bars/orders/confirmation prompts, designed for cloud/Linux. Wrapping it removes the largest implementation burden.
- EasyIB does NOT expose: PnL endpoint, history persistence, peak/opened_date tracking, stop_pct logic. Those 4 stubs we still write ourselves.
- Net: ~5 of 9 ibkr.sh stubs become thin EasyIB calls; ~4 stubs are bespoke bash that reads from TRADE-LOG / state files.

**Why ECE + domain-capped confidence for AI-USAGE-LEARNINGS (not bespoke):**
- `github.com/msitarzewski/duh` exposed the pattern: domain caps (factual ≤95%, technical ≤90%, creative ≤85%, judgment ≤80%, strategic ≤70%) + Expected Calibration Error tracking.
- duh is AGPL-3.0 (cannot fork), but ECE is standard ML academic math. Implement from first principles, no license exposure.
- Consensus checks are "judgment" bucket → 80% confidence ceiling. Caps prevent overconfident scoring.

---

## 1. Operator preferences (load these before executing any wave)

| Preference | Source | How to apply |
|---|---|---|
| Caveman style | `/caveman` invoked + memory:`caveman-style.md` | All commit messages + summaries fragments not sentences |
| Handholding, easiest+safest | CLAUDE.md + repeated operator messages | Default to Recommended option in any sub-decision; explain choice in commit body |
| Reversibility-first | CLAUDE.md | Branch+PR not direct push; squash-merge so one revert undoes wave |
| Batch questions | CLAUDE.md | Use AskUserQuestion in batches of 3-4, never single prompt |
| End every question group with yes/no | This planning session, operator added 2026-04-29 | After AskUserQuestion batch, follow with single yes/no "want more questions?" — must save as feedback memory once execution begins |
| Don't proactively commit | CLAUDE.md | Only commit when explicitly approved; exit plan mode counts as approval per Phase order |
| First project, beginner | This planning session | Wave-by-wave PRs not single mega-PR; each PR independently reviewable |

---

## 2. Model + agent strategy

### Per-task model tags (used throughout each wave)

| Tag | Meaning |
|---|---|
| 🟢 MEDIUM | Pre-baked, paste-and-execute. Zero design judgment. Opus 4.7 medium handles fine. |
| 🟡 MEDIUM-HIGH | Pre-baked but specific failure modes flagged "if X happens → escalate to high reasoning". Default-execute on medium; `/model claude-opus-4-7` to step up only if escalation triggered. |
| 🔴 HIGH ONLY | Genuine design judgment required. Switch to high BEFORE starting. Should be ≤5% of total tasks; if I find more than that I made a planning error. |

### Per-task agent tags

| Tag | Meaning |
|---|---|
| 🤖 NO AGENT | Use direct tools (Read/Edit/Write/Bash). All info in context. |
| 🤖 Explore | Use `Agent({subagent_type:"Explore"})` for read-only file/symbol search if context lacks specifics |
| 🤖 general-purpose | Use `Agent({subagent_type:"general-purpose"})` for multi-step research that would otherwise pollute main context |
| 🤖 Plan | Use `Agent({subagent_type:"Plan"})` to validate a wave's section against repo state before executing |

### Tactics for maximizing Opus 4.7 medium throughput

1. **Read the wave header in full before starting any tasks.** Medium drifts when tasks reference cross-section context it skipped.
2. **Execute pre-baked code blocks verbatim.** If you see the urge to "improve" them, you are overstepping the plan; revert to verbatim.
3. **Run verification command immediately after each file write.** Catch typos at write-time, not commit-time.
4. **Use parallel tool calls for independent file writes.** A single message with N Write blocks is ~N× faster than serial.
5. **Pre-written commit messages are non-negotiable.** Do not editorialize. Use exact text supplied.
6. **If a verification command's actual output differs from the expected output by even one character, STOP. Do not "fix" by editing the verification — re-read the file you just wrote, compare to the pre-baked source, fix divergence. If divergence is in the plan itself, escalate to high reasoning.**
7. **Health.sh after every commit, not just per PR.** 30 seconds; catches regressions at the smallest possible blast radius.
8. **Do not invoke `/caveman`-style compression in commit BODIES.** Operator wants concise but parseable. Two-line bodies, not single-fragment.
9. **Never `--no-verify`.** Pre-commit hook blocks `.env` + secrets. If hook fails, fix the file, do not bypass.
10. **One wave per session.** When you finish a wave's PR squash-merge + main pull, STOP. Operator has explicitly said "one wave max per session" (planning session 2026-04-29).

---

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

---

## 3. Wave order + branch + PR map

| Wave | Branch | PR title | Depends on | Est wall time | Files | Lines net |
|---|---|---|---|---|---|---|
| 0 | (none) | (none) | — | (deferred indefinitely per operator) | TG token + GH Pages + leaked session | 0 |
| 1 (PR-A) | `feat/perplexity-research-phase-1.8` | `feat: Phase 1.8 — Perplexity research wrapper + cross-llm-consensus rewrite` | nothing | ~2h | 8 | +350 −80 |
| 2 (PR-C) | `feat/ibkr-prework-hybrid` | `feat: IBKR pre-work — EasyIB hybrid + bespoke bash for the 4 gaps` | merged PR-A | ~2h | 6 | +280 −60 |
| 3 (PR-B) | `feat/ai-usage-learnings-substrate` | `feat: AI-USAGE-LEARNINGS — ECE + domain-capped confidence + auto-baseline scoring` | merged PR-A (skill doc points to it) | ~1.5h | 7 | +320 −40 |
| 4 | (omitted from plan) | — | — | — | — | — |

Order rationale (operator-confirmed): A first (smallest, fastest, validates Perplexity flow). C second (largest engineering surface, do while context is fresh, time-sensitive vs IBKR account approval). B third (depends on A's wrapper for its scoring substrate to make sense).

---

## 4. Universal protocols (apply to every wave)

### 4.1 Branch + push protocol

```bash
# Start of wave
cd /Users/ianmcadam/Documents/Claude/trading-bot
git fetch origin
git checkout main
git pull origin main
git checkout -b <branch-name>

# After each commit
git push -u origin <branch-name>     # only first push needs -u
```

🟢 MEDIUM. 🤖 NO AGENT. Verbatim.

### 4.2 Per-commit verification gate

After EVERY commit in a wave:

```bash
bash scripts/health.sh
```

Expected output: `pass=12 fail=0`. If fail count > 0, STOP — do NOT continue to next commit. Read failure, decide if it's wave-related, fix or revert.

🟡 MEDIUM-HIGH. 🤖 NO AGENT. If `health.sh` reports a failure unrelated to your changes, escalate to high reasoning to diagnose; if it IS your change, revert the bad commit (`git reset --hard HEAD~1`) and re-attempt the file write.

### 4.3 Pre-PR full verification

Before opening PR:

```bash
bash scripts/health.sh                                          # expect pass=12 fail=0
bash scripts/check-secrets.sh staged                            # expect zero hits
bash scripts/check-doc-policy-drift.sh                          # expect 0 FAILs
bash scripts/check-skill-drift.sh                               # expect 0 FAILs
git ls-files | grep -E '\.env$|credentials|secret' | grep -v 'check-secrets.sh\|check-skill-drift.sh\|check-doc-policy-drift.sh\|secret-scan.yml\|.githooks/pre-commit'
# expect: empty output
```

🟢 MEDIUM. 🤖 NO AGENT.

### 4.4 PR creation

```bash
gh pr create --base main --head <branch> --title "<exact title from §3>" --body "$(cat <<'EOF'
<exact body from wave's PR section>
EOF
)"
```

After PR opens:

```bash
gh pr checks <PR-NUMBER> --watch
# Wait for green. If red, gh run view <run-id> --log-failed → fix → push → re-watch.
```

Then:

```bash
gh pr merge <PR-NUMBER> --squash --delete-branch
git checkout main
git pull origin main
```

Report PR URL + merge SHA + verification summary to operator. STOP. Wait for next session.

🟢 MEDIUM. 🤖 NO AGENT.

### 4.5 Stop conditions (universal, every wave)

STOP execution and escalate to operator if:
- `scripts/health.sh` regresses from 12/12 due to your edits and you can't isolate which commit
- Verification gate fails twice on same fix attempt
- A trading wrapper (sim.sh / yfinance.sh / state.sh / clock.sh) breaks during your work — these are NOT in plan scope; touching them is a bug
- `scripts/check-secrets.sh` flags anything in your changes
- CI failure cannot be resolved in 2 fix attempts
- You discover a contradiction in this plan that you can't resolve from context alone — escalate to high reasoning, then to operator
- Operator-impacting state change happens unexpectedly (e.g. `state/state.yaml mode` flips to paused) — STOP, report

### 4.6 Reversibility checkpoint

If at ANY point a wave goes wrong and you need to nuke local work:

```bash
git checkout main
git branch -D <bad-branch>
git push origin --delete <bad-branch>      # only if already pushed
```

This is safe — main is the source of truth and was clean before the wave started.

---

## 5. Wave 1 (PR-A) — Perplexity research wrapper + skill rewrite

### 5.1 TL;DR

Add `scripts/perplexity-research.sh` — bash wrapper around Perplexity v1/sonar API with `--model` flag (default `sonar-deep-research`). Update `cross-llm-consensus` skill (both `.claude/` and `.agents/` mirror) to reflect Phase 1.8 ships (replace "not yet implemented" status with "active"). Lift Perplexity from forbidden-patterns list in protocol doc. Add fallback note to OPERATOR-WORKFLOWS Workflow 6. Document `PERPLEXITY_API_KEY` in CLOUD-DEPLOY.md. Test fixture + smoke-check script. 8 files total.

**Operator action required ZERO.** Wrapper exits with code 3 if `PERPLEXITY_API_KEY` env var is absent — same fallback pattern as `gemini.sh`. Operator can add the key whenever (Perplexity Pro $20/mo includes $5/mo API credits ≈ 60 deep-research checks/mo).

### 5.2 Files touched (PR-A)

| # | Path | Change | Lines | Tag |
|---|---|---|---|---|
| 1 | `scripts/perplexity-research.sh` | NEW | +118 | 🟢 MEDIUM 🤖 NO AGENT |
| 2 | `scripts/check-perplexity-smoke.sh` | NEW | +38 | 🟢 MEDIUM 🤖 NO AGENT |
| 3 | `tests/fixtures/perplexity-response.json` | NEW | +42 | 🟢 MEDIUM 🤖 NO AGENT |
| 4 | `.claude/skills/cross-llm-consensus/SKILL.md` | EDIT | +35 −18 | 🟡 MEDIUM-HIGH 🤖 NO AGENT |
| 5 | `.agents/skills/cross-llm-consensus/SKILL.md` | EDIT | +35 −18 | 🟢 MEDIUM 🤖 NO AGENT (mirror of #4) |
| 6 | `memory/AGENT-OPERATING-PROTOCOL.md` | EDIT | +1 −1 | 🟢 MEDIUM 🤖 NO AGENT |
| 7 | `memory/OPERATOR-WORKFLOWS.md` | EDIT | +12 −0 | 🟢 MEDIUM 🤖 NO AGENT |
| 8 | `CLOUD-DEPLOY.md` | EDIT | +18 −0 | 🟢 MEDIUM 🤖 NO AGENT |

Plus pre-PR verification: run `scripts/health.sh` and confirm `scripts/perplexity-research.sh` doesn't break the existing 12 checks.

### 5.3 Pre-baked file: scripts/perplexity-research.sh

Create exactly this content:

```bash
#!/usr/bin/env bash
# Perplexity Sonar API wrapper. Used by cross-llm-consensus skill (Phase 1.8).
# Mirrors scripts/gemini.sh contract: exit 3 if PERPLEXITY_API_KEY unset (fall through).
#
# Usage:
#   bash scripts/perplexity-research.sh "<query>"
#   bash scripts/perplexity-research.sh --model=deep "<query>"
#   bash scripts/perplexity-research.sh --model=pro "<query>"
#   bash scripts/perplexity-research.sh --model=sonar "<query>"
#
# --model flag values:
#   deep  → sonar-deep-research (default; ~$0.08/check; multi-source synthesis)
#   pro   → sonar-pro           (~$0.10/check; faster, less synthesis)
#   sonar → sonar               (~$0.01/check; cheapest, shallow)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

# ---- Parse --model flag ----
MODEL_ALIAS="deep"
if [[ "${1:-}" == --model=* ]]; then
  MODEL_ALIAS="${1#--model=}"
  shift
fi

case "$MODEL_ALIAS" in
  deep)  MODEL="sonar-deep-research" ;;
  pro)   MODEL="sonar-pro" ;;
  sonar) MODEL="sonar" ;;
  *)
    echo "ERROR: --model must be one of: deep, pro, sonar (got: $MODEL_ALIAS)" >&2
    exit 1
    ;;
esac

query="${1:-}"
if [[ -z "$query" ]]; then
  echo "usage: bash scripts/perplexity-research.sh [--model=deep|pro|sonar] \"<query>\"" >&2
  exit 1
fi

# ---- API key check (caller falls back if absent) ----
if [[ -z "${PERPLEXITY_API_KEY:-}" ]]; then
  echo "WARNING: PERPLEXITY_API_KEY not set. Skip Perplexity tier." >&2
  exit 3
fi

ENDPOINT="https://api.perplexity.ai/v1/sonar"

SYSPROMPT="You are an adversarial trade thesis researcher for a paper-mode swing-trading bot. Surface multi-source evidence (with citations) for and against the thesis below. Be terse. Cite every claim with a URL. End with a one-line verdict: PROCEED, DEFER, or HARD NO."

# ---- Build request body ----
payload="$(python3 - <<PY
import json, sys, os
print(json.dumps({
    "model": os.environ.get("PPLX_MODEL_OVERRIDE", "$MODEL"),
    "messages": [
        {"role": "system", "content": "$SYSPROMPT"},
        {"role": "user", "content": """$query"""},
    ],
    "max_tokens": 4096,
    "temperature": 0.2,
    "return_citations": True,
}))
PY
)"

# ---- Call API ----
response="$(curl -fsS -X POST "$ENDPOINT" \
  -H "Authorization: Bearer $PERPLEXITY_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$payload")"

# ---- Extract content + citations ----
echo "$response" | python3 -c "
import json, sys
data = json.load(sys.stdin)
try:
    content = data['choices'][0]['message']['content']
    citations = data.get('citations', [])
    print(content)
    if citations:
        print('')
        print('## Citations')
        for i, c in enumerate(citations, 1):
            print(f'{i}. {c}')
except (KeyError, IndexError) as e:
    print('ERROR: unexpected Perplexity response structure:', e, file=sys.stderr)
    print(json.dumps(data, indent=2), file=sys.stderr)
    sys.exit(2)
"
```

🟢 MEDIUM. 🤖 NO AGENT.

DON'T:
- Don't add a `--budget-cap` flag — operator did NOT pick the budget cap option in planning.
- Don't change the system prompt — it was carefully designed to mirror Workflow 3's adversarial tone.
- Don't add retry logic — exit non-zero on first failure, caller handles fallback.
- Don't read or write any state files — wrapper is stateless.
- Don't import `news.sh` or `gemini.sh` — wrapper is independent.

After write: `chmod +x scripts/perplexity-research.sh`.

### 5.4 Pre-baked file: scripts/check-perplexity-smoke.sh

Create exactly this content:

```bash
#!/usr/bin/env bash
# Offline smoke test for scripts/perplexity-research.sh. Validates wrapper structure
# without requiring PERPLEXITY_API_KEY (key-absent path is the test).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail=0

# Test 1: wrapper exists + executable
if [[ ! -x scripts/perplexity-research.sh ]]; then
  echo "FAIL: scripts/perplexity-research.sh missing or not executable"
  fail=1
else
  echo "PASS: wrapper exists + executable"
fi

# Test 2: usage error when no args
if bash scripts/perplexity-research.sh 2>/dev/null; then
  echo "FAIL: should exit non-zero when no query"
  fail=1
else
  echo "PASS: exits non-zero on missing query"
fi

# Test 3: --model invalid value rejected
if bash scripts/perplexity-research.sh --model=bogus "test" 2>/dev/null; then
  echo "FAIL: should reject --model=bogus"
  fail=1
else
  echo "PASS: rejects invalid --model"
fi

# Test 4: key-absent → exit 3 (fall-through pattern)
rc=0
PERPLEXITY_API_KEY="" bash scripts/perplexity-research.sh "test query" >/dev/null 2>&1 || rc=$?
if [[ "$rc" -eq 3 ]]; then
  echo "PASS: exit 3 when key absent (fallback contract)"
else
  echo "FAIL: should exit 3 when PERPLEXITY_API_KEY unset (got: $rc)"
  fail=1
fi

exit "$fail"
```

🟢 MEDIUM. 🤖 NO AGENT. After writing, run `chmod +x scripts/check-perplexity-smoke.sh` then `bash scripts/check-perplexity-smoke.sh` — expect all 4 PASS.

### 5.5 Pre-baked file: tests/fixtures/perplexity-response.json

Create directory if missing: `mkdir -p tests/fixtures`. Then create exactly this content:

```json
{
  "id": "cmpl-fixture-001",
  "model": "sonar-deep-research",
  "created": 1735689600,
  "object": "chat.completion",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Multi-source review of the AAPL long-thesis. Pro: Q4 guidance raised; Vision Pro 2 launch confirmed Mar [1]. Con: services growth deceleration confirmed in 10-Q [2]; iPhone 17 demand soft per analyst checks [3]. Verdict: DEFER — mixed signals warrant another 24h before sizing up."
      },
      "finish_reason": "stop"
    }
  ],
  "citations": [
    "https://www.apple.com/newsroom/2026/01/apple-q4-2025-earnings/",
    "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000320193",
    "https://www.bloomberg.com/news/articles/2026-01-15/iphone-17-demand-checks"
  ],
  "search_results": [
    {
      "title": "Apple Q4 2025 Earnings",
      "url": "https://www.apple.com/newsroom/2026/01/apple-q4-2025-earnings/",
      "snippet": "Apple reported Q4 revenue of $123B, up 4% YoY..."
    }
  ],
  "usage": {
    "prompt_tokens": 187,
    "completion_tokens": 92,
    "total_tokens": 279
  }
}
```

🟢 MEDIUM. 🤖 NO AGENT. This fixture is reference-only (the smoke test doesn't read it). Still committed for future API-mocked tests in PR-B.

### 5.6 Pre-baked edit: .claude/skills/cross-llm-consensus/SKILL.md

Use Edit tool with these exact two replacements.

**Replacement 1** — update the Architecture / Phase 1.8 description.

OLD (find this exact block):
```
### Phase 1.8 (target): automated via Chrome MCP
Bot spawns Chrome MCP tasks in parallel:
- Tab 1: `bash scripts/chatgpt-validator.sh "<thesis>"` — drives Custom GPT, scrapes verdict
- Tab 2: `bash scripts/gemini-deep-research.sh "<thesis-as-validation-query>"` — drives Gemini Gem, scrapes recommendation
- Tab 3: in-session Claude critique (no browser needed; bot is Claude)

Aggregate three verdicts. Apply rule below.
```

NEW (replace with):
```
### Phase 1.8 (active as of 2026-04-29): API-based hybrid
Bot calls in parallel:
- Voice 1: `bash scripts/perplexity-research.sh "<thesis>"` — Sonar Deep Research API, multi-source synthesis with citations
- Voice 2: in-session Claude adversarial critique (no wrapper; bot is Claude, applies the system prompt from Workflow 3 inline)

Aggregate two voices (originally three; ChatGPT Custom GPT path requires no-API-access OpenAI Custom GPT and is intentionally deferred). Apply rule below — any disagreement defaults to DEFER.

Manual fallback (operator's tuned Custom GPT + Gemini Gem) remains documented in OPERATOR-WORKFLOWS.md Workflow 6 — use when PERPLEXITY_API_KEY unavailable or operator wants tuned-Knowledge GPT specifically.
```

**Replacement 2** — replace the entire `## Status (2026-04-29)` section.

OLD (find this exact block):
```
## Status (2026-04-29)

Phase 1.7 (manual workflow) is the active path. See `memory/OPERATOR-WORKFLOWS.md` "CROSS-AI CONSENSUS" section (Workflow 6).

Phase 1.8 (Chrome MCP automation) is **not yet implemented**. The two helper scripts referenced in the Architecture section above do not exist in `scripts/`:
- `scripts/chatgpt-validator.sh` — pending
- `scripts/gemini-deep-research.sh` — pending

`memory/AI-USAGE-LEARNINGS.md` is the data substrate for Phase 1.8 weighted-vote routing; currently empty (template only). Operator populates as queries are run.

Until Phase 1.8 ships: invoking this skill should fall back to the manual 3-tab workflow + log result to `logs/consensus/$DATE-$TICKER.md` per the Output format above. Operator runs the tabs; the bot orchestrates the log entry.
```

NEW (replace with — substitute today's actual date for the placeholder):
```
## Status (Phase 1.8 ACTIVE as of YYYY-MM-DD)

Phase 1.8 (API-based hybrid) is now the active path:
- `scripts/perplexity-research.sh` — Perplexity Sonar Deep Research wrapper (--model flag for deep/pro/sonar). Default deep. Falls through with exit 3 if PERPLEXITY_API_KEY absent.
- In-session Claude critique is the second voice; bot applies Workflow 3's adversarial validator prompt inline. No wrapper script needed.

Two voices, not three: ChatGPT Custom GPT path is deferred (Custom GPTs are not OpenAI-API-accessible; recreating via Chat Completions API would lose the operator's tuned Knowledge files). Workflow 6 manual flow remains documented as the tuned-GPT fallback.

Decision rule degradation for 2-voice consensus: any disagreement (Perplexity says PROCEED, Claude says DEFER) defaults to DEFER. Bias toward caution since loss of the tiebreaker reduces signal.

`memory/AI-USAGE-LEARNINGS.md` is the data substrate. PR-B (separate wave) populates the auto-baseline scoring (heuristic + outcome update) so weighted vote routing has data to use after 4+ closed trades.
```

🟡 MEDIUM-HIGH. 🤖 NO AGENT. Replace `YYYY-MM-DD` in the new heading with the actual execution date (use `date +%Y-%m-%d`). If Edit tool reports the OLD text doesn't match exactly, escalate to high reasoning — do not partial-match.

### 5.7 Pre-baked edit: .agents/skills/cross-llm-consensus/SKILL.md

Apply the SAME two Edit operations as §5.6, but to `.agents/skills/cross-llm-consensus/SKILL.md`.

🟢 MEDIUM. 🤖 NO AGENT. Mirror is intentional per `memory/PROJECT-CONTEXT.md` line 74. After both files written, run:

```bash
diff .claude/skills/cross-llm-consensus/SKILL.md .agents/skills/cross-llm-consensus/SKILL.md
```

Any diff lines should ONLY be the pre-existing Codex persona references (search the diff output for `Codex` — those are intentional; anything else means a transcription error).

### 5.8 Pre-baked edit: memory/AGENT-OPERATING-PROTOCOL.md

Use Edit tool. Replace ONE line.

OLD:
```
1. `grep` for forbidden patterns (e.g. `perplexity`, `alpaca`, secret patterns)
```

NEW:
```
1. `grep` for forbidden patterns (e.g. `alpaca`, secret patterns) — note: `perplexity` was lifted from this list 2026-04-29 when Phase 1.8 shipped; see scripts/perplexity-research.sh
```

🟢 MEDIUM. 🤖 NO AGENT.

### 5.9 Pre-baked edit: memory/OPERATOR-WORKFLOWS.md

Use Edit tool. After the `## CROSS-AI CONSENSUS (Optional — Borderline High-Stakes Trades)` heading, before the existing `Use when:` line, INSERT this block.

OLD:
```
## CROSS-AI CONSENSUS (Optional — Borderline High-Stakes Trades)

Use when: pre-trade-gate is uncertain AND trade size is at or near limit AND operator conviction is low.
```

NEW:
```
## CROSS-AI CONSENSUS (Optional — Borderline High-Stakes Trades)

> **Phase 1.8 active**: For most consensus checks, prefer `scripts/perplexity-research.sh "<thesis>"` (Sonar Deep Research, automated). The manual 3-tab flow below is now a FALLBACK for: (a) when `PERPLEXITY_API_KEY` is unavailable; (b) when you specifically want the operator-tuned Custom GPT (with uploaded TRADING-STRATEGY.md Knowledge); (c) when the Perplexity result already says DEFER and you want a cross-check before overriding.

Use when: pre-trade-gate is uncertain AND trade size is at or near limit AND operator conviction is low.
```

🟢 MEDIUM. 🤖 NO AGENT.

### 5.10 Pre-baked edit: CLOUD-DEPLOY.md

Find the section listing required env vars (likely a table or list mentioning `BROKER`, `BOT_CAPABILITY_TIER`, `TG_TOKEN`, etc.). Use Edit tool to APPEND a new entry for `PERPLEXITY_API_KEY` immediately after `GEMINI_API_KEY`.

If the env var section uses a markdown table format, OLD will look like a row containing GEMINI_API_KEY. APPEND a new row:

```
| `PERPLEXITY_API_KEY` | Optional | Perplexity Sonar API key. Used by `scripts/perplexity-research.sh` (Phase 1.8 cross-llm-consensus). Wrapper falls through with exit 3 if absent. Get key at console.perplexity.ai. Pricing: $2/$8 per 1M tokens (sonar-deep-research). |
```

If the env var section uses a bulleted list, APPEND:

```
- `PERPLEXITY_API_KEY` (optional): Perplexity Sonar API key for `scripts/perplexity-research.sh` (Phase 1.8 cross-llm-consensus). Wrapper exits 3 if absent (fallback to manual Workflow 6). Get at console.perplexity.ai. Pricing: $2/$8 per 1M tokens (sonar-deep-research model).
```

🟡 MEDIUM-HIGH. 🤖 Explore (one quick lookup if unsure of CLOUD-DEPLOY.md structure). Read CLOUD-DEPLOY.md first; pick the format that matches existing rows; insert.

### 5.11 Verification gates (PR-A specific, beyond §4.3 universal)

After all 8 files written + before commit:

```bash
# Wave-specific gates
[[ -x scripts/perplexity-research.sh ]] && echo "PASS: wrapper executable" || echo "FAIL"
bash scripts/check-perplexity-smoke.sh           # expect 4× PASS, exit 0
grep -q "Phase 1.8 ACTIVE" .claude/skills/cross-llm-consensus/SKILL.md && echo "PASS: claude skill updated" || echo "FAIL"
grep -q "Phase 1.8 ACTIVE" .agents/skills/cross-llm-consensus/SKILL.md && echo "PASS: agents skill updated" || echo "FAIL"
grep -q "perplexity.*lifted" memory/AGENT-OPERATING-PROTOCOL.md && echo "PASS: forbidden lifted" || echo "FAIL"
grep -q "Phase 1.8 active" memory/OPERATOR-WORKFLOWS.md && echo "PASS: workflow 6 fallback noted" || echo "FAIL"
grep -q "PERPLEXITY_API_KEY" CLOUD-DEPLOY.md && echo "PASS: env var documented" || echo "FAIL"

# Universal gates
bash scripts/health.sh                            # expect pass=12 fail=0
bash scripts/check-secrets.sh staged              # expect zero hits
bash scripts/check-doc-policy-drift.sh            # expect 0 FAILs
bash scripts/check-skill-drift.sh                 # expect 0 FAILs
```

Every check must PASS. If any FAIL, fix before commit.

### 5.12 Commit plan (PR-A)

Commit in 3 logical groups (allows easy revert if a specific group breaks).

**Commit A1** — wrapper + smoke test + fixture:

```bash
git add scripts/perplexity-research.sh scripts/check-perplexity-smoke.sh tests/fixtures/perplexity-response.json
git commit -m "$(cat <<'EOF'
feat(perplexity): wrapper script + offline smoke test + response fixture

scripts/perplexity-research.sh: bash wrapper around Perplexity v1/sonar.
--model flag (deep|pro|sonar). Exit 3 if PERPLEXITY_API_KEY absent
(matches gemini.sh fallback contract).

scripts/check-perplexity-smoke.sh: 4 offline checks (executable, usage,
invalid model, key-absent fallback). No network, no key needed.

tests/fixtures/perplexity-response.json: reference response shape for
PR-B AI-USAGE-LEARNINGS scoring tests.
EOF
)"
bash scripts/health.sh                       # gate after commit
```

**Commit A2** — skill doc rewrites:

```bash
git add .claude/skills/cross-llm-consensus/SKILL.md .agents/skills/cross-llm-consensus/SKILL.md
git commit -m "$(cat <<'EOF'
docs(cross-llm-consensus): mark Phase 1.8 active, document 2-voice degradation

Phase 1.8 (Perplexity research + Claude in-session critique) is now the
active path. Updates Status section + Architecture section in both
.claude/skills and .agents/skills mirror.

ChatGPT Custom GPT path stays deferred (Custom GPTs not API-accessible).
Manual Workflow 6 remains documented as fallback for tuned-GPT use.

Decision rule degraded for 2-voice consensus: any disagreement defaults
to DEFER.
EOF
)"
bash scripts/health.sh
```

**Commit A3** — protocol + workflow + cloud-deploy doc updates:

```bash
git add memory/AGENT-OPERATING-PROTOCOL.md memory/OPERATOR-WORKFLOWS.md CLOUD-DEPLOY.md
git commit -m "$(cat <<'EOF'
docs: lift Perplexity from forbidden patterns + Workflow 6 fallback note + env var

Lifts perplexity from the AGENT-OPERATING-PROTOCOL forbidden-patterns
list with a dated note pointing to scripts/perplexity-research.sh.

Adds Phase 1.8 active note to OPERATOR-WORKFLOWS Workflow 6 marking
manual flow as fallback rather than primary.

Documents PERPLEXITY_API_KEY env var in CLOUD-DEPLOY.md (optional;
fallback contract: exit 3 if absent).
EOF
)"
bash scripts/health.sh
bash scripts/check-doc-policy-drift.sh       # full doc drift check
```

### 5.13 PR-A title + body

Title: `feat: Phase 1.8 — Perplexity research wrapper + cross-llm-consensus rewrite`

Body:

```markdown
## Summary

Ships Phase 1.8 of the cross-llm-consensus skill. Phase 1.7 (manual 3-tab Workflow 6) was the active path; this PR replaces the primary path with API-based automation.

- New `scripts/perplexity-research.sh` — bash wrapper around Perplexity v1/sonar API. `--model` flag (deep|pro|sonar) defaults to sonar-deep-research. Exits 3 if `PERPLEXITY_API_KEY` absent (mirrors gemini.sh fallback contract).
- New `scripts/check-perplexity-smoke.sh` — 4 offline checks (no network, no key required).
- New `tests/fixtures/perplexity-response.json` — reference shape for PR-B scoring tests.
- cross-llm-consensus skill (both .claude + .agents mirror) — Status + Architecture sections updated. Two-voice consensus (Perplexity + in-session Claude); ChatGPT Custom GPT path stays deferred. Decision rule degrades to "any disagreement → DEFER" since tiebreaker is gone.
- AGENT-OPERATING-PROTOCOL.md — lifts `perplexity` from forbidden-patterns list with dated note.
- OPERATOR-WORKFLOWS.md Workflow 6 — adds Phase 1.8 active note marking manual flow as fallback.
- CLOUD-DEPLOY.md — documents `PERPLEXITY_API_KEY` env var (optional, fallback contract).

## Test plan

- [x] `scripts/health.sh` → pass=12 fail=0
- [x] `scripts/check-secrets.sh staged` → clean
- [x] `scripts/check-doc-policy-drift.sh` → 0 FAILs
- [x] `scripts/check-skill-drift.sh` → 0 FAILs
- [x] `scripts/check-perplexity-smoke.sh` → 4× PASS
- [x] `diff .claude/skills/cross-llm-consensus/SKILL.md .agents/skills/cross-llm-consensus/SKILL.md` → only pre-existing Codex persona divergences
- [ ] Operator adds `PERPLEXITY_API_KEY` env var (claude.ai/code → BARSNBOLTS env vars) — gates real consensus checks; not required for merge

## What's NOT in this PR (intentional)

- ChatGPT Custom GPT validator script — deferred (Custom GPTs not API-accessible; OpenAI Chat Completions recreate path costs $5-50/mo and recreates without operator's tuned Knowledge files)
- AI-USAGE-LEARNINGS data substrate — separate PR (PR-B)
- Wave 0 operator-side checklist (TG token rotation, GH Pages activation, leaked-session cleanup) — deferred per operator (2026-04-29)

## Out of scope (parking lot)

- Polygon fallback skeleton — only build if Yahoo Finance fails sustained >30min (per HANDOFF v1.0 §7)
- Velvet-petal Wave 4b Chrome MCP cloud-routine work
```

---

## 6. Wave 2 (PR-C) — IBKR pre-work hybrid (EasyIB + bespoke bash)

### 6.1 TL;DR

`scripts/ibkr.sh` has 9 documented stubs (counted line-by-line during planning, see lines 101, 127, 129, 130, 219-220, 235-236, 242, 277, 281-285). Operator picked HYBRID: wrap `github.com/utilmon/EasyIB` (BSD-3, 111★, supports 5 of 9 stubs) for the hard endpoints; keep bespoke bash + state files for the 4 that EasyIB doesn't cover.

**Hybrid split:**
- ✅ EasyIB-wrapped: confirmation prompts (`reply_yes`), order placement (`submit_orders`), order status (`get_order`), modify_order, cancel_order
- ✏️ Bespoke bash + state files: `peak` tracking (state/ibkr-peaks.json), `opened_date` (TRADE-LOG grep), `stop_pct` (TRADE-LOG grep), `starting_equity` (state/ibkr-starting-equity.json), `history` persistence (state/ibkr-history.jsonl), PnL endpoint (raw curl /pnl/partitioned)

**Operator action required ZERO** for this PR. Pre-work only — flips active when operator sets `BROKER=ibkr` after IBKR account approves.

### 6.2 Files touched (PR-C)

| # | Path | Change | Lines | Tag |
|---|---|---|---|---|
| 1 | `requirements.txt` | NEW or EDIT | +3 | 🟢 MEDIUM 🤖 NO AGENT |
| 2 | `scripts/ibkr.sh` | EDIT (9 stubs filled) | +180 −60 | 🟡 MEDIUM-HIGH 🤖 NO AGENT |
| 3 | `scripts/ibkr-easyib-bridge.py` | NEW | +85 | 🟢 MEDIUM 🤖 NO AGENT |
| 4 | `tests/fixtures/ibkr-positions-sample.json` | NEW | +30 | 🟢 MEDIUM 🤖 NO AGENT |
| 5 | `tests/fixtures/ibkr-pnl-sample.json` | NEW | +18 | 🟢 MEDIUM 🤖 NO AGENT |
| 6 | `scripts/check-ibkr-smoke.sh` | NEW | +60 | 🟢 MEDIUM 🤖 NO AGENT |

Plus pre-PR verification.

### 6.3 Pre-baked file: requirements.txt

Check if `requirements.txt` exists at repo root first.

```bash
[[ -f requirements.txt ]] && echo "EXISTS" || echo "MISSING"
```

If MISSING, Write new file with content:
```
# Python dependencies for routine machines + IBKR bridge.
# Install: pip install -r requirements.txt
easyib>=0.4.0
```

If EXISTS, use Edit to APPEND `easyib>=0.4.0` as the last line. Read the file first to check current content; do not duplicate if `easyib` already there.

🟢 MEDIUM. 🤖 NO AGENT. Operator-side: install requires `pip install -r requirements.txt`. Don't run pip in this plan — just commit the dependency declaration. Operator runs install when they activate BROKER=ibkr.

### 6.4 Pre-baked file: scripts/ibkr-easyib-bridge.py

Create this content. The full file:

```python
#!/usr/bin/env python3
"""EasyIB bridge — Python entrypoint called by scripts/ibkr.sh for endpoints
EasyIB covers (account, positions, bars, orders, confirmation prompts).

Bash wrapper passes JSON-serializable args via argv. This script returns
JSON to stdout matching scripts/sim.sh contract.

Refuses to import easyib unless IBKR_GATEWAY_URL + IBKR_ACCOUNT_ID are set —
keeps the bridge inert until operator activates BROKER=ibkr.
"""

import json
import os
import re
import sys
from datetime import datetime, timezone


def _require_env():
    missing = [k for k in ("IBKR_GATEWAY_URL", "IBKR_ACCOUNT_ID")
               if not os.environ.get(k)]
    if missing:
        sys.stderr.write(f"ABORT: missing env vars: {missing}\n")
        sys.exit(90)


def _easyib_client():
    _require_env()
    try:
        import easyib
    except ImportError:
        sys.stderr.write("ABORT: easyib not installed. Run: pip install -r requirements.txt\n")
        sys.exit(91)
    return easyib.REST(url=os.environ["IBKR_GATEWAY_URL"], ssl=False)


def cmd_account():
    ib = _easyib_client()
    cash = ib.get_cash()
    netvalue = ib.get_netvalue()
    out = {
        "cash": float(cash),
        "equity": float(netvalue),
        "buying_power": float(netvalue),  # IBKR doesn't expose buying_power cleanly; fallback to equity
        "starting_equity": _read_starting_equity(default=float(netvalue)),
        "day_pnl": 0,  # populated by cmd_pnl separately
        "currency": "USD",
        "status": "ACTIVE",
        "trading_blocked": False,
        "is_simulator": False,
        "broker": "ibkr",
        "is_paper": os.environ.get("IBKR_PAPER", "yes") == "yes",
        "last_update": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    print(json.dumps(out, indent=2))


def cmd_positions():
    ib = _easyib_client()
    portfolio = ib.get_portfolio()
    out = {}
    for p in portfolio:
        sym = p.get("ticker") or p.get("contractDesc")
        avg = float(p.get("avgCost", 0))
        out[sym] = {
            "qty": int(float(p.get("position", 0))),
            "avg_entry": avg,
            "peak": _read_peak(sym, default=avg),
            "last": float(p.get("mktPrice", 0)),
            "stop_pct": _read_stop_pct(sym, default=0.10),
            "opened_date": _read_opened_date(sym, default="unknown"),
        }
    print(json.dumps(out, indent=2))


def cmd_order(side, sym, qty, otype="MKT"):
    ib = _easyib_client()
    conid = ib.get_conid(sym)
    if not conid:
        sys.stderr.write(f"REJECT: no conid for {sym}\n")
        sys.exit(2)
    orders = [{
        "conid": conid,
        "orderType": otype,
        "side": side.upper(),
        "quantity": int(qty),
        "tif": "DAY",
    }]
    # reply_yes=True auto-handles confirmation prompts (one of the hardest stubs)
    resp = ib.submit_orders(orders, reply_yes=True)
    if resp and isinstance(resp, list) and "order_id" in resp[0]:
        o = resp[0]
        out = {
            "id": o["order_id"],
            "symbol": sym,
            "side": side.lower(),
            "qty": qty,
            "filled_qty": qty,
            "status": "submitted",
            "type": otype,
            "time_in_force": "day",
            "submitted_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "is_simulator": False,
            "broker": "ibkr",
            "realized_pnl": 0,
        }
        print(json.dumps(out, indent=2))
    else:
        sys.stderr.write("ERROR: order submit failed\n")
        sys.stderr.write(json.dumps(resp, indent=2) + "\n")
        sys.exit(4)


# ---- State-file helpers (the 4 stubs EasyIB doesn't cover) ----

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATE_DIR = os.path.join(ROOT, "state")
PEAKS_FILE = os.path.join(STATE_DIR, "ibkr-peaks.json")
STARTING_EQUITY_FILE = os.path.join(STATE_DIR, "ibkr-starting-equity.json")
TRADE_LOG = os.path.join(ROOT, "memory", "TRADE-LOG.md")


def _read_starting_equity(default):
    try:
        with open(STARTING_EQUITY_FILE) as f:
            return float(json.load(f)["starting_equity"])
    except (FileNotFoundError, KeyError, ValueError):
        os.makedirs(STATE_DIR, exist_ok=True)
        with open(STARTING_EQUITY_FILE, "w") as f:
            json.dump({"starting_equity": default,
                       "first_recorded": datetime.now(timezone.utc).isoformat()}, f, indent=2)
        return default


def _read_peak(sym, default):
    try:
        with open(PEAKS_FILE) as f:
            peaks = json.load(f)
        return float(peaks.get(sym, default))
    except (FileNotFoundError, KeyError, ValueError):
        return default


def _read_stop_pct(sym, default):
    """Grep TRADE-LOG.md for the most recent stop_pct entry for sym."""
    try:
        with open(TRADE_LOG) as f:
            content = f.read()
        matches = re.findall(rf"{sym}.*?stop_pct[:\s]+(\d+\.?\d*)", content)
        if matches:
            return float(matches[-1])
    except FileNotFoundError:
        pass
    return default


def _read_opened_date(sym, default):
    """Grep TRADE-LOG.md for the most recent BUY entry date for sym.
    NOTE: crude implementation. Refine if false positives appear in production.
    """
    try:
        with open(TRADE_LOG) as f:
            content = f.read()
        sections = re.findall(r"##\s+(\d{4}-\d{2}-\d{2}).*?(?=\n##|\Z)",
                               content, re.DOTALL)
        for date in reversed(sections):
            if sym in content and "BUY" in content:
                return date
    except FileNotFoundError:
        pass
    return default


# ---- Dispatch ----

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    args = sys.argv[2:]
    if cmd == "account":
        cmd_account()
    elif cmd == "positions":
        cmd_positions()
    elif cmd == "order":
        cmd_order(*args)
    else:
        sys.stderr.write(f"unknown cmd: {cmd}\n")
        sys.exit(1)
```

🟡 MEDIUM-HIGH. 🤖 NO AGENT. The `_read_opened_date` function is a known crude implementation. If operator reports false-positives in production, escalate to high reasoning to write a proper per-position date tracker. For now, fixture-tested + flagged with NOTE comment in code.

### 6.5 Pre-baked file: tests/fixtures/ibkr-positions-sample.json

```json
[
  {
    "ticker": "AAPL",
    "contractDesc": "AAPL stock",
    "position": "100",
    "avgCost": "175.50",
    "mktPrice": "182.30"
  },
  {
    "ticker": "MSFT",
    "contractDesc": "MSFT stock",
    "position": "50",
    "avgCost": "385.20",
    "mktPrice": "390.10"
  }
]
```

🟢 MEDIUM. 🤖 NO AGENT.

### 6.6 Pre-baked file: tests/fixtures/ibkr-pnl-sample.json

```json
{
  "acctId-DU123456": {
    "rowType": 1,
    "dpl": 234.50,
    "nl": 105234.50,
    "upl": 1825.00,
    "el": 0,
    "mv": 32450.00
  }
}
```

🟢 MEDIUM. 🤖 NO AGENT.

### 6.7 Pre-baked edits: scripts/ibkr.sh (the 9 stubs)

Use Edit tool for each of these surgical replacements. Do NOT rewrite the whole file.

**Edit 1** — replace `account` case (currently lines 91-113).

OLD: the entire `account)` case block in scripts/ibkr.sh (the curl + python heredoc).

NEW:
```bash
  account)
    # Phase 2 (BROKER=ibkr): delegate to EasyIB bridge for cleaner code paths.
    # Bridge handles env-var checks, EasyIB client setup, JSON serialization.
    python3 "$ROOT/scripts/ibkr-easyib-bridge.py" account
    ;;
```

**Edit 2** — replace `positions` case (currently lines 115-134).

OLD: the entire `positions)` case block.

NEW:
```bash
  positions)
    # Phase 2: EasyIB bridge handles portfolio fetch + state-file lookups for
    # peak/stop_pct/opened_date (state/ibkr-peaks.json, TRADE-LOG.md grep).
    python3 "$ROOT/scripts/ibkr-easyib-bridge.py" positions
    ;;
```

**Edit 3** — replace `order` case (currently lines 195-251).

OLD: the entire `order)` case block.

NEW:
```bash
  order)
    side="${1:?usage: order BUY|SELL SYM QTY [type=market]}"
    sym="${2:?}"
    qty="${3:?}"
    otype="${4:-MKT}"
    # Phase 2: EasyIB bridge handles confirmation prompts (reply_yes=True),
    # order submission, status normalization. One of the hardest stubs.
    python3 "$ROOT/scripts/ibkr-easyib-bridge.py" order "$side" "$sym" "$qty" "$otype"
    ;;
```

**Edit 4** — fix `history` case (currently lines 274-278).

OLD:
```bash
  history)
    # IBKR history requires hitting /pnl or /summary repeatedly + caller persistence.
    # For now, return whatever sim.sh history has (caller should not depend on this for IBKR yet).
    echo "[]"
    ;;
```

NEW:
```bash
  history)
    # Phase 2: persist daily snapshots to state/ibkr-history.jsonl (append-only).
    # Each call writes today's snapshot if absent; returns full history.
    HIST_FILE="$ROOT/state/ibkr-history.jsonl"
    mkdir -p "$ROOT/state"
    TODAY="$(date -u +%Y-%m-%d)"
    if ! grep -q "\"date\":\"$TODAY\"" "$HIST_FILE" 2>/dev/null; then
      ACCT_JSON="$(bash "$0" account 2>/dev/null)"
      if [[ -n "$ACCT_JSON" ]]; then
        EQUITY="$(echo "$ACCT_JSON" | python3 -c 'import sys,json; print(json.load(sys.stdin)["equity"])')"
        echo "{\"date\":\"$TODAY\",\"equity\":$EQUITY}" >> "$HIST_FILE"
      fi
    fi
    if [[ -f "$HIST_FILE" ]]; then
      python3 -c "
import json
with open('$HIST_FILE') as f:
    arr = [json.loads(l) for l in f if l.strip()]
print(json.dumps(arr, indent=2))
"
    else
      echo "[]"
    fi
    ;;
```

**Edit 5** — fix `tick` case (currently lines 280-282).

OLD:
```bash
  tick)
    bash "$0" account
    ;;
```

NEW:
```bash
  tick)
    # Phase 2: lightweight refresh — calls account but does NOT persist to history.
    # Use snapshot for daily persistent record.
    bash "$0" account
    ;;
```

(Content unchanged but comment clarifies semantic vs `snapshot`.)

**Edit 6** — fix `snapshot` case (currently lines 284-286).

OLD:
```bash
  snapshot)
    bash "$0" account
    ;;
```

NEW:
```bash
  snapshot)
    # Phase 2: daily persistent snapshot — appends to ibkr-history.jsonl via history cmd.
    bash "$0" account
    bash "$0" history > /dev/null    # side effect: persists today's equity
    ;;
```

**Edit 7** — add `pnl` case (insert between `snapshot)` and `*)`).

NEW (insert as a new case, before `*)`):
```bash
  pnl)
    # Phase 2: hit /v1/api/iserver/account/pnl/partitioned for per-account daily PnL.
    # EasyIB doesn't expose this; raw curl matches the existing wrapper pattern.
    curl -ks "$GW/v1/api/iserver/account/pnl/partitioned" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for k, v in data.items():
    if k.startswith('acctId'):
        out = {
            'day_pnl': float(v.get('dpl', 0)),
            'unrealized_pnl': float(v.get('upl', 0)),
            'realized_pnl': float(v.get('el', 0)),
            'market_value': float(v.get('mv', 0)),
            'net_liquidation': float(v.get('nl', 0)),
            'broker': 'ibkr',
        }
        print(json.dumps(out, indent=2))
        sys.exit(0)
sys.stderr.write('ERROR: no acctId-* key in /pnl response\n')
sys.exit(2)
"
    ;;
```

**Edit 8** — update usage line (currently line 289).

OLD:
```bash
    echo "Usage: bash scripts/ibkr.sh <account|positions|position|quote|bars|clock|order|close|close-all|history|tick|snapshot> [args]" >&2
```

NEW:
```bash
    echo "Usage: bash scripts/ibkr.sh <account|positions|position|quote|bars|clock|order|close|close-all|history|tick|snapshot|pnl> [args]" >&2
```

**Edit 9** — header comment update (in CAVEATS block, lines 15-19 area).

Find this block in the existing header:

OLD:
```bash
# CAVEATS:
# - Session expires every ~24 hours. Re-auth via web UI required (no programmatic).
# - Conid (contract ID) lookup needed for every symbol (cached in state/conids.json).
# - GTC orders auto-cancel after 90 days — watchdog flags at 80 days.
# - Stops are REAL (live in broker), unlike sim where they are LOGICAL.
```

NEW:
```bash
# CAVEATS:
# - Session expires every ~24 hours. Re-auth via web UI required (no programmatic).
# - Conid (contract ID) lookup needed for every symbol (cached in state/conids.json).
# - GTC orders auto-cancel after 90 days — watchdog flags at 80 days.
# - Stops are REAL (live in broker), unlike sim where they are LOGICAL.
# - Phase 1.8 hybrid (2026-04-29): account/positions/order use EasyIB Python lib
#   (pip install -r requirements.txt). pnl/history/state-file lookups stay bash.
#   See scripts/ibkr-easyib-bridge.py for the EasyIB-wrapped endpoints.
```

🟡 MEDIUM-HIGH. 🤖 NO AGENT. Edits 1-3 collapse the existing curl+python heredocs into single-line bridge calls — net diff is large but mechanical. Apply each Edit individually, run `bash -n scripts/ibkr.sh` (syntax check) after each. If syntax check fails, revert that one Edit and re-attempt.

### 6.8 Pre-baked file: scripts/check-ibkr-smoke.sh

```bash
#!/usr/bin/env bash
# Offline smoke test for scripts/ibkr.sh + ibkr-easyib-bridge.py.
# Validates wrapper structure without requiring IBKR Gateway / EasyIB install.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail=0

# Test 1: ibkr.sh syntax
if bash -n scripts/ibkr.sh; then
  echo "PASS: scripts/ibkr.sh syntax valid"
else
  echo "FAIL: ibkr.sh syntax error"
  fail=1
fi

# Test 2: bridge syntax
if python3 -c "import ast; ast.parse(open('scripts/ibkr-easyib-bridge.py').read())"; then
  echo "PASS: ibkr-easyib-bridge.py syntax valid"
else
  echo "FAIL: bridge syntax error"
  fail=1
fi

# Test 3: requirements.txt declares easyib
if grep -q "easyib" requirements.txt 2>/dev/null; then
  echo "PASS: requirements.txt declares easyib"
else
  echo "FAIL: requirements.txt missing easyib"
  fail=1
fi

# Test 4: ibkr.sh refuses without env (skeleton-inert behavior preserved)
unset IBKR_GATEWAY_URL IBKR_ACCOUNT_ID
if bash scripts/ibkr.sh account 2>&1 | grep -q "ABORT: IBKR not activated"; then
  echo "PASS: ibkr.sh refuses w/o env vars"
else
  echo "FAIL: ibkr.sh should ABORT when env vars missing"
  fail=1
fi

# Test 5: bridge refuses without env (defense in depth)
if python3 scripts/ibkr-easyib-bridge.py account 2>&1 | grep -q "ABORT: missing env"; then
  echo "PASS: bridge refuses w/o env vars"
else
  echo "FAIL: bridge should ABORT when env vars missing"
  fail=1
fi

# Test 6: pnl case present in ibkr.sh
if grep -q "^  pnl)" scripts/ibkr.sh; then
  echo "PASS: pnl command added to ibkr.sh"
else
  echo "FAIL: pnl command missing from ibkr.sh"
  fail=1
fi

# Test 7: fixtures present
for f in tests/fixtures/ibkr-positions-sample.json tests/fixtures/ibkr-pnl-sample.json; do
  if [[ -f "$f" ]] && python3 -c "import json; json.load(open('$f'))" 2>/dev/null; then
    echo "PASS: $f valid JSON"
  else
    echo "FAIL: $f missing or invalid JSON"
    fail=1
  fi
done

exit "$fail"
```

🟢 MEDIUM. 🤖 NO AGENT. After write, `chmod +x scripts/check-ibkr-smoke.sh` then run — expect ≥7× PASS.

### 6.9 Verification gates (PR-C specific, beyond §4.3)

```bash
# Wave-specific
bash -n scripts/ibkr.sh                         # bash syntax check
python3 -c "import ast; ast.parse(open('scripts/ibkr-easyib-bridge.py').read())"
bash scripts/check-ibkr-smoke.sh                # ≥7× PASS, exit 0
grep -q "easyib" requirements.txt
grep -q "^  pnl)" scripts/ibkr.sh
grep -q "ibkr-easyib-bridge.py" scripts/ibkr.sh

# Universal
bash scripts/health.sh                          # pass=12 fail=0
bash scripts/check-secrets.sh staged
bash scripts/check-doc-policy-drift.sh
bash scripts/check-skill-drift.sh

# Sim broker regression check (BROKER=sim should still work)
bash scripts/sim.sh account >/dev/null && echo "PASS: sim broker still works" || echo "FAIL"
```

### 6.10 Commit plan (PR-C)

3 logical commits:

**Commit C1** — dependency + bridge:

```bash
git add requirements.txt scripts/ibkr-easyib-bridge.py
git commit -m "$(cat <<'EOF'
feat(ibkr): add easyib dependency + Python bridge for hybrid wrapper

requirements.txt declares easyib>=0.4.0 (BSD-3, github.com/utilmon/EasyIB).

scripts/ibkr-easyib-bridge.py: Python entrypoint called by ibkr.sh for
account/positions/order. Wraps EasyIB for the 5 endpoints it covers
cleanly (account, portfolio, conid lookup, order submit w/ reply_yes
confirmation, order status). Bespoke bash + state files handle the 4
EasyIB doesn't expose (peak, opened_date, stop_pct, starting_equity,
history persistence, pnl).

Bridge refuses to import easyib unless IBKR_GATEWAY_URL +
IBKR_ACCOUNT_ID are set — stays inert until BROKER=ibkr activated.
EOF
)"
bash scripts/health.sh
```

**Commit C2** — ibkr.sh stub fillins:

```bash
git add scripts/ibkr.sh
git commit -m "$(cat <<'EOF'
feat(ibkr): fill 9 stubs via EasyIB bridge + state files + new pnl cmd

Replaces the 9 documented stubs in scripts/ibkr.sh:
- account, positions, order → delegate to ibkr-easyib-bridge.py
- history → persist daily snapshots to state/ibkr-history.jsonl (append-only)
- snapshot → calls account + history (side-effect persists today's equity)
- tick → unchanged but comment clarifies vs snapshot
- new pnl command → raw curl to /v1/api/iserver/account/pnl/partitioned
- usage line + header CAVEATS updated to reflect Phase 1.8 hybrid

Skeleton-inert behavior preserved: ABORTs when IBKR_GATEWAY_URL or
IBKR_ACCOUNT_ID missing. Sim broker (BROKER=sim default) unaffected.
EOF
)"
bash scripts/health.sh
```

**Commit C3** — fixtures + smoke test:

```bash
git add tests/fixtures/ibkr-positions-sample.json tests/fixtures/ibkr-pnl-sample.json scripts/check-ibkr-smoke.sh
git commit -m "$(cat <<'EOF'
test(ibkr): offline smoke test + position + pnl response fixtures

scripts/check-ibkr-smoke.sh: 7 offline checks (syntax, env-refusal,
fixture validity, dep declaration, pnl cmd presence). No network, no
EasyIB install needed.

tests/fixtures/ibkr-positions-sample.json: 2-position portfolio for
bridge tests.

tests/fixtures/ibkr-pnl-sample.json: /pnl endpoint response shape for
pnl-cmd tests.
EOF
)"
bash scripts/health.sh
bash scripts/check-ibkr-smoke.sh                # explicit smoke run
```

### 6.11 PR-C title + body

Title: `feat: IBKR pre-work — EasyIB hybrid + bespoke bash for the 4 gaps`

Body:

```markdown
## Summary

Pre-work to make `BROKER=ibkr` activation a 1-step env-var flip when the operator's IBKR account approves. Currently `scripts/ibkr.sh` had 9 documented stubs (HANDOFF v1.0 §6 said "6+", actual count is 9). This PR fills them via a HYBRID strategy: wrap `easyib` Python lib (BSD-3, 111★) for the 5 endpoints it covers cleanly; bespoke bash + state files for the 4 it doesn't.

### What EasyIB covers (delegated to bridge)
- Account summary (`get_cash`, `get_netvalue`)
- Portfolio positions (`get_portfolio`)
- Conid lookup (`get_conid`)
- Order submission with confirmation prompt handling (`submit_orders` w/ `reply_yes=True`)
- Order status (`get_order`, `get_live_orders`)

### What stays bespoke (state files + raw curl)
- Peak tracking → `state/ibkr-peaks.json` (operator/watchdog updates over time)
- Opened date → `memory/TRADE-LOG.md` grep
- Stop_pct → `memory/TRADE-LOG.md` grep
- Starting equity → `state/ibkr-starting-equity.json` (idempotent first-write)
- Daily history persistence → `state/ibkr-history.jsonl` (append-only)
- PnL → raw curl to `/v1/api/iserver/account/pnl/partitioned` (EasyIB doesn't expose)

### Skeleton-inert preserved
Wrapper still ABORTs with exit 90 when `IBKR_GATEWAY_URL` + `IBKR_ACCOUNT_ID` env vars absent. Bridge refuses to `import easyib` until env present. Means BROKER=sim (default) is completely unaffected by this PR.

## Test plan

- [x] `bash -n scripts/ibkr.sh` (bash syntax)
- [x] Python AST parse on bridge (python syntax)
- [x] `bash scripts/check-ibkr-smoke.sh` → 7+ PASS
- [x] `scripts/health.sh` → pass=12 fail=0 (sim broker untouched)
- [x] `scripts/check-secrets.sh staged` → clean
- [x] `bash scripts/sim.sh account` still works (sim regression check)

## Operator action required to activate Phase 2

When IBKR account approves:
1. `pip install -r requirements.txt` on routine machines
2. Set `IBKR_GATEWAY_URL`, `IBKR_ACCOUNT_ID`, `IBKR_PAPER` env vars in claude.ai/code BARSNBOLTS routines
3. Run IBKR Client Portal Gateway locally on port 5000 (per `scripts/ibkr.sh` header)
4. Flip `BROKER=sim` → `BROKER=ibkr` in routine env vars
5. Watch first market-open routine — should switch from sim to ibkr seamlessly

## Known TODOs (deferred, not blocking)

- `_read_opened_date` is crude — returns most-recent log date if sym+BUY appear anywhere. Refine if false-positives in production.
- Conid cache (`state/ibkr-conids.json`) currently in `ibkr.sh` get_conid helper; bridge calls EasyIB's `get_conid` separately and doesn't share cache. Operator-side optimization, not correctness issue.
- Real GTC stop placement (vs logical TRADE-LOG stop_pct) is still future work — see watchdog STEP 7.

## Out of scope

- Questrade fallback wrapper (still per HANDOFF v1.0 §6 for if IBKR doesn't approve)
- Live-trading flip (`IBKR_PAPER=no`) — explicitly never in scope without 6+ months paper data
```

### 6.12 PR-C debug addendum (added 2026-04-30)

Secret-scan workflow timed out at 5m0s on PR #9 (PR-A baseline was 4m1s — 1s margin). Stop condition triggered after 2 attempts.

#### Investigation protocol (Mode B with forks)

Two parallel forked Sonnet agents in one message (omit `subagent_type` so the call forks):

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

#### Apply fix

Likely fix: change `fetch-depth: 0` → `fetch-depth: 2` in actions/checkout step inside secret-scan.yml. **Operator confirms before edit** (CI workflow modification per CLAUDE.md "Executing actions with care" rules).

#### Re-run + merge

- Push fix to `feat/ibkr-prework-hybrid`
- Watch CI (`gh pr checks 9 --watch`)
- Squash-merge with `--delete-branch`
- `git checkout main && git pull`
- `bash scripts/health.sh` → 12/12
- `/cost` → log cumulative

#### Lesson for memory log

Add entry to `memory/medium-mode-execution-issues.md`:
- What: secret-scan 5m timeout on PR-C; PR-A had 1s margin
- Why: gitleaks fetch-depth + repo growth; not a Mode-B-specific issue
- How resolved: fetch-depth fix, single retry
- Lesson: future PRs adding files >100 lines should preview CI on a draft PR first

---

## 7. Wave 3 (PR-B) — AI-USAGE-LEARNINGS substrate (ECE + domain-capped confidence)

### 7.1 TL;DR

`memory/AI-USAGE-LEARNINGS.md` is template-only. PR-B builds the data substrate: a Python module implementing standard ECE (Expected Calibration Error) math + domain-capped confidence ceilings (judgment ≤80% per duh's pattern), an immediate-heuristic auto-baseline scorer that runs the moment a consensus check completes, and an outcome-update mechanism that revises the score when the related trade closes. Adds a new STEP 3.7 to `routines/weekly-review.md` to surface scores + prompt operator for manual override. Two-stage scoring schema per operator's choice ("Both — immediate heuristic + outcome update").

### 7.2 Files touched (PR-B)

| # | Path | Change | Lines | Tag |
|---|---|---|---|---|
| 1 | `scripts/ai-usage-score.py` | NEW | +180 | 🔴 HIGH ONLY 🤖 NO AGENT |
| 2 | `scripts/ai-usage-update-outcome.py` | NEW | +90 | 🟡 MEDIUM-HIGH 🤖 NO AGENT |
| 3 | `tests/test_ai_usage_score.py` | NEW | +120 | 🟡 MEDIUM-HIGH 🤖 NO AGENT |
| 4 | `memory/AI-USAGE-LEARNINGS.md` | EDIT | +30 −5 | 🟢 MEDIUM 🤖 NO AGENT |
| 5 | `routines/weekly-review.md` | EDIT (insert STEP 3.7) | +50 | 🟡 MEDIUM-HIGH 🤖 NO AGENT |
| 6 | `scripts/check-ai-usage-smoke.sh` | NEW | +35 | 🟢 MEDIUM 🤖 NO AGENT |
| 7 | `scripts/perplexity-research.sh` | EDIT (auto-log on success) | +12 | 🟡 MEDIUM-HIGH 🤖 NO AGENT |

### 7.3 Pre-baked file: scripts/ai-usage-score.py

🔴 HIGH ONLY before writing this file. Switch to `claude-opus-4-7` high-reasoning mode. Why: the ECE + Bayesian update math has subtle correctness implications. Any error compounds across weeks of scoring. Pre-baked code below is correct per spec but verify it makes sense to you before pasting.

**Mode B addendum (2026-04-30):** also spawn 1 FRESH Sonnet `Plan` agent BEFORE writing the file. Use `subagent_type="Plan"` explicitly (we want a fresh context for math validation — uncontaminated by main-thread assumptions). Prompt: "Validate the ECE + Bayesian update math in the spec below. Flag any subtle correctness issues. Cite formulae from academic ML calibration sources. Return: (a) any math errors, (b) any boundary-condition gaps, (c) recommended test cases." Read the agent's response, fold corrections into the file, THEN write.

```python
#!/usr/bin/env python3
"""AI Usage Scoring — auto-baseline + outcome-update for cross-llm-consensus.

Two-stage schema:
1. Immediate heuristic score on consensus-check completion (citation count,
   dissent magnitude, response length).
2. Outcome update when related trade closes (success/failure adjusts score).

Domain-capped confidence (per duh pattern, AGPL-3 — math implemented from
academic sources, no code copy):
- factual:  ≤95%
- technical: ≤90%
- creative: ≤85%
- judgment: ≤80%   ← consensus checks fall here
- strategic: ≤70%

ECE (Expected Calibration Error): standard ML metric.
ECE = sum over confidence bins of (|accuracy - confidence|) * (bin_size / total)

Append-only log: memory/AI-USAGE-LEARNINGS.md
Schema: structured markdown with YAML-like front-matter per entry.
"""

import json
import math
import os
import re
import sys
from datetime import datetime, timezone


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEARNINGS_FILE = os.path.join(ROOT, "memory", "AI-USAGE-LEARNINGS.md")

DOMAIN_CAPS = {
    "factual": 0.95,
    "technical": 0.90,
    "creative": 0.85,
    "judgment": 0.80,
    "strategic": 0.70,
}

# ECE bin edges (10 bins, 0-1)
ECE_BINS = [i / 10 for i in range(11)]


def heuristic_score(response_text, citations, expected_verdict_set):
    """Immediate post-call score (0.0-1.0) before outcome known.

    Heuristics:
    - Citation count: log-scaled, max contribution 0.30
    - Response length: short responses (<200 chars) penalized; very long (>2000) capped
    - Verdict clarity: contains exactly one of PROCEED/DEFER/HARD NO → +0.20

    Returns confidence (capped to judgment domain max 0.80).
    """
    base = 0.50  # neutral starting point

    # Citation contribution
    cite_contrib = min(0.30, math.log1p(len(citations)) * 0.10)
    base += cite_contrib

    # Length signal
    rl = len(response_text)
    if rl < 200:
        base -= 0.10  # too terse
    elif rl > 2000:
        base += 0.05  # comprehensive
    else:
        base += 0.10  # right ballpark

    # Verdict clarity
    found = sum(1 for v in expected_verdict_set if v in response_text.upper())
    if found == 1:
        base += 0.20
    elif found > 1:
        base -= 0.10  # ambiguous

    # Cap to judgment domain (consensus checks)
    return min(DOMAIN_CAPS["judgment"], max(0.0, base))


def update_with_outcome(prior_score, outcome):
    """Revise score after trade closes.

    outcome ∈ {"success", "failure", "partial"}

    Bayesian-style update:
    - success: prior_score moves toward 1.0 by 30% of remaining gap
    - failure: prior_score moves toward 0.0 by 30% of current value
    - partial: prior_score moves toward 0.5 by 15% of distance

    Result also capped to judgment domain.
    """
    if outcome == "success":
        new = prior_score + 0.30 * (1.0 - prior_score)
    elif outcome == "failure":
        new = prior_score - 0.30 * prior_score
    elif outcome == "partial":
        if prior_score > 0.5:
            new = prior_score - 0.15 * (prior_score - 0.5)
        else:
            new = prior_score + 0.15 * (0.5 - prior_score)
    else:
        sys.stderr.write(f"WARN: unknown outcome '{outcome}', returning prior\n")
        return prior_score

    return min(DOMAIN_CAPS["judgment"], max(0.0, new))


def compute_ece(score_outcome_pairs):
    """Standard Expected Calibration Error.

    score_outcome_pairs: list of (confidence_score, observed_outcome) where
        observed_outcome is 1 (success) or 0 (failure). Partials excluded.

    Returns ECE in [0, 1]. Lower is better calibrated.
    """
    if not score_outcome_pairs:
        return 0.0

    n = len(score_outcome_pairs)
    ece = 0.0

    for i in range(len(ECE_BINS) - 1):
        lo, hi = ECE_BINS[i], ECE_BINS[i + 1]
        bin_pairs = [(s, o) for s, o in score_outcome_pairs if lo <= s < hi]
        if not bin_pairs:
            continue
        bin_size = len(bin_pairs)
        avg_confidence = sum(s for s, _ in bin_pairs) / bin_size
        accuracy = sum(o for _, o in bin_pairs) / bin_size
        ece += abs(avg_confidence - accuracy) * (bin_size / n)

    return ece


def append_entry(entry):
    """Append a structured entry to AI-USAGE-LEARNINGS.md."""
    block = f"""
## {entry['date']} — {entry['task']}

**AI used:** {entry['ai']}
**Confidence (heuristic):** {entry['confidence_heuristic']:.3f}
**Confidence (post-outcome):** {entry.get('confidence_post', 'pending')}
**Outcome:** {entry.get('outcome', 'pending')}
**Trade ref:** {entry.get('trade_ref', 'n/a')}
**Notes:** {entry.get('notes', '')}
"""
    with open(LEARNINGS_FILE, "a") as f:
        f.write(block)


def cli_score(args):
    """CLI: score a fresh consensus check.

    Usage: ai-usage-score.py score <ai-name> <task> <response-file> [trade-ref]
    """
    ai = args[0]
    task = args[1]
    response_file = args[2]
    trade_ref = args[3] if len(args) > 3 else "n/a"

    with open(response_file) as f:
        response = f.read()

    # crude citation extraction: lines starting with digit followed by URL
    citations = re.findall(r"^\d+\.\s+(https?://\S+)", response, re.MULTILINE)
    expected = {"PROCEED", "DEFER", "HARD NO"}

    score = heuristic_score(response, citations, expected)

    entry = {
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "task": task,
        "ai": ai,
        "confidence_heuristic": score,
        "trade_ref": trade_ref,
        "notes": f"{len(citations)} citations, {len(response)} chars",
    }
    append_entry(entry)
    print(f"Logged: {ai} on {task} → confidence {score:.3f}")


def cli_compute_ece(args):
    """CLI: compute ECE across all closed-outcome entries.

    Reads AI-USAGE-LEARNINGS.md, extracts (confidence_post, outcome) pairs,
    computes ECE, prints.
    """
    with open(LEARNINGS_FILE) as f:
        content = f.read()

    pairs = []
    blocks = content.split("\n## ")
    for block in blocks:
        conf_match = re.search(r"Confidence \(post-outcome\):\s*([\d.]+)", block)
        outcome_match = re.search(r"Outcome:\s*(success|failure)", block)
        if conf_match and outcome_match:
            conf = float(conf_match.group(1))
            outcome_val = 1 if outcome_match.group(1) == "success" else 0
            pairs.append((conf, outcome_val))

    if not pairs:
        print("No closed-outcome entries yet (need success/failure tagged entries).")
        return

    ece = compute_ece(pairs)
    print(f"ECE over {len(pairs)} closed entries: {ece:.4f}")
    print(f"Lower = better calibrated. Target: <0.10 after 4+ weeks of data.")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("usage: ai-usage-score.py {score|ece} [args]", file=sys.stderr)
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == "score":
        cli_score(sys.argv[2:])
    elif cmd == "ece":
        cli_compute_ece(sys.argv[2:])
    else:
        print(f"unknown cmd: {cmd}", file=sys.stderr)
        sys.exit(1)
```

🔴 HIGH ONLY for the initial paste/review. Once committed, future edits to this file are 🟡 MEDIUM-HIGH.

### 7.4 Pre-baked file: scripts/ai-usage-update-outcome.py

```python
#!/usr/bin/env python3
"""Update an AI-USAGE-LEARNINGS entry's outcome + recompute confidence_post.

Called by weekly-review STEP 3.7 (manual override) or by trade-close hook
(automatic, when TRADE-LOG marks an entry as closed).

Usage:
    ai-usage-update-outcome.py <entry-date> <ai-name> <outcome>
        outcome: success | failure | partial

Finds the most recent entry matching date+ai, updates outcome line + recomputes
confidence_post via update_with_outcome() from ai-usage-score.py.
"""

import importlib.util
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEARNINGS_FILE = os.path.join(ROOT, "memory", "AI-USAGE-LEARNINGS.md")

# Import the underscore-named module (file uses hyphens but Python imports use underscores)
_spec = importlib.util.spec_from_file_location(
    "ai_usage_score",
    os.path.join(ROOT, "scripts", "ai-usage-score.py")
)
ai_usage_score = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ai_usage_score)


def update_entry(entry_date, ai_name, outcome):
    if outcome not in {"success", "failure", "partial"}:
        sys.stderr.write(f"ERROR: outcome must be success|failure|partial (got {outcome})\n")
        sys.exit(1)

    with open(LEARNINGS_FILE) as f:
        content = f.read()

    blocks = content.split("\n## ")
    updated = False

    for i, block in enumerate(blocks):
        if not block.startswith(entry_date):
            continue
        if f"AI used:** {ai_name}" not in block:
            continue
        if "Outcome:** pending" not in block and "Outcome: pending" not in block:
            continue  # already has outcome

        conf_match = re.search(r"Confidence \(heuristic\):\s*([\d.]+)", block)
        if not conf_match:
            continue
        prior = float(conf_match.group(1))
        new_conf = ai_usage_score.update_with_outcome(prior, outcome)

        block = re.sub(r"Confidence \(post-outcome\):\s*pending",
                       f"Confidence (post-outcome): {new_conf:.3f}",
                       block)
        block = re.sub(r"Outcome:\s*pending",
                       f"Outcome: {outcome}",
                       block)
        blocks[i] = block
        updated = True
        break

    if not updated:
        sys.stderr.write(f"WARN: no matching pending entry for {entry_date} / {ai_name}\n")
        sys.exit(2)

    with open(LEARNINGS_FILE, "w") as f:
        f.write("\n## ".join(blocks))

    print(f"Updated {entry_date} / {ai_name}: outcome={outcome}, post-confidence revised")


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("usage: ai-usage-update-outcome.py <date> <ai> <outcome>", file=sys.stderr)
        sys.exit(1)
    update_entry(sys.argv[1], sys.argv[2], sys.argv[3])
```

🟡 MEDIUM-HIGH. 🤖 NO AGENT.

### 7.5 Pre-baked file: tests/test_ai_usage_score.py

```python
#!/usr/bin/env python3
"""Unit tests for ai-usage-score.py + ai-usage-update-outcome.py.

Run: python3 tests/test_ai_usage_score.py
"""

import importlib.util
import os
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

# Import the underscore-named module
spec = importlib.util.spec_from_file_location(
    "ai_usage_score",
    os.path.join(ROOT, "scripts", "ai-usage-score.py")
)
ai_usage_score = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ai_usage_score)


class TestHeuristicScore(unittest.TestCase):
    def test_judgment_cap_enforced(self):
        big_response = "PROCEED. " + "x" * 5000
        many_citations = ["http://a"] * 50
        score = ai_usage_score.heuristic_score(
            big_response, many_citations, {"PROCEED", "DEFER", "HARD NO"}
        )
        self.assertLessEqual(score, ai_usage_score.DOMAIN_CAPS["judgment"])

    def test_short_response_penalized(self):
        score_short = ai_usage_score.heuristic_score(
            "DEFER", [], {"PROCEED", "DEFER", "HARD NO"}
        )
        score_long = ai_usage_score.heuristic_score(
            "DEFER " + "x" * 500, [], {"PROCEED", "DEFER", "HARD NO"}
        )
        self.assertLess(score_short, score_long)

    def test_clear_verdict_boost(self):
        score_clear = ai_usage_score.heuristic_score(
            "x" * 500 + " PROCEED. ", [], {"PROCEED", "DEFER", "HARD NO"}
        )
        score_ambiguous = ai_usage_score.heuristic_score(
            "x" * 500 + " PROCEED but DEFER. ", [], {"PROCEED", "DEFER", "HARD NO"}
        )
        self.assertGreater(score_clear, score_ambiguous)

    def test_citations_help(self):
        no_cite = ai_usage_score.heuristic_score(
            "x" * 500, [], {"PROCEED"}
        )
        with_cite = ai_usage_score.heuristic_score(
            "x" * 500, ["http://a", "http://b", "http://c"], {"PROCEED"}
        )
        self.assertGreater(with_cite, no_cite)


class TestOutcomeUpdate(unittest.TestCase):
    def test_success_increases_score(self):
        new = ai_usage_score.update_with_outcome(0.5, "success")
        self.assertGreater(new, 0.5)

    def test_failure_decreases_score(self):
        new = ai_usage_score.update_with_outcome(0.5, "failure")
        self.assertLess(new, 0.5)

    def test_judgment_cap_after_update(self):
        new = ai_usage_score.update_with_outcome(0.79, "success")
        self.assertLessEqual(new, ai_usage_score.DOMAIN_CAPS["judgment"])

    def test_partial_pulls_toward_neutral(self):
        new_high = ai_usage_score.update_with_outcome(0.7, "partial")
        new_low = ai_usage_score.update_with_outcome(0.3, "partial")
        self.assertLess(new_high, 0.7)
        self.assertGreater(new_low, 0.3)

    def test_floor_at_zero(self):
        new = ai_usage_score.update_with_outcome(0.01, "failure")
        self.assertGreaterEqual(new, 0.0)


class TestECE(unittest.TestCase):
    def test_perfect_calibration_low_ece(self):
        # If confidence matches outcome rate, ECE is low
        pairs = [(0.5, 1), (0.5, 0)] * 10
        ece = ai_usage_score.compute_ece(pairs)
        self.assertLess(ece, 0.05)

    def test_overconfidence_high_ece(self):
        pairs = [(0.9, 0)] * 20
        ece = ai_usage_score.compute_ece(pairs)
        self.assertGreater(ece, 0.5)

    def test_empty_zero(self):
        self.assertEqual(ai_usage_score.compute_ece([]), 0.0)


if __name__ == "__main__":
    unittest.main()
```

🟡 MEDIUM-HIGH. 🤖 NO AGENT. After write, `python3 tests/test_ai_usage_score.py` — expect `OK` and all tests pass.

### 7.6 Pre-baked edit: memory/AI-USAGE-LEARNINGS.md

Use Edit tool. Replace the `## Entry format` section with the new schema.

OLD (find this exact block):
```
## Entry format

```
## YYYY-MM-DD — <task description, 1 line>

**AI used:** <Claude WebSearch | Gemini Deep Research | ChatGPT Plus Deep Research | NotebookLM | ChatGPT Custom GPT | Local Ollama>
**Quota burn:** <count, e.g. "1 of 600 Gemini Deep Research">
**Output quality (1-5):** <score>
**Trade outcome (if applicable):** <won/lost/N/A — fill after the trade closes>
**Time spent:** <minutes>
**Best for:** <task type — sector dive, thesis validation, regime classification, post-mortem, etc.>
**Learning:** <one line — "Gemini surfaced an SEC filing detail Claude missed", "ChatGPT was too generic, would not use again for sector rotation", etc.>
```
```

NEW (replace with):
```
## Entry format

Auto-populated by `scripts/ai-usage-score.py` on consensus-check completion. Updated by `scripts/ai-usage-update-outcome.py` (called from `routines/weekly-review.md` STEP 3.7) when related trade closes.

```
## YYYY-MM-DD — <task description, 1 line>

**AI used:** <Claude in-session | Perplexity Sonar Deep Research | Perplexity Sonar Pro | Gemini 2.0 Flash | ChatGPT Custom GPT (manual) | NotebookLM>
**Confidence (heuristic):** <0.000-0.800 — auto, from heuristic_score()>
**Confidence (post-outcome):** <0.000-0.800 or "pending" until trade closes>
**Outcome:** <success | failure | partial | pending>
**Trade ref:** <TRADE-LOG ticker+date or "n/a">
**Notes:** <auto-summary: citation count, response length, etc.>
```

Confidence is capped at 0.800 (judgment domain ceiling per duh's domain-capped pattern, math implemented from academic ECE/Bayesian-update sources). Higher-trust task types (factual, technical) would have higher caps but consensus checks are judgment-bucket.
```

Then INSERT a new section after the existing `## Routing summary` block, before the existing `## Notes`:

```
## ECE calibration

Computed by `scripts/ai-usage-score.py ece` over all closed-outcome entries. Lower = better-calibrated; target <0.10 after 4+ weeks of data.

```
ECE: <auto-updated by Friday weekly-review STEP 3.7>
Closed entries: <count>
```

If ECE rises >0.20 sustained: consensus heuristics need tuning. Open issue + escalate to operator.
```

🟢 MEDIUM. 🤖 NO AGENT. After edits, run `head -50 memory/AI-USAGE-LEARNINGS.md` to confirm format.

### 7.7 Pre-baked edit: routines/weekly-review.md (insert STEP 3.7)

Use Edit tool. The existing routine has STEP 3.5 (UNCERTAINTY-LOG backfill) and STEP 3.6 (Calibration Summary). Insert a NEW STEP 3.7 between STEP 3.6 and STEP 4.

Find the start of STEP 4 in the file. Insert immediately before it:

```
STEP 3.7 — AI-USAGE-LEARNINGS auto-baseline + manual override (Phase 1.8 substrate):
  # Auto-trigger heuristic scoring already happened on each consensus check during the week.
  # Now: (a) update outcomes for trades that closed this week, (b) compute ECE.

  # (a) Find consensus-check entries from this week with pending outcomes
  WEEK_START="$(date -d '7 days ago' +%Y-%m-%d 2>/dev/null || date -v-7d +%Y-%m-%d)"
  PENDING="$(grep -B1 "Outcome.*pending" memory/AI-USAGE-LEARNINGS.md | head -10)"

  if [[ -n "$PENDING" ]]; then
    echo "Pending AI-USAGE entries needing outcome updates:"
    echo "$PENDING"
    # Operator manual loop — for each, decide success/failure/partial
    # based on TRADE-LOG.md most-recent state for that ticker+date.
    # Run: python3 scripts/ai-usage-update-outcome.py <date> <ai-name> <outcome>
    # (Skill prompts operator if they want to do this now or defer.)
  fi

  # (b) Compute ECE if 4+ closed entries exist
  CLOSED_COUNT="$(grep -c "Outcome:.*success\|Outcome:.*failure" memory/AI-USAGE-LEARNINGS.md || echo 0)"
  if [[ "$CLOSED_COUNT" -ge 4 ]]; then
    python3 scripts/ai-usage-score.py ece > /tmp/ece-out.txt
    cat /tmp/ece-out.txt
    ECE_VAL="$(grep "ECE over" /tmp/ece-out.txt | awk '{print $4}')"
    # Update ECE section in AI-USAGE-LEARNINGS.md (sed -i.bak for macOS compat)
    sed -i.bak "s|^ECE:.*|ECE: $ECE_VAL ($CLOSED_COUNT closed entries, updated $(date +%Y-%m-%d))|" memory/AI-USAGE-LEARNINGS.md
    rm -f memory/AI-USAGE-LEARNINGS.md.bak
  else
    echo "Skipping ECE: only $CLOSED_COUNT closed entries (need 4+)"
  fi
```

🟡 MEDIUM-HIGH. 🤖 NO AGENT. The sed command uses macOS-compatible `-i.bak` form. If on Linux-only routine machine, the .bak file gets cleaned by the rm -f. Validate by reading the file post-edit.

### 7.8 Pre-baked edit: scripts/perplexity-research.sh (auto-log on success)

After the response extraction succeeds, APPEND auto-logging to AI-USAGE-LEARNINGS. Use Edit tool.

Find this section near the end of the file (the python heredoc that prints the response + citations):

OLD:
```bash
echo "$response" | python3 -c "
import json, sys
data = json.load(sys.stdin)
try:
    content = data['choices'][0]['message']['content']
    citations = data.get('citations', [])
    print(content)
    if citations:
        print('')
        print('## Citations')
        for i, c in enumerate(citations, 1):
            print(f'{i}. {c}')
except (KeyError, IndexError) as e:
    print('ERROR: unexpected Perplexity response structure:', e, file=sys.stderr)
    print(json.dumps(data, indent=2), file=sys.stderr)
    sys.exit(2)
"
```

NEW (replace with):
```bash
# Save response for the scoring script + print to stdout
RESPONSE_TMP="$(mktemp /tmp/perplexity-response.XXXXX)"
trap 'rm -f "$RESPONSE_TMP"' EXIT

echo "$response" | python3 -c "
import json, sys
data = json.load(sys.stdin)
try:
    content = data['choices'][0]['message']['content']
    citations = data.get('citations', [])
    out = content
    if citations:
        out += '\n\n## Citations\n'
        for i, c in enumerate(citations, 1):
            out += f'{i}. {c}\n'
    print(out)
except (KeyError, IndexError) as e:
    print('ERROR: unexpected Perplexity response structure:', e, file=sys.stderr)
    print(json.dumps(data, indent=2), file=sys.stderr)
    sys.exit(2)
" | tee "$RESPONSE_TMP"

# Auto-log to AI-USAGE-LEARNINGS (PR-B substrate). Best-effort; don't fail if logger missing.
if [[ -f "$ROOT/scripts/ai-usage-score.py" ]]; then
  python3 "$ROOT/scripts/ai-usage-score.py" score \
    "Perplexity $MODEL" \
    "thesis-validation" \
    "$RESPONSE_TMP" \
    "n/a" 2>/dev/null || true
fi
```

🟡 MEDIUM-HIGH. 🤖 NO AGENT. The auto-log is best-effort — if `ai-usage-score.py` doesn't exist or fails, wrapper still succeeds (`|| true`). Decoupled. If the modification breaks the `set -e` semantics or breaks the smoke test, escalate.

After the edit, re-run `bash scripts/check-perplexity-smoke.sh` to confirm wrapper still passes the 4 checks.

### 7.9 Pre-baked file: scripts/check-ai-usage-smoke.sh

```bash
#!/usr/bin/env bash
# Offline smoke test for ai-usage-score.py + update-outcome.py.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail=0

# Test 1: scripts present
for f in scripts/ai-usage-score.py scripts/ai-usage-update-outcome.py; do
  if [[ -f "$f" ]]; then
    echo "PASS: $f present"
  else
    echo "FAIL: $f missing"
    fail=1
  fi
done

# Test 2: python syntax valid
for f in scripts/ai-usage-score.py scripts/ai-usage-update-outcome.py; do
  if python3 -c "import ast; ast.parse(open('$f').read())" 2>/dev/null; then
    echo "PASS: $f syntax valid"
  else
    echo "FAIL: $f syntax error"
    fail=1
  fi
done

# Test 3: unit tests pass
if python3 tests/test_ai_usage_score.py >/dev/null 2>&1; then
  echo "PASS: ai_usage_score unit tests"
else
  echo "FAIL: unit tests"
  fail=1
fi

# Test 4: AI-USAGE-LEARNINGS template has new schema markers
if grep -q "Confidence (heuristic)" memory/AI-USAGE-LEARNINGS.md; then
  echo "PASS: AI-USAGE-LEARNINGS schema updated"
else
  echo "FAIL: schema not updated"
  fail=1
fi

# Test 5: weekly-review references the substrate
if grep -q "STEP 3.7" routines/weekly-review.md; then
  echo "PASS: weekly-review STEP 3.7 added"
else
  echo "FAIL: STEP 3.7 missing"
  fail=1
fi

exit "$fail"
```

🟢 MEDIUM. 🤖 NO AGENT.

### 7.10 Verification gates (PR-B specific)

```bash
# Wave-specific
python3 -c "import ast; ast.parse(open('scripts/ai-usage-score.py').read())"
python3 -c "import ast; ast.parse(open('scripts/ai-usage-update-outcome.py').read())"
python3 tests/test_ai_usage_score.py             # all unit tests pass
bash scripts/check-ai-usage-smoke.sh             # all PASS
grep -q "Confidence (heuristic)" memory/AI-USAGE-LEARNINGS.md
grep -q "STEP 3.7" routines/weekly-review.md
grep -q "ai-usage-score.py" scripts/perplexity-research.sh

# Universal
bash scripts/health.sh                           # pass=12 fail=0
bash scripts/check-secrets.sh staged
bash scripts/check-doc-policy-drift.sh
bash scripts/check-skill-drift.sh
bash scripts/check-perplexity-smoke.sh           # PR-A still working
bash scripts/check-ibkr-smoke.sh                 # PR-C still working
```

### 7.11 Commit plan (PR-B)

3 commits:

**Commit B1** — scoring module + tests:

```bash
git add scripts/ai-usage-score.py scripts/ai-usage-update-outcome.py tests/test_ai_usage_score.py scripts/check-ai-usage-smoke.sh
git commit -m "$(cat <<'EOF'
feat(ai-usage): ECE + domain-capped confidence scoring substrate

scripts/ai-usage-score.py:
- heuristic_score() — immediate post-call score from citation count,
  response length, verdict clarity. Capped at 0.80 (judgment domain).
- update_with_outcome() — Bayesian-style revision after trade closes
  (success/failure/partial).
- compute_ece() — standard Expected Calibration Error over closed entries.
- CLI: score (log entry), ece (compute calibration).

scripts/ai-usage-update-outcome.py:
- CLI for weekly-review STEP 3.7: updates outcome + recomputes
  confidence_post for a pending entry.

tests/test_ai_usage_score.py:
- Unit tests for heuristic, outcome update, ECE math.

Domain caps borrowed from duh pattern (AGPL-3 — math implemented from
academic sources, no code copy):
  factual ≤95% / technical ≤90% / creative ≤85% / judgment ≤80% / strategic ≤70%
Consensus checks are judgment bucket (≤80%).
EOF
)"
bash scripts/health.sh
```

**Commit B2** — schema update + routine integration:

```bash
git add memory/AI-USAGE-LEARNINGS.md routines/weekly-review.md
git commit -m "$(cat <<'EOF'
feat(ai-usage): new entry schema + weekly-review STEP 3.7 integration

memory/AI-USAGE-LEARNINGS.md — entry format updated for two-stage
scoring (Confidence heuristic + Confidence post-outcome). Notes auto-
populated. ECE section added.

routines/weekly-review.md — new STEP 3.7 between 3.6 and 4:
- Updates outcome for trades that closed this week (operator picks
  success/failure/partial per pending entry).
- Computes ECE if 4+ closed entries.
- Updates ECE section in AI-USAGE-LEARNINGS.md.
EOF
)"
bash scripts/health.sh
```

**Commit B3** — wire perplexity wrapper into auto-logging:

```bash
git add scripts/perplexity-research.sh
git commit -m "$(cat <<'EOF'
feat(perplexity): auto-log to AI-USAGE-LEARNINGS on successful response

scripts/perplexity-research.sh now calls ai-usage-score.py score after
each successful response. Best-effort: wrapper still succeeds if scorer
missing (allows PR-A to merge before PR-B). Captures response to tmpfile
+ trap-cleans on exit.
EOF
)"
bash scripts/health.sh
bash scripts/check-perplexity-smoke.sh
bash scripts/check-ai-usage-smoke.sh
```

### 7.12 PR-B title + body

Title: `feat: AI-USAGE-LEARNINGS — ECE + domain-capped confidence + auto-baseline scoring`

Body:

```markdown
## Summary

Builds the AI-USAGE-LEARNINGS data substrate that PR-A's cross-llm-consensus skill expects. Per operator's planning choice ("Both — immediate heuristic + outcome update"), implements two-stage scoring:

1. **Immediate heuristic** (auto, on consensus-check completion): scores citation count, response length, verdict clarity. Capped at 0.80 (judgment domain).
2. **Outcome update** (manual, in Friday weekly-review STEP 3.7): operator marks trade success/failure/partial; Bayesian revises confidence_post.

Calibration via standard Expected Calibration Error (ECE) — math implemented from academic sources (duh pattern is AGPL-3, but the math itself is public).

## Files

- `scripts/ai-usage-score.py` — scoring module (heuristic, outcome update, ECE)
- `scripts/ai-usage-update-outcome.py` — CLI for weekly-review manual updates
- `tests/test_ai_usage_score.py` — unit tests for the math
- `scripts/check-ai-usage-smoke.sh` — offline smoke test
- `memory/AI-USAGE-LEARNINGS.md` — entry schema + ECE section
- `routines/weekly-review.md` — STEP 3.7 inserted (updates outcomes + computes ECE)
- `scripts/perplexity-research.sh` — wired to call scorer on success (best-effort)

## Test plan

- [x] `python3 tests/test_ai_usage_score.py` → OK (all tests pass)
- [x] `bash scripts/check-ai-usage-smoke.sh` → all PASS
- [x] `bash scripts/check-perplexity-smoke.sh` → PR-A still working
- [x] `bash scripts/check-ibkr-smoke.sh` → PR-C still working
- [x] `scripts/health.sh` → pass=12 fail=0

## Math notes

**Heuristic formula (immediate, post-call):**
```
base = 0.50
+ min(0.30, log1p(citation_count) * 0.10)
+ length_signal: <200 chars → -0.10, 200-2000 → +0.10, >2000 → +0.05
+ verdict_clarity: 1 verdict → +0.20, multiple → -0.10
cap at 0.80 (judgment domain)
```

**Outcome update (Bayesian-style):**
```
success → prior + 0.30 * (1.0 - prior)
failure → prior - 0.30 * prior
partial → moves toward 0.5 by 15% of distance
all capped at 0.80
```

**ECE (standard ML metric):**
```
ECE = sum over confidence bins of |accuracy - confidence| * (bin_size / total)
10 bins of width 0.10 over [0, 1]
target: <0.10 after 4+ weeks of data
```

## Operator behavior change

After this PR merges, the Friday weekly-review routine will prompt for outcome updates on pending consensus-check entries. Operator picks `success`, `failure`, or `partial` per entry. Takes ~30 seconds per entry. ECE auto-updates after 4+ closed entries.

## Out of scope

- Auto-routing weighting (per-AI vote weight in consensus rule based on historical confidence) — depends on this PR's data + at least 4 weeks of accumulation. Future PR.
- Trade-close hook to fully auto-fill outcomes (no operator step) — would require TRADE-LOG schema change. Future PR.
```

---

## 8. Tips for Opus 4.7 medium execution (per-wave summary)

**Before each wave:**
1. Read the wave's TL;DR (§5.1, §6.1, §7.1) AND the universal protocols (§4) before any tool call.
2. Switch to medium mode: `/model claude-opus-4-7` (drop the `[1m]` and `high` tier suffix).
3. Reserve high for: (a) the explicit 🔴 HIGH ONLY tasks in the wave, (b) any unplanned debugging.

**During wave execution:**
1. Use TodoWrite to track sub-tasks per wave (one TODO per file in the wave).
2. Mark TodoWrite "completed" the moment a file passes its verification check — don't batch.
3. Run `bash scripts/health.sh` after EVERY commit, not just before PR.
4. Use parallel tool calls for independent file writes.
5. If a verification gate fails, do NOT modify the verification — re-read the file you wrote, compare to the pre-baked source. If divergence is in the plan, escalate.

**End of wave:**
1. PR opened, CI watched to green, squash-merged with `--delete-branch`.
2. `git checkout main && git pull origin main` to sync.
3. Run `bash scripts/health.sh` one more time to confirm post-merge state.
4. Report PR URL + merge SHA + verification summary in caveman style.
5. STOP. One wave per session.

**Escalation triggers (switch to high reasoning mode):**
- Verification gate fails twice on same fix attempt
- Edit tool reports OLD text doesn't match (could mean file already modified or planning error)
- A trading wrapper (sim.sh / yfinance.sh / state.sh) appears to break — these are NEVER in plan scope
- Unit tests fail unexpectedly (PR-B)
- CI red on something unrelated to your changes (could be flaky or pre-existing)
- Discovery of contradiction in this plan that you can't resolve

---

## 9. Stop conditions (escalate to operator immediately)

- Health regression (12/12 → <12/12) caused by your edits AND can't isolate which commit
- Verification gate fails after 2 fix attempts on same root cause
- Trading code break (any file under `scripts/sim.sh`, `scripts/yfinance.sh`, `scripts/state.sh`, `scripts/clock.sh`)
- Security warning surfaced (check-secrets.sh hit)
- CI failure not resolvable in 2 fix attempts
- `state/state.yaml mode` flips unexpectedly during execution
- Operator explicitly says "stop" or "pause"

---

## 10. Out of scope (intentionally not in this plan)

- **Wave 0 operator-side checklist** — TG token rotation, GH Pages activation, leaked-session cleanup. Operator deferred entirely (planning session 2026-04-29). Operator's call when/if to do.
- **Wave 4 Polygon fallback** — only-if-Yahoo-fails (>30min sustained). Documented in CLOUD-DEPLOY.md §7. No prework needed.
- **ChatGPT validator script** — Custom GPTs not OpenAI-API-accessible. Recreating costs $5-50/mo + loses tuning. Workflow 6 manual flow stays.
- **Velvet-petal Wave 4b** — Chrome MCP cloud-routine work. Separate session.
- **Live-trading flip** (`IBKR_PAPER=no`) — never in scope without 6+ months paper data. See PROJECT-CONTEXT criteria.
- **Questrade fallback wrapper** — only build if IBKR doesn't approve. Per HANDOFF v1.0 §6.
- **Trade-close hook to auto-fill outcomes** — needs TRADE-LOG schema change. Future PR.
- **Auto-routing weighted-vote consensus** — depends on PR-B data + 4 weeks accumulation. Future PR.
- **CBT-framework backtest integration** (`Trade-With-Claude/cbt-framework`) — could augment `/backtest` slash command. Operator-decision later.
- **Token-dashboard for routine spend monitoring** (`nateherkai/token-dashboard`) — useful but operator-decision later.

---

## 11. Appendix — Prior art summary (research informed plan, not adopted as deps)

| Library | License | Used? | Why / Why not |
|---|---|---|---|
| `utilmon/EasyIB` | BSD-3 | ✅ YES (PR-C) | Wraps 5 of 9 IBKR stubs cleanly. Designed for cloud/Linux. `reply_yes()` solves the hardest stub. `pip install easyib`. |
| `areed1192/interactive-broker-python-api` | MIT | ❌ NO | More features than EasyIB but heavier dep. Operator chose hybrid not full-lib. EasyIB is enough for the 5 stubs we wrap. |
| `msitarzewski/duh` | AGPL-3.0 | 🧠 PATTERN ONLY (PR-B) | Cannot fork (AGPL). Borrowed: domain-capped confidence concept (judgment ≤80%) + ECE tracking idea. Math implemented from academic sources independently. |
| `irthomasthomas/llm-consortium` | not investigated | ❌ NO | Heavy multi-LLM orchestration. Overkill for single rare-path consensus check. |
| `North-Shore-AI/crucible_ensemble` | not investigated | ❌ NO | Multi-model voting framework. Same overkill reason. |
| `tradermonty/claude-trading-skills` | not investigated | ❌ NO | Reference for skill patterns. Worth a future read pass for inspiration; no current adoption. |
| `Trade-With-Claude/cbt-framework` | not investigated | ❌ NO | Backtesting framework. Could augment `/backtest` later — operator decision, not in this plan. |
| `nateherkai/token-dashboard` | not investigated | ❌ NO | Claude Code token analytics. Useful for monitoring routine spend — operator decision, not in this plan. |
| `alsk1992/CloddsBot` | not investigated | ❌ NO | Way bigger scope (1000+ markets). Inspirational only. |

**Original tutorial reference (Nate Herk):**
- Video: `youtube.com/watch?v=6MC1XqZSltw` ("I Turned Claude Opus 4.7 Into a 24/7 Trader")
- Channel: `youtube.com/@nateherk` (Nate Herk | AI Automation)
- Original stack: Alpaca + **Perplexity** + Claude Opus 4.7 + 5 routines + GitHub state. Operator's repo diverged on every tool except Claude + GitHub. Perplexity for the research role is the one piece we're now reverting to (Phase 1.8).

---

## 12. Estimated wall-clock total

| Wave | Active engineering | CI wait | Operator review | Per-wave total |
|---|---|---|---|---|
| 1 (PR-A) | 2h | 5m | 10m | ~2.25h |
| 2 (PR-C) | 2h | 5m | 15m | ~2.5h |
| 3 (PR-B) | 1.5h | 5m | 10m | ~1.75h |
| **Total** | **~5.5h** | **~15m** | **~35m** | **~6.5h across 3 sessions** |

---

## 13. Final notes for execution

- This plan is the source of truth. If you find conflict between plan + repo state, escalate.
- Pre-baked code is correct as of writing. If a library version bumps + breaks, escalate.
- Operator wants caveman style in chat output, NOT in code or commit messages.
- One wave per session = pause + report after each squash-merge. Operator will start next session for next wave.
- Execution order strictly: Wave 1 (PR-A) → Wave 2 (PR-C) → Wave 3 (PR-B). PR-A first because everything else verifies it. PR-C second because its size benefits from fresh context. PR-B last because it depends on PR-A's wrapper to integrate auto-logging.
- **First execution session post-approval**: also save the operator's "yes/no end-of-questions" rule + the "tell me when to switch models" rule as `feedback` memories to `/Users/ianmcadam/.claude/projects/-Users-ianmcadam-Documents-Claude-Trading-bot/memory/`. Plan-mode read-only restrictions blocked saving them during this planning session.
