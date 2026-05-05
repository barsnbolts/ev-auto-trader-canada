# AUTONOMOUS_MODE — never stop until user says stop

> **Prime directive (binding):** keep working. The user is away from the
> machine. Every idle minute is wasted token-ROI. After the explicit
> queue empties, generate the next batch of work yourself and keep
> shipping. Only halt on hard errors or an explicit user message.
>
> **Trigger:** all `TODO(medium)` markers in `docs/handoff/TODO_INDEX_2026-05-04.md`
> are shipped (or explicitly deferred per stop conditions). Instead of
> idling, take the wheel and keep working creatively until the user
> says **stop**.
>
> **Authorized by Ian on 2026-05-04 at extra-high pre-medium handoff.**
> Reaffirmed mid-handoff: "make sure it never stops."

## When to enter

After the last item in the work queue ships AND the verification gauntlet
(`docs/handoff/MEDIUM_RUNWAY.md` § "Verification ritual") passes:

1. The .app rebuilds clean.
2. `npx tsc --noEmit` exit=0.
3. `npm run predeploy` exit=0 (Vercel build still works).
4. Last commit pushed to origin.

Append a one-line entry to `docs/handoff/TAURI_BUILD_LOG.md`:
`- <date>: Queue empty. Entering autonomous mode.`

Then proceed to the priority ladder below.

## Hard rules (binding)

These NEVER bend, even in autonomous mode:

- ❌ No code-signing, notarization, DMG distribution. (CLAUDE.md NO list.)
- ❌ No push to `main`. Stay on the working branch.
- ❌ No `--no-verify`, no `--amend`, no force push.
- ❌ No skipping the predeploy gate before push.
- ❌ No editing files outside `~/ev-auto-trader-canada`.
- ❌ No Apify spend > $30 cumulative.
- ❌ No subagent dispatch > 70k tokens.
- ❌ No spawning Phase D-bis or Phase E without user approval (token budget alone ~95k+60k).

If a creative task brushes any of these, **halt** and queue it for user
review. Append to `docs/handoff/MEDIUM_RUNWAY.md` (create if missing):
`- <ISO date>: <task> (blocked: <which rule>)`.

## Priority ladder (top-down — pick the highest unblocked)

### Tier 1 — verification + safety (do these first)

1. **Manual route walkthrough via preview_start.**
   ```
   preview_start name="Next.js dev"
   # browse all 13 routes, screenshot each, log console errors
   ```
   Routes: `/`, `/inventory`, `/inventory/[any]/dossier`, `/dealer/[any]`,
   `/compare`, `/pick-a-model`, `/pick-a-model/compare`, `/incentives`,
   `/history`, `/intel`, `/map`. Append findings to
   `docs/handoff/AUTONOMOUS_AUDIT.md`.

2. **Tauri .app smoke test.**
   ```
   open "src-tauri/target/aarch64-apple-darwin/release/bundle/macos/EV.trader CA.app"
   ```
   Click through Refresh button, Verify chip on a dossier, photo gallery
   if Phase C2 shipped. Log result.

3. **Cron health check.**
   ```
   launchctl list | grep evautotrader
   tail -50 logs/cron.log 2>/dev/null
   ```
   If cron broken or last run > 36h ago: investigate + fix.

4. **Snapshot retention.**
   ```
   ls data/snapshots/ | wc -l
   ```
   If > 30 files: archive oldest 10 to `data/snapshots/archive/<year>.tar.gz`.

### Tier 2 — quality wins (small, mechanical)

5. **Typecheck warnings.** `npx tsc --noEmit --pretty` — fix anything that
   emits a warning even though exit=0.

6. **Dead code sweep.** Search for unused exports:
   ```
   grep -rn "^export " src/ | head -50
   # Cross-reference against importers; remove anything with 0 importers.
   ```
   One commit per file removed.

7. **Bundle size audit.** After `BUILD_TARGET=tauri npm run build:tauri:web`:
   ```
   du -sh out/_next/static/chunks/*.js | sort -h | tail -10
   ```
   Anything > 200KB: investigate. Common wins: dynamic-import recharts,
   leaflet, lazy-load dossier sub-components.

8. **Image priming.** Verify `ClientWarmup` covers all hero images on
   `/inventory`. If a row's image isn't pre-warmed on idle, add it.

9. **Console.warn cleanup.** `grep -rn "console\." src/` — replace stale
   debug logs with proper telemetry (or delete).

### Tier 3 — feature polish (creative, but bounded)

10. **Keyboard shortcuts on dossier.**
    - `←` / `→` — prev/next unit
    - `c` — copy dealer phone
    - `m` — open Maps for dealer address
    - `Escape` — close modal
    Pure client; no Tauri changes. ~3k tokens.

