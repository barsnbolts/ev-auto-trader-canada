# Cloud Kickoff Prompt — extra-high reasoning, planning + pre-work

Designed for a Claude cloud agent the user monitors from phone + Mac
app. Pulls everything fresh from GitHub, including ~3.8GB of sibling
working-copy mirrors under `docs/handoff/sibling-checkouts/` that
preserve every other EV-related folder from the user's Mac. Light on
guardrails — trust your judgment.

Mirror sha at the time this prompt was authored: `a2019b1` on
`claude/verify-environment-setup-oTu3S`.

---

```
You are the planning + heavy-lifting pass for the EV Auto Trader Canada project, running in the cloud on extra-high reasoning. The user is monitoring you from a phone, so post a clear one-liner to chat at every milestone (started, finished reading X, finished planning M-task Y, committing/pushing, done).

## Bootstrap — pull everything fresh

1. Clone or update barsnbolts/ev-auto-trader-canada at branch claude/verify-environment-setup-oTu3S. HEAD should be a2019b1 or newer. The repo is ~3.8GB because docs/handoff/sibling-checkouts/ contains full working-copy mirrors of every EV-related folder that lived on the user's Mac. A shallow clone is fine.
2. Run `npm install` and `npm run predeploy` (typecheck + Next build) to confirm the live src/ is healthy. Report any failures.
3. Read this map of what's in the repo, then dive in:
     docs/handoff/CLOUD_KICKOFF.md       — this file
     docs/handoff/SANDBOX_README.md      — sandbox/cloud limits + reading order
     docs/handoff/PLAN_M0_M12_RECONSTRUCTED.md
     docs/handoff/PLAN_M0_M12_AUTHORITATIVE.md
     docs/handoff/SANDBOX_LIMITS.md
     docs/handoff/mac-context/plans/you-are-continuing-the-shiny-pixel.md   ← original project brief
     docs/handoff/mac-context/transcripts/3c6bf353-…jsonl                   ← latest session transcript
     docs/handoff/superpowers/                                              ← full superpowers skills mirrored locally
     docs/handoff/sibling-checkouts/                                        ← every other EV folder from the user's Mac
     SESSION_HANDOFF_2026-05-01.md, REPLAN_BRIEF.md, OVERNIGHT_SUMMARY.md, MEDIUM_NEXT.md, NEXT.md, BLOCKERS_MEDIUM.md, LOW_NEXT.md
4. Skim docs/handoff/sibling-checkouts/ enough to understand history. There are 8 sibling mirrors:
     - claude-projects--EV-dashboard/        (3.2G — the original Tauri+Vite desktop dashboard, pre-Next.js)
     - codex--EV-dashboard/                  (295M — native-app-work iteration)
     - codex-2026-04-21-is-it-continuing-the-ev-auto/  (304M — Swift / SwiftUI experiment)
     - codex-2026-04-21-i-want--ev-auto-trader-canada/ (208K — partial scaffold)
     - codex-2026-05-01/                     (2.1M — recent codex sessions on hyundai/kia EV)
     - transcripts--ev-dashboard/            (8.1M — claude.ai transcripts from the Tauri era)
     - transcripts--ev-dashboard-worktree/   (29M — worktree transcripts)
     - library-app-support--EVAutoTraderCanada/  (112K — Mac app runtime data)
   These are READ-ONLY snapshots. You may pull useful context (data shapes, prior decisions, snapshots, MSRP tables, etc.) into the live project, but do NOT try to merge their git histories or restart their toolchains.

## Loose rules (judgment beats checklist)

- Working branch: claude/verify-environment-setup-oTu3S. Don't push to main. Don't force-push shared branches.
- `npm run predeploy` must pass before any push to the working branch.
- Apify allowed up to $30 cumulative; ask before first run.
- If a tool/MCP you need isn't available in this cloud environment, mark it BLOCKED and move on — don't improvise dangerous substitutes.
- Use TodoWrite to keep the human in the loop. One in_progress at a time is preferred but not enforced.

## Your mission this session

Spend the extra-high budget on thinking, research, and design. Produce a `docs/handoff/EXECUTION_PLAN_<YYYY-MM-DD>.md` that turns each remaining M-task (M0, M2, M3, M4, M6, M9, M10, M11, M12) into a concrete work order — files touched with line ranges, call-site maps from grep, diff sketches, verification commands, edge cases, and a clear status (READY / BLOCKED-needs-Mac / DONE-this-session). The follow-up session will be on plain reasoning and should be able to execute purely from your plan.

Also do the safe-to-pre-do work yourself:

- Write `docs/LEASEBUSTERS_PROBE.md` (M10 Phase A — pure documentation).
- Run Exa research for M9 (heatpump availability per model/trim) and M12 (OEM MSRP refresh). Save raw findings under `docs/handoff/research/`. Decide where the data is unambiguous; flag where it isn't.
- For M4 (cookie migration) and M6 (file rename): grep the call sites and put complete file:line lists in the EXECUTION_PLAN so the next session doesn't have to re-discover them.
- M0/M2/M11 are likely BLOCKED in cloud (they need Chrome MCP, Apify MCP, scheduled-tasks MCP). Document the exact procedure each needs so a Mac session can drop in and execute.
- Anything else you can fully ship without judgment risk — do it. Commit/push frequently, descriptive messages, predeploy gate respected.

When you're done, write `docs/handoff/EXECUTION_KICKOFF_<YYYY-MM-DD>.md` containing the paste-ready prompt for the next session and post the path to chat.

## First action

1. Post: "Cloud planning pass started, HEAD = <sha>".
2. Run predeploy; report result.
3. Build a TodoWrite with `[validate-repo, read-context, plan-M3, plan-M4, plan-M6, plan-M9, plan-M10A, plan-M11, plan-M12, plan-M0, plan-M2, write-EXECUTION_PLAN, write-EXECUTION_KICKOFF]` and start.
```
