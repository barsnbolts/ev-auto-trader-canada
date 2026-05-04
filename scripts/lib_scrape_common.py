"""Shared helpers for cross-source scrapers.

Used by:
  - scripts/scrape_kijiji.py (SHIPPED 2026-05-04)
  - scripts/scrape_leasebusters.py (TODO — Chrome MCP probe pending)
  - scripts/scrape_facebook.py (SKELETON — login-walled, future Stream)
  - scripts/scrape_unit_gallery.py (uses fetch + province_from_address)

Design philosophy: source-agnostic primitives (HTTP fetch, VIN check-digit,
province extract, JSON walk helpers) live here. Source-specific schema
parsing lives in the per-source scripts. Output schema is fixed by
data/cross-listings.json (VIN-keyed primary, fallbackKey secondary).
"""
from __future__ import annotations

import json
import re
import subprocess
import urllib.request
from datetime import datetime, timezone
from typing import Any, Iterable

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/17.5 Safari/605.1.15"
)

# Strict 17-char VIN. Excludes I, O, Q (not valid VIN chars).
VIN_RE = re.compile(r"\b[A-HJ-NPR-Z0-9]{17}\b")
PROVINCE_RE = re.compile(r",\s*([A-Z]{2})\s*,")
PROVINCE_SET = {"AB", "BC", "MB", "NB", "NL", "NS", "ON", "PE", "QC", "SK", "YT", "NT", "NU"}

# Pre-built __NEXT_DATA__ extractor (Next.js / SSR-friendly source)
NEXT_DATA_RE = re.compile(
    r'<script\s+id="__NEXT_DATA__"\s+type="application/json"[^>]*>(.*?)</script>',
    re.DOTALL,
)

# VIN check-digit weights (positions 1-17, 1-indexed). Position 9 is the
# check digit itself.
_VIN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2]
_VIN_TRANSLITERATION = {
    "A": 1, "B": 2, "C": 3, "D": 4, "E": 5, "F": 6, "G": 7, "H": 8,
    "J": 1, "K": 2, "L": 3, "M": 4, "N": 5, "P": 7, "R": 9,
    "S": 2, "T": 3, "U": 4, "V": 5, "W": 6, "X": 7, "Y": 8, "Z": 9,
    "0": 0, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
}


def is_valid_vin(vin: str) -> bool:
    """Strict format check (17 chars, exclude I/O/Q)."""
    return bool(vin) and bool(VIN_RE.fullmatch(vin))


def vin_check_digit_ok(vin: str) -> bool:
    """ISO 3779 check-digit validation. Position 9 must equal weighted
    sum mod 11 (0-9 or 'X' for 10) of the other 16 chars.

    Returns False on any non-VIN char or wrong check digit. Valid for
    all post-1981 NA-market VINs (which is every car we'd see).
    """
    if not is_valid_vin(vin):
        return False
    total = 0
    for i, ch in enumerate(vin):
        val = _VIN_TRANSLITERATION.get(ch)
        if val is None:
            return False
        total += val * _VIN_WEIGHTS[i]
    remainder = total % 11
    expected = "X" if remainder == 10 else str(remainder)
    return vin[8] == expected


def vins_in_text(text: str, validate: bool = True) -> list[str]:
    """Find all 17-char VIN-shaped tokens in a free-text blob.

    Useful for Facebook Marketplace / forum scrapes where the VIN is
    embedded in the description rather than a structured field.

    Args:
      text: free-text body (title + description recommended).
      validate: if True, pass each candidate through vin_check_digit_ok
                (eliminates false positives like license plates that
                happen to be 17 alphanumeric chars). Default True.

    Returns deduped list, preserving first-seen order.
    """
    seen: set[str] = set()
    out: list[str] = []
    for m in VIN_RE.finditer(text or ""):
        candidate = m.group(0).upper()
        if candidate in seen:
            continue
        if validate and not vin_check_digit_ok(candidate):
            continue
        seen.add(candidate)
        out.append(candidate)
    return out


