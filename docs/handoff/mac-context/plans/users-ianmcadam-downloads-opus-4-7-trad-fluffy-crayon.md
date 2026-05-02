# Opus 4.7 Trading Bot — Hyper-Detailed Implementation Plan

## Context

Replicating Nate Herk's [Claude Opus 4.7 24/7 Trader](https://www.youtube.com/watch?v=6MC1XqZSltw) build via the AIS+ setup PDF. End state: autonomous swing-trader. 5 cron-scheduled Claude Code Routines/weekday clone repo, read memory markdown, pull live broker state, place paper trades, write back, commit+push. No Python process — Claude *is* bot. Memory = git.

You = beginner, **based in Canada**. Therefore plan = paper-only, local-first smoke test, Telegram + commit-log dual notifications, state-machine kill switch from day one, watchdog routine catching failures.

**Confirmed**: Max plan ($100 or $200/mo, 15 routines/day cap), $100k paper default, eventual real CAD/USD trading goal.

---

## EXECUTION FRAMEWORK — applies to every Phase from here forward

### Batch protocol (every work block follows this 5-step rhythm)

1. **Pre-flight research** (5-15 min, Opus 4.7 high or extra-high if novel)
   - Identify all dependencies + variables + edge cases
   - Verify external APIs / docs are current (WebSearch if uncertain)
   - Map files to be touched
   - Define success criteria upfront

2. **Pre-plan** (5 min, Opus 4.7 high)
   - Write batch-specific plan section to plan file
   - Choose model+reasoning per task (matrix below)
   - Choose agent count + parallelism
   - Decide which context to LOAD vs SKIP

3. **Execution** (variable, agents + me)
   - Dispatch per matrix
   - Parallel where independent
   - Log progress in TodoWrite

4. **Validation gate** (10-15 min, Opus 4.7 high — separate context if heavy)
   - Smoke test the new code
   - Run `grep` checks for forbidden patterns (alpaca, env leaks)
   - Run `health.sh`
   - Run unit/integration tests where exist
   - If FAIL → fix in same batch, do NOT advance

5. **Context-clear + handoff**
   - `mcp__ccd_session__mark_chapter` to log transition
   - Commit + push (clean diff per batch)
   - Write 1-paragraph summary of what changed → next batch reads only summary, not full files
   - Drop large file contents from active conversation context
   - Begin next batch's pre-flight

### Multi-agent dispatch matrix

| Work type | Model + reasoning | Agents | Why |
|---|---|---|---|
| Mechanical bulk edits (sed, rename, find/replace) | Sonnet 4.6 medium | 2-3 parallel | Cheap, fast, quality identical to Opus |
| Wrapper scripts (bash, ~100-200 LOC) | Sonnet 4.6 medium | 1-2 parallel | Mechanical |
| Routine prompt rewrites | Sonnet 4.6 medium | 1-3 parallel | Mostly mechanical |
| Skill design (logic + edge cases) | Opus 4.7 medium | 1 — me OR 1 agent | Needs reasoning |
| Architectural decisions | Opus 4.7 high | me only | Strategic, single-thread |
| Hard novel problem (pivot, weird bug) | Opus 4.7 extra-high | me only | Worth the tokens |
| Audit / security review | Opus 4.7 high | 1 separate-context agent | Unbiased fresh read |
| Code review pre-commit | Sonnet 4.6 medium | 1 agent | Style + obvious issues |
| Documentation polish | Sonnet 4.6 medium | 1 agent | Mechanical |
| Strategic plan design | Opus 4.7 high or extra-high | me only | This file |
| Test execution + result analysis | me at current tier | self | Need full context |

**Parallelism rules**: max 3 agents in a single message; max 5 active concurrently. Each agent burns tokens from the Max plan. Burst usage = OK if next 5h window is light.

**Reasoning bump triggers** (when to escalate medium → high → extra-high):
- Opus medium → high: when the task spans 3+ files OR has cross-file invariants
- Opus high → extra-high: when problem is novel (no obvious template) OR security-critical OR cross-AI consensus required
- Default: stay at lowest tier that produces correct work; bump UP only if validation fails

### AI cross-routing matrix (financial analysis specifically)

Verified 2026 capability:

| Use case | Primary AI | Why | Quota implication |
|---|---|---|---|
| Daily catalyst research (in routines) | **Claude WebSearch** (in-session) | Free within Max plan; no quota draw | Unlimited within window caps |
| Per-trade thesis validation | **Claude Opus 4.7** | Strategy-aware via repo memory | 0 quota |
| Friday weekly performance review | **Gemini Deep Research** ⭐ | Best multi-source synthesis per benchmarks | 1/week of 600/mo |
| Monthly strategy retro | **Gemini Deep Research** | Same | 2/mo |
| Ad-hoc deep ticker dive | **Gemini Deep Research** | Same; real-time SEC filings access | 5/mo |
| Strategy learning queries | **Gemini Deep Research** | Best for academic + practitioner sourcing | 4/mo |
| Borderline trade second-opinion | **ChatGPT Plus Deep Research** | Better at adversarial reasoning | 2/mo of 25 |
| Cross-LLM consensus (uncertain trades) | **All 3 in parallel** | Disagreement = caution signal | varies |
| Long-form document Q&A on memory | **NotebookLM Pro** | 500 notebooks × 300 sources, 500 queries/day | included in Gemini Pro |
| Quick coding / formatting / classification | **Local Ollama (Llama 3.1)** | Free, fast, private | $0 forever |

**Ranking on financial-analysis quality** (from benchmarks + capabilities, my honest read):
1. Gemini Deep Research (best for synthesis with citations)
2. ChatGPT Plus Deep Research (best for adversarial reasoning)
3. Claude Opus 4.7 + WebSearch (best for strategy-aware reasoning)
4. Gemini 3.1 Pro regular (good)
5. GPT-5.5 regular (good)
6. Local Ollama (mediocre on finance, fine for formatting)

### Meta-learning loop on AI routing

`memory/AI-USAGE-LEARNINGS.md` (NEW Phase 1.8) — appendable log:

```
## YYYY-MM-DD — <task description>
- AI used: <name>
- Quota burn: <count>
- Output quality (1-5): <score>
- Trade outcome (if applicable): <won/lost/N/A>
- Learning: <what to do better next time>
```

Friday weekly-review reads this log → identifies "Gemini Deep Research scored 5/5 on sector rotation queries" or "ChatGPT Custom GPT scored 2/5 on small-cap thesis validation" → routes future similar queries to best performer.

After 4 weeks of data: bot's `cross-llm-consensus` skill self-tunes — it knows which AI to weight higher per category.

This is reinforcement learning on AI routing. Compounding edge.

---

## Phase 1.7 — Drop Perplexity, Use Claude WebSearch + Subscription Stack (2026-04-26)

### Context

User reported Perplexity API requires $50 minimum deposit (verified: in their Canadian/Stripe billing region, the UI enforces this even though docs claim no minimum). Asked for alternatives.

User has **three premium subscriptions already** ($140/mo total): Claude Max ~$120/mo, ChatGPT Plus $20/mo, Gemini Advanced $20/mo. Big realization: **bot routines run inside Claude sessions**. Claude has **WebSearch as a built-in tool**. The bot's research can happen via WebSearch inside the Claude routine — NO external research API needed.

External research APIs (Perplexity/Tavily/Brave/Exa) become redundant when the bot IS Claude.

### Architecture: bot uses zero external research APIs

**Primary research source (automated)**: Claude WebSearch tool, called inside every routine session. Free (counts toward Max plan; ~5-10k tokens per pre-market research run, well within window caps).

**Optional redundancy (free)**: `scripts/gemini.sh` calling Google AI Studio free API (Gemini 2.0 Flash, 1500 queries/day free with just email signup at aistudio.google.com). Used if Claude WebSearch ever rate-limits.

**Last resort (already built)**: `scripts/news.sh` Yahoo Finance news headlines.

**Drop Perplexity entirely**: delete `scripts/perplexity.sh`, replace with `scripts/research.sh` that orchestrates the cascade.

### Operator amplification workflows (manual, leverages subscriptions)

These are NOT bot-automated. They're documented workflows the operator (user) does at key decision points:

