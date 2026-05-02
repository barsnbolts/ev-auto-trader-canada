# Post-HIGH resume pointer (2026-05-02)

> Drop this into the next session's first read. HIGH pass closed; the
> remaining work is mechanical and lives in `MEDIUM_NEXT.md` /
> `LOW_NEXT.md`. Drop reasoning to **medium** before continuing.

## Where we are

- **HEAD (pushed):** `c6e8e3c8`
- **Branch:** `claude/verify-environment-setup-oTu3S`
- **Working tree at handoff:** clean except for this doc + the
  enriched `MEDIUM_NEXT.md` / `LOW_NEXT.md` updates (commit them with
  this file).

## What HIGH pass shipped (2026-05-02)

| Milestone | Commit | Result |
|-----------|--------|--------|
| **M0** GraphQL probe | `83c6d5a6` (closed `c2a064ce`) | UNUSABLE — `__NEXT_DATA__` schema has `availability.inDays` but always null on `/offers/`. Snapshot-diff (M16 below) is the daysOnMarket source. |
| **M9** Heatpump queue | `babbe4fe` | 20/20 rows at High confidence. Kia side resolved by reading the official 2025 Canadian brochure PDFs directly (URL pattern documented). |
| **M10A** Leasebusters probe doc | `dd023dfb` | `docs/LEASEBUSTERS_PROBE.md` shipped. **PAUSED** for user go-ahead before Phase B (scraper) / C (UI). |
| **M12-schema** OEM pricing migration | `053e9e96` | `data/oem-pricing.json` now nested per-trim `{value, lastVerified, source, staleSince}`. Build script `scripts/build_units_from_at.py:180-184` patched to extract `entry["value"]`. Round-trip verified — `data/units.json` shows zero MSRP drift. |
| **M4** Cookie migration | `c6e8e3c8` | `getBuyerContext` threaded through 4 routes + dossier. `loadScoredUnits` accepts `BuyerContext` OR legacy `Province`. `buyerProvinceServer.ts` deleted. Predeploy clean. |

## What's next, in order — drop to MEDIUM here

1. **M15** — Per-trim Canadian MSRP refresh via brochure PDFs / showroom pages. Schema is migrated; values need refresh. Full instructions + URL pattern in `MEDIUM_NEXT.md` §M15. ~30-45 min.
2. **M8** (existing in `MEDIUM_NEXT.md`) — Selector rename `BuyerProvinceSelector.tsx` → `BuyerContextSelector.tsx` + add loyalty/conquest checkboxes. ~25 min.
3. **M16** — Snapshot-diff `daysOnLot` script (`scripts/derive_days_on_market.py`). Full source pasteable from plan §5/M3. ~30-45 min.
4. **M14** (existing in `MEDIUM_NEXT.md`) — Daily refresh cron via `mcp__scheduled-tasks__create_scheduled_task`. ~5 min.
5. **M17** — `simple-git-hooks` pre-commit (typecheck-only). ~10 min.
6. **M12 paid sample** (was M2 in plan) — Apify ON+H/K sample. **ASK USER FIRST** before firing. Cap $5 for sample, $30 cumulative. ~15 min wall + actor wait.
7. **M10** (existing) — Seed Hyundai/Kia loyalty + conquest incentive entries.
8. **M11** (existing) — Add Dossier link column to InventoryTable.
9. **M13** (existing) — Refresh general incentives via Exa.

After all of these land, the next HIGH-tier batch is **M13 cash/finance/lease comparison** (plan §12) — the lease-buyer pivot the user flagged on 2026-05-02.

## Optimization wins captured during HIGH pass

