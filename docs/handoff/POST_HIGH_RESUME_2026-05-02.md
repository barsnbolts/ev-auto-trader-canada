# Post-HIGH resume pointer (2026-05-02)

> Drop this into the next session's first read. HIGH pass closed; the
> remaining work is mechanical and lives in `MEDIUM_NEXT.md` /
> `LOW_NEXT.md`. Drop reasoning to **medium** before continuing.

## Where we are

- **STATUS: V6 BLEND PHASES F0–F7 + F1.5 + F1.5b + F10 + G + audit-pass + rangeKm consistency SHIPPED + LIVE ON VERCEL (2026-05-03 evening).** HEAD `37956d5d` on both branches. Preview URL: `https://ev-auto-trader-canada-k6jnnulpo-barsnbolts-projects.vercel.app/` (all 8 routes 200 OK; Ioniq9 dossier now renders DC charging curve + Year 3 battery projection — F1.5b fully working).
- **Prior previews:** `jd3k48toy` (HEAD `9f3de7c4`, pre-F1.5b), `9n9r6f29q` (HEAD `1b7aa927`, pre-F7) — both superseded.
- **Audit-pass additions (high tier, 2026-05-03 evening):**
  - **F1.5b** (commit `9a7d2a7c`): backfilled 7 EV9/Ioniq9 specs sibling couldn't match (sibling had EV9 Land AWD only, zero Ioniq9). Added chargingCurve, batteryChemistry, rangeEpaKm + 10 sibling-shape fields per trim. specs.json now: chargingCurve 24→31, batteryChemistry 24→31, rangeEpaKm 24→31. **Affects 22 listings including the largest single-trim count (12 Ioniq9 Performance Calligraphy)** which previously rendered "research pending" placeholders.
  - **rangeKm/rangeEpaKm consistency** (commit `cf51ec50`): three consumers (`/inventory` Range column, CompareGrid Range/DC/AC columns) were reading legacy `rangeKm` only despite F1.5 cited values being available. Now prefer `rangeEpaKm.value ?? rangeKm` consistently.
  - **rangeProtocol:null hotfix** (commit `37956d5d`): F1.5b script wrote `rangeProtocol: null` explicitly on 7 specs; Zod schema is enum-only (rejects null). Predeploy passed because force-dynamic routes server-render at request time. Stripped explicit nulls; missing-key parses as undefined → optional → OK. **Lesson logged in commit message:** add a smoke-test step that curls dynamic routes against `next start` before pushing.
- **Future-work backlog:** see `docs/handoff/FUTURE_WORK_2026-05-03.md` — tier-1/2/3/4/5 items with token estimates per item.
- **launchd:** loaded 2026-05-03 (`com.evautotrader.refresh` 7am daily refresh).
- **What shipped today (V6):**
  - F0 — purged ~5GB of Cowork-era handoff bloat (sibling-checkouts/mac-context/superpowers); committed pending `.vercelignore` + `next.config.mjs` Wikipedia hostname fix
  - F1 — sibling specs/CitedValue<T> types ported; specs.json 27 → 31 entries; hasHeatPump shape upgraded with backwards-compat helper
  - F2 — thermal physics model + winter-range chip on InventoryTable (URL search params for tempC, no zustand)
  - F3 — mom-mode plain-language tooltips across UnitDrawer/dossier/compare/BuyerContextSelector (23 wraps; 20 glossary entries)
  - F4 — charging curve chart in dossier (recharts, renders for 5 sibling-curated specs)
  - F5 — NEW `/pick-a-model` route (zustand-backed picker tray, BrandList + filters + compare-tray)
  - F6 — battery degradation panel in dossier (chemistry-aware retention model)
- **Known gap (F1.5 backfill, queued):** F1 inserted 4 new entries but did not augment the existing 27 specs with sibling CitedValue fields. Result: most units render F4/F6 panel skeletons instead of rich data. Fix: dispatch one Sonnet subagent next session to fuzzy-match sibling seed.json onto our 27 existing specs by `(model, year-range, trim_label)` + merge fields without overwriting non-null existing values. Estimated ~10–15k Sonnet tokens.
- **Pending user actions still open:**
  1. (Optional) Vercel production-branch override at `https://vercel.com/barsnbolts-projects/ev-auto-trader-canada/settings/git` → set to `claude/verify-environment-setup-oTu3S` if you want pushes to auto-deploy to prod (currently preview-only; promote manually via dashboard or `vercel deploy --prod`)
  2. (Optional, future Phase F7) Set `NEXT_PUBLIC_OCM_KEY` env var if you want live DCFC pin map data — falls back to bundled 15-pin demo dataset when unset.
