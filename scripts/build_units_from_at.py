#!/usr/bin/env python3
"""Build dealers.json + units.json from scraped AutoTrader listings.

Input:  /tmp/at_listings.json (array of {model,year,title,priceCad,dealerName,city,province,url})
Output: data/dealers.json, data/units.json (validated against existing schema invariants)

Run:    python3 scripts/build_units_from_at.py
"""
import json, re, sys, os, hashlib
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INPUT = Path("/tmp/at_listings.json")
SPECS = ROOT / "data" / "specs.json"
DEALERS_OUT = ROOT / "data" / "dealers.json"
UNITS_OUT = ROOT / "data" / "units.json"
EXISTING_DEALERS = ROOT / "data" / "dealers.json"
OEM_PRICING = ROOT / "data" / "oem-pricing.json"

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
    """Pick best-matching trim from TRIMS[model].

    Returns (trim, matched_via) where matched_via is:
      "tokens"  → high-confidence: catalog tokens were present in the title.
      "fallback" → low-confidence: scoring failed and we guessed from
                   drivetrain + a few keywords. Caller MUST treat the
                   resulting msrp as suspect (mark msrpSource =
                   "asking-fallback") because the trim itself is a guess.

    BLOCKERS_MEDIUM.md item 3 is the reason the tuple exists: silently
    returning the cheapest trim when scoring fails was the bug that made
    65/97 units look like they were marked up >$5k vs MSRP.
    """
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
        # "Limited AWD" is the Ioniq5 top trim. Some dealers write
        # "Ultimate Package" or "Ultimate" rather than "Limited" on the
        # AutoTrader title — same trim, marketing-pack rename. Promote a
        # match on either token to win the bucket.
        if model == "Ioniq5" and trim == "Limited AWD" and (
            "ULTIMATE" in t or "LIMITED" in t
        ) and ("AWD" in t or "ALL-WHEEL" in t or "ALL WHEEL" in t):
            score = max(score, 3)
        # Ioniq9 hierarchy: "Performance Calligraphy AWD" is the halo trim
        # ($79,999). Some dealer titles drop "Performance" and write only
        # "Calligraphy", or invert the order. Promote a match when either
        # halo token appears alongside AWD.
        if model == "Ioniq9" and trim == "Performance Calligraphy AWD" and (
            "PERFORMANCE" in t or "CALLIGRAPHY" in t
        ):
            score = max(score, 3)
        # EV9 GT-Line: scoring already works ("GT-LINE" is one token), but
        # variants like "GT Line" (no hyphen) miss. Promote.
        if model == "EV9" and trim == "GT-Line AWD" and (
            "GT-LINE" in t or "GT LINE" in t
        ):
            score = max(score, 3)
        if score > best_score:
            best, best_score = trim, score
    if best:
        return (best, "tokens")
    # Fallback: build from drivetrain + key adjective. Mark low-confidence
    # so caller knows MSRP from this trim is unreliable.
    dt = detect_drivetrain(title) or "RWD"
    if model == "EV9":
        if "LIGHT" in t and "LONG" in t: return ("Light Long Range RWD", "fallback")
        if "LIGHT" in t: return ("Light RWD", "fallback")
        if "LAND" in t and "LONG" in t: return ("Land Long Range AWD", "fallback")
        if "GT-LINE" in t or "GT LINE" in t: return ("GT-Line AWD", "fallback")
    if model == "Ioniq5":
        if "LONG RANGE" in t and dt == "AWD": return ("Preferred AWD Long Range", "fallback")
        if "LONG RANGE" in t: return ("Preferred RWD Long Range", "fallback")
        return ("Preferred RWD", "fallback")
    if model == "Ioniq6":
        if "LONG RANGE" in t and dt == "AWD": return ("Preferred AWD Long Range", "fallback")
        if "LONG RANGE" in t: return ("Preferred RWD Long Range", "fallback")
        return ("Preferred RWD", "fallback")
    if model == "Ioniq9":
        if "AWD" in t: return ("Preferred Long Range AWD", "fallback")
        return ("Preferred Long Range RWD", "fallback")
    # Last-resort: no model-specific fallback rule fired. Surface a clean
    # human-readable string ("Trim unknown — <truncated title>") rather
    # than a "VERIFY:" sentinel so the InventoryTable column renders
    # gracefully. The MSRP-unverified chip from msrpSource carries the
    # data-quality signal — this string is just for human eyes.
    return (f"Trim unknown ({title[:40]})", "fallback")

