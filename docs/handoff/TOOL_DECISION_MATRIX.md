# TOOL_DECISION_MATRIX — pick the right tool BEFORE writing scraper code

> **Read this FIRST when adding a new data source.** Choosing wrong
> burns 2-5x more tokens than choosing right. Per Ian's directive
> 2026-05-04: "always think of the best tool you have at your before
> going about doing it."

## Decision tree

```
New data source needed?
├── Does an Apify actor exist? (mcp__Apify__search-actors)
│   ├── YES, free tier covers our needs → use Apify
│   ├── YES, paid (within $30 cap) → ask user, use Apify if approved
│   └── NO → continue
├── Does a public API exist? (Exa search "<site> public API JSON")
│   ├── YES → fetch directly with stdlib + curl
│   └── NO → continue
├── Is the page server-side rendered (SSR)?
│   ├── YES with __NEXT_DATA__ / Apollo cache → curl + JSON walk
│   ├── YES with JSON-LD blocks → curl + regex JSON-LD
│   ├── YES but messy HTML only → curl + BeautifulSoup
│   └── NO (pure SPA) → continue
├── Is the data behind a login wall?
│   ├── YES → Chrome MCP with user's logged-in session (probe via
│   │        mcp__Claude_in_Chrome__read_network_requests for XHRs)
│   └── NO → Chrome MCP probe to capture XHR endpoint, then curl
└── Anti-bot wall (Imperva, Cloudflare WAF)?
    ├── Mild (UA fingerprint) → curl --http2 + browser UA
    ├── Moderate (TLS fingerprint) → Tauri WebView fetch (proxies
    │                                through WKWebView Chromium TLS)
    ├── Severe (CAPTCHA, JS challenge) → Apify actor (paid)
    └── Insurmountable → halt, document, skip
```

## Per-source assignments (locked in 2026-05-04)

| Source | Tool | Why | Status |
|---|---|---|---|
| AutoTrader.ca | Apify (`memo23/apify-autotrader-scraper`) + own `build_units_from_at.py` | SSR + Imperva on direct fetches; Apify abstracts the wall | SHIPPED (production data source) |
| Kijiji.ca | curl + `__NEXT_DATA__` Apollo walk (custom in `scrape_kijiji.py`) | SSR + structured Apollo cache + no anti-bot | SHIPPED 2026-05-04 |
| Leasebusters | Chrome MCP probe → custom curl scraper | JS-rendered SPA, XHR-driven | SKELETON — needs probe |
| Facebook Marketplace | Chrome MCP with login + GraphQL XHR + VIN-from-text | Login-walled, free-text VINs | SKELETON (deferred — login complexity) |
| Hyundai Click-to-Buy | Apify (Cloudflare-walled, custom needs WAF-bypass) | Phase D-bis — defer | DEFERRED |
| Kia D2C Media | Apify | Phase D-bis — defer | DEFERRED |
| Carfax CA | Skip | High auth + commercial use ToS | SKIPPED per Phase D0 |

## Tools available + when to reach for them

| Tool | Best for | Cost | Notes |
|---|---|---|---|
| **Apify MCP** | Sites with anti-bot, sites with maintained actors | $$ — track via `python3 scripts/track_apify_spend.py` | Cap: $30 cumulative per CLAUDE.md |
| **Chrome MCP** | Login-walled sites, JS-rendered SPAs, XHR endpoint discovery | free | Use `read_network_requests` to capture API calls |
| **Exa search** | Quick lookup of "does <site> have a public API" | free (within session limits) | Better than Google for technical content |
| **Exa fetch** | Read a URL's body when WebFetch redirects | free | Returns markdown — fine for docs |
| **WebSearch** | Stack Overflow, GitHub library research | free | US-only |
| **WebFetch** | Single-page reads when domain is known | free | 15-min cache, may redirect |
| **stdlib curl + Python** | Simple SSR sites, JSON-LD, static HTML | free, zero deps | Default choice — matches CLAUDE.md "stdlib only" |
| **Tauri WebView fetch** | TLS-fingerprint anti-bot sites | needs Rust integration | NOT yet wired (TODO in verify_unit.py) |
| **NHTSA vPIC** | VIN decoding (free-text Facebook, etc.) | free | `lib_scrape_common.nhtsa_decode(vin)` |

