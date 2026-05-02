# MEMORY.md

## MODEL_PROFILES
- `GPT-5.5 / MEDIUM`: preferred long-run engine for bounded implementation batches when `PLAN.md` queue items are decision-complete; keep read sets small, verify serially, compact after each item.
- `LOW`: mechanical edits, copy cleanup, seed/doc alignment, and tiny state updates only.
- `HIGH`: boundary setup, source/tooling/release decisions, failed-verification diagnosis, and final cleanup.
- `XHIGH`: architecture reset, major migration, hard debugging after lower efforts fail, or broken control system.

## HEADROOM_MAP
- `LOW proven`: control compaction, simple copy, doc alignment, tiny non-behavioral UI polish.
- `LOW avoid`: parser changes, runtime diagnosis, proof strategy changes, source/legal/tooling decisions.
- `MEDIUM proven`: bounded parser/adapter work, store/AppContainer wiring, focused tests, small UI/status changes, compact docs/state updates.
- `MEDIUM avoid`: source strategy, policy/access decisions, broad schema redesign, release hardening, unclear runtime-proof gaps.
- `HIGH proven`: source selection, runtime/toolchain diagnosis, release/package boundary planning, control rebuilds.

## HOT_PATHS
- control: `PLAN.md`, `MEMORY.md`, `AGENTS.md`, `CHECKLIST.md`, `ISSUE_LOG.md`, `TESTING.md`
- Ford sync: `Sources/SyncEngine/SyncEngine.swift`, `Tests/SyncEngineTests/SyncEngineTests.swift`, `Tests/EVAutoTraderAppTests/AppContainerTests.swift`
- VW sync: `Sources/SyncEngine/SyncEngine.swift`, `Sources/SeedData/SampleData.swift`, `Sources/EVAutoTraderApp/AppContainer.swift`, `Tests/SyncEngineTests/SyncEngineTests.swift`
- stores: `Sources/Persistence/AppDatabase.swift`, `Sources/Catalog/CatalogStore.swift`, `Sources/Catalog/InventoryStore.swift`
- UX: `Sources/UIComponents/ContentView.swift`, `Sources/UIComponents/SidebarView.swift`, `Sources/UIComponents/VehicleDetailView.swift`, `Sources/UIComponents/ReviewQueueView.swift`, `Sources/UIComponents/MenuBarStatusView.swift`
- app polish: `Sources/UIComponents/CompareView.swift`, `Sources/UIComponents/SettingsView.swift`, `Sources/Support/ExportService.swift`, `Sources/EVAutoTraderApp/EVAutoTraderCanadaApp.swift`

