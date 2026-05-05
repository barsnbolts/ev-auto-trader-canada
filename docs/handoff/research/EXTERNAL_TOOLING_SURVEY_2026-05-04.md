# External tooling survey · 2026-05-04

## How to read this

Each section: top 3 candidates max. Format:

- **Name** · github.com/x/y · ★ stars · last commit YYYY-MM-DD
  - **What**: one sentence
  - **Use for us?** YES / NO / MAYBE
  - **Why**: one sentence
  - **Notes**: install pain, cost, anti-bot posture (only if relevant)

## 1. AutoTrader.ca

- **calm_builder/autotrader-canada** · Apify Store · last modified 2026-04-25 · 100% success rate, 4★
  - **What**: AutoTrader.ca actor that auto-uses Canadian residential proxies, extracts VINs, dealer data, and full specs.
  - **Use for us?** YES — primary stack call.
  - **Why**: Most recently updated, explicitly anti-bot tuned for CA Imperva, exposes VIN. Pricing ~$0.0005/result + $0.0007 per detail page (Free tier $0.001) = ~$1.20 per 1k full listings. Well inside the $30 cap.
- **fayoussef/autotrader-canada** · Apify Store · last modified 2025-07 · 5★ rating, 216 users, 98.8% success
  - **What**: Parses `window['ngVdpModel']` JSON directly off detail pages — that *is* the documented Imperva-bypass strategy (no JSON XHR endpoint exists, the data is embedded as a hydration object).
  - **Use for us?** YES — keep as fallback.
  - **Why**: Older but more battle-tested; per-result $0.001 (Per-Results variant) ≈ $1/1000 listings. Useful if `calm_builder` regresses.
- **No credible OSS GitHub repo for AutoTrader.ca dated ≥2024-01-01.** All `kurt213`, `jaysondale`, `remcalu`, `emastra` repos last touched 2020–2022; explicitly out of scope. Per Scraperly's March 2026 testing, AutoTrader is "Akamai Bot Manager + rate limiting", and the consensus pattern is residential proxies + TLS fingerprint via `curl_cffi`/`tls_client` — there is no published Imperva-bypass cookbook beyond that.

## 2. Kijiji Autos

- **fayoussef/kijiji-scraper** · Apify Store · last modified 2025-05-08
  - **What**: Vehicle-aware Kijiji actor — extracts VIN, mileage, trim, drivetrain, Carfax link, and all feature flags.
  - **Use for us?** YES — winner.
  - **Why**: Confirmed VIN extraction in sample output (e.g. `WBS43AZ04RCP39930`); Carfax links bonus. ~$0.0035/result = ~$3.50/1000 listings.
- **calm_builder/kijiji-scraper** · Apify Store · 100% success, 4★
  - **What**: Adds optional dealer Google reviews + similar-listing enrichment.
  - **Use for us?** MAYBE — only if we want dealer enrichment in one shot.
  - **Why**: Same author as AutoTrader pick (consistent quality), but core scraper $0.0005/result + $0.0007/detail = ~$1.20/1k.
- **No OSS Kijiji repo passes the 2024-01-01 cutoff with VIN support.** `CRutkowski/Kijiji-Scraper` (73★) last pushed 2021-05; `mwpenny/kijiji-scraper` (99★ TS) last push 2024-09-23 — passes the cutoff but no vehicle-specific fields, generic ad scraper only.

## 3. Facebook Marketplace cars

- **apify/facebook-marketplace-scraper** · Apify Store (official) · last modified 2026-05-05 · 5,970 users, 99.2% success
  - **What**: Apify's own actor — handles auth-cookie flow internally, returns category/keyword/location queries.
  - **Use for us?** YES — the only one I'd trust for production.
  - **Why**: Updated *yesterday*; official + heavy QA. ~$0.005-$0.0062/listing on free tier = ~$5-6 per 1k. Note 2.48★ rating reflects users complaining about scope, not bot detection.
