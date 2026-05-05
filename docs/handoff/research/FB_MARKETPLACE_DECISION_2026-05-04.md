# Facebook Marketplace cars · scrape strategy · decision · 2026-05-04 (REVISED post-R1)

## Pivot from earlier draft

Earlier draft made Chrome MCP GraphQL probe primary. **R1 survey
reversed this**: the official `apify/facebook-marketplace-scraper`
actor was updated *yesterday* (2026-05-05) with 99.2 % success rate
across 5,970 monthly users. Rolling our own GraphQL replayer is
risky because FB rotates `CometMarketplaceSearchContentContainerQuery`
persistedQuery hashes monthly; the official actor is maintained
against those rotations.

## Current state

`scripts/scrape_facebook.py` is 119 lines of skeleton + careful prose
plan. STATUS comment is explicit: "not runnable yet." The skeleton
documented a Chrome-MCP-with-Ian's-FB-login path that we're now
abandoning in favor of the actor.

## Architecture decision (REVISED post-F2 probe — was free path, now NOT VIABLE as written)

**Original "Chrome MCP probe + Python replay" approach is NOT
VIABLE.** F2 probe found that `mcp__Claude_in_Chrome__javascript_tool`
calls to `www.facebook.com` return `permission_required`. The
GraphQL capture-hook pattern (install `window.fetch` monkey-patch
via JS exec) is therefore blocked. See
`FB_PROBE_CAPTURE_2026-05-04.md` for the F2 findings.

**REVISED RECOMMENDATION (post-Q3 research 2026-05-05): use
`jdcodes1/facebook-marketplace-mcp` — purpose-built MCP that
replays FB GraphQL via macOS-extracted Chrome cookies. Self
rate-limits 3 req/min. Updates `doc_id` via included Playwright
capture script when FB rotates. No Chrome extension dependency, no
Apify spend, no Tampermonkey ceremony.** This is the actual free
path that works.

Repo: https://github.com/jdcodes1/facebook-marketplace-mcp

Install (medium-tier I1a):
```bash
git clone https://github.com/jdcodes1/facebook-marketplace-mcp \
  ~/.claude/mcp-servers/fb-marketplace
cd ~/.claude/mcp-servers/fb-marketplace
pip install -r requirements.txt
# Configure via Claude Code MCP config to add it.
# Run included cookie-capture script once on Ian's Mac:
python scripts/capture_cookies.py
```

Wraps as a Claude MCP. We then use it from Python via
subprocess/cli, OR call the MCP from any Claude session. Either way
this becomes the FB scrape source — no longer deferred.

**Fallback (if jdcodes1 MCP regresses)**: TIER I2 deferral, OR Apify
`apify/facebook-marketplace-scraper` (~$6-7/mo, paid) per original
R1 finding.


AT + Kijiji together cover ~95 % of dealer-level Hyundai/Kia EV
inventory in Canada — FB's marginal value is private-seller used
cars below market, narrower-but-real but not blocking.

**When/if FB is wanted, three options exist** (full discussion in
F2 capture doc):
- **Option A**: `apify/facebook-marketplace-scraper` (~$6-7/mo)
  — easiest, paid.
- **Option B**: Chrome-MCP-driven runtime scrape using `find` tool
  (no JS exec needed) — free but needs Mac+Chrome+MCP at cron time.
- **Option C**: Manual periodic capture page (~5min Ian-time/week)
  — free, low-friction tech, high user-friction.

**User-OK gate** required before shipping any of A/B/C. See F2 doc
for the question to ask.

**Rejected alternatives** (per R1):
- `kyleronayne/marketplace-api` — abandoned pattern.
- `passivebot/facebook-marketplace-scraper` — archived 2024-11-23.

### Why free-path is plausible despite credential lifecycle

- FB cookies typically valid 30-90 days for active users (Ian uses
  FB regularly).
- Re-probe is ~10 min of high-tier work, scheduled when 401s appear.
- Apify fallback is ALWAYS available as graceful degradation —
  weekly cadence means a 1-week stale result is acceptable while we
  schedule a re-probe.
- The persistedQuery hash rotation that Apify's authors fight for us
  monthly is a real burden — but for personal-use volume, we only
  need to re-probe when the replayer breaks (typically every 1-2
  months), not preemptively.

## Cost projection

For Hyundai/Kia EV searches across multiple cities + regions:
- 6 query strings × ~50 results each = ~300 listings/sweep.
- $0.005 × 300 = $1.50/sweep.
- Daily sweep = $45/mo — **OVER THE $30 CAP** at this volume.
- 2-3 sweeps/week = $13-22/mo — comfortable.
- Cap-friendly cadence: weekly = ~$6/mo.

**Recommendation: weekly cadence** (Sundays, before the new-week
shopping cycle). FB Marketplace listings are sticky for weeks; daily
refresh adds noise without value.

## Action plan

### F2 — high-tier Chrome MCP GraphQL probe (~5-7k tokens)

