# scripts/

Stdlib-only Python (+ a couple `.sh` and `.mjs`) for the data pipeline.
No pip dependencies. Run from the repo root unless noted.

## Daily refresh chain (cron-fired via `refresh_daily.sh`)

```
scrape_kijiji.py         # pulls Kijiji EV listings
scrape_leasebusters.py   # TODO: Chrome MCP probe still needed
build_units_from_at.py   # rebuilds data/units.json from AutoTrader SSR
enrich_units_from_listings.py    # spec/heat-pump enrichment overlay
derive_days_on_market.py # snapshot-diff daysOnLot
merge_cross_sources.py   # joins per-source raw → cross-listings.json
build_static_meta.py     # data/meta-static.json for Tauri build
snapshot.mjs             # writes data/snapshots/YYYY-MM-DD.json
validate_data_schemas.py # predeploy gate (also runs ad-hoc)
```

`refresh_daily.sh` orchestrates the above + commits the data delta on
the working branch.

## Per-script

| Script | Purpose | Inputs | Outputs |
|---|---|---|---|
| `apify_to_enrichment.py` | Convert Apify run dataset → enrichment overlay (deferred — Apify off by default per $30 cap) | `data/_apify_*.json` | `data/units-enrichment.json` |
| `apply_battery_supplier.py` | Tag specs with battery cell supplier (LG / SK / CATL) | `data/specs.json` + curated CSV | mutates specs.json |
| `build_heatpump_queue.py` | Generate research queue rows for heat-pump status | `data/specs.json` | `data/heatpump-research-queue.json` |
| `build_static_meta.py` | Snapshot file mtimes + snapshot list at build time | `data/*.json`, `data/snapshots/` | `data/meta-static.json` |
| `build_units_from_at.py` | Parse AutoTrader SSR HTML → InventoryUnit[] | local raw HTML / Apify dataset | `data/units.json` |
| `derive_days_on_market.py` | Walk snapshots oldest→newest, compute first-seen per stable ID | `data/snapshots/*.json` | merges into `data/units-enrichment.json` |
| `enrich_units_from_listings.py` | Layer per-listing details (km, kmlow, color) onto units | listing raw + units.json | mutates `data/units-enrichment.json` |
| `lib_scrape_common.py` | Shared HTTP fetch + VIN check-digit + NHTSA decode + Apollo cache walker | (library — no entry point) | (importable functions) |
| `lib_scrape_metrics.py` | Per-source telemetry recorder | scraper exit handlers | `data/_scraper_metrics.jsonl` |
| `merge_cross_sources.py` | Cross-source merger (VIN-preferred join) | `data/_*_raw.json` | `data/cross-listings.json` |
| `merge_heatpump_research.py` | Apply researched heat-pump answers | research queue + specs | mutates specs.json |
| `refresh_daily.sh` | Cron entrypoint — runs the full chain | (none) | git commit + push on data delta |
| `scrape_facebook.py` | Skeleton (login-walled, deferred to future Stream) | — | — |
| `scrape_kijiji.py` | Kijiji EV listings via `__NEXT_DATA__` Apollo cache walker | live HTTP | `data/_kijiji_raw.json` |
| `scrape_leasebusters.py` | TODO — needs Chrome MCP probe (XHR endpoint not yet captured) | — | `data/_leasebusters_raw.json` |
| `scrape_unit_gallery.py` | Per-unit AutoTrader photo gallery scraper | listing URLs | `data/unit-photos.json` |
| `snapshot.mjs` | Daily JSON snapshot of units.json with `takenAt` | `data/units.json` | `data/snapshots/YYYY-MM-DD.json` |
| `track_apify_spend.py` | Apify spend ledger (manual record) | — | `data/_apify_spend.jsonl` |
| `validate_data_schemas.py` | Schema-drift catcher (presence + leaf type + enum + cross-ref) | all `data/*.json` | exit 0 / 1 + diagnostic output |

## Library helpers (importable, no entry point)

### `lib_scrape_common`
- `fetch_html(url, timeout, http2)` — curl wrapper
- `is_valid_vin(vin)` + `vin_check_digit_ok(vin)` — strict VIN validation
- `vins_in_text(text, validate)` — extract VINs from arbitrary text
- `extract_next_data(html)` — pull `__NEXT_DATA__` JSON from Next.js SSR
- `apollo_entities(next_data, type_prefix)` — walk Apollo cache by type
- `nhtsa_decode(vin, timeout, use_cache)` — VIN → make/model/year via
  NHTSA vPIC (cached in `data/_vin_cache.json`, 30-day TTL)
- `province_from_address(addr)` — Canada province extractor
- `now_iso()` — UTC ISO timestamp
- `fallback_key(year, make, model, trim, mileage_km)` — cross-source
  join key when VIN unavailable (5000-km bucket — note asymmetry with
  TS `makeFallbackKey` per docs/INVARIANTS.md)

### `lib_scrape_metrics`
- `record_run(source, fetched, unique, vin_pct, vin_checksum_ok_pct,
  errors, pages_walked, duration_s, max_pages_hit, notes)` — append
  one telemetry record per scraper run

## Where output goes

All data lives under `data/`:
- Hand-curated source files (commit-tracked): `dealers.json`,
  `oem-pricing.json`, `incentives.json`, `taxes-and-fees.json`,
  `specs.json`, `vehicle-images.json`, `transport-bands.json`
- Pipeline-generated (commit-tracked): `units.json`, `cross-listings.json`,
  `unit-photos.json`, `units-enrichment.json`, `meta-static.json`
- Pipeline-generated runtime caches (commit-tracked, used as warm
  cache across cron runs): `_vin_cache.json`, `_scraper_metrics.jsonl`
- Snapshots: `snapshots/YYYY-MM-DD.json`

## CLAUDE.md NO-list

These scripts intentionally **don't exist** and shouldn't be added:
- No code-signing / notarization wrappers (Tauri build is unsigned by design)
- No DMG creation
- No PyPI publishing (this stays personal-use)
- No `npm install`-time scripts (`prepare`/`postinstall`) that mutate data