| Cadence | Tool | Workflow | Output |
|---|---|---|---|
| Friday weekly | Gemini Deep Research | Paste week's TRADE-LOG + WEEKLY-REVIEW prompt → 10-50 page report with citations | Append insights to memory/WEEKLY-REVIEW.md before bot's auto run |
| Monthly retro | NotebookLM Pro | Upload memory/* files to a project notebook → ask natural-language questions ("which sectors lose money?", "best catalysts?") | Insights → memory/STRATEGY-RATIONALE.md amendments |
| Pre-trade uncertain | ChatGPT Custom GPT (optional) | Build "Thesis Validator" GPT with strategy + risk config → paste thesis → get critique | Decision input only; not committed |
| Bot debugging | ChatGPT Code Interpreter | Backtest strategy variations in sandbox | Manual variation experiments |

`memory/OPERATOR-WORKFLOWS.md` (NEW) documents these explicitly so user has copy-pasteable prompts.

### Files to change (minimal — sim broker work already complete)

| File | Change |
|---|---|
| `scripts/perplexity.sh` | DELETE (replaced) |
| `scripts/research.sh` | NEW — orchestrates: Claude WebSearch (primary) → Gemini free API (backup) → news.sh (last resort) |
| `scripts/gemini.sh` | NEW — Google AI Studio free API wrapper |
| `routines/pre-market.md` | Replace `bash scripts/perplexity.sh "<query>"` with WebSearch tool calls + research.sh fallback |
| `routines/weekly-review.md` | Same swap |
| `routines/midday.md` | Same |
| `routines/daily-summary.md` | Same |
| `.claude/skills/earnings-decision/SKILL.md` | Same |
| `.claude/skills/gap-handler/SKILL.md` | Same |
| `.claude/skills/market-regime-detector/SKILL.md` | Same |
| `env.template` | Remove PERPLEXITY_API_KEY; add GEMINI_API_KEY (optional backup); document operator workflow URLs |
| `scripts/health.sh` | Replace Perplexity check with optional Gemini check |
| `CLAUDE.md` | Update wrapper list, add WebSearch primacy, add operator workflows pointer |
| `memory/OPERATOR-WORKFLOWS.md` | NEW — copy-paste prompts for Gemini Deep Research, NotebookLM, ChatGPT GPT |
| `HANDOFF.md` | Update step 1 (no Perplexity signup), add Gemini AI Studio signup as optional |
| `routines/README.md` | Update env-vars list (drop PERPLEXITY_API_KEY) |
| `memory/PROJECT-CONTEXT.md` | Update research stack |

### Critical files (highest blast radius)

- `routines/pre-market.md` — most research-heavy routine; verify WebSearch tool calls work in cloud routines
- `scripts/research.sh` — orchestrator, three-layer cascade
- `memory/OPERATOR-WORKFLOWS.md` — documents the manual leverage points

### Batched Execution Sequence — Phase 1.7

Each batch follows the 5-step protocol (pre-flight → pre-plan → execute → validate → context-clear). Estimated total: 2-3 hours.

#### Batch A — Research wrappers (Sonnet 4.6 medium, 1 agent)
**Pre-flight**: verify Google AI Studio free API key flow (5 min, me)
**Execute**: agent writes `scripts/research.sh` orchestrator + `scripts/gemini.sh` wrapper. Delete `scripts/perplexity.sh`.
**Validate**: `bash scripts/research.sh "test query"` returns sentinel or output. `bash scripts/gemini.sh "test"` works with dummy key (returns auth error gracefully).
**Context-clear**: `mark_chapter "Research wrappers"`. Drop wrapper file content from context.

#### Batch B — Routine + skill rewrites (Sonnet 4.6 medium, 2 agents parallel)
**Pre-flight**: list every file referencing `perplexity.sh` (1 min me, grep -rln)
**Pre-plan**: agent A handles routines (6 files), agent B handles skills (3 files: earnings-decision, gap-handler, market-regime-detector)
**Execute**: parallel
**Validate**: `grep -rln "perplexity\.sh" routines/ .claude/skills/` returns empty. Files compile (no broken markdown).
**Context-clear**: chapter + commit-progress.

#### Batch C — Memory docs + operator workflows (Sonnet 4.6 medium, 1 agent)
**Pre-flight**: confirm Gemini Deep Research current UI flow (me, WebSearch quick check)
**Execute**: agent writes `memory/OPERATOR-WORKFLOWS.md` + `memory/PROMPT-TEMPLATES.md`. Updates `memory/PROJECT-CONTEXT.md`.
**Validate**: docs read clean; templates have specific tickers/metrics/sources per best-practices research.
**Context-clear**: chapter.

#### Batch D — Infra updates (me, no agents — context-light)
**Execute**: edit `env.template` (drop PERPLEXITY_API_KEY, add GEMINI_API_KEY optional), `scripts/health.sh` (swap check), `CLAUDE.md` (wrapper list update), `HANDOFF.md` (signup steps), `routines/README.md` (env-var table)
**Validate**: `bash scripts/health.sh` runs clean.

#### Batch E — Strategy learning loop scaffolding (me, 1 agent)
**Execute**: create `memory/STRATEGY-LEARNING-QUEUE.md` skeleton + `memory/STRATEGY-RESEARCH/` directory (placeholder README) + `memory/AI-USAGE-LEARNINGS.md` skeleton.
**Validate**: directory structure exists; README explains intended use.

#### Batch F — Final audit + commit + push (Opus 4.7 high, 1 separate-context agent)
**Pre-flight**: run all smoke tests
**Execute**: spawn audit agent with full file list — verifies no Alpaca/Perplexity refs left, no env vars in git, all routines reference correct wrappers, all skills self-consistent
**Validate**: agent returns clean report
**Execute**: commit + push

### Validation gates (mandatory pass before each batch boundary)

```bash
# Smoke test research wrapper (after Batch A)
bash scripts/research.sh "What is the VIX today?"
# Expected: returns search results or graceful fallback message

# Smoke test Gemini wrapper (after user adds free key)
GEMINI_API_KEY=xxx bash scripts/gemini.sh "What is the S&P 500 trend this week?"
# Expected: returns Gemini synthesis

# After Batch B: no orphan refs
grep -rln "perplexity\.sh" routines/ .claude/skills/ .claude/commands/
# Expected: empty

# After Batch D: full health check
bash scripts/health.sh
# Expected: 10/10 PASS (or 11/11 with Gemini key set)

# After Batch F: cloud routine smoke (when ready)
# claude.ai/code/routines → pre-market "Run now" → verify commit lands without Perplexity key
```

### Context hygiene rules for this Phase

- After each batch: write 1-paragraph summary, drop the bulk file contents
- Use agents (separate context windows) for any bulk edit work
- Main thread keeps: plan file + current batch goal + last batch summary
- Avoid re-reading large files I've already touched in this session — trust the agent reports
- `mcp__ccd_session__mark_chapter` at every batch boundary for transcript navigation

### Cost summary

| Item | Before | After |
|---|---|---|
| Perplexity API | $50 min deposit blocking signup | $0 — removed |
| Bot research | needed external API | Claude WebSearch (already in Max plan) |
| Optional backup | n/a | Gemini 2.0 Flash free API (1500/day free) |
| Operator workflows | n/a | uses subscriptions you ALREADY pay for ($140/mo total stays the same) |
| **Net new spend** | | **$0/mo** |

### Why this beats every alternative

- Cheaper (vs Perplexity Pro $20/mo, vs Tavily/Brave free tiers): $0 NEW spend
- Higher quality (Claude > Perplexity sonar-small for synthesis; Gemini Deep Research > anything for weekly deep dives)
- Less infrastructure (one fewer API to manage)
- Leverages user's existing $140/mo subscription stack instead of duplicating
- Cloud-routine native (WebSearch is a tool inside every Claude session)

### Quota math — verified 2026 limits

| Service | Deep Research quota | Quality rank |
|---|---|---|
| **Gemini Pro $20/mo** | **20 reports/day ≈ 600/month** | #1 — outperforms ChatGPT + Claude for multi-source |
| **ChatGPT Plus $20/mo** | 25 reports/month (then auto-downgrade to lightweight o4-mini) | #2 |
| **Claude (Max plan)** | No Deep Research; WebSearch tool covers daily | N/A — different tier |

### Bot usage projection vs available quota

| Use case | Frequency | Tool | Monthly draw |
|---|---|---|---|
| Daily catalyst research | 6×/day | Claude WebSearch (in routines) | $0 / unlimited within Max |
| Weekly performance review | 1×/week | Gemini Deep Research | 4-5/month |
| Monthly strategy retro | 1-2×/month | Gemini Deep Research | 2/month |
| Ad-hoc trade thesis dive | ~5/month | Gemini Deep Research | 5/month |
| Strategy learning loop | weekly | Gemini Deep Research | 4/month |
| Emergency cross-check | rare | ChatGPT Plus Deep Research | 2-3/month |

**Net Gemini consumption: ~12-15/month** (out of 600 available). **Net ChatGPT consumption: ~2-3/month** (out of 25). MASSIVE spare capacity.

### Strategy Learning Loop (Phase 1.8 must-include)

Spare Deep Research quota = strategic asset. Bot auto-identifies knowledge gaps from weekly findings, generates pre-vetted Deep Research prompt templates, operator runs in Gemini, insights feed back into strategy.

Pattern:
1. Weekly review surfaces "lost 3 sector-rotation trades" / "earnings holds underperformed" / "sized too aggressive in choppy"
2. Bot writes auto-generated Deep Research prompt to `memory/STRATEGY-LEARNING-QUEUE.md`
3. Operator runs prompt in Gemini Deep Research (or auto-runs via Chrome MCP wrapper)
4. Resulting report appended to `memory/STRATEGY-RESEARCH/<topic>.md`
5. Friday weekly-review routine reads STRATEGY-RESEARCH/ as additional context
6. Strategy proposals in WEEKLY-REVIEW.md cite the research findings
7. Operator approves → human-applied edits to TRADING-STRATEGY.md

Compounding: bot gets smarter via curated Gemini Deep Research over weeks/months.

### Prompt templates (NEW file)

`memory/PROMPT-TEMPLATES.md` — battle-tested templates per Deep Research best practices (specific tickers, date ranges, financial jargon, reader/decision context, diverse-source instruction, output format spec). Templates for:
- Weekly performance reflection
- Sector rotation deep-dive
- Ticker thesis validation (pre-trade)
- Regime analysis (when bot detects shift)
- Earnings hold-vs-exit research
- Position-sizing methodology study
- Specific catalyst-pattern analysis

### API workaround research (verified 2026)

User asked: are there bots/workarounds to bypass the lack of API access? Researched, honest verdict:

| Workaround | Status 2026 | Recommended for our bot? |
|---|---|---|
| **g4f / gpt4free** (xtekky/gpt4free) | Actively maintained. Reverse-engineered OpenAI-compatible endpoints. Multi-provider (GPT-5, Gemini 3, Claude, DeepSeek). | **NO.** ToS-violating; endpoints break frequently as providers detect; risks operator's accounts if any link inferred. |
| **Self-hosted Gemini OAuth proxies** | Several GitHub projects. Use Google account auth (OAuth 2.0 + PKCE) to access Gemini without API key. | **NO.** Gray-area. Google can detect + revoke account access. |
| **DeepSeek hosted chat (free, no rate limit)** | Open-weights model at GPT-4 tier on benchmarks. Free hosted chat. | **YES, optional Tier-4 backup.** ~30 min wrapper `scripts/deepseek.sh`. Legit free alternative if Gemini AI Studio quota ever exhausted. |
| **DuckDuckGo AI Chat (Claude + GPT-4o-mini wrapper)** | Free, anonymous, privacy-first. | **NO** — too generic, no API, no programmatic access. |
| **HuggingChat (open-source rotating models)** | Free with signup. | **NO** — quality below Claude WebSearch. |
| **Chrome MCP browser automation** (already in environment) | Authenticated session via operator's logged-in Chrome. Low volume = low detection. | **YES, primary** — what we're building Phase 1.8 wrappers around. |
| **Gemini AI Studio free API** (already integrated via `scripts/gemini.sh`) | Legitimate free 1500/day Gemini 2.0 Flash. Just an email signup. | **YES, already wired.** |
| **Pay for OpenAI API + Anthropic API** | $5-20/mo at our usage. Real cost. | **OPTIONAL** — only if quality of free tier proves insufficient after 2 weeks of paper. |

### Recommendation locked

**Stay on legitimate free + browser-automation stack**:
- Daily research: Claude WebSearch (free in routines)
- Weekly Deep Research: Gemini Pro Deep Research via web (Chrome MCP automates) + ChatGPT Plus Deep Research as backup
- Cheap programmatic queries: Gemini 2.0 Flash AI Studio (free 1500/day)
- Optional belt-and-suspenders: DeepSeek free hosted (~30 min wrapper, Phase 1.9 if needed)
- Skip: g4f and reverse-engineered proxies (ToS + ban risk)
- Skip: paid OpenAI/Anthropic API for now (unnecessary)

### Phase 1.8.0 — Token-Efficiency Optimization Pass (THIS SESSION, then /clear)

**Context**: User normally runs Opus 4.7 standard (200k window) on medium reasoning. Wants daily operation to be token-efficient + auto-context-refresh-friendly. Currently on Opus 4.7 [1m] extra-high — using the room to design the protocol that runs on lower tiers.

**Plan agent critique (incorporated)**:
- Hooks for output filtering = fragile, low ROI. SKIP. Convention beats hook.
- Biggest single per-turn savings = slim CLAUDE.md, move bulky sections to memory/ files
- Use `fewer-permission-prompts` skill (purpose-built) vs hand-writing allowlist
- Subagent threshold: "3+ files AND grep/find required" OR ">15k token exploration", NOT just "3+ files"
- Cut de-escalation triggers (operator picks model via /model)
- Plan file rotation: archive entirely on phase completion (not split/rolling)

### Step 1: CLAUDE.md slim pass (biggest per-turn win)

Current CLAUDE.md = ~147 lines, ~9k chars, loaded every turn. Trim to ~80 lines.

Move OUT to dedicated memory files (referenced not embedded):
- "Compact Instructions" → `memory/COMPACT-INSTRUCTIONS.md`
- "Capability Tier System" table → `memory/CAPABILITY-TIERS.md`
- Detailed wrappers list → already in `scripts/` directory; CLAUDE.md keeps 1-line pointer

Cap "Read-Me-First" from 7 unconditional files to 3 default + gated additions:
- Always: `state/state.yaml`, `memory/PROJECT-CONTEXT.md`, `memory/TRADING-STRATEGY.md`
- On trade decision: add `memory/TRADE-LOG.md` (tail), `memory/RISK-CONFIG.md`
- On research: add `memory/RESEARCH-LOG.md` (tail)

Net: ~3-4k tokens saved per turn. Compounds.

### Step 2: Run `fewer-permission-prompts` skill

Skill scans transcripts, identifies common read-only Bash + MCP calls that triggered prompts, auto-writes allowlist to `.claude/settings.local.json`. One invocation, persistent benefit.

### Step 3: Create `memory/AGENT-OPERATING-PROTOCOL.md` (caveman style)

Single source of truth for HOW Claude operates this project. Sections:

- **Subagent dispatch rule**: spawn agent if `(touches 3+ files AND grep/find required)` OR `(>15k token exploration estimate)`. Mechanical edits across known files = no agent.
- **Output budget conventions** (no hooks, just rules):
  - `git log --oneline | head -20` not full log
  - `grep -m 50 PATTERN` always
  - `find ... | head -50` always
  - For files >500 lines: use `Read` with offset+limit, never full
- **Reasoning escalation triggers** (rare, high-value — ask user when):
  - Multi-file post-mortem
  - Audit on >20 files
  - Hard novel pivot
  - Security-critical decision
  - 2 consecutive validation failures
- **Validation gate per batch**: `grep` for forbidden patterns + smoke test + audit agent on >2 files in skills/ AND memory/. Don't proceed without PASS.
- **Plan file archive policy**: on phase completion, move whole plan file to `~/.claude/plans/archive/phase-X.Y.Z-YYYY-MM-DD.md`, start fresh.
- **TodoWrite hygiene**: clean stale items at end of each batch.
- **Chapter marks**: `mcp__ccd_session__mark_chapter` at every meaningful break.
- **Background processes**: long commands (backtest, brew install, multi-min builds) → `run_in_background`. Don't block.
- **Commit cadence**: every meaningful unit of work → commit. Avoid mega-commits.
- **Compact Instructions stale-check**: when re-reading after compaction, verify referenced files exist; flag if any missing.

### Step 4: CLAUDE.md additions (terse)

After slim pass, add:
- 1-line pointer: "See `memory/AGENT-OPERATING-PROTOCOL.md` for operational rules."
- Reasoning escalation triggers (just the list, not explanation — full text in protocol file)

### Step 5: Plan file archive (DEFER)

Don't execute archive yet — Phase 1.8.1 not complete. After Phase 1.8.1 wrap commits, archive whole plan file to `~/.claude/plans/archive/phase-1.8-2026-04-XX.md`, start fresh plan for next phase.

### Step 6: Skip hooks (per critique)

Don't write `.claude/hooks/` scripts or PreToolUse rewriting. Convention via AGENT-OPERATING-PROTOCOL.md does the same job at zero infra cost. Hooks were overengineering.

### Step 7: Commit + push, /clear handoff

Single commit: `optimize: token-efficiency pass — slim CLAUDE.md + AGENT-OPERATING-PROTOCOL`.

Tell user: ready for /clear. Resume on Opus 4.7 standard medium.

### Files modified

| File | Change |
|---|---|
| `CLAUDE.md` | Slim ~50%; remove Compact Instructions, Capability Tier table; cap Read-Me-First; add 1-line protocol pointer + escalation triggers |
| `memory/COMPACT-INSTRUCTIONS.md` | NEW — extracted Compact Instructions |
| `memory/CAPABILITY-TIERS.md` | NEW — extracted tier table |
| `memory/AGENT-OPERATING-PROTOCOL.md` | NEW — operating rules (caveman, ~80 lines) |
| `.claude/settings.local.json` | UPDATE via `fewer-permission-prompts` skill |

### Verification

```bash
# 1. CLAUDE.md size dropped
wc -l /Users/ianmcadam/Documents/Claude/trading-bot/CLAUDE.md
# Expect: ~80 lines (was ~147)

# 2. Extracted files exist
ls memory/COMPACT-INSTRUCTIONS.md memory/CAPABILITY-TIERS.md memory/AGENT-OPERATING-PROTOCOL.md

# 3. settings.local.json populated
cat .claude/settings.local.json | head -30

# 4. Smoke test still passes
bash scripts/health.sh
```

### Phase 1.8.1 wrap continuation (NEXT session, 4.7 medium standard)

After /clear:
- Operator types `continue`
- Read `memory/AGENT-OPERATING-PROTOCOL.md` first (sets operating rules)
- Read `memory/PROJECT-PROMPTS.md` "Phase 1.8.1 remaining work"
- Execute: delete old GPT, create Project, validate Gem, setup NotebookLM
- Final commit + chapter mark + plan archive

---

### Phase 1.8.1 — External Project Optimization + Validation Mode (THIS SESSION)

**Context**: Operator has authorized full Chrome MCP control. Previous Phase 1.8 partial created 4 external projects (1 Gem, 1 Notebook, 2 GPTs). Need to:
1. Migrate `Backup Research` from Custom GPT → ChatGPT Project (Project supports persistent memory + per-chat model selection of GPT-5.5 Thinking + Deep Research toggle, which Custom GPTs don't)
2. Confirm latest model selected on every project (GPT-5.5 Thinking if available, else 5.4 Thinking; Gemini 3 Pro everywhere)
3. **Validation mode**: send 1 test query per project, confirm structured output + correct context loading before locking
4. Update `memory/PROJECT-PROMPTS.md` with final URLs + validation results
5. Commit + push

### Final architecture (locked decision)

| Project | Type | Why this type |
|---|---|---|
| Trade Thesis Validator (BARSNBOLTS) | **Custom GPT** | Stateless = unbiased adversarial critique. Memory across chats would anchor on prior validations. |
| Backup Research (BARSNBOLTS) | **ChatGPT Project** (NEW — replaces old Custom GPT) | Cumulative research benefits from project memory. Per-chat model selection enables GPT-5.5 Thinking + Deep Research toggle. |
| BARSNBOLTS Trading Bot — Strategy Research | **Gemini Gem** | Sticky persona for ALL Gemini Deep Research. Thinking + Pro model per chat. |
| BARSNBOLTS Monthly Retro | **NotebookLM Project** | Document-grounded retro with citations to uploaded TRADE-LOG entries. |

### Validation mode — per-project test gates

Each project must pass a single test query before being marked complete. Validation criteria:

| Project | Test Query | PASS Criteria |
|---|---|---|
| Custom GPT (Validator) | Post weak thesis: "AAPL long, entry $200, stop $199, target $202, no catalyst, choppy regime, VIX 25" | Response contains `VERDICT:` (DEFER or HARD NO) + cites missing catalyst rule |
| Project (Backup Research) | Post: "Brief overview of current US semiconductor sector momentum, cite 3 sources" | Response includes Executive Summary + numbered sections + Sources list with URLs |
| Gemini Gem | Post: "Confirm context: list operator's 3 most important strategy rules from your instructions" | Response references swing-trade 2-10 days + max 20% per position + R:R ≥ 2:1 |
| NotebookLM | (After uploading TRADING-STRATEGY.md as source) Post: "What is the operator's max % per position rule and why?" | Response cites the uploaded file inline + answers correctly (20%) |

If a validation fails: refine instructions in that project (1 retry), retest. If 2nd fail: escalate to operator with specific failure mode.

### Execution sequence (Chrome MCP, ~10-15 min wall-clock)

**Pre-flight (1 min, me)**:
- Reconnect Chrome MCP to Browser 1 (already authorized)
- Verify ChatGPT, Gemini, NotebookLM tabs still logged in (operator's same browser)

**Step 1 — Custom GPT (Trade Thesis Validator) verification + model lock (3 min)**:
- Navigate to GPT URL `https://chatgpt.com/g/g-69ee4406f714819192b2c05df688cfd5`
- Open chat → click model selector → select highest Thinking variant available (GPT-5.5 Thinking preferred; GPT-5.4 Thinking fallback)
- Send test thesis from validation table above
- Wait for response → verify VERDICT format
- Document model used in PROJECT-PROMPTS.md

**Step 2 — Delete old Backup Research Custom GPT (1 min)**:
- Navigate to `https://chatgpt.com/g/g-69ee44b994a88191809bac801ae45aeb` editor
- `...` menu → Delete GPT → confirm
- This frees the operator's "My GPTs" sidebar

**Step 3 — Create ChatGPT Project (Backup Research) (4 min)**:
- ChatGPT sidebar → Projects → + New project
- Name: `BARSNBOLTS Trading Bot — Research`
- Project Instructions: paste the spec-style prompt from `memory/PROJECT-PROMPTS.md` (already drafted)
- Upload to Project Files: `memory/TRADING-STRATEGY.md`, `memory/RISK-CONFIG.md`, `memory/STRATEGY-RATIONALE.md`
- Open new chat in project → select GPT-5.5 Thinking model → toggle Deep Research OFF for test (saves quota)
- Send test query from validation table → verify response

**Step 4 — Gemini Gem verification (2 min)**:
- Navigate to `https://gemini.google.com/gems/edit/e465151284e3`
- Click Start Chat in preview pane
- Mode toggle (right side): switch from `Fast` → `Thinking`
- Verify model name shows Gemini 3 Pro (top of chat)
- Send test query → verify response cites strategy_context

**Step 5 — NotebookLM setup + upload sources + verification (4 min)**:
- Navigate to `https://notebooklm.google.com/notebook/19f00e27-5be4-4fcf-babe-161475c52ca3`
- Settings (gear icon) → Model → select Gemini 3 Pro (or highest Pro variant available)
- Click "+ Add Source" → upload (file picker may need operator click): `memory/TRADING-STRATEGY.md`, `memory/RISK-CONFIG.md`, `memory/STRATEGY-RATIONALE.md`, `memory/TRADE-LOG.md`
- File picker is OS-level — may need operator manual click here. If so, escalate.
- Send test query → verify cited response

**Step 6 — Update memory/PROJECT-PROMPTS.md (1 min)**:
- Replace top "✅ All 4 projects" table with new architecture (1 Custom GPT + 1 Project + 1 Gem + 1 Notebook)
- Add validation results section
- Add explicit GPT-5.5 vs 5.4 selection note (whatever operator's UI shows as latest)

**Step 7 — Commit + push (1 min)**:
- One commit: `phase 1.8.1: project architecture + model lock + validation`

### Token + quota cost

- Chrome MCP actions: ~80-100 in batched calls
- Test queries: 1 GPT + 1 Project chat + 1 Gem + 1 NotebookLM = 4 chats total
- Quota burn: ~0.5% Plus monthly + 0.2% Gemini Pro daily + 0.2% NotebookLM daily — trivial
- Wall time: 10-15 min if all goes smoothly; +5 min per validation retry

### Risk + mitigation

| Risk | Mitigation |
|---|---|
| GPT-5.5 not in operator's UI | Pick GPT-5.4 Thinking (still latest reasoning per April 2026 search); document actual model picked |
| File upload requires OS file picker (Chrome MCP can't drive system dialog) | Pause + ask operator to click upload; resume after |
| Test query response is degenerate | Refine instructions, 1 retry; if fails, escalate |
| Browser disconnects mid-flow | Reconnect via list_connected_browsers + select_browser |
| Permission re-prompt on long type | Already authorized; should not re-prompt within session |

### Files modified this phase

| File | Change |
|---|---|
| `memory/PROJECT-PROMPTS.md` | Replace top section with new 4-project architecture + validation log |

No other files. Phase 1.8.2 (browser wrappers + notebooklm-mcp-secure + learning loop integration) is deferred to next session; operator's Phase 1.8.1 work doesn't unblock daily bot operation (Claude WebSearch covers daily research).

---

### Phase 1.8 — Browser/Computer Automation Layer (next session, 4-6 hr)

User's stack: Chrome MCP + Computer-use MCP loaded. Means subscriptions become scriptable. Auto-integration is real.

**Variables fully considered**:
- ToS risk on automation (mitigate: human-cadence delays, personal-use only)
- DOM brittleness (quarterly audit)
- Auth/session via Chrome MCP keeps logged-in state
- Cloud routines have no GUI → these run LOCAL via launchd
- Captchas → escalate, never bypass

**New automation scripts (Tier 1 — highest ROI)**:

| File | Function | Trigger |
|---|---|---|
| `scripts/notebooklm-sync.sh` | Chrome MCP uploads memory/* + 30d TRADE-LOG to user's NotebookLM project | Weekly Sunday via launchd |
| `scripts/gemini-deep-research.sh` | Chrome MCP triggers Gemini Deep Research with weekly-review prompt, scrapes 10-50 page report, appends to WEEKLY-REVIEW.md | Friday afternoon via launchd |
| `scripts/chatgpt-validator.sh` | Chrome MCP opens user's "Trade Thesis Validator" Custom GPT, pastes thesis, scrapes critique | On-demand from pre-trade-gate when uncertain |
| `scripts/ollama.sh` | Local Ollama wrapper (Llama 3.1 8B); cheap formatting/classification ops | Replaces Claude calls for low-stakes work |
| Apple Shortcuts | "Hey Siri pause trading bot", ⌘⇧F flatten, ⌘⇧P portfolio | macOS-level UX |

**New skill**:
- `.claude/skills/cross-llm-consensus/SKILL.md` — borderline trades get Claude+GPT+Gemini consensus check; 2/3 agree proceed, dissent escalates

**New launchd plist**:
- `~/Library/LaunchAgents/com.barsnbolts.trading-bot.weekly.plist` — Sunday NotebookLM sync + Friday Deep Research bridge

### Phase 1.9 — Tier 2 enhancements (when proven needed)

- launchd backup watchdog (laptop redundancy for cloud routines)
- TradingView paper as cross-validation broker
- Gmail-as-input (email → trade trigger)
- Calendar earnings mark-up
- iOS Shortcuts companion
- Voice I/O (Whisper transcribe → macOS say)
- Discord bot channel presence

### Phase 2 — IBKR integration (when account approves)

- `scripts/ibkr.sh` (Client Portal Web API wrapper)
- `scripts/ibkr-dashboard-screenshot.sh` (Computer-use nightly visual audit)
- Migration: BROKER=sim → BROKER=ibkr in routine env vars

---



**Reason**: Questrade pivot dead — retail API is read-only (verified in Questrade docs, only partner-developers can place trades). Alpaca dead — Canada excluded. IBKR signed up but several days for approval. **User wants to start NOW.**

**Path**: Pure-simulation broker bridging real-time Yahoo Finance data → swap to IBKR when account approves.

### Architecture

- `scripts/yfinance.sh` — Yahoo Finance HTTP wrapper (free, no key, no Canadian restriction). Quote, bars, clock.
- `scripts/sim.sh` — broker simulator. Fills market orders against latest yfinance quote. State in `state/sim-{account,positions,equity-history}.json`. Mimics Alpaca/IBKR API shape so swap is one-line config.
- `scripts/capability.sh` — emits current tier (premium|standard|light) from env var or state file. Routines self-throttle.
- All other architecture (routines/skills/kill-switch/watchdog/memory) **unchanged**.

### What sim covers / loses

| Feature | Sim | Real broker |
|---|---|---|
| Strategy logic | ✅ | ✅ |
| Pre-trade gate | ✅ | ✅ |
| Kill switch | ✅ | ✅ |
| Real market data (quotes, bars) | ✅ via yfinance | ✅ |
| Position tracking | ✅ JSON state | ✅ |
| Equity curve, P&L | ✅ | ✅ |
| Watchdog reconciliation | ✅ | ✅ |
| Slippage modeling | ❌ — fills at last quote | ✅ |
| Halts / rejections | ❌ — sim doesn't halt | ✅ |
| Partial fills | ❌ — instant fill | ✅ |
| Overnight gap stop trigger | ❌ — only at routine tick | ✅ |
| Real money risk | N/A | ✅ |

For a 1-2 week paper sim while IBKR processes, this is the right tradeoff.

### Capability-tier system (calibrated for $100 Max plan)

| Tier | Models default | Routines | Behavior |
|---|---|---|---|
| **premium** | Opus 4.7 high | pre-market, weekly-review | Deep research (10-12 queries), full sector dive, alts analysis |
| **standard** | Opus med, Sonnet med | market-open, midday | Solid (5-7 queries), focused, all required steps |
| **light** | Haiku, Sonnet low | daily-summary, watchdog | Mechanical (0-3 queries), format/check only |

`scripts/capability.sh` reads `BOT_CAPABILITY_TIER` env var (cloud routines) or `state/capability.yaml` (local). Default = `standard`.

Each routine prompt opens with a "Tier Branch" section that gates expensive operations.

### IBKR migration path (when account approves, ~1 hour)

1. Write `scripts/ibkr.sh` (mirrors sim.sh subcommand shape; uses IBKR Client Portal Web API)
2. Set `BROKER=ibkr` in routine env vars (default = `sim`)
3. Wrappers/health/routines all read `BROKER` env to dispatch to right script
4. State files stay (sim-*.json archived for backtest reference)
5. First IBKR run pulls live state to seed memory, watchdog reconciles
6. Done. Strategy/skills/memory/routines unchanged.

### Files affected this rewrite

| New | Modified | Deleted |
|---|---|---|
| `scripts/yfinance.sh` | `scripts/health.sh` | `scripts/alpaca.sh` |
| `scripts/sim.sh` | `scripts/clock.sh` | |
| `scripts/capability.sh` | `env.template` | |
| `state/capability.yaml` | `CLAUDE.md` | |
| | 6× `routines/*.md` | |
| | 4× `.claude/commands/*.md` | |
| | 2× `.claude/skills/*` (pre-trade-gate, order-rejection-triage) | |
| | 2× `memory/*.md` (PROJECT-CONTEXT, RISK-CONFIG) | |
| | `HANDOFF.md`, `backtest/run-backtest.sh` | |

---

### Why Questrade fits

| Criterion | Questrade | Why it matters |
|---|---|---|
| Country support | Canada native | KYC works |
| Paper account | Yes (Practice Account, free, separate signup) | $100k+ virtual |
| API style | REST, OAuth 2.0 with refresh tokens | Direct swap for Alpaca wrapper shape |
| Cloud-fit | Stateless containers OK if token rotation handled | Matches Routines model |
| Asset classes | Stocks (CAD + US), ETFs, options, FX | Stock-only strategy unaffected |
| Trailing stops | Supported (`TrailingStopMarket`, `TrailingStopLmt`) | Existing strategy logic stands |
| Real-money path | TFSA/RRSP/Margin (CAD + USD) | Same account graduates |

### The one architectural wrinkle: refresh-token rotation

Questrade rotates the refresh_token on every `/oauth2/token` call — old token invalidated, new token returned. Stateless cloud containers can't naturally persist the new token to the next run.

**Solution**: encrypted-token-in-repo pattern (fits memory-as-git design).

1. `state/questrade-token.enc` — sops-encrypted with age key
2. age private key lives in routine env var (`QUESTRADE_AGE_KEY`)
3. `scripts/questrade.sh` flow per call:
   - decrypt token file → extract refresh_token
   - POST /oauth2/token → new access_token (30min) + new refresh_token
   - encrypt new refresh_token, write back to `state/questrade-token.enc`
   - use access_token for actual API call
4. Routine commits the updated token file as part of normal `git push`
5. Next routine reads the rotated token

**Concurrency safety**: cron times don't overlap. If they ever do, second routine fails token decrypt, retries with backoff, OR is queued.

**Bootstrap**: user generates initial refresh_token via Questrade's web UI (Account → API → Generate Token), pastes into local `.env`, runs `scripts/questrade.sh init` once locally → encrypts + commits. From there, automated.

### Files to rewrite (Phase 1 work needs swap)

| Old | New | Effort |
|---|---|---|
| `scripts/alpaca.sh` | `scripts/questrade.sh` | Full rewrite. Subcommands match Alpaca shape: account, positions, position, quote, bars, orders, order, cancel, cancel-all, close, close-all, clock, init (new). ~200 LOC bash |
| (none) | `scripts/questrade-token.sh` | Helper: encrypt/decrypt/rotate token via sops + age. ~40 LOC |
| `env.template` | same | Swap `ALPACA_*` → `QUESTRADE_REFRESH_TOKEN`, `QUESTRADE_API_SERVER`, `QUESTRADE_ACCOUNT_ID`, `QUESTRADE_AGE_KEY`. Hardcode `QUESTRADE_PRACTICE=yes` |
| `CLAUDE.md` | same | s/Alpaca/Questrade/g, update wrapper line, add CAD/USD note |
| `routines/pre-market.md` | same | s/alpaca.sh/questrade.sh/g; remove DTBP refs (no PDT in Canada); add USD/CAD FX note |
| `routines/market-open.md` | same | Same swap; quote step uses /v1/markets/quotes/:symbolIds (need symbolId lookup first); order POST shape differs |
| `routines/midday.md` | same | s/alpaca.sh/questrade.sh/g |
| `routines/daily-summary.md` | same | Same |
| `routines/weekly-review.md` | same | Same |
| `routines/watchdog.md` | same | Same; add token-rotation health check |
| `.claude/commands/portfolio.md` | same | Same swap |
| `.claude/commands/trade.md` | same | Same swap |
| `.claude/commands/flatten.md` | same | Same swap |
| `.claude/commands/health.md` | same | Same |
| `.claude/skills/pre-trade-gate/SKILL.md` | same | Remove PDT check (Canadian residency = no PDT). Add: USD-listed-stock currency check (warn if practice account doesn't support USD). 17 → 16 checks |
| `.claude/skills/order-rejection-triage/SKILL.md` | same | Replace Alpaca rejection codes with Questrade ones (e.g. `1024 INSUFFICIENT_QUANTITY`, `1029 INVALID_ORDER_PRICE`, `2003 RATE_LIMIT`) |
| `backtest/run-backtest.sh` | same | Use questrade.sh for bars, OR keep using free yfinance/Polygon for backtest data (cheaper, no token usage) |
| `backtest/simulate.py` | unchanged | Strategy logic broker-agnostic |
| `memory/PROJECT-CONTEXT.md` | same | Update broker name + Canadian context |
| `memory/RISK-CONFIG.md` | same | Remove PDT references; add: USD positions in CAD account = FX exposure (note for awareness) |
| `scripts/health.sh` | same | Replace Alpaca account/clock checks with Questrade equivalents; add token-decrypt check |
| `HANDOFF.md` | same | Update sign-up steps |

### Toolchain additions

```bash
brew install sops age
age-keygen -o ~/.config/age/questrade-bot.key   # never commit, store backup in 1Password
# extract public key for sops config
```

### Sign-up sequence (replaces Alpaca section)

1. Create Questrade Practice Account: https://www.questrade.com/practice-account → register (Canadian SIN/address required for personal but Practice may not require funded real account — verify at signup)
2. Login → Account → API Centre → Generate device token → copy refresh_token (one-time, paste into local `.env` for bootstrap)
3. Note: live account NOT needed yet. Practice = $500k virtual default.
4. Run `bash scripts/questrade.sh init` locally to bootstrap encrypted-token file + commit

### Canadian-specific differences from PDF/Alpaca plan

| Difference | Impact |
|---|---|
| No PDT rule (FINRA-only) | Remove PDT check from pre-trade-gate; daytrade count irrelevant |
| Practice account in CAD by default | Bot strategy uses USD-listed (NVDA, AAPL, etc.); confirm Practice supports USD positions or add CAD-only universe variant |
| Settlement T+1 (since May 2024) | No impact — bot doesn't track settlement |
| Realtime US quotes may surcharge even in Practice (delayed = free) | Use 15-min delayed initially; live data = $4-30/mo if needed later |
| Trailing-stop offset format | Questrade uses absolute $ or %; existing strategy uses %, maps cleanly |
| Order TIF defaults differ | Default = Day; GTC supported (90 days max same as Alpaca) |
| Symbol lookup needed first | Must call /v1/symbols/search?prefix=NVDA to get symbolId before quotes/orders. Cache in `state/symbol-cache.json` |

### Verification (re-run after swap)

```bash
bash scripts/questrade.sh init                      # bootstrap encrypted token
bash scripts/health.sh                              # all green
bash scripts/questrade.sh account                   # equity ~$500k Practice
bash scripts/questrade.sh quote NVDA                # current quote
bash scripts/questrade.sh bars NVDA OneDay 30       # 30 days bars
bash scripts/questrade.sh order NVDA 1 buy market   # places test buy in Practice
bash scripts/questrade.sh positions                 # NVDA 1 share
bash scripts/questrade.sh close NVDA                # closes
```

If all green → swap done → re-run smoke test sequence (15 steps from Phase 1) with Questrade.

---

---

## Caveman Mode Persistence

This project runs in **caveman mode** (full intensity) for all sessions. Token budget tight; prose dies, technical content lives. Persistence mechanisms:

1. **Session-active now** — invoked via `Skill: caveman` already.
2. **Project-wide persistence** — `CLAUDE.md` will include caveman directive at top, auto-loaded every session in this repo.
3. **User-level fallback** — once we exit plan mode, optionally invoke `update-config` skill to add caveman mode to `~/.claude/settings.json` hooks so all sessions everywhere stay caveman.
4. **Caveman-commit + caveman-review skills** invoked at commit/review time — already available, will reference in CLAUDE.md.

Code blocks, commit messages, error output stay normal style (caveman safety guardrail). Only prose compresses.

---

## Architecture & Design Rationale

| Decision | Why |
|---|---|
| Bash wrappers, not Python | Universal, no deps, easy audit, ~50 LOC each |
| Markdown memory + git | Free versioning, diff, revert, audit trail, no DB |
| 5 routines not 1 | Failure isolation, clearer cron, smaller prompts |
| Stateless cloud runs | Self-healing — next run reconciles via Alpaca live state |
| Hard rules as gates | Discipline enforced programmatically, not by Claude judgment |
| Strategy in memory file | Versioned, revertable, modifiable without prompt edits |
| Append-only logs | Merge conflicts impossible, history immutable |

---

## Local Toolchain Audit (already verified)

| Tool | Status | Note |
|---|---|---|
| `bash 3.2.57` | ✓ | macOS default, scripts target this |
| `python3 3.14.4` | ✓ | wrappers use `python -c` for JSON |
| `jq 1.x` | ✓ | useful for parsing Alpaca responses |
| `git` | ✓ | homebrew |
| `curl` | ✓ | system |
| `gh` (GitHub CLI) | ✗ MISSING | install: `brew install gh` |
| `python` (no 3) | ✗ | wrappers call `python` not `python3` — **fix needed**: edit Appendix D wrapper to use `python3` |

**Toolchain action items before Phase 1**:
1. `brew install gh` then `gh auth login`
2. Edit `scripts/perplexity.sh` to use `python3` not `python` (single-char change)
3. Edit `scripts/clickup.sh` similarly

---

## Sign-Ups Required

Skip ClickUp (using file fallback first). Skip Telegram for now (defer to Phase 4 add-on).

| Service | Purpose | Cost | Action |
|---|---|---|---|
| Alpaca paper | Order placement + market data | $0 | `alpaca.markets` → dashboard top-left → Paper Trading → API Keys |
| Perplexity API | Research with citations | ~$0.40/mo at this volume | `perplexity.ai/settings/api` → key |
| GitHub | Repo hosting | $0 (private repo) | already have account |
| Claude GitHub App | Cloud routine clone+push | $0 | Phase 2 |
| Telegram bot | Notifications (Phase 4) | $0 | `@BotFather` → `/newbot` |

---

## Phase 0 — Safety Scaffolding (BEFORE writing any wrappers)

Build kill-switch infrastructure first. Cheaper to bake in than retrofit.

### Working dir rename

Path has space, breaks bash. Rename:
```
mv "/Users/ianmcadam/Documents/Claude/Trading bot" \
   /Users/ianmcadam/Documents/Claude/trading-bot
```

### State machine file

`state/state.yaml` (committed, human-editable):
```yaml
mode: active           # active | paused | exits_only | emergency_flatten
paused_reason: ""
paused_until: ""       # ISO 8601 or empty
manual_override: ""    # set to "BYPASS_KILL_SWITCH_${DATE}" to override once
last_human_review: 2026-04-25
notes: ""
```

Every routine reads first. If `mode != active`, exit early per skill (see below).

### Default branch protection

GitHub repo settings → Branches → add rule on `main`:
- Require PR + 1 review for direct push, OR
- Restrict who can push to: your account + Claude bot account

Belt-and-suspenders against the [open routines branch-push bug](https://github.com/anthropics/claude-code/issues/44949).

### `.gitignore`

```
.env
*.log
state/last_run.yaml
DAILY-SUMMARY.md          # local fallback for ClickUp; tail in repo too noisy
```

---

## Phase 1 — Local Build & Extended Smoke Test

Build everything locally. Test with `/portfolio`, `/pre-market`, `/market-open`, `/midday`, manual `/trade`. Don't touch cloud routines until local works flawlessly.

### File creation — paths relative to `trading-bot/`

| File | Source | Edits from PDF |
|---|---|---|
| `CLAUDE.md` | Appendix A | "LIVE ~$10,000" → "PAPER ~$100,000". Add caveman directive at top. Add kill-switch reminder |
| `env.template` | Appendix B | `ALPACA_ENDPOINT=https://paper-api.alpaca.markets/v2` |
| `.env` | copy of env.template, filled in | gitignored |
| `.gitignore` | per Phase 0 | |
| `scripts/alpaca.sh` | Appendix C | none |
| `scripts/perplexity.sh` | Appendix D | `python` → `python3` |
| `scripts/clickup.sh` | Appendix E | `python` → `python3` (script renames to `notify.sh` later in Phase 4) |
| `scripts/clock.sh` | NEW | Wraps Alpaca `/v2/clock` for `is_open` gating (see edge-case table) |
| `scripts/state.sh` | NEW | Reads/writes `state/state.yaml`, exposes `state.sh check` returning 0=active 1=paused 2=exits_only |
| `scripts/health.sh` | NEW | Runs all wrappers in `--dry` mode, reports green/red |
| `.claude/commands/portfolio.md` | Appendix G.1 | none |
| `.claude/commands/trade.md` | Appendix G.2 | Add kill-switch check at step 0 |
| `.claude/commands/pre-market.md` | mirror routines/pre-market.md minus env-check + push | |
| `.claude/commands/market-open.md` | same | |
| `.claude/commands/midday.md` | same | |
| `.claude/commands/daily-summary.md` | same | |
| `.claude/commands/weekly-review.md` | same | |
| `.claude/commands/pause.md` | NEW | Sets `state.yaml mode: paused` and commits |
| `.claude/commands/resume.md` | NEW | Sets `mode: active` and commits |
| `.claude/commands/flatten.md` | NEW | `alpaca.sh close-all` + `cancel-all` + log + commit. **Confirmation gated** |
| `.claude/commands/health.md` | NEW | Runs `scripts/health.sh` and prints summary |
| `routines/pre-market.md` | Appendix F.1 | + kill-switch check + state-aware behavior |
| `routines/market-open.md` | Appendix F.2 | + kill-switch + `clock.is_open` gate |
| `routines/midday.md` | Appendix F.3 | + kill-switch + clock gate |
| `routines/daily-summary.md` | Appendix F.4 | + always-runs even when paused (just logs) |
| `routines/weekly-review.md` | Appendix F.5 | + same |
| `routines/watchdog.md` | NEW (6th) | Reads `git log` since N hours, alerts if expected commits missing |
| `routines/README.md` | one-paragraph notes | |
| `memory/TRADING-STRATEGY.md` | Appendix H.1 | **Compressed to ~500-token cheat-sheet** + `STRATEGY-RATIONALE.md` for human-only prose |
| `memory/STRATEGY-RATIONALE.md` | NEW | Full prose explanation, never read by routines |
| `memory/TRADE-LOG.md` | Appendix H.2 | Day 0 snapshot $100k |
| `memory/RESEARCH-LOG.md` | Appendix H.3 | Add `LAST_QUERY` + freshness header for cache check |
| `memory/WEEKLY-REVIEW.md` | Appendix H.4 | none |
| `memory/PROJECT-CONTEXT.md` | Appendix H.5 | Paper, $100k |
| `memory/RISK-CONFIG.md` | NEW | Encodes circuit-breaker thresholds (see Risk Controls below) |
| `.claude/skills/kill-switch-check/SKILL.md` | custom | per Custom Skills section |
| `.claude/skills/pre-trade-gate/SKILL.md` | custom | |
| `.claude/skills/order-rejection-triage/SKILL.md` | custom | |
| `.claude/skills/trade-log-entry/SKILL.md` | custom | |
| `.claude/skills/routine-failure-triage/SKILL.md` | custom | |
| `.claude/skills/daily-summary-message/SKILL.md` | custom | |
| `.claude/skills/performance-metrics/SKILL.md` | custom | |
| `README.md` | human-facing quickstart | |

### Strategy doc compression (token win)

Replace prose `TRADING-STRATEGY.md` with structured cheat-sheet:

```markdown
# Strategy

## Mode: swing-trade-stocks-only

## Limits
| Rule | Value |
|---|---|
| Max positions | 6 |
| Max % per position | 20% |
| Max new trades/week | 3 |
| Capital deployed target | 75-85% |
| Trailing stop default | 10% GTC |
| Hard cut loss | -7% |
| Tighten trail at +15% | 7% |
| Tighten trail at +20% | 5% |
| Min trail distance from price | 3% |
| Sector failure exit | 2 consec losses |

## Forbidden
- Options, ever
- Moving stop down
- Trading without documented catalyst

## Decision Tree
catalyst? + sector momentum? + R:R ≥ 2:1? + gate-pass? → BUY
else → HOLD (default)

## Risk Modes (read RISK-CONFIG.md)
- active: full sizing
- reduced: 10% max position, 1 new/week (drawdown ≥8%)
- exits_only: no new entries (drawdown ≥12%, VIX>30, or paused)
- emergency_flatten: close all, no new
```

Saves ~1.5k tokens × 5 routines = ~7.5k tokens/day.

### Smoke-test sequence

1. `cd /Users/ianmcadam/Documents/Claude/trading-bot && claude` → verify CLAUDE.md auto-loads, caveman active
2. `bash scripts/health.sh` → all wrappers green
3. `/portfolio` → equity ~$100k, no positions, daytrade=0, clean output
4. `/pause` → state.yaml mode=paused, commit
5. `/portfolio` → still works (read-only)
6. `/trade SPY 1 buy` → refuses (kill-switch active)
7. `/resume` → state.yaml mode=active, commit
8. `/pre-market` (during weekday morning) → research log entry written, ≥7 Perplexity queries fired
9. `/market-open` (during 8:30am-3pm CT) → no-op if research says HOLD, else places trade + trailing stop. Verify in Alpaca dashboard
10. `/trade SPY 1 buy` (manually) → buy + immediate trailing stop, log entry written
11. `/midday` → reads positions, no-op or stop-tighten, depending on P&L
12. `/daily-summary` → EOD snapshot appended, fallback file `DAILY-SUMMARY.md` created
13. `/weekly-review` (any day, will scold you that it's not Friday but should run) → review template appended
14. `/flatten` → confirmation gated, closes all + cancel-all
15. Push to fresh private GitHub repo `trading-bot`

If all 15 pass → Phase 1 done. Don't proceed to cloud until then.

---

## Phase 2 — Cloud Routines Deployment

### One-time prereqs

1. `brew install gh && gh auth login` (already noted)
2. Install Claude Code GitHub App on `trading-bot` repo only — least privilege. Run `/install-github-app` inside Claude Code or visit install URL
3. Verify `gh repo view <user>/trading-bot` works
4. GitHub branch protection rule on `main` (Phase 0)

### Per-routine setup checklist (use built-in `/schedule` skill)

For each of 6 routines (5 trading + 1 watchdog):

| Field | Value |
|---|---|
| Name | "Trading bot — \<phase\>" |
| Repo | `<user>/trading-bot` |
| Branch | `main` |
| Env vars | `ALPACA_API_KEY`, `ALPACA_SECRET_KEY`, `ALPACA_ENDPOINT=https://paper-api.alpaca.markets/v2`, `ALPACA_DATA_ENDPOINT=https://data.alpaca.markets/v2`, `PERPLEXITY_API_KEY`, `PERPLEXITY_MODEL=sonar`. **Skip** ClickUp vars |
| **Allow unrestricted branch pushes** | **ON** (critical) |
| Cron | per table below, timezone America/Chicago |
| Model | per table below (cost optimization) |
| Prompt | paste corresponding `routines/*.md` verbatim |

### Routine schedule + model assignment

| Routine | Cron (CT) | Model | Cost rationale |
|---|---|---|---|
| pre-market | `0 6 * * 1-5` | **Opus 4.7** | Deep research, novel decisions |
| market-open | `30 8 * * 1-5` | **Sonnet 4.6** | Execute pre-decided plan, lower reasoning need |
| midday | `0 12 * * 1-5` | **Sonnet 4.6** | Thesis-check + stop tighten — moderate reasoning |
| daily-summary | `0 15 * * 1-5` | **Haiku 4.5** | Format existing data, no decision |
| weekly-review | `0 16 * * 5` | **Opus 4.7** | Strategy reflection, letter grade |
| watchdog | `0 17 * * 1-5` | **Haiku 4.5** | Read git log, alert if missing |

Mixed-model monthly cost estimate: **$10-12/mo Claude tokens** (within Max plan; only matters if you hit overage).

### Watchdog routine prompt (NEW, not in PDF)

```
You are the watchdog routine for trading-bot. Today's date: DATE=$(date +%Y-%m-%d).

ENV: only ALPACA_API_KEY+SECRET, no Perplexity or ClickUp needed.
Persistence: read-only on memory; commit only logs/incidents/<date>.md if findings.

STEP 1 — Expected commit list for today (Mon-Thu):
- pre-market research $DATE
- daily EOD snapshot $DATE
- market-open trades $DATE  (only if a trade fired)
- midday scan $DATE  (only if action taken)

STEP 2 — Inspect:
  git log --since="$(date -d '24 hours ago' --iso) " --pretty=format:"%h %s"

STEP 3 — Classify each missing expected commit:
  - pre-market or daily-summary missing → ALERT (mandatory commits)
  - market-open or midday missing → OK (only commit if action)

STEP 4 — Reconcile Alpaca live state vs latest TRADE-LOG:
  bash scripts/alpaca.sh positions
  Compare to last EOD snapshot. Drift > $10 = INCIDENT.

STEP 5 — On any ALERT or INCIDENT:
  Append to logs/incidents/$DATE.md (create dir if needed).
  Commit and push.
  bash scripts/notify.sh "WATCHDOG: <one line>"

STEP 6 — Else: silent exit, no commit.
```

### Phase 2 verification

- "Run now" pre-market → commit appears, RESEARCH-LOG entry, no `.env` created
- "Run now" daily-summary on weekday afternoon → TRADE-LOG snapshot, fallback file written
- "Run now" watchdog → reads recent commits, no-op if all green
- DST-transition first weekend after Phase 2 → manually verify cron fired at correct wall-clock time. Documented as unknown per Routines research

---

## Phase 3 — First-Week Monitoring Protocol

| Day | Action |
|---|---|
| Mon | Read every commit. Verify EOD snapshot math: yesterday equity = today starting |
| Tue | Same. Notice routine timing drift (stagger ~few min ok per docs) |
| Wed | Read commits + scan for any "fallback" logs (Perplexity 3-exit, ClickUp file fallback) |
| Thu | Same; check `git log` for at least one watchdog commit (silent if all good) |
| Fri | Read full weekly review. Check letter grade, "what didn't work" — first signal of strategy weakness |
| Sat | Read commits from Mon-Fri end-to-end as a story. Adjust prompts only if something cosmetic broke; never adjust strategy mid-week |

---

## Phase 4 — Optional Enhancements (after Week 2)

| Enhancement | Trigger | Effort |
|---|---|---|
| Telegram notifications | Tired of `cat DAILY-SUMMARY.md` | 10 min: BotFather → 5-line `notify.sh` → set 2 env vars per routine |
| Performance dashboard | Want visualization | Use `data:build-dashboard` skill weekly. HTML in repo, view via GitHub Pages |
| Backtest harness | Want strategy confidence | Pull Alpaca historical bars, run buy-side gate against past 6 months. Use `data:analyze` skill |
| Risk-mode automation | Want auto-derisking | Wrapper `state.sh` computes month-DD%, flips state to `reduced` if ≥-8%, `exits_only` if ≥-12% |
| Slack-as-input | Want to override mid-day | Add Slack MCP connector to routines, watchdog reads channel for `PAUSE` keyword |
| Custom MCP server | Want trading-domain primitives | Build `trading-bot-mcp` exposing `get_position(sym)`, `place_trade(json)`, etc. — collapses 3 wrappers into 1 connector |
| Confidence score | Want graduation metric | Each trade gets 0-100 from Claude. Track win rate by score bucket |

---

## Risk Controls Beyond PDF Strategy

Add now (cheap):
1. **Kill switch** — `state.yaml` flippable any time. Highest ROI, zero downside
2. **Account circuit breaker** — daily P&L ≤-5% OR drawdown from peak ≥-15% → flip to `exits_only`. Rule lives in `RISK-CONFIG.md`, enforced by `pre-trade-gate` skill
3. **Sector concentration** — max 40% in any GICS sector. Codified in pre-trade-gate
4. **VIX filter** — if VIX > 30 at open, no new entries. Wrapper fetches VIX, injects into prompt
5. **Drawdown sizing** — month-DD ≥-8% → 10% max position + 1 new trade/week. Auto via `state.sh`

Skip:
- NYSE level 1/2/3 breakers (your -5% daily catches it)
- Earnings/FOMC/CPI blackouts (over-engineering for paper)

---

## Edge Case Handling (from Alpaca research)

| Edge case | Behavior | Bot handling |
|---|---|---|
| Market holiday | Cron fires; orders queue at `accepted` until next open | `clock.sh` gate first; if !is_open exit-with-log |
| Half-day | Same — clock reports correct close time | Same |
| Halted stock | Orders may be `accepted` then `rejected` async | Trade-update poll for 60s post-fill, escalate via `order-rejection-triage` skill |
| Partial fill (rare on paper) | `partially_filled` → `filled` over time | Wait `status==filled` before placing trailing stop |
| GTC ages out at 90d | Auto-cancelled by Alpaca | Watchdog reconciles; re-place if position still open |
| Fractional shares | Supported but no GTC trailing stop | Strategy bot uses whole shares only, sidesteps |
| Extended hours | Market orders rejected outside RTH | Bot only places day-TIF during RTH; clock gate enforces |
| Stock split | Qty/avg adjust automatically; trailing stop discretionary | Watchdog detects qty change vs TRADE-LOG; cancels + re-places stop |
| Quote ap=0 / bp=0 | Halted or stale | Wrapper rejects: spread check fails → skip ticker |
| Wash-trade rejection | HTTP 403 on same-symbol opposite-side | Triage skill: bracket/OCO/trailing-stop are exempted, switch order type |
| PDT at $100k | Flag inactive, but DTBP still tracked (4× margin) | Buy-side gate checks DTBP, not just cash |
| Paper account reset | Invalidates API keys | If 401 → notify, halt all routines, require human re-onboard |
| Account status not ACTIVE | Trading blocked | Pre-trade gate reads `account.status`, exits if !ACTIVE |
| `trading_blocked: true` | Even with status ACTIVE | Same gate |

---

## Failure Mode Analysis (from Routines research)

| Failure | Detection | Response |
|---|---|---|
| Routine missed scheduled run | Watchdog routine sees missing commit | Append incident, alert |
| Push fails (branch protection) | Routine prompt's rebase loop catches | Rebase + retry once; on second fail, alert |
| Concurrent push race | `claude/*` branches don't apply (we use main) | Rebase loop |
| Token quota exhausted | Run errors out at API level | Watchdog sees missing commit, alerts |
| `.env` accidentally created | Pre-commit hook + `.gitignore` | Hook (Phase 4 add) blocks; `.gitignore` last-line defense |
| Perplexity API down | Wrapper exits 3 | Fall back to native WebSearch, flag in log |
| Alpaca 5xx | Wrapper exits non-zero | Routine retries with backoff; if persistent, alert |
| Alpaca 401 (key invalidated) | Wrapper exits 1 | Routine alerts, halts (don't loop on auth fail) |
| Strategy update breaks prompts | Smoke test catches | Always test with `/pre-market` locally before pushing strategy edits |
| DST transition drift | Manual verify weekend after | If wrong, edit cron via `/schedule update` |
| Anthropic outage | Routine fails at session start | Watchdog alerts; bot self-heals next tick |
| GitHub outage | Push fails | Same |
| Identity bleed-through (commits as you) | Inherent to Routines | Acceptable; document in PROJECT-CONTEXT |
| Force-push history rewrite | Possible per [issue #32476](https://github.com/anthropics/claude-code/issues/32476) | GitHub branch protection blocks force-push |

---

## Notification: Telegram (Phase 4 add)

When file fallback gets old (~Week 2):

```bash
# scripts/notify.sh (replaces clickup.sh)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
[[ -f "$ROOT/.env" ]] && { set -a; source "$ROOT/.env"; set +a; }
msg="${1:-$(cat)}"
[[ -z "$msg" ]] && { echo "usage: notify.sh <msg>"; exit 1; }
if [[ -z "${TG_TOKEN:-}" || -z "${TG_CHAT_ID:-}" ]]; then
  printf "\n---\n## %s (fallback)\n%s\n" "$(date)" "$msg" >> "$ROOT/DAILY-SUMMARY.md"
  exit 0
fi
curl -fsS -X POST "https://api.telegram.org/bot$TG_TOKEN/sendMessage" \
  -d "chat_id=$TG_CHAT_ID" --data-urlencode "text=$msg"
```

Setup: `@BotFather` → `/newbot` → token. Message bot once. Fetch chat_id: `curl https://api.telegram.org/bot$TOKEN/getUpdates | jq '.result[0].message.chat.id'`. Add `TG_TOKEN` + `TG_CHAT_ID` to routine env vars.

Telegram beats Discord (better iOS push), Pushover ($5 + no scrollback), ntfy (privacy on shared topics), email (spam folder), Slack (more setup, weaker push).

---

## Custom Skills to Build into `.claude/skills/`

Repo-level skills load in cloud routines. User-level (`~/.claude/skills/`) do NOT load. So all 7 below live in repo.

| Skill | Trigger phrase (frontmatter) | Job |
|---|---|---|
| `kill-switch-check` | "before any routine that touches money" | Reads state.yaml, exits cleanly if paused |
| `pre-trade-gate` | "evaluating whether to place a buy" | Runs all 7 buy-side checks + sector cap + VIX + circuit-breaker |
| `order-rejection-triage` | "Alpaca order rejected/expired" | Decision tree: retry/escalate/abandon |
| `trade-log-entry` | "appending fill or exit to TRADE-LOG" | Schema, formatting, dedup-by-order-id |
| `routine-failure-triage` | "routine errored, timed out, or no commit" | Diagnosis + retry policy + incident log |
| `daily-summary-message` | "generating EOD chat notification" | Template, tone rules, char limit |
| `performance-metrics` | "computing weekly/monthly perf stats" | Sharpe, Sortino, max DD, profit factor formulas |

These reduce per-routine prompt length AND keep logic auditable as code, not improvised by Claude each run.

---

## Token & Cost Budget

| Component | Monthly cost |
|---|---|
| Claude tokens (mixed model) | ~$10-12 (drawn from Max plan, no overage at this volume) |
| Routine runtime ($0.08/hr) | ~$2-3 |
| Perplexity API | ~$0.40 |
| Alpaca paper | $0 |
| GitHub private repo | $0 |
| Telegram | $0 |
| **Total external** | **<$5/mo** on top of Max plan |

Caching is moot (TTL 5min, routines fire 2-3hr apart). Token wins come from: model mix, strategy-doc compression, memory tail bounds (`tail -n 100` TRADE, `tail -n 50` RESEARCH), Perplexity freshness check.

---

## Recommended Skills + Plugins (built-in to your Claude Code)

Use these throughout the build:

| Skill | When |
|---|---|
| `caveman` (active) | All sessions, this project |
| `caveman-commit` | Commits |
| `caveman-review` | PR / diff review |
| `simplify` | After writing wrappers, prune |
| `engineering:code-review` | Before first cloud deploy, audit wrappers + prompts |
| `engineering:debug` | When a routine fails |
| `engineering:incident-response` | If bot blows up significantly |
| `engineering:runbook` | Document operational procedures (pause/resume/flatten) |
| `engineering:testing-strategy` | Designing the smoke test before Phase 1 |
| `init` | Generate starter CLAUDE.md (alternative to PDF Appendix A) |
| `loop` | Periodic local checks during business hours if curious |
| `schedule` | Create/update cloud routines |
| `update-config` | If you want caveman in `~/.claude/settings.json` |
| `data:build-dashboard` | Phase 4 P&L dashboard |
| `data:create-viz` | Weekly P&L charts |
| `data:statistical-analysis` | Sharpe/Sortino, regime detection |
| `data:analyze` | "Why did the bot lose this week?" investigation |
| `engineering:tech-debt` | Quarterly cleanup |
| `security-review` | Before adding any new wrapper or connector |
| `productivity:task-management` | Optional, for follow-ups list |

---

## MCP Connectors Worth Adding Later

| Connector | Why | When |
|---|---|---|
| Slack | Richer alerts than Telegram, channel scrollback for team | Phase 4 if Telegram too noisy |
| Notion | Long-form decision log, post-mortems | Anytime |
| GitHub MCP | Watchdog reads issues, opens incident PRs | Phase 4 if you want auto-incident-PRs |
| Linear | Ticket every incident | Overkill for solo project, skip |
| Calendar | Mark trades on calendar for review | Cute but skip |
| Computer-use | Screenshot Alpaca dashboard for sanity checks | Local-only, debugging aid |
| `mcp__9a04470a-c5be-420d-a32b-adaaa7f50b13__web_search_exa` | Alternative to Perplexity if you want a second source | Optional |

NOT useful for this project: hotels, accommodations, kayak (a9d78666...), Apify, Chrome browser tools.

---

## Critical Gotchas (memorize)

1. **Paper endpoint** `https://paper-api.alpaca.markets/v2` — NOT live URL in PDF Appendices B/C
2. **Rename working dir**, no spaces
3. **Never commit `.env`**
4. **Cloud routines: env vars on routine, NOT in `.env`** — prompts contain "do not create .env" guard, paste verbatim
5. **"Allow unrestricted branch pushes" ON** + GitHub branch protection rule = belt and suspenders
6. **Paste routine prompts verbatim** — env-check and commit-and-push blocks load-bearing
7. **PDT inactive at $100k**, but DTBP tracking still applies on margin paper account
8. **Trailing stops only during RTH** — overnight gaps blow through
9. **GTC ages out at 90 days** — watchdog reconciles
10. **DST drift undocumented** — verify after first transition
11. **Cron min interval = 1hr** — your schedules safe
12. **Repo-level skills only** — user-level `~/.claude/skills/` doesn't load in cloud routines
13. **Identity bleed-through** — routine commits show as you on GitHub
14. **`python3` not `python`** — fix wrappers before Phase 1
15. **`gh` CLI not installed** — `brew install gh`

---

## Verification Matrix

After Phase 2 first run of all 6 routines:

```bash
cd ~/Documents/Claude/trading-bot && git pull
git log origin/main --oneline -20
ls -la memory/ logs/incidents/ 2>/dev/null
cat state/state.yaml
```

Expect:
- ≥5 fresh commits with timestamps after routine "Run now"
- All 5 memory files present and growing
- `state.yaml` mode=active
- No `.env` in repo (`git ls-files | grep -v env.template | grep .env` empty)
- No accidental skill files at user level (`ls ~/.claude/skills/ | grep trading` empty)

After Week 1:
- Watchdog produced 0 incident files (or all with minor reconciliation, no actual failures)
- Daily-summary file fallback (`DAILY-SUMMARY.md`) has 5 weekday entries
- TRADE-LOG has 5 EOD snapshots
- Letter grade in WEEKLY-REVIEW.md present

---

## Critical Files (highest blast radius — read carefully when implementing)

| File | Why critical |
|---|---|
| `scripts/alpaca.sh` | Touches money. Verify paper endpoint before any test |
| `routines/market-open.md` | Only routine placing buy orders. Buy-side gate = safety net |
| `routines/midday.md` | Only routine closing positions. Verify -7% threshold logic |
| `state/state.yaml` | Kill switch. Test `paused` mode before going to cloud |
| `CLAUDE.md` | Auto-loaded every session. "No options ever" hard rule lives here |
| `memory/RISK-CONFIG.md` | Circuit breakers + sizing rules. Read by pre-trade-gate skill |
| `.claude/skills/pre-trade-gate/SKILL.md` | The 7-check buy validator. Highest-stakes logic |
| `.claude/skills/order-rejection-triage/SKILL.md` | Prevents retry-storms on wash sales etc. |

---

## Open Data Needed at Execution Time

- Alpaca paper API key + secret
- Perplexity API key
- GitHub repo name (default: `trading-bot`)
- Telegram BotFather token + chat_id (Phase 4 only)

Paste **only** into local `.env` or directly into routine env-var settings. Never into committed files.

---

## Implementation Order

1. **Phase 0**: rename dir, install `gh`, scaffold `.gitignore` + `state/state.yaml` + GitHub repo + branch protection — ✅ DONE
2. **Phase 1**: write all files per table above. Run 15-step smoke test. First commit — ✅ DONE (`cef6bc2 init: trading-bot scaffolding`, 48 files)
3. **Phase 2**: GitHub remote + cloud routines — 🔄 IN PROGRESS
4. **Week 1**: monitor every commit
5. **Phase 4 (Week 2+)**: Telegram, dashboard, optional skills as needed

Total estimated build time: 4-6 hours focused work for Phase 0-2; Week 1 monitoring is 15 min/day.

---

## Current State (2026-04-25 — post-Questrade-pivot) — WHERE WE ARE

### ✅ Done
- Working dir: `/Users/ianmcadam/Documents/Claude/trading-bot/`
- `gh` CLI installed + authed as `barsnbolts`
- Git config: `BARSNBOLTS <BARSNBOLTS@users.noreply.github.com>`
- 49 files committed locally + pushed to https://github.com/barsnbolts/trading-bot (private)
  - `cef6bc2` init: trading-bot scaffolding (48 files)
  - `eb79a97` docs: model selection guide in CLAUDE.md
- All bash scripts + python entry point `chmod +x`
- `.gitignore`: excludes `.env`, `*.log`, `state/last_run.yaml` (DAILY-SUMMARY.md committed, dual-path notify fix)
- 8 skills present (incl. `earnings-decision` for adaptive per-position earnings logic)
- Branch protection: skipped (needs GitHub Pro for private repo); covered by other safety layers

### ❌ Blocker → resolved by pivot
- Alpaca account creation blocked (Canadian residency)
- All Alpaca-touching files (12 files) need rewrite per Phase 1.5 table above

### 🔄 Immediate next steps (execute in order, post-pivot)

**Step 1 — User-side prerequisites**
- Sign up Questrade Practice Account: https://www.questrade.com/practice-account
- Generate refresh_token: Account → API Centre → Generate Device Token → copy
- Sign up Perplexity API: https://perplexity.ai/settings/api → copy key
- Confirm in chat: "got both keys"

**Step 2 — Toolchain bump**
```bash
brew install sops age
mkdir -p ~/.config/age
age-keygen -o ~/.config/age/questrade-bot.key
# Capture public key for sops config; store private key backup in 1Password
```

**Step 3 — Wrapper rewrite (mechanical, switch to Sonnet 4.6 medium)**
Order of files to rewrite:
1. `scripts/questrade-token.sh` (NEW — sops/age helper)
2. `scripts/questrade.sh` (replaces alpaca.sh)
3. `scripts/health.sh` (swap Alpaca checks)
4. `env.template` (swap vars)
5. `routines/*.md` (6 files — mechanical s/alpaca.sh/questrade.sh/g + Canadian adjustments)
6. `.claude/commands/*.md` (4 files — same)
7. `.claude/skills/pre-trade-gate/SKILL.md` (remove PDT, add USD-currency check)
8. `.claude/skills/order-rejection-triage/SKILL.md` (Questrade rejection codes)
9. `CLAUDE.md` + `memory/PROJECT-CONTEXT.md` + `memory/RISK-CONFIG.md` (text swaps)
10. `HANDOFF.md` (update sign-up steps)

**Step 4 — Bootstrap token**
```bash
cp env.template .env
# Edit .env: paste QUESTRADE_REFRESH_TOKEN, QUESTRADE_AGE_KEY, PERPLEXITY_API_KEY
bash scripts/questrade.sh init     # encrypts token, commits state/questrade-token.enc
```

**Step 5 — Smoke test**
```bash
bash scripts/health.sh             # all PASS
bash scripts/questrade.sh account  # ~$500k Practice equity
bash scripts/questrade.sh quote NVDA
```

**Step 6 — Backtest before cloud deploy**
```bash
bash backtest/run-backtest.sh 90
# Review backtest/results/YYYYMMDD-HHMMSS.md
```

**Step 7 — Install Claude Code GitHub App**
`/install-github-app` → grant access to barsnbolts/trading-bot only.

**Step 8 — Phase 2 cloud routines**
Per routine (6): claude.ai/code/routines → fill per table → env vars now include `QUESTRADE_REFRESH_TOKEN`, `QUESTRADE_API_SERVER`, `QUESTRADE_ACCOUNT_ID`, `QUESTRADE_AGE_KEY`, `PERPLEXITY_API_KEY` → "Allow unrestricted branch pushes" ON → paste routine prompt verbatim → Run now → verify commit + token rotation.

### Critical path estimate
- Toolchain + Questrade signup: 30 min user-side
- Wrapper rewrite + tests: 2-3 hr (Sonnet 4.6 medium)
- Smoke test + first cloud routine deploy: 1 hr
- Total post-pivot to live paper bot: ~4 hr
