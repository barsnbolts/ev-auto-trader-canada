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

- Transport Canada EVAP program: `https://tc.canada.ca/en/road-transportation/innovative-technologies/electric-vehicles/electric-vehicle-affordability-program`
- Transport Canada EVAP vehicle list: `https://tc.canada.ca/en/road-transportation/innovative-technologies/electric-vehicles/electric-vehicle-affordability-program-evap/electric-vehicle-affordability-program-vehicle-list`
- Transport Canada closed iZEV reference: `https://tc.canada.ca/en/road-transportation/innovative-technologies/electric-vehicles/incentives-zero-emission-vehicles-izev`
- Canada ZEV incentives: `https://www.canada.ca/en/services/transport/zero-emission-vehicles/zero-emission-vehicles-incentives.html`
- Hyundai Canada EV rebates: `https://www.hyundaicanada.com/en/evhub/incentives`
- Hyundai Canada IONIQ 5: `https://www.hyundaicanada.com/en/showroom/ioniq-5`
- Kia Canada: `https://www.kia.ca/`
- Downtown Hyundai 2026 IONIQ 5 inventory example: `https://www.downtownhyundai.com/inventory/2026-hyundai-ioniq-5-preferred-Gpy5Id8mR0iZKwOoJa3yQQvdp/`
- Mississauga Hyundai 2026 Tucson Hybrid print page: `https://www.mississaugahyundai.com/vehicles/2026/hyundai/tucson-hybrid/mississauga/on/68549715/print`
- Mississauga Hyundai 2026 Tucson PHEV print page: `https://www.mississaugahyundai.com/vehicles/2026/hyundai/tucson-plug-in-hybrid/mississauga/on/68348817/print`
- 401 Dixie Kia 2025 Sportage PHEV catalog page: `https://www.401dixiekia.com/en/new-catalog/kia/2024-kia-sportage-phev-ex%20premium-id26554`
- Gemini Deep Research help: `https://support.google.com/gemini/answer/15719111?hl=en`

## Official Incentive Re-Verification

Re-verified on 2026-05-01 against official government/OEM pages:

- Transport Canada iZEV is closed and reference-only; do not use old iZEV eligibility as a live incentive.
- Transport Canada EVAP is the current federal light-duty EV incentive program. The EVAP page says Canadians can benefit as of 2026-02-16 and reports $2.275B remaining as of 2026-04-01.
- EVAP vehicle-list rows for in-scope Hyundai/Kia include 2025-2026 Hyundai Kona EV, 2025 Kia EV6 Light RWD, 2025-2026 Kia Niro EV, 2025-2026 Kia Niro PHEV, 2026 Kia EV4, 2026 Kia Sorento PHEV LX PHEV, and 2025-2026 Kia Sportage PHEV trims shown on the list.
- EVAP list guidance says listing is informational only; final transaction value, trim, lease term, dealer portal submission date, and funding determine the actual incentive. Treat every imported EVAP claim as "needs dealer confirmation."
- Hyundai Canada's EV rebate page also references EVAP and Hyundai special-offer bonuses, but combines federal, provincial, and OEM amounts. Keep those separate in imported notes; do not collapse them into one invented discount.
- Real-source import fixture now uses public dealer/OEM pages for Downtown Hyundai IONIQ 5, Mississauga Hyundai Tucson Hybrid/PHEV, and 401 Dixie Kia Sportage PHEV instead of `example.com` URLs.

## Implementation Notes

- Store source URLs on every imported listing.
- Use source-run and research-batch counts to expose freshness.
- Keep marketplace rows visible but marked lower confidence.
- Dealer/OEM evidence can be medium/high confidence depending on freshness and whether price, VIN/stock, dealer, and trim all match.
- Seeded incentives should only pre-match models found on official EVAP source rows or require explicit source-backed imported notes.
- Do not seed finance APR/payment offers unless a dealer/OEM page explicitly provides the APR/payment, term, fees, and expiry.
