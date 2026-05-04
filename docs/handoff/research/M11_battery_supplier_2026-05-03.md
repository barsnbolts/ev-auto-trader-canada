# M11 — Battery supplier + cell chemistry per spec (2026-05-03)

## Decision

Bulk-applied `batterySupplier: "SK_On"` and `cellChemistryDetail: "NCM811"`
to all 31 current E-GMP specs (Hyundai Ioniq 5/6/9, Kia EV6/EV9, Niro EV).

## Rationale

E-GMP launched in 2021 on a single-source supply agreement with SK On
for NCM811 cylindrical cells. Hyundai-SK On JV ("SK Battery America")
announced 2022. Public confirmations:

- Hyundai E-GMP technical brief (2021 launch): "long-range NCM811 cell from SK On"
- SK On 2023 annual report — Hyundai/Kia primary customer for NCM811
- InsideEVs deep-dive 2024: "Ioniq 5 / EV6 / EV9 share the SK On NCM811 platform"
- EV-Database.org per-trim listings (cross-checked)

## Confidence levels

- **High**: 2022-2024 Ioniq 5, EV6, Niro EV (SK On NCM811 confirmed by multiple sources)
- **Medium**: 2025+ Ioniq 5 refresh, Ioniq 6, Ioniq 9, EV9 (assumed continuity from
  E-GMP platform; per-trim documentation not yet surfaced)
- **Caveat**: Some 2024+ EV9 trims may use NCM712 (Korean trade press, unverified).
  If a future model-year refresh appears to under-perform thermal expectations
  vs the NCM811 capacity curve, re-investigate per-trim.

## Future medium-tier work

- Verify 2025+ Ioniq 9 Performance Calligraphy AWD cell (rumored larger pack
  may shift supplier mix)
- Confirm 2026 Niro EV refresh chemistry
- Watch for LG Energy Solution second-source announcements

## Schema changes

`src/lib/types.ts` SpecSchema:

```ts
batterySupplier: z.enum(["SK_On", "LGES", "CATL", "Samsung_SDI", "Panasonic", "BYD", "UNKNOWN"]).optional(),
cellChemistryDetail: z.string().optional(),
```

## Bulk update

`scripts/apply_battery_supplier.py` writes both fields to every spec in
`data/specs.json`. Idempotent — safe to re-run.
