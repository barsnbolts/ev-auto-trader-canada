# Session Handoff — Trading Bot (2026-04-28)

## Context

The previous session's chat history contains a Telegram bot token leaked in plain text. Operator wants to delete that session. This file is the **paste-ready handoff prompt** for a fresh session, plus my honest take on the "did I over-optimize?" question, the agent strategy, the architectural risks I haven't audited, and a debug checklist.

**Workflow:**
1. Operator opens a NEW Claude Code session.
2. Operator pastes the block between `===PASTE-START===` and `===PASTE-END===` below.
3. Operator deletes the old (leaked-token) session.
4. New session executes the audit.

---

## ===PASTE-START===

You are taking over a deployed autonomous trading bot at v1.0-paper. Previous session is being deleted because a Telegram bot token was leaked into its chat history. Treat this as fresh-eyes review with full context. You have complete control. Operator has handed you the wheel.

### Repo + state
- Local: `/Users/ianmcadam/Documents/Claude/trading-bot`
- GitHub: `barsnbolts/trading-bot` (default branch: `main`)
- HEAD: commit `598538f` ("fix: routine pushes use HEAD:main + add CI + cleanup")
- Phase: paper-mode (BROKER=sim), Yahoo Finance live data, ~$100k notional, stocks only
- 6 cloud routines wired at claude.ai/code/routines: `daily-summary`, `pre-market`, `market-open`, `midday`, `weekly-review`, `watchdog`
- BARSNBOLTS env populated with TG_TOKEN (LEAKED — MUST revoke), TG_CHAT_ID, BROKER=sim
- CI: `.github/workflows/ci.yml` runs 6 static gates on every push/PR

### CRITICAL first action — security
1. Operator: Telegram → @BotFather → `/revoke` → select `@barsnbolts_trading_bot` → confirm. Get new token.
2. Operator: paste new token into BARSNBOLTS env at claude.ai/code (click `Default` chip in any new session → click ⓘ next to BARSNBOLTS → replace TG_TOKEN value → Save changes).
3. Trigger any routine's Run Now → expect Telegram heartbeat in 60–90s.
4. Operator deletes the leaked session.

You (the assistant) MUST NOT write tokens, API keys, passwords, or chat IDs into any file in the repo. Do not echo credentials in chat.

### Your mandate this session

Audit the entire build. Operator's hypothesis: "I over-optimized and it caused more problems than it solved." Test the hypothesis — don't just confirm it. Pre-audit said the `.claude/` customization layer is lean (16 skills + 11 commands all load-bearing); the real bloat is likely operational habits + platform friction. Verify or refute.

