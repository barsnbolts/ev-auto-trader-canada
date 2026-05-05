#!/usr/bin/env python3
"""Phase D core: Leasebusters (leasebusters.com) lease-takeover scraper.

TODO(medium): this scraper currently returns 0 listings. SUPERSEDED
architectural notes from the old "Vue/SPA + XHR" theory have been
removed; see Chrome MCP probe results below.

CHROME MCP PROBE 2026-05-04 EVENING (Opus, paired Browser 1):
  - Site is fully server-rendered ASP.NET MVC, NOT a Vue/SPA.
  - Zero XHR fired during navigation under universal capture hook.
  - Legacy .asp URLs all 302 -> homepage (the entire URL scheme changed).
  - Detail-page HTML does NOT expose VIN. fallbackKey approach stays.

  Full findings + new URL pattern + make-ID map + postal-code gate
  details: docs/handoff/research/LEASEBUSTERS_VIN_DECISION_2026-05-04.md
  Raw probe data: docs/handoff/research/LEASEBUSTERS_XHR_CAPTURE_2026-05-04.json

WHAT MEDIUM NEEDS TO DO (mechanical, ~5-8k tokens):
  1. Replace fetch_listings() body with HTML parser, NOT XHR replay:
       - GET /vehicle-search/Leasing -> harvest __RequestVerificationToken
         + map make names -> makeIds from checkbox values
       - POST /vehicle-search-result with makes={id} + default postal code
         (try K1A 0B1 or M5V 0A1)
       - Parse response HTML for /details/{listingId}/{slug} link patterns
       - For each listingId, fetch detail page, parse Year/Make/Model/
         Style/Odometer/Province/Engine Type
  2. Build fallbackKey = f"{year}|{make.lower()}|{model.lower()}|{trim_norm}|{km_bucket(km)}"
  3. Do NOT add VIN extraction (it does not exist on the page).
  4. Run scripts/merge_cross_sources.py - already joins via fallbackKey.
  5. Verify: jq 'keys | length' data/cross-listings.json > 0.

PER D0 RESEARCH (still trustworthy):
  Listing schema fields exposed on cards:
    Year, Make, Model, Monthly payment (incl. tax), Months remaining,
    Cash incentive, Province (2-letter), Kilometres-on-clock, Sale
    price for buyout, Photo URL.

Output: data/_leasebusters_raw.json - keyed by Leasebusters listing ID.
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
OUT = ROOT / "data" / "_leasebusters_raw.json"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/17.5 Safari/605.1.15"
)
THROTTLE_SECONDS = 1.5  # Leasebusters has no WAF — be polite anyway

MAKES = ["Hyundai", "Kia"]


def fetch(url: str) -> str:
    cmd = [
        "curl", "-sS", "-L", "--max-time", "20",
        "-A", USER_AGENT,
        "-H", "Accept: text/html,*/*;q=0.8",
        "-H", "Accept-Language: en-CA,en-US;q=0.9",
        "-H", "Accept-Encoding: gzip, deflate",
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


def search_listings(make: str) -> list[dict]:
    """Phase 1+2 combined for Leasebusters: gallery results page exposes
    most fields per card; detail page is only needed for the cash
    incentive number.

    TODO(D-core): verify selectors against an actual DOM dump. Card
    boundaries on the legacy ASP page are typically `<div class="lb-card">`
    or table rows. Need to confirm.
    """
    url = (
        f"https://www.leasebusters.com/en/lease-take-over-vehicle-gallery-results.asp"
        f"?MakeID={make}&view=slower&leftside=false"
    )
    html = fetch(url)
    if len(html) < 5000:
        print(f"  [{make}] thin response ({len(html)} bytes)", file=sys.stderr)
        return []
    listings: list[dict] = []
    # Best-guess card boundary based on classic ASP markup conventions.
    # TODO(D-core): replace with confirmed selector after first probe.
    cards = re.findall(
        r'<div[^>]*class="[^"]*(?:vehicle-card|lb-card|leasecard)[^"]*"[^>]*>(.*?)</div>\s*</div>',
        html,
        re.DOTALL | re.IGNORECASE,
    )
    if not cards:
        # Fallback: try table-row layout (the asp page is sometimes a table)
        cards = re.findall(r"<tr[^>]*>(.*?)</tr>", html, re.DOTALL)
    for card in cards:
        entry = parse_card(card)
        if entry:
            listings.append(entry)
    return listings


def parse_card(card_html: str) -> dict | None:
    """Extract fields from a single listing card.

    TODO(D-core): regex anchors are best-effort. Real Leasebusters DOM
    has labels like 'Lease Term Remaining', 'Monthly Payment Including
    Tax', 'Cash Incentive'. Confirm exact spans with WebFetch.
    """
    out: dict = {}
    # Listing detail URL → contains the stable ID
    m = re.search(r'href="([^"]*lease-takeover[^"]*\?[^"]*ID=(\d+))', card_html)
    if not m:
        return None
    out["url"] = m.group(1) if m.group(1).startswith("http") else f"https://www.leasebusters.com/{m.group(1).lstrip('/')}"
    out["stockId"] = m.group(2)
    # Year + Make + Model + Trim from card title
    t = re.search(r"(\d{4})\s+([A-Za-z]+)\s+([\w\s\-]+?)(?:\s+\$|\s*<)", card_html)
    if t:
        out["year"] = int(t.group(1))
        out["make"] = t.group(2).strip()
        out["model"] = t.group(3).strip()
    # Monthly payment + tax
    m = re.search(r"\$\s?([\d,]+(?:\.\d+)?)\s*(?:/mo|monthly|per month)", card_html, re.IGNORECASE)
    if m:
        out["monthlyPaymentCad"] = float(m.group(1).replace(",", ""))
    # Months remaining
    m = re.search(r"(\d+)\s*(?:months?|mo)\s*(?:remaining|left|to go)", card_html, re.IGNORECASE)
    if m:
        out["monthsRemaining"] = int(m.group(1))
    # Cash incentive
    m = re.search(r"(?:cash\s+incentive|incentive)[:\s]*\$\s?([\d,]+)", card_html, re.IGNORECASE)
    if m:
        out["cashIncentiveCad"] = int(m.group(1).replace(",", ""))
    # km
    m = re.search(r"([\d,]+)\s*km", card_html, re.IGNORECASE)
    if m:
        out["mileageKm"] = int(m.group(1).replace(",", ""))
    # Province (2-letter)
    m = re.search(r">\s*([A-Z]{2})\s*<", card_html)
    if m and m.group(1) in {"AB", "BC", "MB", "NB", "NL", "NS", "ON", "PE", "QC", "SK"}:
        out["province"] = m.group(1)
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
    total = 0
    for make in MAKES:
        time.sleep(THROTTLE_SECONDS)
        print(f"[{make}] enumerating…", file=sys.stderr)
        listings = search_listings(make)
        print(f"[{make}] {len(listings)} cards parsed", file=sys.stderr)
        for entry in listings:
            entry["scrapedAt"] = now_iso()
            raw[entry["stockId"]] = entry
            total += 1
    OUT.write_text(json.dumps(raw, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"_leasebusters_raw.json: total={total}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
