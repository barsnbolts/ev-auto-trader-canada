# MEDIUM_NEXT.md — mechanical task queue for medium-reasoning sessions

**Read this when picking up on medium reasoning.** Each task is fully
specified — no architectural decisions, no investigation, no "figure out
what to do." If a task here requires judgment, escalate to high.

Phases 0 + 1 from the v2 plan are already shipped (`e75e48d`). What
follows is the medium-friendly slice of Phases 5 + 6 plus housekeeping
that fell out of Phase 1.

---

## M1. Update `NEXT.md` to reflect Phase 0+1 shipped state

`NEXT.md` was last updated 2026-05-01 before this push. The following
items are now SHIPPED and should be moved out of the "On HIGH" section
into a new `## Shipped 2026-05-02` section at the top:

- **Item F (Markup illusion fix)** — replaced by `msrpSource` provenance
  field. Trim parser hardened. Year-relaxed spec lookup added.
  Cite commit: `e28585d`. Outcome: 65/97 false-markup units → 3 true
  unknowns + 42 default-table + 55 spec-lookup.
- **Item L (VERIFY-trim re-scrape)** — was already moot per
  BLOCKERS_MEDIUM.md item 4; keep the closure note.

Also update the "Last updated" line at top to `2026-05-02 after commit `e28585d``.

File: `NEXT.md`. Estimate: 5 min.

---

## M2. Run `ts-prune` and clear cosmetic dead exports

Deep-audit flagged 12 unused TypeScript exports. None are runtime hazards
— pure cosmetic cleanup. Run:

```bash
cd ~/ev-auto-trader-canada
npx ts-prune 2>&1 | grep -v "used in module"
```

For each flagged export, either delete it or document why it's preserved
(e.g. "exported for /api/ route consumers"). Do NOT delete:
- Anything imported by a `.test.ts` (run `grep -rn` first)
- Anything re-exported from a barrel file (`index.ts`)
- Anything matching `Schema$` (zod schemas often look unused but are used
  via `z.infer<typeof Schema>`)

Specific names known stale (per session summary):
- `tailwind.config.ts:52 - default`
- `src/lib/constants.ts:76 - TRIMS_BY_MODEL` (verify; may be used by Phase 1.4 trim catalog work)
- `src/lib/constants.ts:106 - Year`
- `src/lib/scoring.ts:239 - evapCapDeltaCad`

File: multiple under `src/`. Estimate: 15 min.

---

## M3. Add `predeploy` script to `package.json`

Add to `scripts`:

```json
"predeploy": "npm run typecheck && npm run build"
```

Right after the existing `typecheck` line. Then verify it runs:

```bash
npm run predeploy
```

Should end with the standard `Generating static pages` summary and exit
0. If it fails, that's a regression Phase 1 introduced — escalate.

This script is what the daily refresh cron (Phase 5.1) will run before
attempting `git push`. Without it, a broken build can ship to Vercel.

File: `package.json`. Estimate: 5 min.

---

## M4. Manual snapshot capture (daily during buying window)

Already captured today (`data/snapshots/2026-05-02.json`, 100 units, new
schema with `listingUrl` + `vin`). For tomorrow:

```bash
cd ~/ev-auto-trader-canada
git pull --rebase origin main           # ALWAYS first per SESSION_HANDOFF.md
python3 scripts/build_units_from_at.py  # regenerates units.json
node scripts/snapshot.mjs               # writes data/snapshots/YYYY-MM-DD.json
git add data/                           # explicit
git commit -m "data refresh: $(date +%F)"
git push origin main                    # Vercel auto-deploys
```

This is the daily ritual until Phase 5.1 (cron via scheduled-tasks MCP)
ships. If `/tmp/at_listings.json` is missing or stale, escalate — that's
the input file the build script reads, and refreshing it requires the
Apify or search-JSON path from Phase 2 (HIGH-reasoning territory).

Estimate: 5 min wall.

---

## M5. Move `DEFAULT_MSRP` table from build script to `data/oem-pricing.json`

Currently the curated MSRP fallback table is hard-coded inside
`scripts/build_units_from_at.py` at lines 124–148. Phase 3.2 will
auto-refresh this from OEM configurators, so it should live in a JSON
file the script reads.

Steps:
1. Create `data/oem-pricing.json` with shape:
   ```json
   {
     "lastVerified": "2026-05-01",
     "source": "Hand-curated from prior CLAUDE.md",
     "msrp": {
       "EV6": { "Light RWD": 47165, "Wind RWD": 50965, ... },
       "Ioniq5": { ... },
       ...
     }
   }
   ```
2. In `scripts/build_units_from_at.py`, replace the inline `DEFAULT_MSRP`
   dict with code that reads `data/oem-pricing.json` and rebuilds the
   `(model, trim) → msrp` lookup.
3. Re-run `python3 scripts/build_units_from_at.py` — the by-msrpSource
   distribution should be unchanged (same numbers, different source).

File: `scripts/build_units_from_at.py`, new `data/oem-pricing.json`.
Estimate: 20 min.

---

## M6. Bump InventoryTable colSpan if you've added a column

If during work you add or remove an InventoryTable column, **update the
empty-state row's `colSpan`** at line ~579. Currently 14. Mismatched
colSpan renders the empty-state cell only partway across, which looks
broken on mobile.

File: `src/components/InventoryTable.tsx`. Estimate: 1 min, but easy to
forget.

---

## What NOT to do on medium

These are HIGH-reasoning tasks. Do NOT attempt them on medium:

- **Phase 2** (search-JSON probe / Apify integration) — requires DOM
  inspection, network analysis, design call, and live-data interpretation.
- **Phase 3** (Exa heat-pump research / OEM MSRP refresh) — requires
  deciding which sources to trust + writing per-trim confidence notes.
- **Phase 4** (dossier page / transport delta / loyalty flag) — new
  routes, schema changes, scoring math.
- **Phase 5.1** (cron task creation) — requires `mcp__scheduled-tasks__*`
  decisions about what command to run + how to authenticate git push.
- **Anything in `BLOCKERS_MEDIUM.md`** — those are by definition
  high-reasoning issues.

If a task above turns out to need judgment (e.g. ts-prune flags something
that looks load-bearing), STOP and surface it to the user with the
specific name + file + line, not a vague "this seemed risky."

---

## Reference

- Multi-environment pickup ritual: `SESSION_HANDOFF.md`
- Live blockers: `BLOCKERS_MEDIUM.md`
- Long-form work queue (HIGH + MEDIUM): `NEXT.md`
- v2 plan: `~/.claude/plans/you-are-continuing-the-shiny-pixel.md`
- Last commit closing a phase: `e28585d` (phase 1)
