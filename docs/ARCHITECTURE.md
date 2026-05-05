# Architecture — ev-auto-trader-canada

> Top-to-bottom map of how data flows from disk → routes → components.
> Read this when joining a session cold; the codebase has 35+ source
> files and the relationships aren't obvious from the directory tree.

## High-level layers

```
┌───────────────────────────────────────────────────────────────┐
│  ROUTES  (src/app/*)        Next.js 15 App Router            │
│  ────────                                                     │
│   /                  homepage + KPIs                          │
│   /inventory         100-row table, the workhorse view        │
│   /inventory/[id]    per-unit dossier (printable, deep)       │
│   /dealer/[id]       per-dealer page                          │
│   /pick-a-model      brand → model picker UX                  │
│   /pick-a-model/compare  side-by-side compare grid            │
│   /compare           legacy unit-compare                      │
│   /map               leaflet pins for dealers                 │
│   /history           snapshot diff over time                  │
│   /incentives        full incentive table                     │
│   /intel             market-intel page (recalls + warranty)   │
└───────────────────────────────┬───────────────────────────────┘
                                │ pages render with
                                ▼
┌───────────────────────────────────────────────────────────────┐
│  COMPONENTS  (src/components/*)                               │
│  ──────────                                                   │
│   InventoryTable     — main 100-row table                     │
│   UnitDrawer         — slide-over from inventory row click    │
│   CrossSourceChip    — Phase D: surfaces cross-listing prices │
│   UnitVerifyChip     — Phase B: re-fetches AutoTrader live    │
│   UnitPhotoGallery   — Phase C: thumbnails + lightbox         │
│   DealerMap*         — leaflet client wrapper                 │
│   ChargingCurveChart — recharts SVG                           │
│   OtdWaterfallChart  — CSS waterfall (no SVG, prints clean)   │
│   TempSlider         — temp slider w/ ?tempC URL persist      │
│   RefreshButton/Modal— Phase B: spawn refresh_daily.sh        │
│   DockBadgeSync      — Phase C: NSDockTile via Tauri command  │
└───────────────────────────────┬───────────────────────────────┘
                                │ components read via
                                ▼
┌───────────────────────────────────────────────────────────────┐
│  STATE + HOOKS                                                │
│  ─────────────                                                │
│   src/lib/buyerContext.ts    — useBuyerContext() (client)     │
│   src/lib/buyerContextServer — getBuyerContext() (server)     │
│   src/lib/tempContext.tsx    — useTemp() ?tempC URL provider  │
│   src/lib/useFavorites.ts    — localStorage star toggle       │
│   src/store/picker.ts        — Zustand persist (compare tray) │
└───────────────────────────────┬───────────────────────────────┘
                                │ hooks call
                                ▼
┌───────────────────────────────────────────────────────────────┐
│  DATA LAYER  (src/lib/*)                                      │
│  ──────────                                                   │
│   data.ts        — server SSR loader (Vercel)                 │
│   dataClient.ts  — client/Tauri JSON-import loader            │
│                    Both expose loadScoredUnits, loadDealers,  │
│                    loadIncentives, loadSpecs, loadMarketIntel │
│                    loadTaxesAndFees, loadUsedListings,        │
│                    loadMeta, listSnapshotFiles, loadSnapshots │
│   scoring.ts     — applicableIncentives + computeOtd          │
│                    + computeFinanceOtd + computeLeaseOtd      │
│   crossListings.ts — Phase D: VIN/fallbackKey lookup          │
│   thermal.ts     — temp/SoC range + warm-up + DC ramp model   │
│   battery_degradation.ts — year-over-year capacity loss       │
│   aggregations.ts — KPI rollups for homepage                  │
│   format.ts      — fmtCad, fmtKm, fmtKw, etc.                 │
│   tauriRuntime.ts — invoke() bridge, isTauri()                │
└───────────────────────────────┬───────────────────────────────┘
                                │ data layer reads
                                ▼
┌───────────────────────────────────────────────────────────────┐
│  DATA FILES  (data/*.json)                                    │
│  ──────────                                                   │
│   units.json              100 in-stock vehicles               │
│   dealers.json            ~80 Hyundai/Kia franchises          │
│   incentives.json         federal/provincial/OEM cash + APR   │
│   specs.json              per-trim factory spec + thermal     │
│   taxes-and-fees.json     province tax + fee structure        │
│   market-intel.json       recalls + warranty + competitors    │
│   oem-pricing.json        MSRP per (model, trim)              │
│   used-listings.json      depreciation reference              │
│   units-enrichment.json   overlay: photos, daysOnLot, VIN     │
│   cross-listings.json     Phase D: keyed by VIN/fallbackKey   │
│   _kijiji_raw.json        Phase D-core scraper raw output     │
│   _leasebusters_raw.json  Phase D-core scraper raw output     │
│   _scraper_metrics.jsonl  self-improving scraper telemetry    │
│   meta-static.json        build-time mtimes (Tauri only)      │
│   snapshots/YYYY-MM-DD.json  daily diff baseline              │
└───────────────────────────────┬───────────────────────────────┘
                                │ data files updated by
                                ▼
┌───────────────────────────────────────────────────────────────┐
│  PIPELINE  (scripts/*.py + *.sh + *.mjs)                      │
│  ────────                                                     │
│   refresh_daily.sh        cron entry — runs every day         │
│   ├─ build_units_from_at.py    AutoTrader → units.json        │
│   ├─ enrich_units_from_listings.py  enrichment overlay        │
│   ├─ derive_days_on_market.py  snapshot diff → daysOnLot      │
│   ├─ scrape_kijiji.py     Phase D-core: __NEXT_DATA__ walker  │
│   ├─ scrape_leasebusters.py    Phase D-core: SPA scraper      │
│   ├─ scrape_facebook.py   Phase D: login-walled (skeleton)    │
│   ├─ merge_cross_sources.py    builds cross-listings.json     │
│   ├─ snapshot.mjs         daily snapshot write                │
│   ├─ build_static_meta.py Tauri: build-time mtime capture     │
│   └─ verify_unit.py       Phase B: single-VIN re-fetch        │
│                                                               │
│  Shared helpers:                                              │
│   lib_scrape_common.py    HTTP fetch, VIN check-digit, NHTSA  │
│   lib_scrape_metrics.py   JSONL telemetry + adaptive tuning   │
└───────────────────────────────┬───────────────────────────────┘
                                │ Tauri-only:
                                ▼
┌───────────────────────────────────────────────────────────────┐
│  NATIVE SHELL  (src-tauri/*)                                  │
│  ────────────                                                 │
│   src/lib.rs              Rust entry; commands:               │
│     read_data_file        whitelist-guarded JSON reader       │
│     run_refresh           spawn refresh_daily.sh + emit log   │
│     run_verify_unit       spawn verify_unit.py                │
│     set_dock_badge        NSDockTile via objc2 (Phase C)      │
│   tauri.conf.json         Overlay TLs, hidden title bar,      │
│                           CSP for cross-source domains        │
└───────────────────────────────────────────────────────────────┘
```

