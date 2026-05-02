# Plan v3 — ev-auto-trader-canada (post-prep re-plan, 2026-05-01)

> Supersedes v2. v2's Phases 0+1 + most of 2-prep shipped (commits
> `e28585d`, `c1d5f69`, `1914272`, `e70e42c`). v3 is the re-plan after live
> Chrome MCP probe findings reshaped the M12 fork and post-scan revealed
> task scope changes (L1 222→~40 rows, M9 4 callers not 8+, snapshot.mjs
> already captures stable IDs).

## Context

**Why this re-plan:** v2 prep work shipped. Live Chrome MCP probe
(commit `e70e42c`) confirmed AutoTrader's search-results SSR HTML carries
the full per-listing payload at `<script id="__NEXT_DATA__">` — but
`daysOnMarket` is NOT in that payload. Two GraphQL endpoints fire on the
same page that may carry it in their response bodies. Buying window is
1-2 weeks (cash, Ontario, Hyundai/Kia EVs). Critical-path discipline
required.

**What changed since v2:**
- `__NEXT_DATA__` SSR payload confirmed → `scripts/scrape_search_json.py`
  becomes the free default. Apify drops to last-resort role inside the
  $30 cap.
- Prep work shipped: stable SHA1 IDs (`u-at-<8hex>`), `msrpSource`
  provenance chip, `oem-pricing.json` envelope, `BuyerContext` schema +
  cookie + server helper with legacy fallback, `applicableIncentives`
  optional `buyerContext` param, dossier route scaffold with all 6
  sections, predeploy script.
- **Scan-time surprises:**
  - L1 heat-pump queue is 222 rows, not 20 (per (model, year, trim,
    drivetrain)). Filter to ~40 trims actually present in current
    `units.json` to scope realistically.
  - `getBuyerProvince` has 4 callers, not 8+. M9 is smaller than v2
    estimated.
  - `snapshot.mjs` already captures `listingUrl` + `daysOnLot` per row
    — snapshot-diff derivation of `daysOnMarket` is a real third path
    for M12, not last-resort.
  - `InventoryTable.tsx` empty-state row has `colSpan={14}` but header
    has 15 cols — off-by-one bug. Fix in M1.

**Decisions baked in (set by Q&A 2026-05-01):**
- M12 path: **free SSR + GraphQL/snapshot-diff for daysOnMarket**.
  Apify only as last resort within $30 cap.
- Sequence: **M9 (plumbing) → M10 (data) → M8 (UI)**. Each step
  independently shippable + verifiable.
- L1 scope: **filtered to trims in current units.json** (~40 rows).
- OEM MSRP refresh: **Exa-first, Chrome MCP fallback for ambiguity**.
- Predeploy hardening: **typecheck-only pre-commit hook** (3-5s) +
  full predeploy on cron.
- Stream E (Leasebusters): **green-lit as HIGH milestone**.
- Mom is not a user of this repo — UI stays single-audience.
- Buying window: same as v2 (1-2 weeks, all 4 nameplates).

## Critical path (12 milestones, in order)

### M0 [HIGH] — GraphQL response-body probe

**Goal:** decide daysOnMarket source for M12. ~5 min.

**Files touched:** `docs/CHROME_PROBE.md` (append findings).

**Steps:**
1. `mcp__Claude_in_Chrome__tabs_create_mcp` + `navigate` to
   `https://www.autotrader.ca/cars/?make=Hyundai&model=Ioniq+5&prv=Ontario`.
2. Install fetch-monkeypatch hook into `window.__capturedGql` BEFORE
   triggering pagination (the prior probe missed bodies because the hook
   was installed after page load).
3. Trigger pagination (click "next page" or change `rcp=` param) →
   harvest both GraphQL POST request + response bodies.
4. Inspect responses for `daysOnMarket` / `daysOnLot` / `listingDays` /
   `listedAt` / `created` / `firstSeen`-like fields.
5. Append findings to `docs/CHROME_PROBE.md` under a new "GraphQL
   response bodies" section with: endpoint URL, request body shape,
   response body shape, daysOnMarket finding (yes/no/unclear).

**Outcome branches:**
- **GraphQL has daysOnMarket** → M2 SSR scraper pairs with that GraphQL
  call. Skip M3.
- **GraphQL absent / unusable** → snapshot-diff (M3) becomes daysOnMarket
  source.
