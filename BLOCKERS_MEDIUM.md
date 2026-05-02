# BLOCKERS_MEDIUM.md

Items hit during medium-reasoning execution that need high-reasoning
follow-up. Ordered by user impact, not chronology.

Last updated 2026-05-01 after commit `89d3cd5`.

---

## 1. AutoTrader Imperva blocked enrichment after 6-8 fetches

**Where:** `scripts/enrich_units_from_listings.py`
**Symptom:** First 6 fetches returned 300 KB+ HTML and parsed VIN +
phone + streetAddress cleanly. Imperva then began returning 953-byte
challenge pages, then HTTP 403. `data/units-enrichment.json` ended up
with 8 entries instead of the expected 97.
**Root cause hypothesis:** Static UA string + raw `urllib` predictable
fingerprint + sub-3-second cadence = soft block at request 7.
**Fix candidates (high-reasoning):**
- Rotate user-agent + accept-language headers per request.
- Drop in `cloudscraper` or `curl_cffi` (ja3 fingerprinting).
- Use Apify AutoTrader actor (already loaded as MCP) with paid credits.
- Switch to scraping the AutoTrader **search-results** JSON endpoint
  rather than per-listing HTML — search responses include `daysOnMarket`
  + dealerPhone in one payload.
**Money required?** Apify ~$10/run for ~5k listings. User must approve.
**Workaround in place:** UI handles missing daysOnLot gracefully ("—");
$/km column treats missing range as "—"; dealer phone enrichment merge
runs over whatever is in the file.

## 2. `/offers/` listing pages don't expose daysOnLot or MSRP

**Where:** `scripts/enrich_units_from_listings.py` PATTERNS map
**Symptom:** Even on the 8 successful fetches, `daysOnLot` and `msrp`
regex matched **zero times**. Inspection of one fetched page (335 KB)
showed no `daysRelative`, `firstListed`, `publishDate`, `MSRP` (other
than translation strings), or any "X days ago" rendered text.
**Root cause:** AutoTrader's `/offers/` URL family is for
**dealer-curated promotional listings**. Different DOM than regular
`/cars/` listings. The fields we want only render on the latter.
**Fix candidates (high-reasoning):**
- Pivot scrape source: AutoTrader public `/cars/` listings via the
  search-results JSON endpoint (per-listing HTML not needed).
- Or accept that days-on-lot is unknowable without per-dealer
  inventory feeds + use lastSeen tenure as a proxy.
**Workaround in place:** dealScore weights still functional but the
`daysOnLot` term contributes 0 for all 97 units → effectively a
3-component score (price 35%, incentive 30%, pressure 20% renormalized).
Acceptable for personal use; not great as a deal signal.

## 3. 65/97 units show ask > MSRP — trim mismatch + stale defaults

**Where:** `scripts/build_units_from_at.py` `DEFAULT_MSRP` table +
`match_trim()` parser.
**Symptom:** Worst examples (verified):
- 5× Ioniq9 Preferred Long Range RWD at ask $82-87k vs MSRP $64,999
  (delta +$18-22k).
- Most likely: real trims are Performance Calligraphy AWD ($79,999) or
  Calligraphy AWD with options + dealer markup. Parser collapses
  anything without explicit "AWD" + "Calligraphy" tokens to the cheapest
  Preferred RWD trim.
**Root cause:** `match_trim()` token-scoring + Ioniq9 fallback
(`if "AWD" in t: return AWD trim, else RWD`) is too crude for trim
hierarchies with shared base names. AND `DEFAULT_MSRP` table reflects
2024-early-2025 pricing — needs refresh against Hyundai.ca / Kia.ca
configurators.
**Mitigation shipped (this commit):**
- UI chip "MSRP unverified" when ask > msrp + $5k (InventoryTable).
- Top Deals on home page filters out same — no more poisoned best-deal
  table.
**Fix candidates (high-reasoning, ~45 min):**
- Spot-check 5 trims via Hyundai/Kia Canada configurators; refresh
  `DEFAULT_MSRP` table.
- Tighten `match_trim()` for Ioniq9 specifically: detect "Calligraphy",
  "Performance", "Long Range" tokens explicitly, build full trim string.
- Mark each unit's `msrp` source in data ("scraped" | "default" |
  "spec-lookup") so the UI can render confidence.

## 4. Item L (VERIFY-trim regex improvement) is moot

Already cleaned up in prior session. `grep -n VERIFY data/units.json`
returns nothing. Script's `match_trim()` fallback at line 105 still
returns `VERIFY: <title>` strings on parser failure but no current
units have one. Removing the dead branch is cosmetic — leave it as a
sentinel for future scrape-input pathologies.

## 5. Score reweighting (NEXT.md item E) needs real daysOnLot data

Cannot meaningfully reweight while daysOnLot is universally missing
(blocker #2). Defer until pagination + non-`/offers/` scrape ships.

---

## What was completed cleanly on medium

- Dealer enrichment merge in `loadDealers()` — 8 dealers now show
  real phone + street address from the partial enrichment.
- $/km of range column with sort + tooltip (renders "—" when spec
  missing — graceful degradation).
- "MSRP unverified" warning chip on InventoryTable rows.
- Top Deals home-page filter blocks ask > msrp + 5k contamination.

## What's queued for high-reasoning batch

1. Pick Imperva workaround — Apify actor (paid) vs cloudscraper (free,
   may still fail) vs search-results-JSON pivot (best ROI).
2. Refresh `DEFAULT_MSRP` against current OEM configurators.
3. Tighten `match_trim()` for Ioniq9 hierarchy.
4. Heat-pump trim flag (NEXT.md D) — research-heavy; needs OEM site
   trim-spec walks.
5. After enrichment lands, reweight `dealScore` (NEXT.md E).
