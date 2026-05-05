# AutoTrader.ca scrape strategy · decision · 2026-05-04 (REVISED post-R1)

## Pivot from earlier draft

Earlier draft made Chrome MCP probe primary. **R1 survey reversed
this**: there is no JSON XHR endpoint on AutoTrader.ca. Listing data is
embedded as a hydration object `window['ngVdpModel']` in the SSR HTML.
The right strategy is a paid Apify actor, not a self-built probe.

## Current state

`/tmp/at_listings.json` is the only AT data source. It's 4 days stale
(May 1, 18:52). No script in the repo CREATES it. The cron's
downstream (`build_units_from_at.py`) just re-stamps the same 100
units forward each day. **Inventory is frozen.**

`scripts/scrape_search_json.py` is referenced by `refresh_daily.sh:27`
but does not exist. This is the missing scraper.

## Architecture decision (FREE PATH PRIMARY per user 2026-05-05)

**Primary: build a `window['ngVdpModel']` HTML-extract parser
ourselves.** Chrome MCP probe confirms the hydration-object shape on
one page → Python `requests.get()` + regex extractor for daily sweep.
$0/mo. Uses Ian's paired Browser 1 for the one-time probe; production
sweeps run as plain `requests.get()` from cron.

**Fallback A: `fayoussef/autotrader-canada` Apify actor** ($1.00/1k
listings, "Per-Results" variant). Already does exactly this
(parses `window['ngVdpModel']`) but with residential-proxy backing.
Use when our free path hits Imperva 403s twice in a row.

**Fallback B: `calm_builder/autotrader-canada` Apify actor**
($1.20/1k listings). Most recently updated, 100 % success rate. Use
if both free path AND `fayoussef` regress on the same day.

### Why free-path is plausible despite the Imperva concern

R1 survey said Imperva blocks bare `requests` "within ~3 calls" — but
that observation came from people scraping AT search-result pages
hard. **Our pattern is much gentler**: ~6 search pages (one per model)
+ ~150-300 detail pages, spaced 5-8s apart, per day. Total ~30-50
requests/day. Imperva typically tolerates this rate from a clean IP
without challenge.

Mitigations if Imperva DOES challenge:
- **Rotate User-Agent** per sweep (random pick from 6 modern macOS/
  iOS UAs).
- **Random sleep jitter**: 5-8s between requests instead of fixed.
- **Refresh capture** from Chrome MCP if challenge HTML detected.
- **Apify fallback** kicks in automatically (2 strikes → switch).

**Rejected alternatives** (per R1 survey):
- `cloudscraper`, `curl_cffi`, `tls_client` — Imperva v15 has
  defeated all of these since late 2024 without residential proxies.
- Hand-rolled headless Playwright in CI — slow, fragile, no advantage
  over Apify.
- All OSS GitHub repos — none passed the 2024-01-01 cutoff.

## Cost projection

At likely Ian-relevant volumes:
- Hyundai/Kia EVs Ontario-radius: ~150-300 listings.
- Daily sweep: ~$0.20-0.40/day = $6-12/month.
- $30 cap: comfortable headroom. Actor's free tier ($5/mo) covers
  much of this if Ian's Apify account has it.

## Action plan

### F1 — high-tier Chrome MCP probe (~5-8k tokens)

Free path requires real probe work:

1. **Pair Chrome** (already paired as Browser 1).
2. **Tab + capture hook**: standard universal-fetch+XHR monkeypatch.
3. **Navigate** to a search results page:
   `https://www.autotrader.ca/cars/hyundai/ioniq-5/?prx=100&prv=Ontario&loc=K1A%200B1`
4. **Wait** 8s for SSR + hydration.
5. **Inspect `window.ngVdpModel` shape**:
   ```javascript
   ({
     hasNgVdpModel: !!window.ngVdpModel,
     keys: window.ngVdpModel ? Object.keys(window.ngVdpModel).slice(0,30) : null,
     listingCount: window.ngVdpModel?.results?.length ?? null,
     samplePath: window.ngVdpModel ? Object.keys(window.ngVdpModel.results?.[0] || {}).slice(0,20) : null
   })
   ```
6. **Capture full body**: extract `window.ngVdpModel` into JSON, save
   to `docs/handoff/research/AT_NGVDPMODEL_CAPTURE_2026-05-04.json`.
7. **Verify VIN coverage** in the captured listings — count entries
   where `vin` field is present + non-empty.
8. **Verify pagination**: navigate `?page=2` and confirm
   `window.ngVdpModel` updates.
9. **Save replayer spec**:
   `docs/handoff/research/AT_REPLAY_SPEC_2026-05-04.md` —
   document the regex extraction pattern, field-name mapping,
   pagination URL convention, headers required to avoid Imperva
   challenge (esp. `User-Agent`, `Accept-Language`, `Cookie`).

