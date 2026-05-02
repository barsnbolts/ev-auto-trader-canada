# EV Dashboard Drift Report
**Generated:** 2026-04-24 · Automated run of `ev-drift-monitor`

---

## Summary

Two significant real-world changes found. Both affect data in `seed.json` directly. One is critical (program-level policy); one resolves a known Low-confidence placeholder.

---

## CRITICAL: iZEV replaced by EVAP (Federal Rebate Program)

**Status:** iZEV closed March 31, 2025. EVAP launched February 16, 2026. **Program is now active.**

### What changed

| | iZEV (closed) | EVAP (active since Feb 16, 2026) |
|---|---|---|
| BEV rebate | up to $5,000 | **$5,000 in 2026** → $4k → $3k → $3k → $2k (2030) |
| PHEV rebate | up to $2,500 | **$2,500 in 2026** → decreasing schedule |
| Price cap type | Base MSRP ($55k / $65k tiers) | **Final transaction value** (base + options + dealer fees, excl. taxes) |
| Cap amount | $55,000 / $65,000 | **$50,000** (no cap for Canadian-built EVs) |
| Eligible list | broader | Narrower — ~6 vehicles currently listed |
| Per-person limit | multiple allowed | **One rebate per person, lifetime of program** |
| Chinese EVs | eligible (pre-tariff) | Not eligible (FTA countries only) |

Source: `tc.canada.ca` (Transport Canada), confirmed 2026-04-24. `driveauthority.com` summary cross-checked.

### Impact on seed.json

Every vehicle's `federal_izev_cad` is coded `0` with notes like "iZEV paused in early 2025; 2026 status uncertain." That note is now stale — EVAP is live.

**Vehicles that now qualify for EVAP rebate (confirmed from Transport Canada EVAP vehicle list):**

| Vehicle in seed | id | EVAP rebate | Notes |
|---|---|---|---|
| Chevrolet Equinox EV FWD LT2 | `chevy-equinoxev-fwd-lt2` | **$5,000** | Explicitly on EVAP list; MSRP $48,499 ≤ $50k threshold |
| Toyota bZ4X LE FWD | `toyota-bz4x-le-fwd` | **$5,000** (likely) | MSRP $46,515; verify on EVAP list |
| Kia Niro EV | check seed | **$5,000** (likely) | Verify MSRP ≤ $50k final transaction |
| Kia Niro PHEV EX | `kia-niro-phev-ex-fwd` | **$2,500** (likely) | MSRP $38,795; PHEV rate |

**Vehicles that do NOT qualify for EVAP** (MSRP > $50k, not Canadian-built):
- All Tesla, Hyundai, Kia (higher trims), Ford, Rivian, BMW, Polestar, Volkswagen, Genesis, Nissan, Volvo, Chrysler entries at current MSRPs

**Note on Equinox EV AWD 2LT** (`chevy-equinoxev-awd-2lt`, MSRP $51,999): slightly above threshold — EVAP eligibility depends on whether final transaction can be negotiated under $50k. Mark uncertain.

### Action required

1. Rename or repurpose `federal_izev_cad` → `federal_evap_cad` in `types.ts` and `seed.json` (or add new field)
2. Update qualifying vehicles' field value: `0` → appropriate rebate amount
3. Update notes across all vehicles to reference EVAP, cite `tc.canada.ca`
4. The iZEV wizard in the UI (`src/components/CompareView.tsx`) still references "iZEV" — update labels to EVAP

---

## Tesla Model Y Juniper — Specs Now Available

**Status:** Specs confirmed. Seed entry `tesla-modely-juniper-lr-rwd` has all null values. Fill them.

### Long Range RWD (entry exists — fill nulls)

| Field | Current | New value | Confidence | Source |
|---|---|---|---|---|
| `msrp_cad` | null (Low) | **$54,990** | High | thinkev.ca (2026-03-06), Tesla.ca |
| `range_km` | null (Low) | **531** | High | Tesla-rated; thinkev.ca confirms |
| `battery_kwh_usable` | null (Low) | **75.0** | Medium | ev-database.org (estimated) |
| `dc_charge_kw_max` | null (Low) | **170** | Medium | Standard Tesla LR RWD rate; verify at Tesla.ca |
| `federal_evap_cad` | 0 (Medium) | **0** | High | Exceeds $50k cap |

Real-world range: ~430–470 km (Canadian summer); 335–690 km estimation band (EV Database).

### Long Range AWD (entry MISSING from seed — add it)

Per scope rules: "longest-range AWD variant" must have its own entry. This is not in seed.

| Field | Value | Confidence | Source |
|---|---|---|---|
| `id` | `tesla-modely-juniper-lr-awd` | — | — |
| `msrp_cad` | **$59,990** | High | thinkev.ca (2026-03-06) |
| `range_km` | **497** | High | Tesla-rated; thinkev.ca confirms |
| `battery_kwh_total` | **82** | Medium | MotorTrend 2026 test (79.5 kWh NCA = total packsize ~82 kWh nominal) |
| `battery_kwh_usable` | **75.0** | Medium | ev-database.org |
| `battery_chemistry` | **NCA** | High | MotorTrend 2026 test |
| `dc_charge_kw_max` | **250** | High | Standard Tesla LR AWD; confirmed across multiple sources |
| `weight_kg` | **2072** | Medium | ev-database.org (EU unladen) |
| `federal_evap_cad` | **0** | High | Exceeds $50k cap |
| `drivetrain_variant` | **AWD** | High | — |

EPA range: 311 miles (500 km). MotorTrend real-world test: 252 miles (406 km) at 70 mph.
DC fast charge: 133 miles in 15 min, 194 miles in 30 min (MotorTrend, public charger).

---

## No-Change Items

- **Rivian R1S MSRP/availability** — no Canadian pricing change found
- **VW ID.4** — no major spec changes found
- **Ford Mustang Mach-E / F-150 Lightning** — no changes found
- **Hyundai/Kia 2025 IONIQ/EV6 refreshes** — no major drift found

---

## Recommended Next Actions (priority order)

1. **EVAP field update** (high-impact): Update `types.ts` + seed.json for the rebate program change. Affects the iZEV wizard UI and every vehicle's federal incentive value.
2. **Fill Tesla Model Y Juniper LR RWD nulls**: 5 fields, straightforward data entry.
3. **Add Tesla Model Y Juniper LR AWD** entry to seed (scope requires it; data is now available).
4. **Verify bZ4X and Niro EVAP eligibility**: Spot-check Transport Canada EVAP list at `tc.canada.ca`.

---

*Sources: tc.canada.ca · thinkev.ca · ev-database.org · driveauthority.com · motortrend.ca · iphoneincanada.ca*
*Accessed: 2026-04-24*