## Skills/plugins to consider downloading (per Ian's directive)

The user authorized: "Download any skill or plugin that you find."
Use this judiciously — don't bloat package.json or pip env. Vetted list:

### TypeScript / web side

| Lib | Why we'd add it | Status |
|---|---|---|
| `vitest` | Test runner — already pre-staged in `AUTONOMOUS_QUEUE.md` T1 | not yet installed |
| `zod-to-json-schema` | Could auto-generate Python validators from `src/lib/types.ts` for the schema-drift catcher (T3) | candidate |
| `cheerio` | Server-side jQuery-like HTML parsing in Node — not currently used; sticking with regex | rejected for scope |

### Python side

| Lib | Why we'd add it | Status |
|---|---|---|
| (nothing yet) | CLAUDE.md says stdlib only; lib_scrape_common achieves it | locked |

### MCP server installs

| MCP | Why we'd add it | Status |
|---|---|---|
| `playwright-mcp` | Headless browser when Chrome MCP unavailable | candidate (~50MB; only if Chrome breaks) |
| `mcp-apify` (already installed) | Paid scrapers | active |
| `firecrawl-mcp` | LLM-friendly scraping with auto-rendering | candidate (~free tier) |

## Self-evaluation loop (per Ian's directive)

After each scraper run, the metrics layer (`lib_scrape_metrics.py`)
records:
- listings/sec
- VIN coverage %
- check-digit pass rate
- error count
- pages walked

Medium reads `data/_scraper_metrics.jsonl` at the start of any
scraper-touching session via:

```bash
python3 scripts/lib_scrape_metrics.py kijiji 5
```

If the rolling stats show:
- `vin_pct` dropped > 10pp from prior 5 runs → upstream schema drift,
  re-probe with Chrome MCP before pushing.
- `errors > 30%` of pages → anti-bot wall, halt.
- `unique` count plateaued for 3+ runs → Kijiji listing pool stable;
  no improvement opportunity. Move on to other sources.

## Open follow-ups (separate from this commit)

These are bugs/gaps discovered while shipping the scraper refactor.
Each is independently fixable and tracked here so they don't get lost:

1. **Merge cross-sources gap.** `merge_cross_sources.py` produced
   0 entries from 165 candidates. Root cause: `data/units.json` has
   only 8/100 VINs (AutoTrader doesn't expose VIN reliably) AND the
   top-level `make` field is null on most records. Fix: augment merge
   to derive make from model (Hyundai for Ioniq*, Kia for EV* / NiroEV)
   AND build fallbackKey from model+year+trim+mileageKm. Files:
   `scripts/merge_cross_sources.py`, `src/lib/crossListings.ts`.
   Token est: ~5-8k.

2. **scrape_unit_gallery.py** still uses raw fetch (not lib_scrape_common).
   Refactor when next touched. Token est: ~2k.

3. **scrape_leasebusters.py** still uses raw fetch + skeleton parsers.
   Chrome MCP probe + lib_scrape_common refactor combined. Token est:
   ~10-15k per `CHROME_MCP_PROBE_PLAYBOOK.md`.

4. **scrape_facebook.py** is a skeleton. Login + Chrome MCP probe to
   unblock. Token est: ~25k per `scrape_facebook.py` module docstring.

5. **vin_pct metric is wonky** — current calc divides
   `vin_with_field` (post-dup-detect) by `vin_total` (pre-dup-detect),
   producing 46% when actual coverage is 100%. Move counter inside
   `parse_listings()` to track at parse time. Token est: ~2k.