1. **Pair Chrome** (already paired as Browser 1, Ian's FB session).
2. **Tab + capture hook**.
3. **Navigate** to FB Marketplace EVs query:
   `https://www.facebook.com/marketplace/category/electric-vehicles?query=hyundai%20ioniq%205`
4. **Wait** 6s for hydration.
5. **Trigger infinite scroll** (3-5 viewport heights down) to fire
   pagination XHRs.
6. **Filter captures** for URLs containing `/api/graphql/` and
   query name containing `Marketplace`.
7. **Capture full body** of the winning XHR:
   - URL + headers (esp. `cookie`, `x-fb-friendly-name`, `fb_dtsg`)
   - Request body (POST form-encoded, GraphQL `variables` JSON)
   - Response shape (esp. `feed_units[*].listing`)
8. **Save raw**:
   `docs/handoff/research/FB_GRAPHQL_CAPTURE_2026-05-04.json`
9. **Save replayer spec**:
   `docs/handoff/research/FB_REPLAY_SPEC_2026-05-04.md` —
   document `categoryIDs`, `latitude`/`longitude`, `radius`, `query`,
   pagination cursor (likely base64), response feed_units schema.

### I1a — medium-tier free-path replayer (~7k tokens)

```python
# scripts/scrape_facebook.py — replaces existing skeleton
"""Weekly FB Marketplace scrape via captured GraphQL replay.

Reads captured cookie + fb_dtsg from .env (set by user once after
each Chrome MCP probe; rotates ~30-90 days).

If 401 (credentials expired), exits 2. cron picks up the exit code
and either calls apify fallback OR pings the user to schedule a
re-probe.
"""
import json
import os
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "_facebook_raw.json"
GRAPHQL_ENDPOINT = "https://www.facebook.com/api/graphql/"

QUERIES = [
    "hyundai ioniq 5",
    "hyundai ioniq 6",
    "hyundai ioniq 9",
    "kia ev6",
    "kia ev9",
    "kia niro ev",
]

def fetch_page(query: str, cursor: str | None) -> dict | None:
    fb_dtsg = os.environ.get("FB_DTSG")
    cookie = os.environ.get("FB_COOKIE")
    if not (fb_dtsg and cookie):
        raise RuntimeError("Missing FB_DTSG or FB_COOKIE env vars; re-run probe")
    headers = {
        "Cookie": cookie,
        "x-fb-friendly-name": "CommerceMarketplaceSearchContentContainerQuery",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (Macintosh; ...) Chrome/124.0",
    }
    body = build_graphql_body(query, cursor, fb_dtsg)
    r = requests.post(GRAPHQL_ENDPOINT, headers=headers, data=body, timeout=15)
    if r.status_code == 401:
        return None  # caller exits 2
    return r.json()

def main():
    # 1. For each query: paginate via cursor, parse feed_units.
    # 2. Sleep 5s between requests.
    # 3. On 401: write OUT with whatever we have, exit 2.
    ...
```

Apify-fallback wrapper (only invoked when free path 401s):

```python
# scripts/scrape_facebook_apify_fallback.py
"""Emergency fallback: pulls FB data via apify/facebook-marketplace-scraper.
Records cost via track_apify_spend.py."""
...
```

Cron in `refresh_weekly.sh`:
```bash
python3 scripts/scrape_facebook.py
if [ $? -eq 2 ]; then
    python3 scripts/scrape_facebook_apify_fallback.py
    echo "FB CREDS EXPIRED — schedule re-probe in next high-tier session"
fi
```

`merge_cross_sources.py` adds `facebook` as a 4th source. New `Source`
enum entry in `src/lib/crossListings.ts` → `"facebook"`.

`refresh_daily.sh` does NOT call this — it's weekly. Either:
- Separate `refresh_weekly.sh` invoked from a separate launchd job, or
- A `if [ $(date +%u) = 7 ]; then python3 scripts/scrape_facebook.py; fi`
  guard inside the daily script.

Default: separate weekly script (clearer responsibility split).

## Risks specific to FB

1. **Auth-cookie management is the Apify actor's problem now.** We
   don't expose Ian's FB credentials at all.
2. **Schema rotation** — Apify maintains the actor against FB's
   monthly persistedQuery rotations. We get this for free.
3. **TOS gray area** — Apify has its own legal posture; for personal-
   use shopping research purposes this is fine.
4. **Volume cap risk** — see cost projection above. If Ian wants
   daily, we either drop FB or negotiate an Apify spend bump above $30.

## Open questions

1. **Does the actor expose VIN?** Likely not for private sellers
   (most FB Marketplace cars are private). Resolved at F2.
2. **Does the actor return seller type (private vs dealer)?** Critical
   for cross-source dedup — dealer FB listings may also appear on AT.
3. **Geographic filtering precision** — does the actor honor a true
   km-radius or only a fuzzy city match?

All three resolve in F2.
