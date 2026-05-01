# PROGRESS — agent handoff (do not optimize for human reading)

Reader: future Claude/Opus session resuming this repo cold. Trust this file
over speculation; verify with `git log` and `find` if state seems off.

---

## 0. Cold-start (run these first, in order)

```bash
cd /home/user/ev-auto-trader-canada
git status                                         # expect clean working tree
git log --oneline -5                               # confirm last commit matches §10
ls data/                                           # expect: dealers.json incentives.json snapshots units.json
test -d node_modules || npm install                # ~50s if missing
npx tsc --noEmit                                   # MUST pass silent
npx next build                                     # MUST end "Generating static pages (8/8)"
```

Branch lock: `claude/ev-inventory-tracker-3IwyA`. Never push to `main`. Never
amend pushed commits. Always `git push -u origin claude/ev-inventory-tracker-3IwyA`
(retry up to 4× with 2s/4s/8s/16s backoff on network errors only).

---

## 1. Decisions captured (do NOT re-ask the user)

| Topic | Decision | Source turn |
|---|---|---|
| Home location | Greater Toronto Area, Ontario | batch 1 |
| Local view radius | Entire Greater Golden Horseshoe (Toronto + Hamilton + KW + Niagara) — see `GGH_CITIES` in `src/lib/constants.ts` | batch 2 |
| Stack | Next.js 15 App Router · TS strict · Tailwind 3 · zod · recharts | batch 1 |
| Hosting | Local dev only (`npm run dev`); no Vercel/CF yet | batch 5 |
| Data refresh | Manual + hybrid (research-prompts + future scripts) | batch 1 |
| Trim depth | Every trim + powertrain incl. EV6 GT, Ioniq 5 N, demo cars, 2024 leftovers | batches 2, 6 |
| Inventory grain | Per-VIN row, not aggregated counts | batch 2 |
| National data | Full per-VIN nationwide (1.5–3k rows expected at full scale) | batch 2 |
| Unit fields | year, trim, ext+int color, MSRP+freight/PDI+dealer price, VIN+stock#+days on lot. NOT status (omitted by user multi-select but I added `status` enum anyway because in_transit/demo/loaner are useful — keep) | batch 2 |
| Pricing math | Full Ontario OTD: MSRP + freight/PDI + AC tax + RDPRM + OMVIC + tire stewardship + HST | batch 3 |
| iZEV federal | Show as PAUSED with last-known $5,000; user said "double-check" — research prompt 03 must verify current status from tc.canada.ca | batch 3 |
| Incentives tracked | federal + all provincial + manufacturer cash + loyalty/conquest + lease/finance APR + ON home-charger rebates | batch 3 |
| Refresh cadence | On-demand only (user runs research when shopping) | batch 3 |
| Visual style | Dark mode, Linear/Vercel minimal, data-dense | batch 4 |
| Landing | Dashboard with KPI tiles + filterable table | batch 4 |
| Filters | model + year + trim + drivetrain + price range + province/city + color + days-on-lot + in-transit/in-stock + dealer pressure score | batch 4 |
| Comparison | 2–4 unit side-by-side: specs, range, charging, OTD, lease/finance | batch 4 |
| Device | Desktop-first, mobile-functional | batch 5 |
| History | Per-refresh snapshot saved; trend charts per trim | batch 5 |
| Out of scope | No auth, no notifications, no charging maps, no used market | batch 5 |
| Research delivery | Markdown files in `/research-prompts/`, one per category, plus index | batch 6 |
| Research output | Strict JSON matching schemas in `src/lib/types.ts` | batch 6 |
| Deal score | 0–100 composite of price-vs-MSRP + days-on-lot + dealer-pressure + incentive-stack | batch 6 |
| Loop / cron | DROPPED. User opted out. Do not re-attempt unless they re-ask. | turn after batch 6 |

---

## 2. Repo map

