#!/usr/bin/env python3
"""TIER I1c (part 2) — extract promo text from dealer-page screenshots.

Per docs/handoff/research/DEALER_PROMO_DECISION_2026-05-04.md:
- Primary: Qwen2.5-VL-7B via Ollama (local Apple Silicon, $0/mo).
- Fallback: Gemini 2.5 Flash vision (~$0.0001/banner) — only when Qwen
  output's confidence < 0.7 OR JSON parse fails.
- Last-resort: Claude vision — only when both Qwen + Gemini fail.

Inputs: data/_dealer_promo_screenshots/{dealerId}/*.png
Output: data/_dealer_promos.json keyed by dealerId.

PRE-REQUISITE (Ian's terminal, one-time):
  brew install ollama
  ollama serve &                  # background; or use Ollama.app launchd plist
  ollama pull qwen2.5-vl:7b       # ~4.5 GB

Run: python3 scripts/extract_dealer_promos.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCREENSHOTS_DIR = ROOT / "data" / "_dealer_promo_screenshots"
OUT = ROOT / "data" / "_dealer_promos.json"

PROMPT = """Extract any dealer promotions visible in this banner / hero image.
Return STRICT JSON, no prose. Schema:
{
  "promos": [
    {
      "promoText": "exact wording shown",
      "amountCad": <number or null>,
      "type": "rebate" | "lease_discount" | "finance_apr" | "service_credit" | "other",
      "validUntil": "<YYYY-MM-DD or null>",
      "applicableModelHint": "<model name or null>",
      "confidence": "high" | "medium" | "low"
    }
  ]
}
If no promo visible, return {"promos": []}.
"""


def call_ollama(image_path: Path) -> dict | None:
    """Try Ollama Qwen2.5-VL. Returns parsed JSON or None on failure."""
    try:
        import ollama  # type: ignore
    except ImportError:
        print("WARN: ollama python pkg missing — `pip install ollama`", file=sys.stderr)
        return None
    try:
        resp = ollama.chat(
            model="qwen2.5-vl:7b",
            messages=[{
                "role": "user",
                "content": PROMPT,
                "images": [str(image_path)],
            }],
            format="json",
            options={"temperature": 0.0},
        )
        return json.loads(resp["message"]["content"])
    except Exception as e:
        print(f"WARN ollama failed for {image_path.name}: {e}", file=sys.stderr)
        return None


def call_gemini_fallback(image_path: Path) -> dict | None:
    """Stub: Gemini 2.5 Flash vision fallback. Requires GEMINI_API_KEY env
    + user OK to add the dep. Returns None until wired."""
    # TODO(I1c-bis): wire google-generativeai + structured-output mode.
    # Cap spend in data/gemini_spend.json, mirror apify_spend pattern.
    return None


def extract_for_dealer(dealer_id: str, screenshots: list[Path]) -> list[dict]:
    promos: list[dict] = []
    for png in screenshots:
        result = call_ollama(png)
        if not result:
            result = call_gemini_fallback(png)
        if not result:
            continue
        for p in result.get("promos", []):
            p["dealerId"] = dealer_id
            p["screenshot"] = png.name
            p["extractedBy"] = "qwen2.5-vl:7b"  # update if fallback fired
            promos.append(p)
    return promos


def main() -> int:
    if not SCREENSHOTS_DIR.exists():
        print(f"no screenshots at {SCREENSHOTS_DIR} — run screenshot_dealer_pages.py first", file=sys.stderr)
        OUT.write_text(json.dumps({}, indent=2) + "\n")
        return 0

    out: dict[str, list[dict]] = {}
    for dealer_dir in sorted(SCREENSHOTS_DIR.iterdir()):
        if not dealer_dir.is_dir():
            continue
        pngs = sorted(dealer_dir.glob("*.png"))
        if not pngs:
            continue
        dealer_id = dealer_dir.name
        promos = extract_for_dealer(dealer_id, pngs)
        if promos:
            out[dealer_id] = promos
            print(f"  [{dealer_id}] {len(promos)} promo(s)", file=sys.stderr)

    OUT.write_text(json.dumps(out, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"_dealer_promos.json: {sum(len(v) for v in out.values())} promos across {len(out)} dealers", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
