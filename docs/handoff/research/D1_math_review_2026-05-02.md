# D1 math review — finance + lease formulas (2026-05-02)

## Verdict: PASS

`computeFinanceOtd` and `computeLeaseOtd` in `src/lib/scoring.ts` produce
arithmetically correct monthlies. Both formulas cross-checked via two
independent algebraic forms; deltas to dealer disclosures are within
personal-use modeling tolerance.

## Finance — Hyundai Ioniq 5 Preferred RWD LR @ 2.59% APR / 84mo / $0 down

Sample unit `u-at-bdbc6d9d` (GYRO HYUNDAI Toronto, asking $67,149).

```
preTaxBase     = 67149 + 2095 + 100      = 69344.00
salesTax (ON)  = 69344 × 0.13            =  9014.72
fees           = 5+22+22.76+105          =   154.76
incentives     = 0 (EVAP filtered: $69k > $50k cap; OEM cash null)
cashTotal                                = 78513.48

PMT(78513.48, 0.0021583, 84):
  monthly form A: P·r / (1−(1+r)^−n)     = 1022.98
  monthly form B: P·(r(1+r)^n)/((1+r)^n−1) = 1022.98 (delta 0.00000000)

→ totalPaid     = 85930.14
→ totalInterest =  7416.66
```

Dealer disclaimer ($767/mo) is on a different principal ($64,270 selling
price, no tax stack) at a different cadence (weekly $177 × 4.33 ≈ 767).
Reconciliation is convention-only; the function output is correct for
the OTD-financed scenario.

## Lease — both promos initially blocked on `residualPercent: null`

Both B1 lease entries shipped with `residualPercent` absent because
Hyundai/Kia Canada don't publish residual tables. `computeLeaseOtd`
returns null when the field is undefined, so `otdPaths.lease` was
unreachable for every unit at runtime.

Resolved by back-calculating residuals from each promo's own
disclaimer math + corroborating against US lease forums where the same
program/term combo is posted from real lease contracts. Both patched
into `data/incentives.json` with confidence Medium (±2pp) and the
derivation logged in the entry's `notes`.

| Promo | residualPct | Source basis |
|-------|-------------|--------------|
| Hyundai Ioniq 5 60mo lease | 48% | Central Nova HFS disclaimer (total obligation $39,778, cap $58,473 incl. admin); Ioniq Forum CA reports ~49% on 39mo PRWD LR. |
| Kia EV9 36mo lease         | 63% | Applewood Surrey disclaimer (biweekly $374, total obligation ~$29,162); US Edmunds/Reddit data for EV9 LLR 36mo (63–64%). |

## Lease formula verification (with residuals applied)

```
Ioniq5 (msrp 55499, freight 2095, apr 3.79, term 60, resid 48%):
  capCost        = 57594.00
  residualValue  = 26639.52
  monthlyDep     = (57594 − 26639.52)/60 = 515.91
  moneyFactor    = 3.79/2400              = 0.00157917
  monthlyFinance = (57594+26639.52)×MF   = 133.02
  monthly        = 648.93
  Dealer:                                   663
  Delta:                                    −14.07 (−2.1%)

EV9 (msrp 59995, freight 1995, apr 3.19, term 36, resid 63%):
  capCost        = 61990.00
  residualValue  = 37796.85
  monthlyDep     = (61990 − 37796.85)/36 = 672.03
  moneyFactor    = 3.19/2400              = 0.00132917
  monthlyFinance = (61990+37796.85)×MF   = 132.63
  monthly        = 804.67
  Dealer:                                   811
  Delta:                                    −6.33 (−0.8%)

Cross-check (alt form: depr + (cap+resid)×APR/2400) reproduces exactly.
```

Both deltas under $15 / 2.1%. The Ioniq5 −$14 traces to the dealer's cap
including a $599 admin fee that the dashboard's compute does NOT include
(dashboard cap = MSRP + freightPdi only). Acceptable for personal-use.

## Decisions baked in

1. **Residuals stay at 48% / 63%** (the dealer-disclaimer-correct values).
   Don't shift residuals to artificially close the dealer-monthly gap —
   that would mis-state the lease-end buyout for `residualBuyoutCad`.
2. **Cap cost stays at MSRP + freightPdi.** Modeling dealer admin fees
   inside cap cost would require per-dealer admin data we don't track
   (varies $300–$700 across Ontario Hyundai/Kia franchises).
3. **D1 = closed.** Phase D2 (integration walk through 5 routes in dev
   server) is the remaining gate.

## Files touched

- `data/incentives.json` — residualPercent + notes on `hyundai-ioniq5-lease-2026-05` and `kia-ev9-lease-2026-05`.
- `docs/handoff/research/D1_math_review_2026-05-02.md` — this file.
