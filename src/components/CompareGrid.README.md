# CompareGrid

Side-by-side comparison of up to 4 inventory units (specific listings,
not abstract models). Lives at `/compare`. ~350 lines.

## Distinguishing this from the picker compare flow

There are **two** compare flows in this codebase:

| Component | Compares | Where | State |
|---|---|---|---|
| `CompareGrid` (this) | `ScoredUnit[]` (specific listings on lots) | `/compare` | local `useState`, ephemeral |
| `PickerCompareTray` | `Spec[]` (abstract model+trim) | `/pick-a-model` flow | Zustand `picker` store, localStorage-persisted |

This README covers `CompareGrid`. See `PickerCompareTray.tsx` header
comment for the model-shopping flow.

## What it renders

Header row: pick up to 4 units via checkbox — table renders only the
chosen 4 columns side-by-side. Rows: model + year + trim, dealer,
asking price, OTD breakdown, deal score badge, days on lot, status chip,
spec essentials (range / charging / heat pump / battery chem).

## Props

```ts
type Props = {
  units: ScoredUnit[];
  dealerById: Map<string, Dealer>;
  specByKey?: Map<string, Spec>;
}
```

`specByKey` is keyed by `${model}|${year}|${trim}|${drivetrain}` — the
same key shape `loadScoredUnits` uses for spec resolution. Optional;
component renders without it but spec rows show "—" for missing.

## State it owns

`useState<string[]>` — array of stable unit IDs (`u-at-...`) currently
picked. Capped at 4. Toggle via checkbox. Selection lost on navigation
(no persistence by design — comparing different listings is a session
activity, not a long-lived saved set).

## What it depends on

- `@/lib/types` — `ScoredUnit`, `Dealer`, `Spec`, `Incentive`
- `@/lib/scoring` — `effectivePreTaxValue` for delta calcs
- `@/lib/format` — `fmtCad`, `fmtPercent`
- `@/lib/constants` — `MODEL_LABEL`
- `./DealScoreBadge` — colored pill (green/amber/red by score)
- `./StatusChip` — in-stock / in-transit / demo

## What depends on it

Only `src/app/compare/page.tsx`. The Compare CTA in `InventoryTable`
links to `/compare?ids=u-at-X,u-at-Y,…` — those URL params pre-seed the
picked array on mount.

## Print + a11y notes

Print stylesheet collapses the side-by-side grid to a stacked layout for
8.5×11 letter readability. Each picked-column has `aria-label` with the
unit's full name + dealer for screen readers.
