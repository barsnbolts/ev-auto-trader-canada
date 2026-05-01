# AUTO-LOG — full-auto execution session COMPLETE

> Started: 2026-05-01 while user is on iOS
> Ended: 2026-05-01 same session, full auto throughout
> Reasoning level: medium (high used earlier for merge plan design)

## Outcome — 5 commits pushed

```
2556719  feature: /intel route — recall families, competitor benchmarks, tax structure
01c2461  ui: ICCU recall chip + EVAP row in compare + EVAP-aware negotiation draft
152e779  ui: surface EVAP eligibility, trim cliff alert, 5-model support
703a299  otd: apply EVAP rebate per-unit + BC progressive PST brackets
3e599c2  schema: extend incentive/tax/market-intel models for EVAP cap structure
```

All on `claude/ev-inventory-tracker-3IwyA`. `npx tsc --noEmit` clean,
`npx next build` clean (8/8 prerendered).

## What got built

### Schema foundation (3e599c2)
- New typed fields on `IncentiveSchema`: `transactionValueCapCad`,
  `capAppliesToImported`, `leaseTermProration`, `yearTierAmounts`,
  `effectiveByRegistrationDate`
- New `TaxesAndFeesSchema` (`data/taxes-and-fees.json`)
- New `MarketIntelSchema` (`data/market-intel.json`)
- `MODELS` extended to 5 (added EV9 + Ioniq9)
- `ON_DEALER_FEES` updated: OMVIC $12.50 → $22 (Sep 2025), tire
  $17.40 → $22.76 (RPRA 2026 producer pass-through)
- `BC_PST_BRACKETS` + `bcPstRateFor()` helper for progressive surtax
- `loadTaxesAndFees()` + `loadMarketIntel()` data loaders

### OTD calculator (703a299)
- `computeOtd` now subtracts the EVAP rebate when the unit's pre-tax
  transaction value is at or under $50,000
- BC sales tax now uses 5% GST + price-keyed PST bracket lookup
  instead of flat 12%
- `applicableIncentives` enforces the cap so over-cap units don't
  show EVAP as applicable
- `evapEligibleAmount()` and `evapCapDeltaCad()` helpers exported

### UI: inventory + dashboard + incentives (152e779)
- Inventory: EVAP chip in OTD column (3 states: eligible / cliff /
  over), EVAP-eligible filter checkbox, model dropdown auto-iterates
  MODELS
- Dashboard: EVAP-eligible KPI tile (replaced Active Incentives),
  trim cliff alert section listing units within $1,500 over cap
- Incentives page: cap/lease-proration grid renders when
  `transactionValueCapCad` is set; year-tier grid renders when
  `yearTierAmounts` is set
- 5-model `MIX_COLORS` extended on dashboard mix bars

### Specs (152e779)
- `data/specs.json` with 20 rows
- EV9 (4 trims) and Ioniq 9 (3 trims) hand-seeded with `verifyPending`
- All sourced from official kia.ca / hyundaicanada.com URLs

### UI polish (01c2461)
- ICCU recall chip in inventory Status column for affected year
  ranges (EV6 22–24, Ioniq 5 22–25, Ioniq 6 23–24)
- EVAP eligibility row in compare grid
- Unit drawer negotiation draft injects EVAP-aware lines:
  eligible → "$5k already in OTD", cliff → "trim admin/wheel-locks
  to unlock $5k", over-cap → "Equinox EV 2LT AWD $44,699 effective"

### `/intel` route (2556719)
- Surfaces market-intel.json + taxes-and-fees.json in a navigable
  page
- Recall family with severity / resolution / warranty extension
- Competitor benchmark table with post-EVAP effective MSRP
- Sales tax matrix + ON dealer fees + BC PST bracket table
- OEM May 2026 subvention summaries
- End-of-month timing signal callout

## Decisions flagged for human review

1. **EV9 + Ioniq 9 specs are hand-seeded**. All 7 rows in
   `data/specs.json` for these models carry `notes: "verifyPending:
   ..."`. Re-verify against kia.ca and hyundaicanada.com when next
   DR pass runs.
2. **Dealer roster was NOT replaced wholesale**. Existing 22
   nationwide dealers (some fictional) kept intact because
   `data/units.json` references their IDs. Adding Gemini's verified
   GGH dealers without inventory data would just pollute the map
   with empty markers. Suggest doing a real-inventory-per-dealer
   pass before touching dealers.
3. **Toronto Hyundai address conflict resolved**. Gemini hallucinated
   (its 2460 Dufferin St collided with Kia Yorkdale in its own list).
   ChatGPT's 151 Billy Bishop Way / M3K 0E5 was used.
4. **EV6 2025 Wind RWD range = 513 km** (Kia Canada brochure via
   ChatGPT) not 475 km (Gemini, likely confused with Land AWD).
5. **Tire stewardship $22.76** = 4 × $5.69 RPRA producer pass-through
   per Gemini's research, replacing the old $17.40 default.
6. **Existing dealer-fee constants** in `src/lib/constants.ts` were
   stale (OMVIC $12.50, tire $17.40). Updated to current 2026 values
   sourced from OMVIC bulletin + RPRA fee schedule.

## Items needing more reasoning later

1. **Per-province incentive stacking math.** The schema supports
   stackability via `stackableWith[]`, but the OTD calc only applies
   the federal EVAP rebate today. If user wants Ontario buyers to
   see Roulez vert + Manitoba rebates etc. modeled, the calc needs
   to walk the stack per dealer province. Not blocking — most
   tracked dealers are ON.
2. **Lease term proration in OTD.** The calc applies the 48-month
   tier ($5,000) by default. To support a proper lease scenario,
   it would need a term selector in the UI. Out of scope for this
   pass but trivial extension when needed.
3. **Demo / pre-registered exemption from federal luxury tax.**
   Schema captures `usedExempt: true`. Not yet rendered anywhere
   because no tracked unit hits the $100k threshold. Activate when
   EV6 GT or Ioniq 5 N inventory is added with markups.

## Skills audit summary

- ✅ `caveman` SKILL.md installed at project level
  (`.claude/skills/caveman/SKILL.md`)
- ✅ Slash commands: `/caveman`, `/caveman-init`, `/caveman-commit`,
  `/caveman-review` all present in `.claude/commands/`
- ✅ User-level: only `session-start-hook` (not interfering)
- ✅ `~/.claude/settings.json` clean: just the Stop git-check hook
  + `Skill` permission

No cleanup needed.

## Working tree

Clean. All commits pushed to origin. PROGRESS.md updated with full
run-log entry covering all 5 commits.
