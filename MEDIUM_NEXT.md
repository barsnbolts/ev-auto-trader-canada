# MEDIUM_NEXT.md — mechanical task queue for medium-reasoning sessions

**Read this when picking up on medium reasoning.** Each task is fully
specified — no architectural decisions, no investigation, no "figure out
what to do." If a task here requires judgment, escalate to high.

Phases 0 + 1 are shipped (`e28585d`). M1, M2, M3, M5 from the prior medium
pass are also shipped (`c1d5f69`). M4 (snapshot) ran 2026-05-02. M6
(InventoryTable colSpan reminder) is a "look-out-for" rather than an edit.

A high-reasoning prep pass (`<this commit>`) just landed scaffolds for
Phases 2, 3.1, 4.1, 4.3 — what's below is the mechanical slice of those.

**HIGH pass 2026-05-02 (HEAD `c6e8e3c8`) closed:** M0 GraphQL probe
(unusable; snapshot-diff is the daysOnMarket source — see
`docs/handoff/research/M0_findings_2026-05-02.md`); M9 heatpump queue
20/20 at High confidence; M10A Leasebusters probe doc; M12 schema
migration to Option B (`data/oem-pricing.json` now per-trim
`{value, lastVerified, source, staleSince}`); M4 cookie migration
(`getBuyerContext` threaded through 4 routes + dossier; legacy
`buyerProvinceServer.ts` deleted). **M9 below in this file** (the
migrate-callers task) **is now stale — already shipped.**

---

## POST-HIGH EXECUTION ORDER (2026-05-02 → next medium session)

**Read this section first.** Each task is tagged `[MEDIUM]` (judgment +
multi-file) or `[SONNET]` (pure mechanical fill-in). For SONNET tasks,
dispatch a fresh subagent (`superpowers:subagent-driven-development`) so
each task runs in its own context window. For UI verification, use
`mcp__Claude_Preview__*` — never Bash dev-server or Chrome MCP.

### Order + dependencies

| #  | Task                                              | Tier   | Depends on | Est.   |
|----|---------------------------------------------------|--------|------------|--------|
| 0a | Branch drift check (`git fetch origin && git log origin/main..HEAD --oneline`) | SONNET | —          | 1 min  |
| 0b | M4 preview smoke (cookie roundtrip, province swap) | MEDIUM | 0a         | 5 min  |
| 1  | **M17** simple-git-hooks install + pre-commit     | SONNET | 0b         | 10 min |
| 2  | **M8** BuyerContextSelector rename + checkboxes   | MEDIUM | 1          | 25 min |
| 3a | **M15-Hyundai** MSRP refresh (Ioniq 5/6/9 showroom) | SONNET | 1          | 15 min |
| 3b | **M15-Kia** MSRP refresh (EV6/EV9 brochure PDFs) | SONNET | 1          | 15 min |
| 3c | **M15-verify** Run build_units_from_at.py + diff  | MEDIUM | 3a + 3b    | 10 min |
| 4  | **M10** Loyalty/conquest incentive entries        | MEDIUM | 2          | 25 min |
| 5a | **M16** Snapshot-diff daysOnLot (paste plan §5/M3) | MEDIUM | 1          | 30 min |
| 5b | **M16b** Vitest install + 2 anchor tests for M16  | MEDIUM | 5a         | 15 min |
| 6  | **M14** Daily refresh cron + logfile observability | MEDIUM | 5a         | 20 min |
| 7  | **M11** Dossier link column in InventoryTable     | SONNET | 1          | 10 min |
| 8  | **M13** Incentives refresh via Exa                | MEDIUM | 4          | 20 min |
| 9  | **M12-Apify** ON+H/K sample (ASK FIRST) + spend tracker | MEDIUM | 3c         | 15 min |
| 10 | **M7** Heatpump UI chip (data already filled)     | MEDIUM | 2          | 30 min |

### Concurrency map (parallelize via subagent dispatch)

- After **#1** lands, fire **#3a + #3b + #7** in parallel (all SONNET, disjoint files)
- After **#2** lands, fire **#4 + #5a + #10** in parallel (all MEDIUM, disjoint files)
- **#5b** must follow **#5a** (tests need the function)
- **#6** must follow **#5a** (cron calls the script)
- **#9** asks the user before firing — gate, not parallel

### Critical hygiene (do before any task)

