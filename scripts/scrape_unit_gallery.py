#!/usr/bin/env python3
"""Phase C2: extract per-unit photo URLs from AutoTrader listings.

TODO(medium): this script is functional but Imperva sometimes returns
~1KB placeholder pages instead of real listing HTML. The script
already handles this gracefully (empty photos array, "no photos
(len=N)" note logged). Cron-runs nightly so transient walls retry
the next day. No action needed unless Ian flags consistently empty
unit-photos.json after a week of cron runs — then revisit by:
  - Capturing the working Apify scrape XHR pattern (Phase B-bis), OR
  - Adding a second source (Kijiji photos via the D-core scraper)

For each unit in data/units.json with a listingUrl, fetch the listing and
extract photo URLs from JSON-LD or embedded JSON. Output is keyed by
unit ID. Cron-runs nightly via scripts/refresh_daily.sh.

Usage:
    python3 scripts/scrape_unit_gallery.py            # all units
    python3 scripts/scrape_unit_gallery.py <unit_id>  # single unit

Output (data/unit-photos.json):
    { "u-at-...": { "photos": ["https://..."], "scrapedAt": "..." } }

Limitations:
- AutoTrader uses Imperva. Most fetches return placeholder pages even
  with curl --http2. Affected units get an empty photos array. The cron
  will re-attempt nightly.
- Photo URLs are direct CDN links to AutoTrader's static.autotrader.ca
  (or trader.com). We surface them via <img> tags — no rehosting.
"""
from __future__ import annotations

import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# scripts/ is on the python path via cron; for direct invocations from the
# repo root, add it explicitly so lib_* imports resolve.
SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from lib_scrape_common import fetch_html  # noqa: E402
from lib_scrape_metrics import record_run  # noqa: E402

ROOT = SCRIPTS_DIR.parent
UNITS_JSON = ROOT / "data" / "units.json"
PHOTOS_JSON = ROOT / "data" / "unit-photos.json"
MAX_PHOTOS = 15
THROTTLE_SECONDS = 2.0  # respectful pacing between fetches


def fetch(url: str) -> str:
    """Thin wrapper preserving the prior 'empty string on error' contract."""
    try:
        return fetch_html(url, timeout=20, http2=True)
    except Exception:
        return ""


def extract_photos(html: str) -> list[str]:
    if len(html) < 5000:
        # Imperva placeholder
        return []
    # Strategy 1: JSON-LD with image array
    m = re.search(r'"image"\s*:\s*\[(.*?)\]', html, re.DOTALL)
    candidates: list[str] = []
    if m:
        candidates += re.findall(r'"(https?://[^"]+)"', m.group(1))
    # Strategy 2: trader.com / autotrader.ca CDN URL pattern
    candidates += re.findall(
        r'https?://(?:[a-z0-9.-]+\.)?(?:trader\.com|autotrader\.ca)/[^\s"\'<>]+\.(?:jpg|jpeg|webp|png)',
        html,
    )
    # Dedupe + cap
    seen: set[str] = set()
    out: list[str] = []
    for c in candidates:
        if c in seen:
            continue
        seen.add(c)
        out.append(c)
        if len(out) >= MAX_PHOTOS:
            break
    return out


def load_units() -> list[dict]:
    with UNITS_JSON.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def load_existing() -> dict:
    if not PHOTOS_JSON.exists():
        return {}
    with PHOTOS_JSON.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def save(out: dict) -> None:
    PHOTOS_JSON.write_text(json.dumps(out, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def scrape_one(unit: dict) -> tuple[list[str], str]:
    url = unit.get("listingUrl")
    if not url:
        return [], "no listingUrl"
    html = fetch(url)
    photos = extract_photos(html)
    note = "ok" if photos else f"no photos (len={len(html)})"
    return photos, note


def main() -> int:
    started = time.time()
    units = load_units()
    existing = load_existing()

    target_ids: set[str]
    if len(sys.argv) > 1:
        target_ids = {sys.argv[1]}
    else:
        target_ids = {u["id"] for u in units}

    fetched = 0
    skipped = 0
    pages_walked = 0
    for unit in units:
        if unit["id"] not in target_ids:
            continue
        photos, note = scrape_one(unit)
        pages_walked += 1
        if photos:
            existing[unit["id"]] = {
                "photos": photos,
                "scrapedAt": now_iso(),
                "note": note,
            }
            fetched += 1
        else:
            # Keep prior entry if we have one (cron will retry tomorrow)
            if unit["id"] not in existing:
                existing[unit["id"]] = {
                    "photos": [],
                    "scrapedAt": now_iso(),
                    "note": note,
                }
            skipped += 1
        time.sleep(THROTTLE_SECONDS)

    save(existing)
    duration = time.time() - started
    print(f"unit-photos.json: fetched={fetched} skipped={skipped} target={len(target_ids)}")
    record_run(
        source="autotrader-gallery",
        fetched=fetched,
        unique=fetched,
        vin_pct=0.0,
        vin_checksum_ok_pct=0.0,
        errors=skipped,  # treat Imperva-walled responses as soft errors
        pages_walked=pages_walked,
        duration_s=duration,
        max_pages_hit=False,
        notes=f"target={len(target_ids)}",
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
