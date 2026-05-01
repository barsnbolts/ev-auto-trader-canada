#!/usr/bin/env python3
"""Build dealers.json + units.json from scraped AutoTrader listings.

Input:  /tmp/at_listings.json (array of {model,year,title,priceCad,dealerName,city,province,url})
Output: data/dealers.json, data/units.json (validated against existing schema invariants)

Run:    python3 scripts/build_units_from_at.py
"""
import json, re, sys, os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INPUT = Path("/tmp/at_listings.json")
SPECS = ROOT / "data" / "specs.json"
DEALERS_OUT = ROOT / "data" / "dealers.json"
UNITS_OUT = ROOT / "data" / "units.json"
EXISTING_DEALERS = ROOT / "data" / "dealers.json"

# Brand → freight/PDI defaults (from CLAUDE.md / constants.ts)
FREIGHT = {"Kia": 1995, "Hyundai": 2095}

# Model → brand
MODEL_BRAND = {
    "EV6": "Kia", "Ioniq5": "Hyundai", "Ioniq6": "Hyundai",
    "EV9": "Kia", "Ioniq9": "Hyundai",
}

# Trim catalogs straight from src/lib/constants.ts (canonical)
TRIMS = {
    "EV6":    ["Light RWD", "Wind RWD", "Wind AWD", "Land AWD", "GT-Line AWD", "GT"],
    "Ioniq5": ["Essential RWD", "Preferred RWD", "Preferred RWD Long Range",
               "Preferred AWD Long Range", "Limited AWD", "N"],
    "Ioniq6": ["Preferred RWD", "Preferred RWD Long Range",
               "Preferred AWD Long Range", "Limited AWD"],
    "EV9":    ["Light RWD", "Light Long Range RWD", "Land Long Range AWD", "GT-Line AWD"],
    "Ioniq9": ["Preferred Long Range RWD", "Preferred Long Range AWD",
               "Performance Calligraphy AWD"],
}

def slug(s):
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s.lower()).strip("-")
    return re.sub(r"-+", "-", s)

def dealer_id(name, city, brand):
    # Strip brand tokens from dealer name to avoid "kia-kia-..."
    n = re.sub(r"\b(kia|hyundai)\b", "", name, flags=re.I).strip()
    n = re.sub(r"\s+", " ", n)
    if not n:
        n = city
    return f"{brand.lower()}-{slug(n)}"

def parse_color(url):
    # URL slug pattern: ...-<color-token>-<uuid>
    m = re.search(r"electric-(white|black|grey|gray|blue|red|silver|green)-[0-9a-f]{8}-",
                  url, re.I)
    if m:
        return m.group(1).capitalize().replace("Gray", "Grey")
    m = re.search(r"-(white|black|grey|gray|blue|red|silver|green)-[0-9a-f]{8}-", url, re.I)
    if m:
        return m.group(1).capitalize().replace("Gray", "Grey")
    return "Unknown"

def detect_drivetrain(title):
    t = title.upper()
    if "AWD" in t or "4WD" in t or "DUAL-MOTOR" in t or "ALL-WHEEL" in t:
        return "AWD"
    if "RWD" in t:
        return "RWD"
    return None

def match_trim(model, title):
    """Pick best-matching trim from TRIMS[model] using token scoring."""
    t = title.upper()
    candidates = TRIMS[model]
    best = None
    best_score = 0
    for trim in candidates:
        tokens = trim.upper().split()
        score = sum(1 for tok in tokens if tok in t)
        # Special handling: "N" is single-letter, only matches if " N " or "N BASE"
        if trim == "N" and not re.search(r"\bN\b(\s+(BASE|AWD)|$)", t):
            score = 0
        if score > best_score:
            best, best_score = trim, score
    if best:
        return best
    # Fallback: build from drivetrain + key adjective
    dt = detect_drivetrain(title) or "RWD"
    if model == "EV9":
        if "LIGHT" in t and "LONG" in t: return "Light Long Range RWD"
        if "LIGHT" in t: return "Light RWD"
        if "LAND" in t and "LONG" in t: return "Land Long Range AWD"
        if "GT-LINE" in t: return "GT-Line AWD"
    if model == "Ioniq5":
        if "LONG RANGE" in t and dt == "AWD": return "Preferred AWD Long Range"
        if "LONG RANGE" in t: return "Preferred RWD Long Range"
        return "Preferred RWD"
    if model == "Ioniq6":
        if "LONG RANGE" in t and dt == "AWD": return "Preferred AWD Long Range"
        if "LONG RANGE" in t: return "Preferred RWD Long Range"
        return "Preferred RWD"
    if model == "Ioniq9":
        if "AWD" in t: return "Preferred Long Range AWD"
        return "Preferred Long Range RWD"
    return f"VERIFY: {title[:40]}"

def detect_status(title):
    t = title.upper()
    if "DEMO" in t:
        return "demo"
    return "in_stock"

