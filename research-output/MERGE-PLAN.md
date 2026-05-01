# Merge Plan — ChatGPT DR + Gemini DR → repo data

> Designed in high-reasoning mode 2026-05-01. Execution is mechanical and can run in medium.

## Scope expansion 2026-05-01: add EV9 + Ioniq 9 (3-row SUVs)

User added Kia EV9 and Hyundai Ioniq 9 to the tracked model set. Both are
E-GMP 3-row family SUVs sharing the 800V architecture and 350 kW DC fast
charging with the existing models, but with much larger battery packs and
materially different MSRPs (both well above the $50k EVAP cap → all trims
disqualified from the federal rebate).

### What we have:
- **Kia EV9**: Gemini DR captured ONE inventory data point — 2026 EV9 Light
  RWD demo at 401 Dixie Kia, stock EV926005, 50 km, with explicit $2,000
  dealer incentive and 1.99% finance offer. Useful as a real unit.
- **Hyundai Ioniq 9**: Neither DR pass touched it. Ioniq 9 launched MY2026.

### What we need before merging EV9/Ioniq 9 cleanly:
1. **Spec data** — both DR runs ignored these models. Options:
   - (a) Hand-seed best-known Canadian Kia/Hyundai showroom specs, mark
     `verifyPending: true`, flag in commit
   - (b) Run a focused DR follow-up: "Pull Canadian-market trim/MSRP/range
     data for 2024–2026 Kia EV9 and 2026 Hyundai Ioniq 9 from
     kia.ca and hyundaicanada.com showroom + product cards"
   - **Recommended: (b)**. Spec accuracy matters for OTD math; 5 minute
     focused query produces clean data vs hand-seeding.
2. **Trim taxonomies**:
   - EV9 (Canadian): Light RWD, Light Long Range RWD, Land Long Range AWD,
     GT-Line AWD (need to verify 2026 trim names)
   - Ioniq 9: Preferred LR RWD, Preferred LR AWD, Performance/Calligraphy
     AWD (verify)
3. **Code changes**:
   - `src/lib/constants.ts`: extend `MODELS = ["EV6", "Ioniq5", "Ioniq6", "EV9", "Ioniq9"]`
   - `MODEL_LABEL`: add "Kia EV9" and "Hyundai IONIQ 9"
   - `MODEL_BRAND`: EV9 → Kia, Ioniq9 → Hyundai
   - `TRIMS_BY_MODEL`: populate after spec research
   - `src/lib/types.ts`: model literals are derived from `MODELS` so
     should auto-update
   - `src/lib/scoring.ts`: 3-row SUVs may have different freight/PDI rates
     (EV9 freight is typically higher than EV6); verify per-model
4. **UI**:
   - `MIX_COLORS` in `src/app/page.tsx` needs two more entries (EV9 → ?, Ioniq9 → ?)
   - Per-model snapshot grid currently grids 3-up; with 5 models needs to
     wrap or shift to 2-up on mobile, 3- or 5-up on desktop
   - Compare grid still works (already supports any model from the literal)
5. **EVAP context**: All EV9 trims start ~$59k+ and all Ioniq 9 trims
   ~$64k+ → none qualify for the $50k EVAP cap. The "trim cliff" doesn't
   apply within these models, but the cross-model competitor angle does
   (a $44k post-EVAP Equinox EV is half the price of an EV9 Land AWD).

### Decision point for user:
Before executing the merge, do you want to:
- **(A)** Run a focused DR follow-up just for EV9 + Ioniq 9 specs/MSRP
  (recommended — 5-10 min ChatGPT/Gemini query, clean data) → then merge
  everything together in one pass.
- **(B)** Execute the merge now with EV6/Ioniq 5/Ioniq 6 only and add
  EV9/Ioniq 9 in a follow-up commit once spec data lands.
- **(C)** Hand-seed EV9/Ioniq 9 specs from public knowledge with
  `verifyPending: true` and merge all five models now.

Default if no answer: (B). Ship the well-researched 3 models first,
hold EV9/Ioniq 9 for the next research pass.


## Source-of-truth rules (when sources disagree)

