# Phase D0 Cross-Source Probe — Findings (2026-05-04)

Research method: WebSearch + WebFetch over 5 candidate Canadian listing sources. Direct fetches were blocked or 403'd on most edge URLs (Imperva/Akamai/CDN walls), so findings combine search-result corpus with the few pages that responded. Anything marked "needs Chrome probe" is to be confirmed in the dev tools by Ian once the Chrome extension is connected.

---

## Source priority recommendation

**Scrape first (Phase D core):** Kijiji Autos, Leasebusters. Both expose VIN, both have known scraper precedents, both deliver high Phase-D value (cross-listing Kijiji vs AutoTrader; Leasebusters is the *only* lease-takeover signal in Canada).

**Scrape later (Phase D-bis):** Hyundai dealer locator + per-dealer inventory, Kia dealer locator + per-dealer CPO pages. OEM dealer feeds are franchisee-fragmented (D2C Media / Solutions Medias 360 / EDealer), so each dealer site is a custom mini-scrape — high effort, narrow VIN coverage, mostly redundant with AutoTrader for new inventory. Worth it later for "fresh-off-the-truck" units that AutoTrader hasn't ingested yet.

**Skip for now:** Carfax Canada listing inventory. Akamai-fronted, login-walled in 2026, and the listings side largely re-syndicates AutoTrader/dealer feeds — low marginal value.

---

## 1. Kijiji Autos (kijijiautos.ca)

- **Search URL pattern:**
  - Hierarchical SEO URLs: `https://www.kijijiautos.ca/cars/<make>/<model>/<condition>/`
    - Example: `https://www.kijijiautos.ca/cars/hyundai/ioniq-5/used/`
  - Filter via path segments: `/cars/used/`, `/cars/<make>/<model>/`, optional `/?ms=` for trim/year query bag
  - Province/city filtering not in path (cookie or `loc=` param) — needs Chrome network-tab confirmation
- **Listing schema fields exposed (per third-party scrapers that read the same DOM):**
  - Make, Model, Year, Mileage (km), Transmission, Fuel Type, Drivetrain, Body Type, Color, Condition, **VIN**, Trim, Seats, Doors, **Carfax link**, Feature checklist, Price, Photos, Seller name, Address
  - VIN is one of the documented fields per Apify-style scrapers — high confidence
- **Anti-bot:** Same Adevinta stack as Kijiji.ca. Front-end is a React/Next.js app with backend GraphQL (search returned no public schema, but `/graphql` POSTs are the standard pattern). Plain `curl` with a real UA + Accept-Language usually returns the SSR-rendered HTML. No reports of Imperva on the public listing pages. Realistic refresh: 1 request / 2-3 sec from one IP, ~500-1000 listings/day before throttling. **Needs Chrome MCP probe** to confirm the GraphQL endpoint shape.
- **VIN exposure:** YES — VIN visible on listing detail page in the DOM; some cards in the search-result grid also expose it via `data-*` attributes. Detail-page is the safe assumption.
- **Reference projects (last 18 mo):**
  - `apify.com/smartspidering/kijiji-ca-scraper` — actively maintained, 2024-2025 commits
  - `apify.com/fayoussef/kijiji-scraper` — Kijiji.ca classifieds, similar DOM patterns
  - `apify.com/caprolok/kijiji-scraper` — covers listing JSON export
  - `github.com/CRutkowski/Kijiji-Scraper` (older, last commit 2023, but URL-config pattern still valid)
  - No GitHub repo specifically for `kijijiautos.ca` (the autos vertical) found — Apify actors are the only maintained references
- **Recommendation:** **Scrape first.** VIN exposure + fewest anti-bot defenses among the five. Adapt `scripts/build_units_from_at.py` pattern: requests → BeautifulSoup → SQLite upsert keyed on VIN.

---

## 2. Leasebusters (leasebusters.com)

- **Search URL pattern:**
  - Modern: `https://www.leasebusters.com/vehicle-search-result?gallery=LBUsed` (pre-owned), `?gallery=4` (weekly specials), `?gallery=DealerDemo`, `?gallery=WeeklySpecials`
  - Legacy classic ASP: `https://www.leasebusters.com/en/lease-take-over-vehicle-gallery-results.asp?MakeID=<Make>&view=slower&leftside=false`
  - Filters supported (server-side query string): MakeID, ModelID, Province, OdometerMin/Max, RemainingMonthsMin/Max, Engine (Diesel/Electric/Gas/Hybrid), AWD, SeatingCapacity
