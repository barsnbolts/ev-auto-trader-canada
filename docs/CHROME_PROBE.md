# Chrome MCP — AutoTrader search-JSON probe

**Goal:** Find the JSON endpoint that AutoTrader's search SPA hits to render
the results page. If it returns `daysOnMarket` + dealer phone in one
payload, we kill BLOCKERS_MEDIUM #1, #2, #5 + NEXT item H simultaneously
without paying Apify.

**Status:** Pre-resolved runbook; **MEDIUM can execute** if Chrome MCP is
connected. Falls through to Phase 2.2 (Apify) on failure — no judgment
required. Escalate to HIGH only if step 4's network log shows something
unfamiliar (a graphql endpoint, a paginated cursor pattern, etc.).

## Prereqs

- Claude-in-Chrome extension connected (check via `mcp__Claude_in_Chrome__list_connected_browsers`)
- Chrome already open with at least one tab the extension can drive

## Runbook (mechanical — copy/paste)

### Step 1 — Open the search results

```
mcp__Claude_in_Chrome__tabs_create_mcp
mcp__Claude_in_Chrome__navigate
  tabId: <from previous result>
  url: https://www.autotrader.ca/cars/?make=Hyundai&model=Ioniq+5&prv=Ontario
```

Wait ~5 seconds for the page to settle (Imperva check + JSON hydration).

### Step 2 — Capture network traffic

```
mcp__Claude_in_Chrome__read_network_requests
  tabId: <same>
  urlPattern: "/api/"
  limit: 100
```

Then again with `urlPattern: "search"`, then `urlPattern: ".json"`.
Save each result for grep.

### Step 3 — Identify the candidate

Look for an XHR/fetch response that:

- Status 200
- Content-type `application/json`
- URL on `autotrader.ca` (not a 3rd-party analytics endpoint)
- Body shape includes `results` / `listings` / `vehicles` / `items` array
- At least one record contains `daysOnMarket` (or `daysOnLot`, `listingDays`, `age`)

If multiple candidates, prefer the one with both **dealer phone** AND
**daysOnMarket** in the same payload. AutoTrader sometimes splits these
into two endpoints.

### Step 4 — Verify the call shape

```
mcp__Claude_in_Chrome__javascript_tool
  tabId: <same>
  action: javascript_exec
  text: fetch('<candidate-url>', {credentials: 'include'}).then(r => r.json()).then(d => JSON.stringify(d).slice(0, 2000))
```

Confirm the response is reproducible from a clean fetch (no exotic
headers, no CSRF). Note the required headers (`User-Agent`, `Accept`,
maybe `X-Requested-With`).

### Step 5 — Document + handoff

Append to this file under `## Found endpoint` below, then write a Python
client at `scripts/scrape_search_json.py` that mirrors the call. Build
script (`build_units_from_at.py`) keeps reading `/tmp/at_listings.json`,
the new client just produces that file with full per-listing fields.

## Decision tree if probe fails

| Symptom | Action |
|---|---|
| 403 / Imperva challenge on search URL itself | Try a different geo via residential VPN, or skip to Apify |
| JSON endpoint exists but rate-limits at >5/min | Add 15s sleep between calls; if still gates, skip to Apify |
| JSON endpoint requires CSRF token from initial HTML | Doable — fetch HTML once, scrape token, then call API |
| No JSON endpoint visible — page is server-rendered HTML | Skip to Apify (Phase 2.2) |
| `daysOnMarket` not present in response | Apify still needed for that field; partial JSON win |

## Found endpoint (probed 2026-05-01)

**Best path is the SSR HTML payload, not a JSON endpoint.**

Every search-results page embeds the full first-page payload in
`<script id="__NEXT_DATA__">` as JSON:

```
URL pattern: https://www.autotrader.ca/cars/<make>/<model>/?prv=<Province>&rcp=<page>
Method: GET (plain HTML)
Required headers: standard browser UA; no CSRF, no auth
Payload location: document.getElementById('__NEXT_DATA__').textContent
Payload shape: __NEXT_DATA__.props.pageProps.listings[] (20/page) +
  numberOfResults + numberOfPages
Per-listing keys: id, identifier, crossReferenceId, url, price{},
  vehicle{make,model,variant,modelYear,mileageInKm,fuel,transmission},
  vehicleDetails (numeric-keyed array), seller{companyName,id,phones,links},
  location{provinceCode,zip,city,street,distanceToSearchLocationInKm},
  statistics{leadsRange}, tracking{firstRegistration,...}, images, ocsImagesA
```

