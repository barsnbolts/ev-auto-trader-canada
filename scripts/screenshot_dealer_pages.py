#!/usr/bin/env python3
"""TIER I1c (part 1) — capture dealer hero + offers page screenshots.

Per docs/handoff/research/DEALER_PROMO_DECISION_2026-05-04.md:
- Playwright headless via crawl4ai's bundled Chromium.
- For each dealer with inventoryUrl, screenshot homepage + /offers (if exists).
- Output: data/_dealer_promo_screenshots/{dealerId}/{slug}.png
- Cap: ~80 dealers × 2 pages = ~160 PNGs/sweep.

Cadence: weekly (paired with extract_dealer_promos.py).

Run from .venv-crawl (same py3.12 + crawl4ai env as scrape_dealers_inventory).
"""
from __future__ import annotations

import asyncio
import json
import re
import sys
from pathlib import Path

try:
    from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig
    from crawl4ai.async_configs import CacheMode
except ImportError:
    print("FATAL: crawl4ai missing — see requirements-crawl.txt", file=sys.stderr)
    raise

ROOT = Path(__file__).resolve().parent.parent
DEALERS_IN = ROOT / "data" / "dealers.json"
OUT_DIR = ROOT / "data" / "_dealer_promo_screenshots"

PROMO_PATHS = ["", "/offers", "/specials", "/promotions"]


def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-") or "home"


async def shoot(crawler, dealer: dict, run_config) -> int:
    home = (dealer.get("inventoryUrl") or "").rstrip("/")
    if not home:
        return 0
    out_dir = OUT_DIR / dealer["id"]
    out_dir.mkdir(parents=True, exist_ok=True)
    captured = 0
    for path in PROMO_PATHS:
        url = home + path if path else home
        try:
            result = await crawler.arun(url=url, config=run_config)
        except Exception as e:
            print(f"  [{dealer['id']}] err {url}: {e}", file=sys.stderr)
            continue
        if not result.success or not result.screenshot:
            continue
        png_bytes = bytes.fromhex(result.screenshot) if isinstance(result.screenshot, str) else result.screenshot
        # crawl4ai returns base64-encoded PNG by default; handle both.
        try:
            import base64
            if isinstance(result.screenshot, str):
                png_bytes = base64.b64decode(result.screenshot)
        except Exception:
            pass
        out_path = out_dir / f"{slug(path or 'home')}.png"
        out_path.write_bytes(png_bytes)
        captured += 1
        print(f"  [{dealer['id']}] {url} → {out_path.name}", file=sys.stderr)
        # Only keep first-found promo path beyond home
        if path and captured >= 2:
            break
    return captured


async def main_async() -> int:
    dealers = json.loads(DEALERS_IN.read_text())
    targets = [d for d in dealers if d.get("inventoryUrl")]
    print(f"screenshots: {len(targets)} target dealers", file=sys.stderr)
    if not targets:
        return 0
    bc = BrowserConfig(headless=True, verbose=False)
    rc = CrawlerRunConfig(cache_mode=CacheMode.BYPASS, page_timeout=20_000, screenshot=True)
    total = 0
    async with AsyncWebCrawler(config=bc) as cr:
        for d in targets:
            total += await shoot(cr, d, rc)
    print(f"total screenshots: {total}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main_async()))