1. `cd ~/ev-auto-trader-canada && git fetch origin && git pull --ff-only`
2. Confirm HEAD ≥ `b627a68f` and branch is `claude/verify-environment-setup-oTu3S`.
3. `npm install && npm run predeploy` — must pass before starting.
4. If predeploy fails, halt + post in chat. Don't paper over.

---

## Task details

### 0a. Branch drift check `[SONNET]`

```bash
cd ~/ev-auto-trader-canada
git fetch origin
git log --oneline origin/main..HEAD | head -20
git log --oneline HEAD..origin/main | head -20  # check the other direction too
```

If branch is far ahead of main (>20 commits): note in chat — the M14 cron's `git pull --rebase origin main` will conflict on next run. If main is ahead of branch: `git rebase origin/main` first.

### 0b. M4 preview smoke `[MEDIUM]`

```
preview_start    → starts dev server
preview_snapshot → confirm /inventory renders
preview_click    → click province dropdown
preview_fill     → set province = QC
preview_snapshot → confirm OTD column shows GST + QST line, not HST
```

Expected: no errors in `preview_console_logs`. If broken, M4 needs a fix before any other task.

### 1. M17 simple-git-hooks `[SONNET]`

```bash
cd ~/ev-auto-trader-canada
npm install --save-dev simple-git-hooks
```

Edit `package.json`: add `"prepare": "simple-git-hooks"` to scripts; add top-level `"simple-git-hooks": { "pre-commit": "npx tsc --noEmit" }`.

```bash
npx simple-git-hooks                    # wires .git/hooks/pre-commit
git add package.json package-lock.json
git commit -m "chore(M17): simple-git-hooks pre-commit typecheck"
git push origin claude/verify-environment-setup-oTu3S
```

Verify: plant a deliberate type error, attempt commit, expect block. Revert.

### 3a. M15-Hyundai MSRP refresh `[SONNET]`

For each model in `["ioniq-5", "ioniq-6", "ioniq-9"]`:
1. `mcp__9a04470a-c5be-420d-a32b-adaaa7f50b13__web_fetch_exa` URL `https://www.hyundaicanada.com/en/showroom/<model>` (or `/en/showroom/2025/<model>` for 2025-specific). If hits content-length limit, target a model-specific subpage.
2. Find each trim's MSRP in the page text.
3. Update `data/oem-pricing.json`: for each `(model, trim)` entry, set `value`, `lastVerified: "2026-05-02"`, `source: "<URL>"`, `staleSince: null`.
4. If a trim disappeared from the OEM page, set `staleSince: "2026-05-02"` and keep `value`.
5. If a new trim appeared, add a new entry — match the existing trim naming in `data/specs.json`.

Per-trim research log: `docs/handoff/research/M15_msrp_2026-05-02.md`.

### 3b. M15-Kia MSRP refresh `[SONNET]`

```bash
# EV6
curl -s -o /tmp/ev6_brochure.pdf \
  "https://www.kia.ca/content/dam/marketing/content/vehicles/brochures/2025/ev6/MY25_EV6_APR1_ENG.pdf"
# EV9
curl -s -o /tmp/ev9_brochure.pdf \
  "https://www.kia.ca/content/dam/marketing/content/vehicles/brochures/2025/ev9/MY25_EV9_ENG.pdf"
```

Use Read tool on each PDF (native PDF support). The brochures' Specifications page lists trim → "Starting at $X" prices. Paste into `data/oem-pricing.json` per the same template as 3a.

EV6 GT note: not in main brochure. Reference kiamedia US press kit (already cited at `babbe4fe`) — flag with `notes: "EV6 GT pricing requires separate verification; kiamedia US shows $79,566 USD"`.

### 3c. M15-verify `[MEDIUM]`

```bash
python3 scripts/build_units_from_at.py
git diff data/units.json | head -100
```

Expected delta: only intentional MSRP changes per trim, plus daily date drift in `lastSeen`/`notes`. If a unit's `msrpCad` changed UNEXPECTEDLY (e.g. you mis-keyed a trim), back out the change in `data/oem-pricing.json` and re-run.

```bash
npm run predeploy
git add data/oem-pricing.json data/units.json docs/handoff/research/M15_msrp_2026-05-02.md
git commit -m "data(M15): per-trim Canadian MSRP refresh from OEM brochures + showroom pages"
git push origin claude/verify-environment-setup-oTu3S
```

