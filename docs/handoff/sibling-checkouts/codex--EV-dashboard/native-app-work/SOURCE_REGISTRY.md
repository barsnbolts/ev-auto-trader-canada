# SOURCE_REGISTRY.md

## Source Posture

Default mode is manual refresh plus saved snapshots. The app should not aggressively monitor dealer sites.

Allowed:
- Official OEM pages and public inventory pages.
- Dealership and dealer-group pages.
- Official government incentive pages.
- Marketplace pages only as low-confidence comparison leverage.
- User-supplied ChatGPT/Gemini Deep Research CSV/JSON outputs with row-level source URLs.

Blocked:
- Login-gated sources.
- CAPTCHA-gated sources.
- Private-token APIs.
- Bypass or anti-bot circumvention.
- Rows without source URLs.
- Unclear commercial scraping.

## Current Official Anchors

- Transport Canada EVAP vehicle list: `https://tc.canada.ca/en/road-transportation/innovative-technologies/electric-vehicles/electric-vehicle-affordability-program-evap/electric-vehicle-affordability-program-vehicle-list?page=2&wbdisable=true`
- Canada ZEV incentives: `https://www.canada.ca/en/services/transport/zero-emission-vehicles/zero-emission-vehicles-incentives.html`
- Hyundai Canada IONIQ 5: `https://www.hyundaicanada.com/en/showroom/ioniq-5`
- Kia Canada: `https://www.kia.ca/`
- Gemini Deep Research help: `https://support.google.com/gemini/answer/15719111?hl=en`

## Implementation Notes

- Store source URLs on every imported listing.
- Use source-run and research-batch counts to expose freshness.
- Keep marketplace rows visible but marked lower confidence.
- Dealer/OEM evidence can be medium/high confidence depending on freshness and whether price, VIN/stock, dealer, and trim all match.
