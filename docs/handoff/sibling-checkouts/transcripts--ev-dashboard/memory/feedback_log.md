---
name: Ian's feedback and confirmed preferences
description: Guidance Ian has given about how to approach work on this project — corrections and confirmations
type: feedback
originSessionId: d92199a2-b04d-4c16-8bc7-83b46b7a1128
---
# Confirmed preferences

**Plan before code; specs before implementation.**
Why: Ian asked specifically for "extreme deep pre-planning" and integrated specs into the workflow when prompted. He wants to see the shape of a feature in plain English before Claude starts typing TypeScript.
How to apply: write or update `specs/<id>-*.md` before touching code for any user-visible feature. Wait-but-don't-block for spec review (~5 min).

**Autonomy within cluster boundaries; full-gas execution inside.**
Why: Ian explicitly said "do as much as you can yourself, try to automate as much as possible and to just make the best intelligent decisions." Checkpoints are at cluster boundaries, not inside.
How to apply: make defaults myself for reversible decisions (≤15 min to undo). Only stop and ask for architectural/irreversible choices. See game plan §1.6 for the specific decision-level autonomy rules.

**Token efficiency is a real constraint — caveman now applies to chat replies too.**
Why: Ian called for caveman-style internal writing, sub-agent delegation, bloat removal, self-optimization. Confirmed 2026-04-24: "caveman everywhere including my replies" — long plain-English explanations waste tokens and he doesn't read most of them.
How to apply: caveman for **everything** except read-by-Ian artifacts (`docs/user_guide.md`, `specs/*.md`, cluster recaps, plan files). That includes chat replies to Ian, status updates between tool calls, end-of-turn summaries, CLAUDE.md, SESSION_SUMMARY.md. Sonnet 4.6 / medium is the long-run default model; Opus + Max reserved for planning + architectural decisions. Sub-agents for parallel research.

**Model-switch awareness — auto-detect, don't ask.**
Why: Ian switches reasoning levels mid-project to control cost; he wants me to detect it automatically rather than rely on him telling me. Confirmed 2026-04-24.
How to apply: at every task boundary run `python3 scripts/detect_level.py` (reads `~/Library/Application Support/Claude/claude-code-sessions/.../local_*.json` matching current cwd → returns active `model` + `effort`). Then `python3 scripts/check_level.py --task <tag>` gates the work. On mismatch the policy is **switch to a smaller queued task automatically** via `python3 scripts/queue.py --respect-level`. If nothing fits, stop and report. Task tags + min-levels live in `docs/task_complexity_map.md` and `scripts/task_complexity.py`. State current model + effort at the top of replies when starting a fresh task or after long gaps.

**Bidirectional model recommender — silent default, nudge only on ≥3× ROI.**
Why: Max plan; Ian wants throughput and token efficiency without micromanaging level switches. Confirmed 2026-04-24 via 4-question survey.
How to apply: every milestone runs `scripts/recommend_model.py` (step 10). Default behaviour is **silent-swap** — pick top compatible item, no nudge. Active **nudge-down** when next 3 tasks all fit a cheaper level with ≥3× cost saving. Active **nudge-up** when top-priority item is parked one tier above current. `logs/level_recs.md` always appended; `logs/deferred_tasks.md` always rewritten (grouped by required level so a switch shows newly-eligible work). Cost weights in `scripts/cost_model.py`.

**Empirical learning loop — calibrate constants from real runs (asymmetric).**
Why: Ian wants the recommender's hardcoded constants (TASK_TOKENS + TASKS minimums) to self-calibrate from observed reality, biased toward "run on the cheapest model possible" but conservative about lowering the bar. Confirmed 2026-04-24 via 4-question survey.
How to apply: every milestone records an observation row to `logs/task_observations.jsonl` via `scripts/observation.py` (milestone step 11) capturing model + effort + task tag + indirect proxies (git lines, turns) + self-estimated tokens (passed via `--cost-tokens N --confidence {low,medium,high} --task-tag TAG` on milestone command). Step 12 runs `scripts/calibrate.py --maybe` which is a no-op until ≥5 new observations accumulated; then it applies updates per rules: **LOWER** a tag's min only after ≥3 consecutive successes at a cheaper level; **RAISE** a tag's min on any single failure at current min. TASK_TOKENS updates require ≥5 observations + ≥20% drift. All changes logged to `logs/calibration_changes.md`. On-demand active probing via `scripts/stress_test.py --suite quick` (5 canonical tasks for current level, see `docs/stress_test_battery.md`). When estimating my own token usage for `--cost-tokens`: 2k trivial → 5k UI tweak → 10k few edits → 20k multi-file → 40k spec-writing → 80k+ deep planning. Confidence: `low`/`medium`/`high` weights the calibrator's median (high=3×).

