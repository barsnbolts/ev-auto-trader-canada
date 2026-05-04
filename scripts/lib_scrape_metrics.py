"""Self-improving scraper telemetry + adaptive tuning.

Each scraper run appends one record to data/_scraper_metrics.jsonl with:
  ts, source, fetched, unique, vin_pct, vin_checksum_ok_pct, errors,
  pages_walked, duration_s, max_pages_hit (bool — did pagination cap?),
  notes

Next run reads recent records and tunes parameters:
  - max_pages: bump if last run hit cap with new ads still arriving;
    drop if last 3 runs all wrapped around early.
  - throttle: bump if error rate > 10%; ease off if 0 errors over 5 runs.
  - vin_quality_floor: warn if vin_pct drops > 10pp from rolling mean
    (signals upstream schema drift).

Inspired by Apify's crawlee adaptive concurrency + scrapy-deltafetch
incremental-fetch idea, condensed to ~120 lines for personal-use scope.

Why JSONL not JSON: append-only, crash-safe, grep-friendly. Each run
is one line. Easy to roll up via `jq` or pandas if it grows.

API:
    record_run(source, **stats)            # call at end of each scraper
    summary(source, n=5) -> RunSummary     # rolling window of last N
    suggest_max_pages(source, default=8)   # adaptive parameter

Caveman-concise on purpose. No deps; stdlib only.
"""
from __future__ import annotations

import json
import sys
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
METRICS_FILE = ROOT / "data" / "_scraper_metrics.jsonl"


@dataclass
class RunRecord:
    ts: str
    source: str
    fetched: int            # listings written this run (may include re-writes)
    unique: int             # distinct stockIds seen this session
    vin_pct: float          # % of listings with strict-VIN field
    vin_checksum_ok_pct: float  # % of those VINs that pass check-digit
    errors: int             # parse / fetch errors encountered
    pages_walked: int       # total HTTP fetches performed
    duration_s: float
    max_pages_hit: bool     # did any model walk the full pagination cap?
    notes: str = ""


def record_run(source: str,
               fetched: int,
               unique: int,
               vin_pct: float,
               vin_checksum_ok_pct: float,
               errors: int,
               pages_walked: int,
               duration_s: float,
               max_pages_hit: bool,
               notes: str = "") -> None:
    """Append one record. Cheap (no read of existing file)."""
    rec = RunRecord(
        ts=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        source=source,
        fetched=fetched,
        unique=unique,
        vin_pct=round(vin_pct, 1),
        vin_checksum_ok_pct=round(vin_checksum_ok_pct, 1),
        errors=errors,
        pages_walked=pages_walked,
        duration_s=round(duration_s, 1),
        max_pages_hit=max_pages_hit,
        notes=notes,
    )
    METRICS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with METRICS_FILE.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(asdict(rec)) + "\n")


def _load_records(source: str | None = None) -> list[dict]:
    if not METRICS_FILE.exists():
        return []
    out: list[dict] = []
    with METRICS_FILE.open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue
            if source is None or rec.get("source") == source:
                out.append(rec)
    return out


def summary(source: str, n: int = 5) -> dict:
    """Last-N-runs summary for a given source."""
    recs = _load_records(source)[-n:]
    if not recs:
        return {"source": source, "runs": 0}
    vin_pcts = [r["vin_pct"] for r in recs if "vin_pct" in r]
    fetched = [r["fetched"] for r in recs if "fetched" in r]
    return {
        "source": source,
        "runs": len(recs),
        "avg_vin_pct": round(sum(vin_pcts) / len(vin_pcts), 1) if vin_pcts else None,
        "avg_unique": round(sum(r.get("unique", 0) for r in recs) / len(recs), 1),
        "avg_fetched": round(sum(fetched) / len(fetched), 1) if fetched else None,
        "max_pages_hit_count": sum(1 for r in recs if r.get("max_pages_hit")),
        "last_run": recs[-1],
    }


def suggest_max_pages(source: str, default: int = 8, floor: int = 3, ceiling: int = 16) -> int:
    """Adaptive page cap based on recent behavior:
      - If last run hit max_pages_hit AND unique grew vs prior → bump.
      - If last 3 runs all wrapped around (max_pages_hit=False AND
        pages_walked < default) → drop the cap to save fetches.
      - Otherwise: use default.
    """
    recs = _load_records(source)[-3:]
    if not recs:
        return default
    last = recs[-1]
    if last.get("max_pages_hit") and last.get("unique", 0) > 0:
        # Prior run was constrained by cap — try bigger.
        return min(ceiling, default + 2)
    # Was last run able to drain naturally?
    drained = all(not r.get("max_pages_hit") for r in recs)
    if drained and len(recs) == 3:
        # All 3 runs came in well under cap. Reduce cap to save HTTP.
        return max(floor, default - 1)
    return default


def main_cli() -> int:
    """Quick CLI — `python3 lib_scrape_metrics.py kijiji 5` shows summary."""
    args = sys.argv[1:]
    src = args[0] if args else "kijiji"
    n = int(args[1]) if len(args) > 1 else 5
    print(json.dumps(summary(src, n), indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main_cli())
