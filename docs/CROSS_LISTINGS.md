# Cross-listings join algorithm

How `data/cross-listings.json` gets built from per-source raw scrapes.
Owner: `scripts/merge_cross_sources.py`. UI consumer: `src/lib/crossListings.ts`.

## Inputs

| File | Source | Schema highlights |
|---|---|---|
| `data/units.json` | AutoTrader (built via `build_units_from_at.py` from `data/_autotrader_raw.json`) | `id`, `vin?`, `year`, `model`, `trim`, `dealerAskingPrice`, `listingUrl`, `dealerId` |
| `data/_kijiji_raw.json` | Kijiji Autos (`scripts/scrape_kijiji.py`) | `vin`, `year`, `make`, `model`, `trim`, `mileageKm`, `priceCad`, `province`, … |
| `data/_leasebusters_raw.json` | Leasebusters HTML scrape | `year`, `make`, `model`, `trim`, `mileageKm`, `monthlyPaymentCad`, `monthsRemaining`, `cashIncentiveCad` (no VIN — confirmed via probe doc) |

## Indexing strategy — VIN primary, fallbackKey backup

```
canonical_key(entry) =
    "vin:<UPPERCASED VIN>"   if entry has VIN
    "fk:<fallbackKey>"       otherwise
```

`fallbackKey` collapses to:

```
year | make.lower() | normalized_model
```

We deliberately drop **trim** and **kmBucket** from the join key. Reasons:

- **Trim format mismatch**: AT writes trims like `"Land Long Range AWD"`,
  Kijiji writes `"Land AWD w/ Plus Package"`. Same car. Empirically (sanity-check
  2026-05-04) keeping trim in the join lost ~98 % of joinable Kijiji-AT pairs.
- **km bucketing**: AT rarely exposes km; Kijiji always does. Bucketing AT's
  `km=null` to `"any"` and Kijiji's `km=42103` to `"42000"` would never match.
  km is preserved per-listing for downstream filtering / display.

## Why VIN first

VIN is a 17-char ISO 3779 identifier — unique per vehicle. Same VIN across two
sources = same car. Period. fallbackKey is a probabilistic match: same year +
make + model could be many distinct vehicles. We use it only when no source
has a VIN for the entry.

Today's empirical state (2026-05-05, post-I0e):
- AT: ~6 / 34 listings have VIN (~18 %, growing as detail-fetch backfills).
- Kijiji: 236 / 251 listings have VIN (~94 %).
- Cross-source overlap by VIN: 0 today (small dataset, will grow).
- Cross-listings entries today: 17 (all multi-listing same-source — multiple
  AT dealers selling same year+make+model trim).

## Emit rule

A bucket is written to `cross-listings.json` if any of:

- `len(sources) > 1` — true cross-source price comparison value
- `len(listings) > 1` — multi-dealer same-source comparison (price-shop a trim)
- contains a leasebusters listing — solo lease-takeover entry has its own UI

Solo single-dealer AT listings are **not** emitted here — they're already
in `data/units.json` and surfaced via InventoryTable directly. cross-listings
exists specifically for the comparative chips on rows / dossier headers.

## Worked example

```
AT:    KMHKR4DH5PU123456 / 2024 Hyundai Ioniq5 Preferred RWD / $48,995 / Mississauga
Kij:   KMHKR4DH5PU123456 / 2024 Hyundai Ioniq5 Preferred / $46,500 / Markham
LB:    --- (no VIN)         / 2024 Hyundai Ioniq5 Preferred / lease takeover

Buckets created:
  vin:KMHKR4DH5PU123456  ← AT + Kij join here (VIN match)
  fk:2024|hyundai|ioniq5 ← LB lands here alone
```

The first bucket emits because it has 2 sources. The second emits because
it has a Leasebusters entry. UI shows both as cross-listing chips on the AT
unit row: "Same VIN at Markham, $2,495 cheaper" + "Lease takeover available".

## Re-run

```bash
python3 scripts/merge_cross_sources.py
# cross-listings.json: N entries from M candidates
```

Wired into both `refresh_daily.sh` (after AT + Kijiji + Leasebusters scrapes)
and `refresh_weekly.sh` (after the heavier dealer + FB scrapes).

## Future expansion

- **Facebook Marketplace**: add `"facebook"` source via jdcodes1 MCP integration
  (TIER I1a). VIN coverage on FB is poor (private sellers); fallbackKey-only joins.
- **Per-dealer scraper**: TIER I1b adds `"dealer_site"` source via Crawl4AI.
  JSON-LD `vehicleIdentificationNumber` on most modern dealer sites — high VIN
  coverage expected.
