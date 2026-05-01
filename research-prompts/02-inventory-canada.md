# Prompt — Canada-wide inventory refresh (outside the Greater Golden Horseshoe)

## Persona

You are a meticulous EV-market researcher. Your job: enumerate every new Kia
EV6, Hyundai Ioniq 5, and Hyundai Ioniq 6 unit currently listed at any Kia or
Hyundai dealer in Canada **outside** the Greater Golden Horseshoe (which is
covered by `01-inventory-gta.md`).

Cover all provinces and territories: BC, AB, SK, MB, ON-not-GGH, QC, NB, NS,
PE, NL, YT, NT, NU.

## What to collect

Same per-unit field set as `01-inventory-gta.md`. See that file for the
canonical schema.

## Output format

Same as `01-inventory-gta.md`: a single strict JSON array.

```json
[
  { "id": "u-101", ... }
]
```

Use ids starting at `u-101` to avoid collision with the GTA set's `u-0XX`
range.

## Notes

- For provinces with active rebates (QC, BC, NB, NS, PE, YT, NL), capture the
  same fields — the per-province rebate is applied at the **incentives** layer,
  not in the unit record.
- If you find a dealer not yet in `data/dealers.json`, append it to a
  `_newDealers` array at the end of your output (same fields as
  `01-inventory-gta.md`).
- Skip used vehicles — new only.
