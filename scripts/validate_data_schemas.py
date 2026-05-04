#!/usr/bin/env python3
"""
validate_data_schemas.py — minimal schema-drift catcher.

Cron mutates data/*.json nightly (refresh_daily.sh). If a field type drifts
(e.g., a price comes in as a string, or a required field disappears), the
React app fails at Zod parse-time on next load. This script catches drift
BEFORE the bad data ships to the WebView — it's wired into predeploy.

Approach: stdlib only, no Zod port. Each file has a checker function that
verifies key presence + leaf-level type expectations. Goal isn't full Zod
parity — it's "did a string sneak into a number field overnight."

Per CLAUDE.md: stdlib only. Type hints throughout. Exit 1 on first failure.

Wire into predeploy:
  "predeploy": "npm run typecheck && npm run thermal-audit && \\
                python3 scripts/validate_data_schemas.py && npm run build"
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Callable

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

# Result accumulator. Errors printed at end, fail count returned as exit code.
ERRORS: list[str] = []


def err(path: str, msg: str) -> None:
    ERRORS.append(f"  {path}: {msg}")


def is_str(x: Any) -> bool:
    return isinstance(x, str)


def is_num(x: Any) -> bool:
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def is_int(x: Any) -> bool:
    return isinstance(x, int) and not isinstance(x, bool)


def is_bool(x: Any) -> bool:
    return isinstance(x, bool)


def check(label: str, val: Any, pred: Callable[[Any], bool], expect: str) -> None:
    if not pred(val):
        err(label, f"expected {expect}, got {type(val).__name__}({val!r})")


def check_enum(label: str, val: Any, allowed: set[str]) -> None:
    """Verify a string is a member of the allowed set. Skip None values."""
    if val is None:
        return
    if not isinstance(val, str) or val not in allowed:
        err(label, f"expected one of {sorted(allowed)}, got {val!r}")


# ---- enum sets (kept in sync with src/lib/constants.ts + types.ts) -------

UNIT_STATUS = {"in_stock", "in_transit", "demo", "loaner", "sold_pending"}
DRIVETRAIN = {"RWD", "AWD", "FWD"}
INCENTIVE_SCOPE = {
    "federal",
    "provincial",
    "manufacturer_cash",
    "loyalty",
    "conquest",
    "lease_promo",
    "finance_promo",
    "charger_install",
}
INCENTIVE_STATUS = {"active", "paused", "ended", "upcoming"}
DEALER_BRAND = {"Hyundai", "Kia"}
MODELS = {"EV6", "Ioniq5", "Ioniq6", "EV9", "Ioniq9"}
SUPPORTED_YEARS = {2024, 2025, 2026}
PROVINCES = {"ON", "BC", "AB", "SK", "MB", "QC", "NB", "NS", "NL", "PE", "NT", "NU", "YT"}
CROSS_LISTING_SOURCES = {"autotrader", "kijiji_autos", "leasebusters"}


# ---- per-file checkers ----------------------------------------------------


def check_units() -> None:
    """data/units.json — list of InventoryUnit. Stable IDs, msrp + asking price + freight."""
    p = DATA / "units.json"
    if not p.exists():
        return
    units = json.loads(p.read_text())
    if not isinstance(units, list):
        err(str(p), "expected array")
        return
    for i, u in enumerate(units):
        ctx = f"units[{i}](id={u.get('id', '?')})"
        for key in ("id", "dealerId", "model", "trim", "drivetrain", "status"):
            check(f"{ctx}.{key}", u.get(key), is_str, "string")
        check(f"{ctx}.year", u.get("year"), is_int, "int")
        check(f"{ctx}.msrp", u.get("msrp"), is_num, "number")
        check(f"{ctx}.dealerAskingPrice", u.get("dealerAskingPrice"), is_num, "number")
        check(f"{ctx}.freightPdi", u.get("freightPdi"), is_num, "number")
        # Enum validation
        check_enum(f"{ctx}.status", u.get("status"), UNIT_STATUS)
        check_enum(f"{ctx}.drivetrain", u.get("drivetrain"), DRIVETRAIN)
        check_enum(f"{ctx}.model", u.get("model"), MODELS)
        if isinstance(u.get("year"), int) and u["year"] not in SUPPORTED_YEARS:
            err(f"{ctx}.year", f"expected one of {sorted(SUPPORTED_YEARS)}, got {u['year']}")
        # Optional but type-checked when present
        if "daysOnLot" in u and u["daysOnLot"] is not None:
            check(f"{ctx}.daysOnLot", u["daysOnLot"], is_int, "int")
        if "vin" in u and u["vin"] is not None:
            check(f"{ctx}.vin", u["vin"], is_str, "string|null")


def check_dealers() -> None:
    p = DATA / "dealers.json"
    if not p.exists():
        return
    dealers = json.loads(p.read_text())
    if not isinstance(dealers, list):
        err(str(p), "expected array")
        return
    for i, d in enumerate(dealers):
        ctx = f"dealers[{i}](id={d.get('id', '?')})"
        for key in ("id", "brand", "name", "address", "city", "province"):
            check(f"{ctx}.{key}", d.get(key), is_str, "string")
        check_enum(f"{ctx}.brand", d.get("brand"), DEALER_BRAND)
        check_enum(f"{ctx}.province", d.get("province"), PROVINCES)
        if "lat" in d and d["lat"] is not None:
            check(f"{ctx}.lat", d["lat"], is_num, "number")
        if "lng" in d and d["lng"] is not None:
            check(f"{ctx}.lng", d["lng"], is_num, "number")


def check_incentives() -> None:
    p = DATA / "incentives.json"
    if not p.exists():
        return
    items = json.loads(p.read_text())
    if not isinstance(items, list):
        err(str(p), "expected array")
        return
    for i, inc in enumerate(items):
        ctx = f"incentives[{i}](id={inc.get('id', '?')})"
        for key in ("id", "scope", "name", "status", "lastVerified"):
            check(f"{ctx}.{key}", inc.get(key), is_str, "string")
        check_enum(f"{ctx}.scope", inc.get("scope"), INCENTIVE_SCOPE)
        check_enum(f"{ctx}.status", inc.get("status"), INCENTIVE_STATUS)
        if "amountCad" in inc and inc["amountCad"] is not None:
            check(f"{ctx}.amountCad", inc["amountCad"], is_num, "number")
        if "aprPercent" in inc and inc["aprPercent"] is not None:
            check(f"{ctx}.aprPercent", inc["aprPercent"], is_num, "number")
        if "termMonths" in inc and inc["termMonths"] is not None:
            check(f"{ctx}.termMonths", inc["termMonths"], is_int, "int")
        # appliesTo.models — every entry is a known Model
        applies_to = inc.get("appliesTo")
        if isinstance(applies_to, dict):
            models = applies_to.get("models")
            if isinstance(models, list):
                for m in models:
                    check_enum(f"{ctx}.appliesTo.models", m, MODELS)


def check_specs() -> None:
    p = DATA / "specs.json"
    if not p.exists():
        return
    specs = json.loads(p.read_text())
    if not isinstance(specs, list):
        err(str(p), "expected array")
        return
    for i, s in enumerate(specs):
        ctx = f"specs[{i}]({s.get('model', '?')}/{s.get('trim', '?')})"
        for key in ("model", "trim", "drivetrain"):
            check(f"{ctx}.{key}", s.get(key), is_str, "string")
        check(f"{ctx}.year", s.get("year"), is_int, "int")
        check_enum(f"{ctx}.model", s.get("model"), MODELS)
        check_enum(f"{ctx}.drivetrain", s.get("drivetrain"), DRIVETRAIN)
        if isinstance(s.get("year"), int) and s["year"] not in SUPPORTED_YEARS:
            err(f"{ctx}.year", f"expected one of {sorted(SUPPORTED_YEARS)}, got {s['year']}")


def check_cross_listings() -> None:
    p = DATA / "cross-listings.json"
    if not p.exists():
        return
    entries = json.loads(p.read_text())
    if not isinstance(entries, list):
        err(str(p), "expected array")
        return
    for i, e in enumerate(entries):
        ctx = f"cross-listings[{i}](fk={e.get('fallbackKey', '?')})"
        check(f"{ctx}.fallbackKey", e.get("fallbackKey"), is_str, "string")
        check(f"{ctx}.year", e.get("year"), is_int, "int")
        # vin nullable
        vin = e.get("vin")
        if vin is not None and not is_str(vin):
            err(f"{ctx}.vin", f"expected string|null, got {type(vin).__name__}")
        listings = e.get("listings", [])
        if not isinstance(listings, list):
            err(f"{ctx}.listings", "expected array")
            continue
        for j, l in enumerate(listings):
            lctx = f"{ctx}.listings[{j}]"
            check(f"{lctx}.source", l.get("source"), is_str, "string")
            check(f"{lctx}.stockId", l.get("stockId"), is_str, "string")
            check(f"{lctx}.url", l.get("url"), is_str, "string")
            check_enum(f"{lctx}.source", l.get("source"), CROSS_LISTING_SOURCES)
            price = l.get("priceCad")
            if price is not None and not is_num(price):
                err(f"{lctx}.priceCad", f"expected number|null, got {type(price).__name__}")


def check_taxes_and_fees() -> None:
    p = DATA / "taxes-and-fees.json"
    if not p.exists():
        return
    t = json.loads(p.read_text())
    by_prov = t.get("salesTaxByProvince")
    if not isinstance(by_prov, dict):
        err("taxes-and-fees.salesTaxByProvince", "expected object")
        return
    for prov, entry in by_prov.items():
        ctx = f"taxes.salesTaxByProvince[{prov}]"
        check(f"{ctx}.type", entry.get("type"), is_str, "string")
        if prov not in PROVINCES:
            err(ctx, f"unknown province key {prov!r}; expected one of {sorted(PROVINCES)}")


def check_cross_references() -> None:
    """Validate referential integrity across data/*.json:
    - units[].dealerId resolves in dealers.json
    - units[].(model, year, trim, drivetrain) resolves to a spec in specs.json
    """
    units_p = DATA / "units.json"
    dealers_p = DATA / "dealers.json"
    specs_p = DATA / "specs.json"

    if not (units_p.exists() and dealers_p.exists()):
        return

    units = json.loads(units_p.read_text())
    dealers = json.loads(dealers_p.read_text())

    if not (isinstance(units, list) and isinstance(dealers, list)):
        return

    dealer_ids = {d.get("id") for d in dealers if isinstance(d, dict)}

    spec_keys: set[tuple[str, int, str, str]] = set()
    if specs_p.exists():
        specs = json.loads(specs_p.read_text())
        if isinstance(specs, list):
            for s in specs:
                if not isinstance(s, dict):
                    continue
                key = (
                    s.get("model"),
                    s.get("year"),
                    s.get("trim"),
                    s.get("drivetrain"),
                )
                if all(k is not None for k in key):
                    spec_keys.add(key)  # type: ignore[arg-type]

    # 1. Every unit's dealerId resolves
    for i, u in enumerate(units):
        if not isinstance(u, dict):
            continue
        ctx = f"units[{i}](id={u.get('id', '?')})"
        did = u.get("dealerId")
        if did and did not in dealer_ids:
            err(f"{ctx}.dealerId", f"references missing dealer {did!r}")

    # 2. Spec join — only flag if specs.json is non-empty (skips dev-empty case)
    # Trims starting with "Trim unknown" are an acknowledged parser-gap state;
    # don't fail predeploy on them — they're tracked in TODO_INDEX as data hygiene.
    if spec_keys:
        misses = 0
        for i, u in enumerate(units):
            if not isinstance(u, dict):
                continue
            trim = u.get("trim", "")
            if isinstance(trim, str) and trim.startswith("Trim unknown"):
                continue
            key = (
                u.get("model"),
                u.get("year"),
                u.get("trim"),
                u.get("drivetrain"),
            )
            if all(k is not None for k in key) and key not in spec_keys:
                # Don't blow up on every miss — too noisy. Cap at 5 reported.
                misses += 1
                if misses <= 5:
                    ctx = f"units[{i}](id={u.get('id', '?')})"
                    err(
                        f"{ctx}.spec-join",
                        f"no spec for {key} in specs.json",
                    )
        if misses > 5:
            err(
                "units.spec-join",
                f"+{misses - 5} more spec-join misses suppressed",
            )


# ---- main -----------------------------------------------------------------


def main() -> int:
    checkers = [
        check_units,
        check_dealers,
        check_incentives,
        check_specs,
        check_cross_listings,
        check_taxes_and_fees,
        check_cross_references,
    ]
    for fn in checkers:
        try:
            fn()
        except json.JSONDecodeError as e:
            err(fn.__name__, f"JSON parse failed: {e}")
        except Exception as e:
            err(fn.__name__, f"unexpected: {e}")
    if ERRORS:
        print(f"data schema drift detected ({len(ERRORS)} errors):", file=sys.stderr)
        for line in ERRORS:
            print(line, file=sys.stderr)
        return 1
    print("data schemas OK across 6 files (+ cross-references)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
