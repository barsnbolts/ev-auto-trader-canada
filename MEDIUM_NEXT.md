# MEDIUM_NEXT.md — mechanical task queue for medium-reasoning sessions

**Read this when picking up on medium reasoning.** Each task is fully
specified — no architectural decisions, no investigation, no "figure out
what to do." If a task here requires judgment, escalate to high.

Phases 0 + 1 are shipped (`e28585d`). M1, M2, M3, M5 from the prior medium
pass are also shipped (`c1d5f69`). M4 (snapshot) ran 2026-05-02. M6
(InventoryTable colSpan reminder) is a "look-out-for" rather than an edit.

A high-reasoning prep pass (`<this commit>`) just landed scaffolds for
Phases 2, 3.1, 4.1, 4.3 — what's below is the mechanical slice of those.

---

## M7. Wire heat-pump UI chip (after L1 fills the queue)

Once `data/heatpump-research-queue.json` has been filled and merged into
`data/specs.json` via `python3 scripts/merge_heatpump_research.py`, surface
the per-trim flag as a chip:

1. **InventoryTable row** — read `spec.hasHeatPump` for the unit's
   (model, year, trim, drivetrain) via the existing `specMap` lookup. Show:
   - `true` → no chip (heat pump is the expected baseline; clutter-free)
   - `false` → red chip "No heat pump" with title `"Trim ships with resistive heater only — expect 25-40% range loss below -10°C"`
   - `null/undefined` → grey chip "Heat pump?" with title `"Not yet researched"`

2. **UnitDrawer** — same logic, larger chip in the spec section.

3. **Dossier page** (`src/app/inventory/[id]/dossier/page.tsx`) — add a
   "Cold-weather kit" line to the Header section: `Heat pump: yes/no/unknown`.

Files: `src/components/InventoryTable.tsx`, `src/components/UnitDrawer.tsx`,
`src/app/inventory/[id]/dossier/page.tsx`. Estimate: 30 min.

If `colSpan` for the empty-state row needs bumping (currently 14 at
`InventoryTable.tsx:587`), do it in the same commit.

---

## M8. Loyalty/conquest checkboxes in selector

Schema + filter logic shipped in this prep. Need: UI + cookie writes.

1. Open `src/components/BuyerProvinceSelector.tsx`. Replace its body with
   a small form that uses `useBuyerContext()` from
   `@/lib/buyerContext` (the new hook) instead of `useBuyerProvince`.
2. Render the existing province dropdown PLUS two checkboxes:
   - "I currently own a Hyundai or Kia" (loyalty)
   - "I currently own a competing brand (Toyota / Honda / Tesla / etc.)" (conquest)
