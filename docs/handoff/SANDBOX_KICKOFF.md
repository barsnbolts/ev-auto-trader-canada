# Sandbox Kickoff Prompt

Paste the block below — verbatim — as the **first message** of a fresh
Claude Code session running inside the Linux sandbox container against
`barsnbolts/ev-auto-trader-canada`. It is fully self-contained; you do
not need to provide anything else.

Mirror sha at the time this prompt was authored: `ef52006` on
`claude/verify-environment-setup-oTu3S` (2026-05-02T15:21:51Z).

---

```
You are resuming the EV Auto Trader Canada project inside a Linux sandbox. The Mac filesystem is NOT mounted — everything you need has already been mirrored into the repo under docs/handoff/.

## 0. Bootstrap (do this first, no questions)

1. cwd = /home/user/ev-auto-trader-canada — never cd outside this tree.
2. Confirm: git remote -v shows barsnbolts/ev-auto-trader-canada, current branch is claude/verify-environment-setup-oTu3S, HEAD is ef52006 or newer.
3. git fetch --all --prune && git pull --ff-only.
4. Read in this order, top to bottom, before doing anything else:
     docs/handoff/SANDBOX_README.md
     docs/handoff/PLAN_M0_M12_RECONSTRUCTED.md
     docs/handoff/PLAN_M0_M12_AUTHORITATIVE.md
     docs/handoff/SANDBOX_LIMITS.md
     docs/handoff/mac-context/plans/you-are-continuing-the-shiny-pixel.md
     SESSION_HANDOFF_2026-05-01.md
     REPLAN_BRIEF.md
     OVERNIGHT_SUMMARY.md
     MEDIUM_NEXT.md
     NEXT.md
     BLOCKERS_MEDIUM.md
     LOW_NEXT.md
5. Skim docs/handoff/superpowers/ — that is the full superpowers skill content mirrored locally. Treat the SKILL.md files as authoritative skill instructions; sibling files (defense-in-depth.md, anthropic-best-practices.md, scripts/, references/, etc.) are part of those skills.

## 1. Hard rules (non-negotiable)

- Touch ONLY ~/ev-auto-trader-canada (or /home/user/ev-auto-trader-canada inside the sandbox). Never cd elsewhere. Never operate git on another repo.
- Never `git add -A` or `git add .` — stage by explicit path.
- Never `--no-verify`, never `--amend`, never `--force` / `git push --force` / `git reset --hard` against shared branches.
- Never push to main. Sandbox branch is claude/verify-environment-setup-oTu3S.
- Push gate: `npm run predeploy` (typecheck + Next build) MUST pass before any push.
- Three consecutive predeploy failures → halt and ask. Vercel deploy broken twice → halt and ask.
- Apify ALLOWED up to $30 cumulative cap; ask in chat before first run.
- TodoWrite live, exactly one in_progress at a time.
- Skip OVERNIGHT_*.md ceremony during supervised daytime — TodoWrite + chat is enough.
- Force /compact at 250k context.
- Caveman mode INTERNAL only (drop articles/filler in your reasoning, technical terms exact, code unchanged, UI copy stays English).

## 2. Reasoning level

- Default: medium.
- HIGH on tasks tagged [HIGH]: M0, M2, M4, M10, M12.

## 3. What this sandbox CAN do (execute serially, M0 → M12)

- M3 — snapshot-diff daysOnMarket derivation (pure code/data).
- M4 [HIGH] — cookie migration: 4 callers (page.tsx, inventory/page.tsx, dealer/[id]/page.tsx, compare/page.tsx). Delete buyerProvinceServer.ts. Verify scoreOrder of first 20 units identical pre/post.
- M6 — file rename (no shim; grep import sites first).
- M9 — heatpump fill (Exa available for L1 queue research; confidence=Low → leave hasHeatPump null).
- M10 Phase A — write docs/LEASEBUSTERS_PROBE.md, then PAUSE for go-ahead before B/C.
- M12 — OEM MSRP refresh, Exa-only path; mark staleSince for misses. (Chrome fallback NOT available here — see §4.)

## 4. What this sandbox CANNOT do (Mac-only)

The following MCP tools are NOT installed in the sandbox; tasks that require them must be deferred to a Mac Claude Code session:

| Missing MCP                                  | Blocks                                               |
|----------------------------------------------|------------------------------------------------------|
| mcp__Claude_in_Chrome__*                     | M0 GraphQL probe, M12 Chrome trim fallback           |
| mcp__Apify__*                                | M2 ON+H/K scrape, M12 Apify path                     |
| mcp__scheduled-tasks__create_scheduled_task  | M11 cron registration (NOT CronCreate)               |

Available MCPs in sandbox: GitHub, Gmail, Google Calendar, Notion, Exa (web_search + web_fetch), Google Drive.

If you hit a task that needs a missing MCP, mark it BLOCKED in TodoWrite with the exact MCP name and stop — do not improvise a substitute.

## 5. Task-specific overrides (verbatim)

- M0: install fetch+XHR hook BEFORE first navigation; trigger pagination via filter change AND `rcp=` param AND Display dropdown; if 0 captures after 3 trigger attempts, mark "GraphQL unusable" and proceed to M3 path. (Mac-only; you cannot run M0 here.)
- M2: throttle 3-5s/page + 30s gap between provinces; ON+H/K only this run (Ioniq5/6/9 + Kia EV6/EV9/Niro EV). (Mac-only.)
- M3: skip if M0 already found daysOnMarket; otherwise ship snapshot-diff.
- M4: see §3.
- M6: rename file, no shim.
- M9: confidence=Low → leave hasHeatPump null, don't fill.
- M10: Phase A only — write docs/LEASEBUSTERS_PROBE.md, then PAUSE.
- M11: use mcp__scheduled-tasks__create_scheduled_task (NOT CronCreate). Adopt simple-git-hooks for typecheck pre-commit.
- M12: Exa-first; Chrome fallback only on ambiguous trims (Mac-only); mark staleSince for misses.

## 6. Stop conditions (halt + ask in chat)

- 3 consecutive predeploy failures.
- Vercel deploy broken twice.
- About to write outside ~/ev-auto-trader-canada.
- About to spend Apify > $30 cumulative.
- Schema change that invalidates existing snapshots beyond the stable-ID migration.
- Any task that requires a Mac-only MCP (Chrome / Apify / scheduled-tasks).

## 7. First action

Once you've read §0 in full, post a TodoWrite with the sandbox-executable subset (M3 → M4 → M6 → M9 → M10A → M12), set the first one in_progress, and start. No further confirmation needed.
```
