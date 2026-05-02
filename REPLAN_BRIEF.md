# REPLAN_BRIEF — input doc for /superpowers:brainstorm

> **Purpose:** scope + non-negotiables + open decisions for the next
> Claude Code session to re-plan remaining work on
> `~/ev-auto-trader-canada` after the 2026-05-01 wrap-up. Feed this to
> `/superpowers:brainstorm` first thing.

---

## A. Scope to re-plan

Remaining work, expressed as task IDs from the existing queues:

- **L1** — fill `data/heatpump-research-queue.json` (20 rows via Exa)
- **M7** — wire heat-pump UI chip (depends on L1)
- **M8** — loyalty/conquest checkboxes in `BuyerProvinceSelector`
- **M9** — migrate `getBuyerProvince` callers to `getBuyerContext`
- **M10** — seed Hyundai/Kia loyalty + conquest entries in
  `data/incentives.json`
- **M11** — add Dossier link from InventoryTable rows
- **M12** — fork: Apify scrape OR `scripts/scrape_search_json.py`
- **M13** — refresh incentives via Exa
- **M14** — schedule daily refresh cron
- **HIGH** — OEM MSRP refresh (Phase 3.2 in v2 plan)
- **HIGH (NEW)** — 5-minute GraphQL response-body probe to recover
  `daysOnMarket` before deciding M12 path

**Do NOT re-plan** anything in `NEXT.md`'s "Shipped 2026-05-02" section
(stable IDs, MSRP source chip, predeploy gate, dossier scaffold,
buyerContext schema, etc.).

---

## B. Non-negotiables (do NOT relitigate)

- Next.js 15 App Router, TS strict, Zod at boundaries, JSON-file storage
- SHA1-based stable unit IDs (`u-at-<8hex>` from `listingUrl`) — already
  shipped in `c1d5f69`
- Cookie migration direction: legacy `buyer-province` (string cookie) →
  `buyer-context` (JSON cookie). `getBuyerContext()` with
  legacy-fallback **already shipped** in `1914272`. M9 is the cutover.
- `applicableIncentives()` accepts an optional `buyerContext` param; this
  signature is fixed
- `DEFAULT_MSRP` lives in `data/oem-pricing.json` with a `lastVerified`
  envelope, NOT inline in `scripts/build_units_from_at.py`
- Apify actor pinned: `calm_builder/autotrader-canada`, $0.75/run, $30
  cumulative cap
- Reasoning-level routing tags (`[LOW]` / `[MEDIUM]` / `[HIGH]`) stay on
  every output task
- Predeploy gate (`npm run typecheck && npm run build`) before any
  commit-on-cron
- No backwards-compat shims for renames; delete cleanly
- Auto-commit/push pre-authorized for `ev-auto-trader-canada` main only

---

## C. Decisions that need fresh HIGH-reasoning thought

1. **M12 fork resolution.** Free `__NEXT_DATA__` scraper vs Apify vs
   hybrid (free for fields the SSR has, Apify for daysOnMarket only).
   Probe findings (commit `e70e42c`) changed the math. Worth burning a
   HIGH turn on this.

2. **5-min GraphQL response-body probe BEFORE deciding M12.** If
   `daysOnMarket` is in either GraphQL response, the M12 fork collapses
   to "free path always." Should this be the literal first task after
   re-plan, or is it part of M12 itself?

3. **M8 → M9 sequencing.** Cookie migration touches 8+ callers
   (`src/app/page.tsx`, `inventory/page.tsx`, `compare/page.tsx`,
   `dealer/[id]/page.tsx`, etc.). One big PR or staged migration?
   Loyalty/conquest filters are dead code until M9 ships, so the
   sequencing affects when M10's incentives can be verified end-to-end.

4. **OEM MSRP refresh approach.** Exa-only, Chrome MCP, or hybrid? The
   trim parser collapse (65/97 units ask > MSRP) interacts here — does
   fixing the parser (Phase 1.4) change the answer to "MSRP refresh is
   less urgent because the chip will surface real misses"?

5. **Order-of-operations for the buying-window critical path.** Which
   3-4 tasks materially improve Ian's negotiation position in the next
   1-2 weeks vs which are nice-to-have polish? The dossier route is
   shipped (route exists, link from row pending in M11). What's the
   minimum set that gets him a printable per-unit dossier with real
   daysOnMarket and accurate MSRP?

---

## D. Known risks the plan must account for

- **Imperva** blocks per-listing detail fetches after 6-8 requests
  (search-results pages are **NOT** gated)
- **`daysOnMarket` missing** from `__NEXT_DATA__` — only `leadsRange`
  bucket and vehicle's `firstRegistration` (NOT listing date) present
- **CronCreate is session-only** despite `durable: true` flag —
  recurring jobs scheduled inside Claude Code do not survive a CC
  restart. M14 must use `mcp__scheduled-tasks__create_scheduled_task`
  (OS-level cron), not CronCreate.
- **TS strict** fails builds on unused imports (`noUnusedLocals` +
  `noUnusedParameters` both on)
- **Zod schema additions must precede JSON additions** or runtime parse
  fails on first read
- **Trim parser whack-a-mole** — Ioniq9 Calligraphy/Performance +
  Ioniq5 "Ultimate Package" still collapse to base trims (65/97 units
  ask > MSRP)

---

## E. Questions the brainstorm skill should ask Ian first

1. **Buying window status.** Still 1-2 weeks? Anything narrowed (specific
   trim, specific dealer cluster, geographic radius)?
2. **Apify spend appetite.** Willing to burn $3-5 (4-6 runs) if
   `daysOnMarket` meaningfully changes negotiation, or stay free-tier?
3. **Mom-as-secondary-user.** Does she need anything specific in the
   dossier or table, or just observing?
4. **Stream E (Leasebusters integration, ~130k subagent tokens).**
   Green-light for this re-plan or defer?
5. **Predeploy hardening.** Add a pre-commit hook, or keep cron-only
   enforcement?

---

## F. Explicitly out of scope for this re-plan

- Photos / Wikipedia Commons resolution
- iZEV federal program revival
- Tesla Model Y Juniper
- Snapshot-diff-derived `daysOnLot` (only if neither GraphQL nor Apify
  pans out)
- Anything in the EV dashboard repo (`~/Documents/Claude/Projects/EV
  dashboard`)
- Code signing, notarization, distribution infra (not a shipped product)
