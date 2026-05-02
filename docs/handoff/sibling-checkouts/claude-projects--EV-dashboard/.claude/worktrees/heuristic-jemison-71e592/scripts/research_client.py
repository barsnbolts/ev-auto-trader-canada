#!/usr/bin/env python3
"""research_client.py — Python bindings for direct Exa + Apify research calls.

Lets `scripts/research.py` and `scripts/research_vehicle.py` actually fetch
data without going through the agent loop. Without keys, both backends print
an instructional message and return None — the script keeps working through
its agent-dispatch path.

Why both Exa and Apify?
  - Exa: semantic web search + content extraction. Fast, recency-ranked,
    great for "what's the current state of X in 2026" questions.
  - Apify: hosts pre-built scrapers (AutoTrader, Kijiji, PlugShare, etc.)
    that handle anti-bot defenses. Use when target site blocks plain HTTP.

Setup:
  Add to .env.local:
      EXA_API_KEY=...           # https://exa.ai (free tier: 1000 queries/mo)
      APIFY_API_TOKEN=...       # https://console.apify.com/account/integrations

Usage from another script:
    from research_client import ExaClient, ApifyClient
    exa = ExaClient.from_env()
    if exa:
        for hit in exa.search("Hyundai Kona Electric 2025 specs", n=5):
            print(hit["title"], hit["url"])
    apify = ApifyClient.from_env()
    if apify:
        result = apify.run_actor("apify/rag-web-browser",
                                 {"queries": ["EV-Database Kona Electric"]})

CLI:
    python3 scripts/research_client.py --status        # check which keys present
    python3 scripts/research_client.py --search "..."  # quick Exa search
    python3 scripts/research_client.py --fetch <url>   # quick Exa fetch
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent


# ---------------------------------------------------------------------------
# .env.local loader (zero-deps; no python-dotenv requirement)
# ---------------------------------------------------------------------------

_env_loaded = False


def load_env_local() -> None:
    """Read .env.local and inject any KEY=VALUE pairs into os.environ.
    Idempotent. Does not overwrite already-set env vars."""
    global _env_loaded
    if _env_loaded:
        return
    _env_loaded = True
    p = ROOT / ".env.local"
    if not p.exists():
        return
    for raw in p.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = val


def _http_post_json(url: str, headers: dict, payload: dict, timeout: int = 30) -> dict:
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={**headers, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _http_get_json(url: str, headers: dict, timeout: int = 30) -> dict:
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


# ---------------------------------------------------------------------------
# Exa client
# ---------------------------------------------------------------------------


@dataclass
class ExaClient:
    api_key: str
    base_url: str = "https://api.exa.ai"

    @classmethod
    def from_env(cls) -> ExaClient | None:
        load_env_local()
        key = os.environ.get("EXA_API_KEY", "").strip()
        if not key:
            return None
        return cls(api_key=key)

    def _headers(self) -> dict:
        return {"x-api-key": self.api_key, "Accept": "application/json"}

    def search(self, query: str, n: int = 5, *, use_autoprompt: bool = True,
               include_domains: list[str] | None = None) -> list[dict]:
        payload: dict[str, Any] = {
            "query": query,
            "numResults": n,
            "useAutoprompt": use_autoprompt,
        }
        if include_domains:
            payload["includeDomains"] = include_domains
        try:
            data = _http_post_json(f"{self.base_url}/search", self._headers(), payload)
        except urllib.error.HTTPError as e:
            return [{"error": f"Exa HTTP {e.code}: {e.reason}"}]
        except Exception as e:
            return [{"error": f"Exa search failed: {e}"}]
        return [
            {"title": r.get("title", ""), "url": r.get("url", ""), "score": r.get("score", 0.0),
             "publishedDate": r.get("publishedDate"), "id": r.get("id")}
            for r in data.get("results", [])
        ]

    def contents(self, urls: list[str], *, text: bool = True, summary: bool = False) -> list[dict]:
        """Fetch full text + optional summary for the given URLs."""
        payload: dict[str, Any] = {"ids": urls, "text": text}
        if summary:
            payload["summary"] = True
        try:
            data = _http_post_json(f"{self.base_url}/contents", self._headers(), payload)
        except urllib.error.HTTPError as e:
            return [{"error": f"Exa HTTP {e.code}: {e.reason}"}]
        except Exception as e:
            return [{"error": f"Exa contents failed: {e}"}]
        return data.get("results", [])


# ---------------------------------------------------------------------------
# Apify client
# ---------------------------------------------------------------------------


@dataclass
class ApifyClient:
    token: str
    base_url: str = "https://api.apify.com/v2"

    @classmethod
    def from_env(cls) -> ApifyClient | None:
        load_env_local()
        token = os.environ.get("APIFY_API_TOKEN", "").strip()
        if not token:
            return None
        return cls(token=token)

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self.token}", "Accept": "application/json"}

    def run_actor(self, actor: str, input_payload: dict, *, wait_secs: int = 60) -> dict:
        """Run an Apify actor synchronously; returns the dataset items."""
        # Use run-sync-get-dataset-items for simple call-and-collect pattern.
        actor_path = actor.replace("/", "~")
        url = f"{self.base_url}/acts/{actor_path}/run-sync-get-dataset-items"
        body = json.dumps(input_payload).encode("utf-8")
        req = urllib.request.Request(url, data=body,
                                     headers={**self._headers(), "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=wait_secs + 30) as resp:
                return {"items": json.loads(resp.read().decode("utf-8")), "ok": True}
        except urllib.error.HTTPError as e:
            return {"ok": False, "error": f"Apify HTTP {e.code}: {e.reason}"}
        except Exception as e:
            return {"ok": False, "error": f"Apify run failed: {e}"}


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def cmd_status() -> int:
    load_env_local()
    exa = ExaClient.from_env()
    apify = ApifyClient.from_env()
    print(f"  EXA_API_KEY:        {'✅ set' if exa else '❌ unset (free tier at https://exa.ai)'}")
    print(f"  APIFY_API_TOKEN:    {'✅ set' if apify else '❌ unset (free tier at https://console.apify.com)'}")
    if not exa and not apify:
        print()
        print("Both unset — `scripts/research*.py` still work via Claude's MCP path.")
        print("Set the keys to enable autonomous Python-side fetches (faster batch jobs).")
    return 0


def cmd_search(query: str, n: int) -> int:
    exa = ExaClient.from_env()
    if not exa:
        print("EXA_API_KEY not set — see `--status`.", file=sys.stderr)
        return 1
    hits = exa.search(query, n=n)
    print(json.dumps(hits, indent=2))
    return 0


def cmd_fetch(url: str) -> int:
    exa = ExaClient.from_env()
    if not exa:
        print("EXA_API_KEY not set — see `--status`.", file=sys.stderr)
        return 1
    out = exa.contents([url], text=True, summary=True)
    print(json.dumps(out, indent=2))
    return 0


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--status", action="store_true", help="check which keys are configured")
    g.add_argument("--search", help="run a single Exa search query")
    g.add_argument("--fetch", help="fetch one URL via Exa /contents")
    ap.add_argument("-n", type=int, default=5, help="numResults for --search")
    args = ap.parse_args(argv[1:])

    if args.status:
        return cmd_status()
    if args.search:
        return cmd_search(args.search, args.n)
    if args.fetch:
        return cmd_fetch(args.fetch)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
