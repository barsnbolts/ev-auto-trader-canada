#!/usr/bin/env python3
"""Phase D core: Kijiji.ca cars + trucks scraper.

SHIPPED 2026-05-04 (medium-tier session): walks __NEXT_DATA__ Apollo
cache. Verified via Chrome MCP probe — 41/43 listings carry strict-VIN
attributes (95% coverage), all of: vin, stock, caryear, carmake,
carmodel, cartrim, carmileageinkms, drivetrain, carcolor, plus
price.amount + location.address + url + imageUrls.

Refactored 2026-05-04 (extra-high pass): extracted shared helpers to
scripts/lib_scrape_common.py. Added VIN check-digit validation +
duplicate-page break (Kijiji wraps to page 1 when out of pages —
detect by no-new-stockId-this-page).

URL slug confirmed: /b-cars-trucks/canada/<make>-<model>/k0c174l0
(category 174 = "Cars & Trucks", l0 = all-Canada). The `k0` prefix is
required; without it Kijiji returns the make-model-name landing page,
not the listings page.

DO NOT filter by attributes.carmodel — Kijiji's enum lags new models
(e.g. 2026 Ioniq 9 listings tagged 'othrmdl', Niro EV tagged 'niro ev'
with space). Trust the URL slug; the server filters correctly.

Output: data/_kijiji_raw.json — keyed by Kijiji ad id (numeric string).
Anti-bot: none observed. Plain curl + browser UA returns full HTML.
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from lib_scrape_common import (  # noqa: E402
    apollo_entities,
    extract_next_data,
    fallback_key,
    fetch_html,
    is_valid_vin,
    now_iso,
    province_from_address,
    safe_int,
    vin_check_digit_ok,
)
from lib_scrape_metrics import record_run, suggest_max_pages  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "_kijiji_raw.json"
THROTTLE_SECONDS = 2.0
DEFAULT_MAX_PAGES = 8

# Models we track. Aligns with src/lib/constants.ts MODELS.
# (kijiji_make_slug, kijiji_model_slug, label)
TARGETS = [
    ("kia", "ev6", "EV6"),
    ("kia", "ev9", "EV9"),
    ("kia", "niro-ev", "NiroEV"),
    ("hyundai", "ioniq-5", "Ioniq5"),
    ("hyundai", "ioniq-6", "Ioniq6"),
    ("hyundai", "ioniq-9", "Ioniq9"),
]


def parse_listings(html: str) -> tuple[list[dict], int, int]:
    """Returns (listings, total_seen, total_with_valid_vin) so caller
    can compute true upstream VIN coverage (not post-filter)."""
    next_data = extract_next_data(html)
    if not next_data:
        return [], 0, 0
    out: list[dict] = []
    total_seen = 0
    total_with_vin = 0
    for _, listing in apollo_entities(next_data, "AutosListing"):
        total_seen += 1
        attrs = _flatten_attrs(listing.get("attributes"))
        vin = attrs.get("vin")
        if not is_valid_vin(vin):
            continue  # ~5% of dealer ads omit VIN entirely
        total_with_vin += 1
        # Soft validation: check-digit. Kijiji is mostly clean but a
        # handful of dealer typos slip through. Tag confidence rather
        # than reject — downstream merge can prefer check-digit-ok.
        vin_ok = vin_check_digit_ok(vin)
        url = listing.get("url")
        if isinstance(url, str) and url.startswith("/"):
            url = f"https://www.kijiji.ca{url}"
        price = listing.get("price") or {}
        amount_cents = price.get("amount") if isinstance(price, dict) else None
        price_cad = (amount_cents // 100) if isinstance(amount_cents, int) else None
        location = listing.get("location") or {}
        address = location.get("address") if isinstance(location, dict) else None
        coords = location.get("coordinates") if isinstance(location, dict) else None
        poster = listing.get("posterInfo") or {}
        year = safe_int(attrs.get("caryear"))
        make = attrs.get("carmake")
        model = attrs.get("carmodel")
        trim = attrs.get("cartrim")
        mileage = safe_int(attrs.get("carmileageinkms"))
        out.append(
            {
                "stockId": listing.get("id") or attrs.get("stock") or vin,
                "vin": vin,
                "vinChecksumOk": vin_ok,
                "fallbackKey": fallback_key(year, make, model, trim, mileage),
                "url": url,
                "title": listing.get("title"),
                "priceCad": price_cad,
                "priceClassification": _price_rating(price),
                "mileageKm": mileage,
                "year": year,
                "make": make,
                "model": model,
                "trim": trim,
                "drivetrain": attrs.get("drivetrain"),
                "color": attrs.get("carcolor"),
                "interiorColor": attrs.get("carinteriorcolor"),
                "bodyType": attrs.get("carbodytype"),
                "fuelType": attrs.get("carfueltype"),
                "kijijiStockNumber": attrs.get("stock"),
                "address": address,
                "province": province_from_address(address),
                "lat": coords.get("latitude") if isinstance(coords, dict) else None,
                "lon": coords.get("longitude") if isinstance(coords, dict) else None,
                "dealerKijijiId": poster.get("posterId"),
                "dealerRating": poster.get("rating"),
                "imageUrls": (listing.get("imageUrls") or [])[:5],
                "imageCount": listing.get("imageCount"),
            }
        )
    return out, total_seen, total_with_vin


def _flatten_attrs(attrs_obj) -> dict:
    if not isinstance(attrs_obj, dict):
        return {}
    items = attrs_obj.get("all") or []
    if not isinstance(items, list):
        return {}
    flat: dict = {}
    for entry in items:
        if not isinstance(entry, dict):
            continue
        name = entry.get("canonicalName")
        values = entry.get("canonicalValues")
        if isinstance(name, str) and isinstance(values, list) and values:
            flat[name] = values[0]
    return flat


def _price_rating(price):
    if not isinstance(price, dict):
        return None
    cls = price.get("classification")
    if not isinstance(cls, dict):
        return None
    return cls.get("rating")


def main() -> int:
    import time as _time
    started = _time.time()
    max_pages = suggest_max_pages("kijiji", default=DEFAULT_MAX_PAGES)
    print(f"[kijiji] adaptive max_pages = {max_pages} (default {DEFAULT_MAX_PAGES})", file=sys.stderr)
    raw: dict[str, dict] = {}
    if OUT.exists():
        try:
            raw = json.loads(OUT.read_text())
        except Exception:
            raw = {}
    fetched = 0
    pages_walked = 0
    errors = 0
    vin_total = 0          # total ads seen upstream (counted at parse time, includes page-dups)
    vin_with_field = 0     # subset of above that carried a strict VIN
    vin_checksum_ok = 0    # subset of vin_with_field that passed check-digit
    cap_hit_anywhere = False
    seen_total: set[str] = set()
    for make, model_slug, model_label in TARGETS:
        seen_for_model: set[str] = set()
        for page in range(1, max_pages + 1):
            page_q = "" if page == 1 else f"&page={page}"
            url = (
                f"https://www.kijiji.ca/b-cars-trucks/canada/"
                f"{make}-{model_slug}/k0c174l0?ad=offering{page_q}"
            )
            print(f"[{make}/{model_slug}] page {page} fetching…", file=sys.stderr)
            pages_walked += 1
            html = fetch_html(url)
            if len(html) < 5000:
                print(f"  thin response ({len(html)} bytes) — stopping", file=sys.stderr)
                errors += 1
                break
            listings, page_seen, page_with_vin = parse_listings(html)
            vin_total += page_seen
            vin_with_field += page_with_vin
            for entry in listings:
                if entry.get("vinChecksumOk"):
                    vin_checksum_ok += 1
            page_new = 0
            for entry in listings:
                sid = str(entry["stockId"])
                if sid in seen_for_model:
                    continue
                seen_for_model.add(sid)
                seen_total.add(sid)
                entry["scrapedAt"] = now_iso()
                entry["sourceMakeLabel"] = model_label
                raw[sid] = entry
                fetched += 1
                page_new += 1
            print(f"  {len(listings)} parsed, {page_new} new", file=sys.stderr)
            if page == max_pages:
                cap_hit_anywhere = True
            # Kijiji wraps to page 1 once out of pages → no new stockIds.
            if page_new == 0:
                print(f"  (no new ads — stopping pagination)", file=sys.stderr)
                break
            time.sleep(THROTTLE_SECONDS)
    OUT.write_text(json.dumps(raw, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    # Adaptive metrics
    duration_s = _time.time() - started
    vin_pct = (vin_with_field / vin_total * 100.0) if vin_total else 0.0
    vin_ok_pct = (vin_checksum_ok / vin_with_field * 100.0) if vin_with_field else 0.0
    record_run(
        source="kijiji",
        fetched=fetched,
        unique=len(seen_total),
        vin_pct=vin_pct,
        vin_checksum_ok_pct=vin_ok_pct,
        errors=errors,
        pages_walked=pages_walked,
        duration_s=duration_s,
        max_pages_hit=cap_hit_anywhere,
        notes=f"max_pages={max_pages}, models={len(TARGETS)}",
    )
    print(
        f"_kijiji_raw.json: fetched={fetched} unique_session={len(seen_total)} "
        f"total_in_file={len(raw)} vin%={vin_pct:.1f} vin_ok%={vin_ok_pct:.1f} "
        f"pages={pages_walked} {duration_s:.1f}s",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