### I0e — medium-tier wrapper (~7k tokens)

Free-path scraper:

```python
# scripts/scrape_autotrader.py
"""Daily AutoTrader.ca scrape — extracts window['ngVdpModel'] hydration
JSON via plain HTTP GET. No paid services.

If this hits Imperva 403 twice in a row, falls back to
fayoussef/autotrader-canada Apify actor (track spend in
data/apify_spend.json).
"""
import json
import re
import time
import random
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "_autotrader_raw.json"
FAILURE_FLAG = ROOT / "data" / "_at_consecutive_failures"

USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    # ...4 more rotated UAs
]

NGVDP_RE = re.compile(r"window\['ngVdpModel'\]\s*=\s*(\{.+?\});", re.DOTALL)

SEARCH_URLS = [
    "https://www.autotrader.ca/cars/hyundai/ioniq-5/",
    "https://www.autotrader.ca/cars/hyundai/ioniq-6/",
    "https://www.autotrader.ca/cars/hyundai/ioniq-9/",
    "https://www.autotrader.ca/cars/kia/ev6/",
    "https://www.autotrader.ca/cars/kia/ev9/",
    "https://www.autotrader.ca/cars/kia/niro-ev/",
]

def fetch_page(url: str) -> dict | None:
    headers = {
        "User-Agent": random.choice(USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-CA,en;q=0.9",
    }
    r = requests.get(url, headers=headers, timeout=15)
    if r.status_code != 200:
        return None
    m = NGVDP_RE.search(r.text)
    if not m:
        return None
    return json.loads(m.group(1))

def main():
    # 1. For each SEARCH_URL: fetch page 1, parse ngVdpModel,
    #    iterate pages until empty.
    # 2. Sleep 5-8s (jittered) between requests.
    # 3. If 2+ consecutive failures: write FAILURE_FLAG and exit 2 (cron
    #    will pick up flag and call apify fallback).
    # 4. Otherwise write OUT, clear FAILURE_FLAG.
    ...
```

Apify-fallback wrapper (only invoked when free path fails twice):

```python
# scripts/scrape_autotrader_apify_fallback.py
"""Emergency fallback: pulls AT data via fayoussef/autotrader-canada
when free path sees Imperva 403s twice in a row.
Records cost via track_apify_spend.py. Hard-fails near cap.
"""
...
```

Cron hook in `refresh_daily.sh`:
```bash
python3 scripts/scrape_autotrader.py
if [ -f data/_at_consecutive_failures ] && [ $(cat data/_at_consecutive_failures) -ge 2 ]; then
    python3 scripts/scrape_autotrader_apify_fallback.py || echo "AT FALLBACK FAILED — using existing raw"
fi
```

`build_units_from_at.py` flips its input path:
- OLD: `Path("/tmp/at_listings.json")`
- NEW: `ROOT / "data" / "_autotrader_raw.json"`

`refresh_daily.sh` adds before `build_units_from_at.py`:
```bash
python3 scripts/scrape_autotrader.py 2>&1 || echo "AT WARN — building from existing raw"
```

The `|| echo` keeps the cron from hard-failing if a single AT scrape
hiccups; the existing raw file gets reused (worst case, 1-day-stale
data instead of broken cron).

## Failure recovery

If the `calm_builder` actor returns errors / empty for a sweep:
1. Log + retry once after 5 min sleep.
2. Second failure: switch to `fayoussef/autotrader-canada` actor.
   Document switch in cron.log + commit message.
3. Two consecutive days of both-actor failure: schedule high-tier
   re-evaluation. Possibly the AT schema has rotated and both actors
   need their authors to ship updates. As a backstop, the optional
   zero-cost `window['ngVdpModel']` parser becomes appealing.

## Apify spend guard

Every call to `mcp__Apify__call-actor` MUST be preceded by a
`track_apify_spend.py` precheck. If cumulative spend within $5 of the
$30 cap (`exit 2`), the wrapping script aborts and surfaces a clear
error in cron.log. **This is enforced in `scripts/scrape_autotrader.py`
itself, not just at runtime.**

## Open questions

1. **Does Ian's Apify token have free credits available?** Apify gives
   $5/mo free tier on signup. If yes, first month is essentially
   free.
2. **Do we want to filter by location radius from Ottawa** (to halve
   the listing count) or **sweep all-Canada** (for true cross-source
   matching against Kijiji which is national)? Default: all-Canada,
   filter at UI layer.
3. **Daily sweep cadence** (~$6-12/mo) vs **3×/week sweep** (~$3-5/mo
   on a 2-3 day refresh cycle)? Default: daily, swap if spend trends
   toward cap.

These are answered before Phase F1 runs. Currently leaning all-Canada
+ daily.
