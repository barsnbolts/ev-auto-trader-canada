# PLAN.md

## STATE
- project: native macOS EV research app for Apple Silicon using SwiftUI, SwiftPM, SQLite, and a local-first sync pipeline
- current_goal: local MVP with source-backed Canadian EV/PHEV catalog, Ford plus VW live inventory, clear provenance, useful compare/export/settings, and direct-install `.app` path
- current_phase: `P4 Catalog Expansion`
- scheduler: `MEDIUM_LONG_RUN`
- run_status: `P3 catalog source selected; medium queue ready`
- last_verified: `CLANG_MODULE_CACHE_PATH=.build/clang-module-cache swift build --product EVAutoTraderApp` passed after `P3-CATALOG-SOURCE` on 2026-04-24
- repo_status: many files are untracked; do not commit unless explicitly asked
- open_decisions: none for local MVP
- active_risks: `ISSUE-001 runtime assertions unproven`, `ISSUE-003 full Xcode may be needed later`, `ISSUE-004 true Ford dealer pricing`, `ISSUE-006 VW Canada source-use constraints`, `ISSUE-007 EVAP machine-readable incentive import parked`

## EFFORT_TRUTH
- `actual_run_effort`: live window/model truth only; if no live run is active, report `NONE`
- `ceiling_effort`: highest task class allowed by the live run
- `task_effort`: effort class of the current queue item; may be lower than `actual_run_effort`
- task IDs are trace labels only; never stop because a label changed
- a run cannot truly upgrade/downgrade the live model mid-run; it may route tasks inside the current ceiling or emit a handoff
- default next run: `actual_run_effort=MEDIUM`, `ceiling_effort=MEDIUM`, `task_effort=MEDIUM`

## VERIFY
- build: `CLANG_MODULE_CACHE_PATH=.build/clang-module-cache swift build --product EVAutoTraderApp`
- launch_verify: `./script/build_and_run.sh --verify`
- telemetry: `./script/build_and_run.sh --telemetry`
- test: `CLANG_MODULE_CACHE_PATH=.build/clang-module-cache swift test`
- proof_limits:
  - `swift build` proves compile/package graph
  - `--verify` proves process-level launch
  - `--telemetry` proves runtime lifecycle/log events
  - `swift test` and `swift test list` are build/enumeration-level signals until assertion execution is proven
- serialized_rule: never run SwiftPM build/test/launch verification in parallel

## FINISH_DEFINITION
- Ford Mach-E and VW ID.4 live inventory publish or review records coherently with provenance and source-run status.
- Canadian EV/PHEV catalog is source-backed, not fabricated, and gaps are explicit.
- Browse/detail/sidebar/menu/review/compare/settings/export flows are understandable without reading code.
- Tests/proofs cover critical sync/store/calculator/export paths within current toolchain limits.
- Known proof/source/release gaps are parked, not hidden.
- Direct-install `.app` path is decision-complete for local MVP handoff.

## SOURCE_RULES
- `OFFICIAL_OPEN_DATA`: preferred for catalog/spec/incentive truth.
- `PUBLIC_OEM_ENDPOINT`: preferred for live inventory when public access and terms are acceptable.
- `DEALER_GROUP`: acceptable if cleaner than OEM and provenance is preserved.
- `MARKETPLACE`: acceptable only when OEM/dealer paths are blocked or too costly.
- `BLOCKED`: login, CAPTCHA, robots block, Cloudflare challenge, private token, unclear terms, broad crawling, or commercial-use ambiguity.
- source_card_required: owner, URL, terms/robots status, fields, rate limit, proof URL, cache rule, stop rule.
- local_mvp_limits: no aggressive scraping, no bypasses, no personal data collection, no commercial claims.
- policy_anchors: RFC 9309 robots, Open Government Licence Canada, Transport Canada EVAP, NRCan Fuel Consumption Guide.
- selected_catalog_source: NRCan/Open Canada `Fuel consumption ratings` dataset `98f1a129-f628-4ce4-b24d-6f16bf24dd64`; license `ca-ogl-lgo`; unrestricted federal open data.
- catalog_import_shape: use English datastore/CSV resources `026e45b4-eb63-451f-b34f-d9308ea3a3d9` for BEV 2012-2026 and `8812228b-a6aa-4303-b3d0-66489225120d` for PHEV 2012-2026; prefer datastore metadata for headers and downloadable CSV snapshots for bundled local MVP data.
- source_card: owner Natural Resources Canada; proof API `https://open.canada.ca/data/api/3/action/package_show?id=98f1a129-f628-4ce4-b24d-6f16bf24dd64`; cache bundled snapshot with resource IDs, hashes, last-modified dates, license URL, and retrieved-at date; stop if license/resource IDs/schema change ambiguously.
- fields_to_map: model year, make, model, vehicle class, motor kW, fuel type, electric range, recharge time, energy/fuel consumption, CO2/smog ratings; missing price/incentive/battery/charging fields stay explicit notes or curated overlays with provenance.

## MEDIUM_LONG_RUN
- purpose: let GPT-5.5 `MEDIUM` do as much of the whole project as safely possible in large batches.
- consume: all approved `MEDIUM` and `LOW` queue items while verification stays clean.
- skip_and_continue: if an item becomes non-medium, log one compact blocker in `ISSUE_LOG.md`, mark item skipped, and continue to the next safe item.
- token_sweep: after every verified item, remove completed detail, keep one result line, refresh hot files, and rewrite `NEXT_RUN` under 8 lines.
- freeze_control: do not rewrite control files again unless state changes, verification fails, or the scheduler itself breaks.
- stop_only_for: `STOP_CONDITIONS`.