- **Both unsuitable** → one Apify run (~$0.75) inside the $30 cap. No
  re-authorization needed (within auto-execute matrix).

**Verification:** `docs/CHROME_PROBE.md` has a "GraphQL response bodies"
section committed with concrete finding.

---

### M1 [LOW] — Dossier link from row + colSpan fix

**Goal:** surface dossier from inventory table; fix colSpan off-by-one.

**Files:** `src/components/InventoryTable.tsx`.

**Steps:**
1. Add a "Dossier" cell to each row. Use Next `<Link
   href={\`/inventory/\${u.id}/dossier\`}>` (NOT plain `<a>`) for
   client-side nav.
2. Bump empty-state `<td colSpan={14}>` → `colSpan={15}` (current header
   has 15 `<th>` cells per scan).
3. If you add a visible "Dossier" column rather than squeezing into an
   existing actions cell, bump colSpan accordingly.

**Verification:** clicking dossier link from any row navigates to
`/inventory/[id]/dossier`; empty-state row spans full table width;
`npm run predeploy` clean.

**Estimate:** 10 min. Mechanical.

---

### M2 [HIGH] — Free SSR scraper (`scripts/scrape_search_json.py`)

**Goal:** replace Apify default with free `__NEXT_DATA__` extraction.
Ships every per-listing field SSR has, plus daysOnMarket if M0 found a
GraphQL source.

**Files (NEW):** `scripts/scrape_search_json.py`.

**Files (MODIFY):**
- `scripts/build_units_from_at.py` — adapt input shape if needed (the
  output should match what build_units_from_at currently consumes from
  `/tmp/at_listings.json`; if Apify produced a different shape, normalize
  here).
- `scripts/apify_to_enrichment.py` — if M0 found GraphQL daysOnMarket,
  add the field-mapping pipeline; otherwise unchanged.

**Steps:**
1. Per (make, model, province) tuple:
   - GET `https://www.autotrader.ca/cars/<make>/<model>/?prv=<Province>&rcp=<page>`
     with browser UA header.
   - Regex-extract `<script id="__NEXT_DATA__"[^>]*>(.*?)</script>`.
   - Parse JSON; pull `props.pageProps.listings[]`,
     `props.pageProps.numberOfPages`, `numberOfResults`.
2. Pagination loop: page 1 → numberOfPages. Sleep 3-5s between pages.
3. Per-province throttling: max 1 province at a time, 30s gap between
   provinces.
4. Per listing, normalize to the shape `build_units_from_at.py` already
   consumes:
   `{id (deferred to stable_id()), model, year, trim, mileage, price,
   dealer{name, phone, city, province, address}, listingUrl, ...}`.
5. **If M0 found GraphQL daysOnMarket:** also fire that GraphQL POST per
   page and merge `daysOnMarket` into per-listing output.
6. Write to `/tmp/at_listings.json`. Existing `build_units_from_at.py`
   reads this path → emits `data/units.json`.

**Verification:** `python3 scripts/scrape_search_json.py && python3
scripts/build_units_from_at.py` produces `data/units.json` with N >= 50
units for ON+H/K. If M0 succeeded, `daysOnLot` populated for >= 80% of
units. `npm run predeploy` clean.

---

### M3 [MEDIUM] — Snapshot-diff daysOnMarket fallback

**Skip if M0 found daysOnMarket in GraphQL.**

**Goal:** derive daysOnMarket from first-seen date per stable unit ID
across nightly snapshots.

**Files (NEW):** `scripts/derive_days_on_market.py`.

**Files (MODIFY):** `scripts/build_units_from_at.py` to consume the
derived field via the existing enrichment overlay pattern.

**Steps:**
1. Walk `data/snapshots/*.json` oldest → newest.
2. Per stable unit ID (`u-at-<8hex>`): record first-seen date (the
   `takenAt` of the earliest snapshot containing it).
3. `daysOnLot(today) = today - first_seen`.
4. Write to `data/units-enrichment.json` keyed by stable id (mirrors
   `apify_to_enrichment.py` overlay pattern).
5. `build_units_from_at.py` already reads enrichment overlay; daysOnLot
   gets picked up automatically.

**Caveat:** requires 2+ days of snapshots for any signal. Historical
snapshots may be sparse — first signal in 24-48 hours, full per-unit
history in 7+ days.

**Verification:** `data/units-enrichment.json` has `daysOnLot` for any
unit appearing in ≥2 snapshots; chip on InventoryTable shows derived
days.

