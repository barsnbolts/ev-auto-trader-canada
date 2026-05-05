# Dealer-website inventory scrape · decision · 2026-05-04

## Architecture decision (FREE PATH PRIMARY per user 2026-05-05)

**Primary: Crawl4AI** (unclecode/crawl4ai · ★65k · MIT · v0.8.5
from 2026-03-18) for ALL dealer sites including the 4 big
platforms. $0/mo. Self-hosted Playwright + JSON-LD/CSS-selector +
LLM-extraction.

Pip install:
```bash
pip install -U crawl4ai
crawl4ai-setup  # downloads stealth Chromium + warms LLM extractors
```

Per-dealer template-detection lets us tune CSS selectors once per
platform and reuse:
- **DealerOn / Dealer.com / Dealer Inspire / CDK**: predictable
  inventory routes (`/inventory/`, `/used-vehicles/`, etc.) +
  consistent JSON-LD schema. Crawl4AI's structured-extraction + a
  4-template lookup handles all 4 big platforms in one pass.
- **Long-tail Cobalt / custom**: Crawl4AI's LLM-extraction mode (uses
  local Ollama or — if none — falls through to a captured manual
  template per dealer).

**Fallback: `copious_atoll/dealer-website-inventory-scraper` Apify
actor** ($0.0015/vehicle). Use only if Crawl4AI fails on >20 % of
the 4 big-platform dealers AND we can't fix it in a high-tier session
within 1 week.

**Why free-path is plausible**:
- Dealer sites are usually NOT bot-protected (Imperva/Akamai
  expensive for individual dealers; OEMs require dealers to be
  scraper-friendly for inventory feeds).
- Crawl4AI's stealth Playwright handles the few that do put up
  Cloudflare.
- Worst-case dealer = manual selector tuning, ~10 min/dealer × 5-10
  problem dealers = ~1 hour one-time setup.

## Cost projection

Approximate Canadian Hyundai/Kia dealer count: ~80.
Inventory per dealer: ~5-30 EVs.
Total vehicles per sweep: ~800-1,500.

**Free-path baseline: $0/mo.** Compute cost = local Mac during weekly
cron. No cap impact.

**Apify-fallback (only if Crawl4AI regresses)**: $0.0015 × ~1,000 ×
70 % covered = ~$1.05/sweep × 4 weeks = ~$4/mo. Stays well under
$30 cap.

## Action plan

### F3 — architectural validation (~3k tokens, high-tier)

This was not in the original Phase F. Adding it post-R1.

1. **Read Apify actor input schema** for
   `copious_atoll/dealer-website-inventory-scraper`. Document expected
   shape (probably a list of dealer site URLs, plus filter params).
2. **Inspect `data/dealers.json`** to see what dealer URLs we have
   today. Verify the schema captures the URL.
3. **Pick 3 representative dealers** for a smoke test:
   - One DealerOn-platform dealer (Track A test)
   - One arbitrary Cobalt-template dealer (Track B test)
   - One that we can't immediately classify (boundary case)
4. **Smoke test Apify actor** on the DealerOn dealer (1 vehicle, ~$0.0015).
5. **Smoke test Crawl4AI install** locally on the Cobalt dealer.
   Verify it returns structured output that can be normalized to our
   schema.
6. **Save samples**:
   - `docs/handoff/research/DEALER_APIFY_SAMPLE_2026-05-04.json`
   - `docs/handoff/research/DEALER_CRAWL4AI_SAMPLE_2026-05-04.md`

### I1b — medium-tier wrapper (~10k tokens, was 12k)

Two scripts:

```python
# scripts/scrape_dealers_apify.py
"""Apify actor pass for the 4 big dealer platforms (DealerOn,
Dealer.com, Dealer Inspire, CDK). Reads platform tags from
data/dealers.json, dispatches per-dealer."""
...

# scripts/scrape_dealers_crawl4ai.py
"""Crawl4AI pass for the long tail. Reads non-platform-tagged dealers
from data/dealers.json, runs Crawl4AI per dealer, normalizes output."""
...
```

Both write to the same `data/_dealers_raw.json` (NEW). Schema mirrors
AT/Kijiji: year/make/model/trim/priceCad/dealerName/dealerUrl/etc.

Schema gap: `data/dealers.json` may not have a `platform` tag today.
Need to either:
- Hand-curate the platform tag for the 80 dealers (~30 min one-time
  work), or
- Auto-detect platform via response signature (DealerOn injects
  `dealer-on` in DOM; etc.) — requires a one-time classifier run.

Default: auto-detect (more robust to dealer platform migrations).

### I1b-classifier — auxiliary script

```python
# scripts/classify_dealer_platforms.py
"""One-time + weekly: detect platform per dealer (DealerOn / Dealer.com /
Dealer Inspire / CDK / OTHER). Updates data/dealers.json with
platform tag + last-classified date."""
...
```

Runs weekly (cheap, $0). New `platform` field in `dealers.json` schema
(optional, validated by `validate_data_schemas.py` against the enum
{`dealeron`, `dealercom`, `dealerinspire`, `cdk`, `other`}).

## Cadence

**Weekly** (not daily). Dealer inventory turns over slowly relative to
AT/Kijiji marketplace; weekly sweep is sufficient for shopping
purposes.

## Cross-source merge implications

Adds `dealer_inventory` as a 5th source in `src/lib/crossListings.ts`.
Each dealer listing carries `dealerName` + `dealerUrl` so the cross-
source chip can show "$X at AutoTrader, $Y direct from dealer site
(no markup)."

Direct-from-dealer listings often have **lower prices** than the
AT/Kijiji syndication (no listing fee markup). This is a high-value
signal for Ian's negotiation.

## Risks

1. **Crawl4AI output quality varies per dealer.** Some sites are
   custom-templated and won't yield clean structured output without
   per-dealer CSS selectors. Mitigation: use Crawl4AI's
   LLM-extraction mode with a strict schema; accept that maybe 5-10
   long-tail dealers will fail and need hand-tuning later.
2. **Apify actor may not cover all 4 big platforms equally well.**
   Resolved at F3 smoke test.
3. **Classifier accuracy** — auto-detecting platform is heuristic.
   Mitigation: log "low confidence" dealers, surface to user for
   manual tagging.

## Open questions

1. Does Ian want to sweep ALL Canadian Hyundai/Kia dealers, or just
   Ontario-radius? Default: all-Canada (matches AT/Kijiji scope).
2. Do we already have all 80 dealer URLs in `data/dealers.json`?
   Verified at F3.
3. Crawl4AI vs Firecrawl SaaS — Crawl4AI free wins on cost, but
   Firecrawl SaaS at $16/mo handles tougher sites. Default: Crawl4AI.
   Switch only if >20 % of long-tail dealers fail.