### 5a. M16 Snapshot-diff daysOnLot `[MEDIUM]`

**Pre-stubbed by HIGH pass:** `scripts/derive_days_on_market.py` already exists, full algorithm written, `chmod +x` applied. Medium just needs to: review, run, verify.

```bash
python3 scripts/derive_days_on_market.py    # writes data/units-enrichment.json
python3 scripts/build_units_from_at.py       # picks up via existing overlay
```

Expected: `merged daysOnLot for N units across 4 snapshots` where N = unique stable IDs across 2026-05-* snapshots only (pre-2026 snapshots filtered by ID regex). Currently 2 snapshots have stable IDs (`2026-05-01` + `2026-05-02`), so `daysOnLot` will be 0 or 1 for almost all units. Cron from M14 fixes this going forward.

### 5b. M16b Vitest tests `[MEDIUM]`

```bash
npm install --save-dev vitest
```

Add to `package.json`: `"test": "vitest run"` script.

Two anchor tests in `scripts/derive_days_on_market.test.ts` (or .py if you keep Python; if Python, use `unittest`):

1. **Test 1**: Two snapshots — same unit ID in both, dates 7 days apart. Expect `daysOnLot = 7` from oldest sighting.
2. **Test 2**: Pre-stable-ID snapshot (ID = `12345` not `u-at-...`) — expect filter to skip it; no entry in output.

Run `npm test`; expect both pass.

```bash
git add scripts/derive_days_on_market.py scripts/derive_days_on_market.test.ts package.json package-lock.json
git commit -m "feat(M16): snapshot-diff daysOnLot derivation + vitest anchor tests"
git push
```

### 6. M14 Daily refresh cron `[MEDIUM]` — **BLOCKED on user decision (push target)**

**OPEN QUESTION before writing this script:** Plan §5/M11 says cron does `git push origin main`, but project non-negotiable says "never push to main". Resolutions to ask the user:

- **(a)** Cron pushes to the working branch `claude/verify-environment-setup-oTu3S` (data refreshes accumulate; operator merges to main via PR weekly).
- **(b)** Cron creates daily branches `data-refresh/YYYY-MM-DD` and opens a PR to main (cleaner audit trail, more PR noise).
- **(c)** Cron commits locally but doesn't push (operator pushes after morning review).

`logs/cron.log` is already in `.gitignore`. Once user picks (a/b/c), the script structure is:

```bash
#!/usr/bin/env bash
set -euo pipefail
exec >> "$HOME/ev-auto-trader-canada/logs/cron.log" 2>&1
echo "=== $(date -u +%FT%TZ) refresh start ==="
cd "$HOME/ev-auto-trader-canada"
# git pull --rebase ...    (target depends on push-decision a/b/c)
[ -x scripts/scrape_search_json.py ] && python3 scripts/scrape_search_json.py
python3 scripts/build_units_from_at.py
[ -x scripts/derive_days_on_market.py ] && python3 scripts/derive_days_on_market.py && python3 scripts/build_units_from_at.py
node scripts/snapshot.mjs
npm run predeploy
if ! git diff --quiet data/; then
  git add data/
  git commit -m "data refresh: $(date -u +%F)"
  # git push ...    (target depends on push-decision a/b/c)
fi
echo "=== refresh ok ==="
```

Once script written, `chmod +x scripts/refresh_daily.sh && mkdir -p logs`.

Register via MCP:
```
mcp__scheduled-tasks__create_scheduled_task
  schedule: "0 11 * * *"  # 11 UTC = 7am ET DST
  command: bash ~/ev-auto-trader-canada/scripts/refresh_daily.sh
  description: "EV Auto Trader Canada — daily refresh + snapshot + Vercel deploy"
```

Manual fire test:
```bash
bash ~/ev-auto-trader-canada/scripts/refresh_daily.sh
tail -30 logs/cron.log    # confirm clean exit
```

### 9. M12-Apify sample with auto-spend-tracker `[MEDIUM, ASK FIRST]`

Before firing, post in chat: "About to run Apify actor `calm_builder/autotrader-canada` for 1-page-per-(province × make × model) sample (~$0.10). Confirm to proceed."

**Pre-stubbed by HIGH pass:** `scripts/track_apify_spend.py` already exists, exit-codes 0/2/3 documented, threshold + cap constants in place.