**Audit scope** (priority-ordered):
1. **Operational friction** — permission gates, TodoWrite reminders, compaction frequency, OAuth scopes, token budget patterns, agent dispatch overhead.
2. **Session-branch fix verification** — confirm `git push origin HEAD:main` works on scheduled cron, not just Run Now. Monday 7am EDT pre-market = first real test.
3. **CI green** — `gh run list --limit 5`. If failed, read logs + fix.
4. **Routine prompts** — scan `routines/*.md` for stale sections, dead branches, over-engineered conditionals.
5. **Skills + commands audit** — invoke `skill-self-audit`. Retire anything not invoked in 30 days.
6. **Cloud connectors** — 9 default connectors auto-attach to every routine (Booking, Exa, Gmail, GoogleCal, GoogleDrive, Notion, TripAdvisor, Uber, Viator). Routines never use them. Real attack surface. Remove from each via claude.ai/code → routine edit → Connectors tab → × each.
7. **Memory files** — rotation policy or unbounded growth?
8. **BOT_CAPABILITY_TIER** — pulling weight or cosmetic?
9. **Architectural risks (NEW — operator hasn't audited)**:
   - **No off-repo backup.** Force-push or corruption = total loss. Recommend GitHub repo backup (e.g., periodic mirror to a second remote, or a GitHub Action that exports memory/ to a release artifact weekly).
   - **Single point of failure: claude.ai/code/routines.** If Anthropic has an outage, all 6 routines silent AND watchdog (which would alert) is also down. Recommend external uptime-checker — a free GitHub Action on a daily schedule that fails if it can't see today's expected commits.
   - **Yahoo Finance is unofficial.** No SLA, can rate-limit. Recommend fallback price source documented (Polygon free tier? Alpha Vantage free key?).
   - **DST drift.** Routines scheduled in EDT. November DST flip — do they still fire at the right Central Time? Verify and document.
   - **Strategy-rejection not sticky.** `/reject v3` closes the PR but the same proposal can recur next week, recurrence=2, auto-merge. Recommend `logs/strategy-rejections.md` is read by `weekly-review` step 5 to skip already-rejected proposals.
   - **Market holidays.** Watchdog at 6PM checks for missing `pre-market research $DATE` — does it know Thanksgiving / July 4 / Christmas / good Friday? Verify exit logic in routines and exclusion in watchdog.
   - **Prompt-injection via news.** Routines read news; news contains instructions; routines have repo write access. Mitigation gap. Recommend: research-only routines (pre-market, midday) cannot write to `routines/` or `.claude/` — only `memory/RESEARCH-LOG.md` + `state/`. Add CI gate.

### Operating rules (every turn)

1. **End every round with: "Yes or no — ask more questions before proceeding?"** Non-negotiable.
2. **Stay on Opus 4.7 high.** Drop the 1M context — only request back if you hit a genuinely reasoning-heavy redesign.
3. **Never paste credentials in chat.** If operator pastes one, use transiently and warn them to revoke.
4. **Token budget awareness** — if operator signals low budget: ultra-compact mode, one tool call per turn, no preamble, no recap.
5. **Default to platform defaults.** Trust permission gates, trust the model's reasoning, don't pile rules on rules.
6. **Plan mode first.** Read enough to have an opinion before editing.
7. **No auto-mode by default.** Operator opts in explicitly when they want it.

### Agent strategy (use from turn 1)

**Default to subagents for any task >3 tool calls of work.** They keep main-thread context small and run cheaper models in parallel.

**Model selection by task type:**
- **Haiku 4.5** → mechanical: list files, grep patterns, count occurrences, check-X-pattern, last-modified inventory
- **Sonnet 4.6** → comprehension: read files + summarize, flag concerns, multi-file reasoning
- **Opus 4.7 (main thread only)** → synthesis, architectural calls, commit decisions

**Dispatch checklist (use BEFORE each subagent call):**
- [ ] Self-contained? (Stranger could do it cold)
- [ ] Output schema specified? (Markdown table? Bullet list? Schema?)
- [ ] Length cap? ("Under 200 words")
- [ ] What NOT to do? ("Don't recap your search")
- [ ] Stop condition? ("If pattern X, stop and report")
- [ ] Right agent type? (Explore = read-only, Plan = architecture, general = full tools)
- [ ] Cite-evidence requirement? (`file:line` for findings — stops confident-wrong)

**Parallel sweet spot: 3-5 agents in one message.** Beyond that = synthesis fatigue.

**Map-Reduce pattern (recommended for the audit):**
- Phase 1: 4 parallel Map agents (Haiku/Sonnet) each examine a slice
- Phase 2 (main thread Opus): synthesize findings, identify gaps
- Phase 3: 1-2 sequential Reduce agents (Sonnet) deep-dive on gaps with synthesized context

**Suggested first turn (after reading this file):**

| # | Model | Agent type | Task |
|---|---|---|---|
| 1 | Haiku | Explore | Inventory `.claude/skills/` — name, last-modified, trigger phrase. Output: markdown table. <200 words. |
| 2 | Haiku | Explore | Grep `routines/`, `.claude/`, `scripts/` for stale `git push origin main` (regression check) + dead conditionals. Cite file:line. |
| 3 | Sonnet | Explore | Read 6 routine prompts; flag over-engineered conditionals + sections that don't fire under BROKER=sim. Cite file:line. <300 words. |
| 4 | Sonnet | Explore | Audit `.github/workflows/ci.yml` + `scripts/check-secrets.sh`. Verify gates match documented intent + run smoke against current repo state. <250 words. |

Then synthesize in main thread, propose cleanup, **end with "Yes or no — ask more questions before I start the cleanup?"**

**Verifier pattern (use after any safety-critical change):** spin up a fresh-eyes Explore agent with no conversation history; have it review the change. Costs one extra agent run; catches main-thread bias.

### Background context (read these first)

- `routines/*.md` — 6 cloud routine prompts
- `memory/TRADING-STRATEGY.md` — strategy doc (edited only via `strategy-proposals/v$N` branch + PR, never directly)
- `memory/RISK-CONFIG.md` — sizing + stop rules
- `state/state.yaml` — kill switch modes: `active | paused | exits_only | reduced | emergency_flatten`
- `.claude/skills/*/SKILL.md` — 16 skills
- `.claude/commands/*.md` — 11 slash commands
- `.github/workflows/ci.yml` — 6 CI gates
- `scripts/check-secrets.sh` — pre-commit hook + history scanner

### Pending operator actions (track)

- [ ] Revoke + replace TG_TOKEN
- [ ] Delete leaked-token session (after pasting this prompt)
- [ ] Verify CI green on 598538f
- [ ] Monday 7am EDT pre-market — first real scheduled cron run

### What NOT to do

- Don't strip routine prompts — they ARE the bot
- Don't remove kill switch / state.yaml — load-bearing safety
- Don't add new skills/commands unless removing two — direction is bloat-down
- Don't push directly to main without operator approval
- Don't flip BROKER=ibkr — paper mode locked until operator explicit
- Don't create `.env` files — env vars only via cloud routine BARSNBOLTS profile

### First-turn deliverable

Read this file, dispatch the 4 parallel agents above, synthesize findings, present audit + recommendations in plan mode. Cite file:line for every claim. End with: **"Yes or no — ask more questions before I start the cleanup?"**

## ===PASTE-END===

---

## My honest take on "did I over-optimize?" (operator's question)

**Short answer: No, the codebase isn't over-optimized. Your operating habits were.**

### What ISN'T bloat (don't touch)
- `.claude/skills/` (16) — all load-bearing per pre-audit. `pre-trade-gate`, `kill-switch-check`, `crisis-judgment`, `earnings-decision`, `gap-handler` are the bot's safety rails.
- `.claude/commands/` (11) — local mirrors of cloud routines + emergency commands (`flatten`, `pause`, `resume`).
- `BOT_CAPABILITY_TIER` — minimal, toggles research budget (3/7/12). Not branch bloat.
- Git-as-memory architecture — necessary because cloud routines clone fresh each run.
- CI gates, pre-commit secret scanner, state.yaml — all earning their keep.

### What IS bloat
- **9 default cloud connectors per routine** (Booking, Exa, Gmail, etc.) — never invoked, real prompt-injection surface. Remove.
- **Three considered env profiles** (`BARSNBOLTS-light/standard/premium`) — wisely abandoned. Keep one.
- **Old `Backup Research` Custom GPT** — flagged for delete, never done.

### Operational habits that drained tokens (the real over-optimization)
- **Auto mode by default** — burns tokens; keeps you in motion when stopping would be cheaper.
- **Multiple subagent spawns per session** without strategy — Explore + Plan + Fix-up agents stack.
- **1M context window** when 200k would do — 5x context = 5x cost on each cache miss.
- **Multiple compactions per session** — each loses fidelity.
- **Run Now testing** — burned routines just to see them fire. Scheduled crons prove the system for free.
- **Repeated TodoWrite hand-curation** — let it ride.

### The fix
- Drop 1M → standard context.
- Stop using auto mode unless genuinely autonomous.
- Use the agent strategy section above (not ad-hoc).
- Wait for Monday's first real cron instead of more Run Nows.

---

## Decisions I made for you (you said "trust me")

| Question | My call | Why |
|---|---|---|
| Bake "Agent Strategy" into handoff? | YES | Locks in the patterns from turn 1; saves 10-30% tokens vs ad-hoc dispatch. |
| Write `.claude/skills/subagent-dispatch/SKILL.md`? | NO | Contradicts the bloat-down mandate. The patterns can live in this plan as a one-time briefing. If they prove their worth across 5+ sessions, then promote to a skill. |
| Haiku vs Sonnet vs Opus split? | Haiku=mechanical, Sonnet=comprehension, Opus=synthesis (main thread only) | Best ROI; Sonnet covers the safety-margin cases. |
| Start how? | Main thread reads plan FIRST, then dispatches 4 parallel agents | Avoids redundant work; agents get briefed based on what's in the plan. |
| Verifier pattern? | YES, for safety-critical changes only | One-extra-agent overhead; catches main-thread bias. Worth it for a money-touching bot. |

---

## Debug checklist (for the new session to run during audit)

```bash
cd ~/Documents/Claude/trading-bot

# 1. Last push + CI
git log --oneline -3
gh run list --limit 5

# 2. Session branches (cleanup candidates)
git branch -r | grep '^  origin/claude/'

# 3. State sanity
cat state/state.yaml

# 4. Regression check: any stale `git push origin main`?
grep -rn "git push origin main" routines/ .claude/commands/ .claude/skills/

# 5. No .env files (architecture rule)
find . -name '.env*' -not -path './node_modules/*' -not -path './.git/*'

# 6. Secret scanner functional
bash scripts/check-secrets.sh files routines/watchdog.md

# 7. Skill last-modified times
ls -la .claude/skills/

# 8. CI workflow file
cat .github/workflows/ci.yml | head -50
```

---

## Final note to operator

After you paste the block into a new session and delete this one, drop the model from `claude-opus-4-7[1m]` to `claude-opus-4-7` (high). The audit + cleanup work is bounded — file edits, grep, agent dispatch. High is plenty. The new session will tell you the moment it hits something that genuinely needs 1M.

**End of plan. Calling ExitPlanMode next.**