def detect_status(title):
    t = title.upper()
    if "DEMO" in t:
        return "demo"
    return "in_stock"

def main():
    listings = json.loads(INPUT.read_text())
    specs = json.loads(SPECS.read_text())

    # Build (model,year,trim) → msrpCad lookup. Also build a year-relaxed
    # version keyed by (model, trim) only — when a unit's model-year has no
    # spec entry (e.g. MY2026 EV9 not yet in specs.json), we'd rather use
    # the closest year's MSRP than fall through to DEFAULT_MSRP. Picks the
    # newest spec year when multiple are available for the same trim.
    # Fixes BLOCKERS_MEDIUM.md item 3 partially — 14 MY2026 EV9 units fall
    # through to DEFAULT_MSRP today; with year-relax they hit specs.
    msrp_lookup = {}
    msrp_lookup_loose = {}      # (model, trim) → (year, msrp) — newest year wins
    for s in specs:
        if s.get("msrpCad"):
            msrp_lookup[(s["model"], s["year"], s["trim"])] = s["msrpCad"]
            key = (s["model"], s["trim"])
            cur = msrp_lookup_loose.get(key)
            if cur is None or s["year"] > cur[0]:
                msrp_lookup_loose[key] = (s["year"], s["msrpCad"])
        # Also fill in common defaults from EVAP-cap-modeling work product
    # Reasonable MSRP defaults when specs are silent. Sourced from
    # data/oem-pricing.json so Phase 3.2 (OEM configurator refresh) can
    # update pricing without touching this script.
    oem = json.loads(OEM_PRICING.read_text())
    DEFAULT_MSRP = {
        (model, trim): entry["value"]
        for model, trims in oem["msrp"].items()
        for trim, entry in trims.items()
    }

    # Load existing dealers to preserve hand-curated entries
    existing_dealers = []
    if EXISTING_DEALERS.exists():
        existing_dealers = json.loads(EXISTING_DEALERS.read_text())
    by_id = {d["id"]: d for d in existing_dealers}

    # Preserve firstSeen across re-runs by indexing the previous units.json
    # on listingUrl. Without this, every rebuild resets firstSeen to today,
    # which silently kills the "newest listing" / "longest on lot" sorts.
    # Stable IDs (below) make this map durable.
    prev_first_seen: dict[str, str] = {}
    prev_id_by_url: dict[str, str] = {}
    if UNITS_OUT.exists():
        try:
            for u in json.loads(UNITS_OUT.read_text()):
                url = u.get("listingUrl")
                if url:
                    prev_first_seen[url] = u.get("firstSeen") or u.get("lastSeen")
                    prev_id_by_url[url] = u["id"]
        except (json.JSONDecodeError, KeyError):
            pass  # corrupted file → start fresh

    units = []
    today = date.today().isoformat()
    seen_ids: set[str] = set()
    for L in listings:
        model = L["model"]
        brand = MODEL_BRAND[model]
        did = dealer_id(L["dealerName"], L["city"], brand)

        # Add or update dealer
        if did not in by_id:
            by_id[did] = {
                "id": did, "brand": brand, "name": L["dealerName"],
                # Real address requires per-dealer detail-page fetch; leave a
                # human-readable placeholder rather than a fake VERIFY string
                # that fails url() validation.
                "address": "Address not yet captured",
                "city": L["city"], "province": L["province"],
                # Omit inventoryUrl entirely — schema marks it optional and
                # rendering layers prefer absent over placeholder.
            }

        trim, matched_via = match_trim(model, L["title"])
        dt = detect_drivetrain(L["title"]) or ("AWD" if "AWD" in trim.upper() else "RWD")

        # 3-branch MSRP decision with provenance tracking. The tag drives
        # the InventoryTable confidence chip and the home-page Top Deals
        # filter (asking-fallback rows are excluded from "best deals").
        if matched_via == "fallback":
            # Trim itself is a guess → any MSRP we'd attach is unreliable.
            # Use asking price so the row's discount math reads as $0 off.
            msrp = L["priceCad"]
            msrp_source = "asking-fallback"
        elif (model, L["year"], trim) in msrp_lookup:
            msrp = msrp_lookup[(model, L["year"], trim)]
            msrp_source = "spec-lookup"
        elif (model, trim) in msrp_lookup_loose:
            # Year-relaxed spec hit. Still authoritative; just from an
            # adjacent MY (e.g. MY2025 spec applied to MY2026 unit until
            # specs.json is updated for the new MY).
            msrp = msrp_lookup_loose[(model, trim)][1]
            msrp_source = "spec-lookup"
        elif (model, trim) in DEFAULT_MSRP:
            msrp = DEFAULT_MSRP[(model, trim)]
            msrp_source = "default-table"
        else:
            msrp = L["priceCad"]
            msrp_source = "asking-fallback"

        color = parse_color(L["url"])
        status = detect_status(L["title"])

        # Stable ID: 8-char hash of the listing URL. Survives result-order
        # changes between scrapes, lets snapshot diffs and enrichment
        # overlays survive re-runs. Collisions across 8 hex chars at our
        # scale (~100 units) are negligible; verify uniqueness explicitly.
        uid = f"u-at-{hashlib.sha1(L['url'].encode()).hexdigest()[:8]}"
        if uid in seen_ids:
            # SHA1 collision or duplicate listing — append URL hash second
            # half to disambiguate. Real fix is dedup the input listings.
            uid = f"u-at-{hashlib.sha1(L['url'].encode()).hexdigest()[:12]}"
        seen_ids.add(uid)

        first_seen = prev_first_seen.get(L["url"], today)

        units.append({
            "id": uid,
            "model": model, "year": L["year"], "trim": trim,
            "drivetrain": dt,
            "exteriorColor": color, "interiorColor": "Unknown",
            "msrp": msrp,
            "msrpSource": msrp_source,
            "freightPdi": FREIGHT[brand],
            "dealerAskingPrice": L["priceCad"],
            "status": status,
            "firstSeen": first_seen, "lastSeen": today,
            "dealerId": did,
            "listingUrl": L["url"],
            "notes": f"Auto-imported from AutoTrader {today}. Title: {L['title']}",
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

    # Re-key units-enrichment.json from old positional IDs → new stable
    # hash IDs. Maps via listingUrl since that's the only durable identity
    # across the schema migration. Run once after the first stable-ID
    # build; idempotent on subsequent builds (entries already keyed by
    # stable IDs flow through unchanged).
    enrichment_path = ROOT / "data" / "units-enrichment.json"
    if enrichment_path.exists():
        new_id_by_url = {u["listingUrl"]: u["id"] for u in units if u.get("listingUrl")}
        url_by_old_id = {old_id: url for url, old_id in prev_id_by_url.items()}
        try:
            enrichment = json.loads(enrichment_path.read_text())
        except json.JSONDecodeError:
            enrichment = {}
        rekeyed = {}
        dropped = 0
        for old_id, payload in enrichment.items():
            # Already a new-style stable ID? Pass through.
            if old_id in {u["id"] for u in units}:
                rekeyed[old_id] = payload
                continue
            url = url_by_old_id.get(old_id)
            new_id = new_id_by_url.get(url) if url else None
            if new_id:
                rekeyed[new_id] = payload
            else:
                dropped += 1
        if rekeyed != enrichment:
            enrichment_path.write_text(json.dumps(rekeyed, indent=2) + "\n")
            print(f"  enrichment re-keyed: {len(rekeyed)} kept, {dropped} dropped (no listingUrl match)")

    print(f"OK: wrote {len(dealers)} dealers, {len(units)} units")
    # Summary
    by_model = {}
    by_province = {}
    by_msrp_source = {}
    deals = 0
    for u in units:
        by_model[u["model"]] = by_model.get(u["model"], 0) + 1
        by_msrp_source[u["msrpSource"]] = by_msrp_source.get(u["msrpSource"], 0) + 1
        # province via dealer lookup
        d = next((d for d in dealers if d["id"] == u["dealerId"]), None)
        if d:
            by_province[d["province"]] = by_province.get(d["province"], 0) + 1
        delta = u["msrp"] - u["dealerAskingPrice"]
        if delta >= 1000 and u["msrpSource"] != "asking-fallback":
            deals += 1
    print(f"  by model: {by_model}")
    print(f"  by province: {by_province}")
    print(f"  by msrpSource: {by_msrp_source}")
    print(f"  qualifying deals (>= $1000 off MSRP, excl asking-fallback): {deals}/{len(units)}")

if __name__ == "__main__":
    main()
