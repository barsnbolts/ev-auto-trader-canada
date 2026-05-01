# AUTO-LOG — full-auto execution session

> Started: 2026-05-01 while user is on iOS.
> Reasoning level: medium (high already used for merge plan design).

## Session goals

Execute MERGE-PLAN.md option B (3-model merge first, EV9/Ioniq 9 in
follow-up) — but with two adjustments after reading the existing repo:

1. Existing `incentives.json` already has EVAP/Roulez vert content as
   prose; the work is converting to typed schema fields, not wholesale
   rewrite.
2. Existing `dealers.json` has 22 partially-fictional nationwide
   dealers. DR data covers GGH only. Don't rip-and-replace — merge by
   adding new GGH rows where Gemini has verified addresses.

## Execution log

### Phase 1: schema + constants (low blast radius)

- [ ] Extend `MODELS` to include EV9 + Ioniq9
- [ ] Extend `MODEL_LABEL`, `MODEL_BRAND`, `TRIMS_BY_MODEL`
- [ ] Update `ON_DEALER_FEES` to verified 2026 numbers (OMVIC $22, tire $22.76)
- [ ] Add `BC_PST_BRACKETS` to constants
- [ ] Extend `IncentiveSchema` with `transactionValueCapCad`,
      `capAppliesToImported`, `leaseTermProration`, `yearTierAmounts`,
      `effectiveByRegistrationDate`
- [ ] Add `TaxesAndFeesSchema` and `MarketIntelSchema`
- [ ] Run tsc to confirm no breaks (existing data must still parse)

### Phase 2: new data files

- [ ] `data/taxes-and-fees.json`
- [ ] `data/market-intel.json`
- [ ] `loadTaxesAndFees` + `loadMarketIntel` in `data.ts`

### Phase 3: incentives data refresh

- [ ] Update `fed-evap-2026` row with typed fields
- [ ] Add `qc-roulez-vert-tiers` (history of step-down)
- [ ] Add stackability to OEM cash entries

### Phase 4: scoring updates

- [ ] `computeOtd`: apply EVAP rebate when transaction value ≤ cap
- [ ] `computeOtd`: use BC bracket function for BC dealers
- [ ] `computeOtd`: use updated ON dealer fees
- [ ] `applicableIncentives`: respect cap and origin

### Phase 5: UI surfacing

- [ ] Inventory: EVAP eligibility chip
- [ ] Inventory: EVAP-eligible filter
- [ ] Dashboard: trim cliff callout
- [ ] Incentives page: EVAP card with cap + lease schedule
- [ ] Unit drawer: cliff-aware negotiation copy

### Phase 6: EV9 / Ioniq 9 stub support

- [ ] Add models to `MODELS` constant
- [ ] Add hand-seeded specs flagged `verifyPending: true`
- [ ] Update `MIX_COLORS` for 5-model layout

### Phase 7: verify + commit

- [ ] `npm run snapshot`
- [ ] `npx tsc --noEmit`
- [ ] `npx next build`
- [ ] Push all commits

## Decisions to flag for human review (when user is back at MacBook)

1. **EV9/Ioniq 9 specs**: Hand-seeded from public knowledge. Flag with
   `verifyPending: true`. Real data needs focused DR pass.
2. **Dealer roster**: Kept existing 22 + considered adding Gemini's
   verified GGH dealers. Held off because adding without inventory data
   pollutes the map with empty markers. Suggest doing a real-inventory
   pass per dealer first.
3. **Toronto Hyundai address conflict**: ChatGPT had `151 Billy Bishop
   Way` (M3K 0E5); Gemini hallucinated `2460 Dufferin St` (collided with
   Kia Yorkdale). Used ChatGPT's verified address.
4. **EV6 2025 Wind RWD range**: 513 km per Kia Canada brochure
   (ChatGPT) vs 475 km (Gemini, likely confused with Land AWD). Used
   513 km.
5. **Tire stewardship**: $5.69/tire × 4 = $22.76 (Gemini's cited
   formula). Updated from old $17.40 default.
6. **Existing Ontario dealer fees** (`src/lib/constants.ts:124-130`):
   stale (OMVIC $12.50, tire $17.40). Updated to 2026 numbers.

## Items needing high reasoning later

(None right now — execution from here is mechanical.)
