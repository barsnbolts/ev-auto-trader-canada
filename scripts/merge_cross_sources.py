#!/usr/bin/env python3
"""Phase D core: merge per-source raw scrape files into the single
data/cross-listings.json that the React UI reads.

Inputs:
- data/units.json — our AutoTrader-derived inventory (already has VIN
  on units that exposed it during scrape)
- data/_kijiji_raw.json — Kijiji Autos raw (keyed by Kijiji ad id)
- data/_leasebusters_raw.json — Leasebusters raw (keyed by LB listing id)

Output (data/cross-listings.json):
    [
      {
        "vin": "KMHK...",
        "fallbackKey": "2024|hyundai|ioniq 5|preferred|22000",
        "year": 2024, "make": "Hyundai", "model": "Ioniq5",
        "trim": "Preferred",
        "listings": [
          { "source": "autotrader", "stockId": "...", "url": "...",
            "priceCad": 49995, "km": 22000, "dealerName": "...",
            "province": "ON", "lastVerified": "..." },
          { "source": "kijiji_autos", ... },
          { "source": "leasebusters", "monthlyPaymentCad": 612, ... }
        ]
      },
      ...
    ]

Merge rules:
1. AutoTrader is always source-of-truth for VIN (its scraper has the
   richest VIN coverage). Use its VIN + fallbackKey as the index.
2. Kijiji listings join by VIN if available; else by fallbackKey.
3. Leasebusters listings always join by fallbackKey (VIN anonymized).
4. An entry is emitted only if it has &gt;1 source OR (single-source
   Leasebusters with monthlyPaymentCad != null) — solo AutoTrader
   listings are already in units.json.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UNITS_JSON = ROOT / "data" / "units.json"
KIJIJI_RAW = ROOT / "data" / "_kijiji_raw.json"
LB_RAW = ROOT / "data" / "_leasebusters_raw.json"
OUT = ROOT / "data" / "cross-listings.json"


def load_json(path: Path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def km_bucket(km) -> str:
    if km is None:
        return "any"
    try:
        n = int(km)
    except (TypeError, ValueError):
        return "any"
    return str((n // 2000) * 2000)


# Model name normalization across sources. AutoTrader uses PascalCase
# (Ioniq5, EV6, NiroEV); Kijiji uses snake_case (ioniq_5, ev6, niro_ev).
# Without this, fallbackKey never matches across sources.
def normalize_model(m: str | None) -> str:
    if not m:
        return "?"
    s = m.strip().lower()
    # Strip spaces, hyphens, underscores → canonical alphanum
    s = s.replace(" ", "").replace("-", "").replace("_", "")
    # Aliases AutoTrader/Kijiji might use
    aliases = {
        "ioniq5": "ioniq5",
        "ioniq6": "ioniq6",
        "ioniq9": "ioniq9",
        "ev6": "ev6",
        "ev9": "ev9",
        "niroev": "niroev",
        "niro": "niroev",  # Kijiji sometimes drops EV suffix
        "kona": "konaev",  # if/when Kona EV gets pulled in
    }
    return aliases.get(s, s)


def normalize_trim(t: str | None) -> str:
    """Normalize trim string: lowercase, strip, collapse whitespace,
    drop punctuation. 'Land AWD' and 'land-awd' should match."""
    if not t:
        return "any"
    s = t.strip().lower()
    s = s.replace(",", " ").replace(".", " ").replace("/", " ")
    s = " ".join(s.split())  # collapse whitespace
    return s.replace(" ", "-")


def fallback_key(year, make, model, trim, km) -> str:
    # Note: km dropped from join key. AutoTrader rarely exposes km;
    # Kijiji always does. If we keyed by km bucket, AT entries with
    # km=None ("any") would never match Kijiji entries with real km.
    # Trim+year+make+model is specific enough to identify a vehicle
    # to within ~5 candidate listings, which all merge under one
    # entry's listings[]. km is preserved per-listing for downstream
    # filters.
    _ = km  # explicitly unused
    return "|".join(
        [
            str(year or "?"),
            (make or "?").lower(),
            normalize_model(model),
            normalize_trim(trim),
        ]
    )


def main() -> int:
    units = load_json(UNITS_JSON, [])
    kijiji = load_json(KIJIJI_RAW, {})
    lb = load_json(LB_RAW, {})

    # Build entries indexed by fallbackKey (VIN tracks alongside).
    entries: dict[str, dict] = {}

    def get_or_create(year, make, model, trim, km, vin) -> dict:
        key = fallback_key(year, make, model, trim, km)
        if key in entries:
            e = entries[key]
            if vin and not e.get("vin"):
                e["vin"] = vin
            return e
        entries[key] = {
            "vin": vin,
            "fallbackKey": key,
            "year": year,
            "make": make,
            "model": model,
            "trim": trim,
            "listings": [],
        }
        return entries[key]

    # 1. Seed from units.json (AutoTrader source of truth)
    for u in units:
        e = get_or_create(
            u.get("year"),
            "Hyundai" if (u.get("model") or "").startswith("Ioniq") else "Kia",
            u.get("model"),
            u.get("trim"),
            None,  # AutoTrader doesn't expose km on most units
            u.get("vin"),
        )
        e["listings"].append(
            {
                "source": "autotrader",
                "stockId": u["id"],
                "url": u.get("listingUrl"),
                "priceCad": u.get("dealerAskingPrice"),
                "km": None,
                "dealerName": u.get("dealerId"),
                "province": None,  # joined via dealers.json downstream if needed
                "lastVerified": u.get("lastSeen"),
            }
        )

    # 2. Layer Kijiji
    for stock_id, k in kijiji.items():
        e = get_or_create(
            k.get("year"),
            k.get("make"),
            k.get("model"),
            k.get("trim"),
            k.get("mileageKm"),
            k.get("vin"),
        )
        e["listings"].append(
            {
                "source": "kijiji_autos",
                "stockId": stock_id,
                "url": k.get("url"),
                "priceCad": k.get("priceCad"),
                "km": k.get("mileageKm"),
                "dealerName": k.get("dealerName"),
                "province": k.get("province"),
                "lastVerified": k.get("scrapedAt"),
            }
        )

    # 3. Layer Leasebusters (no VIN; fallbackKey only)
    for stock_id, l in lb.items():
        e = get_or_create(
            l.get("year"),
            l.get("make"),
            l.get("model"),
            l.get("trim"),
            l.get("mileageKm"),
            None,
        )
        e["listings"].append(
            {
                "source": "leasebusters",
                "stockId": stock_id,
                "url": l.get("url"),
                "priceCad": None,
                "km": l.get("mileageKm"),
                "dealerName": None,
                "province": l.get("province"),
                "monthlyPaymentCad": l.get("monthlyPaymentCad"),
                "monthsRemaining": l.get("monthsRemaining"),
                "cashIncentiveCad": l.get("cashIncentiveCad"),
                "lastVerified": l.get("scrapedAt"),
            }
        )

    # Emit only entries with cross-source value
    out: list[dict] = []
    for e in entries.values():
        sources = {l["source"] for l in e["listings"]}
        has_lease = any(l["source"] == "leasebusters" for l in e["listings"])
        if len(sources) > 1 or has_lease:
            out.append(e)

    OUT.write_text(json.dumps(out, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"cross-listings.json: {len(out)} entries from {len(entries)} candidates")
    return 0


if __name__ == "__main__":
    sys.exit(main())
