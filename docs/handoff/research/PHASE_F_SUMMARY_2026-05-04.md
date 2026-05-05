# Phase F summary · 2026-05-04 evening (high-tier closeout)

Foundation work for medium-tier execution. Probes done where viable;
research subagent filled gaps where probes hit walls.

## What's locked in

| Source | Free-path strategy | Status | Spec doc |
|---|---|---|---|
| AutoTrader.ca | Parse `__NEXT_DATA__` SSR JSON (search + detail pages, VIN at `.vehicle.identifier.vin`) | **Probed end-to-end ✓** | AT_PROBE_CAPTURE + AT_REPLAY_SPEC |
| Kijiji Autos | Existing scraper works | **Already shipped (just needs cron-wire)** | (existing) |
| Leasebusters | Plain HTML parser per existing decision doc | **Spec done ✓** | LEASEBUSTERS_VIN_DECISION |
| Facebook Marketplace | `jdcodes1/facebook-marketplace-mcp` cookie-replay (PIVOT from Chrome MCP probe — JS-exec is permission-gated on FB) | **Pivot decided ✓** | FB_PROBE_CAPTURE + FB_MARKETPLACE_DECISION |
| Dealer inventory | Crawl4AI w/ JSON-LD-first per Apify-actor reference architecture | **Spec validated ✓ (Mac install gotchas: pin Python 3.11/3.12, bundled Chromium only)** | DEALER_INVENTORY_DECISION |
| Dealer promos | Qwen2.5-VL-7B via Ollama (PIVOT from PaddleOCR-VL — banner-aligned task fit + simpler Mac stack) | **Pivot decided ✓** | DEALER_PROMO_DECISION |

## Deferred-to-medium smoke tests

F3 (Crawl4AI install + 3-dealer smoke test) and F4 (Ollama + Qwen2.5-VL
smoke test on a dealer banner) deferred to medium tier per the "high
foundation, medium executes" rule. Mini-research subagent already
validated install paths + caveats; medium can install + smoke without
high-tier judgment.

If smoke tests fail at medium, escalate back to high.

## Live preview workflow

Set up during this session. Working at `http://localhost:3000` via
Claude Preview MCP.

- launch.json entry added (cross-project via `npm --prefix`):
  `~/Documents/Claude/Projects/EV dashboard/.claude/launch.json` →
  `ev-auto-trader-dev` config.
- Server started cleanly. Pages compile (~/, /pick-a-model, /compare,
  /inventory all returning 200).
- Screenshot verified: header + nav + dashboard intro + stat cards
  rendering as expected.

**For medium**: after each visible UI change, call
`mcp__Claude_Preview__preview_screenshot` to verify. Resize to
mobile/tablet/desktop with `preview_resize`. The preview matches the
Tauri .app visually because it's the same React + Tailwind code path.

## Headline architectural pivots vs original Phase R plan

1. **AT**: was "regex extract `window['ngVdpModel']`". Now: parse
   `__NEXT_DATA__` JSON. Cleaner, framework-standard, more robust.
2. **FB**: was "Chrome MCP GraphQL probe + Python replay". Now:
   `jdcodes1/facebook-marketplace-mcp` (FB JS-exec is permission-
   gated, can't capture via Chrome MCP).
3. **Dealer promos**: was "PaddleOCR-VL self-hosted". Now:
   Qwen2.5-VL-7B via Ollama (PaddleOCR is document-tuned, not
   banner-tuned; Apple Silicon install is fiddlier).

All three are still **free-path**. None require new paid services.

## Total ongoing spend projection (unchanged)

~$0/mo baseline. Apify/Gemini/Claude-vision fallbacks total ~$0.21/mo
worst-case if every fallback fires.

## Updated runway-table for medium-tier (TIER I0 + I1)

```
TIER I0 — daily inventory drain (~32k tokens, free path)
  I0a · Cron PATH fix (~1k)
  I0b-1 · Add VIN-keyed merge to merge_cross_sources.py (~3k)
  I0b-2 · Drop trim from fallback_key + UI disambiguation (~3k)
  I0c · Wire Kijiji + cross-merge into refresh_daily.sh (~2k)
  I0d · Leasebusters HTML parser per existing spec (~6k)
  I0e · AutoTrader scraper per AT_REPLAY_SPEC (~7k)
  I0f · End-to-end cron verification (~2k)
  I0g · Live preview after each visible change (continuous)

TIER I1 — multi-source weekly drain (~32k tokens, free path)
  I1a · jdcodes1/facebook-marketplace-mcp install + integration (~10k)
  I1b · Crawl4AI install + dealer scraper (~12k)
  I1c · Ollama + Qwen2.5-VL banner extraction + DealerPromoChip (~10k)

TIER I2 — bonus sources (opportunistic, all free)
  I2a · Carfax Canada — surface VINs as click-through links (no scrape)
  I2b · OEM Click-to-Buy (Hyundai/Kia eShop) via Crawl4AI __NEXT_DATA__ pattern
  I2c · Toronto Auto Auction wholesale feed
```

After I0 ships: inventory is genuinely fresh daily for the first time
in this project's history. Ian gets cross-source price-delta chips
+ dealer-promo callouts on every listing.

## Closing the high-tier loop

Phase R + Phase F = ~50k tokens of high-tier foundation work.
Architectural decisions captured in 7 decision docs + 2 probe docs.
Medium can now execute TIER I0 + I1 with no decision-making needed —
just follow the specs.
