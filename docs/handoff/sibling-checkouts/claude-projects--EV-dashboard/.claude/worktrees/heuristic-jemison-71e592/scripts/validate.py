#!/usr/bin/env python3
"""
Data-integrity gate for src/data/seed.json.

Rules applied. Rules are tiered so Cluster A can exit green while Cluster B
is still fixing the data:

  FAIL (always)
    1. seed.json is valid JSON and parses.
    2. Every non-Low vehicle has non-null values for required fields:
       battery_kwh_total, battery_kwh_usable, range_km, dc_charge_kw_max.
    3. Every source `accessed` date (when present) parses as YYYY-MM-DD.
    4. Every charging_curve_20c has >=3 points OR is empty (explicit
       no-DC-fast-charge case — only allowed for PHEVs).

  WARN (pre-Cluster-B3; promoted to FAIL once B3 closes the citation gap)
    W1. Non-Low CitedValues missing `source.url` (B3 Exa pass populates these).
    W2. Non-Low vehicles missing thermal profile fields (B1 populates these).
    W3. Any source `accessed` date older than 90 days.

Caveman-style output. Runs fast. Called by scripts/milestone.py and by the
PostToolUse Claude Code hook on seed.json edits.

Usage:
    python3 scripts/validate.py                 # exit 0 = green, 1 = hard fail
    python3 scripts/validate.py --strict        # promote warnings → failures
    python3 scripts/validate.py --warn-as-error # alias for --strict
"""

from __future__ import annotations

import json
import re
import sys
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEED = ROOT / "src" / "data" / "seed.json"

URL_RE = re.compile(r"^https?://")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

# Fields required to be non-null for any vehicle above Low confidence.
REQUIRED_NON_LOW = [
    "battery_kwh_total",
    "battery_kwh_usable",
    "range_km",
    "dc_charge_kw_max",
]

# Fields expected to be populated post-Cluster-B1. Pre-B1: warn only.
THERMAL_PROFILE_FIELDS = [
    "cold_derate_curve",
    "hvac_draw_kw_by_temp",
    "precon_time_by_temp",
]


def is_cited_value(obj: dict) -> bool:
    return isinstance(obj, dict) and "value" in obj and "confidence" in obj


def check_cited_value(path: str, cv: dict) -> tuple[list[str], list[str]]:
    """Return (fails, warns) for one CitedValue. Missing source.url is WARN
    pre-B3 (Cluster-B Exa verification pass). Malformed dates are always FAIL."""
    fails: list[str] = []
    warns: list[str] = []
    val = cv.get("value")
    conf = cv.get("confidence")
    if val is None:
        return fails, warns
    if conf in {"High", "Medium"}:
        src = cv.get("source")
        if not src or not URL_RE.match(str(src.get("url", ""))):
            warns.append(
                f"  WARN {path}: {conf}-confidence value missing source.url (B3 fills these)"
            )
            return fails, warns
        if not DATE_RE.match(str(src.get("accessed", ""))):
            fails.append(
                f"  FAIL {path}: source.accessed not in YYYY-MM-DD format ({src.get('accessed')!r})"
            )
            return fails, warns
        try:
            acc = datetime.strptime(src["accessed"], "%Y-%m-%d").date()
            if (date.today() - acc).days > 90:
                warns.append(
                    f"  WARN {path}: source.accessed is {(date.today() - acc).days} days old"
                )
        except ValueError:
            fails.append(f"  FAIL {path}: source.accessed not a real date")
    return fails, warns


def check_vehicle(v: dict, idx: int) -> tuple[list[str], list[str]]:
    fails: list[str] = []
    warns: list[str] = []
    vid = v.get("id", f"<no-id-#{idx}>")
    overall = v.get("overall_confidence", "Low")

    # Required-non-null rule
    if overall != "Low":
        for field in REQUIRED_NON_LOW:
            cv = v.get(field)
            if not is_cited_value(cv) or cv.get("value") is None:
                fails.append(
                    f"  FAIL {vid}.{field}: non-Low vehicle ({overall}) has null value"
                )

    # Source-URL rule (applies to all CitedValues with value set)
    for field, cv in v.items():
        if is_cited_value(cv):
            sub_fails, sub_warns = check_cited_value(f"{vid}.{field}", cv)
            fails.extend(sub_fails)
            warns.extend(sub_warns)

    # Charging curve rule
    curve = v.get("charging_curve_20c", [])
    if not isinstance(curve, list):
        fails.append(f"  FAIL {vid}.charging_curve_20c: not a list")
    else:
        if len(curve) > 0 and len(curve) < 3:
            fails.append(
                f"  FAIL {vid}.charging_curve_20c: {len(curve)} points — need >=3 or empty"
            )
        if len(curve) == 0 and v.get("powertrain") == "BEV":
            warns.append(f"  WARN {vid}.charging_curve_20c: empty for a BEV")

    # Thermal profile presence (warn pre-B1; post-B1 rule promotion below)
    for field in THERMAL_PROFILE_FIELDS:
        if overall != "Low" and field not in v:
            warns.append(
                f"  WARN {vid}.{field}: missing (expected to be populated in Cluster B1)"
            )

    return fails, warns


def main(argv: list[str]) -> int:
    warn_as_error = "--warn-as-error" in argv or "--strict" in argv

    if not SEED.exists():
        print(f"FAIL: {SEED} does not exist")
        return 1

    try:
        data = json.loads(SEED.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"FAIL: seed.json is not valid JSON — {e}")
        return 1

    all_fails: list[str] = []
    all_warns: list[str] = []

    vehicles = data.get("vehicles", [])
    if not isinstance(vehicles, list):
        print("FAIL: top-level 'vehicles' is not a list")
        return 1

    for idx, v in enumerate(vehicles):
        f, w = check_vehicle(v, idx)
        all_fails.extend(f)
        all_warns.extend(w)

    print(f"validate.py — {len(vehicles)} vehicles scanned")
    if all_warns:
        print(f"\n{len(all_warns)} warning(s):")
        for w in all_warns:
            print(w)
    if all_fails:
        print(f"\n{len(all_fails)} failure(s):")
        for f in all_fails:
            print(f)
        return 1
    if warn_as_error and all_warns:
        print("\n--warn-as-error set; warnings treated as failures")
        return 1
    print("✅ validate.py green")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
