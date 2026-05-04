#!/usr/bin/env python3
"""Phase D core: Kijiji Autos (kijijiautos.ca) scraper.

Search URL pattern (per D0 research):
    https://www.kijijiautos.ca/cars/<make>/<model>/<condition>/

Listing detail pages expose VIN, price, km, dealer, photos. Card-level
VIN exposure is uneven, so this scraper does a two-pass crawl: (1) hit
search results to enumerate listing URLs, (2) fetch each detail page
for VIN + full schema.

Output: data/_kijiji_raw.json — raw scrape, keyed by Kijiji ad id.
The merger (scripts/merge_cross_sources.py) consumes this and produces
data/cross-listings.json.

Anti-bot notes:
- No Imperva on public listing pages (per D0)
- Throttle 2s between detail-page fetches
- Stop conditions: HTTP 429 / 403, JSON shape change, &gt;10% cards lack VIN

This is a SKELETON. Selectors are best-effort guesses based on D0's
research; medium-tier next session needs to verify them against actual
DOM and adjust. Search for "TODO(D-core)" in the body for the iteration
points.
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
THROTTLE_SECONDS = 2.5

# Models we want to track. Aligns with src/lib/constants.ts MODELS.
TARGETS = [
    ("hyundai", "ioniq-5"),
    ("hyundai", "ioniq-6"),
    ("hyundai", "ioniq-9"),
    ("kia", "ev6"),
    ("kia", "ev9"),
    ("kia", "niro-ev"),
]


def fetch(url: str) -> str:
    cmd = [
        "curl", "-sS", "-L", "--max-time", "20",
        "--http2",
        "-A", USER_AGENT,
        "-H", "Accept: text/html,*/*;q=0.8",
        "-H", "Accept-Language: en-CA,en-US;q=0.9",
        "-H", "Accept-Encoding: gzip, deflate, br",
        "--compressed",
        url,
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, timeout=25, text=False)
        if proc.returncode != 0:
            return ""
        return proc.stdout.decode("utf-8", errors="replace")
    except Exception:
        return ""


def search_urls(make: str, model: str) -> list[str]:
    """Phase 1: enumerate listing detail URLs from a search-results page.

    TODO(D-core): verify the actual link selector once a real fetch
    returns full HTML. Anchor pattern is `/a-<slug>/<id>` historically.
    """
    url = f"https://www.kijijiautos.ca/cars/{make}/{model}/used/"
    html = fetch(url)
    if len(html) < 5000:
        print(f"  [{make}/{model}] thin response ({len(html)} bytes) — bot wall?", file=sys.stderr)
        return []
    # Pull anchor hrefs that match Kijiji's listing-detail URL pattern.
    # /a-<seo-slug>-<numeric-id> — ID is the cross-source stockId.
    hrefs = re.findall(r'href="(/a-[a-z0-9\-]+-\d+)"', html)
    seen: set[str] = set()
    out: list[str] = []
    for h in hrefs:
        if h in seen:
            continue
        seen.add(h)
        out.append(f"https://www.kijijiautos.ca{h}")
    return out


def parse_detail(html: str, url: str) -> dict | None:
    """Phase 2: extract VIN + price + km + dealer from a listing detail page.

    TODO(D-core): finalize regex / JSON-LD parsing once we have real HTML.
    Kijiji embeds JSON-LD (Vehicle schema) and a __NEXT_DATA__ blob.
    """
    if len(html) < 5000:
        return None
    out: dict = {"url": url}
    # JSON-LD Vehicle (most reliable)
    m = re.search(r'<script type="application/ld\+json"[^&gt;]*&gt;(.*?)&lt;/script&gt;', html, re.DOTALL)
    if m:
        try:
            blob = json.loads(m.group(1))
            if isinstance(blob, dict) and blob.get("@type") in ("Vehicle", "Car"):
                out["vin"] = blob.get("vehicleIdentificationNumber")
                if blob.get("offers"):
                    offer = blob["offers"] if isinstance(blob["offers"], dict) else blob["offers"][0]
                    out["priceCad"] = offer.get("price")
                    out["dealerName"] = (offer.get("seller") or {}).get("name")
                out["mileageKm"] = blob.get("mileageFromOdometer", {}).get("value")
                out["year"] = blob.get("vehicleModelDate") or blob.get("modelDate")
                out["make"] = blob.get("brand", {}).get("name") if isinstance(blob.get("brand"), dict) else blob.get("brand")
                out["model"] = blob.get("model")
                out["trim"] = blob.get("vehicleConfiguration")
        except Exception:
            pass
    # Fallback: regex price
    if not out.get("priceCad"):
        m = re.search(r'"price"\s*:\s*"?(\d{4,6})', html)
        if m:
            out["priceCad"] = int(m.group(1))
    # Fallback: regex VIN (KMHK..., KNDC..., 17-char alphanumeric)
    if not out.get("vin"):
        m = re.search(r"\b([A-HJ-NPR-Z0-9]{17})\b", html)
        if m:
            out["vin"] = m.group(1)
    # Stable id from URL tail
    sid = re.search(r"-(\d+)$", url)
    out["stockId"] = sid.group(1) if sid else url
    return out


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
    skipped = 0
    for make, model in TARGETS:
        print(f"[{make}/{model}] enumerating…", file=sys.stderr)
        urls = search_urls(make, model)
        print(f"[{make}/{model}] {len(urls)} listings", file=sys.stderr)
        for url in urls:
            time.sleep(THROTTLE_SECONDS)
            html = fetch(url)
            entry = parse_detail(html, url)
            if not entry:
                skipped += 1
                continue
            entry["scrapedAt"] = now_iso()
            raw[entry["stockId"]] = entry
            fetched += 1
    OUT.write_text(json.dumps(raw, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"_kijiji_raw.json: fetched={fetched} skipped={skipped} total={len(raw)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
