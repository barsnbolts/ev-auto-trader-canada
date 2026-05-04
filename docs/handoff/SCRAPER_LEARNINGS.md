# SCRAPER_LEARNINGS — what we know about cross-source scraping

> Append-only log of findings, design decisions, and library research
> for the Phase D-core scraper system. Read this before tweaking
> scrape_*.py — saves re-discovery.

## Architecture (shipped 2026-05-04)

```
scripts/
├── lib_scrape_common.py    # shared HTTP fetch, VIN check-digit,
│                           # NHTSA decode, fallbackKey, address parse
├── lib_scrape_metrics.py   # JSONL telemetry + suggest_max_pages()
├── scrape_kijiji.py        # SHIPPED — Apollo cache walker
├── scrape_leasebusters.py  # SKELETON — needs Chrome MCP probe
├── scrape_facebook.py      # SKELETON — login-walled, ~30% VIN coverage
├── scrape_unit_gallery.py  # AutoTrader image scraper (Phase C2)
└── verify_unit.py          # Single-VIN AutoTrader re-scrape
```

Output schema (data/_<source>_raw.json) is uniform across sources:
keyed by source-stable id; per-record VIN + fallbackKey + price + url
+ year/make/model/trim + mileageKm + province + dealer info + scraped_at.

`scripts/merge_cross_sources.py` joins all `_<source>_raw.json` files
into `data/cross-listings.json`, keyed by VIN with fallbackKey for
VIN-anonymized sources.

## Library research (2026-05-04 extra-high pass)

Compared what we built vs popular open-source scraping frameworks.
**Verdict: keep stdlib + ~400 LoC custom. Adding a framework would be net negative for personal-use scope.**

