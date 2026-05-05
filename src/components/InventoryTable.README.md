# InventoryTable

The flagship table on `/inventory`. Renders every scored EV unit nationally
(default) or filtered to GGH / Ontario / a specific province. ~875 lines.

## What it renders

A sortable, filterable, exportable table of `ScoredUnit[]` rows.
Columns: model + year + trim, dealer, OTD math, deal score, mini-chips
(EVAP eligibility, heat pump, winter range, dealer pressure, freshness,
ICCU recall flag, aging outgoing year, photo gallery).

Above the table: filter bar (model / year / drivetrain / region / max
price / favorites / pressure-only / dealer-pressure-min), sort selector,
"Updated X ago" timestamp, CSV export, "Open in compare" CTA.

## Props (`Props` type at top of file)

| Prop | Shape | Source |
|---|---|---|
| `units` | `ScoredUnit[]` | `loadScoredUnits(buyerContext)` server-side |
| `dealerById` | `Map<string, Dealer>` | derived in route page |
| `dealerPressureByDealer` | `Record<string, number>` | `dealerPressureMap` (aggregations.ts) |
| `rangeByUnitId` | `Map<string, RangeSummary>` | thermal model output, server-side |
| `specByUnitId` | `Map<string, Spec>` | spec lookup pre-resolved on server |
| `buyerContext` | `BuyerContext` | cookie-backed buyer profile |

## State it owns

11 `useState` hooks: model, year, drivetrain, region, maxPrice,
pressureOnly, favoritesOnly, dealerPressureMin, sortKey, page (pagination),
photoGalleryUnitId (for `<UnitPhotoGallery>` modal). All filter state
round-trips through URL search params (so a saved/shared link restores
exact filter state).

## What it depends on

- `@/lib/types` — `ScoredUnit`, `Dealer`, `Spec`, `BuyerContext`
- `@/lib/scoring` — `evapEligibleAmount`, `dealerPressureIndex`
- `@/lib/format` — `fmtCad`, `fmtPercent`, `fmtDate`
- `@/lib/usedListingsLinks` — for the AutoTrader / Kijiji / Leasebusters chips
- `@/components/UnitPhotoGallery` — opens a lightbox on photo click
- `@/components/CrossSourceChip` — cross-listing price-delta indicator
- `data/vehicle-images.json` — hero image per (model, year)
- `data/cross-listings.json` (read indirectly via lookupCrossSource)

## What depends on it

Only `src/app/inventory/page.tsx` renders this component directly. CSV
export hooks call back into `usedListingsLinks` for the deep-link columns.
The data-unit-id attribute is the stable test selector for vitest +
future Playwright integration tests.

## Performance notes

Recharts not used here. CrossSourceChip + UnitPhotoGallery both
client-only with empty fallback to keep first paint clean. Pressure /
freshness chips use plain spans with conditional Tailwind classes — no
lazy-load needed.

`InventoryTable` is the perf-sensitive root for `/inventory`. If a
column starts importing a charting lib, wrap it in `dynamic(() => …,
{ ssr: false })` or revisit perf.
