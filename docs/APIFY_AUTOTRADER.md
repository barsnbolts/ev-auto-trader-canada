# Apify AutoTrader scrape — operator notes

**Status (2026-05-02):** Pre-resolved actor + cost ceiling. Run on demand.
Reasoning level for execution: **MEDIUM** (input is canned, output transform
is a scripted merge). HIGH only if the actor changes shape.

## Why this exists

`scripts/build_units_from_at.py` reads `/tmp/at_listings.json`, which today is
hand-paste from one search-result page. AutoTrader's per-listing HTML is
gated by Imperva after 6-8 hits — see `BLOCKERS_MEDIUM.md`. Apify bypasses
the gate using residential proxies + a maintained scraper.

## Picked actor

[`calm_builder/autotrader-canada`](https://apify.com/calm_builder/autotrader-canada)

| Why | Notes |
|---|---|
| 100% success rate | last 30 days |
| Canadian residential proxies | survives Imperva |
| `fetchDetails` toggle | returns daysOnLot + VIN + dealer phone in one run |
| Pay-per-event pricing | $0.001 actor start + $0.0005/listing + ~$0.001/detail |
| Supports multiple search URLs in one run | one run = all 5 nameplates |

**Cost cap for a typical run:** 5 search URLs × 100 listings × ($0.0005 list +
$0.001 detail) + $0.001 start = **~$0.75 per refresh**. Way under the $50
cumulative spend gate from the v2 plan.

## Runtime input shape

```jsonc
{
  "startUrls": [
    { "url": "https://www.autotrader.ca/cars/hyundai/ioniq+5/on/?rcp=100&rcs=0" },
    { "url": "https://www.autotrader.ca/cars/hyundai/ioniq+6/on/?rcp=100&rcs=0" },
    { "url": "https://www.autotrader.ca/cars/hyundai/ioniq+9/on/?rcp=100&rcs=0" },
    { "url": "https://www.autotrader.ca/cars/kia/ev6/on/?rcp=100&rcs=0" },
    { "url": "https://www.autotrader.ca/cars/kia/ev9/on/?rcp=100&rcs=0" }
  ],
  "maxListings": 100,
  "fetchDetails": true,
  "scrapeNewListings": false
}
```

For a national run, drop `/on/` from each URL.

## Output → enrichment merge

The actor writes to its dataset. Pull via `mcp__Apify__get-actor-output`,
pipe through `scripts/apify_to_enrichment.py` which:

1. Reads stdin (or `--input <path>`) JSON array of Apify dataset items
2. Maps each item by `vin || stockNumber || listingUrl` to a units.json id
3. Emits a merge into `data/units-enrichment.json` keyed on stable unit id
4. Preserves any hand-curated enrichment fields not in Apify output

## Operator command sequence (medium can run this verbatim)

```bash
# 1. Trigger the run
mcp__Apify__call-actor calm_builder/autotrader-canada \
  --input @docs/apify_inputs/ontario_full.json

# 2. Wait for run to finish (poll get-actor-run for status === SUCCEEDED)

# 3. Download dataset
mcp__Apify__get-actor-output <runId> > /tmp/apify_at.json

# 4. Merge into enrichment
python3 scripts/apify_to_enrichment.py --input /tmp/apify_at.json

# 5. Re-build units.json so the new daysOnLot / VIN flow into the dashboard
python3 scripts/build_units_from_at.py

# 6. Commit + push
git add data/ && git commit -m "data refresh via apify $(date +%F)" && git push
```

## When to escalate to HIGH

- Actor input schema changes — re-run `mcp__Apify__fetch-actor-details`
  and update this doc.
- AutoTrader URL pattern changes (Hyundai/Kia rename a model URL).
- Apify run fails > 2 retries — investigate proxy or quota.

## Pricing reality check

| Cadence | Cost / month |
|---|---|
| Daily refresh, 5 URLs × 100, fetchDetails on | ~$22.50 |
| Weekly refresh, same shape | ~$3.20 |

Recommend weekly during the buying window, then stop. Budget: $30
self-imposed cap before re-evaluating.