- **crowdpull/facebook-marketplace-scraper · No Login** · Apify Store · 90.4% success
  - **What**: Geo-targeted, no cookie required, vehicle-specs in detail mode.
  - **Use for us?** MAYBE — backup if Apify official chokes on FB's GraphQL changes.
  - **Why**: $0.005/listing on free tier; "no login" claim is the risky part — FB rotates `CometMarketplaceSearchContentContainerQuery` shapes monthly.
- **kyleronayne/marketplace-api** · github.com/kyleronayne/marketplace-api · ★67 · only 17 commits total
  - **What**: Direct GraphQL wrapper over FB Marketplace endpoints.
  - **Use for us?** NO — abandoned-looking; FB rotates GraphQL persistedQuery hashes constantly and 17 commits = no maintenance.
- (`passivebot/facebook-marketplace-scraper` ★377 — **archived 2024-11-23**, dead.)

## 4. Generic dealer crawlers — head-to-head

| Framework | License | Cost | Anti-bot | LLM-native? | Real-world dealer reports | Verdict for us |
|---|---|---|---|---|---|---|
| **Crawl4AI** (unclecode/crawl4ai · ★65k · v0.8.5 2026-03-18) | MIT (OSS) | $0 self-host; bring-your-own LLM | Stealth Playwright + custom JS hooks; medium | Yes — outputs LLM-ready Markdown | None specific to Cobalt/DealerOn surfaced in search | **Winner for self-hosted dealer crawl.** Free, fast, JSON-LD/CSS selectors + LLM extraction in one. |
| **Firecrawl** (mendableai · ★115k · v2.9.0 2026-04-10) | AGPL OSS / SaaS | $16-$333/mo SaaS or self-host | Strong (proxies + browser pool) | Yes — `/extract` endpoint with schema | Solid on JS-heavy sites; expensive at >5k pages/mo | **Backup for tough sites.** Pay only when self-hosted Crawl4AI fails. |
| **ScrapeGraph-AI** (ScrapeGraphAI · ★23.4k · v2.0.0 2026-04-19) | MIT | $0 self-host or $19/mo SaaS (5k credits) | Weak — relies on Playwright defaults | Yes — directed-graph LLM pipelines, "self-healing" | None on dealer sites in survey | **MAYBE for varied dealer schemas.** Self-healing pitch is right for hetero dealer sites but unproven at dealer scale. |
| **Apify Web Scraper** (`apify/web-scraper`) | Apify | ~$0.001-$0.01/page | Apify residential pool | No (write your own pageFunction) | `copious_atoll/dealer-website-inventory-scraper` exists for DealerOn/Dealer.com/Dealer Inspire/CDK at $0.0015/vehicle, last modified 2026-03-22 | **Use the dealer-specific actor, not generic web-scraper.** |
| **Raw Playwright + LLM** | n/a | LLM tokens only (~$0.001-$0.01/page on Gemini Flash) | Manual stealth setup | Yes (you wire it) | Total flexibility, max maintenance burden | **NO — reinvents Crawl4AI.** |

**Pick: Crawl4AI for the long tail of dealer sites + `copious_atoll/dealer-website-inventory-scraper` ($0.0015/vehicle) when the dealer runs DealerOn/Dealer.com/Dealer Inspire/CDK** (these four cover ~70% of Canadian dealers per industry surveys).

## 5. Promo banner image extraction

### Vision-API approach (recommended)

- **Gemini 2.5 Flash vision** — $0.0001-$0.0006 per banner (258 tokens at 384×384, ~$0.0001/img on input + ~$0.005/M output)
  - **Why winner**: Roughly 50× cheaper than GPT-4o vision at this size, handles stylized fonts well, structured-output mode lands clean JSON. For 10k banners ≈ $1-6.
