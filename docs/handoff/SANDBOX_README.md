> **last-synced:** 2026-05-02T15:20:32Z (Mac → GitHub mirror sweep)
> Mac HEAD before this sync: `118e6cc` on `claude/verify-environment-setup-oTu3S`
> Working tree was clean and both local branches `ahead=0 behind=0` against origin.

# Sandbox Handoff Package

This directory consolidates everything a Linux-sandbox Claude Code session
needs to resume the M0→M12 plan against `barsnbolts/ev-auto-trader-canada`
without depending on the Mac filesystem.

## Cwd

Sandbox runs at `/home/user/ev-auto-trader-canada`, **not** any Mac path.
The Mac filesystem (`/Users/ianmcadam/...`) is not mounted in the sandbox
container — there's no NFS, SMB, SSH, or FUSE bridge. Network egress is
restricted to the GitHub git remote via local proxy.

## Read order

1. `PLAN_M0_M12_RECONSTRUCTED.md` — the M-task list reconstructed from
   the user's daytime brief + repo docs.
2. `mac-context/plans/you-are-continuing-the-shiny-pixel.md` — the
   original "shiny-pixel" plan that was previously Mac-only at
   `~/.claude/plans/`. Now mirrored here for the sandbox.
3. `../../SESSION_HANDOFF_2026-05-01.md` — last session state
4. `../../REPLAN_BRIEF.md` — re-plan inputs
5. `../../OVERNIGHT_SUMMARY.md` — what halted overnight
6. `../../MEDIUM_NEXT.md` — M7-M14 mechanical task queue (uses different
   numbering than the M0→M12 plan; see mapping in PLAN doc)
7. `../../NEXT.md` — long-form HIGH+MEDIUM queue
8. `../../BLOCKERS_MEDIUM.md` — live blockers
9. `../../LOW_NEXT.md` — L1 heatpump research queue fill

## Sandbox limitations

The sandbox is missing tools the original plan assumed available. Tasks
that need these MUST run from a Mac Claude Code session, not the sandbox:

| Missing tool | Blocks |
|---|---|
| Chrome MCP (`mcp__Claude_in_Chrome__*`) | M0 GraphQL probe; M12 Chrome fallback |
| Apify MCP (`mcp__Apify__*`) | M2 ON+H/K scrape; M12 Apify path |
| scheduled-tasks MCP (`mcp__scheduled-tasks__create_scheduled_task`) | M11 cron registration |
| Superpowers skills (`brainstorming`, `using-superpowers`) | Ceremonial only — content is doc-based and mirrored under `superpowers/` |

Available MCPs in sandbox: GitHub, Gmail, Google Calendar, Notion, Exa
(web_search + web_fetch), Google Drive.

## Executable in sandbox

- M3 — snapshot-diff daysOnMarket derivation (pure code/data)
- M4 [HIGH] — cookie migration (4 callers + delete `buyerProvinceServer.ts`)
- M6 — file rename
- M9 — heatpump fill (Exa available for L1 queue research)
- M10 Phase A — write `docs/LEASEBUSTERS_PROBE.md`, then PAUSE
- M12 — OEM MSRP refresh (Exa-only; no Chrome fallback)

## Branch + push gate

- Sandbox branch: `claude/verify-environment-setup-oTu3S`
- Predeploy gate before push: `npm run predeploy` (typecheck + Next build)
- Never `--no-verify`, never amend, never force-push

## Runtime rules (verbatim from supervised-daytime brief)

- Reasoning: medium default; HIGH on tasks tagged [HIGH] (M0, M2, M4, M10, M12)
- Touch ONLY `~/ev-auto-trader-canada`. Never cd elsewhere. Never git against another repo.
- Push only after `npm run predeploy` passes (typecheck + build, ~30s)
- TodoWrite live, exactly one in_progress
- Caveman mode internal (drop articles/filler, technical terms exact, code unchanged, UI copy stays English)
- Force `/compact` at 250k context
- Apify ALLOWED up to $30 cumulative cap (ask in chat before first run)
- Strict serial M0→M12. M3 conditional on M0 outcome. M10 Phase A only — pause for go-ahead on B/C.
- Skip `OVERNIGHT_*.md` ceremony. TodoWrite + chat is enough during supervised daytime.
- Ask clarifying questions in chat instead of deferring.

