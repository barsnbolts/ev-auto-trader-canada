# RESTART_PROMPT — paste this if cron failed to fire

> If you (Ian) come back and find that medium has stopped working — token
> limit hit, network blip, app crashed, whatever — paste the prompt
> below into a fresh Claude Code session in `~/ev-auto-trader-canada`
> and medium will pick up exactly where it left off.
>
> **FOUR safety nets are armed (defense in depth):**
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
> 3. **Session-local one-shot** — `CronCreate` job 8fde95ac, fires
>    `14 18 4 5 *`. Lost if THIS session ends, but redundant with #1.
>
> 4. **Session-local recurring** — `CronCreate` job 8c43c24b, fires
>    `17 */4 * * *`. Lost if THIS session ends, but redundant with #2.
>
> If all four fail (highly unlikely), paste the prompt body below
> manually into a fresh Claude Code session.

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
2. Run the boot script in docs/handoff/MEDIUM_RESUME_2026-05-04.md
   § "Boot script (RUN FIRST on resume)" — verifies typecheck + git
   state + data counts. If any check fails, investigate before proceeding.
3. git fetch + check origin/HEAD == local HEAD. If origin is ahead,
   git pull --ff-only.
4. Read docs/handoff/TODO_INDEX_2026-05-04.md § "Inline TODOs" table.
   Pick the highest unblocker not yet shipped (look at git log for "feat(tauri)"
   or "feat(scrape)" commits to deduce what's done).
5. For the chosen item, open the doc named in column 5 ("Pre-baked recipe").
   Three docs exist:
   - docs/handoff/DOCK_BADGE_RECIPE.md (Phase C dock badge)
   - docs/handoff/CHROME_MCP_PROBE_PLAYBOOK.md (Kijiji + Leasebusters scrapers)
6. Apply the recipe verbatim. Run the verification gauntlet at the bottom
   of the recipe doc.
7. Commit + push. Append one line to docs/handoff/TAURI_BUILD_LOG.md.
8. Repeat from step 4 until the queue is empty.
9. After explicit queue empty: open docs/handoff/AUTONOMOUS_QUEUE.md (17
   pre-staged Tier 2-5 tasks). Pick highest unblocked, ship it, repeat.
10. After AUTONOMOUS_QUEUE empty: open docs/handoff/AUTONOMOUS_MODE.md
    § "When the ladder is exhausted (it never really is)" — re-prime by
    re-walking routes, re-grepping TODO/FIXME, refreshing stale data, etc.

Hard rules (NEVER violate, even via creative framing):
- Branch stays on `claude/verify-environment-setup-oTu3S`
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

Expect to see two more (session-local backups). If session ended,
these will be gone — relies on the disk-persistent ones above.

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
