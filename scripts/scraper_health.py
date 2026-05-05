#!/usr/bin/env python3
"""TIER E4 — per-source scraper health summary from _scraper_metrics.jsonl.

Reads the latest N days of metrics. Prints a per-source rolling table:
  source | runs | avg_fetched | avg_unique | avg_vin_pct | avg_checksum_ok | errors

Flags outliers when vin_pct drops > 10pp vs prior median (potential
schema drift / dealers redacting VINs / regex broken).

Run: python3 scripts/scraper_health.py [--days 5]
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from pathlib import Path
from statistics import mean, median

ROOT = Path(__file__).resolve().parent.parent
METRICS = ROOT / "data" / "_scraper_metrics.jsonl"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=5)
    args = ap.parse_args()

    if not METRICS.exists():
        print(f"no metrics file at {METRICS}", file=sys.stderr)
        return 0

    cutoff = datetime.now(timezone.utc) - timedelta(days=args.days)
    by_source: dict[str, list[dict]] = defaultdict(list)
    for line in METRICS.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            r = json.loads(line)
        except json.JSONDecodeError:
            continue
        ts = r.get("ts")
        if not ts:
            continue
        try:
            t = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        except ValueError:
            continue
        if t < cutoff:
            continue
        by_source[r.get("source", "?")].append(r)

    if not by_source:
        print(f"no metrics in last {args.days} days")
        return 0

    print(f"scraper health · last {args.days}d")
    print(
        f"{'source':12s} {'runs':>5s} {'avg_fetched':>12s} {'avg_unique':>11s} "
        f"{'avg_vin%':>9s} {'avg_chk%':>9s} {'errs':>5s}"
    )
    flags: list[str] = []
    for src, rows in sorted(by_source.items()):
        runs = len(rows)
        avg_f = mean(r.get("fetched", 0) for r in rows)
        avg_u = mean(r.get("unique", 0) for r in rows)
        avg_v = mean(r.get("vin_pct", 0) for r in rows)
        avg_c = mean(r.get("vin_checksum_ok_pct", 0) for r in rows)
        errs = sum(r.get("errors", 0) for r in rows)
        print(
            f"{src:12s} {runs:>5d} {avg_f:>12.1f} {avg_u:>11.1f} "
            f"{avg_v:>9.1f} {avg_c:>9.1f} {errs:>5d}"
        )
        # vin_pct drift: latest vs median of prior runs
        if runs >= 3:
            prior = [r.get("vin_pct", 0) for r in rows[:-1]]
            latest = rows[-1].get("vin_pct", 0)
            med = median(prior)
            if med - latest > 10:
                flags.append(
                    f"WARN [{src}]: vin_pct dropped {med - latest:.1f}pp "
                    f"(median prior {med:.1f}% → latest {latest:.1f}%)"
                )

    if flags:
        print()
        for f in flags:
            print(f, file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