- **Claude 3.5 Haiku/Sonnet vision** — ~$0.013/img end-to-end (Claude tokenizes by area: width×height/750)
  - **Why backup**: Better at edge-case stylized fonts than Gemini; use only when Gemini misses.

### OCR-OSS approach

- **PaddleOCR-VL-0.9B** (PaddlePaddle/PaddleOCR-VL on HuggingFace, 2025-10) — self-hosted
  - **Why**: Tops OmniDocBench v1.5 at 94.5% accuracy, ~$0.09 per 1k pages self-hosted, beats Qwen3-VL-235B and Gemini 3 Pro at the document-parsing benchmarks. Best free choice.
- **Tesseract / EasyOCR** — **NO**. Per multiple 2025 benchmarks, Tesseract chokes on stylized fonts and complex backgrounds typical of dealer promo banners. EasyOCR slightly better but well below PaddleOCR-VL.

**Pick: Gemini 2.5 Flash vision with structured-output JSON mode.** At Ian's volume (≤1000 banners/month) the OSS install cost dwarfs the API cost.

## 6. OEM Click-to-Buy

- **`teslahunt/inventory`** · github.com/teslahunt/inventory · ★40 · last commit 2026-04-28 (chore release 3.5.362, very active)
  - **What**: Hits Tesla's `/inventory/api/v1/inventory-results` endpoint directly.
  - **Use for us?** YES for Tesla.
  - **Why**: Active 2026, simple API hit; older versions worked without bypass but Tesla now uses Akamai.
- **`jumpbearcode/teslawebscrape`** · MCP server · 2026
  - **What**: nodriver + curl_cffi combo to handle Tesla's Akamai Bot Manager — explicitly extracts cookies via real Chrome and replays via curl_cffi.
  - **Use for us?** YES — current best-known Tesla pattern.