Run flow:
1. `mcp__Apify__call-actor` with input from `docs/apify_inputs/ontario_full.json` (path-form URLs only — query-form `?model=` is broken per M0 finding).
2. Wait for SUCCEEDED status via `mcp__Apify__get-actor-run`.
3. Capture cost: `mcp__Apify__get-actor-run runId=X` → extract `usage.totalUsd`.
4. Pipe `{"runId":"X","datetime":"...","costUsd":...}` into `scripts/track_apify_spend.py` — exit code 2 means stop + ask user before any further paid run.
5. Continue with merge per the M12 section further below.

### 10. M15 — Pre-stubbed research log

**Pre-stubbed by HIGH pass:** `docs/handoff/research/M15_msrp_2026-05-02.md` is a fillable template with one row per (model, trim) — `oldValue` already filled, `newValue` / `source` / `notes` cells empty. Sonnet just fills cells; Medium does the verification step (3c).

---

Once `data/heatpump-research-queue.json` has been filled and merged into
`data/specs.json` via `python3 scripts/merge_heatpump_research.py`, surface
the per-trim flag as a chip:

1. **InventoryTable row** — read `spec.hasHeatPump` for the unit's
   (model, year, trim, drivetrain) via the existing `specMap` lookup. Show:
   - `true` → no chip (heat pump is the expected baseline; clutter-free)
   - `false` → red chip "No heat pump" with title `"Trim ships with resistive heater only — expect 25-40% range loss below -10°C"`
   - `null/undefined` → grey chip "Heat pump?" with title `"Not yet researched"`

2. **UnitDrawer** — same logic, larger chip in the spec section.

3. **Dossier page** (`src/app/inventory/[id]/dossier/page.tsx`) — add a
   "Cold-weather kit" line to the Header section: `Heat pump: yes/no/unknown`.

Files: `src/components/InventoryTable.tsx`, `src/components/UnitDrawer.tsx`,
`src/app/inventory/[id]/dossier/page.tsx`. Estimate: 30 min.

If `colSpan` for the empty-state row needs bumping (currently 14 at
`InventoryTable.tsx:587`), do it in the same commit.

---

## M8. Loyalty/conquest checkboxes in selector

Schema + filter logic shipped in this prep. Need: UI + cookie writes.

1. Open `src/components/BuyerProvinceSelector.tsx`. Replace its body with
   a small form that uses `useBuyerContext()` from
   `@/lib/buyerContext` (the new hook) instead of `useBuyerProvince`.
2. Render the existing province dropdown PLUS two checkboxes:
   - "I currently own a Hyundai or Kia" (loyalty)
   - "I currently own a competing brand (Toyota / Honda / Tesla / etc.)" (conquest)
