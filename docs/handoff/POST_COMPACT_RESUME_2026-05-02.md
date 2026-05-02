# Post-compact resume pointer (2026-05-02)

> Drop this into the next session's first read so it can pick up exactly
> where pre-compact left off without re-doing M0 or M9 research.

## Where we are

- **HEAD (pushed):** `83c6d5a6` (post-M0 commit)
- **Branch:** `claude/verify-environment-setup-oTu3S`
- **Working tree at compact time:** untracked `docs/handoff/research/M9_heatpump_2026-05-02.md`,
  `docs/handoff/POST_COMPACT_RESUME_2026-05-02.md`. No other diff.

## What's done

| Task                                                | Status                                                  |
|-----------------------------------------------------|---------------------------------------------------------|
| Bootstrap + tsconfig exclude + plan copy            | ✅ committed `cd2936e6`, pushed                          |
| **M0 GraphQL probe**                                | ✅ closed at `83c6d5a6` — snapshot-diff is the path. See `docs/CHROME_PROBE.md` and `docs/handoff/research/M0_findings_2026-05-02.md` |
| **M9 heatpump research**                            | 80% done. Hyundai trims fully resolved (all STANDARD). Kia trims need Canada-specific verification. See `docs/handoff/research/M9_heatpump_2026-05-02.md` for the provisional fill plan. |

## What's next, in order

1. **Finish M9** — fetch kia.ca EV6 + EV9 spec pages via Chrome MCP (Exa
   returned CRAWL_NOT_FOUND on those URLs). Use the table in
   `M9_heatpump_2026-05-02.md` "Provisional fill plan" — confirm Canada
   matches US, then write `data/heatpump-research-queue.json` and run
   `python3 scripts/merge_heatpump_research.py`. Commit + push.
2. **M12** — OEM MSRP refresh via Exa, schema migration to Option B
   (nested `{value, lastVerified, source, staleSince}` per trim), patch
   `scripts/build_units_from_at.py:180-184`. See plan §5/M12.
3. **M4** — Cookie migration cutover. Call-site map already in plan §5/M4.
4. **M6** — Selector rename + loyalty/conquest checkboxes. Plan §5/M6.
5. **M3** — Snapshot-diff daysOnMarket script. Algorithm in plan §5/M3
   (full Python source ready to paste).
6. **M10 Phase A** — Write `docs/LEASEBUSTERS_PROBE.md`, then PAUSE.
7. **M11** — `simple-git-hooks` typecheck pre-commit + scheduled-tasks
   cron registration.
8. **M2** — Apify sample (~$0.10), ASK before firing.

## Reasoning tier

User switched from extra-high → high mid-session. Continue on **high**
through M9 finish + M12 + M4 + M6, then drop to **medium** for M3 / M10A
/ M11 / M2.

User instruction: "pause every time you need me to switch reasoning."
So: when ready to drop to medium, ask first.

## MCPs confirmed available

- Chrome MCP (`mcp__Claude_in_Chrome__*`) — Browser 1, macOS, isLocal=true
- Apify (`mcp__Apify__*`) — loadable via ToolSearch
- scheduled-tasks (`mcp__scheduled-tasks__*`) — loadable
- Exa (`mcp__9a04470a-c5be-420d-a32b-adaaa7f50b13__*`) — used heavily for M9

## Key context

- Plan source of truth: `docs/handoff/EXECUTION_PLAN_2026-05-02.md` (in-repo, committed)
  AND `/Users/ianmcadam/.claude/plans/you-are-the-planning-floating-breeze.md` (mac-local).
- M0 finding: AutoTrader `/offers/` URLs all have `availability.inDays = null`. SSR has
  the schema but never the value. **Snapshot-diff (M3) is the daysOnMarket source.**
- M2 implication: Apify input MUST use path-form URLs (`/cars/kia/ev6/on/`); query-param
  `?model=` is silently ignored by AutoTrader.
- M12 schema: Option B chosen (per user). Migrate `oem-pricing.json` to nested
  `msrp: { Model: { Trim: { value, lastVerified, source, staleSince } } }` AND
  patch `build_units_from_at.py:180-184` to do `{trim: entry.value}` comprehension.
- New scope (per user 2026-05-02): cash/finance/lease comparison — tracked as M13
  in the plan §12, not blocking M0–M12.

## Predeploy gate state

Last clean predeploy: post-tsconfig fix (commit `cd2936e6`). The exclude
list now skips `docs/handoff/{superpowers,sibling-checkouts,mac-context}`
from typecheck.

## Files written this session

- `tsconfig.json` (modified — exclude list)
- `docs/handoff/EXECUTION_PLAN_2026-05-02.md` (created from planner)
- `docs/CHROME_PROBE.md` (appended GraphQL findings)
- `docs/handoff/research/M0_findings_2026-05-02.md` (created)
- `docs/handoff/research/M0_graphql_2026-05-02.json` (created)
- `docs/handoff/research/M9_heatpump_2026-05-02.md` (created — partial)
- `docs/handoff/POST_COMPACT_RESUME_2026-05-02.md` (this file)
