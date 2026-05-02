# REUSE_SCAN.md

## Result

No drop-in open-source Canadian Hyundai/Kia dealer-stock and incentive scraper was found in the quick public scan.

Useful adjacent work:

- `Hyundai-Kia-Connect/kia_uvo`: Home Assistant integration for Kia Connect/UVO and Hyundai Bluelink. Useful for understanding connected-car API caution and rate-limit posture, not dealer inventory.
- `Hyundai-Kia-Connect/hyundai_kia_connect_api`: Python package underneath the Home Assistant integration. Same caveat: owner/account telemetry, login-gated, not stock leverage.
- `Hacksore/bluelinky`: Node wrapper for Hyundai Bluelink/Kia UVO. Useful as a warning against overusing account APIs; not suitable for dealership inventory.
- `timofeevio/autoscout24-korean-cars-scraper-spec` gist: useful scraper-spec structure for Hyundai/Kia 2025+ URL/filter/schema thinking, but Europe/AutoScout24-specific and not directly usable for Canada.
- `dumisanimagagula/mercedes-benz-dealership-scraper`: generic Cars.com scraping/analysis example. Useful for analysis patterns only; target source and brand are wrong.

## Decision

Do not integrate connected-car libraries into this buyer dashboard. They require owner credentials and expose vehicle telemetry/control surfaces, which conflicts with the app’s dealer-stock leverage purpose.

Keep the app’s source strategy:

- Generate ChatGPT/Gemini Deep Research prompts.
- Import source-backed CSV/JSON rows.
- Preserve row-level source URLs.
- Treat marketplaces as low-confidence leverage.
- Add live adapters only after source legality/access is clear.

## Sources Checked

- `https://github.com/Hyundai-Kia-Connect`
- `https://github.com/Hyundai-Kia-Connect/kia_uvo`
- `https://github.com/Hacksore/bluelinky`
- `https://gist.github.com/timofeevio/a6c63216e41498a97806dfddf904db17`
- `https://github.com/dumisanimagagula/mercedes-benz-dealership-scraper`