3. On any change call `setBuyerContext({ province, loyalty, conquest })`.
4. Rename the file to `BuyerContextSelector.tsx` and update its import in
   `src/components/Nav.tsx` (or wherever it's mounted).

Files: `src/components/BuyerProvinceSelector.tsx`, `src/components/Nav.tsx`.
Estimate: 25 min.

---

## M9. Migrate getBuyerProvince callers to getBuyerContext

`src/lib/buyerContextServer.ts` exposes `getBuyerContext()` and
`getBuyerProvinceFromContext()`. Find every caller of the old
`getBuyerProvince` from `src/lib/buyerProvinceServer.ts` and update:

```bash
cd ~/ev-auto-trader-canada
grep -rn "getBuyerProvince\b" src/
```

For each call site, prefer `getBuyerContext()` and pass the full context
into `loadScoredUnits`. Then update `loadScoredUnits` signature to take
`buyerContext?: BuyerContext` and pass it into `applicableIncentives`. The
`buyerProvince` field on the returned object stays for back-compat — just
populate it from `buyerContext.province`.

Files: `src/lib/data.ts`, `src/lib/buyerProvinceServer.ts` (delete or
re-export from new module), `src/app/page.tsx`, `src/app/inventory/page.tsx`,
`src/app/compare/page.tsx`, `src/app/dealer/[id]/page.tsx`, etc.
Estimate: 30 min.

---

## M10. Seed Hyundai/Kia loyalty + conquest incentives

`data/incentives.json` has the schema (loyalty/conquest scopes already
typed) but no entries yet. Add the current-month programs from the OEM
sites:

- **Kia loyalty cash** — typically $500-$1,000 to existing Kia owners on EV6 / EV9
- **Kia conquest cash** — competitive owner bonus on EV6 / EV9
- **Hyundai loyalty rate reduction** — 0.5-1.0% APR cut for current Hyundai owners on Ioniq 5/6/9
- **Hyundai conquest cash** — competitive owner bonus on Ioniq 5/6

Use `data/incentives.json` as the schema reference (existing federal +
provincial entries show the exact field shape). Set `scope: "loyalty"` or
`scope: "conquest"`, `appliesTo.models`, `effectiveUntil`, `lastVerified`.

Verification: with both buyer-context checkboxes on, applicable-incentive
count should jump for matching units. With both off, score is unchanged
from today.

Files: `data/incentives.json`. Estimate: 25 min including OEM site lookup.

---

## M11. Add Dossier link column to InventoryTable

The dossier route (`/inventory/[id]/dossier`) is shipped. UnitDrawer
already links it. The row itself needs an inline link too.

1. Add a small "📄" or "Dossier" link in the actions column of each row
   in `src/components/InventoryTable.tsx`.
2. Bump `colSpan` for the empty-state row at line ~587 if you added a
   visible column (vs. squeezing into existing actions).
3. `<Link href={\`/inventory/\${u.id}/dossier\`}>` — use Next's Link, not
   a plain `<a>`, so client-side nav stays fast.

Files: `src/components/InventoryTable.tsx`. Estimate: 10 min.

---

## M12. Run Apify scrape + merge enrichment

`docs/APIFY_AUTOTRADER.md` has the actor (`calm_builder/autotrader-canada`)
+ canned input (`docs/apify_inputs/ontario_full.json`) +
transform script (`scripts/apify_to_enrichment.py`).

Sequence:

```bash
# 1. Trigger run via MCP (input file already canned)
mcp__Apify__call-actor calm_builder/autotrader-canada \
  --input @docs/apify_inputs/ontario_full.json

# 2. Poll mcp__Apify__get-actor-run for status === SUCCEEDED

# 3. Pull dataset
mcp__Apify__get-actor-output <runId> > /tmp/apify_at.json

# 4. Merge into data/units-enrichment.json
python3 scripts/apify_to_enrichment.py --input /tmp/apify_at.json

# 5. Re-build units.json (the new daysOnLot + VIN flow in via merge)
python3 scripts/build_units_from_at.py

# 6. Commit + push
git add data/ && git commit -m "data refresh via apify $(date +%F)" && git push
```

Cost ceiling: ~$0.75/run. Self-imposed budget cap: $30 cumulative — track
in commit messages.

Files: `data/units.json`, `data/units-enrichment.json`. Estimate: 15 min wall.

---

## M13. Refresh incentives via Exa

NEXT item I, formalized:

```bash
# Per OEM, fetch the promo page text
mcp__9a04470a-c5be-420d-a32b-adaaa7f50b13__web_fetch_exa
  url: https://www.hyundaicanada.com/en/offers
mcp__9a04470a-c5be-420d-a32b-adaaa7f50b13__web_fetch_exa
  url: https://www.kia.ca/en/offers
```

For each promo found, update or add an entry in `data/incentives.json`:

- `scope`: `manufacturer_cash` for cash bonuses; `loyalty` / `conquest`
  for those programs (saves M10 work if you batch them)
- `effectiveFrom` / `effectiveUntil` from the page
- `lastVerified`: today
- `source`: the OEM URL

Files: `data/incentives.json`. Estimate: 20 min.

---

## M14. Schedule daily refresh cron (Phase 5.1)

```
mcp__scheduled-tasks__create_scheduled_task
  schedule: "0 11 * * *"   (7am ET = 11 UTC during DST)
  command: |
    cd ~/ev-auto-trader-canada \
      && git pull --rebase origin main \
      && python3 scripts/build_units_from_at.py \
      && node scripts/snapshot.mjs \
      && npm run predeploy \
      && git add data/ \
      && git commit -m "data refresh: $(date +%F)" \
      && git push origin main
  description: Daily AutoTrader refresh + snapshot + Vercel deploy
```

Note: the cron does NOT run Apify by default — that's a paid call. Add
the Apify step manually when you want a paid refresh, or schedule a
separate weekly cron with the Apify command.

Estimate: 5 min.

---

## What NOT to do on medium

These remain HIGH-only:

- **Phase 2.1** — Chrome MCP probe (live DOM/network analysis)
- **Phase 3.2** — OEM MSRP configurator crawl (parsing variability)
- **Anything in `BLOCKERS_MEDIUM.md`** — high-reasoning by definition

If a task above turns out to need judgment, STOP and surface it to the
user with the specific name + file + line.

---

## Reference

- Multi-environment pickup ritual: `SESSION_HANDOFF.md`
- Live blockers: `BLOCKERS_MEDIUM.md`
- LOW-reasoning fill tasks: `LOW_NEXT.md`
- Long-form work queue (HIGH + MEDIUM): `NEXT.md`
- Apify operator notes: `docs/APIFY_AUTOTRADER.md`
- Chrome probe runbook: `docs/CHROME_PROBE.md`
- v2 plan: `~/.claude/plans/you-are-continuing-the-shiny-pixel.md`
