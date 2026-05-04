#!/usr/bin/env python3
"""Phase D-bis (deferred): Facebook Marketplace scraper.

STATUS: SKELETON — not runnable yet. Documents what to probe + how
the architecture should slot in once login + anti-bot story is solved.

WHY DEFERRED:
  1. FB Marketplace requires authenticated cookies for full listing
     access. Anonymous fetches return shells with no body content.
  2. FB rotates DOM class names every 1-3 weeks, so any selector-based
     scraper rots. The schema is also intentionally obfuscated (no
     stable Apollo cache like Kijiji's).
  3. FB tos prohibits automated scraping. Personal-use scope here is
     defensible; commercial would not be.
  4. VINs are NEVER in structured fields on FB. They live (when at all)
     in the free-text description. Coverage on EV listings: ~30-40%
     based on spot-check of public dealer ads.

WHAT MEDIUM SHOULD DO WHEN UNBLOCKING THIS:

Path A (recommended): use Chrome MCP with the user's existing FB login.
  1. mcp__Claude_in_Chrome__tabs_context_mcp + select_browser
  2. Navigate to:
     https://www.facebook.com/marketplace/category/vehicles/?query=hyundai%20ioniq%205
  3. Wait for hydration (5-8s; FB is slow).
  4. read_network_requests filter by "graphql" — FB uses /api/graphql/
     for marketplace queries. Look for the search_results request.
  5. Capture full JSON response body. The query name is usually
     CometMarketplaceSearchContentContainerQuery or similar.
  6. The response.data.marketplace_search.feed_units contains
     listing nodes. Each node has:
       - id (stable FB listing id)
       - listing_price.amount, listing_price.amount_with_offset_in_currency
       - location.reverse_geocode.city / state
       - story.title (often has year + make + model)
       - story.description (free text — VIN may live here)
       - primary_listing_photo.image.uri
       - seller.id, seller.name
  7. There is NO structured make/model/year/VIN — all live in title +
     description. Use these utilities from lib_scrape_common.py:
       - vins_in_text(title + ' ' + description) — strict 17-char +
         check-digit. Returns 0..N candidate VINs. If exactly 1, treat
         as authoritative VIN. If 0, build a fallbackKey from parsed
         title (regex year + make + model).
       - nhtsa_decode(vin) — if VIN found, validate via NHTSA. Cross-
         check that the decoded year/make/model match what the title
         claims. If mismatch, downgrade to fallbackKey only.

Path B (fallback if FB blocks even logged-in scraping):
  Skip FB entirely. The other sources (AutoTrader + Kijiji + Leasebusters)
  cover ~95% of EV listings already. FB is incremental; not worth
  fighting their anti-bot if it escalates.

OUTPUT SCHEMA: data/_facebook_raw.json — keyed by FB listing id.
  Same shape as data/_kijiji_raw.json but with these caveats:
    - vin: may be None (not in ad). Set None instead of inventing.
    - vinChecksumOk: validate via vin_check_digit_ok() if vin extracted.
    - vinSource: 'description-regex' | 'structured' (FB has no structured)
    - confidence: 'High' | 'Medium' | 'Low' — High if NHTSA confirms
      year+make+model matches title. Low otherwise.
    - fallbackKey: always populate from title parse.

VIN EXTRACTION FROM FREE TEXT — concrete recipe:

  from lib_scrape_common import vins_in_text, nhtsa_decode

  # Combine title + description so multi-line VINs survive.
  blob = f"{title}\\n{description}"
  candidates = vins_in_text(blob, validate=True)  # check-digit filter

  if len(candidates) == 1:
      vin = candidates[0]
      decoded = nhtsa_decode(vin)
      if decoded:
          # Cross-check: does decoded year+make+model match what
          # the listing title claims? Title parsing via regex.
          title_year = _parse_year_from_title(title)
          decoded_year = safe_int(decoded.get('ModelYear'))
          if title_year == decoded_year and \\
             decoded.get('Make', '').lower() in title.lower():
              confidence = 'High'
          else:
              confidence = 'Medium'  # VIN valid but title-mismatch
      else:
          confidence = 'Medium'  # check-digit ok, NHTSA failed
  elif len(candidates) > 1:
      # Multiple VINs in one ad = dealer ad with multiple cars.
      # Skip — too ambiguous to assign per-listing.
      vin = None
      confidence = 'Low'
  else:
      vin = None
      confidence = 'Low'

VIN HEURISTICS BY DEALER PATTERN (observed across NA marketplaces):
  - Dealers usually post VIN in a tag like "VIN: KMHKR4AF...". Plain regex catches this.
  - Private sellers rarely post VIN; if they do, they post the WHOLE VIN.
  - "Stock #" is common but it's NOT a VIN (varies by dealer).
  - Avoid extracting VIN from photos/OCR — out of scope; cost-prohibitive.

ANTI-BOT NOTES:
  FB has aggressive anti-bot. Even with logged-in cookies, hitting
  the same query > 5x/min triggers a CAPTCHA wall. Throttle 6+ s
  between fetches. If CAPTCHA appears: halt + write to handoff doc;
  don't try to bypass.
"""
from __future__ import annotations

import sys


def main() -> int:
    print("scrape_facebook.py is a skeleton — not yet implemented.", file=sys.stderr)
    print("See module docstring for unblock procedure.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
