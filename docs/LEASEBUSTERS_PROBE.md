# Chrome MCP — Leasebusters listing probe

**Goal.** Add Leasebusters as a second listing source for Hyundai/Kia EVs
in Canada. Leasebusters is a lease-takeover marketplace — many of the
listings are 24–48-month-remaining leases on like-new vehicles, often
priced below buy-out value. Distinct VIN universe vs AutoTrader.

**Status.** Phase A scaffold only (this doc). After Phase A lands, **pause**
for user go-ahead before writing the scraper (Phase B) or wiring the UI
(Phase C). User flagged this checkpoint explicitly so the scope is right-sized
before committing time.

---

## Why this exists

The current AutoTrader feed only sees retail/dealer listings. Lease takeovers
are a separate inventory channel:

- **VIN-distinct.** A 2023 EV6 Wind RWD with 18 months remaining at $580/mo
  appears nowhere on AutoTrader.
- **Leverage signal.** The original lessee is motivated; takeover incentives
  (cash for the seller) often beat dealer-side OEM cash.
- **Cash-buyer angle.** Most takeovers offer a buy-out option. If the
  buy-out is below current market clearing price, the takeover converts
  to a discounted cash purchase.

This is M13 (cash/finance/lease comparison) territory — Leasebusters
becomes a first-class lease feed once that batch lands.

---

## Prereqs

- Claude-in-Chrome extension connected (`mcp__Claude_in_Chrome__list_connected_browsers`)
- A clean Chrome profile (no Leasebusters cookie / login state)
- The site is `https://www.leasebusters.com/`

If the site shows Cloudflare / Imperva / hCaptcha challenges on first hit,
note the wall and skip to Apify (Phase B fallback).

---

## Runbook

### Step 1 — Open the listings index

Probe these three URL shapes; prefer whichever returns the cleanest JSON:

- Search by make: `https://www.leasebusters.com/Vehicles?makes=Hyundai`
- EV-only filter: `https://www.leasebusters.com/Vehicles?fuel=Electric`
- Combined Hyundai+Kia EVs: `https://www.leasebusters.com/Vehicles?makes=Hyundai,Kia&fuel=Electric`

Capture the canonical-URL pattern + querystring shape. We expect one of:

- Plain SSR HTML with embedded JSON (`__NEXT_DATA__`-style or a rendered
  table)
- An XHR/fetch JSON endpoint hit on page load

### Step 2 — Capture network traffic

Same fetch+XHR monkey-patch pattern as `docs/CHROME_PROBE.md` Step 1, but
installed on `about:blank` BEFORE the first navigate. Look for:

- JSON XHR returning a `listings` / `vehicles` / `results` array
- A "load more" or pagination call
- An auth or CSRF gate (Leasebusters requires neither for browsing per
  our 2025 reading)

### Step 3 — Per-listing detail fields to confirm

For one listing URL (e.g. `https://www.leasebusters.com/Vehicles/<id>`),
inspect what's exposed. Required for our schema:

| Field                     | Required for | Notes                           |
|---------------------------|--------------|---------------------------------|
| VIN                       | Dedupe       | Primary key vs AutoTrader       |
| Vehicle make/model/year   | Catalog match| Same as `InventoryUnit.vehicle` |
| Trim                      | Spec lookup  | Use existing trim parser        |
| Province / city           | Geo filter   | Mirror AutoTrader pattern       |
| Mileage (km)              | Display      | `vehicle.mileageInKm` analogue  |
| Original lease term       | Math         | months                          |
| Months remaining          | Math         | months                          |
| Monthly payment (CAD)     | Display      | `dealType: "lease"` line        |
| Buyout amount (CAD)       | Math         | "convert to cash" calc          |
| KM allowance + overage    | Risk note    | $ per km over                   |
| Down payment / cash to seller | Math     | OTD basis adjustment            |
| Lease originator (bank)   | Provenance   | usually OEM captive             |

If VIN is missing, escalate. Without VIN we cannot dedupe vs AutoTrader,
which kills the entire integration.

