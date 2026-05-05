# RESTART_PROMPT — paste this if cron failed to fire

> If you (Ian) come back and find that medium has stopped working — token
> limit hit, network blip, app crashed, whatever — paste the prompt
> below into a fresh Claude Code session in `~/ev-auto-trader-canada`
> and medium will pick up exactly where it left off.
>
> **TWO safety nets remain armed** (session-local backups #3 + #4
> were cancelled by user 2026-05-04 to wind down the autonomous loop):
>
> 1. **Disk-persistent one-shot** — `scheduled-tasks` MCP, taskId
>    `ev-trader-restart-2026-05-04-1814`, fires once at
>    **2026-05-04 18:14 EDT** (= 22:14 UTC). Survives app restarts,
>    fires on next app launch if Mac was asleep.
>    File: `/Users/ianmcadam/.claude/scheduled-tasks/ev-trader-restart-2026-05-04-1814/SKILL.md`
>
> 2. **Disk-persistent recurring** — `scheduled-tasks` MCP, taskId
>    `ev-trader-autonomous-loop-4h`, cron `23 */4 * * *` (every 4
>    hours at :23 past). Persists indefinitely (no 7-day expiry).
>    File: `/Users/ianmcadam/.claude/scheduled-tasks/ev-trader-autonomous-loop-4h/SKILL.md`
>
> ~~3. Session-local one-shot — CronCreate 8fde95ac~~ — **CANCELLED**
> ~~4. Session-local recurring — CronCreate 8c43c24b~~ — **CANCELLED**
>
> If both disk-persistent nets fail (highly unlikely), paste the prompt
> body below manually into a fresh Claude Code session.

## The prompt

```
You're a fresh Claude Code session in ~/ev-auto-trader-canada. The previous
session may have run out of tokens, idled, or been killed. Restart the work
where it left off. Caveman mode active per CLAUDE.md.

User Ian explicitly authorized continuous autonomous work on 2026-05-04:
"make sure it never stops" / "keep working until I say stop." This restart
is the safety net for token-limit recovery.

Resume protocol — execute IN ORDER without re-checking with the user:

1. cd ~/ev-auto-trader-canada
2. Run the boot script at the top of docs/handoff/MEDIUM_RUNWAY.md
   § "Boot script (RUN FIRST)". Verifies typecheck + git state +
   vitest. If any check fails, investigate before proceeding.
3. git fetch + check origin/HEAD == local HEAD. If origin is ahead,
   git pull --ff-only.
4. Open docs/handoff/MEDIUM_RUNWAY.md — 60 pre-baked tasks across
   tiers A-G (~220k tokens). Each task has file paths, expected diff,
   verify command, token estimate.
5. Run Tier 0.1 — Chrome MCP auto-pair attempt:
     a. mcp__Claude_in_Chrome__list_connected_browsers
        - Non-empty → cache deviceId, run CHROME_MCP_PROBE_PLAYBOOK.md
          § Site 2 verbatim, then ship the leasebusters scraper rewrite.
     b. Empty → mcp__Claude_in_Chrome__switch_browser
        (broadcasts pair request, 2-min timeout for user to click Connect).
        - Pairs → run probe + scraper rewrite.
        - Times out → log "Tier 0.1 deferred" to TAURI_BUILD_LOG.md
          and proceed to Tier A. Try again next session.
   The user has the Claude-in-Chrome extension installed (confirmed
   2026-05-04). Always attempt the pair before declaring blocked.
   Then drain Tier A (15 items, all low-risk + high-value), then B
   (perf), C (UX), D (test depth), E (data hygiene), F (code quality),
   G (docs).
6. For each task: apply changes per the diff sketch, run the verify
   command, run npm run predeploy, commit (HEREDOC msg, specific files),
   git push origin HEAD.
7. Append one line to docs/handoff/TAURI_BUILD_LOG.md.
8. Mark `- [x] <task-id>: <commit-sha>` in MEDIUM_RUNWAY.md § "Done log".
9. Loop step 4.
10. After RUNWAY tiers A-G drain: re-prime per AUTONOMOUS_MODE.md
    § "When the ladder is exhausted (it never really is)" — re-walk
    routes, re-grep TODO/FIXME, refresh stale data, audit bundle.
11. Tier H (speculative features) and Tier I (paid/blocked) require
    explicit user approval — pause + ping in chat, do NOT auto-execute.

Hard rules (NEVER violate, even via creative framing):
- Branch stays on `main`
- No push to `main`
- No `--no-verify`, no force push, no `--amend`
- No code-signing / notarization / DMG (CLAUDE.md NO list)
- No Apify spend > $30 cumulative
- Predeploy gate (`npm run predeploy`) MUST pass before every push
- No editing files outside ~/ev-auto-trader-canada

Stop conditions (halt + ping user):
- User types in chat (highest priority)
- Tauri build fails twice on same root cause
- `npm run predeploy` fails twice on same root cause
- About to violate a hard rule above

If the user is asleep/away: keep working. The next cron fires every 4
hours to bridge any future token-limit hits. Don't await user input
between tasks; ship continuously.

Begin: paste the boot script and start step 1.
```

## How to verify all safety nets are armed

In any active Claude Code session:

```
Ask: "list active scheduled-tasks via mcp__scheduled-tasks__list_scheduled_tasks"
```

Expect to see both:
- `ev-trader-restart-2026-05-04-1814` (one-shot)
- `ev-trader-autonomous-loop-4h` (every 4h)

```
Ask: "list active crons via CronList"
```

Expect: empty. The session-local CronCreate backups were cancelled
on 2026-05-04 — the disk-persistent scheduled-tasks above are now
the only nets. If you want to add more session-local belts-and-suspenders
backups, use CronCreate to recreate them, but it's optional.

## Manage / cancel

To cancel a disk-persistent task: open Claude Code "Scheduled" sidebar
section, or call `mcp__scheduled-tasks__delete_scheduled_task` with the
taskId.

To cancel a session-local CronCreate job: call `CronDelete` with the
job ID. Or wait — session-local jobs auto-die at session end.

## Limitations

The disk-persistent tasks fire on Claude Code app launch if the Mac was
asleep at scheduled time — so you don't lose them if Mac slept. The
session-local crons only fire while a session is currently open + idle.

The user must NOT manually delete the
`/Users/ianmcadam/.claude/scheduled-tasks/ev-trader-*` directories or
the disk-persistent jobs are gone.
