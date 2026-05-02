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

## Found endpoint

(Filled in after the probe runs.)

```
URL pattern:
Method:
Required headers:
Response shape excerpt:
Notes:
```