```
ev-auto-trader-canada/
├ .claude/
│  ├ commands/                  # /caveman, /caveman-init/-commit/-review (TOML)
│  └ skills/caveman/SKILL.md    # active when user says /caveman
├ data/                         # JSON, zod-validated on load
│  ├ dealers.json               # 22 entries (sample) → target full Canadian network
│  ├ incentives.json            # 18 entries
│  ├ snapshots/YYYY-MM-DD.json  # history points (2 seeded)
│  └ units.json                 # 28 entries (sample)
├ research-prompts/             # copy-paste briefs for ChatGPT/Gemini
│  ├ README.md                  # workflow index
│  ├ 01-inventory-gta.md        # → units.json (GGH subset)
│  ├ 02-inventory-canada.md     # → units.json (rest of CA)
│  ├ 03-incentives.md           # → incentives.json (incl. iZEV verify)
│  ├ 04-dealers.md              # → dealers.json
│  └ 05-specs-and-trims.md      # → data/specs.json (NOT YET CREATED — see §6)
├ scripts/snapshot.mjs          # `npm run snapshot` → data/snapshots/<today>.json
├ src/
│  ├ app/
│  │  ├ layout.tsx              # root, dark mode, header+nav+footer
│  │  ├ globals.css             # Tailwind + .card/.chip-*/.num/.nav-link
│  │  ├ page.tsx                # dashboard (server)
│  │  ├ inventory/page.tsx      # server, hands data to <InventoryTable> (client)
│  │  ├ compare/page.tsx        # server, hands data to <CompareGrid> (client)
│  │  ├ incentives/page.tsx     # server, full server-rendered
│  │  └ history/page.tsx        # server, hands data to chart clients
│  ├ components/
│  │  ├ Nav.tsx                 # client, usePathname for active state
│  │  ├ KpiTile.tsx             # server-safe, no hooks
│  │  ├ DealScoreBadge.tsx      # server-safe
│  │  ├ StatusChip.tsx          # server-safe
│  │  ├ InventoryTable.tsx      # client, all filter+sort state local
│  │  ├ CompareGrid.tsx         # client, picks 2–4 from list
│  │  └ HistoryCharts.tsx       # client, recharts
│  └ lib/
│     ├ types.ts                # zod schemas + ScoredUnit type
│     ├ constants.ts            # MODELS, TRIMS_BY_MODEL, GGH_CITIES, PROVINCE_TAX, ON_DEALER_FEES
│     ├ scoring.ts              # computeOtd, applicableIncentives, dealerPressureIndex, computeDealScore
│     ├ format.ts               # fmtCad, fmtPercent, fmtDate, relativeDays
│     ├ data.ts                 # SERVER-ONLY loader; loadScoredUnits is THE entry point
│     └ aggregations.ts         # dealerPressureMap, computeKpis, provinceRollup, inGGH
├ next.config.mjs               # minimal; reactStrictMode only (typedRoutes removed §3)
├ tailwind.config.ts            # dark theme tokens (bg/border/fg/accent/warn/bad)
└ tsconfig.json                 # paths: @/* → ./src/*, @/data/* → ./data/*
```

Total LOC src/: 1,535 (per `wc -l` 2026-05-01).

---

## 3. Gotchas already learned (do not repeat)

1. **typedRoutes**: removed from `next.config.mjs`. Re-enabling breaks
   `<Link href={l.href}>` in `Nav.tsx` because `l.href: string` does not
   satisfy `RouteImpl<string>`. If a future change wants type-safe routes,
   either cast (`as Route`) or change `LINKS` to use string-literal types.
2. **`next-env.d.ts`**: Next.js auto-injects `/// <reference path="./.next/types/routes.d.ts" />`
   when `.next/` exists. Don't strip it; ignore the "modified by linter"
   notice.
3. **`server-only` import**: `src/lib/data.ts` imports `"server-only"`. Never
   import this file from a `"use client"` component. UI clients receive
   data through props from the server page wrapper.
4. **Map across server→client boundary**: `dealerById: Map<string, Dealer>` is
   serializable in RSC — but `src/app/inventory/page.tsx:11-13` has a
   no-op shuffle (Map → Object → Map). Safe but ugly; collapse next time
   the file is touched.