- **D2 closure:** `docs/handoff/research/D2_integration_2026-05-02.md`. Found + fixed one bug (`next/image` Wikipedia hostname, commit `5c031cdd`). All 5 routes return 200. Ioniq5 LR dossier renders Cash + Finance ($1,022/mo) + Lease ($663/mo). EV9 Light dossier renders $804/mo lease. Schema invariants pass (lease_promo=2, finance_promo=2, loyalty=2).


- **Branch:** `claude/verify-environment-setup-oTu3S` (synced with origin)
- **Working tree at handoff:** clean
- **Pre-commit hook:** ACTIVE — `.git/hooks/pre-commit` runs `npx tsc --noEmit` on every commit (don't try to bypass with `--no-verify`)
- **Superpowers plugin:** DISABLED at user scope. Native judgment in effect. Re-enable: `claude plugin enable superpowers@superpowers-marketplace`.

## MEDIUM-pass progress (2026-05-02 evening)

| Milestone | Commit | Status |
|-----------|--------|--------|
| **M8** Selector rename + loyalty/conquest checkboxes | `ae9ca648` | DONE |
| **M15** Per-trim Canadian MSRP refresh | `d4343b5c` | DONE — 10 trims with new prices, 11 staleSince. Subagent used Firecrawl + CarCostCanada cross-ref for Kia (PDFs lack prices); source field still points to OEM brochure URL per task spec. |
| **M16** Snapshot-diff daysOnLot + enrichment merge fix | `2e7c86dd` | DONE — also fixed bug in build_units_from_at.py where enrichment was re-keyed but never merged onto units. Currently 100/100 daysOnLot=0 because pre-2026-05-02 snapshots predate stable IDs; cron grows history. |
| **M14** Daily refresh cron — script | `8ba1a73e` (data refresh `fddad730`) | SCRIPT DONE + manual fire tested. **OS cron registration BLOCKED** by sandbox (`crontab` "Operation not permitted"). User needs to install manually — see "Pending user actions" below. |
| **V5 Phase A** schema groundwork (3-path OTD) | `57ecc361` | DONE — types `OtdBreakdown` / `FinanceBreakdown` / `LeaseBreakdown` exported; `ScoredUnit.otdPaths` optional 3-path slot; lease fields on `Incentive`; `computeFinanceOtd` + `computeLeaseOtd` functional in scoring.ts; `loadScoredUnits` populates `otdPaths` on every unit. Reusable assets pre-landed: `data/vehicle-images.json` (5 hero shots), `src/lib/usedListingsLinks.ts` (verified deep-link templates). `@travishorn/financejs` installed for Phase C amortization tables. |
| **A4 + A5** Vercel + launchd configs | `49cb2b9b` | DONE — `vercel.json` minimal config + `docs/DEPLOY.md` runbook for first-time setup; `scripts/com.evautotrader.refresh.plist` macOS launchd agent (user installs via single `launchctl load` — see plist header). |
| **A6** Pre-flight audit + fixes | `c15e0b5e` | DONE — Sonnet audit returned 17 PASS / 4 WARN / 2 FAIL. Both FAILs closed inline: (a) 4/5 Wikipedia Commons URLs in `data/vehicle-images.json` were planning placeholders, set to null pending Phase B2 verification; (b) `data/specs.json` had 26/100 unit tuples unmatched, added 7 spec entries (EV9 2026 ×4 carryover from 2025; Ioniq5 N RWD alias; Ioniq5 2026 + Ioniq6 2025 "Preferred RWD" aliases of LR variants). Now 97/100 match — remaining 3 are irreducible "Trim unknown" scrape garbage. Audit log at `docs/handoff/research/A6_audit_2026-05-02.md`. |
| **B1** Incentive data fill (Sonnet, ~194s, 78k tokens) | `515fda1e` | DONE — 8 new entries in `data/incentives.json`: 2 loyalty + 2 conquest + 2 lease_promo + 2 finance_promo. Sources: hyundaicanada.com/en/offers + kia.ca/en/offers + dealer disclaimers. Conquest CAD intentionally omitted (not publicly disclosed by OEMs). |
| **B2** Full UI batch (Sonnet, ~473s, 103k tokens) | `515fda1e` | DONE — 5 tasks across 4 files: dossier link column (M11, colSpan 14→16), 48×32 vehicle photos with null fallback, used-listings deep-links (AT/KJ/LB*), heatpump tri-state chip (M7) in 3 locations, 3-path OTD rendering everywhere (badges in InventoryTable, 3-tab in UnitDrawer, 3 print subsections in dossier, PaymentMatrix in compare). |

## Pending user actions

1. **Install daily refresh launchd agent** (preferred over crontab; sandbox blocked direct install):
   ```bash
   cp ~/ev-auto-trader-canada/scripts/com.evautotrader.refresh.plist ~/Library/LaunchAgents/
   launchctl load ~/Library/LaunchAgents/com.evautotrader.refresh.plist
   launchctl list | grep evautotrader   # verify
   ```
   7 AM local daily. Logs at `~/ev-auto-trader-canada/logs/cron.log`. Manual fire: `launchctl start com.evautotrader.refresh` or `bash ~/ev-auto-trader-canada/scripts/refresh_daily.sh`.

2. **First-time Vercel deploy** (one-time, ~10 min):
   See `docs/DEPLOY.md` for the full runbook. Summary: `npm install -g vercel && vercel login && vercel link && vercel --prod`. Then set production-branch override to `claude/verify-environment-setup-oTu3S` in the Vercel dashboard. Subsequent deploys auto-trigger on push.

3. **M12 Apify** entirely SKIPPED per V5 plan decision. Snapshot-diff (M16) covers daysOnLot. No Apify spend.

## What HIGH pass shipped (2026-05-02)

| Milestone | Commit | Result |
|-----------|--------|--------|
| **M0** GraphQL probe | `83c6d5a6` (closed `c2a064ce`) | UNUSABLE — `__NEXT_DATA__` schema has `availability.inDays` but always null on `/offers/`. Snapshot-diff (M16 below) is the daysOnMarket source. |
| **M9** Heatpump queue | `babbe4fe` | 20/20 rows at High confidence. Kia side resolved by reading the official 2025 Canadian brochure PDFs directly (URL pattern documented). |
| **M10A** Leasebusters probe doc | `dd023dfb` | `docs/LEASEBUSTERS_PROBE.md` shipped. **PAUSED** for user go-ahead before Phase B (scraper) / C (UI). |
| **M12-schema** OEM pricing migration | `053e9e96` | `data/oem-pricing.json` now nested per-trim `{value, lastVerified, source, staleSince}`. Build script `scripts/build_units_from_at.py:180-184` patched to extract `entry["value"]`. Round-trip verified — `data/units.json` shows zero MSRP drift. |
| **M4** Cookie migration | `c6e8e3c8` | `getBuyerContext` threaded through 4 routes + dossier. `loadScoredUnits` accepts `BuyerContext` OR legacy `Province`. `buyerProvinceServer.ts` deleted. Predeploy clean. |
| **Handoff** | `b627a68f` | POST_HIGH_RESUME pointer + tier queues in MEDIUM_NEXT/LOW_NEXT. |
| **Pre-stubs** | `e477910f` | `scripts/derive_days_on_market.py` (M16 algorithm), `scripts/track_apify_spend.py` (M12 spend gate), `docs/handoff/research/M15_msrp_2026-05-02.md` (fillable template). |
| **M17** simple-git-hooks | `425afb2d` | Pre-commit `npx tsc --noEmit` wired via `simple-git-hooks ^2.13.1`. Hook validated. Note: a `should-fail` test commit (`561c4e89`) exists in history but was scrubbed by the next commit; harmless. |

## What's next (post Phase B)

**Phase D1 — DONE.** Math review closed. Finance PMT verified on Ioniq5
sample ($1,022.98/mo, two formulations agree to 8 decimals). Lease
formulas were initially blocked because both lease promos shipped with
`residualPercent: null` (Hyundai/Kia Canada don't publish residual
tables). Resolved by back-calculating from each promo's own disclaimer
math: Ioniq5 60mo = 48%, EV9 36mo = 63% (Medium confidence ±2pp,
documented in `notes`). Lease deltas vs dealer-disclosed monthlies:
Ioniq5 −$14 (−2.1%, traces to dealer admin fee not in cap), EV9 −$6
(−0.8%). Both within personal-use modeling tolerance. Full log at
`docs/handoff/research/D1_math_review_2026-05-02.md`.

**Phase D2 — final integration (HIGH inline, ~10k tokens):** Walk all
5 routes (`/`, `/inventory`, `/dealer/[id]`, `/compare`,
`/inventory/[id]/dossier`) in `npm run dev`. Confirm heatpump chips
render, 3-path OTD shows, photos placeholder gracefully, used-listings
links work. Then mark project complete.

**Phase C — DEFERRED.** The original plan had Phase C populating
lease/finance entries in a future Sonnet pass, but B1 already populated
them. C2 (math itself) was already shipped in Phase A2. So C collapses
into D1 hand-verification.

**Phase E — Vehicle photo URL resolution (optional, future Sonnet):**
Resolve real Wikipedia Commons URLs for Ioniq5 / Ioniq9 / EV6 / EV9 via
the Commons API helper at A0_findings_2026-05-02.md §3. Currently null
+ graceful placeholder. Not blocking — site is functional without them.

## What's next — historical (read MEDIUM_NEXT.md "POST-HIGH EXECUTION ORDER")

That section has the full ordered queue with tier tags (`[MEDIUM]` vs `[SONNET]`) + dependency map + concurrency hints. **Done:** M8, M15, M16, M14 (script). **Up next: M10 (loyalty/conquest incentive entries).** Then M11 (dossier link column, SONNET), M13 (incentives via Exa), M7 (heatpump UI chip).

Pre-stubbed artifacts that medium should reuse, NOT rewrite:
- `scripts/derive_days_on_market.py` (M16 algorithm — paste from plan §5/M3 was DONE here)
- `scripts/track_apify_spend.py` (M12 spend gate — exit codes 0/2/3 already wired)
- `docs/handoff/research/M15_msrp_2026-05-02.md` (per-trim fillable template)

Decisions baked in (don't re-ask):
- **M14 cron push target → (a) push to working branch** `claude/verify-environment-setup-oTu3S`. Don't push to main (project rule).
- **Subagent strategy → subagent ≥10 min self-contained, inline <5 min** per the vibe-coding directive saved in auto-memory.
- **M12 Apify** still requires explicit user confirmation before firing (money gate, hard rule). Don't auto-fire even though everything else is autonomous.

After the medium queue lands, next HIGH-tier batch is **cash/finance/lease comparison** (plan §12 / M13-bigger) — the lease-buyer pivot user flagged on 2026-05-02.

## Optimization wins captured during HIGH pass

1. **Read tool reads PDFs natively** — for OEM brochures, this is far cheaper than Chrome MCP for content extraction. URL pattern for Kia Canada: `https://www.kia.ca/content/dam/marketing/content/vehicles/brochures/<MY>/<model>/MY<YY>_<MODEL>_ENG.pdf`.
2. **WebFetch** — built-in Claude tool that fetches HTML and runs a small model on it with a prompt. Use this instead of Chrome MCP for OEM showroom pages where the content is server-rendered. (Caveat: the kia.ca electric-cars index hit `maxContentLength` — fetch model pages directly.)
3. **One-shot Bash heredoc Python migrations** — for one-time JSON shape transformations (like the M12 schema migration), don't persist a script. Run inline, verify, throw away.
4. **Schema migration on HIGH, value refresh on MEDIUM** — splitting M12 this way unblocks medium without forcing it to make schema decisions.
5. **Parallel Read calls** — load all related files for a multi-file edit in ONE message before starting edits. Cuts round-trips from N to 1.

## MCPs confirmed available

- Chrome MCP (`mcp__Claude_in_Chrome__*`) — Browser 1, macOS, isLocal=true. **Prefer Read+WebFetch+Bash for content extraction; Chrome MCP only when DOM interaction is required.**
- Apify (`mcp__Apify__*`) — loadable via ToolSearch
- scheduled-tasks (`mcp__scheduled-tasks__*`) — loadable
- Exa (`mcp__9a04470a-c5be-420d-a32b-adaaa7f50b13__*`) — used for M9 Hyundai side (some kia.ca URLs returned CRAWL_NOT_FOUND; brochure-PDF path bypassed this)

## Reasoning tier guidance

- **Medium reasoning** for everything in the "next" list above.
- **Low / Sonnet** for `LOW_NEXT.md` L2 (Canadian MSRP fill — pure mechanical).
- **High only if** a task in `MEDIUM_NEXT.md` reveals architecture/judgment that wasn't in the spec — STOP and surface it.

## Key context

- Plan source of truth: `docs/handoff/EXECUTION_PLAN_2026-05-02.md` (in-repo, committed) AND `/Users/ianmcadam/.claude/plans/you-are-the-planning-floating-breeze.md` (mac-local).
- Apify spend cap $30 cumulative; **must ask user before first paid run.**
- Branch stays on `claude/verify-environment-setup-oTu3S`. Never push to main, never `--no-verify`, never amend, never force-push.
- Predeploy gate (`npm run predeploy`) before every push. **Docs-only commits skip it** (LEASEBUSTERS_PROBE was docs-only and committed without predeploy — that pattern is fine).

## Files shipped this HIGH pass

- `docs/handoff/research/M0_findings_2026-05-02.md` (M0 closure)
- `docs/handoff/research/M0_graphql_2026-05-02.json` (M0 raw captures)
- `docs/CHROME_PROBE.md` (M0 GraphQL section appended)
- `docs/handoff/research/M9_heatpump_2026-05-02.md` (M9 closure log)
- `data/heatpump-research-queue.json` (M9 — 20/20 filled)
- `data/specs.json` (M9 — heatpump fields merged)
- `docs/LEASEBUSTERS_PROBE.md` (M10A scaffold)
- `data/oem-pricing.json` (M12-schema — Option B nested)
- `scripts/build_units_from_at.py` (M12-schema — extract `entry["value"]`)
- `data/units.json` (M12 + M9 + daily date drift)
- `src/lib/data.ts` (M4 — `loadScoredUnits` widened)
- `src/lib/buyerContextServer.ts` (M4 — dropped unused `getBuyerProvinceFromContext`)
- `src/lib/buyerProvinceServer.ts` **(M4 — DELETED)**
- `src/app/page.tsx`, `src/app/inventory/page.tsx`, `src/app/dealer/[id]/page.tsx`, `src/app/compare/page.tsx`, `src/app/inventory/[id]/dossier/page.tsx` (M4)
- `MEDIUM_NEXT.md` / `LOW_NEXT.md` (handoff enrichment)
- `docs/handoff/POST_HIGH_RESUME_2026-05-02.md` (this file)

---

## Final state (2026-05-03 evening, HEAD 5d5e3b30)

**Live preview:** https://ev-auto-trader-canada-kflj10jhd-barsnbolts-projects.vercel.app
**Branches:** `claude/verify-environment-setup-oTu3S` ahead of remote: 0
**All 7 routes:** 200 OK on both `next start` local + Vercel preview

### Sweeps shipped this session (post-V6)
- F1.5b: 7 EV9/Ioniq9 specs backfilled (chargingCurve, batteryChemistry, rangeEpaKm + 10 sibling-shape fields each)
- rangeEpaKm consistency: `/inventory` + CompareGrid prefer `rangeEpaKm.value` then fall back to legacy `rangeKm`
- Hotfix: stripped explicit `rangeProtocol:null` (Zod schema is enum-only — caused production 500)
- F11: 5/5 vehicle hero photos verified (Wikipedia Commons, CC BY-SA 4.0)
- F12: 5/7 rangeEpaKm values corrected against NRCan/OEM showroom figures
- F13: hasHeatPump already complete from M9 (all 7 specs High-confidence)
- F15: BatteryHealthPanel emits "Medium confidence" footnote when rangeKm legacy fallback used
- F16: doc-comments on PickerCompareTray + CompareGrid explaining intentional dual-compare-UI architecture
- F18: CompareGrid computes hp from kw (motorHp legacy field still in data, no longer required)
- F17: noUnusedLocals + noUnusedParameters on; 6 dead-code surfacings cleaned

### Tomorrow morning (2026-05-04)
- 7am ET: launchd `com.evautotrader.refresh` fires. Check `~/ev-auto-trader-canada/logs/cron.log` after — should show successful first run.
- Verify: `launchctl list | grep evautotrader` should show non-zero PID + status 0.
- If cron failed, the next session debugs it; the dashboard itself is unaffected.

### Status: project complete for buying-window scope
All Tier 1, 2 (planning-stage), and 3 backlog items shipped. Tier 4 (Tauri-wrap, repo rename) and F8 (trip planner) remain deferred — neither is required pre-purchase.