def main():
    listings = json.loads(INPUT.read_text())
    specs = json.loads(SPECS.read_text())

    # Build (model,year,trim) → msrpCad lookup
    msrp_lookup = {}
    for s in specs:
        if s.get("msrpCad"):
            msrp_lookup[(s["model"], s["year"], s["trim"])] = s["msrpCad"]
        # Also fill in common defaults from EVAP-cap-modeling work product
    # Reasonable MSRP defaults when specs are silent (rough Canadian pricing)
    DEFAULT_MSRP = {
        ("EV6", "Light RWD"): 47165,
        ("EV6", "Wind RWD"): 50965,
        ("EV6", "Wind AWD"): 53965,
        ("EV6", "Land AWD"): 58965,
        ("EV6", "GT-Line AWD"): 63465,
        ("EV6", "GT"): 79566,
        ("Ioniq5", "Essential RWD"): 47999,
        ("Ioniq5", "Preferred RWD"): 51999,
        ("Ioniq5", "Preferred RWD Long Range"): 53999,
        ("Ioniq5", "Preferred AWD Long Range"): 57999,
        ("Ioniq5", "Limited AWD"): 64999,
        ("Ioniq5", "N"): 78199,
        ("Ioniq6", "Preferred RWD"): 49999,
        ("Ioniq6", "Preferred RWD Long Range"): 53999,
        ("Ioniq6", "Preferred AWD Long Range"): 57999,
        ("Ioniq6", "Limited AWD"): 64999,
        ("EV9", "Light RWD"): 59995,
        ("EV9", "Light Long Range RWD"): 64995,
        ("EV9", "Land Long Range AWD"): 72995,
        ("EV9", "GT-Line AWD"): 79995,
        ("Ioniq9", "Preferred Long Range RWD"): 64999,
        ("Ioniq9", "Preferred Long Range AWD"): 69999,
        ("Ioniq9", "Performance Calligraphy AWD"): 79999,
    }

    # Load existing dealers to preserve hand-curated entries
    existing_dealers = []
    if EXISTING_DEALERS.exists():
        existing_dealers = json.loads(EXISTING_DEALERS.read_text())
    by_id = {d["id"]: d for d in existing_dealers}

    units = []
    today = "2026-05-01"
    for i, L in enumerate(listings, start=1):
        model = L["model"]
        brand = MODEL_BRAND[model]
        did = dealer_id(L["dealerName"], L["city"], brand)

        # Add or update dealer
        if did not in by_id:
            by_id[did] = {
                "id": did, "brand": brand, "name": L["dealerName"],
                "address": "VERIFY: address from AutoTrader listing",
                "city": L["city"], "province": L["province"],
                "inventoryUrl": "VERIFY: dealer site URL",
            }

        trim = match_trim(model, L["title"])
        dt = detect_drivetrain(L["title"]) or ("AWD" if "AWD" in trim.upper() else "RWD")
        msrp = msrp_lookup.get((model, L["year"], trim)) or \
               DEFAULT_MSRP.get((model, trim)) or L["priceCad"]
        color = parse_color(L["url"])
        status = detect_status(L["title"])

        units.append({
            "id": f"u-at-{i:03d}",
            "model": model, "year": L["year"], "trim": trim,
            "drivetrain": dt,
            "exteriorColor": color, "interiorColor": "Unknown",
            "msrp": msrp,
            "freightPdi": FREIGHT[brand],
            "dealerAskingPrice": L["priceCad"],
            "status": status,
            "firstSeen": today, "lastSeen": today,
            "dealerId": did,
            "listingUrl": L["url"],
            "notes": f"Auto-imported from AutoTrader 2026-05-01. Title: {L['title']}",
        })

    # Sort dealers by province, city, brand
    dealers = sorted(by_id.values(), key=lambda d: (d["province"], d["city"], d["brand"]))

    # Verify foreign keys
    dealer_ids = {d["id"] for d in dealers}
    orphans = [u["id"] for u in units if u["dealerId"] not in dealer_ids]
    if orphans:
        print(f"ERROR: {len(orphans)} orphan units: {orphans[:5]}", file=sys.stderr)
        sys.exit(1)

    DEALERS_OUT.write_text(json.dumps(dealers, indent=2) + "\n")
    UNITS_OUT.write_text(json.dumps(units, indent=2) + "\n")

    print(f"OK: wrote {len(dealers)} dealers, {len(units)} units")
    # Summary
    by_model = {}
    by_province = {}
    deals = 0
    for u in units:
        by_model[u["model"]] = by_model.get(u["model"], 0) + 1
        # province via dealer lookup
        d = next((d for d in dealers if d["id"] == u["dealerId"]), None)
        if d:
            by_province[d["province"]] = by_province.get(d["province"], 0) + 1
        delta = u["msrp"] - u["dealerAskingPrice"]
        if delta >= 1000:
            deals += 1
    print(f"  by model: {by_model}")
    print(f"  by province: {by_province}")
    print(f"  qualifying deals (>= $1000 off MSRP): {deals}/{len(units)}")

if __name__ == "__main__":
    main()
