# Medium handoff · Multi-select filters + trim filter · 2026-05-05

User wants checkbox multi-select for model / year / trim on the inventory
table so they can compare across multiple at once. Currently all three are
single-value (model + year are dropdowns; trim has no filter at all, only
free-text search). Days-on-lot already correct — verified via
`InventoryTable.tsx:211 isAgingOutgoing`. No change needed there.

## Files to touch

- `src/components/InventoryTable.tsx` — primary surface
- `src/components/InventoryTable.README.md` — doc the new filter shape
- `src/lib/` — possibly extract `MultiSelectChips.tsx` component if it
  cleans up the JSX (judgement call)

## State migration

Current:
```ts
const [model, setModel] = useState<Model | "all">(initial.model);
const [year, setYear] = useState<number | "all">(initial.year);
// no trim state
```

New:
```ts
const [models, setModels] = useState<Set<Model>>(initial.models);   // empty Set = all
const [years, setYears] = useState<Set<number>>(initial.years);
const [trims, setTrims] = useState<Set<string>>(initial.trims);
```

Convention: empty Set = "no filter applied" (= match all). Avoids the
sentinel-value problem.

## URL state

Current params: `?model=Ioniq5&year=2024`

New: comma-separated lists.
- `?models=Ioniq5,EV6&years=2024,2025&trims=Preferred,Land`
- Parse: `searchParams.get("models")?.split(",").filter(Boolean) ?? []`
- Serialize: only set param when set is non-empty
- Backwards compat: also accept legacy `?model=` and `?year=` (singular)
  on initial load — read either, write only the new shape

## Filter predicate

```ts
if (models.size > 0 && !models.has(u.model)) return false;
if (years.size > 0 && !years.has(u.year)) return false;
if (trims.size > 0 && !trims.has(u.trim)) return false;
```

## UI shape

Replace the two `<select>` elements (lines ~440-462) with a row of
"chip-style" multi-select dropdowns. Pattern:
- Button shows count: `Models (2)` or `All models` when empty
- Click → popover with checkbox list
- Click outside or Esc closes
- Each checkbox toggles membership in the Set
- "Clear" link at top of popover empties the Set

Trim list is dynamic — derived from currently-visible-after-other-filters
units so it doesn't show 200+ trims. Compute via:
```ts
const availableTrims = useMemo(() => {
  const s = new Set<string>();
  for (const u of units) {
    if (models.size > 0 && !models.has(u.model)) continue;
    if (years.size > 0 && !years.has(u.year)) continue;
    s.add(u.trim);
  }
  return [...s].sort();
}, [units, models, years]);
```

## Active filter chips (line ~262)

Already has chip rendering. Update to:
- One chip per selected model: `Ioniq5 ×` (click X to remove that one)
- One chip per selected year: `MY 2024 ×`
- One chip per selected trim: `Preferred ×`
- Existing chips for drivetrain/region/etc. unchanged

## Tests

Add vitest spec `src/components/InventoryTable.filter.test.ts` (pure
predicate test, no render):
- Empty sets → all units pass
- `models = {Ioniq5}` → only Ioniq5
- `models = {Ioniq5, EV6}` → both pass, others fail
- Year + trim combo → AND semantics

Extract the predicate to a pure fn in `src/lib/inventoryFilter.ts` first
so it's testable without React.

## Acceptance gates

1. `npm run predeploy` exit 0 (TS strict + thermal-validator + next build)
2. `npx vitest run` 108+ specs all pass (new specs add to count)
3. Smoke: hit `/inventory?models=Ioniq5,EV6&years=2024,2025` — should
   show union of those, days-on-lot column unchanged
4. URL state survives reload (Set serialized correctly)
5. Backwards compat: `/inventory?model=Ioniq5` (legacy) still works

## Out of scope for this handoff

- Don't touch the picker (`PickerFilterBar.tsx`) — different surface,
  different UX. Separate ticket if user wants it there too.
- Don't change drivetrain/region filters — single-select is correct
  there (small finite set, dropdown UX wins).
- Don't add a "save filter set" feature (Tier H6 fantasy per audit doc).

## Estimated cost

8-12k tokens on medium. Mostly mechanical given this spec.

## Reference: days-on-lot is already correct

- Field: `u.daysOnLot` populated by build pipeline
- Display: column in InventoryTable, line ~228
- Aging chip: `isAgingOutgoing(year, daysOnLot)` line 211 — fires when
  pre-2025 MY + >90 days on lot. Correct semantics.
- No work needed on this front.
