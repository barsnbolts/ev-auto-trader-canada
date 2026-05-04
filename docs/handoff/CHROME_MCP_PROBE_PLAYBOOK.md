# Chrome MCP probe playbook — Kijiji + Leasebusters

> **Goal:** capture the real listing JSON XHR endpoint each site uses to
> hydrate its gallery. Once captured, swap the `fetch()` body in the
> matching `scripts/scrape_*.py` from regex-on-SSR to JSON-on-XHR.
>
> **Both sites have been confirmed (Max session 2026-05-04) to be
> JS-rendered SPAs.** The .asp / SSR HTML is a shell. Listing data lives
> in an XHR fired post-hydration.

## Prereqs

```
mcp__Claude_in_Chrome__list_connected_browsers
# Expect ≥1 browser. If 0: ask user to install / connect the extension.
```

## Pattern (applies to BOTH sites)

The fetch + XHR monkey-patch must be installed BEFORE the first
navigation. After navigation, scoped `window.__captured` survives until
the next navigation event. Re-install after every navigate.

```
# 1. Open a fresh tab.
mcp__Claude_in_Chrome__tabs_create_mcp
# returns tabId X

# 2. Navigate to about:blank to give us a clean window scope.
mcp__Claude_in_Chrome__navigate
  tabId: X
  url: about:blank

# 3. Install the universal capture hook.
mcp__Claude_in_Chrome__javascript_tool
  tabId: X
  action: javascript_exec
  text: |
    window.__captured = [];
    const _origFetch = window.fetch;
    window.fetch = async (...args) => {
      const url = (args[0] && args[0].url) || args[0];
      const init = args[1] || {};
      const reqBody = init.body || null;
      const res = await _origFetch.apply(window, args);
      try {
        if (typeof url === 'string' && /\/api\/|\/json|graphql|\/v\d+\//i.test(url)) {
          const clone = res.clone();
          const respText = await clone.text();
          window.__captured.push({
            url,
            method: init.method || 'GET',
            status: res.status,
            reqBody: reqBody ? String(reqBody).slice(0, 2000) : null,
            respHeaders: Object.fromEntries(res.headers.entries()),
            respBody: respText.slice(0, 50000),  // cap at 50KB per response
            ts: new Date().toISOString(),
          });
        }
      } catch (e) {
        window.__captured.push({ url, error: String(e), ts: new Date().toISOString() });
      }
      return res;
    };
    const _XHR = window.XMLHttpRequest;
    window.XMLHttpRequest = function() {
      const xhr = new _XHR();
      const open = xhr.open;
      xhr.open = function(method, url, ...rest) {
        this.__url = url; this.__method = method;
        return open.call(this, method, url, ...rest);
      };
      const send = xhr.send;
      xhr.send = function(body) {
        if (this.__url && /\/api\/|\/json|graphql|\/v\d+\//i.test(this.__url)) {
          this.addEventListener('load', () => {
            window.__captured.push({
              url: this.__url, method: this.__method,
              status: this.status,
              respBody: (this.responseText || '').slice(0, 50000),
              ts: new Date().toISOString(),
              source: 'xhr', reqBody: body ? String(body).slice(0, 2000) : null,
            });
          });
        }
        return send.call(this, body);
      };
      return xhr;
    };
    'capture hook installed'
```

## Site 1: Kijiji.ca

### Probe URLs (try in order)

```
mcp__Claude_in_Chrome__navigate
  tabId: X
  url: https://www.kijiji.ca/b-cars-trucks/canada/hyundai-ioniq-5/k0c174l0?ad=offering

# Wait for hydration:
mcp__Claude_in_Chrome__computer action: wait, tabId: X, duration: 8

# Trigger pagination (URL change):
mcp__Claude_in_Chrome__navigate
  tabId: X
  url: https://www.kijiji.ca/b-cars-trucks/canada/hyundai-ioniq-5/k0c174l0?ad=offering&page=2
mcp__Claude_in_Chrome__computer action: wait, tabId: X, duration: 4

# Re-install hook because navigation wiped scope (paste capture script again).

# Trigger a filter change via UI:
mcp__Claude_in_Chrome__find
  tabId: X
  query: "price filter or year filter"
# left_click ref to flip.
mcp__Claude_in_Chrome__computer action: wait, tabId: X, duration: 4

# Dump captures:
mcp__Claude_in_Chrome__javascript_tool
  tabId: X
  action: javascript_exec
  text: JSON.stringify(window.__captured.map(c => ({
    url: c.url, status: c.status, method: c.method,
    bodySize: c.respBody?.length, ts: c.ts
  })), null, 2)
```

### What to look for in the captures

| Substring in URL | Likely contents | Action |
|---|---|---|
| `/consumer-graphql/` | GraphQL listings | Save query + body, swap into `scrape_kijiji.py` `fetch()` |
| `/api/listings/` | REST JSON | Save URL + body shape, swap |
| `/srp-api/` | Search results | Save and swap |
| `/api/search/` | Generic | Save and swap |
| `__NEXT_DATA__` script tag in HTML | Server-rendered embedded JSON | Skip — already known doesn't filter |

