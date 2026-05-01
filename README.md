# EV Auto Trader Canada

Personal-use website that tracks **new Kia EV6, Hyundai Ioniq 5, and Hyundai
Ioniq 6** inventory, prices, dealer-pressure signals, and incentives across
Canada — with the Greater Toronto Area / Greater Golden Horseshoe prioritized.

## Pages

- **/** — dashboard with per-model KPIs, top deals, high-pressure dealers,
  national stock by province
- **/inventory** — every tracked unit, filterable by model / year / trim /
  drivetrain / region / max OTD / dealer-pressure threshold; sortable by
  deal score, OTD, discount-vs-MSRP, days-on-lot
- **/compare** — pick 2–4 specific units, view OTD math, deal-score
  components, and applicable incentives side-by-side
- **/incentives** — federal (iZEV), provincial rebates, manufacturer cash,
  loyalty, lease/finance promos, home-charger rebates
- **/history** — line charts of inventory count and average asking price
  over time, plus a snapshot ledger

## Architecture

- **Framework**: Next.js 15 App Router, React 19, TypeScript strict
- **Styling**: Tailwind CSS 3, dark mode default
- **Data**: static JSON files under `/data` validated with zod
- **Charts**: recharts
- **No database**, no auth, no notifications — single-user shopping tool

```
data/
  dealers.json       # Kia + Hyundai dealers across Canada
  units.json         # Per-VIN inventory, including demo + in-transit
  incentives.json    # Federal / provincial / manufacturer / financing / charger
  snapshots/         # Timestamped inventory snapshots for history charts
src/
  app/               # Routes
  components/        # KpiTile, DealScoreBadge, InventoryTable, CompareGrid, …
  lib/               # types, scoring, data loaders, aggregations
research-prompts/    # Copy-paste briefs for ChatGPT / Gemini deep research
scripts/snapshot.mjs # `npm run snapshot` → appends current inventory to /data/snapshots
```

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
npm run snapshot # capture current inventory as a historical data point
npm run typecheck
npm run build
```

## Refreshing data

1. Open one of `research-prompts/*.md`.
2. Paste the full file into ChatGPT (with Browse / Deep Research) or Gemini
   (with Search Grounding).
3. The model returns strict JSON matching the schemas in `src/lib/types.ts`.
4. Drop the JSON into the matching `/data/*.json` file.
5. `npm run snapshot` to record a history point.

See `PROGRESS.md` for the rolling work queue and refresh priorities.

## Caveman skill

The project ships with the [caveman](https://github.com/JuliusBrussee/caveman)
skill at `.claude/skills/caveman/`. Activate with `/caveman` to switch the
agent into ultra-terse mode — useful when iterating quickly on data refreshes.

## Out of scope

- User accounts / per-user save lists
- Live email/SMS price-drop notifications
- Charging-station maps / trip planning
- Used-EV market data