## PLAYBOOKS
- `Hyundai/Kia Leverage Pivot`: active product is a native Mac negotiation dashboard for 2025-2026 Hyundai/Kia BEV/PHEV/HEV inventory; default ranking is leverage, not generic vehicle browsing.
- `Leverage Architecture`: models live in `AppModels`, v2 SQLite tables in `Persistence`, score math in `Calculators/LeverageCalculator.swift`, research prompt/import validation in `Support/ResearchTools.swift`, and the command-center UI in `UIComponents/LeverageDashboardView.swift`.
- `Deep Research Import`: ChatGPT/Gemini outputs must be source-backed CSV/JSON rows; marketplace rows are leverage evidence but low-confidence until dealer/OEM proof confirms the same stock.
- `Research Fixture Proof`: CSV fixtures live under `Tests/Fixtures/ResearchImports/`; accepted rows include BEV/PHEV/HEV plus marketplace evidence, rejected rows cover outside make/year, missing source URL, and gas-only powertrain.
- `Evidence Quality Proof`: calculator tests now assert stale marketplace rows score below fresh direct dealer evidence and keep recheck reasons visible.
- `Research Import Write Path`: Import Review uses `fileImporter` for CSV/JSON; `ResearchImportFileParser` + `ResearchImportAssembler` parse/validate/map rows; `InventoryStore.importResearchFile` merges accepted listings, research batch, and rejected review items through existing replace methods.
- `Research Duplicate Merge`: `ResearchImportAssembler.mergedListings` dedupes by VIN, dealer+stock, then dealer/city/province/year/make/model/trim when stock is missing; tests cover stock and no-stock merges.
- `Serialized SwiftPM`: run `swift build` first; use `--verify` only for runtime crossing; use `--telemetry` only for lifecycle/log evidence; use `swift test` only at meaningful boundaries; never overlap SwiftPM commands.
- `Medium Long Run`: read `PLAN.md`, then only queue item files; complete or skip the item; verify; token-sweep; continue to the next safe queued item without stopping for task/batch labels.
- `Ford Proof`: keep scope to Mach-E; prove current refresh before source redesign; treat missing live dealer price as MSRP fallback/source-data note unless refresh breaks.
- `Control Self-Heal`: after verified checkpoints, update `PLAN.md`; update `MEMORY.md` only with reusable patterns; put unresolved blockers only in `ISSUE_LOG.md`.
- `Endgame Queue`: `RUN_QUEUE` is the work source; task/batch IDs are labels; compact after every verified item.
- `Sync Routing`: fuzzy trim matching must keep make/model checks grouped with trim checks; MSRP fallback can publish with medium confidence when canonical matching is exact.
- `Store Proof`: saved searches, compare sets, listing notes, review counts, source-run counts, and selected-vehicle listings now have focused build-level coverage.
- `Live UX`: main-window banner should surface no-source-run and review-pressure states; sidebar should show both review items and source-run count.
- `Source-Aware UX`: detail availability now receives all source runs, picks runs relevant to current listings, avoids force-unwrapped provenance URLs, and shows source names in listing tables.
- `Export Truth`: settings copy must match actual export behavior; listing-price export uses current loaded listings and leaves blanks when no listing exists.
- `Export Testability`: `ExportService.compareCSV` generates CSV without `NSSavePanel`, keeping UI save behavior separate from testable export content.
- `Proof Coverage`: compare cap/toggle, cold preconditioning, and failed source-run surfacing now have focused build-level tests.
- `Medium Batch Result`: the first endgame medium batch completed all queued medium/low items and should hand off to `HIGH_CLEANUP` before source/release boundaries.
- `Endgame Medium Batch Result`: P1/P2/P5/P6/P8/P9 completed with serialized build proof; next work is a HIGH catalog-source boundary, not more medium implementation.
- `High Cleanup`: after a medium queue exhausts, verify proof truth, refresh risks, set the next boundary explicitly, and do not start boundary research in the cleanup pass.
- `VW Source Selection`: Volkswagen Canada inventory exposes public JSON via `globalapi.vwtools.ca/inventory-app`; use postal-code-bounded ID.4 queries, preserve deeplink/provenance, and keep access low-volume/personal-use.
- `VW Source Implementation`: `VolkswagenCanadaInventoryAdapter` maps ID.4 VIN, stock, trim, year, price, status, dealer/location, deeplink, and notes through existing `SourceAdapter`; AppContainer now wires it after Ford and before dealer sample data.
- `Endgame Freeze`: do not keep rewriting the control system; update `PLAN.md` only when live state changes, verification changes, or the queue needs pruning.
- `Arbitrary Source Routing`: before adding more live sources, remove hard-coded listing replacement for Ford/dealer IDs so adapters persist by `sourceID`.
- `Arbitrary Source Routing Proof`: `refreshAll` now replaces listings for every configured `adapter.sourceID`; focused third-source build-level coverage lives in `Tests/SyncEngineTests/SyncEngineTests.swift`.
- `Source-Backed Catalog`: broad Canada coverage should come from official/open data and explicit provenance, not unbounded scraping or guessed specs.
- `Source Card`: serious source candidates need owner, URL, terms/robots status, fields, rate limit, proof URL, cache rule, and stop rule before implementation.
- `NRCan Catalog Source`: use Open Canada package `98f1a129-f628-4ce4-b24d-6f16bf24dd64` as the catalog backbone; BEV resource `026e45b4-eb63-451f-b34f-d9308ea3a3d9` has 1204 rows, PHEV resource `8812228b-a6aa-4303-b3d0-66489225120d` has 400 rows, both datastore-backed CSV under Open Government Licence Canada; preserve resource IDs, hashes, last-modified dates, license URL, and retrieved-at date.
- `Catalog Import Shape`: map only official fields present in NRCan data: year, make, model, vehicle class, motor kW, fuel type, electric range, recharge time, energy/fuel consumption, CO2/smog ratings; keep price, incentives, battery capacity, fast charging, and non-present specs as explicit unknowns or separate curated/provenance overlays.

