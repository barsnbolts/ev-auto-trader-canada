#!/usr/bin/env python3
"""TIER I1b — per-dealer inventory scraper via Crawl4AI.

Per docs/handoff/research/DEALER_INVENTORY_DECISION_2026-05-04.md:
- Crawl4AI primary (free, OSS, MIT, ★65k).
- JSON-LD-first extraction (mirrors copious_atoll/dealer-website-inventory-scraper
  reference architecture). Most dealer sites embed Vehicle JSON-LD on inventory
  pages — far more reliable than CSS-selector chasing across 80+ themes.
- Fallback: regex-extract VINs + price + year from raw HTML.

Inputs:
- data/dealers.json — dealers[*].inventoryUrl (homepage; we walk to /inventory).

Outputs:
- data/_dealers_raw.json — keyed by f"{dealerId}__{vinOrFallbackKey}".

Cadence: weekly (heavy walk vs daily AT/Kijiji). Wired into refresh_weekly.sh
(separate from refresh_daily.sh).

Mac install gotchas (per dealer-decision doc):
- Pin Python 3.11 / 3.12 (NOT 3.13). greenlet wheel issue #291 on M-series.
- Use bundled Chromium (default). Don't set chrome_channel='chrome' (issue #377).
- Run from .venv-crawl: see requirements-crawl.txt.
"""
from __future__ import annotations

import asyncio
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

# Crawl4AI is heavy + py3.12-only — guard import so the file imports
# cleanly under py3.13/3.14 without crashing the daily cron lint pass.
try:
    from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig
    from crawl4ai.async_configs import CacheMode
except ImportError:
    print(
        "FATAL: crawl4ai not installed. Run from repo .venv-crawl:\n"
        "  python3.12 -m venv .venv-crawl && source .venv-crawl/bin/activate && \\\n"
        "  pip install crawl4ai && crawl4ai-setup",
        file=sys.stderr,
    )
    raise

ROOT = Path(__file__).resolve().parent.parent
DEALERS_IN = ROOT / "data" / "dealers.json"
OUT = ROOT / "data" / "_dealers_raw.json"

# Common dealer-platform inventory subpaths. We append each to the homepage
# URL and try in order; first that returns >=1 vehicle wins. Mirrors the
# copious_atoll Apify actor's path-fan-out strategy.
INVENTORY_PATHS = [
    "/new-inventory",
    "/inventory/new",
    "/new-vehicles",
    "/showroom",
    "/used-inventory",
    "/inventory/used",
    "",  # homepage as last resort — JSON-LD often there too
]

VIN_RE = re.compile(r"\b([A-HJ-NPR-Z0-9]{17})\b")  # ISO 3779 VIN charset
PRICE_RE = re.compile(r"\$\s?([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+(?:\.[0-9]+)?)")
YEAR_RE = re.compile(r"\b(20[12][0-9])\b")
JSONLD_RE = re.compile(
    r'<script[^>]+type="application/ld\+json"[^>]*>(.+?)</script>',
    re.DOTALL | re.IGNORECASE,
)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def extract_jsonld_vehicles(html: str) -> list[dict]:
    """Pull all JSON-LD blocks, return any that look like Vehicle / Car offers."""
    out: list[dict] = []
    for m in JSONLD_RE.finditer(html):
        block = m.group(1).strip()
        try:
            data = json.loads(block)
        except json.JSONDecodeError:
            continue
        for node in (data if isinstance(data, list) else [data]):
            t = node.get("@type") if isinstance(node, dict) else None
            if isinstance(t, list):
                t = next((x for x in t if x in ("Vehicle", "Car", "Product")), None)
            if t in ("Vehicle", "Car", "Product"):
                out.append(node)
            # Some sites nest under @graph
            graph = node.get("@graph") if isinstance(node, dict) else None
            if isinstance(graph, list):
                for g in graph:
                    gt = g.get("@type") if isinstance(g, dict) else None
                    if gt in ("Vehicle", "Car", "Product"):
                        out.append(g)
    return out