---

### M4 [HIGH] — M9 cookie migration cutover

**Goal:** thread `BuyerContext` through 4 routes → `loadScoredUnits` →
`applicableIncentives`. No behavior change at first (loyalty/conquest
defaults to false, filter is no-op).

**Files:**
- `src/lib/data.ts` — `loadScoredUnits` signature
- `src/app/page.tsx`, `src/app/inventory/page.tsx`,
  `src/app/dealer/[id]/page.tsx`, `src/app/compare/page.tsx`
- `src/lib/buyerProvinceServer.ts` — **delete** (no shim per
  non-negotiable rule); update any remaining import to point to
  `buyerContextServer.ts`.

**Steps:**
1. Update `loadScoredUnits(...)` signature to accept
   `buyerContext?: BuyerContext`.
2. In each of the 4 routes:
   - Replace `const buyerProvince = await getBuyerProvince()` with
     `const buyerContext = await getBuyerContext()`.
   - Pass `buyerContext` into `loadScoredUnits`.
3. Inside `loadScoredUnits`: pass `buyerContext` into
   `applicableIncentives` (signature already supports it).
4. Keep `buyerProvince` exposed via the result object (sourced from
   `buyerContext.province`) so any downstream consumer of
   `loadScoredUnits().buyerProvince` doesn't break.
5. Delete `src/lib/buyerProvinceServer.ts`. Verify no remaining import.

**Verification:** `npm run predeploy` clean. With both checkboxes off
(default cookie state), score for any unit unchanged from current main.
Manual check: fetch `/inventory` before + after this commit, diff
scoreOrder of first 20 units → should be identical.

---

### M5 [MEDIUM] — M10 seed Hyundai/Kia loyalty + conquest in incentives.json

**Goal:** data prep for M6 toggle activation.

**Files:** `data/incentives.json`.

**Steps:**
1. `mcp__9a04470a__web_fetch_exa url:
   https://www.hyundaicanada.com/en/offers`
2. `mcp__9a04470a__web_fetch_exa url: https://www.kia.ca/en/offers`
3. Per loyalty/conquest promo found, add entry:
   ```json
   {
     "id": "hyundai-loyalty-2026-05",
     "name": "...",
     "scope": "loyalty",
     "amount": 500,
     "appliesTo": { "models": ["Ioniq5", "Ioniq6", "Ioniq9"] },
     "effectiveFrom": "2026-05-01",
     "effectiveUntil": "2026-05-31",
     "lastVerified": "2026-05-01",
     "source": "https://www.hyundaicanada.com/en/offers"
   }
   ```
   Schema is already typed for `scope: "loyalty" | "conquest" |
   "manufacturer_cash" | ...` — verify with `src/lib/types.ts`.

**Verification:** `data/incentives.json` has ≥2 loyalty + ≥2 conquest
entries spanning Hyundai + Kia EVs. `npm run predeploy` clean (Zod
validates on read).

---

### M6 [MEDIUM] — M8 BuyerContextSelector UI

**Goal:** activate the loyalty/conquest pipeline.

**Files:**
- Rename `src/components/BuyerProvinceSelector.tsx` →
  `src/components/BuyerContextSelector.tsx` (no shim).
- Update import in `src/components/Nav.tsx` (or wherever mounted —
  grep first).

**Steps:**
1. Rename file + import sites.
2. Replace internal `useBuyerProvince` (if any) with `useBuyerContext`
   from `@/lib/buyerContext`.
3. Render existing province dropdown PLUS two checkboxes:
   - "I currently own a Hyundai or Kia" (loyalty)
   - "I currently own a competing brand (Toyota / Honda / Tesla / etc.)"
     (conquest)
4. On any change: `setBuyerContext({ province, loyalty, conquest })`.

**Verification:** flip "I own a Hyundai" checkbox → applicable-incentive
count jumps for Ioniq 5/6/9 units in InventoryTable. Flip back → count
returns. `npm run predeploy` clean.

---

### M7 [MEDIUM] — M13 incentives refresh via Exa (broader scope)

**Goal:** keep all incentive math accurate during the buying window.

**Files:** `data/incentives.json`.

**Steps:**
1. Same Exa fetch pattern as M5 (broader: `manufacturer_cash` +
   provincial + federal entries too — anything in `data/incentives.json`).
2. Per existing entry: re-verify `effectiveUntil`, update
   `lastVerified` if URL still confirms.
