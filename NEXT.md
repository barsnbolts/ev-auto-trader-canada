# NEXT — work queue split by reasoning intensity

Last updated 2026-05-02 after commit `e28585d` (Phase 1 close).

Ian is buying within 1-2 weeks. Everything below is scoped to "ship value
this week, drop the rest." Order is sequenced for that deadline.

---

## Shipped 2026-05-02

- **Item F (Markup illusion fix)** — replaced by `msrpSource` provenance
  field on every unit. Trim parser hardened (Ioniq5 Ultimate, Ioniq9
  Calligraphy/Performance, EV9 GT-Line variations). Year-relaxed spec
  lookup added. Commit `e28585d`. Outcome: 65/97 false-markup illusion
  resolved → 55 spec-lookup, 42 default-table, 3 true unknowns.
- **Item L (VERIFY-trim re-scrape)** — closed. Per BLOCKERS_MEDIUM #4 +
  the trim parser hardening above, leftover trims now render as
  "Trim unknown (<title>)" carried by the `msrpSource` chip rather than a
  VERIFY: prefix.

---

## On HIGH (do while reasoning is up — design / judgment / multi-file)

### A. Buyer-province OTD perspective ⭐ highest leverage
Currently `computeOtd` taxes by **dealer's** province. If a Calgary dealer
is cheapest, OTD shows GST-only — but Ian (ON) actually pays HST 13%. Adds
$5-6k swing on a $50k unit. Whole top-deals ranking is currently wrong for
out-of-province deals. Add a buyer-province selector at the top of
`/inventory` (default ON, persisted to localStorage), thread it through
`loadScoredUnits` → recomputes salesTax + OTD per buyer's province. Keep
dealer's province for dealer-fee section (OMVIC etc. still apply per
dealer).
Files: `src/lib/scoring.ts`, `src/lib/data.ts`, `src/components/InventoryTable.tsx`.
Estimate: 30-45 min.

### B. Out-of-province transport cost line in OTD
If `dealer.province !== buyerProvince`, add a "Transport (estimate)" line
to OTD breakdown. Heuristic by distance band: same-province $0, neighbour
$1,200, cross-country $2,500. Configurable in `data/transport-bands.json`.
Show as separate line so it's obvious.
Files: same as A + new JSON. Estimate: 20 min.

### C. $/km of range column (decision metric)
True comparability is dollars-per-kilometer-of-range. Pull `rangeKm` from
`data/specs.json` keyed on (model, year, trim, drivetrain) — already the
specMap shape. Show in `InventoryTable` as a sortable column AND
prominently in the drawer header. When spec missing, render "—" not 0.
Files: `src/components/InventoryTable.tsx`, `src/components/UnitDrawer.tsx`.
Estimate: 25 min.

### D. Heat-pump trim flag
Ontario winters → 25-40% range loss without a heat pump. Audit
`data/specs.json` for which trims have one (research via OEM Canada sites);
add `hasHeatPump?: boolean` to `SpecSchema`; chip in row + drawer for trims
without one. Lookup is per-trim per-MY — slow research, fast UI wire-up.
Files: `src/lib/types.ts`, `data/specs.json`, table + drawer.
Estimate: 1 hr (mostly the research).

### E. Score reweighting once enrichment lands
After `enrich_units_from_listings.py` populates daysOnLot, the current
weights (price 35%, incentive 30%, pressure 20%, days 15%) overcount
because pressure and days are both age-driven. Drop pressure to 15%, days
to 10%, lift price to 40%. Decision needs to be made AFTER seeing real
data — sample 10 enriched units and judge.
File: `src/lib/scoring.ts`. Estimate: 15 min after enrichment runs.

### F. Markup illusion fix (65/97 units have asking > MSRP)
Three causes: (1) DEFAULT_MSRP table from `build_units_from_at.py` is stale
2024 pricing; (2) trim-match grabs the wrong (cheaper) trim; (3) some
dealers genuinely mark up. Fix the script's defaults by spot-checking 5
trims via Hyundai/Kia configurators. Mark unverified MSRPs as
`{value, confidence: "Low"}` — the cited-value pattern from the EV
dashboard project — and surface "MSRP unverified" badge.
Files: `scripts/build_units_from_at.py`, `data/units.json`, table.
Estimate: 45 min.

---

## On MEDIUM (mechanical execution — run later, in any order)

### G. Run `scripts/enrich_units_from_listings.py`
Walks every `listingUrl`, populates `data/units-enrichment.json` with
daysOnLot + vin + dealer phone + dealer address + msrp. ~5 min wall.
Polite 2.5s sleep. Resumable with `--ids` if some URLs fail.
Then commit `data/units-enrichment.json` and push — Vercel rebuilds.

### H. Pagination for `build_units_from_at.py`
Current scrape is page 1 only ≈ 100 of ~1,500 nationwide listings. Loop
pages 1-15. Same dealer dedup logic handles overlap. ~10 min per run when
done.

### I. Re-fetch incentives from OEM promo pages
Hyundai Canada `/promotions`, Kia Canada `/offers`. WebFetch each, update
`data/incentives.json` with current `effectiveUntil` + amounts. Daily
during the buying window.

### J. Daily snapshot ritual
Run `scripts/snapshot.py` (if it exists in this repo — check; if not,
reuse the EV dashboard one) to capture `data/snapshots/YYYY-MM-DD.json`.
After 3-5 days the days-on-lot inferred-from-firstSeen logic gets real.

### K. Dealer phone backfill
After enrichment runs, the script populates phone/address per LISTING,
not per dealer. Roll those up into `data/dealers.json`: for each dealer
without phone, take the most-common phone from its enriched units.

### L. VERIFY-trim re-scrape
3 units were dropped because the trim regex couldn't classify. Improve
`match_trim()` in `build_units_from_at.py` to handle "W/PREMIUM PKG" and
similar marketing suffixes — or hand-classify the 3 specific titles in a
small override map.

---

## Pre-purchase manual ritual (every day or two)

1. `git pull` (in case of overnight commits)
2. Run scrape: `python3 scripts/build_units_from_at.py`
3. Run enrichment: `python3 scripts/enrich_units_from_listings.py`
4. Refresh incentives: re-fetch OEM promo pages, update `incentives.json`
5. `git add data/ && git commit -m "data refresh: $(date +%Y-%m-%d)"`
6. `git push origin main` → Vercel rebuilds in ~1 min
7. Open the live site, scan Top deals + Expiring incentives banner,
   star anything worth a follow-up

---

## Deferred (out of scope for this purchase)

- Lease vs cash break-even math (Ian is cash-only)
- Total cost of ownership over 3-5 years
- Insurance estimates per trim
- Photos in row (AutoTrader thumbnails)
- Real interactive radius-from-postal-code map
- DealerRater reviews integration
- Trim equivalence cross-brand badges (nice-to-have, not decision-critical)

---

## Architectural debts (worth noting, not urgent)

- `app/page.tsx` is `dynamic = "force-static"` so any data refresh requires
  a Vercel rebuild. Acceptable while data refreshes are manual; would
  matter only if going to a polling background job.
- 12 unused TypeScript exports flagged by deep-audit (cosmetic).
- `dealer.address` is required-string in schema but accepts the literal
  "Address not yet captured" placeholder. Could split into
  `address?` (optional) + `addressKnown: boolean` for explicitness.
