# Facebook Marketplace MCP install · 2026-05-05 (TIER I1a)

## Status

**MCP cloned + built locally; registration deferred to Ian.**

Path: `~/.claude/mcp-servers/fb-marketplace/dist/index.js`
Source: https://github.com/jdcodes1/facebook-marketplace-mcp
Build verified: `npm install && npm run build` clean (TypeScript → dist/index.js).

## Why Ian has to do the registration

Auto-loading a 3rd-party MCP into every future Claude Code session is a
security event (self-modification + untrusted code execution). Claude
asked permission and got denied — correct outcome for an
agent-chosen repo. Ian completes registration manually.

## One-time install (Ian's terminal)

```bash
# 1. Capture FB cookies from your logged-in Chrome session.
#    (Site uses macOS Keychain — no password prompt unless OS asks.)
cd ~/.claude/mcp-servers/fb-marketplace
npm run capture-queries   # one-time GraphQL doc_id capture (runs via tsx)

# 2. Register the MCP with Claude Code.
claude mcp add facebook-marketplace -- node /Users/ianmcadam/.claude/mcp-servers/fb-marketplace/dist/index.js

# 3. Verify.
claude mcp list | grep facebook-marketplace
```

## Tools the MCP exposes (per its README)

- `search_listings(query, latitude, longitude, radius_km, min_price, max_price, limit)`
- `get_listing(listing_id)`
- `monitor_search(name, query, latitude, longitude, radius_km)`

Self rate-limits at 3 req/min — built-in courtesy throttle.

## Integration plan (TIER I1a-bis)

After registration, write `scripts/scrape_facebook.py` that:

1. Spawns the MCP as a subprocess (stdio JSON-RPC) OR more simply: a
   thin Python port of `src/facebook/client.ts` reading the same
   cookie store + posting same GraphQL.
2. Hits 6 EV queries × ON+QC+BC+AB metro centroids (24 total):
   - "hyundai ioniq 5 / 6 / 9", "kia ev6 / ev9 / niro ev"
   - lat/lng for Toronto / Montreal / Vancouver / Calgary
   - radius 100 km
3. Writes `data/_facebook_raw.json` keyed by FB listing id.
4. `merge_cross_sources.py` already handles new sources via the
   `Source` enum — add `"facebook"` to `src/lib/crossListings.ts`.
5. Wire into `refresh_weekly.sh` (NEW) — separate from
   `refresh_daily.sh` because FB cadence is weekly per
   `FB_MARKETPLACE_DECISION_2026-05-04.md`.

## Cookie lifecycle

- FB session cookies typically valid 30-90 days for active users.
- When MCP returns 401, re-run cookie capture script.
- The MCP includes a Playwright cookie-refresh script for non-Mac
  fallback; we use the macOS Keychain path here.

## Cost

$0/mo. MCP is OSS. Replays Ian's existing FB session — no Apify, no
GPT, no scraping-as-a-service.

## Re-probe trigger

If FB rotates `doc_id` query hashes (monthly), MCP returns errors.
Re-run `npm run capture-queries` to refresh hash store.

## Open question for Ian

- Are you OK to register this MCP? Claude can't auto-register
  3rd-party servers (security gate).
- Cookie capture script (`capture-queries.js`) opens a browser to
  login — already-logged-in profile makes this near-instant.