1. **Specs**: ChatGPT wins where it cites the official Kia/Hyundai Canada brochure or product card. Gemini fills gaps (e.g. EV6 2024 Wind RWD specs) where ChatGPT didn't capture.
2. **Dealer addresses/postal/phone**: ChatGPT wins (more verified). Gemini-only dealers added with `unverifiedFields: ["address","postal","phone"]` flag where Gemini said "VERIFY: Address pending".
3. **Incentive structure (EVAP cap, lease proration, Roulez vert tiers, BC PST brackets)**: Gemini wins outright — ChatGPT didn't capture these.
4. **Inventory units**: Both merged. ChatGPT has 9 in-scope VINs, Gemini has 1. Total: 10 units after dedup.
5. **Tire stewardship**: $5.69/tire × 4 = $22.76 (Gemini's cited formula). ChatGPT had $25; close enough; use Gemini.
6. **OMVIC**: $22 (both agree, citation: omvic.ca dealer bulletin Sep 1, 2025).
7. **A/C excise**: $100 (both agree).

## Known conflicts to resolve manually

| Conflict | Resolution |
|---|---|
| Burlington Hyundai postal `L7R 5B3` (CG) vs `L7R 3L5` (Gem) | Use ChatGPT's `L7R 5B3` (matches pattern of plains-rd-east area; Gemini's L7R 3L5 unverified) |
| Toronto Hyundai address: `151 Billy Bishop Way` (CG) vs `2460 Dufferin St` (Gem) | **Gemini hallucinated** — its 2460 Dufferin St also appears as Kia Yorkdale's address in its own list. Use ChatGPT. |
| EV6 2025 Wind RWD range: 513 km (CG, brochure) vs 475 km (Gem) | ChatGPT cites Kia Canada brochure; 475 km is the Land AWD figure. Use 513. |
| Ioniq 5 N motor power: 448 kW (CG, showroom) vs 448 kW (Gem) | Agree |

## Schema extensions required

### `IncentiveSchema` — new optional fields

```typescript
{
  // existing fields preserved
  transactionValueCapCad?: number,        // EVAP $50,000
  capAppliesToImported?: boolean,          // true for EVAP (Cdn-made exempt)
  leaseTermProration?: {                   // EVAP lease proration
    [termMonths: string]: number           // "48": 5000, "36": 3750, "24": 2500, "12": 1250
  },
  effectiveByRegistrationDate?: boolean,   // Roulez vert
  yearTierAmounts?: {                      // Roulez vert step-down
    [year: string]: number                 // "2025": 4000, "2026": 2000, "2027": 0
  }
}
```

Rationale: EVAP isn't a flat $5k anymore — it's conditional on (a) transaction value ≤ $50k, (b) lease term, (c) origin country. Roulez vert isn't a flat $2k — it's date-of-registration tiered. Modeling these as simple `amountCad: 5000` rows is wrong and will mislead negotiation math.

### `TaxesAndFeesSchema` — new file `data/taxes-and-fees.json`

```typescript
{
  salesTaxByProvince: { [province]: { type, ratePercent? | gstPercent+(qstPercent|pstPercent), ... } },
  bcVehicleSurtaxBrackets: Array<{ minPriceCad: number, maxPriceCad: number | null, ratePercent: number }>,
  ontarioDealerFees: { acExciseTaxCad, omvicCad, tireStewardshipPerTireCad, tireCount, govLicensingCad },
  federalLuxuryTax: { thresholdCad, rateRule },
  freightPdiByOem: { Kia: 2150, Hyundai: 2050 }
}
```

The BC progressive surtax can't be expressed as a single `pstPercent` — it's price-dependent. Needs bracket function:
```
bcPstFor(priceCad) = brackets.find(b => priceCad >= b.minPriceCad && (b.maxPriceCad === null || priceCad < b.maxPriceCad)).ratePercent
```

### `MarketIntelSchema` — new file `data/market-intel.json`

```typescript
{
  competingEvOtdReference: Array<{ make, model, year, drivetrain, msrpCad, source, qualifiesForEvap: boolean }>,
  knownIssues: Array<{ model, yearRange, issue, severity, resolution, warrantyExtension?, source }>,
  warrantyTerms: { kiaBatteryYears, kiaBatteryKm, hyundaiBatteryYears, hyundaiBatteryKm, iccuExtensionYears: 15, iccuExtensionKm: 290000 },
  oemSubventions2026May: {
    Kia: { bonusCadByModel?, loyaltyRateReductionPercent: 1, militaryCad: 500, mobilityCad: 750 },
    Hyundai: { springDriveBonusMaxCad: 1000, leaseSecurityDepositCad: 0, leaseAnnualKm: 16000, leaseOverageCadPerKm: 0.12, loyaltyLeaseRateReductionPercent: 1, loyaltyFinanceRateReductionPercent: 0.5 }
  },
  endOfMonthSignal?: string
}
```

## OTD calculator changes (`src/lib/scoring.ts:computeOtd`)