### Capture full response body of the winning XHR

```
mcp__Claude_in_Chrome__javascript_tool
  tabId: X
  action: javascript_exec
  text: |
    const winner = window.__captured.find(c => c.url.includes('/consumer-graphql/'));
    JSON.stringify(winner, null, 2)
```

Save winner to `docs/handoff/research/KIJIJI_XHR_CAPTURE_2026-05-04.json`.

### Update `scripts/scrape_kijiji.py`

Replace the SSR fetch with the captured XHR:

```python
def fetch_listings(make: str, model: str) -> list[dict]:
    """Phase D-core: hit Kijiji's hydration XHR directly."""
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
        "Content-Type": "application/json",  # for POST
        "Referer": "https://www.kijiji.ca/",
    }
    # Body / URL captured from MCP probe — paste the real shape here:
    payload = {
        # ... captured POST body or query string
    }
    r = requests.post(CAPTURED_ENDPOINT, headers=headers, json=payload, timeout=15)
    if r.status_code != 200:
        return []
    data = r.json()
    return parse_listings(data)
```

## Site 2: Leasebusters

### Probe URLs

```
mcp__Claude_in_Chrome__navigate
  tabId: X
  url: https://www.leasebusters.com/en/lease-take-over-vehicle-gallery-results.asp?MakeID=Hyundai

# Wait for SPA to render:
mcp__Claude_in_Chrome__computer action: wait, tabId: X, duration: 8

# Try modern URL:
mcp__Claude_in_Chrome__navigate
  tabId: X
  url: https://www.leasebusters.com/en/vehicle-search-result?gallery=LBUsed&MakeID=Hyundai
mcp__Claude_in_Chrome__computer action: wait, tabId: X, duration: 6

# Dump captures.
```

### Click a listing to test detail page (and confirm VIN)

```
mcp__Claude_in_Chrome__find
  tabId: X
  query: "first vehicle listing card or first vehicle title"
# Click the first ref.
mcp__Claude_in_Chrome__computer action: wait, tabId: X, duration: 5

# Dump captures from detail page:
mcp__Claude_in_Chrome__javascript_tool
  tabId: X
  action: javascript_exec
  text: |
    const last = window.__captured.slice(-5);
    JSON.stringify(last, null, 2)

# Also grep page HTML for VIN pattern (17 alphanumeric chars):
mcp__Claude_in_Chrome__javascript_tool
  tabId: X
  action: javascript_exec
  text: |
    const html = document.documentElement.outerHTML;
    const vinMatches = html.match(/\b[A-HJ-NPR-Z0-9]{17}\b/gi);
    vinMatches ? JSON.stringify({count: vinMatches.length, sample: vinMatches.slice(0, 3)}) : 'no VIN found'
```

### Decision: does VIN appear?

| Result | Action |
|---|---|
| VIN found in detail HTML | Update `scripts/scrape_leasebusters.py` to extract VIN, change `merge_cross_sources.py` to use VIN as primary key for Leasebusters |
| VIN NOT found | Keep fallbackKey approach (year+make+model+trim+kmBucket); document in scraper header |
| VIN only after login | Document; don't pursue (login flow out of scope per CLAUDE.md NO list) |

### Save captures + decision

```
docs/handoff/research/LEASEBUSTERS_XHR_CAPTURE_2026-05-04.json   # raw captures
docs/handoff/research/LEASEBUSTERS_VIN_DECISION_2026-05-04.md   # 1-page summary
```

### Update `scripts/scrape_leasebusters.py`

Same pattern as Kijiji — swap regex/SSR with captured XHR. Use the same
`fetch_listings()` skeleton.

## Verification after either scraper update

```bash
cd ~/ev-auto-trader-canada
python3 scripts/scrape_kijiji.py        # populates data/_kijiji_raw.json
python3 scripts/scrape_leasebusters.py  # populates data/_leasebusters_raw.json
python3 scripts/merge_cross_sources.py  # builds data/cross-listings.json
jq 'keys | length' data/cross-listings.json   # > 0
npm run dev   # open localhost:3000/inventory — CrossSourceChip lights up on rows with matches
```

## Token estimates (revised post-playbook)

| Step | Token est |
|---|---|
| Kijiji probe (call sequence + capture saving) | ~5k |
| Kijiji scraper rewrite | ~5k |
| Leasebusters probe + VIN decision | ~5k |
| Leasebusters scraper rewrite | ~5k |
| Verification + commit + push | ~3k |
| **Total** | **~23k** for both scrapers (was 25-40k pre-playbook) |

## Anti-detection notes

- Both sites have light rate-limiting. Cap to 1 request / 3-5s.
- Use realistic User-Agent (Mac Safari current). USER_AGENT constants
  already in both scrapers — leave them.
- If you hit Cloudflare WAF on Leasebusters: that's the D-bis trigger,
  halt and document, don't fight it.
- No Apify needed for D-core. Apify is reserved for D-bis (Hyundai
  Click-to-Buy + Kia D2C Media) per project budget.