## TOKEN_ROI_RULES
- maximize useful progress per token, file read, and verification step.
- prefer already-known hot files before exploring.
- do not repeat plan restatement in normal runs.
- do not read broad directories unless the milestone changes or verification fails unclearly.
- remove stale queue text as soon as an item is done.
- prefer work that converts future `HIGH` work into `MEDIUM` or `LOW`.
- freeze mature control docs and spend tokens on product code unless the scheduler is stale or wrong.
- stop if routing/compaction churn costs more than it saves.

## CAVEMAN_RULES
- Repo-local plugin lives at `plugins/caveman-skill`; use its skill before low/medium follow-up work.
- Context compactor lives at `plugins/caveman-skill/scripts/compact_context.py`; it writes `.codex/compact-context.md` for cheap continuation.
- `CAVE-LOW`: docs, fixtures, copy, simple tests, seed rows, one-file obvious fixes.
- `CAVE-MED`: importer flow, persistence wiring, small SwiftUI surfaces, scoring tweaks, focused migrations.
- `CAVE-HIGH`: source legality, schema resets, broken verification, release/signing, live-source strategy.
- `lite`: default for user-facing summaries and plan text; concise, readable, complete.
- `full`: internal checkpoint notes and queue logs.
- `ultra`: mechanical state lines only.
- Always preserve exact commands, file paths, code identifiers, output schemas, risks, and stop conditions.
- Fewer words, same work; never compress away meaning.
- Do not install global Caveman/Cavemem/Cavekit without explicit approval; this repo uses the local plugin/runbook instead.
- Caveman Code is treated as unavailable until released; use repo-local behavior/rules now, not unreleased tooling.
- Cavekit/Cavemem may be evaluated when explicitly approved, but product progress must not depend on them.

## PROOF_STRATEGIES
- control/docs/copy: `swift build`
- bounded UI behavior: `swift build`; add `./script/build_and_run.sh --verify` if runtime launch behavior changed
- sync/store/app-container: `swift build`; `swift test` only at batch boundary or when it materially reduces risk
- runtime lifecycle evidence: `swift build`, then `./script/build_and_run.sh --telemetry`
- source validation: non-mutating public inspection first, then bounded implementation only after `HIGH` selection
- VW second source: build a JSON adapter first; prove ID.4 mapping through existing `SourceAdapter`/`SyncCoordinator` before any broader model/source expansion
- official/open catalog data: inspect licence/attribution/update cadence first; add records with provenance and unknown-field notes
- NRCan catalog implementation: prefer bundled CSV snapshots for local MVP reproducibility; tests can use tiny inline CSV fixtures plus one resource-metadata check; do not require live network during normal app/test runs
- release proof: direct-install `.app` proof first; signing/notarization only after `P10` decision

## BLOCKER_PATTERNS
- `SwiftPM collision`: another SwiftPM instance is running; stop parallel verification and serialize.
- `Build-only test proof`: `swift test` only reports build completion; do not claim runtime assertion proof.
- `Ford price gap`: dealer page lacks live price; keep MSRP fallback note unless refresh/publish behavior breaks.
- `Control bloat`: `NEXT_RUN` grows, queue history accumulates, or active context exceeds 8 files; token-sweep immediately.
- `False effort shift`: output implies the live model changed when only `task_effort` changed; correct state before continuing.
- `Source-use drift`: a selected source has personal-use or no-bulk constraints; keep the implementation low-volume and stop before commercial/bulk/release claims.
- `Test mirage`: `swift test` or `swift test list` may exit cleanly while only showing build/enumeration-level signal; do not claim assertion execution until `P7`.
- `Source hard-code`: adding a new adapter without removing hard-coded `sourceID` replacement silently drops live listings.
- `Catalog fabrication`: filling missing Canadian model specs by guesswork creates false confidence; use provenance notes or leave fields explicit.
- `Incentive overreach`: EVAP is eligibility/incentive guidance, not a first catalog backbone; do not merge incentive claims until a stable machine-readable or explicitly maintained table import is chosen.