## RUN_QUEUE
Each item is decision-complete: `id | lane | effort | goal | allowed_files | done_when | verify | skip_if | next_if_blocked`.

- `P4-CATALOG-1 | Catalog Import Foundation | MEDIUM | add NRCan BEV/PHEV snapshot resources plus parser with provenance | allowed_files: Package.swift, Sources/SeedData/**, Tests/SeedDataTests/**, PLAN.md, MEMORY.md | done_when: parser maps official rows into source-backed catalog draft records and preserves resource metadata | verify: swift build, swift test at boundary if test target added | skip_if: resource download blocked or schema differs from P3 source card | next_if_blocked: log ISSUE and continue P5/P6 safe work`
- `P4-CATALOG-2 | Catalog Merge | MEDIUM | merge NRCan BEV/PHEV records with existing curated catalog without fabricating unknown specs | allowed_files: Sources/SeedData/**, Tests/SeedDataTests/**, PLAN.md, MEMORY.md | done_when: Ford/VW and broader 2025-2026 EV/PHEV rows appear with provenance and explicit unknown notes | verify: swift build | skip_if: broad schema redesign needed | next_if_blocked: log blocker and continue P5/P6`
- `P5-UX-2 | Catalog Provenance UX | MEDIUM | surface source-backed/curated/unknown catalog truth where already displayed | allowed_files: Sources/UIComponents/**, Sources/Support/**, Tests/**, PLAN.md | done_when: visible copy does not overclaim official vs curated fields | verify: swift build | skip_if: new UX architecture needed | next_if_blocked: log and continue P6`
- `P6-DATA-2 | Settings Persistence Truth | MEDIUM | tighten remaining preference/export persistence seams without schema redesign | allowed_files: Sources/Persistence/**, Sources/Support/**, Sources/UIComponents/SettingsView.swift, Tests/**, PLAN.md | done_when: focused build-level coverage or compact proof note covers behavior | verify: swift build | skip_if: irreversible migration needed | next_if_blocked: log and continue P9`
- `P9-POLISH-2 | Low Polish Reservoir | LOW | compact copy/empty-state/source wording after catalog work | allowed_files: Sources/UIComponents/**, README.md, SETUP.md, PLAN.md | done_when: no source/proof overclaims remain | verify: swift build | skip_if: product decision needed | next_if_blocked: stop if no medium-safe work remains`

## RUN_CURSOR
- current_item: `P4-CATALOG-1`
- current_lane: `Catalog Expansion`
- actual_run_effort: `NONE`
- ceiling_effort: `MEDIUM` for next long run
- task_effort: `MEDIUM`
- completed_this_plan: `M0 Control Rebuild`; `M1-FORD-1`; `M2-DATA-1`; `M3-UX-1`; `M4-APP-1`; `M5-PROOF-1`; `M6-POLISH-1`; `HIGH_CLEANUP`; `H2` selected VW Canada ID.4; `P0` installed endgame scheduler; `P1-SYNC-1` arbitrary source IDs persist through `refreshAll`; `P2-VW-1` VW ID.4 adapter/canonical trims/app wiring/mapping coverage; `P5-UX-1` source-aware UI/status/link/review wording; `P6-DATA-1` duplicate migration removed and export CSV generation split/tested; `P8-COVERAGE-1` folded into P1/P2/P6; `P9-POLISH-1` copy/formatter/source wording polish; `P3-CATALOG-SOURCE` selected NRCan/Open Canada BEV/PHEV catalog import shape
- next_batch_policy: continue across queue labels until `STOP_CONDITIONS`

## HIGH_BOUNDARIES
- `P0-TOOLING | HIGH | evaluate Caveman/Cavekit/Cavemem only with explicit install approval; fallback is repo-local Caveman lite`
- `P3-CATALOG-SOURCE | HIGH | done: NRCan/Open Canada BEV/PHEV CSV/datastore resources selected for catalog; EVAP parked for incentive enrichment`
- `P7-TEST-HARNESS | HIGH | prove or repair actual assertion execution; decide full Xcode only if needed`
- `P10-RELEASE | HIGH | direct-install .app, signing/notarization decision, telemetry proof, final source-policy review`
- `X1-ARCHITECTURE-RESET | XHIGH | only if current sync pipeline cannot support selected sources`

## STOP_CONDITIONS
- verification fails and the cause is unclear
- source/legal/access-control ambiguity appears beyond selected local-MVP constraints
- broad schema redesign, architecture reset, release/signing decision, or full toolchain decision is required
- a user product decision is needed
- more than 8 active files are required without a one-line justification
- no safe queued `MEDIUM` or `LOW` work remains
- `XHIGH` would be required

## TOKEN_SWEEP
- after each verified item:
  - mark the item `done` or remove it from `RUN_QUEUE`
  - keep one compact result line in `RUN_CURSOR`
  - update `MEMORY.md` only with reusable lessons
  - log only unresolved blockers in `ISSUE_LOG.md`
  - rewrite `NEXT_RUN` under 8 lines
- budgets:
  - active context: 8 files max unless justified
  - active queue: 6 medium/low items max
  - high boundaries: 4 max
  - `PLAN.md`: active state only, no chat history

## NEXT_RUN
- recommended_effort: `MEDIUM`
- plan_mode: `OFF`
- caveman_mode: `lite`
- prompt: `Continue from PLAN.md. Reasoning: MEDIUM. Run MEDIUM_LONG_RUN from P4-CATALOG-1. Skip blocked non-medium work, verify serially, token-sweep after each item, and stop only on STOP_CONDITIONS.`
- verify_first_item: `CLANG_MODULE_CACHE_PATH=.build/clang-module-cache swift build --product EVAutoTraderApp`
