# AutoTrader.ca replayer spec · medium-tier I0e · 2026-05-04 evening

## Goal

Replace the orphan `/tmp/at_listings.json` blob (4-day-stale) with a
daily-refreshed `data/_autotrader_raw.json` produced by a Python
script that pulls AT search-results + detail pages directly. Free
path (no Apify spend) using the `__NEXT_DATA__` SSR JSON discovered
in F1.

## Files to ship

```
scripts/scrape_autotrader.py                         (NEW — primary scraper)
scripts/scrape_autotrader_apify_fallback.py          (NEW — emergency fallback)
scripts/build_units_from_at.py                       (PATCH input path)
scripts/refresh_daily.sh                             (PATCH wire scrape_autotrader)
data/_autotrader_raw.json                            (NEW — replaces /tmp blob)
data/_at_consecutive_failures                        (NEW — failure counter file)
docs/handoff/research/AT_PROBE_CAPTURE_2026-05-04.md (REFERENCE)
```

## scripts/scrape_autotrader.py — full spec

```python
#!/usr/bin/env python3
"""Daily AutoTrader.ca scrape via Next.js __NEXT_DATA__ SSR JSON.

Pattern (per docs/handoff/research/AT_PROBE_CAPTURE_2026-05-04.md):
1. For each search query (6 total — Ioniq 5/6/9, EV6, EV9, Niro EV):
   GET search-results page 1, parse __NEXT_DATA__.props.pageProps.listings,
   walk to numberOfPages.
2. Diff against previous _autotrader_raw.json:
   - new crossReferenceIds → detail-fetch
   - removed crossReferenceIds → mark availability="removed"
   - persistent → bump lastSeen
3. For each detail-fetch, GET the listing's url, parse
   __NEXT_DATA__.props.pageProps.listingDetails, extract VIN and full schema.
4. Write merged result to data/_autotrader_raw.json.

If 2+ consecutive sweeps return zero listings (Imperva 403 or schema
break), write data/_at_consecutive_failures with count, exit 2.
refresh_daily.sh picks up exit 2 and calls
scrape_autotrader_apify_fallback.py.

Output schema per listing entry:
{
  "id": "ddfbd1dd-5312-4e8f-b49b-a6d53e241076",
  "crossReferenceId": "68259749",
  "vin": "KM8KN4AE6PU228532",
  "year": 2023,
  "make": "Hyundai",
  "model": "IONIQ 5",
  "trim": "Preferred",
  "mileageKm": 39053,
  "priceCad": 41995,
  "fuel": "Electric",
  "offerType": "U",
  "city": "Mississauga",
  "provinceCode": "ON",
  "zip": "L5N1A4",
  "sellerId": "47943322",
  "sellerType": "Dealer",
  "url": "https://www.autotrader.ca/offers/...",
  "scrapedAt": "2026-05-05T07:00:00Z",
  "lastSeen": "2026-05-05",
  "availability": "active"
}
"""
from __future__ import annotations

import json
import random
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "_autotrader_raw.json"
FAILURE_FLAG = ROOT / "data" / "_at_consecutive_failures"

USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
]

NEXT_DATA_RE = re.compile(
    r'<script id="__NEXT_DATA__"[^>]*>(.+?)</script>', re.DOTALL
)

SEARCH_URLS = [
    ("Hyundai", "IONIQ 5",  "https://www.autotrader.ca/cars/hyundai/ioniq-5/"),
    ("Hyundai", "IONIQ 6",  "https://www.autotrader.ca/cars/hyundai/ioniq-6/"),
    ("Hyundai", "IONIQ 9",  "https://www.autotrader.ca/cars/hyundai/ioniq-9/"),
    ("Kia",     "EV6",      "https://www.autotrader.ca/cars/kia/ev6/"),
    ("Kia",     "EV9",      "https://www.autotrader.ca/cars/kia/ev9/"),
    ("Kia",     "Niro EV",  "https://www.autotrader.ca/cars/kia/niro-ev/"),
]


def _ua() -> str:
    return random.choice(USER_AGENTS)


def _headers() -> dict[str, str]:
    return {
        "User-Agent": _ua(),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9",
        "Accept-Language": "en-CA,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
    }


def _sleep_jittered():
    time.sleep(random.uniform(5, 8))


def fetch_html(url: str) -> str | None:
    try:
        r = requests.get(url, headers=_headers(), timeout=15)
    except requests.RequestException as e:
        print(f"WARN GET {url} failed: {e}", file=sys.stderr)
        return None
    if r.status_code != 200:
        print(f"WARN GET {url} status={r.status_code}", file=sys.stderr)
        return None
    return r.text


def parse_next_data(html: str) -> dict | None:
    m = NEXT_DATA_RE.search(html)
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError:
        return None


def parse_search_page(html: str) -> tuple[list[dict], int]:
    """Returns (listings, numberOfPages)."""
    nd = parse_next_data(html)
    if not nd:
        return [], 0
    pp = nd.get("props", {}).get("pageProps", {})
    return pp.get("listings", []), pp.get("numberOfPages", 0)


def parse_detail_page(html: str) -> dict | None:
    nd = parse_next_data(html)
    if not nd:
        return None
    return nd.get("props", {}).get("pageProps", {}).get("listingDetails")


def normalize_listing(search_entry: dict, detail: dict | None) -> dict:
    """Merge search-result entry + detail-page entry into our raw schema."""
    veh = search_entry.get("vehicle", {})
    loc = search_entry.get("location", {})
    seller = search_entry.get("seller", {})
    detail_veh = (detail or {}).get("vehicle", {})

    vin = (
        detail_veh.get("identifier", {}).get("vin")
        if detail_veh
        else None
    )

    # priceFormatted is "$ 41,995" — parse to int
    price_str = (search_entry.get("price") or {}).get("priceFormatted", "")
    price_cad = int("".join(c for c in price_str if c.isdigit())) if price_str else None

    # mileageInKmRaw is preferred (numeric) over mileageInKm ("39,053 km")
    mileage = detail_veh.get("mileageInKmRaw") if detail_veh else None
    if mileage is None:
        mileage_str = veh.get("mileageInKm", "")
        digits = "".join(c for c in mileage_str if c.isdigit())
        mileage = int(digits) if digits else None

    return {
        "id": search_entry.get("id"),
        "crossReferenceId": search_entry.get("crossReferenceId"),
        "vin": vin,
        "year": veh.get("modelYear"),
        "make": veh.get("make"),
        "model": veh.get("model"),
        "trim": veh.get("modelVersionInput"),
        "mileageKm": mileage,
        "priceCad": price_cad,
        "fuel": veh.get("fuel"),
        "offerType": veh.get("offerType"),
        "city": loc.get("city"),
        "provinceCode": loc.get("provinceCode"),
        "zip": loc.get("zip"),
        "sellerId": seller.get("id"),
        "sellerType": seller.get("type"),
        "url": search_entry.get("url"),
        "scrapedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "lastSeen": datetime.now(timezone.utc).date().isoformat(),
        "availability": "active",
    }


def main() -> int:
    # 1. Load existing raw for caching
    existing: dict[str, dict] = {}
    if OUT.exists():
        try:
            existing = {e["crossReferenceId"]: e for e in json.loads(OUT.read_text())}
        except Exception:
            pass

    # 2. Walk all search queries, collect search-level entries
    search_entries: dict[str, dict] = {}  # crossReferenceId → entry
    failures = 0
    for make, model, base_url in SEARCH_URLS:
        for page in range(1, 100):  # safety cap
            url = base_url if page == 1 else f"{base_url}?page={page}"
            html = fetch_html(url)
            if not html:
                failures += 1
                if failures >= 6:
                    _bump_failure_flag()
                    return 2
                continue
            listings, total_pages = parse_search_page(html)
            if not listings:
                break
            for entry in listings:
                cr = entry.get("crossReferenceId")
                if cr:
                    search_entries[cr] = entry
            if page >= total_pages:
                break
            _sleep_jittered()

    # 3. Diff vs existing → which need detail-fetch?
    today = datetime.now(timezone.utc).date().isoformat()
    new_or_changed = [cr for cr in search_entries if cr not in existing or existing[cr].get("vin") is None]
    persistent = [cr for cr in search_entries if cr in existing and existing[cr].get("vin") is not None]
    removed = [cr for cr in existing if cr not in search_entries]

    print(f"AT scrape: {len(search_entries)} listings ({len(new_or_changed)} new, {len(persistent)} persistent, {len(removed)} removed)")

    # 4. Detail-fetch new/changed
    out: list[dict] = []
    for cr in new_or_changed:
        entry = search_entries[cr]
        detail_html = fetch_html(entry["url"])
        detail = parse_detail_page(detail_html) if detail_html else None
        out.append(normalize_listing(entry, detail))
        _sleep_jittered()

    # 5. Reuse cached for persistent (bump lastSeen)
    for cr in persistent:
        cached = dict(existing[cr])
        cached["lastSeen"] = today
        cached["availability"] = "active"
        out.append(cached)

    # 6. Mark removed
    for cr in removed:
        cached = dict(existing[cr])
        cached["availability"] = "removed"
        cached["removedAt"] = today
        out.append(cached)

    # 7. Write
    OUT.write_text(json.dumps(out, indent=2) + "\n")

    # 8. Clear failure flag on success
    if FAILURE_FLAG.exists():
        FAILURE_FLAG.unlink()

    return 0


def _bump_failure_flag():
    n = 1
    if FAILURE_FLAG.exists():
        try:
            n = int(FAILURE_FLAG.read_text().strip()) + 1
        except Exception:
            pass
    FAILURE_FLAG.write_text(str(n))


if __name__ == "__main__":
    sys.exit(main())
```