## Phase ownership

| Phase | What shipped | Where |
|---|---|---|
| **A** | bare working .app | src-tauri/ + dataClient.ts + 11 routes |
| **B** | refresh modal + verify chip | RefreshModal.tsx + UnitVerifyChip.tsx + scripts/verify_unit.py |
| **C** | dock badge + photo gallery | DockBadgeSync.tsx + set_dock_badge cmd + UnitPhotoGallery.tsx + scripts/scrape_unit_gallery.py |
| **D-core** | cross-source listings | CrossSourceChip.tsx + crossListings.ts + scrape_kijiji.py + merge_cross_sources.py + lib_scrape_common.py |
| **D-bis** | OEM Click-to-Buy + D2C | DEFERRED (Apify-walled) |
| **E** | OEM dealer API direct | DEFERRED |

## Key design decisions

1. **Two data layers (data.ts vs dataClient.ts)** — same API, different
   import strategy. Vercel SSR uses node:fs; Tauri uses static JSON
   imports + `read_data_file` Rust command. Routes pick at build time
   via `BUILD_TARGET=tauri`.

2. **Provenance everywhere** — every numeric spec is `CitedValue<T>`
   with confidence tier. Helpers `readNumeric()` and `readHeatPump()`
   tolerate legacy flat values for back-compat.

3. **Stable IDs** — `u-at-<8hex>` for AutoTrader, `u-lb-<8hex>` for
   Leasebusters. SHA1 of (vin || stockNumber+dealerId) → durable
   across snapshots even if listing details change.

4. **Buyer context as cookie** — `BuyerContext` (province + loyalty +
   conquest) lives in a JSON cookie. Every server route reads it; every
   client component subscribes via `useBuyerContext()`. Drives
   `applicableIncentives()` + tax math.

5. **Cross-source merge by VIN, fallbackKey otherwise** — Kijiji exposes
   VIN ~95% of the time; AutoTrader rarely. Merge prefers VIN; falls
   back to `year|make|model|trim` (km dropped from key — see
   merge_cross_sources.py header).

6. **Self-improving scrapers** — every run appends to
   `data/_scraper_metrics.jsonl`. `suggest_max_pages()` reads recent
   history and tunes pagination per source.

## Read order for new sessions

1. `CLAUDE.md` (root) — project overrides + caveman style
2. `docs/handoff/AUTONOMOUS_MODE.md` — never-stop loop
3. `docs/handoff/MEDIUM_RUNWAY.md` — staged tasks
4. `docs/handoff/TOOL_DECISION_MATRIX.md` — pick the right tool BEFORE
   writing scraper code
5. This file — when something feels unfamiliar, check the diagram
6. Per-area docs: CHROME_PROBE.md, LEASEBUSTERS_PROBE.md, DEPLOY.md