- **Listing card fields:**
  - Year, Make, Model, **Monthly payment + Taxes**, **Lease term remaining (months)**, **Cash incentive**, **Province**, Kilometres-on-clock, Sale price (for buyout), Effective payment, Vehicle photo
  - **Phase-D-specific:** monthly payment, months remaining, cash incentive (the Leasebusters bounty paid by lessee to assignee), province
  - **VIN: NOT visible on gallery cards.** Likely absent from detail page too — Leasebusters historically anonymizes the lease until purchase intent is registered. Stock/Listing ID is the join key, not VIN. **This is the critical gap** — for VIN-keyed cross-merge, Leasebusters listings will have to be matched on year + make + model + trim + km fuzz, not VIN.
- **Anti-bot:** Classic ASP backend (`.asp` URLs still work), light DOM, no visible Imperva/Akamai. Plain `requests.get()` returns full HTML. No GraphQL/REST API exposed. Refresh cadence: very generous, ~1/sec sustained, no rate-limit reports.
- **Reference projects:** **None on GitHub.** `RodneyKoolman/LeasePlan-Scraper` is for the Dutch LeasePlan service, not Leasebusters. SparkLease and Clutch.ca write *about* Leasebusters but don't scrape it. Phase D scraper will be greenfield work.
- **Recommendation:** **Scrape first**, but design schema around LBStockID (not VIN) as join key. Match-back to AutoTrader/Kijiji is fuzzy: year+make+model+trim+km within ±2000 km tolerance. Document the limitation prominently in the cross-listings JSON.

---

## 3. Hyundai Canada dealer locator + per-dealer inventory

- **Search URL pattern:**
  - Locator: `https://www.hyundaicanada.com/en/shopping-tools/find-a-dealer` (postal code + radius, server-rendered)
  - Per-dealer inventory: **`https://<dealer-slug>.shop.hyundaicanada.com/inventory`** (confirmed live for `boundary`, `experience`, `performance`)
  - This is Hyundai's **"Click to Buy"** platform — every Hyundai dealer in Canada has the subdomain provisioned, enabled or not
  - Filter URL params: needs probe (model, year, exterior color all present in search-inventory tool)
- **Listing schema:** Per Click-to-Buy spec — VIN, stock number, MSRP, dealer-installed accessories, exterior/interior color, trim, dealer name, vehicle ID, photos. VIN exposure: VERY likely on detail pages, possibly on list cards (needs probe — the boundary subdomain returned 403 to plain `curl`).
- **Anti-bot:** Click-to-Buy subdomains return **403 Forbidden** to plain WebFetch — Cloudflare or AWS WAF in front. Real browsers (with cookies + JS) load fine. No public API documented. The `hyundaicanada.com` main site allows reading the dealer locator but not the inventory itself. **Needs Chrome MCP probe** to capture the XHR feed that powers the inventory grid.
- **VIN exposure:** Click-to-Buy is a transactional buy-online flow → VIN must be on detail page (otherwise no order can be placed). Whether VIN renders in the search-result grid is the key question for scraper design.
- **Reference projects:** None for Canada. `dahlb/kia_hyundai_api` and `hyundai-kia-connect-api` (PyPI) target the Bluelink/UVO *vehicle-owner* API (not dealer inventory). No US-style `hyundaiusa.com/inventory-search` scraper has been ported to `.ca`.
- **Recommendation:** **Phase D-bis.** Two-step scrape: (1) crawl `hyundaicanada.com/en/shopping-tools/find-a-dealer` to enumerate the ~250 Canadian dealer slugs, (2) hit each `<slug>.shop.hyundaicanada.com/inventory` JSON endpoint via headless browser. Effort: 3-5x a Kijiji-style scraper because of WAF. Yield: high VIN coverage on new + demo + CPO Hyundai cars *that haven't yet flowed to AutoTrader*.

---

## 4. Kia.ca dealer locator + per-dealer inventory