| Tool | What it does | Should we adopt? | Why / why not |
|---|---|---|---|
| **[Scrapling](https://github.com/D4Vinci/Scrapling)** | `adaptive=True` flag finds elements even when DOM CSS changes | ❌ | We use Next.js `__NEXT_DATA__` JSON, not CSS selectors. JSON keys are way more stable than CSS classes. Adaptive selectors solve a problem we don't have. |
| **[crawlee-python](https://github.com/apify/crawlee-python)** | Full framework — adaptive concurrency, browser automation, proxy rotation | ❌ | 50+ MB deps, Playwright browser, full event loop. We hit 6 URLs/day from cron. Massive overkill. |
| **[scrapy-deltafetch](https://www.zyte.com/blog/scrapy-tips-from-the-pros-july-2016/)** | URL-fingerprint dedup (skip already-scraped) | partial — already have it | Our stockId-keyed output JSON achieves the same effect: re-running overwrites identical entries. Adding HTTP-level URL dedup saves bandwidth (~120 KB/run) but loses the ability to detect price/availability changes. Net: skip. |
| **[Crawl4AI](https://github.com/unclecode/crawl4ai)** | LLM-friendly + AdaptiveCrawler that learns patterns | ❌ | LLM extraction is overkill — Kijiji's Apollo cache is structured. Also: privacy/cost concerns sending listing data through LLM. |
| **[autoscraper](https://github.com/alirezamika/autoscraper)** | Learns selectors from positive examples | ❌ | Same reason as Scrapling. Plus zero maintenance since 2023. |

**What we kept from the field:**
- DeltaFetch's IDEA → `lib_scrape_metrics.suggest_max_pages()` adapts page count run-over-run (not URL-level fingerprinting, but the spirit).
- Crawlee's IDEA → adaptive throttle when error rate climbs (not yet wired; future improvement if errors > 10% appear in metrics).

**Custom advantages over off-the-shelf:**
- VIN check-digit validator + NHTSA decoder: NONE of the above include automotive-domain helpers. Custom is the only path.
- Zero deps: matches CLAUDE.md "stdlib only" constraint and keeps Tauri bundle thin.
- Personal-use scope (~50 fetches/day) makes any framework's overhead net-negative.

## Findings per source

### Kijiji (✅ shipped)

URL pattern: `/b-cars-trucks/canada/<make>-<model>/k0c174l0?ad=offering&page=N`
- The `k0` prefix on the category code is REQUIRED. Without it,
  Kijiji returns the make-model landing page (not the listings page).
- Server filters by make+model BEFORE rendering. Title + listings count
  reflect the filter accurately.
- Listings live in `<script id="__NEXT_DATA__">` JSON →
  `props.pageProps.__APOLLO_STATE__` → keys starting with `AutosListing:`.
- Each entity has structured `attributes.all[]` with `vin`, `caryear`,
  `carmake`, `carmodel`, `cartrim`, `carmileageinkms`, etc.
- VIN coverage: 95% (41/43 on a probed page).
- Price stored in **cents** under `price.amount` (divide by 100).
- Pagination wraps to page 1 silently when out of pages. Detect
  via no-new-stockId-this-page break (shipped).
- `carmodel` enum LAGS new models (Ioniq 9 = `othrmdl`,
  NiroEV = `niro ev` with space). Trust the URL slug, not the enum.

### Leasebusters (🟡 needs Chrome MCP probe)

Documented in `docs/handoff/CHROME_MCP_PROBE_PLAYBOOK.md` § Site 2.
JS-rendered SPA — no SSR. Real listing data fires from an XHR
post-hydration; medium-tier needs to capture the endpoint via Chrome
MCP, then swap into scrape_leasebusters.py.

VIN exposure unknown; spot-check at probe time. If absent: rely on
fallbackKey (year|make|model|trim|kmBucket).

### Facebook Marketplace (🔴 deferred — login-walled)

Documented in `scripts/scrape_facebook.py` module docstring. Login
required for full ad bodies. VINs almost never in structured fields —
must regex-extract from title + description. ~30-40% coverage based
on dealer-ad spot check.

Recipe in the file: `vins_in_text(blob, validate=True)` from
lib_scrape_common returns check-digit-validated candidates.
`nhtsa_decode(vin)` cross-validates year/make/model.

### AutoTrader (🟢 working — primary source)

Original ingest pipeline (scripts/build_units_from_at.py) is the
project's main data source. Returns 100 units with stable
`u-at-<8hex>` IDs. Cross-source scrapers add to this, don't replace.

## Self-improving feedback loop

`data/_scraper_metrics.jsonl` accumulates one record per scraper run.
`lib_scrape_metrics.suggest_max_pages()` reads recent records and tunes:

- If last run hit pagination cap with new ads still arriving → bump cap.
- If last 3 runs all drained early → drop cap to save HTTP fetches.
- Otherwise: use default.

Future tunings (not yet wired):
- **Adaptive throttle** — increase delay if last run had > 10% errors.
- **VIN-quality alarm** — if vin_pct drops > 10pp from rolling mean,
  log warning (signals upstream schema drift).
- **Per-model dynamic cap** — currently global. Could track each
  model's typical listing count and bump cap only for popular models.

`python3 scripts/lib_scrape_metrics.py kijiji 5` prints last 5 runs.

## How to add a new source (recipe)

1. Create `scripts/scrape_<name>.py` modeled on scrape_kijiji.py.
2. Import shared helpers from `lib_scrape_common`.
3. Implement `parse_listings(html) -> list[dict]` with the schema
   above (stockId, vin, fallbackKey, url, priceCad, mileageKm, etc.).
4. Wire `record_run(...)` at end of main().
5. Add to `scripts/merge_cross_sources.py` source registry.
6. Verify by running once, inspect `data/_<name>_raw.json`.
7. Append findings to this doc.

## VIN handling reference

- **Strict format:** 17 alphanumeric chars, exclude I/O/Q.
  `lib_scrape_common.is_valid_vin(s)` and `VIN_RE` regex.
- **Check digit:** position 9 = weighted sum mod 11 of others.
  `vin_check_digit_ok(vin)` returns bool. Catches dealer typos.
- **NHTSA decode:** free vPIC API, no auth. `nhtsa_decode(vin)`
  returns {Make, Model, ModelYear, Trim, ...}. Use to cross-validate
  free-text listings. Throttle 200ms; cache results in
  `data/_vin_cache.json` if doing bulk decode.
- **Free-text extraction:** `vins_in_text(blob, validate=True)` for
  Facebook / forum scrapes where VIN is in description.

## Stop conditions (binding for any session touching scrapers)

- VIN check-digit fail rate > 20% on a single source → schema drift,
  halt + investigate before pushing.
- Error rate > 30% on a single run → likely anti-bot. Halt; do NOT
  retry tighter. Document in this file.
- Source returns < 5KB on >50% of fetches → bot-walled. Halt.
- About to add a new dependency > 5MB → check if it's necessary;
  prefer stdlib (this doc lists alternatives we already considered).