### Step 4 — Decision matrix

| Probe outcome                                            | Phase B path                                |
|----------------------------------------------------------|---------------------------------------------|
| JSON XHR endpoint returns full listing array             | Free scraper analogous to `scrape_search_json.py` |
| SSR HTML with embedded JSON (`__NEXT_DATA__` or similar) | Free regex+JSON scraper                     |
| SSR HTML, no embedded JSON                               | BeautifulSoup parser per listing            |
| Cloudflare / Imperva / bot-detection wall                | Apify alternative (extra ~$5 cap); else skip |

### Step 5 — Schema impact preview (Phase C)

`InventoryUnit` (Zod schema in `src/lib/types.ts`) already carries
`dealerId` + `listingUrl` + numeric `priceCAD`. To support Leasebusters:

1. Add `source: "autotrader" | "leasebusters"` to `InventoryUnit`.
2. Add stable ID prefix `u-lb-<8hex>` (separate hash namespace from
   `u-at-<8hex>`).
3. VIN-based dedupe in the merge step (where both feeds carry the same
   VIN, prefer the source with the lower effective price).
4. Add optional `leaseTakeover: { monthlyPayment, monthsRemaining,
   buyoutCAD, kmAllowance, kmOverageRate, downPayment, originator }`
   subobject.

UI (Phase C):
- Small source chip on each row (`AT` / `LB`).
- Filter toggle in `/inventory` for source.
- Per-unit drawer shows lease-takeover math when `source === "leasebusters"`.
- Plays into M13 cash/finance/lease comparison directly.

### Step 6 — Scraper hooks (Phase B preview, do not write yet)

When Phase B is greenlit:

- `scripts/scrape_leasebusters.py` mirrors `scrape_search_json.py` shape,
  outputs `/tmp/lb_listings.json`.
- `scripts/build_units_from_lb.py` mirrors `build_units_from_at.py`,
  emits `data/units-leasebusters.json` (or appends with a `source` tag
  to `data/units.json` post-merge).
- Daily refresh cron (M11) calls both scrapers in sequence.

---

## Non-goals (Phase A)

- Don't write the scraper yet
- Don't modify `InventoryUnit` Zod schema yet
- Don't add UI elements yet
- Don't run a live probe yet (waits for Phase A.5 go-ahead)

The Phase A deliverable is this doc. The probe runs in a follow-up
Phase A.5 session once the user signs off on scope.

---

## Open questions for user (post-probe, pre Phase B)

1. **Are lease-takeover entries valuable for a cash buyer?** Buyout
   value as "asking price" or as a separate line item?
2. **Should takeovers without a buyout option appear at all?** If Ian
   refuses to inherit a lease, hide them entirely.
3. **Months-remaining floor?** A 4-month-remaining lease is structurally
   different from a 36-month-remaining one — the latter is closer to a
   new lease, the former is a short-term rental.
4. **OEM captive prefs?** Some lessees only allow takeover by approved
   credit. If Ian's credit profile auto-rejects on certain originators,
   filter those out at scrape time.

---

## Reproduction snippet (when Phase B opens)

```python
# Minimal SSR-HTML probe (analogous to scrape_search_json.py)
import json, re, requests
HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
           "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"}
url = "https://www.leasebusters.com/Vehicles?makes=Hyundai,Kia&fuel=Electric"
html = requests.get(url, headers=HEADERS, timeout=30).text
m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
if m:
    nd = json.loads(m.group(1))
    listings = nd["props"]["pageProps"].get("listings", [])
    print(f"{len(listings)} listings on first page")
else:
    # Fall back to BeautifulSoup table parse
    ...
```

---

## Files this probe will produce (Phase A.5)

- `docs/handoff/research/M10_leasebusters_<date>.md` — verbatim findings
- `docs/handoff/research/M10_lb_sample_<date>.json` — first 10 listings raw
- (Conditional) update to this doc's "Found endpoint" section, mirroring
  the pattern in `docs/CHROME_PROBE.md`.