5. **HST math**: `scoring.ts:computeOtd` applies HST to (asking + freight +
   AC excise tax). RDPRM/OMVIC/tire/licensing are added post-tax. Verify
   against actual CRA + Ontario MTO guidance before claiming "true OTD" in
   marketing copy. Currently labelled honestly as "Full OTD" in UI.
6. **Trim name validation**: `units.json` trims must match
   `TRIMS_BY_MODEL[model]` strings exactly (case-sensitive). No runtime
   check enforces this — schema accepts any string. Add a refinement to
   `InventoryUnitSchema` in `types.ts` if drift becomes a problem.
7. **Sample data dates**: Hardcoded around 2025-04 / 2025-05 for the deal-
   score / days-on-lot signals to feel realistic. When real data lands,
   replace wholesale rather than patching dates.
8. **Pressure-score quirk**: `dealerPressureIndex` returns 0 if a dealer has
   no other units of the same trim. So a dealer with one aging GT-Line will
   score 0 for that unit — by design (single-unit ≠ leverageable cluster),
   but worth knowing if numbers feel low.
9. **2024 leftovers**: `u-009` (EV6 GT-Line, 165 days) and `u-019`
   (Ioniq 6 Limited, 188 days) demonstrate aging stock. No UI badge for
   "outgoing model year"; consider adding to `StatusChip` neighbor.
10. **Recharts color scheme**: hard-coded hex in `HistoryCharts.tsx`
    (`#6ee7b7`, `#fbbf24`, `#60a5fa`). If theme tokens change in
    `tailwind.config.ts`, update both.

---

## 4. Up next — priority queue (do topmost; then update §10)

1. **Smoke-test in browser.** Run `npm run dev`, hit
   `/`, `/inventory`, `/compare`, `/incentives`, `/history`. Check filter
   interactions on `/inventory` (model select should narrow rows; sort
   change should reorder; Pressure-only checkbox should empty the list when
   no dealer ≥ 50). Click 2 units in `/compare` → side-by-side appears.
   Dark mode is the only mode; verify no flash of light.
2. **Run research-prompt 03 (incentives) — HIGHEST VALUE.** User flagged
   iZEV status as needing verification. Output goes into
   `data/incentives.json` wholesale; bump every `lastVerified` to today.
   Surface the prompt to the user in chat (file path + a one-line
   "paste this into ChatGPT with web browsing").
3. **Run research-prompt 04 (dealers).** Target: ≥80 dealers covering all
   GGH cities listed in `GGH_CITIES`, plus Vancouver, Calgary, Edmonton,
   Montreal, Quebec City, Halifax, Winnipeg, Ottawa.
4. **Run research-prompt 01 (GTA inventory).** Replace `data/units.json`
   wholesale. Preserve `u-XXX` id format; restart numbering at `u-001`.
5. **Run research-prompt 02 (rest of Canada inventory).** Append at
   `u-101+`. Watch for `_newDealers` array — merge into `dealers.json`
   FIRST, otherwise unit ingest will fail the foreign-key check at
   `data.ts:loadScoredUnits` (throws "references unknown dealer").
6. **Run research-prompt 05 (specs).** Currently writes to a `data/specs.json`
   that doesn't exist yet. When implementing:
   - Extend `src/lib/types.ts` with `SpecSchema` (one row per model+year+trim).
   - Add `loadSpecs()` to `data.ts`.
   - Plug into `CompareGrid.tsx` so range/kWh/0-100/cargo render in the
     side-by-side table (currently absent — `ROWS` only has owned-unit fields).
7. **`npm run snapshot`** after each refresh.
8. **Per-unit detail drawer** (UX polish). Click a row in `InventoryTable`
   → slide-in showing OTD breakdown, applicable incentives, dealer block,
   and a "negotiation talking points" generator (re-uses `caveman` skill).
9. **Map view** (UX polish). Add `/map` route with `react-leaflet` or a
   Mapbox embed; pin color = dealer pressure score from
   `dealerPressureMap`.