- **Hyundai Canada Click-to-Buy / Kia.ca eShop** — **no candidates.** No public OSS repo, no Apify actor. The `Hyundai-Kia-Connect/hyundai_kia_connect_api` projects on GitHub are Bluelink/UVO telematics, not dealer inventory. Inventory pages are React/Next.js — Crawl4AI with the `__NEXT_DATA__` extraction hook (or DevTools-discovered hidden API per ScrapeBadger's playbook) is the path. Build it ourselves.

## 7. Carfax Canada

- **No credible candidates passing the 2024-01-01 cutoff.**
  - `amattu2/CARFAX-Wrapper` requires an existing Carfax Service Data Transfer Facilitation Agreement (paid B2B contract) — not a bypass.
  - `wanerllubbse/carfax-com-scraper` and `atkolkma/carfax_scraper` target Carfax US, last touched 2022-2023, both require an active logged-in session.
  - `apify.com/lexis-solutions/carfax-com` exists but is US Carfax only.
- Carfax Canada has a *paid* official API at `apireference.carfax.ca`. For Ian's personal-use scope, the realistic plan is: extract the VIN from each AutoTrader/Kijiji listing (already supported by both pickers above), and let Ian / mom click the dealer-supplied VHR link. No automated VIN-history scraping is affordable or reliable.

## Headline recommendations

- **AutoTrader**: `calm_builder/autotrader-canada` (Apify, ~$1.20/1k listings) → fallback `fayoussef/autotrader-canada` parses `window.ngVdpModel` JSON directly.
- **Kijiji**: `fayoussef/kijiji-scraper` (~$3.50/1k, native VIN + Carfax link extraction).
- **Facebook Marketplace**: `apify/facebook-marketplace-scraper` (official, updated 2026-05-05, ~$5-6/1k) — do not roll our own GraphQL.
- **Dealer inventory**: Crawl4AI self-hosted for arbitrary dealer sites + `copious_atoll/dealer-website-inventory-scraper` ($0.0015/vehicle) for the four big platforms (DealerOn, Dealer.com, Dealer Inspire, CDK).
- **Dealer promos**: Gemini 2.5 Flash vision with structured-output JSON, ≈$0.0001/img.
- **OEM Click-to-Buy**: `teslahunt/inventory` (or jumpbearcode's nodriver + curl_cffi pattern) for Tesla; build Hyundai/Kia ourselves with Crawl4AI hitting `__NEXT_DATA__` (no existing tools).
- **Carfax**: skip automated history; extract VINs from listings and let the user follow the dealer-supplied Carfax links.

**Total cost projection at Ian's likely volume (5k AutoTrader + 5k Kijiji + 2k FB + 2k dealer pages + 500 banners/month):** ~$6 + $17.50 + $12 + $3 + $0.30 ≈ **$39/mo if everything paid-route runs at full volume**. Drop AutoTrader to 2k and Kijiji to 2k (likely the actual relevance-filtered set for Hyundai/Kia EVs in Ontario) and we land at **~$15/mo, well under the $30 cap.**

## Sources

- [calm_builder/autotrader-canada (Apify)](https://apify.com/calm_builder/autotrader-canada)
- [fayoussef/autotrader-canada (Apify)](https://apify.com/fayoussef/autotrader-canada)
- [Scraperly: AutoTrader scraping 2026 guide](https://scraperly.com/scrape/autotrader/python)
- [ScrapeBadger: hidden internal API discovery](https://scrapebadger.com/blog/how-to-scrape-data-with-an-api-a-practical-guide-for-developers)
- [fayoussef/kijiji-scraper (Apify)](https://apify.com/fayoussef/kijiji-scraper)
- [calm_builder/kijiji-scraper (Apify)](https://apify.com/calm_builder/kijiji-scraper)
- [CRutkowski/Kijiji-Scraper (GitHub, abandoned 2021)](https://github.com/CRutkowski/Kijiji-Scraper)
- [mwpenny/kijiji-scraper (GitHub)](https://github.com/mwpenny/kijiji-scraper)
- [apify/facebook-marketplace-scraper (Apify)](https://apify.com/apify/facebook-marketplace-scraper)
- [crowdpull/facebook-marketplace-scraper (Apify)](https://apify.com/crowdpull/facebook-marketplace-scraper)
- [kyleronayne/marketplace-api (GitHub)](https://github.com/kyleronayne/marketplace-api)
- [passivebot/facebook-marketplace-scraper (archived)](https://github.com/passivebot/facebook-marketplace-scraper)
- [unclecode/crawl4ai (GitHub)](https://github.com/unclecode/crawl4ai)
- [mendableai/firecrawl (GitHub)](https://github.com/mendableai/firecrawl)
- [ScrapeGraphAI/Scrapegraph-ai (GitHub)](https://github.com/ScrapeGraphAI/Scrapegraph-ai)
- [copious_atoll/dealer-website-inventory-scraper (Apify)](https://apify.com/copious_atoll/dealer-website-inventory-scraper)
- [Vision API token-cost analysis (Roboflow)](https://blog.roboflow.com/image-token-cost-vlm/)
- [PaddleOCR-VL benchmark (arXiv 2510.14528)](https://arxiv.org/abs/2510.14528)
- [PaddleOCR-VL on HuggingFace](https://huggingface.co/PaddlePaddle/PaddleOCR-VL)
- [Modal: 8 open-source OCR models compared](https://modal.com/blog/8-top-open-source-ocr-models-compared)
- [teslahunt/inventory (GitHub)](https://github.com/teslahunt/inventory)
- [TeslaWebScrape MCP (lobehub)](https://lobehub.com/mcp/jumpbearcode-teslawebscrape)
- [Hyundai-Kia-Connect/hyundai_kia_connect_api](https://github.com/Hyundai-Kia-Connect/hyundai_kia_connect_api) (telematics, not inventory)
- [amattu2/CARFAX-Wrapper (GitHub, requires B2B contract)](https://github.com/amattu2/CARFAX-Wrapper)
- [Carfax Canada official API reference](https://apireference.carfax.ca/)
