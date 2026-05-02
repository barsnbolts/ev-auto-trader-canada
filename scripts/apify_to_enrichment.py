#!/usr/bin/env python3
"""Merge Apify autotrader-canada output into data/units-enrichment.json.

Input: a JSON array of dataset items from `mcp__Apify__get-actor-output`,
either via stdin or `--input <path>`.

Output: rewrites data/units-enrichment.json keyed by stable unit id (the
SHA1 hash of listingUrl from build_units_from_at.py). Preserves any
hand-curated enrichment fields not in Apify output.

Field mapping (Apify → enrichment):
    vin              → vin
    daysOnMarket     → daysOnLot
    dealerPhone      → phone
    dealerAddress    → streetAddress
    msrp             → msrp           (only when Apify confirms — overrides
                                       our DEFAULT_MSRP fallback)
    exteriorColour   → exteriorColor
    interiorColour   → interiorColor

Run after the Apify run completes:
    python3 scripts/apify_to_enrichment.py --input /tmp/apify_at.json
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENRICH = ROOT / "data" / "units-enrichment.json"


def stable_id(url: str) -> str:
    return f"u-at-{hashlib.sha1(url.encode()).hexdigest()[:8]}"


# Apify field name → enrichment field name. Source of truth: actor README +
# inferred output schema. If a future actor version renames fields, update
# this one map and re-run.
FIELD_MAP = {
    "vin": "vin",
    "VIN": "vin",
    "daysOnMarket": "daysOnLot",
    "daysOnLot": "daysOnLot",
    "dealerPhone": "phone",
    "phone": "phone",
    "dealerAddress": "streetAddress",
    "streetAddress": "streetAddress",
    "exteriorColour": "exteriorColor",
    "exteriorColor": "exteriorColor",
    "interiorColour": "interiorColor",
    "interiorColor": "interiorColor",
    "msrp": "msrp",
    "msrpCad": "msrp",
}


def transform(item: dict) -> tuple[str, dict] | None:
    url = item.get("listingUrl") or item.get("url") or item.get("vehicleUrl")
    if not url:
        return None
    enriched = {}
    for src, dst in FIELD_MAP.items():
        v = item.get(src)
        if v in (None, "", 0):
            continue
        enriched[dst] = v
    if not enriched:
        return None
    return stable_id(url), enriched


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", help="path to Apify dataset JSON; reads stdin if omitted")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    raw = (Path(args.input).read_text() if args.input else sys.stdin.read()).strip()
    if not raw:
        print("ERR: no input provided")
        return 1
    items = json.loads(raw)
    if not isinstance(items, list):
        print(f"ERR: expected JSON array, got {type(items).__name__}")
        return 1

    existing = json.loads(ENRICH.read_text()) if ENRICH.exists() else {}
    merged = dict(existing)
    new_count = updated_count = 0
    for item in items:
        result = transform(item)
        if not result:
            continue
        uid, fields = result
        if uid in merged:
            updated_count += 1
            merged[uid] = {**merged[uid], **fields}
        else:
            new_count += 1
            merged[uid] = fields

    if args.dry_run:
        print(f"DRY RUN: would write {len(merged)} entries (new {new_count}, updated {updated_count})")
        return 0

    ENRICH.write_text(json.dumps(merged, indent=2) + "\n")
    print(f"OK: {ENRICH.name} now has {len(merged)} entries (new {new_count}, updated {updated_count})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
