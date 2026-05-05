#!/usr/bin/env python3
"""Phase D core: Leasebusters (leasebusters.com) lease-takeover scraper.

REWRITE 2026-05-05 (medium-tier I0d execution):
  Replaced legacy .asp gallery scrape with hybrid SPA POST against the
  ASP.NET MVC Razor Pages backend at /vehicle-search-result.
  Architecture per docs/handoff/research/LEASEBUSTERS_VIN_DECISION_2026-05-04.md.

  Flow:
    1. GET /vehicle-search/Leasing  → harvest cookies + map make->makeId
       from `<input name="makes" value="N">` checkbox elements
    2. GET /vehicle-search-result   → harvest fresh __RequestVerificationToken
    3. POST /vehicle-search-result  → with token (header + form), serialized
       hidden inputs, and `makes` filter. Returns partial HTML.
    4. Parse partial HTML for /details/{id}/{slug} link patterns.
    5. For each detail page, fetch + parse fields (no VIN exposed).

  Anti-bot: site is plain ASP.NET, no Cloudflare WAF observed during
  probe. Throttle 1.5s between requests (polite default).

  Empirical state at I0d landing: server consistently returns "No Vehicle
  Matches" for any Hyundai/Kia query with the documented form payload.
  Either (a) Hyundai/Kia EV lease-takeover inventory is genuinely zero
  (plausible — small market, fast turnover), or (b) the form requires
  another hidden field we haven't identified. Scraper exits 0 with empty
  output in either case — non-blocking for the daily refresh pipeline.
  Re-probe on next high-tier session if Leasebusters value climbs.

  No VIN extraction (confirmed absent on detail pages).
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "_leasebusters_raw.json"
COOKIE_JAR = ROOT / "data" / ".lb_cookies.txt"

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/17.5 Safari/605.1.15"
)
THROTTLE_SECONDS = 1.5
POSTAL_CODE = "M5V0A1"  # downtown Toronto, sane Canadian default
MAX_DISTANCE_KM = 10000  # all-Canada
TARGET_MAKES = ["Hyundai", "Kia"]

BASE = "https://www.leasebusters.com"


def curl(url: str, *, post_data: str | None = None, headers: list[str] | None = None) -> str:
    """Wrap curl with cookie jar reuse."""
    COOKIE_JAR.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "curl", "-sS", "-L", "--max-time", "25",
        "-b", str(COOKIE_JAR), "-c", str(COOKIE_JAR),
        "-A", USER_AGENT,
        "--compressed",
    ]
    for h in headers or []:
        cmd.extend(["-H", h])
    if post_data is not None:
        cmd.extend(["-X", "POST", "--data", post_data])
    cmd.append(url)
    try:
        proc = subprocess.run(cmd, capture_output=True, timeout=30, text=False)
        return proc.stdout.decode("utf-8", errors="replace") if proc.returncode == 0 else ""
    except Exception:
        return ""


def harvest_make_ids() -> dict[str, int]:
    """Parse the search-builder page for makeName -> makeId."""
    html = curl(f"{BASE}/vehicle-search/Leasing")
    if not html:
        return {}
    out: dict[str, int] = {}
    for m in re.finditer(
        r'<input\s+name="makes"[^>]*value="(\d+)"[^>]*>\s*<img[^>]*>\s*<label[^>]*>([A-Za-z][\w\s-]*?)</label>',
        html,
    ):
        out[m.group(2).strip()] = int(m.group(1))
    return out


def harvest_token() -> str:
    """Get a fresh __RequestVerificationToken from the search-result page."""
    html = curl(f"{BASE}/vehicle-search-result?gallery=Leasing")
    m = re.search(
        r'name="__RequestVerificationToken"[^>]*value="([^"]+)"',
        html,
    )
    return m.group(1) if m else ""


def search_post(token: str, make_ids: list[int]) -> str:
    """POST search form, return partial HTML body."""
    fields = [
        ("__RequestVerificationToken", token),
        ("SearchResult.VehicleSearchResultsEr.ReverseOrderBy", "False"),
        ("SearchResult.VehicleSearchResultsEr.SelectedGallery", "Leasing"),
        ("SearchResult.VehicleSearchResultsEr.ListingID", ""),
        ("SearchResult.VehicleSearchResultsEr.Top", "100"),
        ("SearchResult.VehicleSearchResultsEr.Skip", "0"),
        ("SearchResult.VehicleSearchResultsEr.MaximumDistanceToSeller", str(MAX_DISTANCE_KM)),
        ("SearchResult.VehicleSearchResultsEr.PostalCode", POSTAL_CODE),
        ("SearchResult.VehicleSearchResultsEr.OrderBy", "3"),
        ("SearchResult.CurrentPage", "0"),
    ]
    for mid in make_ids:
        fields.append(("makes", str(mid)))
    body = urlencode(fields)
    return curl(
        f"{BASE}/vehicle-search-result",
        post_data=body,
        headers=[
            f"RequestVerificationToken: {token}",
            "Content-Type: application/x-www-form-urlencoded",
            "X-Requested-With: XMLHttpRequest",
            f"Referer: {BASE}/vehicle-search-result?gallery=Leasing",
        ],
    )


def parse_listing_links(html: str) -> list[tuple[int, str]]:
    """Extract (listingId, detailUrl) pairs from result partial."""
    found = re.findall(r'href="(/details/(\d+)/[^"]+)"', html)
    seen: dict[int, str] = {}
    for url, sid in found:
        seen[int(sid)] = f"{BASE}{url}"
    return list(seen.items())


def parse_detail(html: str) -> dict:
    """Parse fields from a detail page. No VIN extraction."""
    out: dict = {}
    # Year + Make + Model from the H1 / title
    m = re.search(r'<h1[^>]*>(\d{4})\s+([A-Za-z]+)\s+([\w\s-]+?)</h1>', html)
    if m:
        out["year"] = int(m.group(1))
        out["make"] = m.group(2).strip()
        out["model"] = m.group(3).strip()
    # Trim/Style
    m = re.search(r'(?:Style|Trim)[^<]*</[^>]+>\s*<[^>]+>([^<]+)<', html, re.IGNORECASE)
    if m:
        out["trim"] = m.group(1).strip()
    # Odometer
    m = re.search(r'(?:Odometer|Kilometres|km on)[^<]*</[^>]+>[^<]*<[^>]+>\s*([\d,]+)', html, re.IGNORECASE)
    if m:
        out["mileageKm"] = int(m.group(1).replace(",", ""))
    # Monthly payment
    m = re.search(r'\$\s?([\d,]+(?:\.\d+)?)\s*(?:/mo|monthly)', html, re.IGNORECASE)
    if m:
        out["monthlyPaymentCad"] = float(m.group(1).replace(",", ""))
    # Months remaining
    m = re.search(r'(\d+)\s*month', html, re.IGNORECASE)
    if m:
        out["monthsRemaining"] = int(m.group(1))
    # Cash incentive
    m = re.search(r'(?:cash\s+incentive|incentive)[^$]*\$\s?([\d,]+)', html, re.IGNORECASE)
    if m:
        out["cashIncentiveCad"] = int(m.group(1).replace(",", ""))
    # Province (2-letter)
    m = re.search(r'\b(AB|BC|MB|NB|NL|NS|ON|PE|QC|SK)\b', html)
    if m:
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

    print("[lb] harvesting make IDs…", file=sys.stderr)
    make_ids = harvest_make_ids()
    targets = [make_ids[m] for m in TARGET_MAKES if m in make_ids]
    if not targets:
        print(f"[lb] WARN: target makes not found in {list(make_ids)[:10]}…", file=sys.stderr)
        # Still write empty to keep merge happy.
        OUT.write_text(json.dumps(raw, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        return 0

    time.sleep(THROTTLE_SECONDS)
    token = harvest_token()
    if not token:
        print("[lb] WARN: token harvest failed", file=sys.stderr)
        OUT.write_text(json.dumps(raw, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        return 0

    time.sleep(THROTTLE_SECONDS)
    print(f"[lb] searching makes={targets}…", file=sys.stderr)
    partial = search_post(token, targets)
    links = parse_listing_links(partial)
    print(f"[lb] {len(links)} detail links from search", file=sys.stderr)

    fetched = 0
    for sid, url in links:
        time.sleep(THROTTLE_SECONDS)
        detail_html = curl(url)
        if not detail_html:
            continue
        entry = parse_detail(detail_html)
        if not entry.get("year") or not entry.get("make"):
            continue
        entry["url"] = url
        entry["stockId"] = str(sid)
        entry["scrapedAt"] = now_iso()
        raw[str(sid)] = entry
        fetched += 1

    OUT.write_text(json.dumps(raw, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"_leasebusters_raw.json: total={len(raw)} (fresh={fetched})", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