10. **Per-section "last updated" stamps**: `loadMeta` returns mtimes; the
    dashboard surfaces them. The inventory and incentives pages should
    show them too — currently only the dashboard does.
11. **Outgoing-MY badge**: any unit with `year < currentYear - 0` AND
    `daysOnLot > 90` deserves a chip in `InventoryTable` ("Aging MY24") to
    surface the deepest discounts.

---

## 5. Refresh workflow (verbatim, for each `0X-*.md` prompt)

1. Read the prompt file end-to-end so you know what schema to expect back.
2. Surface the prompt to the user with: file path, one-line summary, and an
   "open in ChatGPT with web browsing / Gemini with grounding" instruction.
3. User pastes the JSON back.
4. Validate: parse JSON, run through the matching zod schema in
   `types.ts`. Report errors specifically (field path + reason).
5. If `_newDealers` array present (prompts 01/02): merge into
   `dealers.json` BEFORE writing units.
6. Replace the relevant `/data/*.json` wholesale. Preserve sort order
   (units by id ascending; dealers by province → city → brand;
   incentives by scope-then-name).
7. `npx tsc --noEmit && npx next build` — must still pass.
8. `npm run snapshot` to capture history.
9. Commit: `data refresh: <category> (<source-of-truth date>)`.
10. Push (with retry policy in §0).

---

## 6. Schema invariants (enforced by `src/lib/types.ts`)

- `Dealer.id`: kebab-case, brand prefix. Format: `kia-<city>` or
  `hyundai-<city>`. Disambiguate same-city duplicates with suffix
  (`hyundai-mississauga-dixie`).
- `InventoryUnit.dealerId`: foreign key to `Dealer.id`. `data.ts` throws on
  orphan reference.
- `InventoryUnit.year`: literal 2024 | 2025 | 2026.
- `InventoryUnit.model`: literal "EV6" | "Ioniq5" | "Ioniq6".
- `InventoryUnit.drivetrain`: literal "RWD" | "AWD".
- `InventoryUnit.status`: enum (in_stock | in_transit | demo | loaner | sold_pending).
- `Incentive.status`: enum (active | paused | ended | upcoming).
- `Incentive.scope`: 8-value enum (federal, provincial, manufacturer_cash,
  loyalty, conquest, lease_promo, finance_promo, charger_install).
- `lastVerified`: ISO date string (`YYYY-MM-DD`), required.
- All currency: number, no symbol, no commas, CAD assumed.

---

## 7. Commands cheat-sheet

| Command | Purpose | Expected exit |
|---|---|---|
| `npm install` | install deps | 0, ~50s |
| `npm run dev` | local dev server :3000 | runs until killed |
| `npx tsc --noEmit` | type check only | 0, silent on success |
| `npx next build` | static prerender all 8 routes | 0, "Generating static pages (8/8)" |
| `npm run snapshot` | append `data/snapshots/<today>.json` | 0, prints relpath + count |
| `npm run lint` | next lint | 0 |

---

## 8. Caveman skill (already installed)

- `.claude/skills/caveman/SKILL.md` — full skill definition, six intensity
  levels (lite/full/ultra/wenyan-lite/-full/-ultra), default `full`.
- `.claude/commands/caveman.toml` etc. — slash commands.
- Activate with `/caveman` or `/caveman lite|ultra` etc.
- Persistence: stays on until "stop caveman" / "normal mode".
- Auto-clarity: drop caveman for security warnings, irreversible-action
  confirms, multi-step sequences where fragment order matters.

---

## 9. Out of scope (do NOT build unless user explicitly re-asks)

- User accounts / auth / saved searches
- Email/SMS/push notifications
- Charging-station maps or trip planning
- Used-EV market data
- Auto-resume cron / `/loop`
- Multi-user / cloud database
- Hosting setup (Vercel/CF) — user said "local-only for now"

---

## 10. Run log (newest first)