**Critical gap:** `daysOnMarket` is NOT in the SSR payload. The only
listing-age signal is `statistics.leadsRange` (a leads-count bucket, not
days). `tracking.firstRegistration` is the vehicle's date of first
registration with the province, NOT the listing date.

**Two GraphQL POST endpoints also fire on page load:**
- `https://listing-search.api.autoscout24.com/graphql` (200)
- `https://www.autotrader.ca/listing-search-api/graphql` (200)

These may carry `daysOnMarket` in their responses but request bodies
weren't captured in the probe (would need pagination trigger to fire a
fresh fetch with the hook installed). Worth a follow-up probe before
falling through to Apify if `daysOnMarket` is the only missing field.

## Implications

- **Wins:** dealer phone (`seller.phones`), province + zip + city + street,
  exact mileage, price, vehicle make/model/year/variant/fuel — all in the
  SSR HTML. Kills the per-listing Imperva problem entirely.
- **Loss:** `daysOnMarket` still missing. Two ways forward:
  1. Probe the GraphQL response bodies (cheap, 5 min) — might have it
  2. Derive from snapshot diffs: stable IDs are already shipped; first-seen
     date per `identifier` becomes daysOnMarket(today) = today - first_seen
- **Next step:** Write `scripts/scrape_search_json.py` to fetch the search
  HTML, extract `__NEXT_DATA__`, and emit `/tmp/at_listings.json` in the
  same shape `build_units_from_at.py` already consumes.

## Snippet — minimal extractor

```python
import json, re, requests
HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
           "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"}
url = "https://www.autotrader.ca/cars/hyundai/ioniq+5/?prv=Ontario&rcp=15"
html = requests.get(url, headers=HEADERS, timeout=30).text
m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
nd = json.loads(m.group(1))
listings = nd["props"]["pageProps"]["listings"]  # 20 per page
total = nd["props"]["pageProps"]["numberOfResults"]
pages = nd["props"]["pageProps"]["numberOfPages"]
```

## GraphQL response bodies — second probe (2026-05-02)

Re-probed both GraphQL endpoints to settle the daysOnMarket question.
Result: **GraphQL bodies cannot be captured via Chrome MCP** (no
CDP-level pre-load hook exposed; in-page hooks miss the initial fires
and the page's own sort/filter UI doesn't refire because Next.js sorts
the SSR-cached array client-side; introspection from the page's JS
context is gated by Imperva).

**But the question is now answered another way.** Direct inspection of
`__NEXT_DATA__` on a listing-detail page (e.g. `/offers/<slug>-<uuid>`)
shows the schema carries `props.pageProps.listingDetails.availability`:

```json
{ "rawFromDate": null, "fromDate": null, "inDays": null }
```

`inDays` would be daysOnMarket — but it's null on every `/offers/` URL
sampled. And **100% of search-results listings point to `/offers/`** (no
non-offers URL family exists in current AutoTrader Canada output).

**Decision: snapshot-diff (M3) is the daysOnMarket source.** GraphQL
isn't a viable third path because we never get the bodies. M2 Apify
sample still runs to confirm whether the paid actor returns
`daysOnMarket` directly.

Full findings + raw captures + reproduction:
- `docs/handoff/research/M0_findings_2026-05-02.md`
- `docs/handoff/research/M0_graphql_2026-05-02.json`

## Side observation: search-results `?model=` query-param filter is broken

`/cars/?make=Kia&model=EV6&prv=Ontario` returns 5,798 results spanning
EV4 / Sorento / Sportage / Carnival / Forte etc. The `model=` filter
is silently ignored when supplied via querystring. **Apify input MUST
use path-form URLs** like `/cars/kia/ev6/on/?rcp=100`. The existing
`docs/apify_inputs/ontario_full.json` already uses path-form, so M2
input shape is unchanged.
