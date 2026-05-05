#!/usr/bin/env python3
"""Daily AutoTrader.ca scrape via Next.js __NEXT_DATA__ SSR JSON.

Per docs/handoff/research/AT_REPLAY_SPEC_2026-05-04.md (with probe
findings in AT_PROBE_CAPTURE_2026-05-04.md):

1. For each search query (6 total — Ioniq 5/6/9, EV6, EV9, Niro EV):
   GET search-results page 1, parse __NEXT_DATA__.props.pageProps.listings,
   walk to numberOfPages.
2. Diff against previous _autotrader_raw.json:
   - new crossReferenceIds → detail-fetch
   - removed crossReferenceIds → mark availability="removed"
   - persistent → bump lastSeen
3. For each detail-fetch, GET listing url, parse
   __NEXT_DATA__.props.pageProps.listingDetails, extract VIN + full schema.
4. Write merged result to data/_autotrader_raw.json.

If 2+ consecutive sweeps return zero listings (Imperva 403 or schema
break), write data/_at_consecutive_failures with count, exit 2.
refresh_daily.sh picks up exit 2 and calls Apify fallback (TODO).
"""
from __future__ import annotations

import json
import random
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# Imperva on autotrader.ca blocks bare urllib (TLS fingerprint). curl_cffi
# impersonates Chrome's BoringSSL ja3 fingerprint, gets through cleanly
# after a single warm-up request. Free dependency, MIT license.
# Install: pip install curl_cffi (in repo .venv)
try:
    from curl_cffi import requests as cffi_requests
except ImportError:
    print(
        "FATAL: curl_cffi not installed. Run from repo .venv:\n"
        "  python3 -m venv .venv && source .venv/bin/activate && pip install curl_cffi",
        file=sys.stderr,
    )
    raise

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
    ("Hyundai", "IONIQ 5", "https://www.autotrader.ca/cars/hyundai/ioniq-5"),
    ("Hyundai", "IONIQ 6", "https://www.autotrader.ca/cars/hyundai/ioniq-6"),
    ("Hyundai", "IONIQ 9", "https://www.autotrader.ca/cars/hyundai/ioniq-9"),
    ("Kia", "EV6", "https://www.autotrader.ca/cars/kia/ev6"),
    ("Kia", "EV9", "https://www.autotrader.ca/cars/kia/ev9"),
    ("Kia", "Niro EV", "https://www.autotrader.ca/cars/kia/niro-ev"),
]

PAGE_SAFETY_CAP = 25  # AT shows max ~7-15 pages per query in practice


def _ua() -> str:
    return random.choice(USER_AGENTS)


def _sleep_jittered():
    time.sleep(random.uniform(5, 8))


_session: "cffi_requests.Session | None" = None
_warmed: bool = False


def _get_session() -> "cffi_requests.Session":
    global _session, _warmed
    if _session is None:
        _session = cffi_requests.Session()
    if not _warmed:
        # Warm-up GET against the homepage. Imperva sets visid_incap_*
        # + incap_ses_* cookies; subsequent requests with these cookies
        # bypass the challenge interstitial.
        try:
            _session.get(
                "https://www.autotrader.ca/",
                impersonate="chrome124",
                timeout=20,
            )
            _warmed = True
        except Exception as e:
            print(f"WARN warm-up failed: {e}", file=sys.stderr)
    return _session


def fetch_html(url: str) -> str | None:
    """GET via curl_cffi w/ Chrome ja3 impersonation."""
    s = _get_session()
    try:
        r = s.get(
            url,
            impersonate="chrome124",
            timeout=20,
            headers={"Accept-Language": "en-CA,en;q=0.9"},
        )
    except Exception as e:
        print(f"WARN GET {url} failed: {e}", file=sys.stderr)
        return None
    if r.status_code != 200:
        print(f"WARN GET {url} status={r.status_code}", file=sys.stderr)
        return None
    text = r.text
    # Imperva challenge sometimes returns 200 with a tiny iframe body.
    if len(text) < 5000 and "Incapsula" in text:
        print(f"WARN GET {url} got Incapsula challenge ({len(text)}b)", file=sys.stderr)
        return None
    return text


def parse_next_data(html: str) -> dict | None:
    m = NEXT_DATA_RE.search(html)
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError:
        return None


