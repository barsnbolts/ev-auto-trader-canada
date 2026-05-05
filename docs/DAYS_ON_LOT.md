# daysOnLot derivation

How `unit.daysOnLot` gets computed from the snapshot history. Signal feeds
`SCORING.DAYS_ON_LOT_MAX=120` in `src/lib/constants.ts` and the dealer-
pressure index used for deal scoring.

## Pipeline

```
data/snapshots/YYYY-MM-DD.json   (one per cron run, kept latest 14 by E3 pruner)
        │
        ▼
scripts/derive_days_on_market.py  ← walks snapshots oldest→newest, records firstSeen per stable id
        │
        ▼
data/units-enrichment.json        ← keyed by unit id, holds {daysOnLot, firstSeenInSnap}
        │
        ▼
scripts/build_units_from_at.py    ← merges enrichment overlay into data/units.json
        │
        ▼
data/units.json[*].daysOnLot      ← consumed by InventoryTable + DealScoreBadge + dealerPressureIndex
```

## Key invariant

The daysOnLot signal is keyed by **stable IDs** (`u-at-<8hex>` namespace —
SHA1 of the listing URL, truncated). Anything else gets dropped by the
script's regex filter. This means:

- Listings that change URL between snapshots get a new ID and reset to 0
  daysOnLot. Trade-off: undercount on URL-rotating listings vs phantom
  history when an old ID gets reused. We chose undercount.
- Pre-stable-ID snapshots (before the migration) filter out entirely.

## Refresh cadence

Runs as part of `refresh_daily.sh` AFTER `build_units_from_at.py`:

1. AT scrape → `data/_autotrader_raw.json`
2. Build units (no enrichment) → `data/units.json`
3. Snapshot the day → `data/snapshots/YYYY-MM-DD.json`
4. Derive daysOnLot → `data/units-enrichment.json`
5. Re-build units (with enrichment) → `data/units.json` (now with `daysOnLot`)

## Known limitation: relisted units overstate

When a unit sells, gets relisted within a day, and the URL stays stable,
the script credits the original firstSeen — so `daysOnLot` keeps climbing
across the gap. Per derive_days_on_market.py docstring, this is an
accepted v1 limit until 7+ days of real cron history exposes a case.
Mitigation later: detect `lastSeen` gap > 2 days as a "lifecycle reset"
signal and re-bucket.

## Why 120 days as the score ceiling

Empirical Ontario dealer behavior: most lots cycle inventory in 60-90
days. 120 captures the upper tail (about 5-10 % of EV inventory) without
saturating. See `SCORING.DAYS_ON_LOT_MAX` in `src/lib/constants.ts` for
the named constant; `daysOnLotScore()` in `src/lib/scoring.ts` for usage.

## Verification

```bash
python3 scripts/derive_days_on_market.py    # rebuild enrichment
jq '[.[] | .daysOnLot] | sort | .[-5:]' data/units.json
# top-5 oldest units by daysOnLot — sanity-check vs lot age
```