- **2026-05-01 — Polish batch (commits `c57f6a4` … `f270c4c`).**
  - `c57f6a4` per-unit detail drawer (`src/components/UnitDrawer.tsx`)
    with full OTD breakdown, applicable incentives, dealer block,
    caveman-style negotiation email anchored on days-on-lot, dealer
    pressure score, and cheapest comparable unit (model+year+trim).
    Copy-to-clipboard.
  - `ed2c3a2` dashboard model-mix stacked bars (GGH + Canada-wide).
  - `2bc3d86` /history snapshot ledger Δ count + Δ avg price columns.
  - `6f47135` /inventory CSV export of currently-filtered units
    (RFC 4180 quoted, filename `ev-inventory-YYYYMMDD.csv`).
  - `3cb92f5` /map route (react-leaflet + leaflet deps added).
    Dealer pins sized by inventory depth, colored by pressure score.
    Wrapped in `DealerMapClient` with `ssr:false` next/dynamic so the
    static page still prerenders.
  - `4e3843e` inventory free-text search (trim/color/VIN/dealer);
    `CURRENT_MY` now derived from `Math.max(...SUPPORTED_YEARS)`.
  - `910d88a` compare-page best-cell highlighting per ranked row.
  - `a356fb8` shareable per-unit URLs (`/inventory?u=<id>`); dashboard
    "Top deals" rows now link with `&region=all` so non-GGH deals
    aren't filtered away.
  - `f270c4c` active-filter chip readout on /inventory with one-click
    clear-all.
- **2026-05-01 — Specs scaffold + URL filter state (`de996dd`).**
  Added `SpecSchema` + `loadSpecs/specMap/specKey`; CompareGrid now
  surfaces range/kWh/charge/0–100/cargo/weight/seats when
  `data/specs.json` exists (empty-array fallback otherwise). Added
  `UpdatedStamp` to /inventory, /incentives, /history. URL-persisted
  filter state on /inventory.
- **2026-05-01 — Mega-prompt for Deep Research (`8cb8d4e`).**
  `research-prompts/00-deep-research-bundle.md` consolidates dealers,
  specs, incentivesDelta, taxesAndFees, marketIntel, inventory,
  _meta into one ChatGPT-DR prompt. Pending: user runs DR, brings
  back JSON, we split + validate + merge.
- **2026-05-01 — Incentives refresh (`0f2f727`).** All 18 incentives
  bumped `lastVerified: 2026-05-01`.
- **2026-05-01 — Initial scaffold.** Commits `7f7e1e7` (initial empty),
  `1ddcd58` (full scaffold), `cd1edfd` (drop loop refs from this doc).
  Built: configs, all schemas, scoring, sample data (22 dealers / 28 units
  / 18 incentives / 2 snapshots), 5 pages + 7 components, 5 research
  prompts, snapshot script, caveman skill install, this PROGRESS.md and
  README.md. `npx tsc --noEmit` and `npx next build` both clean. Branch
  pushed to origin.

### Status as of HEAD

- Routes: 6 (`/`, `/inventory`, `/compare`, `/incentives`,
  `/history`, `/map`). All `force-static`, build clean (8/8
  prerender count includes Next internals).
- Components: 10 in `src/components/`.
- Deps added beyond original scaffold: `react-leaflet`, `leaflet`,
  `@types/leaflet`.
- Sample data unchanged (22 dealers / 28 units / 18 incentives /
  2 snapshots) — waiting for DR JSON to wholesale-replace.

---

## 11. When in doubt

- File you can't find → run `find . -type f -name '<glob>' ! -path './node_modules/*' ! -path './.next/*'`
- Behavior unclear → read `src/lib/types.ts` first (schema = truth)
- Visual broken → inspect `src/app/globals.css` for the `.card`/`.chip-*`
  utility classes, then the affected component
- Type error → it's almost always a Map serialization issue at the RSC
  boundary or a missing `InventoryUnit` field after a manual JSON edit
- User says "show me the prompt" → cat the matching `research-prompts/0X-*.md`
  to chat verbatim, do not paraphrase