Currently the scorer does:
```
otd = msrp + freightPdi + dealerAdjustment + acExciseTax + omvic + tire + govLicensing + salesTax(price)
```

After merge it needs to:

1. **EVAP eligibility**: For each unit, compute pre-tax transaction value. If unit's MSRP+freight+dealerFees ≤ $50,000 AND vehicle is imported → apply $5,000 federal rebate (cash/finance/48mo+ lease). Otherwise $0.
2. **Roulez vert (QC dealers only)**: Apply 2026 tier ($2,000) if registered in 2026.
3. **BC PST**: Use bracket function instead of flat 7%. For Ioniq 5 Preferred AWD LR ($58,290) → 10% PST (not 7%).
4. **Trim cliff flag**: If a unit's final price is in the $50,000–$55,000 band (just over EVAP), flag it. Stepping down to the next-lower trim recovers $5,000 + tax-on-$5,000 = ~$5,650 in Ontario.

## UI surfacing (new)

### Dashboard (`/`)
- New tile: "Sub-$50K trims qualifying for EVAP" (count + lowest OTD)
- Below KPI tiles: "Trim cliff alert" callout if any in-stock units are within $5k of the cliff

### Inventory table (`/inventory`)
- New column or chip: ✅ EVAP-eligible / ❌ Over cap (and by how much)
- New filter: "EVAP-eligible only"
- Color the OTD column red if unit is just over the cap (cliff zone)

### Incentives page (`/incentives`)
- Replace flat "$5,000" iZEV row with EVAP card showing:
  - Cap: $50,000 transaction value (imported only)
  - Lease term schedule (48/36/24/12 mo)
  - Effective from 2026-02-16
- Add Roulez vert step-down table (2024–2027)
- Add BC pause callout

### Unit drawer (`UnitDrawer.tsx`)
- In the negotiation draft, if the unit is EVAP-disqualified, mention the post-rebate competitor benchmark (Equinox EV 2LT AWD $49,699 → $44,699 after EVAP).
- If the unit is in the cliff zone (just over $50k), suggest: "Asking dealer to trim accessories/admin to bring transaction value under $50,000 unlocks $5,000 federal rebate."

### Compare page (`/compare`)
- Add row: "EVAP eligibility" with check/X
- Add row: "Effective post-rebate price" using lease/finance assumption

## Execution order (medium-reasoning safe)

1. **Extend types**: `src/lib/types.ts` add `transactionValueCapCad`, `leaseTermProration`, `yearTierAmounts`, etc. to `IncentiveSchema`. Add `TaxesAndFeesSchema`, `MarketIntelSchema`.
2. **Extend `data.ts`**: add `loadTaxesAndFees()`, `loadMarketIntel()`.
3. **Write merged data files**:
   - `data/dealers.json` (~50 dealers — ChatGPT's 33 + ~17 Gemini-unique)
   - `data/specs.json` (~20 spec rows)
   - `data/incentives.json` (rewrite with EVAP structure, Roulez vert tiers, BC pause, Kia/Hyundai OEM cash)
   - `data/taxes-and-fees.json` (NEW)
   - `data/market-intel.json` (NEW)
   - `data/units.json` (10 in-scope VINs)
4. **Update OTD calculator**: implement EVAP eligibility + BC bracket + Roulez vert tier in `src/lib/scoring.ts`.
5. **Update aggregations**: add `evapEligibleCount`, `trimCliffUnits` helpers in `src/lib/aggregations.ts`.
6. **Update UI**: dashboard tile, inventory column/filter, incentives page, drawer copy, compare row.
7. **Snapshot**: `npm run snapshot`.
8. **Verify**: `npx tsc --noEmit && npx next build`.
9. **Commit per file** (~9 commits). Push.

## Estimated effort

- Schema + data files: 30 min
- OTD calculator changes: 20 min
- UI surfacing: 45 min
- Verify + commit: 10 min

Total: ~1.75 hr of medium-reasoning execution.

## Key insights worth preserving in commit messages

1. **EVAP is not a flat $5k** — it's a $50k cap + lease-term schedule. Modeling matters.
2. **Roulez vert is calendar-tiered** — registration date determines amount. Affects QC inventory.
3. **BC PST is progressive** — 7% jumps to 10% at $57k. Punishes mid-trim EVs.
4. **Trim cliff is the central negotiation insight** — stepping from $48k to $54k costs $11k effective.
5. **Toronto Hyundai address conflict** — Gemini hallucinated; trust ChatGPT's verified addresses.
