#!/usr/bin/env python3
"""Append an Apify run cost record to the spend ledger; warn near the cap.

Usage:
  echo '{"runId":"abc","datetime":"2026-05-02T20:30:00Z","costUsd":0.10}' \\
    | python3 scripts/track_apify_spend.py

Exit codes:
  0  recorded; cumulative under $25
  2  recorded; cumulative within $5 of $30 cap (caller should pause + ask)
  3  invalid input

Reads/writes data/apify_spend.json. Self-imposed budget cap is $30 USD.
Conservative: an over-cap run is still recorded (so the ledger stays
truthful), and exit 2 lets the caller short-circuit the next run.
"""
from __future__ import annotations
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEDGER = ROOT / "data" / "apify_spend.json"
HARD_CAP_USD = 30.0
WARN_THRESHOLD_USD = 25.0


def main() -> int:
    try:
        record = json.loads(sys.stdin.read())
    except json.JSONDecodeError as e:
        print(f"ERR invalid JSON on stdin: {e}", file=sys.stderr)
        return 3

    for key in ("runId", "datetime", "costUsd"):
        if key not in record:
            print(f"ERR missing key '{key}'", file=sys.stderr)
            return 3

    data = (
        json.loads(LEDGER.read_text())
        if LEDGER.exists()
        else {"runs": [], "cumulativeUsd": 0.0}
    )
    data["runs"].append(record)
    data["cumulativeUsd"] = round(
        sum(r.get("costUsd", 0) for r in data["runs"]), 4
    )
    LEDGER.write_text(json.dumps(data, indent=2) + "\n")

    print(f"Apify cumulative: ${data['cumulativeUsd']:.4f} (cap ${HARD_CAP_USD})")
    if data["cumulativeUsd"] > HARD_CAP_USD:
        print("WARNING: OVER $30 cap — halt + tell user before next run")
        return 2
    if data["cumulativeUsd"] > WARN_THRESHOLD_USD:
        print(
            f"WARNING: within ${HARD_CAP_USD - WARN_THRESHOLD_USD} of cap — "
            "pause + ask user before next paid run"
        )
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