## scripts/scrape_autotrader_apify_fallback.py — emergency only

```python
#!/usr/bin/env python3
"""Emergency Apify fallback for AT scrape. Only invoked from
refresh_daily.sh when scrape_autotrader.py exits 2 (consecutive
failures). Records cost via track_apify_spend.py.

Uses fayoussef/autotrader-canada actor (~$1.00/1k listings).
Hard-fails if cumulative spend within $5 of $30 cap.
"""
import json
import os
import subprocess
import sys
from pathlib import Path

# Pre-flight spend check, dispatch via Apify Python SDK or MCP,
# normalize to same schema as scrape_autotrader.py output, write OUT.
...
```

(Full implementation defers to medium-tier session — at minimum
need user OK to spend before first invocation.)

## scripts/build_units_from_at.py — patch input path

OLD line: `AT_INPUT = Path("/tmp/at_listings.json")`
NEW line: `AT_INPUT = ROOT / "data" / "_autotrader_raw.json"`

The downstream schema mapping should already match
`_autotrader_raw.json` because we designed normalize_listing() to
output the same field names that build_units_from_at.py expects.
Run vitest specs after change to confirm.

## scripts/refresh_daily.sh — wire it in

Add BEFORE the existing build_units_from_at.py call:

```bash
echo "[$(date)] Running AT scrape..."
python3 "$REPO/scripts/scrape_autotrader.py"
AT_RC=$?
if [ $AT_RC -eq 2 ]; then
    echo "[$(date)] AT free-path failed; trying Apify fallback"
    python3 "$REPO/scripts/scrape_autotrader_apify_fallback.py"
fi
```