3. On any change call `setBuyerContext({ province, loyalty, conquest })`.
4. Rename the file to `BuyerContextSelector.tsx` and update its import in
   `src/components/Nav.tsx` (or wherever it's mounted).

Files: `src/components/BuyerProvinceSelector.tsx`, `src/components/Nav.tsx`.
Estimate: 25 min.

---

## M9. Migrate getBuyerProvince callers to getBuyerContext

`src/lib/buyerContextServer.ts` exposes `getBuyerContext()` and
`getBuyerProvinceFromContext()`. Find every caller of the old
`getBuyerProvince` from `src/lib/buyerProvinceServer.ts` and update:

```bash
cd ~/ev-auto-trader-canada
grep -rn "getBuyerProvince\b" src/
```

For each call site, prefer `getBuyerContext()` and pass the full context
into `loadScoredUnits`. Then update `loadScoredUnits` signature to take
`buyerContext?: BuyerContext` and pass it into `applicableIncentives`. The
`buyerProvince` field on the returned object stays for back-compat — just
populate it from `buyerContext.province`.

Files: `src/lib/data.ts`, `src/lib/buyerProvinceServer.ts` (delete or
re-export from new module), `src/app/page.tsx`, `src/app/inventory/page.tsx`,
`src/app/compare/page.tsx`, `src/app/dealer/[id]/page.tsx`, etc.
Estimate: 30 min.

---

## M10. Seed Hyundai/Kia loyalty + conquest incentives

`data/incentives.json` has the schema (loyalty/conquest scopes already
typed) but no entries yet. Add the current-month programs from the OEM
sites:

- **Kia loyalty cash** — typically $500-$1,000 to existing Kia owners on EV6 / EV9
- **Kia conquest cash** — competitive owner bonus on EV6 / EV9
- **Hyundai loyalty rate reduction** — 0.5-1.0% APR cut for current Hyundai owners on Ioniq 5/6/9
- **Hyundai conquest cash** — competitive owner bonus on Ioniq 5/6

Use `data/incentives.json` as the schema reference (existing federal +
provincial entries show the exact field shape). Set `scope: "loyalty"` or
`scope: "conquest"`, `appliesTo.models`, `effectiveUntil`, `lastVerified`.

Verification: with both buyer-context checkboxes on, applicable-incentive
count should jump for matching units. With both off, score is unchanged
from today.

Files: `data/incentives.json`. Estimate: 25 min including OEM site lookup.

---

## M11. Add Dossier link column to InventoryTable

The dossier route (`/inventory/[id]/dossier`) is shipped. UnitDrawer
already links it. The row itself needs an inline link too.

1. Add a small "📄" or "Dossier" link in the actions column of each row
   in `src/components/InventoryTable.tsx`.
2. Bump `colSpan` for the empty-state row at line ~587 if you added a
   visible column (vs. squeezing into existing actions).
3. `<Link href={\`/inventory/\${u.id}/dossier\`}>` — use Next's Link, not
   a plain `<a>`, so client-side nav stays fast.

Files: `src/components/InventoryTable.tsx`. Estimate: 10 min.

---

## M12. Run Apify scrape + merge enrichment

`docs/APIFY_AUTOTRADER.md` has the actor (`calm_builder/autotrader-canada`)
+ canned input (`docs/apify_inputs/ontario_full.json`) +
transform script (`scripts/apify_to_enrichment.py`).

Sequence:

```bash
# 1. Trigger run via MCP (input file already canned)
mcp__Apify__call-actor calm_builder/autotrader-canada \
  --input @docs/apify_inputs/ontario_full.json

# 2. Poll mcp__Apify__get-actor-run for status === SUCCEEDED

# 3. Pull dataset
mcp__Apify__get-actor-output <runId> > /tmp/apify_at.json

# 4. Merge into data/units-enrichment.json
python3 scripts/apify_to_enrichment.py --input /tmp/apify_at.json

# 5. Re-build units.json (the new daysOnLot + VIN flow in via merge)
python3 scripts/build_units_from_at.py

# 6. Commit + push
git add data/ && git commit -m "data refresh via apify $(date +%F)" && git push
```

Cost ceiling: ~$0.75/run. Self-imposed budget cap: $30 cumulative — track
in commit messages.

Files: `data/units.json`, `data/units-enrichment.json`. Estimate: 15 min wall.

---

## M13. Refresh incentives via Exa

NEXT item I, formalized:

```bash
# Per OEM, fetch the promo page text
mcp__9a04470a-c5be-420d-a32b-adaaa7f50b13__web_fetch_exa
  url: https://www.hyundaicanada.com/en/offers
mcp__9a04470a-c5be-420d-a32b-adaaa7f50b13__web_fetch_exa
  url: https://www.kia.ca/en/offers
```

For each promo found, update or add an entry in `data/incentives.json`:

- `scope`: `manufacturer_cash` for cash bonuses; `loyalty` / `conquest`
  for those programs (saves M10 work if you batch them)
- `effectiveFrom` / `effectiveUntil` from the page
- `lastVerified`: today
- `source`: the OEM URL

Files: `data/incentives.json`. Estimate: 20 min.

---

## M14. Schedule daily refresh cron (Phase 5.1)

```
mcp__scheduled-tasks__create_scheduled_task
  schedule: "0 11 * * *"   (7am ET = 11 UTC during DST)
  command: |
    cd ~/ev-auto-trader-canada \
      && git pull --rebase origin main \
      && python3 scripts/build_units_from_at.py \
      && node scripts/snapshot.mjs \
      && npm run predeploy \
      && git add data/ \
      && git commit -m "data refresh: $(date +%F)" \
      && git push origin main
  description: Daily AutoTrader refresh + snapshot + Vercel deploy
```

Note: the cron does NOT run Apify by default — that's a paid call. Add
the Apify step manually when you want a paid refresh, or schedule a
separate weekly cron with the Apify command.

Estimate: 5 min.

---

## M15. Per-trim OEM MSRP refresh (was plan §5/M12 research half)

The schema is migrated; values + provenance now need a per-trim refresh.
**HIGH pass discovery — Kia Canada brochures live at predictable URLs and
Read tool reads PDFs natively:**

```
https://www.kia.ca/content/dam/marketing/content/vehicles/brochures/<MY>/<model>/MY<YY>_<MODEL>_ENG.pdf
  e.g.  MY25_EV6_APR1_ENG.pdf, MY25_EV9_ENG.pdf
```

Hyundai Canada pricing is on showroom pages (`hyundaicanada.com/en/showroom/<my>/<model>`).

For each `(model, trim)` pair in `data/oem-pricing.json`:

1. Download the brochure PDF (curl) or fetch the showroom page (WebFetch).
2. Read the trim's price + standard equipment ladder.
3. Update the entry in `data/oem-pricing.json`:
   - `value`: latest CAD MSRP (excl. freight + PDI; the build script adds those)
   - `lastVerified`: today (ISO)
   - `source`: brochure PDF URL or showroom page URL
   - `staleSince`: `null` (or today's ISO date if OEM no longer lists the trim)
4. If a trim is gone, set `staleSince` and keep `value` as last-known.
5. If a new trim appears, add the entry — match the existing `data/specs.json` trim naming.
6. Run `python3 scripts/build_units_from_at.py` after — `data/units.json`
   should regenerate cleanly with the new MSRPs. Diff to confirm only
   intended price changes.

Per-trim research log goes to `docs/handoff/research/M12_msrp_<date>.md`
mirroring M9's shape.

Files: `data/oem-pricing.json`, `data/units.json`,
`docs/handoff/research/M12_msrp_<date>.md`. Estimate: 30-45 min.

---

## M16. Snapshot-diff daysOnLot script

GraphQL probe (M0) closed unusable — snapshot-diff is now the
daysOnMarket source. Full Python source ready in plan §5/M3 at
`/Users/ianmcadam/.claude/plans/you-are-the-planning-floating-breeze.md`
(pasteable; no architectural decisions left).

```bash
$EDITOR scripts/derive_days_on_market.py    # paste from plan §5/M3
chmod +x scripts/derive_days_on_market.py
python3 scripts/derive_days_on_market.py     # writes data/units-enrichment.json
python3 scripts/build_units_from_at.py       # picks up via existing overlay
npm run predeploy
git add scripts/derive_days_on_market.py data/units-enrichment.json data/units.json
git commit -m "feat(M16): derive daysOnLot from snapshot diff (stable-ID first-seen)"
```

Caveat: only 4 snapshots exist (2 historical, 2 recent), so first useful
per-unit `daysOnLot` is 1-2 days. The cron from M14 fixes this going
forward. Acceptable trade-off.

Estimate: 30-45 min.

---

## M17. simple-git-hooks pre-commit (typecheck-only)

Plan §5/M11 Part B. Mechanical:

```bash
cd ~/ev-auto-trader-canada
npm install --save-dev simple-git-hooks
```

Then add to `package.json`:
```json
{
  "scripts": { "...": "...", "prepare": "simple-git-hooks" },
  "simple-git-hooks": { "pre-commit": "npx tsc --noEmit" }
}
```

Run `npx simple-git-hooks` to wire `.git/hooks/pre-commit`. Verify:
plant a deliberate type error, attempt commit, expect block. Revert.
Commit:

```bash
git add package.json package-lock.json && \
  git commit -m "chore(M17): simple-git-hooks pre-commit typecheck"
```

Estimate: 10 min.

---

## What NOT to do on medium

These remain HIGH-only:

- **Phase 2.1** — Chrome MCP probe (live DOM/network analysis)
- **Anything in `BLOCKERS_MEDIUM.md`** — high-reasoning by definition

If a task above turns out to need judgment, STOP and surface it to the
user with the specific name + file + line.

---

## Reference

- Multi-environment pickup ritual: `SESSION_HANDOFF.md`
- Live blockers: `BLOCKERS_MEDIUM.md`
- LOW-reasoning fill tasks: `LOW_NEXT.md`
- Long-form work queue (HIGH + MEDIUM): `NEXT.md`
- Apify operator notes: `docs/APIFY_AUTOTRADER.md`
- Chrome probe runbook: `docs/CHROME_PROBE.md`
- v2 plan: `~/.claude/plans/you-are-continuing-the-shiny-pixel.md`