1. **Read tool reads PDFs natively** — for OEM brochures, this is far cheaper than Chrome MCP for content extraction. URL pattern for Kia Canada: `https://www.kia.ca/content/dam/marketing/content/vehicles/brochures/<MY>/<model>/MY<YY>_<MODEL>_ENG.pdf`.
2. **WebFetch** — built-in Claude tool that fetches HTML and runs a small model on it with a prompt. Use this instead of Chrome MCP for OEM showroom pages where the content is server-rendered. (Caveat: the kia.ca electric-cars index hit `maxContentLength` — fetch model pages directly.)
3. **One-shot Bash heredoc Python migrations** — for one-time JSON shape transformations (like the M12 schema migration), don't persist a script. Run inline, verify, throw away.
4. **Schema migration on HIGH, value refresh on MEDIUM** — splitting M12 this way unblocks medium without forcing it to make schema decisions.
5. **Parallel Read calls** — load all related files for a multi-file edit in ONE message before starting edits. Cuts round-trips from N to 1.

## MCPs confirmed available

- Chrome MCP (`mcp__Claude_in_Chrome__*`) — Browser 1, macOS, isLocal=true. **Prefer Read+WebFetch+Bash for content extraction; Chrome MCP only when DOM interaction is required.**
- Apify (`mcp__Apify__*`) — loadable via ToolSearch
- scheduled-tasks (`mcp__scheduled-tasks__*`) — loadable
- Exa (`mcp__9a04470a-c5be-420d-a32b-adaaa7f50b13__*`) — used for M9 Hyundai side (some kia.ca URLs returned CRAWL_NOT_FOUND; brochure-PDF path bypassed this)

## Reasoning tier guidance

- **Medium reasoning** for everything in the "next" list above.
- **Low / Sonnet** for `LOW_NEXT.md` L2 (Canadian MSRP fill — pure mechanical).
- **High only if** a task in `MEDIUM_NEXT.md` reveals architecture/judgment that wasn't in the spec — STOP and surface it.

## Key context

- Plan source of truth: `docs/handoff/EXECUTION_PLAN_2026-05-02.md` (in-repo, committed) AND `/Users/ianmcadam/.claude/plans/you-are-the-planning-floating-breeze.md` (mac-local).
- Apify spend cap $30 cumulative; **must ask user before first paid run.**
- Branch stays on `claude/verify-environment-setup-oTu3S`. Never push to main, never `--no-verify`, never amend, never force-push.
- Predeploy gate (`npm run predeploy`) before every push. **Docs-only commits skip it** (LEASEBUSTERS_PROBE was docs-only and committed without predeploy — that pattern is fine).

## Files shipped this HIGH pass

- `docs/handoff/research/M0_findings_2026-05-02.md` (M0 closure)
- `docs/handoff/research/M0_graphql_2026-05-02.json` (M0 raw captures)
- `docs/CHROME_PROBE.md` (M0 GraphQL section appended)
- `docs/handoff/research/M9_heatpump_2026-05-02.md` (M9 closure log)
- `data/heatpump-research-queue.json` (M9 — 20/20 filled)
- `data/specs.json` (M9 — heatpump fields merged)
- `docs/LEASEBUSTERS_PROBE.md` (M10A scaffold)
- `data/oem-pricing.json` (M12-schema — Option B nested)
- `scripts/build_units_from_at.py` (M12-schema — extract `entry["value"]`)
- `data/units.json` (M12 + M9 + daily date drift)
- `src/lib/data.ts` (M4 — `loadScoredUnits` widened)
- `src/lib/buyerContextServer.ts` (M4 — dropped unused `getBuyerProvinceFromContext`)
- `src/lib/buyerProvinceServer.ts` **(M4 — DELETED)**
- `src/app/page.tsx`, `src/app/inventory/page.tsx`, `src/app/dealer/[id]/page.tsx`, `src/app/compare/page.tsx`, `src/app/inventory/[id]/dossier/page.tsx` (M4)
- `MEDIUM_NEXT.md` / `LOW_NEXT.md` (handoff enrichment)
- `docs/handoff/POST_HIGH_RESUME_2026-05-02.md` (this file)
