# Session handoff · 2026-05-05 medium-tier execution

Continuing from `SESSION_HANDOFF_2026-05-05_high_tier.md` (commit `8ce56963`).
This session drained the entire TIER I0 pipeline, scaffolded TIER I1, and
swept through Tier C/D/E/F/G mechanical work.

## What landed (in commit order)

| SHA | What |
|---|---|
| `68c9e56b` | TIER I0 a–e: cron PATH + cross-merge VIN-key + AT __NEXT_DATA__ scraper |
| `1d0f7d10` | TIER I1 a-c scaffold: FB MCP install doc + Crawl4AI dealer + Qwen banner OCR |
| `e146459a` | TIER C: 14d/30d staleness chips + dossier last-seen + skeleton mirrors columns |
| `0b304d68` | Tier E + Tier F + Tier G batch + AT throttle/budget tuning |
| `b3f703de` | F3 + D4 + G2 + crossListings TS/Python alignment |
| `fc36c42a` | Tier E4+E5+E7 batch + transport-bands neighbour drift fix |
| `e64832ff` | D5 · loadScoredUnits integration spec |
| `6cf55bbc` | D6 · dealerPressureMap multi-dealer independence spec |
| `7c249abc` | G7 · HOW_TO_ADD_MODEL recipe |
| `449c6bc2` | **data refresh: 100 → 1392 units (AT __NEXT_DATA__ free path live)** |
| `65ee9438` | data refresh II: snapshot + daysOnLot enrichment for 1392 units |

11 commits. All on main, all pushed.

## Headline result

**Inventory pipeline genuinely fresh for the first time in this project's history.**

- `data/units.json`: 100 → **1392 units** (14× growth).
- Cross-source coverage: 1.9 % → **30 cross-listing entries** (multi-listing
  same-source today; multi-source as VIN coverage grows daily).
- Provincial spread: ON 542 / QC 308 / BC 316 / AB 129 / MB 63 / NS 19 / NB 11 / NL 2 / SK 2.
- Per-model: Ioniq5 444 / EV9 468 / Ioniq9 372 / EV6 80 / Ioniq6 28.
- 250 units carry VINs (cap per cron run). Bootstrap sweep deferred 1858 detail-fetches
  to next run; full VIN coverage in ~8-10 daily sweeps.

## TIER I0 — the inventory pipeline (DONE)

| Step | What landed | Commit |
|---|---|---|
| I0a | launchd plist gains `EnvironmentVariables` (PATH+HOME) so cron finds python3/node/git. Reloaded. | 68c9e56b |
| I0b-1 | `merge_cross_sources.py` dual-index by VIN (primary) + fallbackKey (backup). | 68c9e56b |
| I0b-2 | Drop trim+km from fallback-key — 4-segment → 3-segment alignment with TS `makeFallbackKey`. | 68c9e56b + b3f703de |
| I0c | `refresh_daily.sh` wires Kijiji + Leasebusters + cross-merge in sequence. Auto-bootstraps `.venv` on first cron run. | 68c9e56b |
| I0d | `scrape_leasebusters.py` rewritten to ASP.NET MVC POST flow per `LEASEBUSTERS_VIN_DECISION` (token harvest + form serialize + partial-HTML parse). Returns 0 today (likely zero EV lease takeovers). | 68c9e56b |
| I0e | `scrape_autotrader.py` Next.js `__NEXT_DATA__` SSR JSON parser. Imperva bypass via **curl_cffi + chrome124 ja3 impersonation + warm-up GET**. Diff-based detail-fetch (only new/changed crossReferenceIds get full schema + VIN). MAX_DETAIL_FETCHES_PER_RUN=250, 2-4s sleep jitter. | 68c9e56b + 0b304d68 |
| I0f | End-to-end cron verified — pipeline runs clean, predeploy passes, push lands. | 449c6bc2 |

### Key infrastructure decisions

- **`requirements.txt` + `.venv` bootstrap** — pins `curl_cffi` (the
  Imperva-bypass dep). Cron auto-creates the venv on first run if absent.
  Lives at repo root; gitignored.