3. Per new entry found: add per the schema in M5.

**Verification:** every entry in `data/incentives.json` has
`lastVerified` within 7 days. `npm run predeploy` clean.

---

### M8 [LOW] — L1-filtered heat-pump research queue

**Goal:** cut L1 from 222 rows to ~40 trims actually in current
`units.json`.

**Files (MODIFY):** `scripts/build_heatpump_queue.py`.
**Files (REGENERATE):** `data/heatpump-research-queue.json`.

**Steps:**
1. Add `--filter-by-units` flag to `scripts/build_heatpump_queue.py`.
2. When flag set: load `data/units.json`, build set of
   `(model, year, trim, drivetrain)` tuples present, filter the queue
   to that set.
3. Run `python3 scripts/build_heatpump_queue.py --filter-by-units`.

**Verification:** `jq 'length' data/heatpump-research-queue.json`
reports < 60 (down from 222).

---

### M9 [LOW] — L1 fill (filtered) + M7 UI chip wire-up

**Goal:** heat-pump signal in inventory + dossier.

**Files:**
- `data/heatpump-research-queue.json` (Exa-fill rows)
- `data/specs.json` (auto-write via existing
  `scripts/merge_heatpump_research.py`)
- `src/components/InventoryTable.tsx`
- `src/components/UnitDrawer.tsx`
- `src/app/inventory/[id]/dossier/page.tsx`

**Steps:**
1. Per row in the filtered queue:
   - `mcp__9a04470a__web_search_exa query: "<year> <model> <trim> <drivetrain> Canada heat pump standard"`
   - `mcp__9a04470a__web_fetch_exa url: <top OEM hit>` (hyundaicanada.com,
     kia.ca, evdb sites)
   - Fill `hasHeatPump` (true/false/null), `source`, `accessed`,
     `confidence` (High = OEM page; Medium = aggregator; Low = forum →
     leave null instead).
2. Run `python3 scripts/merge_heatpump_research.py` to write into
   `data/specs.json`.
3. **InventoryTable row:** read `spec.hasHeatPump` for the unit's
   (model, year, trim, drivetrain) via existing `specMap`. Render:
   - `true` → no chip (heat pump is the expected baseline)
   - `false` → red chip "No heat pump", title `"Trim ships with resistive
     heater only — expect 25-40% range loss below -10°C"`
   - `null/undefined` → grey chip "Heat pump?", title `"Not yet
     researched"`
4. **UnitDrawer:** same logic, larger chip in the spec section.
5. **Dossier Header section:** add line "Heat pump: yes/no/unknown".

**Verification:** ≥80% of rows in current `units.json` have non-null
`hasHeatPump` after merge. Chip renders correctly across InventoryTable,
UnitDrawer, Dossier. `npm run predeploy` clean.

---

### M10 [HIGH] — Stream E: Leasebusters integration

**Goal:** second listing source. Green-lit by user.

**Files (NEW):** `docs/LEASEBUSTERS_PROBE.md`,
`scripts/scrape_leasebusters.py`.
**Files (MODIFY):** `data/units.json` (merge target),
`src/components/InventoryTable.tsx` (source chip + filter toggle),
`src/lib/types.ts` (`InventoryUnit.source: "autotrader" | "leasebusters"`).

**Phase A — probe (~30 min):**
1. Chrome MCP probe of `leasebusters.com` listings filtered by
   Hyundai/Kia EVs.
2. Identify: SSR JSON / API endpoint / dedupe key (VIN preferred,
   listing URL fallback).
3. Document findings in `docs/LEASEBUSTERS_PROBE.md` matching the
   structure of `docs/CHROME_PROBE.md`.

**Phase B — scraper:**
4. Per probe results: scrape, transform to `units.json` shape, merge
   keyed by stable ID in a separate namespace (e.g.,
   `u-lb-<8hex>` to keep AT vs LB distinct).
5. Dedupe vs AutoTrader by VIN when both sources have one.

**Phase C — UI:**
6. Add `source` field to `InventoryUnit` Zod schema.
7. Render small source chip on each row: "AT" or "LB".
8. Add a filter toggle in `src/app/inventory/page.tsx`: "Show
   AutoTrader / Leasebusters / Both".

**Verification:** `data/units.json` has Leasebusters units alongside
AutoTrader. Row chip distinguishes. Dedupe doesn't double-count by VIN.
`npm run predeploy` clean.