def parse_search_page(html: str) -> tuple[list[dict], int]:
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
    """Merge search-result + detail entry into our raw schema."""
    veh = search_entry.get("vehicle", {}) or {}
    loc = search_entry.get("location", {}) or {}
    seller = search_entry.get("seller", {}) or {}
    detail_veh = (detail or {}).get("vehicle", {}) if detail else {}

    vin = None
    if detail_veh:
        vin = (detail_veh.get("identifier") or {}).get("vin")

    price_str = (search_entry.get("price") or {}).get("priceFormatted", "")
    price_cad = int("".join(c for c in price_str if c.isdigit())) if price_str else None

    mileage = detail_veh.get("mileageInKmRaw") if detail_veh else None
    if mileage is None:
        mileage_str = veh.get("mileageInKm", "") or ""
        digits = "".join(c for c in mileage_str if c.isdigit())
        mileage = int(digits) if digits else None

    # Detail seller has rich fields: companyName / contactName / homepageUrl.
    # Search-only seller has id+type only.
    detail_seller = (detail or {}).get("seller") if detail else None
    dealer_name = None
    homepage_url = None
    if detail_seller:
        dealer_name = (
            detail_seller.get("companyName")
            or detail_seller.get("name")
            or detail_seller.get("dealerName")
        )
        homepage_url = (detail_seller.get("dealer") or {}).get("homepageUrl")
    if not dealer_name:
        # Fallback: synthesize from id+type so dealer_id() in build_units
        # produces a stable slug. UI will display this string verbatim until
        # we re-fetch the detail page next sweep.
        dealer_name = f"AT Seller {seller.get('id', 'unknown')}"

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
        "dealerName": dealer_name,
        "dealerHomepageUrl": homepage_url,
        "url": search_entry.get("url"),
        "scrapedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "lastSeen": datetime.now(timezone.utc).date().isoformat(),
        "availability": "active",
    }


def _bump_failure_flag():
    n = 1
    if FAILURE_FLAG.exists():
        try:
            n = int(FAILURE_FLAG.read_text().strip()) + 1
        except Exception:
            pass
    FAILURE_FLAG.write_text(str(n))


def main() -> int:
    # 1. Load existing raw for caching
    existing: dict[str, dict] = {}
    if OUT.exists():
        try:
            data = json.loads(OUT.read_text())
            if isinstance(data, list):
                for e in data:
                    cr = e.get("crossReferenceId")
                    if cr:
                        existing[cr] = e
        except Exception:
            pass

    # 2. Walk all search queries
    search_entries: dict[str, dict] = {}
    page_failures = 0
    for make, model, base_url in SEARCH_URLS:
        for page in range(1, PAGE_SAFETY_CAP + 1):
            url = base_url if page == 1 else f"{base_url}?page={page}"
            html = fetch_html(url)
            if not html:
                page_failures += 1
                if page_failures >= 6:
                    print("ABORT: too many page failures", file=sys.stderr)
                    _bump_failure_flag()
                    return 2
                break  # skip rest of this make/model on failure
            listings, total_pages = parse_search_page(html)
            if not listings:
                if page == 1:
                    print(f"  [{make} {model}] empty page 1", file=sys.stderr)
                break
            for entry in listings:
                cr = entry.get("crossReferenceId")
                if cr:
                    search_entries[cr] = entry
            if total_pages and page >= total_pages:
                break
            _sleep_jittered()
        # Polite gap between models
        _sleep_jittered()

    if not search_entries:
        print("ABORT: zero listings across all queries", file=sys.stderr)
        _bump_failure_flag()
        return 2

    # 3. Diff
    today = datetime.now(timezone.utc).date().isoformat()
    new_or_changed = [
        cr for cr in search_entries
        if cr not in existing or existing[cr].get("vin") is None
    ]
    persistent = [
        cr for cr in search_entries
        if cr in existing and existing[cr].get("vin") is not None
    ]
    removed = [cr for cr in existing if cr not in search_entries]

    print(
        f"AT scrape: {len(search_entries)} listings "
        f"({len(new_or_changed)} new, {len(persistent)} persistent, "
        f"{len(removed)} removed)"
    )

    # 4. Detail-fetch new/changed
    out: list[dict] = []
    for i, cr in enumerate(new_or_changed, 1):
        entry = search_entries[cr]
        url = entry.get("url")
        if not url:
            out.append(normalize_listing(entry, None))
            continue
        if not url.startswith("http"):
            url = "https://www.autotrader.ca" + url
        detail_html = fetch_html(url)
        detail = parse_detail_page(detail_html) if detail_html else None
        out.append(normalize_listing(entry, detail))
        if i % 25 == 0:
            print(f"  detail-fetched {i}/{len(new_or_changed)}", file=sys.stderr)
        _sleep_jittered()

    # 5. Reuse cached for persistent
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


if __name__ == "__main__":
    sys.exit(main())