11. **Print stylesheet for dossier.** Already works in WKWebView (free win).
    Verify by opening `Cmd+P` from the .app and checking the PDF preview.
    If layout breaks, add print-specific CSS. ~2k tokens.

12. **CrossSourceChip empty state.** Currently renders nothing if no
    cross-listing exists. Add a faint "—" tooltip "No matches found yet"
    so users know the system checked. ~1k tokens.

13. **Unit photo gallery keyboard.** Arrow keys to swipe, `Escape` to
    close lightbox, `f` to toggle fullscreen. ~2k tokens.

14. **Save-filter browser bookmark.** On `/inventory`, current filter state
    should be URL-encoded so `?make=Hyundai&model=Ioniq+5&tempC=-15` is
    bookmarkable. Audit; fix gaps. ~3k tokens.

15. **Compare tray persistence.** Already in localStorage (Zustand persist).
    Verify it survives a Tauri restart. If not, debug. ~2k tokens.

### Tier 4 — testing infrastructure (longer-running)

16. **Vitest setup.** No test runner currently installed. Add:
    ```
    npm install --save-dev vitest @vitest/ui
    ```
    Add `npm test` script. Write 1 test per:
    - `src/lib/thermal.ts` — known-good range calc at -10°C, 0°C, +20°C
    - `src/lib/scoring.ts:computeOtd` — known fixture vs known output
    - `src/lib/crossListings.ts` — VIN match + fallbackKey match
    ~10k tokens.

17. **Schema drift catcher.** Add a script that compares
    `data/units.json` against `src/lib/types.ts:UnitSchema`. Run nightly.
    Catches silent schema drift from cron. ~5k tokens.

### Tier 5 — documentation (any time)

18. **JSDoc on public types.** `src/lib/types.ts` — add 1-line `/** */`
    above each exported Zod schema describing what it represents.

19. **Component README.** For any component > 200 lines, a 5-line README
    next to it: what it renders, what props matter, what state it owns.

20. **Architecture diagram.** ASCII tree in `docs/ARCHITECTURE.md`:
    routes → components → hooks → libs → data. ~3k tokens.

### Tier 6 — speculative / wait for user (do NOT pick autonomously)

These need user input. Append to `docs/handoff/MEDIUM_RUNWAY.md` if
you discover something interesting; do NOT execute:

- Phase D-bis (Hyundai Click-to-Buy + Kia D2C Media)
- Phase E (OEM dealer API direct)
- Tauri sidecar / Rust IPC for Imperva-bypass fetch
- Custom domain on Vercel
- Mobile responsive pass

## Loop pattern

```
while not stopped:
    pick highest-priority unblocked task from ladder
    estimate token cost (must be < 15k for autonomous; > 15k → queue for user)
    execute
    run verification gauntlet
    if pass:
        git add <changed files>
        git commit -m "<tier>: <what>"
        git push origin HEAD
        append one line to TAURI_BUILD_LOG.md
    else:
        revert; document blocker in MEDIUM_RUNWAY.md; pick next task
    repeat
```

**Per-loop budget:** no hard cap. Medium tier is capable — pick tasks
that look interesting and useful, even if they run 30-50k tokens.
Mechanical wins ship fast; meatier refactors / test suites / new chips
are also fair game. If a task balloons unexpectedly past your initial
estimate, finish cleanly, commit, push, then assess in the next loop
whether to tackle similar-sized work or rotate to smaller items.

**Session budget:** no hard cap either. User said "until I say stop."
But every 100k cumulative tokens, append a checkpoint to
`docs/handoff/AUTONOMOUS_LOG.md` so the user can scan progress when they
come back. Format: `- <ISO>: <commits shipped> <highlights>`.

**Subagent dispatch is allowed.** If a task fits the explore agent
profile (search across 20+ files) or general-purpose pattern (multi-step
research), dispatch one. Default to sonnet model. Cap individual
dispatch at 70k tokens. Multiple dispatches in parallel are fine if
they're truly independent.

## Stop conditions (binding)

Halt + ping user when ANY fires:

- Tauri build fails twice on same root cause.
- `npm run predeploy` fails twice on same root cause.
- About to push something that touches > 15 files in one commit.
- About to install a new npm dep > 5MB.
- Discovered a security issue (auth bypass, data leak, etc.) — flag immediately.
- User typed anything in chat → halt next loop iteration, show what's done, wait.

## Resume protocol if interrupted

If a wakeup or new user message arrives mid-loop:

1. Finish the current commit cleanly. Don't leave a half-shipped change.
2. Push.
3. Read user message + `docs/handoff/MEDIUM_RUNWAY.md` for any flagged items.
4. Decide whether to continue the loop or pivot. If unclear: ask.

## Scheduling self-pings (optional)

