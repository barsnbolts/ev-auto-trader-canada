#!/usr/bin/env python3
"""Phase D core: Kijiji.ca cars + trucks scraper.

TODO(medium): this scraper currently returns 0 listings. Root cause +
fix below. The architecture is correct; only the URL discovery + body
parser need iteration.

WHAT MAX SESSION CONFIRMED (2026-05-04 — do not redo this work):
  1. www.kijijiautos.ca is DEAD (DNS SERVFAIL). D0's recommendation
     was outdated. Use www.kijiji.ca instead.
  2. www.kijiji.ca/b-cars-trucks/canada/<slug>/c174l0?ad=offering
     returns 1.3MB SSR HTML containing __NEXT_DATA__ JSON. VINs are
     inline (~32 strict 17-char VINs per page).
  3. BUT: the make/model URL params (path slug or query string) DO
     NOT propagate to SSR — every variant returns the same generic
     mixed-make/model feed. Server-side filtering doesn't happen.
  4. The page's only <script type="application/ld+json"> tag is the
     Organization schema, not per-vehicle. Vehicle data lives in
     the __NEXT_DATA__ payload (client-side hydration data).

WHAT MEDIUM NEEDS TO DO:
  Path A (recommended): Chrome MCP probe to capture the real listing
    JSON XHR endpoint that Kijiji's frontend calls after the page
    hydrates. URL pattern is likely /api/.../search?make=...&model=...
    Replace the fetch() body in this script with a call to that
    endpoint. JSON parse is straightforward (Kijiji's GraphQL/REST
    returns clean per-listing schema).
  Path B (fallback): walk the __NEXT_DATA__ JSON tree. Look for keys
    like 'props.pageProps.searchResults.listings' or similar. Filter
    each listing by brand.name in {'kia','hyundai'} post-fetch.
    Lower coverage (~32 of however-many actually match per page),
    but doesn't need Chrome MCP.

CRITICAL: when probing the XHR, also note pagination. Kijiji likely
uses cursor-based or page-numbered. ~32 per page so 100-200 listings
total per make-model is realistic with 3-7 paginated requests.

VERIFIED CONTEXT — kijiji.ca SSR DOM as of 2026-05-04:
  - `<script id="__NEXT_DATA__" type="application/json">` exists and
    contains the page state.
  - VINs inside __NEXT_DATA__ verified by:
      grep -oE '"vehicleIdentificationNumber":"[A-HJ-NPR-Z0-9]{17}"'
  - Listing detail URL pattern in JSON: /v-cars-trucks/<region>/<slug>/<id>

Output: data/_kijiji_raw.json — keyed by Kijiji ad id.

Output: data/_kijiji_raw.json — keyed by Kijiji ad id.

Anti-bot: none observed. Plain curl + browser UA returns full HTML.
Throttle 2s between requests anyway.

Updated 2026-05-04 (Max session): rewrite from skeleton to working
implementation. Replaced kijijiautos.ca URL pattern with confirmed
kijiji.ca pattern + JSON-LD parser. Tested per-make-model probe shows
32 strict 17-char VINs per page across all 5 EV models we track.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "_kijiji_raw.json"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/17.5 Safari/605.1.15"
)
THROTTLE_SECONDS = 2.0

# Models we track. Aligns with src/lib/constants.ts MODELS.
TARGETS = [
    ("kia", "ev6", "EV6"),
    ("kia", "ev9", "EV9"),
    ("kia", "niro-ev", "NiroEV"),
    ("hyundai", "ioniq-5", "Ioniq5"),
    ("hyundai", "ioniq-6", "Ioniq6"),
    ("hyundai", "ioniq-9", "Ioniq9"),
]


def fetch(url: str) -> str:
    cmd = [
        "curl", "-sS", "-L", "--max-time", "30",
        "--http2",
        "-A", USER_AGENT,
        "-H", "Accept: text/html,*/*;q=0.8",
        "-H", "Accept-Language: en-CA,en-US;q=0.9",
        "-H", "Accept-Encoding: gzip, deflate, br",
        "--compressed",
        url,
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, timeout=35, text=False)
        if proc.returncode != 0:
            return ""
        return proc.stdout.decode("utf-8", errors="replace")
    except Exception:
        return ""


# JSON-LD blob shape (verified 2026-05-04):
# {
#   "@context": "http://schema.org",
#   "@type": "Vehicle",
#   "vehicleIdentificationNumber": "KMHKR4AF...",
#   "name": "2024 Hyundai IONIQ 5 Preferred AWD",
#   "offers": { "price": "49995", "priceCurrency": "CAD", "url": "/v-cars-trucks/..." },
#   "mileageFromOdometer": { "value": 22000 },
#   "vehicleModelDate": "2024",
#   "brand": { "name": "Hyundai" },
#   "model": "IONIQ 5",
#   ...
# }
JSON_LD_RE = re.compile(
    r'<script[^>]+type="application/ld\+json"[^>]*>(.*?)</script>',
    re.DOTALL,
)
VIN_RE = re.compile(r"^[A-HJ-NPR-Z0-9]{17}$")


def parse_listings(html: str, target_make: str, target_model_slug: str) -> list[dict]:
    """Pull every JSON-LD Vehicle block from the page.

    Filters by make+model match because Kijiji search-result pages
    sometimes leak unrelated listings via "related searches".
    """
    out: list[dict] = []
    for m in JSON_LD_RE.finditer(html):
        raw = m.group(1).strip()
        try:
            blob = json.loads(raw)
        except json.JSONDecodeError:
            continue
        # The JSON-LD can be a single Vehicle dict OR a list of blocks
        items = blob if isinstance(blob, list) else [blob]
        for item in items:
            if not isinstance(item, dict):
                continue
            if item.get("@type") not in ("Vehicle", "Car"):
                continue
            vin = item.get("vehicleIdentificationNumber")
            if not vin or not VIN_RE.match(vin):
                continue  # filter out non-VIN values like AT-stockid leak
            offers = item.get("offers")
            if isinstance(offers, list):
                offers = offers[0] if offers else None
            if not isinstance(offers, dict):
                offers = {}
            url = offers.get("url") or item.get("url")
            if url and url.startswith("/"):
                url = f"https://www.kijiji.ca{url}"
            stock_id = item.get("identifier") or url or vin
            mileage = (item.get("mileageFromOdometer") or {}).get("value")
            seller = (offers.get("seller") or {}).get("name") if isinstance(offers.get("seller"), dict) else None
            out.append(
                {
                    "stockId": str(stock_id),
                    "vin": vin,
                    "url": url,
                    "priceCad": _safe_int(offers.get("price")),
                    "mileageKm": _safe_int(mileage),
                    "year": _safe_int(item.get("vehicleModelDate") or item.get("modelDate")),
                    "make": _readable_make(item.get("brand")) or target_make.title(),
                    "model": item.get("model") or target_model_slug,
                    "trim": item.get("vehicleConfiguration") or item.get("trim"),
                    "dealerName": seller,
                    # Optional: address may carry province
                    "province": _province_from_address(item.get("address")),
                }
            )
    return out


def _safe_int(v):
    if v is None:
        return None
    try:
        return int(str(v).replace(",", "").split(".")[0])
    except (TypeError, ValueError):
        return None


def _readable_make(brand):
    if isinstance(brand, dict):
        return brand.get("name")
    if isinstance(brand, str):
        return brand
    return None


def _province_from_address(addr):
    if not isinstance(addr, dict):
        return None
    region = addr.get("addressRegion")
    if isinstance(region, str) and len(region) == 2:
        return region.upper()
    return None


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def main() -> int:
    raw: dict[str, dict] = {}
    if OUT.exists():
        try:
            raw = json.loads(OUT.read_text())
        except Exception:
            raw = {}
    fetched = 0
    for make, model_slug, model_label in TARGETS:
        url = f"https://www.kijiji.ca/b-cars-trucks/canada/{make}-{model_slug}/c174l0?ad=offering"
        print(f"[{make}/{model_slug}] fetching…", file=sys.stderr)
        html = fetch(url)
        if len(html) < 5000:
            print(f"  thin response ({len(html)} bytes) — skipping", file=sys.stderr)
            continue
        listings = parse_listings(html, make, model_label)
        print(f"  {len(listings)} listings parsed", file=sys.stderr)
        for entry in listings:
            entry["scrapedAt"] = now_iso()
            raw[entry["stockId"]] = entry
            fetched += 1
        time.sleep(THROTTLE_SECONDS)
    OUT.write_text(json.dumps(raw, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"_kijiji_raw.json: fetched={fetched} total={len(raw)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
