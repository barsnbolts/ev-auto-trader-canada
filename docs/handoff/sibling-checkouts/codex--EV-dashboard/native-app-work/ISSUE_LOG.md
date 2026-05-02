# ISSUE_LOG.md

## Policy
- Blockers only. No queue history, no roadmap, no learning dump.
- `PLAN.md` is live state. `MEMORY.md` is reusable intelligence. `TESTING.md` is proof truth.
- Repo hygiene: many files are untracked; do not commit unless explicitly asked.

## Open Issues

### ISSUE-001
- area: testing
- status: open
- revisit_effort: HIGH
- summary: `swift test` is a package-test build signal here, not confirmed runtime assertion execution.
- evidence: `swift test` completed as build proof; `swift test list` did not provide runtime assertion proof; `xcrun --find xctest` was unavailable in the active Command Line Tools environment.
- revisit_when: full Xcode is activated, runtime assertions become necessary, or release hardening needs stronger proof.

### ISSUE-003
- area: tooling
- status: open
- revisit_effort: HIGH
- summary: full Xcode may be needed later for stronger runtime debugging, macOS test support, packaging, signing, or notarization.
- evidence: current workflow is SwiftPM plus Command Line Tools; telemetry currently covers normal lifecycle evidence.
- revisit_when: runtime debugging stalls, packaging begins, or current toolchain blocks verification.

### ISSUE-004
- area: live data
- status: open
- revisit_effort: MEDIUM
- summary: Ford Canada now has covered MSRP fallback behavior, but true live dealer pricing remains a source-data risk when fetched page text omits price.
- evidence: Ford pages expose VIN, trim, stock status, dealer, and address; price was not reliably visible in validation fetches; medium stabilization added fallback coverage and medium-confidence publishing.
- revisit_when: true dealer pricing becomes required, Ford page shape changes, or next source validation compares pricing completeness.

### ISSUE-005
- area: source expansion
- status: parked
- revisit_effort: HIGH
- summary: Tesla Canada remains parked because Ford Canada is the cleaner first live path.
- evidence: Tesla inventory path had robots/policy and postal-code dependency concerns.
- revisit_when: Ford path fails or next-source validation begins.

### ISSUE-006
- area: source expansion
- status: open
- revisit_effort: HIGH
- summary: Volkswagen Canada ID.4 is selected for the next source, but implementation must stay low-volume, user-initiated, provenance-preserving, and personal-use oriented until release/commercial use is decided.
- evidence: VW inventory page/feature app is public; `globalapi.vwtools.ca/inventory-app/vehicles` returns VIN, stock, trim, year, price, stock status, dealer/location, and deeplink fields; VW usage text restricts site content beyond personal use.
- source_card: `PUBLIC_OEM_ENDPOINT`; owner Volkswagen Canada; proof URL `https://globalapi.vwtools.ca/inventory-app/vehicles?postal_code=M5V%202T6&distance=100&category=new&model=id4&limit=5`; cache low-volume user refresh only; stop on access-control, policy, or schema ambiguity.
- parked_candidates: Chevrolet Canada inventory search is robots-disallowed; Hyundai dealer shop path returned a Cloudflare challenge; Kia Canada did not expose a cleaner stock endpoint during bounded validation.
- revisit_when: implementation needs bulk crawling, commercial/release claims, broader source strategy, or VW access/terms change.

### ISSUE-007
- area: catalog incentives
- status: parked
- revisit_effort: HIGH
- summary: Transport Canada EVAP is useful for incentive eligibility, but P3 did not select it as the first catalog import backbone because the official page is table/list oriented and eligibility depends on transaction details.
- evidence: EVAP vehicle list exposes model year, make, model, trim, fuel type, and lease/purchase incentive amounts, but also says the list is informational and final eligibility depends on transaction value and program rules.
- revisit_when: incentive UI becomes active, a stable machine-readable EVAP source is found, or release/commercial claims require stronger incentive proof.