- **Search URL pattern:**
  - Locator: `https://www.kia.ca/en/shopping-tools/find-a-dealer` (postal + radius)
  - National CPO inventory: `https://www.kia.ca/en/vehicles/cpo/cpo-inventory-filter/cpo-vehicle-information` (single national page, filter UI loads via JS — fetch returned `maxContentLength exceeded`, suggesting heavy bundle)
  - Per-dealer: each Kia dealer runs a **D2C Media (Solutions Medias 360)** white-label site at the dealer's own domain (e.g., `northyorkkia.ca/en/new-inventory`, `401dixiekia.com/en/new-inventory`, `kiaonhuntclub.com/kia/new-inventory.html?type=N`). No `*.shop.kia.ca` subdomain pattern like Hyundai.
- **Listing schema:** D2C Media platform exposes: VIN, stock number, MSRP, dealer-installed accessories, photos, exterior/interior color, trim. Confirmed via D2C Media's "Dealer Inventory Management" product page (their VIN-exploder is core to the product). **VIN visibility per listing card is configurable per dealer**, so coverage will be uneven.
- **Anti-bot:** D2C Media sites are mostly Cloudflare-fronted but generous to crawlers — `northyorkkia.ca` returned full HTML on plain WebFetch. Per-dealer site = per-dealer scrape config. No central JSON feed (D2C Media licences the platform; data lives in each dealer's hosted instance).
- **VIN exposure:** YES on detail pages (the platform requires it for the inventory module to function). Card-level visibility varies. North York Kia returned "0 vehicles" on the day probed — empty state, not a hostile response.
- **Reference projects:** None specifically for D2C Media / Solutions Medias 360. The platform is dominant in Quebec/Ontario but has no published API or scraper.
- **Recommendation:** **Phase D-bis, lower priority than Hyundai.** Three-tier crawl: (1) Kia national CPO inventory page (one URL, JS-rendered, needs Playwright), (2) per-dealer D2C Media sites (template-shared, ~100 dealers in ON), (3) detail pages for VIN. Skip if Hyundai dealer scrape is already meeting Ian's needs — Kia EV6/EV9 also surface on AutoTrader & Kijiji.

---

## 5. Carfax Canada (carfax.ca)

- **Search URL pattern:** `https://www.carfax.ca/used-cars/<make>/<model>/<province>` — but our probe returned **404** on a guessed URL, suggesting a different routing scheme (likely `/cars-for-sale?...` query string). The bare `/used-cars` and `/cars-for-sale` paths returned `maxContentLength exceeded` (huge SPA bundle) and 404 respectively.
- **Listing schema:** Per Carfax product, listings carry: year, make, model, trim, **VIN** (Carfax IS the VIN-history company), kilometres, price, dealer name, location, photos, accident history badge, "free Carfax report" link.
- **Anti-bot:** **Akamai + login wall as of March 2026.** Per Scraperly's 2026 difficulty rating: **Hard (4/5)**, requires login credentials for any depth crawl, JA3/JA4 TLS fingerprinting active. Plain `requests.get()` will be challenged inside 2-5 requests.
- **VIN exposure:** Carfax shows VIN on every detail page (it's their core product). Likely on list cards too. But the login wall makes scraping expensive.
- **Reference projects:**
  - `apify.com/ocrad/carfax-ca-scraper` — explicitly Canadian, last update unknown but listed as active
  - `apify.com/parseforge/carfax-scraper` — input schema visible
  - `github.com/wanerllubbse/carfax-com-scraper` — US-focused, transferable patterns
  - **All require proxy rotation + browser automation** to deal with Akamai
- **Recommendation:** **Skip for Phase D.** The *VIN-history* side is paid per-report (out of scope, would require account credentials anyway). The *listings* side largely re-syndicates AutoTrader and dealer feeds — buying Carfax coverage costs Akamai-bypass infrastructure for marginal new VINs. Revisit only if a specific buying decision requires Carfax-only intel.

---

## Cross-source merge architecture (`data/cross-listings.json`)

```json
{
  "vin": "KMHKR4AF7PU123456",     // primary key when present
  "fallback_key": "2024-hyundai-ioniq5-preferred-awd-22000km",  // year-make-model-trim-km bucket; used when VIN missing (Leasebusters)
  "year": 2024, "make": "Hyundai", "model": "IONIQ 5", "trim": "Preferred AWD",
  "listings": [
    { "source": "autotrader",   "stock_id": "AT123", "url": "...", "price": 49995, "km": 22000, "dealer": "...", "lastVerified": "2026-05-04T14:00:00Z" },
    { "source": "kijiji_autos", "stock_id": "KJ987", "url": "...", "price": 48400, "km": 22000, "dealer": "...", "lastVerified": "2026-05-04T14:01:00Z" },
    { "source": "leasebusters", "stock_id": "LB456", "url": "...", "monthly": 612, "months_remaining": 28, "cash_incentive": 1500, "province": "ON", "lastVerified": "2026-05-04T14:02:00Z" }
  ]
}
```

VIN is the primary join when both sources expose it (AutoTrader + Kijiji + dealer feeds). Leasebusters joins via `fallback_key` with ±2000 km tolerance — flagged as "fuzzy match" in the UI. Each `listings[]` item carries `lastVerified` so the verify-chip behaviour from Phase B extends naturally.

---

## Token + token-ROI estimate

Using `scripts/build_units_from_at.py` (~600 LoC, ~14k tokens) as the template:

| Source | Effort estimate | Notes |
|---|---|---|
| **Kijiji Autos** | ~15k tokens (1× template) | Same DOM-scrape pattern as AutoTrader; minor adjustments for Kijiji selectors |
| **Leasebusters** | ~12k tokens | Simpler classic-ASP pages; no Imperva. Schema diverges (no VIN, lease fields) so types.ts also touched |
| **Hyundai Click-to-Buy** | ~50k tokens | Two-stage crawl + WAF bypass + headless browser via Playwright + per-dealer slug enumeration. **Pre-flight EXPENSIVE — token_roi.py preflight before kickoff.** |
| **Kia D2C Media** | ~45k tokens | Same shape as Hyundai but per-dealer-domain (no central CDN). Per-dealer config table needed |
| **Carfax** | ~80k tokens minimum | Akamai bypass + Apify-style proxy rotation. Cost-prohibitive for personal-use app |

**Phase D core (Kijiji + Leasebusters) total: ~27k tokens.** Direct code, no subagent dispatch needed (under the 10k subagent threshold per CLAUDE.md guidance is per-op; 27k spread across two ops is fine).

**Phase D-bis (Hyundai + Kia dealers): ~95k tokens.** Worth a subagent dispatch given the headless-browser + per-dealer-config complexity. Defer until after D core ships and Ian sees value.

---

## Stop conditions per source

- **Kijiji Autos:** Stop and ping Ian if (a) GraphQL endpoint requires auth header beyond UA/cookie, (b) >10% of listing cards lack VIN (would invalidate the join strategy), (c) IP-level rate-limit (HTTP 429) hits before 200 listings/run.
- **Leasebusters:** Stop if (a) Stock-ID format changed mid-scrape (would break `lastVerified` upserts), (b) lease-fields schema (monthly/months/cash) varies by listing in a way that breaks JSON parse, (c) site fronts a new WAF (Cloudflare Turnstile, etc.).
- **Hyundai Click-to-Buy:** Stop and ping Ian if (a) WAF returns 403 for >50% of dealer slugs from a residential IP — would mean shifting to a Tauri-side WebView scrape instead of headless Playwright, (b) inventory grid uses streaming/virtualized DOM that requires complex Playwright instrumentation.
- **Kia D2C Media:** Stop if (a) per-dealer domain enumeration exceeds 500 dealers (too many to maintain configs), (b) D2C Media platform changes the inventory module DOM (would break the template).
- **Carfax:** Pre-flight stop. **Don't start without Ian's explicit go-ahead** — Akamai bypass cost > Phase D incremental value.

---

## Open questions for Ian / next session

1. Is Tauri's `tauri-plugin-http` willing to act as the proxy for Hyundai Click-to-Buy WAF bypass (sends real Chromium-engine TLS fingerprint)? That would dodge Playwright entirely.
2. Confirm Leasebusters anonymization — fetch one listing detail page in Chrome and check whether VIN is exposed post-account-creation. If yes, scope shifts and Leasebusters becomes a VIN source.
3. Priority call: which 2-3 Kia dealers does Ian actually shop? Per-dealer scrape may only need 5 sites, not 100.