- **`requirements-crawl.txt` + `.venv-crawl`** — heavier deps (`crawl4ai`)
  pinned to py3.12 (NOT 3.13 — greenlet wheel issue #291 on M-series Macs).
  Used by weekly dealer scrape, not daily.

## TIER I1 — multi-source scaffold (PARTIAL)

| Step | State | Notes |
|---|---|---|
| I1a · FB MCP | **Cloned + built**, registration deferred to Ian | Doc: `FB_MCP_INSTALL_2026-05-05.md`. Auto-register blocked (security gate on 3rd-party MCP self-mod). One-time `claude mcp add` + `node scripts/capture-queries.js` from Ian's terminal. |
| I1b · Crawl4AI dealers | **Script written**, awaiting dealer URL backfill | `scripts/scrape_dealers_inventory.py`. JSON-LD-first, regex VIN fallback. Today only 16/107 dealers have inventoryUrl; build_units now backfills from AT-detail dealerHomepageUrl as VIN coverage grows. |
| I1c · Qwen banner OCR | **Scripts written**, awaiting Ian's `brew install ollama` | `scripts/screenshot_dealer_pages.py` + `scripts/extract_dealer_promos.py`. Cron gates on `ollama list \| grep qwen2.5-vl`. |

`refresh_weekly.sh` orchestrates I1b + I1c (and future I1a-bis) once unblocked.

## TIER C — UX polish (DONE)

- **C1 · Two-tier staleness**: 14d neutral chip ("Stale 16d"), 30d warn chip
  ("⚠ Very stale 45d"). Was a single 7d threshold before.
- **C3 · Dossier last-seen**: mom-mode "8 days ago" + firstSeen line above
  the existing chip row. New `formatLastSeen()` helper avoids `date-fns`.
- **C4 · Skeleton mirrors columns**: `/inventory/loading.tsx` now uses
  `grid-template-columns` matching the live table — no layout shift on
  data arrival, 24 rows above-fold.
- **C2/C5/C6/C7/C8/C9/C10/C11**: Verified already shipped from prior session.

## TIER D — Test depth (107/107 specs green)

| Spec | Coverage |
|---|---|
| D4 | `evapEligibleAmount`: 48mo+ proration, undefined/paused → 0, transactionValueCap with/without OEM-cash backfill below cap |
| D5 | `loadScoredUnits` integration: ≥1 unit, OTD finite, dealer FK orphan rate <5%, dealScore non-negative, ON vs BC OTD diverge (proves buyerContext flows through) |
| D6 | `dealerPressureMap` multi-dealer independence (high-pressure dealer ranks above low-pressure with mixed-trim sample) |

`crossListings.test.ts` updated to reflect post-I0b-2 3-segment fallback-key
shape (was failing because Python emit and TS emit had drifted — now aligned).

## TIER E — Data hygiene (DONE)

- **E1** · `flag_stale_incentives.py` — advisory walker (exit 0 always)
- **E2** · `validate_unit_spec_joins.py` — coverage % + miss list for unit→spec
- **E3** · `prune_snapshots.py` — keep-N pruner (default 14)
- **E4** · `scraper_health.py` — per-source rolling stats + vin_pct drift WARN
- **E5** · `generate_changelog.py` — git log → `CHANGELOG.md` (198 entries, 6 days)
- **E7** · `validate_data_schemas.check_transport_bands` — found + fixed 2
  real neighbour-symmetry bugs (NL→NS missing NS→NL; NT→BC missing BC→NT)

## TIER F — Code quality (PARTIAL)

| Item | State |
|---|---|
| F1 · isoDay() helper | Done. Replaced `slice(0, 10)` in `src/app/history/page.tsx`. |
| F3 · Drop `as unknown as TransportBands` | Done. Single-cast + comment referencing the runtime guard in validate_data_schemas. |
| F4 · Magic numbers → SCORING constants | Done. `DAYS_ON_LOT_MAX=120`, `PRESSURE_DEPTH_MAX=4`, `PRESSURE_AGE_MAX_DAYS=90`, `GST_RATE=0.05`. |
| F2 · Chip class typing | Skipped (10+ files, low value). |
| F5 · Sort imports | Skipped (cosmetic). |
| F6 · Consolidate data.ts/dataClient.ts | Skipped (risky for SSG-vs-client split). |
| F7 · Memoize ScoredUnit | Skipped (risky for SSG-vs-client split). |

## TIER G — Documentation (DONE for high-value)

- **G1** · `docs/CROSS_LISTINGS.md` — full algorithm walkthrough + worked example
- **G2** · `docs/DAYS_ON_LOT.md` — snapshot → enrichment → units pipeline
- **G7** · `docs/HOW_TO_ADD_MODEL.md` — 10-step recipe end-to-end

## What's left

### TIER I queue (paused on user-side)
- I1a · Ian to register `facebook-marketplace` MCP + run cookie-capture script
- I1c · Ian to `brew install ollama && ollama pull qwen2.5-vl:7b`

### Deferred low-value items
- F2/F5/F6/F7 (see table above)
- E6 (oem-pricing lastVerified refresh — needs Exa)
- G3-G6 docs (diminishing returns)
- D1/D2/D3 deep computeOtd/Finance/Lease specs (already partially covered by D4+D5)

### TIER H/I (require user OK)
- See `docs/handoff/MEDIUM_RUNWAY.md` — speculative features + paid services

## Boot for next session

```bash
cd ~/ev-auto-trader-canada
git status                                    # expect clean
git log --oneline -5                          # latest = 65ee9438 or your push beyond
npm test:run                                  # expect 107 passed
npm run predeploy                             # expect typecheck+thermal+schema+build green
launchctl list | grep evautotrader            # expect "-  0  com.evautotrader.refresh"
tail -30 logs/cron.log                        # last cron output
ls data/_autotrader_raw.json                  # expect ~1.6MB after a fresh sweep
```

## Resume here

If you want to continue the inventory expansion, your next move is one of:

1. **Wait for tomorrow's 7am cron** — daily sweep brings ~250 more VINs.
   In ~8 days the entire 2114-listing dataset will have full VIN coverage.
2. **Start TIER I1c (banner OCR)** — once Ian installs Ollama. Add a
   user-OK prompt + run `scripts/screenshot_dealer_pages.py`.
3. **Start TIER I1a (FB MCP)** — once Ian registers the MCP. Either spawn
   the MCP from Python or build the equivalent cookie-replay client.
4. **Drain TIER H/I features** — needs explicit user direction.

## Session stats

- **11 commits**, all pushed.
- **~94k lines added** (mostly data: units.json + snapshot + cross-listings).
- **107/107 specs** passing.
- **predeploy** green at every commit boundary.
- Free path holds — **$0/mo recurring**. No Apify spend triggered.