---

### M11 [MEDIUM] — M14 daily refresh cron + typecheck pre-commit hook

**Goal:** sustain everything above; catch type errors at commit time.

**Files (NEW):**
- `scripts/refresh_daily.sh` (the cron command body)
- `.husky/pre-commit` OR `.git/hooks/pre-commit` (typecheck only)

**Files (MODIFY):** `package.json` if adopting `simple-git-hooks` (lighter
than husky, no postinstall step required).

**Steps:**

1. **Cron via OS-level scheduler** (NOT CronCreate, which is session-only
   per known risk):
   ```
   mcp__scheduled-tasks__create_scheduled_task
     schedule: "0 11 * * *"   (7am ET = 11 UTC during DST)
     command: |
       cd ~/ev-auto-trader-canada \
         && git pull --rebase origin main \
         && python3 scripts/scrape_search_json.py \
         && python3 scripts/build_units_from_at.py \
         && (M3 derive_days_on_market.py if used) \
         && node scripts/snapshot.mjs \
         && npm run predeploy \
         && git add data/ \
         && git commit -m "data refresh: $(date +%F)" \
         && git push origin main
     description: Daily AutoTrader refresh + snapshot + Vercel deploy
   ```

2. **Pre-commit hook:**
   - Adopt `simple-git-hooks` (one dep, no postinstall side effects).
   - `package.json` adds:
     ```json
     "simple-git-hooks": { "pre-commit": "npx tsc --noEmit" },
     "scripts": { "prepare": "simple-git-hooks" }
     ```
   - Run `npx simple-git-hooks` once to install.
   - Hook runs `npx tsc --noEmit` only (3-5s). Build stays on cron.
   - Document `--no-verify` escape hatch for WIP commits in
     `SESSION_HANDOFF.md`.

**Verification:** `mcp__scheduled-tasks__list_scheduled_tasks` shows
the daily job. Manual fire of cron command body succeeds end-to-end.
Test commit fires the hook and blocks on a deliberate TS error.

---

### M12 [HIGH] — OEM MSRP refresh (Phase 3.2)

**Goal:** refresh `oem-pricing.json` `lastVerified` per trim + catch any
new mid-year trims OEMs ship.

**Files:** `data/oem-pricing.json`, `scripts/refresh_oem_pricing.py`
(NEW).

**Steps:**
1. Per (make, model) pair:
   - `mcp__9a04470a__web_search_exa query: "<year> <make> <model> Canada
     MSRP trim prices"`
   - `mcp__9a04470a__web_fetch_exa url: <top OEM hit>`
2. Regex-parse trim/price table from page text. Common patterns:
   `<trim name>\s*\$?[\d,]+`.
3. Diff vs current `data/oem-pricing.json[<model>]`:
   - Match found + price unchanged: bump `lastVerified` only.
   - Match found + price changed: log delta, write new value, bump
     `lastVerified`.
   - Trim not in current: add new entry, log as new trim.
   - Trim in current but not in OEM page: leave existing value, set
     `staleSince: <today>`.
4. **For any model where Exa parsing yielded ambiguous results:**
   - Fall back to Chrome MCP probe of `hyundai.ca/showroom/<model>/configurator`
     or `kia.ca/our-vehicles/<model>`.
   - Manually walk the configurator UI; extract trim/price into the
     pricing JSON.

**Verification:** `data/oem-pricing.json` has `lastVerified` within 7
days for ≥90% of trims. Remaining ≤10% have `staleSince` flag for
manual follow-up. `npm run predeploy` clean.

---

## Risks & mitigations (carried from REPLAN_BRIEF + scan-time)

| Risk | Mitigation |
|---|---|
| Imperva blocks per-listing detail fetches after 6-8 requests | M2 SSR scraper hits search-results pages only (NOT gated). Per-listing detail not needed for shipped fields. |
| `daysOnMarket` missing from `__NEXT_DATA__` | M0 GraphQL probe + M3 snapshot-diff fallback + Apify last-resort within $30 cap. Three layers. |
| CronCreate is session-only despite `durable: true` | M11 uses `mcp__scheduled-tasks__create_scheduled_task` (OS-level), not CronCreate. |
| TS strict fails builds on unused imports | M11 adds typecheck pre-commit hook (3-5s) so this fails fast. |
| Zod schema additions must precede JSON additions | Each milestone with new fields lands schema first, data second. M4 already has schema shipped — data + UI to follow. |
| Trim parser whack-a-mole | Already partially shipped in `e28585d`. `msrpSource` chip surfaces remaining misses. M12 OEM refresh + chip-driven follow-up handle the long tail. |
| Cross-repo cwd trap | Every Bash starts with `cd ~/ev-auto-trader-canada &&` or uses absolute paths. SESSION_HANDOFF top-of-doc warning. |
| L1 scope explosion (222 rows) | M8 filters to ~40 trims actually in current units.json before M9 fill. |
| Snapshot-diff requires 7+ days of history | M3 only ships if M0 fails. Daily cron (M11) ensures going-forward; historical sparseness is a one-week tax not a blocker. |