**Research before building (>30 min threshold).**
Why: Ian asked for creativity + existing-solution reuse instead of hand-building. Too easy to sink 3 hours on something a library already solves.
How to apply: any task expected to take >30 min gets a WebSearch pass first. Findings logged to `docs/research/<topic>.md` with ROI note, even if dead-end.

**Parallel-dispatch research is the default (≥3 facts OR ≥2 sources).**
Why: Ian 2026-04-24 — "figure out how to do substantially deeper faster research scraping etc.". Serial WebSearch loops are forbidden for multi-fact tasks; one round-trip per fact wastes wall-clock and tokens.
How to apply: use `python3 scripts/research.py "<topic>" --angles N` for general topics or `python3 scripts/research_vehicle.py "Brand Model Year"` for full seed.json sweeps. Both emit a parallel-execution plan to `docs/research/auto/`. Then send ONE tool message with all `Agent` calls in parallel — total wall-clock = slowest agent. Use Exa MCP (`mcp__9a04470a__web_search_exa` / `web_fetch_exa`) and Apify MCP (`mcp__Apify__call-actor`, `apify--rag-web-browser`) alongside `WebSearch`/`WebFetch` in the same batch when angles call for it. Source matrix + tool inventory: `docs/research/playbook.md`.

**Output-token compressor — `scripts/quiet.py` always wraps verbose commands.**
Why: Ian 2026-04-24 shared rtk-ai/rtk thread + asked to implement most-effective tips. Verbose tsc / vitest / cargo / git output is the biggest single token sink in this project (per-test-pass spam, compile progress, etc.). Project-scoped Python clone of RTK ships in repo, no install needed.
How to apply: prefer `python3 scripts/quiet.py <verbose-cmd>` over raw invocation. Specializations for tsc/vitest/cargo/git-status/git-diff/git-log; generic filter for everything else. Always preserves errors + WARN + summary lines. Trailing `[quiet.py: <kind> | before→after tokens, -X%]` line keeps savings auditable. milestone.py already wires it for tsc/vitest/cargo automatically. 14 unit tests in `scripts/test_quiet.py` cover every specialization.

**Testing/validation baked in, not bolted on.**
Why: Ian explicitly asked for it. Eight layers defined in game plan §1.55.
How to apply: every milestone runs tsc + vitest + validate.py + metrics.py + git commit via `scripts/milestone.py`. Red halts. Every cluster recap lists green-check statuses.

**UI should feel like a considered Mac app, not a demo.**
Why: Ian said the UI needs to be "super nice elegant etc." — this is the finish-line aesthetic.
How to apply: Apple-HIG-adjacent, spacing grid, SF typography, semantic confidence colors, visible focus rings, designed empty states, skeleton loading, subtle motion. Enforced per cluster; swept at F6.

**Learning system runs itself between sessions.**
Why: Ian wanted "constantly learning, optimizing, making itself more efficient."
How to apply: `scripts/self_audit.py` runs every 5 milestones — prunes memory, scans doc bloat, catches caveman leakage, flags stale `accessed` dates. Writes to LEARNINGS automatically.

# Corrections to watch for

None yet — Ian hasn't corrected me during planning. Watch for: if he pushes back on a default I chose, save the reasoning in this file so I don't repeat it.

# Communication style

- Ian rambles when he's thinking. Extract intent, restate in plain English, confirm before acting on fuzzy direction.
- When he types short terse messages ("do X"), he means "do X now, move fast." Don't ask for clarification when the action is obvious.
- When he asks a question via "Can you..." or "What about...", he usually wants a recommendation + one-sentence tradeoff, not a decision matrix.
