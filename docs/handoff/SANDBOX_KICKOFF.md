# Kickoff Prompt — paste verbatim into a fresh Claude Code session

This works in **either** environment (Mac Claude Code or Linux sandbox)
— §0 detects which one you're in and §3 routes the work accordingly.

Mirror sha at the time this prompt was authored: `9ab05ca` on
`claude/verify-environment-setup-oTu3S` (2026-05-02).

---

```
You are resuming the EV Auto Trader Canada project. Everything you need is in this repo under docs/handoff/. The Linux sandbox does NOT have the Mac filesystem mounted; the Mac app DOES have Chrome+Apify+scheduled-tasks MCPs the sandbox lacks. §0 below figures out which environment you're in.

## 0. Bootstrap

1. cwd must end with /ev-auto-trader-canada. Never cd outside this tree.
2. Confirm: git remote -v shows barsnbolts/ev-auto-trader-canada, current branch is claude/verify-environment-setup-oTu3S, HEAD is 9ab05ca or newer. Run: git fetch --all --prune && git pull --ff-only.
3. **Detect environment** by listing the MCPs available in this session:
     - If `mcp__Claude_in_Chrome__*` AND `mcp__Apify__*` AND `mcp__scheduled-tasks__create_scheduled_task` are all present → MODE = MAC (full plan, M0 through M12).
     - Else → MODE = SANDBOX (skip M0/M2/M11, run only the sandbox-executable subset in §3b).
   Print the detected mode in your first message.
4. Read these in order before touching any code:
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
5. Skim docs/handoff/superpowers/ — full superpowers skill content is mirrored here. SKILL.md files are authoritative; sibling files (defense-in-depth.md, anthropic-best-practices.md, scripts/, references/, etc.) are part of those skills.
6. Skim docs/handoff/mac-context/transcripts/3c6bf353-…jsonl — that is the most recent Claude Code session for this project. Read enough of the tail to know what was just done.

## 1. Hard rules (non-negotiable, both modes)

- Touch ONLY this repo's tree. Never cd elsewhere. Never operate git on another repo. Never write Mac files outside docs/handoff/mac-context/.
- Never `git add -A` or `git add .` — stage by explicit path.
- Never `--no-verify`, `--amend`, `--force`, `--force-with-lease`, or `git reset --hard` against shared branches.
- Never push to main. Sandbox/working branch is claude/verify-environment-setup-oTu3S.
- Push gate: `npm run predeploy` (typecheck + Next build) MUST pass before any push.
- 3 consecutive predeploy failures → halt + ask. Vercel deploy broken twice → halt + ask.
- Apify ALLOWED up to $30 cumulative; ask in chat before first run.
- TodoWrite live, exactly one in_progress at a time.
- Skip OVERNIGHT_*.md ceremony — TodoWrite + chat is enough during supervised daytime.
- Force /compact at 250k context.
- Caveman mode INTERNAL only — code and UI copy stay normal English.

## 2. Reasoning level

- Default: medium. HIGH on tasks tagged [HIGH]: M0, M2, M4, M10, M12.

## 3a. If MODE = MAC — execute serially M0 → M12

- M0 [HIGH]: install fetch+XHR hook BEFORE first navigation; trigger pagination via filter change AND `rcp=` param AND Display dropdown; if 0 captures after 3 trigger attempts, mark "GraphQL unusable" and skip to M3.
- M2 [HIGH]: throttle 3-5s/page + 30s gap between provinces; ON+H/K only this run (Ioniq 5/6/9 + Kia EV6/EV9/Niro EV).
- M3: snapshot-diff daysOnMarket derivation. Skip if M0 found daysOnMarket; else ship.
- M4 [HIGH]: cookie migration — 4 callers (page.tsx, inventory/page.tsx, dealer/[id]/page.tsx, compare/page.tsx). Delete buyerProvinceServer.ts. Verify scoreOrder of first 20 units identical pre/post.
- M6: file rename, no shim, grep import sites first.
- M9: heatpump fill via Exa; confidence=Low → leave hasHeatPump null.
- M10 [HIGH]: Phase A only — write docs/LEASEBUSTERS_PROBE.md, then PAUSE for go-ahead before B/C.
- M11: use mcp__scheduled-tasks__create_scheduled_task (NOT CronCreate). Adopt simple-git-hooks for typecheck pre-commit.
- M12 [HIGH]: OEM MSRP refresh — Exa-first; Chrome MCP fallback only on ambiguous trims; mark staleSince for misses.

## 3b. If MODE = SANDBOX — execute the subset only

Run only: M3 → M4 → M6 → M9 → M10A → M12.
Skip: M0, M2, M11 — they require MCPs the sandbox lacks. Mark each as BLOCKED in TodoWrite with the exact missing MCP name (mcp__Claude_in_Chrome__*, mcp__Apify__*, mcp__scheduled-tasks__create_scheduled_task) and stop — do NOT improvise substitutes.
For M12 in sandbox: Exa-only path (no Chrome fallback). Mark staleSince for any trim Exa can't resolve.

## 4. Stop conditions (halt + ask in chat, both modes)

- 3 consecutive predeploy failures.
- Vercel deploy broken twice.
- About to write outside this repo's tree (or outside docs/handoff/mac-context/ for Mac state mirroring).
- About to spend Apify > $30 cumulative.
- Schema change that invalidates existing snapshots beyond the stable-ID migration.
- Task requires an MCP not available in the detected mode.

## 5. First action

Once §0 is done, post in chat: "MODE = <MAC|SANDBOX>, HEAD = <sha>". Then write a TodoWrite with the appropriate task list (full M0→M12 if MAC, subset if SANDBOX), set the first task in_progress, and start. No further confirmation needed.
```