## Pause-vs-proceed (auto-execute matrix)

**Auto-execute (no Ian pause):**
- Reads/writes anywhere under `~/ev-auto-trader-canada`
- `git add/commit/push origin main` on `barsnbolts/ev-auto-trader-canada`
- All `mcp__Apify__*` calls **up to $30 cumulative**
- All `mcp__9a04470a__*` (Exa) calls
- All `mcp__Claude_in_Chrome__*`, `mcp__scheduled-tasks__*`, Vercel MCP
- Auto-write to `data/specs.json`, `data/incentives.json`,
  `data/oem-pricing.json` from research

**Pause for explicit ok:**
- Apify spend exceeding **$50 cumulative**
- Force-push, branch deletion, history rewrite
- OAuth flows
- Touching any other repo (especially `~/Documents/Claude/Projects/EV
  dashboard`)
- `CronCreate` recurring jobs (use OS-level `scheduled-tasks` instead)
- Schema changes invalidating existing snapshots

## Verification gates (per milestone)

- **After M0:** `docs/CHROME_PROBE.md` has GraphQL response-bodies
  section with concrete daysOnMarket finding.
- **After M1:** dossier link clickable from any row; empty-state colSpan
  matches header; predeploy clean.
- **After M2 (or M3 if M0 fell through):** `data/units.json` has
  `daysOnLot` populated for ≥80/97 units; predeploy clean.
- **After M4-M6 chain:** loyalty checkbox flip → applicable-incentive
  count jumps for matching units; flip back → count returns.
- **After M7-M9:** every entry in `data/incentives.json` has
  `lastVerified` within 7 days; heat-pump chip surfaces in InventoryTable
  + UnitDrawer + Dossier.
- **After M10:** Leasebusters units alongside AutoTrader in
  `data/units.json`; row chip distinguishes; no VIN dupes.
- **After M11:** scheduled task listed; manual fire succeeds;
  pre-commit hook blocks on deliberate TS error.
- **After M12:** `data/oem-pricing.json` `lastVerified` within 7 days
  for ≥90% of trims.

## Token / time estimates

| Milestone | Reasoning | Estimate |
|---|---|---|
| M0 | HIGH | 5 min wall, 3-5 turns |
| M1 | LOW | 10 min wall, 1-2 turns (Sonnet) |
| M2 | HIGH | 90 min wall, 8-12 turns |
| M3 (conditional) | MEDIUM | 30 min wall, 3-5 turns |
| M4 | HIGH | 45 min wall, 5-8 turns |
| M5 | MEDIUM | 25 min wall, 2-3 turns |
| M6 | MEDIUM | 25 min wall, 3-4 turns |
| M7 | MEDIUM | 20 min wall, 2-3 turns |
| M8 | LOW | 15 min wall, 1-2 turns (Sonnet) |
| M9 | LOW (Exa-heavy) | 60 min wall, ~80-120 Exa calls |
| M10 | HIGH | 2-3 hr wall, 12-18 turns |
| M11 | MEDIUM | 15 min wall, 2-3 turns |
| M12 | HIGH | 60 min wall, 6-10 turns |
| **Total** | mixed | ~75-95 chat turns, $0-3 Apify |

## Reasoning-level routing summary

| Tag | Milestones | Use for |
|---|---|---|
| LOW (Sonnet) | M1, M8, M9 (the Exa fill — mechanical) | Mechanical edits, queue fills, Exa loops |
| MEDIUM | M3, M5, M6, M7, M11 | Schema/UI threading, data seeding, infra setup |
| HIGH (Opus) | M0, M2, M4, M10, M12 | Probe design, new scraper architecture, schema cutover, new source integration, OEM crawl |
