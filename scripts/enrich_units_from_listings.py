#!/usr/bin/env python3
"""Enrich units.json by visiting each listingUrl and parsing detail pages.

Workflow proposed by user: high-reasoning ripped the listing index URLs into
units.json. This script (designed to run on medium reasoning) walks each URL
and pulls the fields the index pages don't expose:

  - daysOnLot (AutoTrader shows "X days ago" near the listing date)
  - actual MSRP from the listing's price-breakdown widget (when present)
  - dealer phone number (footer / contact card)
  - dealer street address (contact card)
  - exterior + interior color (sometimes more accurate than URL slug)
  - VIN (when not blocked behind a contact form)

Output: data/units-enrichment.json with one row per unit id. data.ts will be
updated to merge this on top of units.json so re-runs only touch the
enrichment file (units.json stays the canonical scrape).

Run:    python3 scripts/enrich_units_from_listings.py [--limit N] [--ids id1,id2]

Notes:
  - AutoTrader uses Imperva/Incapsula bot protection. WebFetch (per-URL
    fetches via Claude / a paid proxy) gets through; raw curl does not.
  - Designed to be resumable — already-enriched ids are skipped unless
    --force is passed.
  - Be polite: 2-3 sec sleep between fetches. ~80 dealers * ~1.2 listings
    each = ~100 fetches = ~5 minutes wall time.
"""
import argparse
import json
import re
import sys
import time
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

ROOT = Path(__file__).resolve().parent.parent
UNITS = ROOT / "data" / "units.json"
ENRICH = ROOT / "data" / "units-enrichment.json"

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/17.5 Safari/605.1.15"
)

# Regex map keyed by enrichment field. Each tuple is (compiled_pattern,
# group_index). Tuned against AutoTrader's Apr-2026 markup; revisit if the
# detail-page DOM changes.
PATTERNS = {
    "daysOnLot": re.compile(r"(\d+)\s+days?\s+(?:ago|on\s+lot)", re.I),
    "vin": re.compile(r'"vin"\s*:\s*"([A-HJ-NPR-Z0-9]{17})"'),
    "phone": re.compile(r'"telephone"\s*:\s*"([\+\d\(\)\-\.\s]{7,20})"'),
    "streetAddress": re.compile(r'"streetAddress"\s*:\s*"([^"]{3,80})"'),
    "msrp": re.compile(r'(?:MSRP|Manufacturer.{1,5}Suggested)[^\d]{0,40}\$?\s*([\d,]+)', re.I),
    "exteriorColor": re.compile(r'"exteriorColor"\s*:\s*"([^"]+)"'),
    "interiorColor": re.compile(r'"interiorColor"\s*:\s*"([^"]+)"'),
}


def fetch(url: str, timeout: int = 25) -> str | None:
    try:
        req = Request(url, headers={"User-Agent": UA, "Accept": "text/html"})
        with urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", errors="ignore")
            # Imperva challenge bodies are tiny — skip.
            if len(body) < 5000:
                print(f"  bot-blocked ({len(body)} bytes)", file=sys.stderr)
                return None
            return body
    except (URLError, HTTPError) as e:
        print(f"  fetch error: {e}", file=sys.stderr)
        return None


def parse(body: str) -> dict:
    out = {}
    for field, pat in PATTERNS.items():
        m = pat.search(body)
        if not m:
            continue
        val = m.group(1).strip()
        if field in ("daysOnLot", "msrp"):
            try:
                out[field] = int(val.replace(",", ""))
            except ValueError:
                pass
        else:
            out[field] = val
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, help="enrich at most N units")
    ap.add_argument("--ids", help="comma-separated unit ids to (re-)enrich")
    ap.add_argument("--force", action="store_true", help="re-fetch already-enriched units")
    ap.add_argument("--sleep", type=float, default=2.5, help="seconds between fetches")
    args = ap.parse_args()

    units = json.loads(UNITS.read_text())
    enriched = json.loads(ENRICH.read_text()) if ENRICH.exists() else {}

    target_ids = set(args.ids.split(",")) if args.ids else None

    candidates = []
    for u in units:
        if not u.get("listingUrl"):
            continue
        if target_ids and u["id"] not in target_ids:
            continue
        if not args.force and u["id"] in enriched:
            continue
        candidates.append(u)
    if args.limit:
        candidates = candidates[: args.limit]

    print(f"enriching {len(candidates)} units (skipping {len(enriched)} already done)")
    for i, u in enumerate(candidates, start=1):
        print(f"[{i}/{len(candidates)}] {u['id']}: {u['listingUrl']}")
        body = fetch(u["listingUrl"])
        if body:
            data = parse(body)
            if data:
                enriched[u["id"]] = {**data, "fetchedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
                print(f"  ok: {sorted(data.keys())}")
            else:
                print("  no fields matched")
        ENRICH.write_text(json.dumps(enriched, indent=2, sort_keys=True) + "\n")
        time.sleep(args.sleep)

    print(f"done. enrichment.json now has {len(enriched)} entries")


if __name__ == "__main__":
    main()
