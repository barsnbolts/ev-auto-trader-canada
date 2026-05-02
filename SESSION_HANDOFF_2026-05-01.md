# SESSION_HANDOFF — 2026-05-01

> **CROSS-REPO CWD TRAP — READ FIRST.** A previous Claude Code session ran
> with cwd `~/Documents/Claude/Projects/EV dashboard` (an unrelated
> personal-use Mac app with 4,783 lines of uncommitted work). That repo
> shares no code or data with this one. Do **NOT** `cd` into it. Do **NOT**
> run git against it. Verify cwd ends in `/ev-auto-trader-canada` and remote
> is `barsnbolts/ev-auto-trader-canada` before any shell or git operation.

## Where we are

- **Branch:** `main`
- **Latest commit (pushed):** `e70e42c docs: chrome probe findings — __NEXT_DATA__.props.pageProps.listings confirmed; daysOnMarket gap documented`
- **Predeploy status:** clean as of 2026-05-01 (`npm run predeploy` →
  typecheck + Next build, all 7 routes generated)
- **Working tree:** clean after the docs commit + push
- **HIGH-prep tasks shipped in `1914272`:** scaffolds for Phase 2/3.1/4.1/4.3
  — dossier route, loyalty/conquest schema, heat-pump skeleton,
  Apify/Chrome runbooks
- **CHROME_PROBE.md findings committed in `e70e42c`** — see Probe section
  below

## What changed this session

1. Live Chrome MCP probe of AutoTrader.ca search-results page
2. Confirmed SSR payload at `<script id="__NEXT_DATA__">` carries the full
   first-page listing array (20 listings/page) including dealer phone,
   address, vehicle, location, mileage, price, images
3. Documented the **`daysOnMarket` gap**: that field is NOT in the SSR
   payload. Only `statistics.leadsRange` (a leads-count bucket) and
   `tracking.firstRegistration` (vehicle's first-reg date, NOT listing
   date) are present
4. Captured two GraphQL POST endpoints firing on page load:
   - `https://listing-search.api.autoscout24.com/graphql` (200)
   - `https://www.autotrader.ca/listing-search-api/graphql` (200)
   Their request/response bodies were NOT captured (would need the fetch
   hook installed BEFORE pagination triggers a fresh call). 5-minute
   follow-up probe could close the daysOnMarket gap before falling through
   to Apify.

## The M12 fork

Two paths still on the table for filling daysOnMarket + per-listing
detail:

- **(a) Free __NEXT_DATA__ scraper:** Write `scripts/scrape_search_json.py`
  using the Python snippet in `docs/CHROME_PROBE.md`. Fetches the search
  HTML, extracts `__NEXT_DATA__`, emits `/tmp/at_listings.json`.
  - Pros: $0, no actor account, kills Imperva per-listing problem
  - Cons: NO daysOnMarket. Need snapshot-diff derivation (stable IDs
    already shipped in `c1d5f69`) or GraphQL probe to recover it.

- **(b) Apify actor:** `calm_builder/autotrader-canada` (~$0.75/run, $30
  cumulative cap pre-authorized). Canned input at
  `docs/apify_inputs/ontario_full.json`, transform script at
  `scripts/apify_to_enrichment.py`.
  - Pros: ships daysOnMarket directly + VIN + colors
  - Cons: per-run cost; need to track spend cumulatively

**Decision: pending re-plan.** The 5-min GraphQL response-body probe could
make this trivially path (a) + free daysOnMarket → no Apify needed.

## Half-shipped: cookie migration

`getBuyerContext()` exists in `src/lib/buyerContextServer.ts`. NO caller
uses it yet. M9 in MEDIUM_NEXT.md is the cutover. Until M9 ships, the
loyalty/conquest filter logic added in `1914272` is **dead code** —
`applicableIncentives()` accepts the new context param but no caller
threads it through.

This is not a regression — legacy `getBuyerProvince()` still works and
`buyerProvince` field is still populated. But scoring will not improve from
the loyalty/conquest schema until M9 lands.

## Pointers

- **v2 plan:** `~/.claude/plans/you-are-continuing-the-shiny-pixel.md`
- **Mechanical task queues:**
  - `MEDIUM_NEXT.md` — M7 through M14
  - `LOW_NEXT.md` — L1 (heatpump research queue fill)
  - `BLOCKERS_MEDIUM.md` — live blockers (HIGH-only)
  - `NEXT.md` — long-form HIGH+MEDIUM queue with "Shipped 2026-05-02"
    section pre-populated for the prep work
- **Probe runbook + findings:** `docs/CHROME_PROBE.md`
- **Apify runbook:** `docs/APIFY_AUTOTRADER.md`
- **Replan input:** `REPLAN_BRIEF.md` (this session)

## Verbatim user directives still in force

- **Caveman mode internal** — drop articles/filler; tech terms exact; code
  blocks unchanged. User-facing UI copy stays natural English.
- **Force context collapse at 250k** — proactively `/compact` before that
  ceiling.
- **Prefer LOW/Sonnet for mechanical work** — anything in `LOW_NEXT.md` and
  most of `MEDIUM_NEXT.md` should not burn HIGH-reasoning Opus turns.
- **Keep TodoWrite current** — every multi-step task tracked, exactly one
  in_progress at a time.

## Pause-vs-proceed rules

**Auto-execute (no Ian pause):**
- Reads/writes anywhere under `~/ev-auto-trader-canada`
- `git add/commit/push origin main` on `barsnbolts/ev-auto-trader-canada`
- All `mcp__Apify__*` calls **up to $30 cumulative**
- All `mcp__9a04470a__*` (Exa) calls
- All `mcp__Claude_in_Chrome__*`, `mcp__scheduled-tasks__*`, Vercel MCP
  calls
- Auto-write to `data/specs.json`, `data/incentives.json`,
  `data/oem-pricing.json` from research

**Pause for explicit ok:**
- Apify spend exceeding **$50 cumulative**
- Force-push, branch deletion, history rewrite
- OAuth flows (Vercel re-auth, GitHub re-auth)
- Touching any other repo (especially `~/Documents/Claude/Projects/EV
  dashboard`)
- Schedule jobs that depend on Claude Code running (`CronCreate` with
  `durable: true` does NOT actually persist across CC restarts — see
  Risks below)
- Schema changes that would invalidate existing snapshots beyond the
  stable-ID migration shipped in `c1d5f69`

## Risks the next session must remember

- **Imperva blocks per-listing detail fetches** after 6-8 requests. The
  search-results SSR HTML page is **NOT** gated.
- **`daysOnMarket` missing from `__NEXT_DATA__`** — only `leadsRange`
  bucket present. Three paths: GraphQL response-body probe, Apify, or
  snapshot-diff derivation from stable IDs.
- **CronCreate is session-only despite `durable: true`** — recurring jobs
  scheduled inside Claude Code do NOT survive a CC restart. Use OS-level
  cron (e.g., `mcp__scheduled-tasks__create_scheduled_task`) for anything
  that must persist.
- **TS strict + `noUnusedLocals` / `noUnusedParameters`** fail builds on
  unused imports — predeploy will catch but not before commit unless
  staged.
- **Zod schema additions must precede JSON additions** or runtime parse
  fails on first read.
- **Trim parser whack-a-mole** — Ioniq9 Calligraphy/Performance + Ioniq5
  "Ultimate Package" still collapse to base trims (65/97 units show ask >
  MSRP). Phase 1.4 in v2 plan.
