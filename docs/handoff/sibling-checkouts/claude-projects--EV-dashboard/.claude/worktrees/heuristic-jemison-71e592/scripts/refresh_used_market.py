#!/usr/bin/env python3
"""refresh_used_market.py — pre-warm the used-market cache for F-09.

Reads `src/data/seed.json`, fires one Exa query per (brand, model) pair, and
writes results to `public/used-market-cache.json`. The UsedMarketPanel.tsx in
the app reads this file on first paint (before localStorage is populated) so
the user sees listings immediately without needing their own EXA_API_KEY.

Without EXA_API_KEY in .env.local, this script writes an empty stub cache so
the UI gracefully falls through to its "no key" message.

Usage:
    python3 scripts/refresh_used_market.py            # write cache
    python3 scripts/refresh_used_market.py --dry-run  # show what'd happen

Run nightly via the scheduled-tasks MCP if you want fresh data daily.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEED = ROOT / "src" / "data" / "seed.json"
CACHE = ROOT / "public" / "used-market-cache.json"

sys.path.insert(0, str(Path(__file__).resolve().parent))
from research_client import ExaClient  # noqa: E402


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--per-model", type=int, default=5, help="results per model")
    args = ap.parse_args(argv[1:])

    seed = json.loads(SEED.read_text(encoding="utf-8"))
    brand_by_id = {b["id"]: b for b in seed["brands"]}
    by_model: dict[tuple[str, str], dict] = {}
    for v in seed["vehicles"]:
        key = (v["brand_id"], v["model"])
        if key not in by_model:
            by_model[key] = {
                "brand_id": v["brand_id"],
                "brand_name": brand_by_id.get(v["brand_id"], {}).get("name", v["brand_id"]),
                "model": v["model"],
                "year_start": v["year_start"],
            }

    print(f"  → {len(by_model)} unique (brand, model) pairs across {len(seed['vehicles'])} vehicles")

    exa = ExaClient.from_env()
    if not exa:
        stub = {
            "_warning": "EXA_API_KEY not set — cache is empty stub. UsedMarketPanel will fall through to 'no key' message.",
            "generated_at": date.today().isoformat(),
            "models": {},
        }
        if args.dry_run:
            print("  → would write empty stub (no key)")
            return 0
        CACHE.parent.mkdir(parents=True, exist_ok=True)
        CACHE.write_text(json.dumps(stub, indent=2) + "\n", encoding="utf-8")
        print(f"  → wrote stub: {CACHE.relative_to(ROOT)}")
        return 0

    if args.dry_run:
        print(f"  → would query Exa for {len(by_model)} models, {args.per_model} results each")
        return 0

    out_models: dict[str, list[dict]] = {}
    for (bid, model), info in by_model.items():
        query = f"{info['brand_name']} {model} used for sale {info['year_start']}-2026 site:autotrader.ca OR site:kijiji.ca"
        try:
            hits = exa.search(query, n=args.per_model)
            out_models[f"{bid}::{model}"] = hits
            print(f"  ✓ {info['brand_name']} {model}: {len(hits)} hits")
        except Exception as e:
            out_models[f"{bid}::{model}"] = [{"error": str(e)}]
            print(f"  ✗ {info['brand_name']} {model}: {e}")

    cache = {"generated_at": date.today().isoformat(), "models": out_models}
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(json.dumps(cache, indent=2) + "\n", encoding="utf-8")
    print(f"  → wrote: {CACHE.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
