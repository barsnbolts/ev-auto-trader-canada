#!/usr/bin/env python3
"""Re-fetch a single AutoTrader listing and report freshness.

Phase B per-unit verify: dossier "Verify availability" chip calls this
via the Tauri Rust `run_verify_unit` command. Output is JSON on stdout
so the calling Rust can deserialize and emit to the WebView.

Usage:
    python3 scripts/verify_unit.py <unit_id>

Output:
    { "unitId": "u-at-...", "status": "active|removed|error",
      "askingPrice": 54999, "scrapedAt": "2026-05-04T...Z",
      "httpStatus": 200, "error": null }
"""
from __future__ import annotations

import json
import re
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UNITS = ROOT / "data" / "units.json"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/17.5 Safari/605.1.15"
)


def find_unit(unit_id: str) -> dict | None:
    with UNITS.open("r", encoding="utf-8") as fh:
        for u in json.load(fh):
            if u.get("id") == unit_id:
                return u
    return None


def fetch(url: str) -> tuple[int, str]:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status, resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception as e:
        return -1, str(e)


def parse_price(html: str) -> int | None:
    # AutoTrader Canada surfaces price in the page schema + visible markup.
    # First try JSON-LD; fall back to the visible "$XX,XXX" pattern.
    m = re.search(r'"price"\s*:\s*"?(\d{4,6})', html)
    if m:
        return int(m.group(1))
    m = re.search(r"\$\s?(\d{2,3},\d{3})", html)
    if m:
        return int(m.group(1).replace(",", ""))
    return None


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "usage: verify_unit.py <unit_id>"}))
        return 1
    unit_id = sys.argv[1]
    unit = find_unit(unit_id)
    if not unit:
        print(json.dumps({"unitId": unit_id, "status": "error", "error": "unit not found in units.json"}))
        return 2
    url = unit.get("listingUrl")
    if not url:
        print(json.dumps({"unitId": unit_id, "status": "error", "error": "unit has no listingUrl"}))
        return 3
    status_code, body = fetch(url)
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    if status_code in (404, 410):
        out = {"unitId": unit_id, "status": "removed", "httpStatus": status_code, "scrapedAt": now}
    elif status_code != 200:
        out = {
            "unitId": unit_id,
            "status": "error",
            "httpStatus": status_code,
            "error": "non-200",
            "scrapedAt": now,
        }
    else:
        price = parse_price(body)
        out = {
            "unitId": unit_id,
            "status": "active",
            "httpStatus": 200,
            "askingPrice": price,
            "scrapedAt": now,
        }
    print(json.dumps(out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