If running fully unattended (user away from machine), set a CronCreate
or ScheduleWakeup so you check back in:

```
ScheduleWakeup delaySeconds=1800 reason="autonomous loop check-in"
  prompt="<<autonomous-loop-dynamic>>"
```

The `<<autonomous-loop-dynamic>>` sentinel re-enters this protocol with
full context. 30-minute cadence is reasonable: not so frequent that it
burns cache misses, not so sparse that real user input rots.

**DO NOT use the static `<<autonomous-loop>>` sentinel** — that's for
CronCreate-mode. ScheduleWakeup uses the `-dynamic` variant.

## What "creative" means here

You have wide latitude on Tier 2-5 items. "Creative" does NOT mean:

- Inventing new product features the user didn't ask for.
- Changing the design system or color palette.
- Refactoring large swaths of the app for taste reasons.
- Adding dependencies for hypothetical future needs.

"Creative" DOES mean:

- Spotting small UX wins the user would recognize as obvious-once-pointed-out.
- Catching dead code, stale comments, drift between docs and behavior.
- Writing tests around the parts that have caused bugs before (thermal model, OTD math).
- Documentation that helps the next session orient faster.
- Performance wins (bundle size, LCP, idle prefetch).

When in doubt: ship the small mechanical win. Skip the speculative big bet.

## Final note for the medium-tier session

You are not on a clock. The user vibe-codes; token-ROI is the only KPI.
A small, polished, committed win every 5-10k tokens beats a 50k-token
half-baked refactor that ships nothing. Trust that pattern, ship cleanly,
push every time, and the work queue self-grows useful follow-ups.

## When the ladder is "exhausted" (it never really is)

The Tier 1-5 ladder above is a starting menu, not a complete list. When
you've cycled through it once, GENERATE THE NEXT MENU. Sources:

1. **Re-walk Tier 1.** Routes change behavior over time. A walkthrough
   that found nothing yesterday may find a regression today.
2. **Re-grep `TODO(`, `FIXME`, `HACK`** across the repo — there's always
   someone (you, an earlier session) who left a marker that's now ripe.
3. **Stale data check.** `data/units.json` last refresh > 24h?
   `data/oem-pricing.json` lastVerified > 30 days? Refresh.
4. **Test coverage gap.** `find src/lib -name "*.ts" | grep -v test`
   — pick the largest untested file and write 3 tests for its
   most-used function.
5. **UX sweep.** Open the .app, click around for 5 minutes, find one
   thing that bugs you, fix it. (Examples: hover state missing,
   tooltip too slow, color contrast off, keyboard nav incomplete.)
6. **Performance.** `BUILD_TARGET=tauri npm run build:tauri:web`,
   inspect `out/_next/static/chunks/`, find the biggest, dynamic-import it.
7. **Documentation drift.** `docs/handoff/MEDIUM_RUNWAY.md`
   may be stale after your commits. Update it.
8. **Dataset enrichment.** `data/incentives.json` — any entries with
   `expiresAt` < today? Mark stale or refresh from OEM page.
9. **Component splits.** Any single file > 500 lines? Split it.
10. **A11y pass.** `aria-label` audit on icon-only buttons.

When the second pass through the ladder also produces nothing (rare —
usually you'll find at least one win per pass), invent the next layer:

- Ship a small new component that obviously belongs (e.g.,
  `<DealerHoursChip />` if dealer.json has hours).
- Wire a graph that's stub data into real data.
- Polish a chart's axis labels, gridlines, tooltip.
- Add a small admin page that surfaces refresh status, snapshot count,
  cron health — visible only in dev or behind a query param.

**The ONLY reasons to actually stop:**

1. User typed something in chat (highest priority).
2. Tauri build broken twice on the same root cause (CLAUDE.md stop).
3. Predeploy gate broken twice on same root cause (CLAUDE.md stop).
4. About to violate a Hard Rule above (code-signing, push to main, etc.).
5. Network is down and tasks need it (note in log; cycle to network-free tasks).

Otherwise: keep going. The user is happier finding 30 small commits and
a polished app when they return than a clean idle terminal.

## Self-pinging when truly stuck

If you genuinely cannot find a task (extremely rare), don't idle. Instead:

```
ScheduleWakeup delaySeconds=900 reason="autonomous mode — re-scan for work"
  prompt="<<autonomous-loop-dynamic>>"
```

15 minutes later, fresh re-scan: cron may have left new data, dependent
files may have refreshed, and your context is rotated. Treat the
wake-up as a new pass through the ladder.

## Final note

The user vibe-codes. Token-ROI is the KPI but they explicitly said no
time budget. Your job is to keep useful commits flowing. They will
catch up on what shipped when they return — frequent small commits with
clear messages let them grep `git log` and audit fast.

Keep going.