## Task-specific overrides (verbatim)

- **M0**: install fetch+XHR hook BEFORE first navigation; trigger pagination via filter change AND `rcp=` param AND Display dropdown if needed; if 0 captures after 3 trigger attempts, mark "GraphQL unusable" and proceed to M3 path
- **M2**: throttle 3-5s/page + 30s gap between provinces; ON+H/K only this run (Ioniq5/6/9 + Kia EV6/EV9/Niro EV)
- **M3**: skip if M0 found daysOnMarket; otherwise ship snapshot-diff
- **M4**: 4 callers (`page.tsx`, `inventory/page.tsx`, `dealer/[id]/page.tsx`, `compare/page.tsx`). Delete `buyerProvinceServer.ts`. Verify scoreOrder of first 20 units identical pre/post.
- **M6**: rename file (no shim), grep import sites first
- **M9**: confidence=Low → leave `hasHeatPump` null, don't fill
- **M10**: Phase A only — write `docs/LEASEBUSTERS_PROBE.md`, then PAUSE before B/C
- **M11**: use `mcp__scheduled-tasks__create_scheduled_task` (NOT CronCreate). Adopt `simple-git-hooks` for typecheck pre-commit.
- **M12**: Exa-first; Chrome MCP fallback only on ambiguous trims; mark `staleSince` for misses

## Stop conditions (halt + ask)

- 3 consecutive predeploy failures
- Vercel deploy broken twice
- About to write outside `~/ev-auto-trader-canada`
- About to spend Apify > $30 cumulative
- Schema change that invalidates existing snapshots beyond stable-ID migration

---

## Mac → GitHub mirror manifest (2026-05-02T15:20:32Z)

This sweep refreshed the Mac-side context dump under `mac-context/` and
re-mirrored superpowers skills as full directories (so sibling helper
scripts/refs come along, not just `SKILL.md`). The list below is the
complete set of files written this run.

### `mac-context/` (Mac-only context, copied here for sandbox parity)

- `mac-context/settings.json` — `~/.claude/settings.json` (redacted, no secrets present)
- `mac-context/mcp/.claude.json` — `~/.claude.json` (redacted: any value whose key matched `/token|key|secret/i` or any `sk-…` value replaced with `"REDACTED"`)
- `mac-context/mcp/claude_desktop_config.json` — `~/Library/Application Support/Claude/claude_desktop_config.json` (redacted; only contained device-pairing IDs)
- `mac-context/plans/*.md` — all 17 plan docs from `~/.claude/plans/`, including the project-relevant `you-are-continuing-the-shiny-pixel.md`, `you-are-continuing-a-drifting-planet.md`, `vast-humming-barto.md`, `you-re-picking-up-argus-splendid-cocoa.md`, `you-are-taking-over-velvet-petal.md`, etc.
- `mac-context/transcripts/3c6bf353-…jsonl` — most recent (only) Claude Code transcript for this project from `~/.claude/projects/-Users-ianmcadam-ev-auto-trader-canada/`
- `mac-context/commands/{caveman,caveman-commit,caveman-review}.md` — slash-command definitions from `~/.claude/commands/`

### `superpowers/` (now full skill dirs, not just SKILL.md)

- Multi-file skill dirs (each contains `SKILL.md` plus sibling helpers): `brainstorming/`, `using-superpowers/`, `subagent-driven-development/`, `writing-skills/`, `systematic-debugging/`, `requesting-code-review/`, `test-driven-development/`, `writing-plans/`
- Single-file skills (just `SKILL.md` content as flat `.md`): `dispatching-parallel-agents.md`, `executing-plans.md`, `finishing-a-development-branch.md`, `receiving-code-review.md`, `using-git-worktrees.md`, `verification-before-completion.md`

### MISSING on Mac (not fabricated, just absent)

- `~/.claude/CLAUDE.md` — does not exist on this Mac
- `~/.claude/projects/-Users-ianmcadam-ev-auto-trader-canada/CLAUDE.md` — does not exist on this Mac

### Reported but NOT copied (cross-repo trap, per stop conditions)

- `~/Documents/Codex/2026-04-21-i-want-to-continue-building-the/ev-auto-trader-canada` — separate working copy under Documents/Codex; intentionally not touched. Sandbox should NOT consider this a source of truth.