## Tests

`scripts/test_scrape_autotrader.py` (NEW) — unit tests for:
- `parse_next_data()` on a saved AT search-page HTML fixture.
- `parse_search_page()` returns expected (listings, numberOfPages).
- `parse_detail_page()` returns listingDetails with VIN at expected path.
- `normalize_listing()` produces the canonical schema for both
  detail-present and detail-absent inputs.

Fixtures: save 2 HTML samples (1 search, 1 detail) to
`scripts/_test_fixtures/at_search.html` + `at_detail.html` from the
F1 probe.

## Open question deferred to I0e

- Does AT honor a "detail-only" or "JSON-only" URL pattern that
  returns `__NEXT_DATA__` without the full HTML envelope? Would cut
  bandwidth ~90 %. Worth one DevTools probe on the URL like
  `?json=1` or `?_data=1` before shipping. Default: ship the full-HTML
  approach; optimize later if cron timing becomes painful.

- Is there a way to filter search results by country/province/distance
  via URL params that ACTUALLY get honored? `loc=K1A 0B1` was ignored
  in F1. The default Mississauga + 100km radius gives Ontario coverage
  but misses BC/AB/QC. Resolution: do separate runs per province with
  a different `lat`/`lon` per query, OR set the location-picker once
  via Chrome MCP and capture the resulting query string for replay.

These resolve in I0e. Both are optimizations, not blockers.
