# M0→M12 Plan (Reconstructed)

> The canonical plan was at `~/.claude/plans/you-are-continuing-the-shiny-pixel.md`
> on the Mac and was never committed. This file reconstructs the task
> intent from the user's daytime brief + repo docs. Where the brief was
> silent (M1, M5, M7, M8) the inferred mapping below is best-effort and
> may need correction by the user.

## Tasks with explicit overrides

### M0 [HIGH] — GraphQL response-body probe (Chrome MCP)
Install fetch+XHR hook BEFORE first navigation. Trigger pagination via
filter change AND `rcp=` param AND Display dropdown if needed. If 0
captures after 3 trigger attempts, mark "GraphQL unusable" and proceed
to M3 path.

**Goal:** capture `daysOnMarket` from one of the two GraphQL endpoints
firing on AutoTrader search-results page load (see
`docs/CHROME_PROBE.md`):
- `https://listing-search.api.autoscout24.com/graphql`
- `https://www.autotrader.ca/listing-search-api/graphql`

**Outcome decides M3:** if `daysOnMarket` found, M3 skipped; else M3 ships
snapshot-diff derivation.

**Sandbox status:** TOOL UNAVAILABLE (no Chrome MCP). Run from Mac.

### M2 [HIGH] — Apify ON+H/K scrape
Throttle 3-5s/page + 30s gap between provinces. ON+H/K only:
Ioniq5/6/9 + Kia EV6/EV9/Niro EV. Actor:
`calm_builder/autotrader-canada` (~$0.75/run, $30 cumulative cap).

**Sandbox status:** TOOL UNAVAILABLE (no Apify MCP). Run from Mac.

### M3 — snapshot-diff daysOnMarket derivation
Skip if M0 found daysOnMarket; otherwise ship snapshot-diff. Stable IDs
(`u-at-<8hex>` from `listingUrl` SHA1) already shipped in `c1d5f69`.
Snapshot files exist at `data/snapshots/YYYY-MM-DD.json`.

**Logic:** for each unit `u`, `daysOnMarket(today) = today - first_seen(u.id)`
where `first_seen` is the earliest snapshot containing that ID.

### M4 [HIGH] — Cookie migration
4 callers: `src/app/page.tsx`, `src/app/inventory/page.tsx`,
`src/app/dealer/[id]/page.tsx`, `src/app/compare/page.tsx`.
- Migrate `getBuyerProvince` (from `src/lib/buyerProvinceServer.ts`) to
  `getBuyerContext` (from `src/lib/buyerContextServer.ts`).
- Update `loadScoredUnits` signature to take `buyerContext?: BuyerContext`
  and pass into `applicableIncentives`. Keep `buyerProvince` field on
  returned object populated from `buyerContext.province`.
- Delete `src/lib/buyerProvinceServer.ts`.
- **Verify:** scoreOrder of first 20 units identical pre/post.

### M6 — File rename
`src/components/BuyerProvinceSelector.tsx` → `BuyerContextSelector.tsx`.
No shim. Grep import sites first (`src/components/Nav.tsx` likely).

### M9 — Heatpump fill (L1 queue)
Fill `data/heatpump-research-queue.json` via Exa per
`LOW_NEXT.md`. Confidence=Low → leave `hasHeatPump: null`, don't fill.
Then run `python3 scripts/merge_heatpump_research.py`.

### M10 Phase A — Leasebusters probe doc
Write `docs/LEASEBUSTERS_PROBE.md`. PAUSE for user before Phase B/C.

### M11 — Scheduled refresh + simple-git-hooks
Use `mcp__scheduled-tasks__create_scheduled_task` (NOT CronCreate).
Adopt `simple-git-hooks` for typecheck pre-commit.

**Sandbox status:** scheduled-tasks MCP unavailable. simple-git-hooks
adoption is doable in sandbox; cron registration must run from Mac.

### M12 [HIGH] — OEM MSRP refresh
Exa-first via `mcp__9a04470a__web_fetch_exa` against:
- `https://www.hyundaicanada.com/en` configurators
- `https://www.kia.ca/en` configurators

Update `data/oem-pricing.json` `lastVerified` envelope. Chrome MCP
fallback only on ambiguous trims (sandbox: no fallback). Mark
`staleSince` for misses.

## Tasks without overrides (inferred)

These task IDs appear in the user's "Strict serial M0→M12" rule but had
no override. Best-effort inference:

- **M1** — likely a prep step for M2 (regenerate `data/heatpump-research-queue.json`
  via `scripts/build_heatpump_queue.py`, OR seed buyer-context schema).
  **Needs user confirmation.**
- **M5** — likely a UI/component step between M4 (migration) and M6
  (rename). Possibly the `useBuyerContext()` hook wire-up in Nav, or
  the BuyerContextSelector component body refactor (per MEDIUM_NEXT M8
  description). **Needs user confirmation.**
- **M7** — possibly the heat-pump UI chip in row + drawer + dossier
  (matches MEDIUM_NEXT M7). **Needs user confirmation.**
- **M8** — possibly the loyalty/conquest checkboxes in the renamed
  `BuyerContextSelector` (matches MEDIUM_NEXT M8). **Needs user
  confirmation.**

## ID mapping vs MEDIUM_NEXT.md

`MEDIUM_NEXT.md` uses M7-M14 numbering distinct from the M0-M12 plan:

| MEDIUM_NEXT | Likely M0-M12 equivalent |
|---|---|
| M7 (heatpump UI chip) | M7 (inferred) |
| M8 (loyalty/conquest UI) | M8 (inferred) |
| M9 (cookie migration) | M4 ✓ |
| M10 (loyalty/conquest incentives seed) | M10 Phase B (paused) |
| M11 (dossier link) | ? |
| M12 (Apify scrape) | M2 ✓ |
| M13 (refresh incentives) | ? |
| M14 (daily cron) | M11 ✓ |
