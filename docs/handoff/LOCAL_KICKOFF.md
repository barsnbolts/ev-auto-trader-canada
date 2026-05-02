# Local Kickoff Prompt — Mac Claude Code, extra-high reasoning

For a fresh Mac Claude Code session running locally against
`~/ev-auto-trader-canada` on extra-high reasoning. Direct filesystem
access to everything: the live repo, the 3.8GB of mirrored sibling
working copies under `docs/handoff/sibling-checkouts/`, AND the
original Mac source paths (`~/.claude/plans/`, `~/Documents/Codex/`,
`~/Documents/Claude/Projects/EV dashboard/`, etc.). Full Mac MCP suite
is available — Chrome, Apify, scheduled-tasks — so M0, M2, and M11 are
in scope.

Mirror sha at the time this prompt was authored: `7341be3` on
`claude/verify-environment-setup-oTu3S`.

---

```
You are the planning + heavy-lifting pass for the EV Auto Trader Canada project, running locally on the user's Mac in Claude Code on extra-high reasoning. You have direct filesystem access — the live repo at ~/ev-auto-trader-canada, the 3.8GB of mirrored sibling working copies under docs/handoff/sibling-checkouts/, and every original Mac source path. Use whichever is freshest.

## Bootstrap

1. cd ~/ev-auto-trader-canada && git fetch --all --prune && git pull --ff-only. HEAD should be 7341be3 or newer. Branch must be claude/verify-environment-setup-oTu3S.
2. npm install && npm run predeploy. Report any failures.
3. List the MCPs available in this session and confirm Chrome (mcp__Claude_in_Chrome__*), Apify (mcp__Apify__*), and scheduled-tasks (mcp__scheduled-tasks__create_scheduled_task) are present. They should be — this is the Mac app. Note any that are missing.

## What's where

**Live repo (do real work here):** ~/ev-auto-trader-canada/{src,scripts,data,docs,...}.

**Frozen mirrors under docs/handoff/sibling-checkouts/** — read-only snapshots of every other EV-related folder from the user's Mac (committed wholesale, build junk and all). Eight of them, 3.8G total:
  - claude-projects--EV-dashboard/                3.2G  original Tauri+Vite desktop dashboard, pre-Next.js
  - codex-2026-04-21-is-it-continuing-the-ev-auto/ 304M  Swift / SwiftUI iteration
  - codex--EV-dashboard/                          295M  native-app-work iteration
  - transcripts--ev-dashboard-worktree/            29M  worktree transcripts (Tauri era)
  - transcripts--ev-dashboard/                    8.1M  Tauri-era claude.ai transcripts
  - codex-2026-05-01/                             2.1M  recent codex Hyundai/Kia EV sessions
  - codex-2026-04-21-i-want--ev-auto-trader-canada/ 208K  partial scaffold
  - library-app-support--EVAutoTraderCanada/      112K  Mac app runtime data
Mine these for prior decisions, snapshots, MSRP tables, data shapes, screenshot evidence — but do NOT try to merge their git histories or restart their toolchains. Inner .git/ dirs were renamed to _git_archive/ so the parent git treats them as plain files; if you want to inspect a sibling's history, do it locally with a temporary clone, don't touch the renames.

**Original Mac sources (still live — prefer these for currency):**
  - ~/.claude/plans/                                                     user's plan docs (mirrored to docs/handoff/mac-context/plans/, but originals may have updates)
  - ~/.claude/projects/-Users-ianmcadam-ev-auto-trader-canada/           live transcript .jsonl for THIS project
  - ~/Documents/Claude/Projects/EV dashboard/                            live Tauri dashboard (the 3.2G mirror is a snapshot of this)
  - ~/Documents/Codex/2026-04-21-is-it-continuing-the-ev-auto/           live Swift experiment
  - ~/Documents/Codex/2026-05-01/                                        recent codex notes
  - ~/Library/Application Support/EVAutoTraderCanada/                    Mac app runtime data (live)
  - ~/.claude/plugins/cache/superpowers-marketplace/superpowers/5.0.7/skills/  live superpowers skill content (mirror at docs/handoff/superpowers/)

You may read freely from these original paths. Do NOT write to them — write only inside ~/ev-auto-trader-canada/.

**Reading order before any planning:**
  - docs/handoff/SANDBOX_README.md
  - docs/handoff/PLAN_M0_M12_RECONSTRUCTED.md
  - docs/handoff/PLAN_M0_M12_AUTHORITATIVE.md
  - docs/handoff/SANDBOX_LIMITS.md
  - ~/.claude/plans/you-are-continuing-the-shiny-pixel.md   (live original)
  - SESSION_HANDOFF_2026-05-01.md, REPLAN_BRIEF.md, OVERNIGHT_SUMMARY.md, MEDIUM_NEXT.md, NEXT.md, BLOCKERS_MEDIUM.md, LOW_NEXT.md
  - Tail of ~/.claude/projects/-Users-ianmcadam-ev-auto-trader-canada/3c6bf353-…jsonl

## Loose rules

- Working branch: claude/verify-environment-setup-oTu3S. Don't push to main, don't force-push.
- `npm run predeploy` must pass before any push.
- Apify allowed up to $30 cumulative; ask before first run.
- Write only inside ~/ev-auto-trader-canada/. The original Mac paths above are read-only.
- TodoWrite live, one in_progress preferred.

## Mission this session

Spend the extra-high budget on thinking, research, and design. Produce `docs/handoff/EXECUTION_PLAN_<YYYY-MM-DD>.md` that turns each remaining M-task (M0, M2, M3, M4, M6, M9, M10, M11, M12) into a concrete work order — files touched with line ranges, call-site maps from grep, diff sketches, verification commands, edge cases, and a clear status (READY / DONE-this-session / BLOCKED-with-reason). The follow-up session will run on plain medium reasoning and execute purely from your plan.

Pre-do as much safe work as you can during this session, since you have full Mac access:

- M0 [HIGH] — run the Chrome MCP GraphQL probe live. Install the fetch+XHR hook BEFORE first navigation. Trigger pagination via filter change AND `rcp=` param AND Display dropdown. Save raw captures to docs/handoff/research/M0_graphql_<date>.json + a one-page interpretation in docs/handoff/research/M0_findings_<date>.md. Decision: "GraphQL usable" or "GraphQL unusable, fall through to M3".
- M2 [HIGH] — run a tiny Apify sample (1 page per province per make, ON+H/K only: Ioniq 5/6/9 + Kia EV6/EV9/Niro EV) to confirm shape. Throttle 3-5s/page + 30s gap between provinces. Save to docs/handoff/research/M2_sample_<date>.json. Stay well under $5 cumulative for the sample; ask before any larger run.
- M9 — Exa research on heatpump availability per Hyundai/Kia model + trim. Save raw notes under docs/handoff/research/M9_heatpump_<date>.md. Confidence=Low → leave hasHeatPump null in the eventual data fill.
- M12 [HIGH] — Exa-first OEM MSRP research. Chrome MCP fallback is fine for ambiguous trims. Save under docs/handoff/research/M12_msrp_<date>.md. Mark staleSince for any trim that can't be resolved.
- M10 [HIGH] Phase A — write docs/LEASEBUSTERS_PROBE.md outright (documentation only). Then PAUSE M10; Phase B/C still need explicit go-ahead from the user.
- M11 — draft the exact `mcp__scheduled-tasks__create_scheduled_task` call as a script in the EXECUTION_PLAN. Adopt simple-git-hooks for typecheck pre-commit. You may register the cron during planning if confidence is high; otherwise leave it for the medium session.
- M4 [HIGH] (cookie migration) and M6 (file rename) — grep every call/import site and embed the full file:line lists in the EXECUTION_PLAN. Don't ship the edits yet; medium does the implementation under your guidance.
- M3 — design the snapshot-diff daysOnMarket derivation. Skip if M0 found daysOnMarket; otherwise document the algorithm precisely (snapshot retention, edge cases, test plan). Implementation can wait for medium.
- Anything else genuinely mechanical and low-risk — ship it. Commit/push frequently with descriptive messages, predeploy gate respected.

When done, write docs/handoff/EXECUTION_KICKOFF_<YYYY-MM-DD>.md with a paste-ready prompt for the follow-up medium-reasoning session, then post the path to chat.

## First action

1. Post: "Local planning pass started, HEAD = <sha>, MCPs available: <Chrome / Apify / scheduled-tasks confirmed?>".
2. Run predeploy and report.
3. Build a TodoWrite with [validate-repo, read-context, plan-M3, plan-M4, plan-M6, plan-M9, plan-M10A, plan-M11, plan-M12, probe-M0, sample-M2, write-EXECUTION_PLAN, write-EXECUTION_KICKOFF] and start. Take your time on extra-high — this session is paying for the next one.
```
