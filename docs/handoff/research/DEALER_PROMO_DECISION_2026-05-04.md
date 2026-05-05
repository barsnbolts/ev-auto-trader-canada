# Dealer promo image extraction · decision · 2026-05-04 (REVISED post-R1)

## Pivot from earlier draft

Earlier draft assumed GPT-4o-vision at ~$0.02/image → ~$15/mo. **R1
survey found Gemini 2.5 Flash vision at ~$0.0001/image** — roughly
50× cheaper. The earlier user-OK gate ($15/mo recurring spend) is
now ~$0.30-1/mo. **Much smaller approval bar.**

## Architecture decision (FREE PATH PRIMARY per user 2026-05-05)

**Primary: PaddleOCR-VL-0.9B self-hosted** (HuggingFace). $0/mo.
Tops OmniDocBench v1.5 at 94.5 % accuracy, beats Qwen3-VL-235B and
Gemini 3 Pro at document-parsing benchmarks. Installs via pip; runs
locally on Ian's Mac during the weekly cron.

```bash
pip install paddleocr paddlepaddle
# First call downloads PaddleOCR-VL-0.9B weights (~1 GB).
```

**Fallback: Gemini 2.5 Flash vision API** (~$0.0001/banner). Use only
on banners where PaddleOCR-VL output's confidence < 0.7 OR
structured-output parse fails. At ~500 banners/sweep × ~5 % low-
confidence × 4 weeks = ~100 Gemini calls/mo = ~$0.01/mo. Effectively
free even as fallback.

**Last-resort fallback: Claude 3.5 Haiku/Sonnet vision** at
~$0.013/image — only invoked on the rare banners where both
PaddleOCR-VL and Gemini fail. Likely <10 calls/mo = <$0.20/mo.

**Rejected alternatives** (per R1):
- Tesseract / EasyOCR — chokes on stylized fonts and complex
  backgrounds typical of dealer promo banners.
- GPT-4o vision — 50× more expensive than Gemini.

**Why PaddleOCR-VL primary**:
- $0 ongoing cost.
- Highest accuracy in OmniDocBench v1.5 (94.5 %, beats all hosted
  vision APIs benchmarked).
- Fully local — no API key, no network roundtrip during cron, no
  per-call latency budget.
- Trade-off: ~1 GB model weights + ~30s cold-start per cron run.
  Acceptable for weekly cadence.

## Cost projection

For ~80 dealers × 2 promo pages (home + /offers) × 2-5 banners/page =
~320-800 banners per weekly sweep.

- **PaddleOCR-VL primary**: $0/mo.
- **Gemini fallback** (~5 % of banners): ~$0.01/mo.
- **Claude vision last-resort** (<10 banners/mo): ~$0.20/mo.
- **Total: ~$0.21/mo if every fallback fires.**

Practically free. No user-OK gate needed for spend; only for adding
the Gemini API key (which we may never invoke if PaddleOCR-VL is
sufficient — defer the user ask until we actually see fallback
trigger).

## Action plan

### F4 — architectural validation (~3k tokens, high-tier)

1. **Set up Gemini API access** (requires user OK + API key drop-in).
2. **Build a 1-banner smoke test** — feed a hand-grabbed PNG of a
   typical dealer promo banner ("$1500 Spring Cash" style) to Gemini
   2.5 Flash with structured-output JSON mode.
3. **Verify JSON parses cleanly** with the planned schema:
   ```typescript
   {
     promoText: string;
     amountCad?: number;
     type: "rebate" | "lease_discount" | "finance_apr" | "service_credit" | "other";
     validUntil?: string; // ISO date
     applicableModelHint?: string;
     confidence: "high" | "medium" | "low";
   }
   ```
4. **Save sample**:
   `docs/handoff/research/PROMO_GEMINI_SAMPLE_2026-05-04.json`.

### I1c — medium-tier (~10k tokens, was 15k)

Two scripts:

```python
# scripts/screenshot_dealer_pages.py
"""Playwright headless: load each dealer's home + /offers pages,
take hero-section + offers-section PNGs. Cap at 2 pages × 80
dealers × ~3-5 banner regions = ~500 PNGs/sweep.
Output: data/_dealer_promo_screenshots/{dealer-id}/{page-slug}.png
"""
...

# scripts/extract_dealer_promos.py
"""Feed PNGs to Gemini 2.5 Flash vision with structured-output JSON.
Output: data/_dealer_promos.json keyed by dealer-id.
"""
import google.generativeai as genai
import json
from pathlib import Path

genai.configure(api_key=os.environ["GEMINI_API_KEY"])
model = genai.GenerativeModel("gemini-2.5-flash")

PROMO_SCHEMA = {  # Pydantic model exported as JSON schema
    ...
}

def extract(png_path: Path) -> list[dict]:
    img = genai.upload_file(png_path)
    resp = model.generate_content(
        [img, "Extract all dealer promotions visible. Return JSON."],
        generation_config={"response_mime_type": "application/json",
                           "response_schema": PROMO_SCHEMA},
    )
    return json.loads(resp.text)
```

UI surface: new `DealerPromoChip` component on `InventoryTable` rows
when the dealer has an active promo on a matching model. Tooltip
shows full promo text + validUntil + Gemini's confidence rating.

## Cadence

**Weekly**, same as dealer-inventory sweep. Promos rotate slowly
(monthly OEM cycles); weekly capture is more than enough.

## Cost guard

`scripts/extract_dealer_promos.py` MUST track per-call cost in a new
`data/gemini_spend.json` ledger (mirror the Apify pattern). Hard-cap
at $5/mo (50× below Apify cap; we shouldn't approach this at
projected volume).

## Risks

1. **Banner OCR misses small / dark / rotated text.** Mitigation:
   confidence rating in output → low-confidence promos surface to
   user as "manual review" chips, not silently displayed.
2. **Promos expire silently.** Need a `validUntil` field or weekly
   re-sweep that flushes expired entries. Default: re-sweep wipes
   old data; UI badges promos with `validUntil < today` as expired.
3. **Gemini API outage / rate limit.** Free tier has 15 RPM, paid
   tier 1k RPM. Even 500 banners/week is 1.2 RPM avg — comfortable.

## Open questions

1. **User OK to add Gemini API as a new dependency?** Required before
   F4. (Caps at ~$1/mo so the spend ask is small.)
2. **Where does the Gemini API key live?** Environment variable
   `GEMINI_API_KEY` — Ian sets it on his Mac via `~/.zshenv`. Never
   committed to repo.
3. **Should we screenshot using Playwright or Apify's screenshot
   actor?** Default: local Playwright (free). Apify only if the cron
   environment can't run Playwright cleanly.

All three resolve before F4 runs. Question 1 is the blocking ask.