def fetch_html(url: str, timeout: int = 30, http2: bool = True) -> str:
    """curl-backed fetch returning HTML body, '' on any failure.

    Why curl + subprocess instead of urllib: many target sites
    fingerprint HTTP/1.1 + plain Python clients (Imperva, Cloudflare).
    curl --http2 with browser UA looks like a real browser to most
    bot walls.
    """
    cmd = [
        "curl", "-sS", "-L", "--max-time", str(timeout),
    ]
    if http2:
        cmd.append("--http2")
    cmd += [
        "-A", USER_AGENT,
        "-H", "Accept: text/html,*/*;q=0.8",
        "-H", "Accept-Language: en-CA,en-US;q=0.9",
        "-H", "Accept-Encoding: gzip, deflate, br",
        "--compressed",
        url,
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, timeout=timeout + 5, text=False)
        if proc.returncode != 0:
            return ""
        return proc.stdout.decode("utf-8", errors="replace")
    except Exception:
        return ""


def extract_next_data(html: str) -> dict | None:
    """Extract Next.js __NEXT_DATA__ JSON blob from HTML, return parsed
    dict (or None if not found / unparseable). Common pattern across
    Kijiji, AutoTrader, and many modern dealer sites."""
    m = NEXT_DATA_RE.search(html)
    if not m:
        return None
    try:
        return json.loads(m.group(1))
    except json.JSONDecodeError:
        return None


def apollo_entities(next_data: dict, type_prefix: str) -> Iterable[tuple[str, dict]]:
    """Yield (key, entity) pairs from __APOLLO_STATE__ where key starts
    with `type_prefix:`. Use when the source page is Apollo-Client based.

    type_prefix examples: 'AutosListing' (Kijiji), 'Listing' (generic).
    """
    apollo = (
        next_data.get("props", {}).get("pageProps", {}).get("__APOLLO_STATE__")
    )
    if not isinstance(apollo, dict):
        return
    pref = type_prefix + ":"
    for key, val in apollo.items():
        if isinstance(key, str) and key.startswith(pref) and isinstance(val, dict):
            yield key, val


def safe_int(v: Any) -> int | None:
    if v is None:
        return None
    try:
        return int(str(v).replace(",", "").split(".")[0])
    except (TypeError, ValueError):
        return None


def province_from_address(addr: Any) -> str | None:
    """Extract 2-letter Canadian province code from a free-text address."""
    if not isinstance(addr, str):
        return None
    m = PROVINCE_RE.search(addr)
    if m and m.group(1) in PROVINCE_SET:
        return m.group(1)
    return None


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


# Optional: NHTSA vPIC VIN decoder. Free, no auth, USA federal API.
# Use sparingly — 1 call per VIN we want to verify. Throttle 200ms.
NHTSA_DECODE_URL = (
    "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/{vin}?format=json"
)


def nhtsa_decode(vin: str, timeout: int = 8) -> dict | None:
    """Decode a VIN via NHTSA vPIC. Returns the 'Results' dict (single
    entry) on success, None on any failure.

    Useful when a source (e.g. Facebook Marketplace) has VIN in
    free-text but no structured make/model/year. NHTSA validates the
    VIN AND returns canonical make/model/year/trim — gold-standard
    cross-source validation.

    Note: NHTSA can be slow + occasionally rate-limits. Don't call in
    a tight loop. Cache results in data/_vin_cache.json if you do
    bulk decoding.
    """
    if not is_valid_vin(vin):
        return None
    url = NHTSA_DECODE_URL.format(vin=vin)
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            payload = json.loads(resp.read().decode("utf-8", errors="replace"))
    except Exception:
        return None
    results = payload.get("Results")
    if isinstance(results, list) and results:
        return results[0]
    return None


def fallback_key(year: int | None, make: str | None, model: str | None,
                 trim: str | None, mileage_km: int | None) -> str | None:
    """Build a fallbackKey for sources where VIN is unavailable. Same
    logic as src/lib/crossListings.ts so cross-source merge can join.

    Format: "<year>|<make>|<model>|<trim>|<kmBucket>" lowercased.
    kmBucket = floor(mileage / 5000) * 5000.
    """
    if year is None or not make or not model:
        return None
    bucket = ""
    if isinstance(mileage_km, int):
        bucket = str((mileage_km // 5000) * 5000)
    parts = [str(year), make.strip().lower(), model.strip().lower(),
             (trim or "").strip().lower(), bucket]
    return "|".join(parts)