def normalize_jsonld(node: dict, source_url: str) -> dict:
    """Map a JSON-LD Vehicle/Car node to our raw schema."""
    name = node.get("name") or ""
    year_m = YEAR_RE.search(name)
    year = int(year_m.group(1)) if year_m else None

    offers = node.get("offers") or {}
    if isinstance(offers, list):
        offers = offers[0] if offers else {}
    price = offers.get("price")
    try:
        price_cad = int(float(price)) if price else None
    except (TypeError, ValueError):
        price_cad = None

    return {
        "vin": node.get("vehicleIdentificationNumber") or node.get("sku"),
        "year": year,
        "make": (node.get("brand") or {}).get("name") if isinstance(node.get("brand"), dict) else node.get("brand"),
        "model": node.get("model"),
        "trim": node.get("vehicleConfiguration"),
        "mileageKm": _parse_mileage(node.get("mileageFromOdometer")),
        "priceCad": price_cad,
        "url": node.get("url") or source_url,
        "rawSource": "jsonld",
    }


def _parse_mileage(m) -> int | None:
    if isinstance(m, dict):
        v = m.get("value")
    else:
        v = m
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return None


def regex_fallback(html: str, source_url: str) -> list[dict]:
    """When JSON-LD absent: regex-extract VINs + nearest price/year."""
    out: list[dict] = []
    for vin in set(VIN_RE.findall(html)):
        # Look in a 500-char window around the VIN for price + year.
        idx = html.find(vin)
        window = html[max(0, idx - 250): idx + 750]
        price_m = PRICE_RE.search(window)
        year_m = YEAR_RE.search(window)
        price_cad = None
        if price_m:
            try:
                price_cad = int(float(price_m.group(1).replace(",", "")))
            except ValueError:
                pass
        out.append({
            "vin": vin,
            "year": int(year_m.group(1)) if year_m else None,
            "priceCad": price_cad,
            "url": source_url,
            "rawSource": "regex",
        })
    return out


async def crawl_dealer(crawler: "AsyncWebCrawler", dealer: dict, run_config) -> list[dict]:
    homepage = dealer.get("inventoryUrl")
    if not homepage:
        return []
    base = homepage.rstrip("/")
    parsed = urlparse(base)
    if not parsed.scheme:
        base = "https://" + base

    for path in INVENTORY_PATHS:
        url = base + path if path else base
        try:
            result = await crawler.arun(url=url, config=run_config)
        except Exception as e:
            print(f"  [{dealer['id']}] crawl error {url}: {e}", file=sys.stderr)
            continue
        if not result.success or not result.html:
            continue
        vehicles = [normalize_jsonld(v, url) for v in extract_jsonld_vehicles(result.html)]
        if not vehicles:
            vehicles = regex_fallback(result.html, url)
        if vehicles:
            for v in vehicles:
                v["dealerId"] = dealer["id"]
                v["scrapedAt"] = now_iso()
            print(f"  [{dealer['id']}] {url}: {len(vehicles)} vehicles", file=sys.stderr)
            return vehicles
    return []


async def main_async() -> int:
    dealers = json.loads(DEALERS_IN.read_text())
    targets = [d for d in dealers if d.get("inventoryUrl")]
    print(f"crawl: {len(targets)}/{len(dealers)} dealers have inventoryUrl", file=sys.stderr)

    if not targets:
        print("no dealers with inventoryUrl — nothing to crawl", file=sys.stderr)
        OUT.write_text(json.dumps({}, indent=2) + "\n")
        return 0

    raw: dict[str, dict] = {}
    if OUT.exists():
        try:
            raw = json.loads(OUT.read_text())
        except Exception:
            raw = {}

    browser_config = BrowserConfig(headless=True, verbose=False)
    run_config = CrawlerRunConfig(cache_mode=CacheMode.BYPASS, page_timeout=20_000)

    async with AsyncWebCrawler(config=browser_config) as crawler:
        for dealer in targets:
            vehicles = await crawl_dealer(crawler, dealer, run_config)
            for v in vehicles:
                key = f"{dealer['id']}__{v.get('vin') or v.get('url')}"
                raw[key] = v

    OUT.write_text(json.dumps(raw, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"_dealers_raw.json: total={len(raw)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main_async()))
