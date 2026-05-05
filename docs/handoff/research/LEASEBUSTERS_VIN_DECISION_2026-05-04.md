# Leasebusters VIN decision — 2026-05-04

## Probe outcome

**VIN NOT exposed** anywhere in Leasebusters listing or detail HTML.
Detail-page fields stop at `Year / Make / Model / Style / Odometer / Engine Type`.
No 17-char VIN pattern matches in either result-list or detail HTML.

Per playbook decision matrix → **keep fallbackKey approach** (`year+make+model+trim+kmBucket`). No change to `merge_cross_sources.py` join logic.

## Architectural correction (overrides previous scraper docstring)

The scraper docstring (written 2026-05-04 morning) assumed Leasebusters was a **Vue/SPA with hydration XHR**. That was wrong post-redesign:

- Legacy `.asp` URLs all 302 → homepage
- Modern `/vehicle-search/Leasing` is a **server-rendered ASP.NET MVC search-builder** with `__RequestVerificationToken` anti-forgery, not a SPA
- Result page `/vehicle-search-result?makes=...&gallery=Leasing` is full SSR HTML — **zero XHR fired** during navigation under the universal capture hook
- Detail pages `/details/{id}/{slug}` are also SSR HTML

There is no XHR endpoint to swap into the scraper. The right rewrite is a **server-side HTML parser** against the new URL pattern, not an XHR replay.

## URL pattern (canonical post-2026-04 redesign)

| Step | URL |
|---|---|
| Search builder | `GET https://www.leasebusters.com/vehicle-search/Leasing` |
| Result list | `GET https://www.leasebusters.com/vehicle-search-result?makes={id}&gallery=Leasing` |
| Detail page | `GET https://www.leasebusters.com/details/{listingId}/{year}-{make}-{model-slug}` |

Make-ID map (partial — extracted from `/vehicle-search/Leasing` checkbox `value` attrs):

| Make | makeId |
|---|---|
| Hyundai | 17 |
| Kia | 22 |
| Tesla | 46 |
| Polestar | 1001 |

Full make-ID map can be scraped from the search-builder page once on each scraper run (cache for 30d like the NHTSA cache).

## Postal code gate

Result page surfaces a `SearchResult.VehicleSearchResultsEr.PostalCode` input ("Please enter postal code in the Distance to seller area"). Without it, the result list shows only featured/sponsored listings instead of make-filtered ones. **The scraper must POST or set a postal-code cookie before requesting filtered results, or it will get featured-only output.**

Recommended: try `K1A 0B1` (Ottawa) or `M5V 0A1` (downtown Toronto) as the canonical "default Canadian" postal. Persist as a constant in the scraper.

## Next-session task (medium-tier)

Mechanical rewrite, ~5–8k tokens:

1. Replace `fetch_listings()` body in `scripts/scrape_leasebusters.py`:
   - Issue an initial GET to `/vehicle-search/Leasing` to harvest `__RequestVerificationToken` + map make names → makeIds
   - POST the search form with `makes=17` (Hyundai), `makes=22` (Kia), and a default postal code
   - Parse the result-list HTML with BeautifulSoup or regex on `/details/{id}/...` link patterns
   - For each `listingId`, fetch detail page and parse Year/Make/Model/Style/Odometer/Province/Engine Type
2. Build `fallbackKey = f"{year}|{make.lower()}|{model.lower()}|{trim_norm}|{km_bucket(km)}"` (matches existing merge logic).
3. **Do NOT add VIN extraction** — it does not exist on the page.
4. Run the existing `python3 scripts/merge_cross_sources.py` — it already joins via fallbackKey when VIN is absent.
5. Verify `data/cross-listings.json` count > 0 with `jq 'keys | length'`.

## Anti-detection

- Site has Cloudflare Turnstile referenced in scripts (per the earlier docstring). If the rewritten scraper trips a 403, halt and document — that's the D-bis trigger per CLAUDE.md.
- Cap to 1 request / 3-5s per playbook.
- Use the existing `USER_AGENT` constant.

## Verification command after rewrite

```bash
cd ~/ev-auto-trader-canada
python3 scripts/scrape_leasebusters.py        # populates data/_leasebusters_raw.json
python3 scripts/merge_cross_sources.py        # rebuilds data/cross-listings.json
jq 'keys | length' data/cross-listings.json   # > 0 expected
```
