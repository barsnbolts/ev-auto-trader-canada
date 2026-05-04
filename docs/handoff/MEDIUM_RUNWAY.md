# MEDIUM_RUNWAY — 60+ pre-baked tasks for autonomous medium work

> **Single-doc handoff.** Read CLAUDE.md → this file → execute. Each
> task below has file paths, expected diff or content sketch, verify
> command, token estimate, and risk class. Pick the highest-ROI
> unblocked item, ship it, push, repeat.
>
> **Authored 2026-05-04 at end of medium pass for the next session(s)
> to chew through without re-planning.** The previous medium pass
> closed 21 commits across 12 task IDs (see `SESSION_2026-05-04_MEDIUM.md`
> for the close-out summary).

## Boot script (RUN FIRST)

```bash
cd ~/ev-auto-trader-canada
git fetch origin
git status --short                                                  # expect empty
git rev-parse HEAD == $(git rev-parse origin/claude/verify-environment-setup-oTu3S) # expect true
npm run typecheck                                                    # expect exit=0
npx vitest run                                                       # expect 38/38 (or current count)
npm run predeploy                                                    # expect exit=0
```

**Then run Tier 0 § "Chrome MCP self-pair attempt"** — the user has the
Claude-in-Chrome extension installed (confirmed 2026-05-04) and uses it
across sessions, so Leasebusters is *probably* unblocked. Always probe
before falling through to Tier A.

If any check fails: investigate before picking a task. If all pass:
proceed to Tier 0, then drain Tier A onward.

## Hard rules (NEVER violate)

- Branch stays on `claude/verify-environment-setup-oTu3S`. No push to `main`.
- No `--no-verify`, no force push, no `--amend`.
- No code-signing / notarization / DMG (CLAUDE.md NO list).
- No Apify spend > $30 cumulative.
- `npm run predeploy` MUST pass before every `git push`.
- All edits inside `~/ev-auto-trader-canada` only.

## Stop conditions

- User types in chat (HIGHEST priority)
- Tauri build fails twice on same root cause
- `npm run predeploy` fails twice on same root cause
- About to violate a hard rule

## Loop pattern

```
1. Pick highest unblocked task from a tier you haven't drained yet
2. Read the task block — note file paths + verify command
3. Apply changes (use Edit, not Write, where possible)
4. Run the verify command
5. If fail: investigate, fix, re-verify. Two failures on same root cause = halt
6. Run npm run predeploy
7. If clean: git add specific files, commit (HEREDOC message), git push origin HEAD
8. Append a one-line entry to docs/handoff/TAURI_BUILD_LOG.md
9. Mark the task done in the "Done log" section at the bottom of this file
10. Loop back to step 1
```

---

# THE QUEUE — 61 tasks

Tiers ranked by ROI-per-token. Within a tier, items are roughly equal
priority; pick whichever feels concrete. **Total runway: ~230k tokens
of focused, mechanical work** (Tier 0 + A through G).

## Tier 0 — Auto-checks at session start (run BEFORE Tier A)

> **Why this tier exists.** User Ian explicitly confirmed
> (2026-05-04) that the Claude-in-Chrome extension is already
> downloaded and that pairing happens automatically on his machine.
> So instead of treating Leasebusters as a permanent block, every
> medium session probes for a paired browser first and pivots to the
> Leasebusters scraper rewrite (huge ROI, ~10-15k tokens) if one is
> found. If no browser pairs within the timeout, fall through to
> Tier A and don't block the queue.

### 0.1 Chrome MCP self-pair attempt + Leasebusters probe

**Purpose:** unblock cross-source Leasebusters lease-takeover listings
(currently 0 entries → potentially 50+ once scraper rewritten with the
real XHR endpoint).

**Token est:** ~3k for the probe + auto-pair logic; ~15k more if
unblocked and the scraper rewrite proceeds inline this session.

**Risk:** none for the probe itself; scraper rewrite is medium-risk
(new XHR endpoint shape may differ from Kijiji).

**Decision flow:**

```
Step 1. mcp__Claude_in_Chrome__list_connected_browsers
        ├─ non-empty → cache deviceId; jump to Step 3 (probe)
        └─ empty     → Step 2

Step 2. mcp__Claude_in_Chrome__switch_browser
        (broadcasts pair request to every Chrome with extension; waits
         up to 2 minutes for user to click Connect)
        ├─ pairs successfully → jump to Step 3
        └─ timeout / declined →
              - log one line to TAURI_BUILD_LOG.md:
                "Tier 0.1: Chrome MCP not paired this session — Leasebusters deferred"
              - DO NOT halt. Skip to Tier A.
              - Try again on next cron / restart (extension may auto-reconnect later).

Step 3. Run docs/handoff/CHROME_MCP_PROBE_PLAYBOOK.md § Site 2 verbatim:
        - Open about:blank tab, install fetch+XHR hook
        - Navigate Leasebusters Hyundai gallery URL
        - Capture XHR responses
        - Click first listing card → capture detail page
        - Save raw captures to docs/handoff/research/LEASEBUSTERS_XHR_CAPTURE_2026-05-04.json
        - Save 1-page decision summary to docs/handoff/research/LEASEBUSTERS_VIN_DECISION_2026-05-04.md

Step 4. Update scripts/scrape_leasebusters.py per the captured XHR
        endpoint (mirror the scrape_kijiji.py rewrite pattern from
        commit abeacb64). Use lib_scrape_common helpers.

Step 5. Verify:
        python3 scripts/scrape_leasebusters.py
        python3 scripts/merge_cross_sources.py
        jq 'keys | length' data/cross-listings.json   # expect > 0
        npx vitest run                                # 38/38 still
        npm run predeploy                             # clean

Step 6. Commit (HEREDOC):
        feat(D-core): leasebusters scraper rewrite via captured XHR

        - Live XHR endpoint <url> captured via Chrome MCP
        - <N> listings for Hyundai/Kia EVs in Canada
        - Merged into cross-listings.json (VIN as primary key if found,
          else fallbackKey year+make+model+trim+kmBucket)
        - CrossSourceChip now lights up on inventory rows with matches
        - Closes the last D-core blocker

Step 7. Push, append TAURI_BUILD_LOG.md line, mark "0.1: <sha>" in Done log.
```

**Stop conditions specific to Tier 0.1:**
- Cloudflare WAF on Leasebusters → halt this task, document in
  research log, defer to Tier I (Apify-walled). Don't fight WAF.
- VIN-only-after-login → document, do NOT pursue login flow (per
  CLAUDE.md NO list).
- Probe captures empty after 3 trigger attempts → save the empty
  captures as evidence, log "needs probe re-run with different
  starting URL", defer.

**Fallback if no browser pairs:** Leasebusters stays scoped via
fallbackKey (year+make+model+trim) the way it works today, and the
next scheduled session re-tries the pair attempt. The auto-pair flow
is idempotent — running it on every session start is fine.

---

## Tier A — High-value, low-risk (ship in any order, ~50k total)

### A1. Vitest specs for `format.ts`

**Files:** `src/lib/format.test.ts` (NEW)
**Token est:** ~3k
**Risk:** none — pure functions, no fixtures

```typescript
import { describe, it, expect } from "vitest";
import { fmtCad, fmtPercent, fmtDate, relativeDays } from "./format";

describe("fmtCad", () => {
  it("formats whole CAD by default", () => {
    expect(fmtCad(50000)).toMatch(/CA\$50,000|\$50,000\.00/);
  });
  it("with cents flag adds 2 decimals", () => {
    expect(fmtCad(50000.5, { cents: true })).toMatch(/50,000\.50/);
  });
});

describe("fmtPercent", () => {
  it("default 2 decimals", () => expect(fmtPercent(7.5)).toBe("7.50%"));
  it("custom digits", () => expect(fmtPercent(7.5, 0)).toBe("8%"));
});

describe("fmtDate", () => {
  it("renders ISO as en-CA short date", () => {
    expect(fmtDate("2026-05-04T12:00:00Z")).toMatch(/May 4, 2026/);
  });
});

describe("relativeDays", () => {
  it("today for fresh ISO", () => expect(relativeDays(new Date().toISOString())).toBe("today"));
  // Use frozen Date.now via vi.useFakeTimers if needed.
});
```

**Verify:** `npx vitest run src/lib/format.test.ts`

---

### A2. Vitest specs for `battery_degradation.ts`

**Files:** `src/lib/battery_degradation.test.ts` (NEW)
**Token est:** ~3k
**Risk:** none

```typescript
import { describe, it, expect } from "vitest";
import { retentionAtYear, projectedRangeAtYear } from "./battery_degradation";

describe("retentionAtYear", () => {
  it("LFP: ~0.8%/yr → year 5 ≈ 96%", () => {
    expect(retentionAtYear("LFP", 5)).toBeCloseTo(0.96, 2);
  });
  it("NMC: ~1.8%/yr → year 5 ≈ 91%", () => {
    expect(retentionAtYear("NMC", 5)).toBeCloseTo(0.91, 2);
  });
  it("clamps to 50% floor for very long horizons", () => {
    expect(retentionAtYear("NMC", 100)).toBe(0.5);
  });
  it("UNKNOWN defaults to NCA-ish (~2%/yr)", () => {
    expect(retentionAtYear("UNKNOWN", 5)).toBeCloseTo(0.90, 2);
  });
});

describe("projectedRangeAtYear", () => {
  it("scales rated range by retention", () => {
    expect(projectedRangeAtYear(500, "LFP", 5)).toBeCloseTo(480, 0);
    expect(projectedRangeAtYear(500, "NMC", 5)).toBeCloseTo(455, 0);
  });
});
```

**Verify:** `npx vitest run src/lib/battery_degradation.test.ts`

---

### A3. Vitest specs for `aggregations.ts`

**Files:** `src/lib/aggregations.test.ts` (NEW)
**Token est:** ~5k
**Risk:** low — needs Dealer + ScoredUnit fixtures

Pattern: build minimal fixture using `as unknown as Dealer` / `as unknown as ScoredUnit` (same pattern as scoring.test.ts). Cover:
- `inGGH` returns true for ON+Toronto, false for QC, false for ON+Sudbury
- `dealerPressureMap` returns `{}` when no units, returns 0 for dealers with no units
- `computeKpis` returns one entry per Model in MODELS

**Verify:** `npx vitest run src/lib/aggregations.test.ts`

---

### A4. Vitest specs for `usedListingsLinks.ts`

**Files:** `src/lib/usedListingsLinks.test.ts` (NEW)
**Token est:** ~4k
**Risk:** none

```typescript
import { describe, it, expect } from "vitest";
import { usedListingsFor } from "./usedListingsLinks";

describe("usedListingsFor", () => {
  it("returns AutoTrader URL with proper slug for Ioniq5 + ON", () => {
    const links = usedListingsFor("Ioniq5", "ON");
    expect(links.autoTrader).toContain("ioniq+5");
    expect(links.autoTrader).toContain("on");
  });
  it("returns Kijiji URL", () => {
    const links = usedListingsFor("EV6", "ON");
    expect(links.kijiji).toMatch(/kijiji\.ca/);
  });
  it("returns Leasebusters base URL (no deep link possible)", () => {
    const links = usedListingsFor("EV6", "ON");
    expect(links.leasebusters).toBe("https://www.leasebusters.com/");
  });
});
```

**Verify:** `npx vitest run src/lib/usedListingsLinks.test.ts`

---

### A5. Extend `crossListings.test.ts` — `lookupCrossSource` VIN-vs-fallback

**Files:** `src/lib/crossListings.test.ts` (extend existing)
**Token est:** ~3k
**Risk:** low

Add specs:
- VIN match wins over fallbackKey match
- Falls back to fallbackKey when VIN is null
- Returns null when neither matches
- Trim with whitespace normalizes correctly

**Verify:** `npx vitest run src/lib/crossListings.test.ts`

---

### A6. Schema-drift catcher: validate enum values

**Files:** `scripts/validate_data_schemas.py` (extend)
**Token est:** ~4k
**Risk:** low

Add `is_in_set` predicate. For:
- `units[].status` ∈ `{in_stock, in_transit, demo, loaner, sold_pending}`
- `incentives[].scope` ∈ `{federal, provincial, manufacturer_cash, loyalty, conquest, lease_promo, finance_promo, charger_install}`
- `incentives[].status` ∈ `{active, paused, ended, upcoming}`
- `units[].drivetrain` ∈ `{RWD, AWD, FWD}` (FWD allowed for non-EV legacy)
- `dealers[].brand` ∈ `{Hyundai, Kia}`

**Verify:** `python3 scripts/validate_data_schemas.py` exit=0; inject a bad enum, exit=1.

---

### A7. Schema-drift catcher: cross-reference validation

**Files:** `scripts/validate_data_schemas.py` (extend)
**Token est:** ~5k
**Risk:** low

Add a `check_cross_references()` function:
- Every `unit.dealerId` resolves to a dealer in dealers.json
- Every `incentive.appliesTo.models` entry is a valid Model from MODELS
- Every `cross-listings.json[].listings[].source` is a known source
- Every `unit.year` is in SUPPORTED_YEARS

**Verify:** Same as A6.

---

### A8. Refactor `scrape_unit_gallery.py` to use `lib_scrape_common`

**Files:** `scripts/scrape_unit_gallery.py` (REWRITE)
**Token est:** ~3k
**Risk:** medium — changes a working scraper

Replace `subprocess.run(["curl", ...])` with `fetch_html()` from
lib_scrape_common. Preserve existing behavior: same output schema,
same error handling. Add `record_run()` at the end.

**Verify:** `python3 scripts/scrape_unit_gallery.py --dry-run` (if flag exists; else run on 1 unit and inspect output).

---

### A9. NHTSA VIN decode caching

**Files:** `scripts/lib_scrape_common.py` (extend `nhtsa_decode`)
**Token est:** ~5k
**Risk:** low

Add `data/_vin_cache.json` (keyed by VIN, value is the decode result + timestamp). Check cache before HTTP call, write after. Cache TTL = 30 days.

**Verify:** Run `nhtsa_decode("KMHK...")` twice; second call should be instant + cache hit.

---

### A10-12. Component READMEs

**Files:** Each next to its component
**Token est:** ~3k each (~9k total)
**Risk:** none — pure docs

Per-component README covering: what it renders, key props, state it owns, what it depends on, what depends on it. Format: 5-line summary + section headers.

- A10. `src/components/InventoryTable.README.md`
- A11. `src/app/inventory/[id]/dossier/DossierClient.README.md`
- A12. `src/components/CompareGrid.README.md`

**Verify:** Files exist, render reasonably as markdown.

---

### A13. INVARIANTS.md — codebase contracts

**Files:** `docs/INVARIANTS.md` (NEW)
**Token est:** ~5k
**Risk:** none

Document the rules the code commits to. Each invariant has: name, what it guarantees, where it's enforced, what breaks if violated.

Example invariants:
- Stable IDs: `u-at-<8hex>` per AutoTrader unit; SHA1 of (vin || stockNumber+dealerId)
- Single buyer-context cookie shape; no legacy fallback at runtime
- Every measured spec is a CitedValue<T> with confidence
- Per-source raw JSON is keyed by source-stable id
- Cross-source merge: VIN preferred, fallbackKey otherwise
- daysOnLot is derived from snapshot first-sighting, not scraped
- Predeploy gate must pass before every push

**Verify:** Reads cleanly top-to-bottom.

---

### A14. scripts/README.md

**Files:** `scripts/README.md` (NEW)
**Token est:** ~5k
**Risk:** none

One paragraph per script in `scripts/` describing purpose, how it's invoked, what it reads, what it writes. Link to TOOL_DECISION_MATRIX.md and SCRAPER_LEARNINGS.md.

**Verify:** Reads cleanly; covers all 21 scripts.

---

### A15. Update `CLAUDE.md` with vitest + schema-audit

**Files:** `CLAUDE.md`
**Token est:** ~2k
**Risk:** none

Add `npx vitest run` to the verification gauntlet. Add `scripts/validate_data_schemas.py` to the predeploy chain mention.

**Verify:** Predeploy chain in `package.json` matches doc.

---

## Tier B — Performance wins (~30k total)

### B1. Lazy-load `HistoryCharts` on `/history`

**Files:** `src/app/history/page.tsx` + new `src/app/history/HistoryClient.tsx`
**Token est:** ~5k
**Risk:** medium — server→client split

`/history` is a server component (force-static). `HistoryCharts` uses recharts. Either:
1. Move chart rendering into a client wrapper, then dynamic-import the wrapper
2. Verify the build output already lazy-splits HistoryCharts (it might — current bundle shows 137 B route-specific)

**Verify:** `BUILD_TARGET=tauri npm run build:tauri:web` — `/history` First Load JS unchanged or smaller.

---

### B2. Lazy-load `DealerMap` (leaflet) on `/dealer/[id]` + `/map`

**Files:** `src/app/dealer/[id]/page.tsx`, `src/app/map/page.tsx`
**Token est:** ~5k
**Risk:** low — DealerMapClient already exists

Wrap the DealerMap import via `next/dynamic({ ssr: false })`. Leaflet weighs ~150 kB; saves on first-load for users who never click the map.

**Verify:** Bundle delta on `/map` and `/dealer/[id]`.

---

### B3. Polyfills drop for Tauri target

**Files:** `next.config.mjs`
**Token est:** ~3k
**Risk:** medium — Next 15 may have moved/removed the flag

Try setting `experimental.legacyBrowsers: false` (or equivalent in Next 15) only when `BUILD_TARGET === "tauri"`. WKWebView is Safari ~17. ~100 kB save.

If the flag has been removed in Next 15: document it in BUNDLE_AUDIT_2026-05-04.md and skip.

**Verify:** Tauri build still works; First Load JS smaller across all routes.

---

### B4. Memoize `dealerPressureByDealer` in `InventoryTable`

**Files:** `src/components/InventoryTable.tsx`
**Token est:** ~3k
**Risk:** low

The map is computed once per render but ScoredUnit array changes only when buyerContext changes. Wrap in `useMemo([scoredUnits])`.

**Verify:** No regressions in render output.

---

### B5. Reduce re-renders in dossier

**Files:** `src/app/inventory/[id]/dossier/DossierClient.tsx`
**Token est:** ~5k
**Risk:** medium

Profile render count via `<Profiler>` or React DevTools. Common culprits: searchParams.get inside loops, useState dep that should be useMemo.

**Verify:** No regressions; render count reduced.

---

### B6. Move `cross-listings.json` to lazy-load

**Files:** `src/lib/crossListings.ts`
**Token est:** ~5k
**Risk:** medium

Currently statically imported (bundles into shared chunk). If the file grows past ~50 kB, dynamic-import it via `await import(...)` at lookup time. Wrap behind a memoized loader so the import fires once.

**Verify:** Bundle size of shared chunk reduces by `cross-listings.json.size`.

---

### B7. Suspense boundaries on heavy routes

**Files:** `src/app/inventory/[id]/dossier/DossierClient.tsx`, `src/app/inventory/page.tsx`
**Token est:** ~5k
**Risk:** medium

Wrap chart sections in `<Suspense fallback={...}>` so dynamic imports don't block the main panel.

**Verify:** Initial paint faster; chart sections render second.

---

## Tier C — UX polish (~30k total)

### C1. Stale-listing chip for units >14 days unseen

**Files:** `src/components/InventoryTable.tsx`
**Token est:** ~3k
**Risk:** low

`u.lastSeen` already exists. If `daysSince(u.lastSeen) > 14`, render a `chip-warn` "🕒 Stale" pill next to row. Already partial: the existing `stale = daysSince(u.lastSeen) > 7` boolean isn't visualized prominently.

**Verify:** Inject a 30-day-old `lastSeen` in fixture; chip appears.

---

### C2. Empty state UI on `/history` when 0 snapshots

**Files:** `src/app/history/page.tsx` (already has empty state, may need polish)
**Token est:** ~3k
**Risk:** none

Verify the existing empty state renders + add "Run npm run snapshot" CTA. The text exists but could include an example date format.

---

### C3. "Updated X minutes ago" header timestamp

**Files:** `src/app/inventory/page.tsx` (already has `UpdatedStamp`)
**Token est:** ~3k
**Risk:** low

Verify it's wired to `meta.unitsUpdatedAt`. Add to dossier header too.

---

### C4. Better loading skeleton for inventory table

**Files:** `src/app/inventory/loading.tsx`
**Token est:** ~3k
**Risk:** none

Current skeleton is a plain pulse. Build a 100-row skeleton table with column structure visible (so the layout doesn't shift on data arrival).

---

### C5. Print stylesheet for `/dealer/[id]`

**Files:** `src/app/globals.css` (extend `@media print`)
**Token est:** ~3k
**Risk:** none

Hide map widget on print. Force list-of-units to single column. Inline contact info.

---

### C6. Print preview for `/compare`

**Files:** Same.
**Token est:** ~3k

Compare grid renders 4 columns wide; on print, force 2-column wrap so it fits letter portrait.

---

### C7. "Copy as JSON" button on dossier

**Files:** `src/app/inventory/[id]/dossier/DossierClient.tsx`
**Token est:** ~4k
**Risk:** low

Add a button that copies the unit + dealer + computed OTD as a single JSON blob to clipboard. Useful for sharing a deal with a friend / second opinion.

---

### C8. Highlight VINless rows distinctly

**Files:** `src/components/InventoryTable.tsx`
**Token est:** ~3k
**Risk:** low

If `!u.vin`, add a subtle border-left or bg tint. Indicates "we don't have AutoTrader's full identity for this listing."

---

### C9. aria-live on RefreshModal log

**Files:** `src/components/RefreshModal.tsx`
**Token est:** ~3k
**Risk:** low

Wrap the log container in `<div role="log" aria-live="polite">` so VoiceOver narrates each new line as it streams in.

---

### C10. Skip-to-content link

**Files:** `src/app/layout.tsx`
**Token est:** ~2k
**Risk:** none

Add a `<a href="#main" className="sr-only focus:not-sr-only">Skip to content</a>` at the top of the layout, plus `id="main"` on the main wrapper.

---

### C11. aria-label on TempSlider

**Files:** `src/components/TempSlider.tsx`
**Token est:** ~2k
**Risk:** none

Add `aria-label="Outside temperature: {tempC}°C"` to the slider.

---

## Tier D — Test depth (~35k total)

### D1. Vitest specs for `computeOtd`

**Files:** `src/lib/scoring.test.ts` (extend)
**Token est:** ~8k
**Risk:** medium — needs realistic Dealer + Incentive fixtures

Build a minimal Dealer (ON, Toronto), Unit (Ioniq5 Preferred RWD, $50k MSRP), and 0/1/2/3 applicable incentives. Assert:
- Total includes msrp + freight + AC excise + sales tax + ON dealer fees
- Sales tax is HST 13% on pre-tax base in ON
- transportCost is 0 for same-province
- incentivesApplied subtracts cleanly

---

### D2. Vitest specs for `computeFinanceOtd` PMT formula

**Files:** Same.
**Token est:** ~6k

Verify the standard PMT formula:
```
P × r × (1+r)^n / ((1+r)^n - 1)
```
where P = principal, r = monthly rate, n = term months. Anchor against a known external calculator value (e.g., $42k @ 5.99% over 84 months ≈ $613/mo).

---

### D3. Vitest specs for `computeLeaseOtd` residual buyout

**Files:** Same.
**Token est:** ~6k

Lease monthly = depreciation + finance charge.
- depreciation = (capCost - residual) / term
- finance charge = (capCost + residual) × moneyFactor

Anchor against a known external lease calc.

---

### D4. Vitest specs for `evapEligibleAmount` lease term proration

**Files:** Same.
**Token est:** ~5k

EVAP rebate prorates by lease term: 48mo+ = full $5k, 36mo = $3.75k,
24mo = $2.5k, 12mo = $1.25k, cash = $0. Test all 5 buckets.

---

### D5. Vitest integration test for `dataClient.loadScoredUnits`

**Files:** `src/lib/dataClient.test.ts` (NEW)
**Token est:** ~6k
**Risk:** medium — touches real data files

Import dataClient.loadScoredUnits with a fixed buyerContext. Assert:
- Returns ≥ 90 units
- Every unit has `otdBreakdown.total` > 0
- Sort order: deal-score descending
- Dealer lookup hits ≥ 95% of units

---

### D6. Vitest specs for `dealerPressureMap`

**Files:** `src/lib/aggregations.test.ts` (extend or new)
**Token est:** ~4k

Already partially covered by A3. Extend to check averaging across multi-unit dealers.

---

## Tier E — Data hygiene (~25k total)

### E1. Stale-incentive flagger

**Files:** `scripts/flag_stale_incentives.py` (NEW)
**Token est:** ~4k
**Risk:** low

Walks `data/incentives.json`, prints any entry with `lastVerified` >30 days ago. Exit code 0 (advisory). Wire into a future cron — not predeploy (don't block builds for stale data).

---

### E2. Spec/unit join validator

**Files:** `scripts/validate_unit_spec_joins.py` (NEW)
**Token est:** ~5k

For every unit in units.json, look up the spec by (model, year, trim, drivetrain). Print any unit whose spec lookup fails.

---

### E3. Snapshot pruner with `--keep-N` flag

**Files:** `scripts/prune_snapshots.py` (NEW)
**Token est:** ~4k

Keeps the latest N snapshots, deletes older ones. Default keep=14. Add to a future cron after derive_days_on_market.py runs.

---

### E4. Per-source health dashboard

**Files:** `scripts/scraper_health.py` (NEW)
**Token est:** ~6k

Reads `data/_scraper_metrics.jsonl`. Prints a per-source 5-day rolling
table: avg fetch count, avg unique, avg vin_pct, avg checksum_ok_pct,
error count. Flag outliers (vin_pct dropped >10pp = WARN).

---

### E5. CHANGELOG.md generator

**Files:** `scripts/generate_changelog.py` (NEW), `CHANGELOG.md` (NEW)
**Token est:** ~5k

Walk `git log --pretty=format:"%h %s"`, group by date, render as
markdown. Re-run on cron to refresh.

---

### E6. Refresh `data/oem-pricing.json` `lastVerified`

**Files:** `data/oem-pricing.json`
**Token est:** ~4k

Bump `lastVerified` to current month after Exa-checking the OEM pages
match. If any prices changed, update them inline.

---

### E7. Validate `data/transport-bands.json` neighbours symmetry

**Files:** `scripts/validate_data_schemas.py` (extend)
**Token est:** ~3k

Every neighbour relationship should be bidirectional (if AB→BC, then BC→AB). Currently hand-curated; easy to drift.

---

## Tier F — Code quality (~25k total)

### F1. Centralize date slicing

**Files:** `src/lib/format.ts` (extend), grep + replace `slice(0, 10)`
**Token est:** ~3k

Add `function isoDay(iso: string): string { return iso.slice(0, 10); }`.
Find all call sites, swap.

---

### F2. Type chip class names

**Files:** `src/lib/constants.ts` (extend) + grep audit
**Token est:** ~3k

Export `type ChipVariant = "good" | "bad" | "warn" | "neutral" | "accent"`.
Add a helper `chipClass(variant: ChipVariant): string` mapping to the
existing `chip-good` / `chip-bad` etc. CSS classes. Replace string
literals at call sites.

---

### F3. Drop `as unknown as TransportBands` cast

**Files:** `src/lib/scoring.ts`
**Token est:** ~2k

Add a Zod schema for `transport-bands.json` next to the import; parse
at module init. Remove the cast.

---

### F4. Extract magic numbers in `scoring.ts` to constants

**Files:** `src/lib/scoring.ts`, `src/lib/constants.ts`
**Token est:** ~3k

Magic numbers in scoring:
- `5%` (priceVsMsrp 5% below = ~1.0)
- `120` (daysOnLot ceiling)
- `4` (dealerPressure depth threshold)
- `90` (dealerPressure age threshold)

Move to named constants with comments explaining the calibration.

---

### F5. Sort imports across all .ts/.tsx

**Files:** all src files
**Token est:** ~5k
**Risk:** low

Manually sort each file's imports: stdlib → third-party → @ aliases → relative. No formatter installed; do it by hand for InventoryTable, DossierClient, scoring.ts (the busiest files).

---

### F6. Consolidate `data.ts` and `dataClient.ts` shared logic

**Files:** `src/lib/data.ts`, `src/lib/dataClient.ts`, new `src/lib/dataCommon.ts`
**Token est:** ~8k
**Risk:** medium

The two files share scoring/sort logic but differ on the loader. Extract
the post-load processing (compute OTD, sort, build dealerById Map) into
`dataCommon.ts`. Both files call into it.

---

### F7. Memoize ScoredUnit ordering

**Files:** `src/lib/data.ts` + `dataClient.ts`
**Token est:** ~3k

`loadScoredUnits` re-computes scores every call. Cache by buyerContext
hash; reuse when context is identical.

---

## Tier G — Documentation (~25k total)

### G1. Cross-listings join algorithm doc

**Files:** `docs/CROSS_LISTINGS.md` (NEW)
**Token est:** ~4k

Walk the algo: VIN preferred, fallback by `year|make|model|trim`. Why
km dropped from join key. Why model + trim normalization. Worked
example with a real Kijiji listing matching an AutoTrader unit.

---

### G2. daysOnLot derivation doc

**Files:** `docs/DAYS_ON_LOT.md` (NEW)
**Token est:** ~3k

Explain the snapshot-first-sighting algorithm. Caveats: relistings get
overstated; 1-day floor when only one snapshot exists. Reference the
script `derive_days_on_market.py`.

---

### G3. Update DEPLOY.md with current state

**Files:** `docs/DEPLOY.md`
**Token est:** ~3k

Document the env-toggled `BUILD_TARGET=tauri` flow + the predeploy
chain (typecheck + thermal-audit + schema-audit + build).

---

### G4. Phase D pipeline architecture diagram

**Files:** `docs/PHASE_D_ARCH.md` (NEW)
**Token est:** ~4k

ASCII diagram: scraper → raw → merge → cross-listings.json → CrossSourceChip.
List per-source assignments (already in TOOL_DECISION_MATRIX.md but expand on pipeline).

---

### G5. Tauri Rust commands API doc

**Files:** `src-tauri/README.md` (NEW)
**Token est:** ~3k

Document the 3 commands: `read_data_file`, `run_verify_unit`, `run_refresh`,
`set_dock_badge`. Inputs, outputs, side effects, where they're called
from JS.

---

### G6. Component dependency graph

**Files:** `docs/COMPONENT_GRAPH.md` (NEW)
**Token est:** ~5k

ASCII tree of which component imports which. Useful when refactoring —
shows the blast radius of any change. Auto-generate from TS imports if
practical (one-time).

---

### G7. Add a "How to add a new EV model" recipe

**Files:** `docs/HOW_TO_ADD_MODEL.md` (NEW)
**Token est:** ~3k

Step-by-step: edit `MODELS` in constants, add `MODEL_LABEL`, add specs
entries, add scraper URL slug, add to vehicle-images.json, etc.

---

## Tier H — Speculative new features (need user OK before)

> **DO NOT auto-execute these.** They expand scope. Append to the queue
> with a note + ping the user via the chat at the next interaction.

### H1. Saved filter sets in localStorage
### H2. Email export (mailto:) of dossier
### H3. Best-deal of the week banner on /
### H4. Price-drop alerts (compare to prior snapshot)
### H5. "I bought this" archive flag (removes from active inventory)
### H6. Dealer call timestamp tracker
### H7. Custom domain on Vercel
### H8. Mobile responsive breakpoint pass

Each ~10-30k tokens. Rough sketches only — flesh out only after user OK.

---

## Tier I — Big-ticket, blocked or paid

> **NEVER auto-execute. Pause + ping user.**

### I1. Leasebusters scraper — MOVED to Tier 0.1
- See **Tier 0.1** at top of queue. User confirmed the Claude-in-Chrome
  extension is installed (2026-05-04), so every session auto-attempts
  the pairing via `switch_browser` and runs the probe inline if it
  succeeds. No longer treated as a hard block.
- Recipe still lives in `CHROME_MCP_PROBE_PLAYBOOK.md` § Site 2.

### I2. Phase D-bis: Hyundai Click-to-Buy + Kia D2C Media (PAID)
- Apify-walled. ~$0.10-$0.50/run. Within $30 budget.
- ~95k tokens implementation.

### I3. Phase E: OEM dealer API direct
- Endpoint discovery via Chrome MCP. Real-time per-store inventory.
- ~60-80k tokens.

### I4. Apify scraper for AutoTrader (currently free SSR)
- If AutoTrader anti-bot tightens, this is the fallback.
- Within Apify budget.

---

# Done log

Track shipped items here so the next session knows what's left. Format:
`- [x] <id>: <commit-sha>` or `- [blocked] <id>: <reason>`.

(Items checked off below are appended by the medium session as it works.)

```
- [deferred] 0.1: Chrome MCP not paired this session; switch_browser returned no-browsers-available at b90db655
- [x] A1: format.test.ts — 19 specs covering fmtCad / fmtPercent / fmtDate / relativeDays. Total suite 57/57.
- [x] A2: battery_degradation.test.ts — 10 specs (retentionAtYear x7, projectedRangeAtYear x3).
- [x] A3: aggregations.test.ts — 14 specs (dealerPressureMap x3, inGGH x4, computeKpis x4, provinceRollup x3).
- [x] A4: usedListingsLinks.test.ts — 14 specs (AutoTrader x5, Kijiji x4, Leasebusters x3, return shape x2). Total suite 95/95.
- [x] A5: crossListings.test.ts +5 specs for lookupCrossSource VIN-vs-fallback. Surfaced format asymmetry between Python merge (4-segment) and TS makeFallbackKey (5-segment) — documented in spec, fix queued as F-tier task.
- [x] A6: validate_data_schemas.py +enum validation (UNIT_STATUS, DRIVETRAIN, INCENTIVE_SCOPE, INCENTIVE_STATUS, DEALER_BRAND, MODELS, SUPPORTED_YEARS, PROVINCES, CROSS_LISTING_SOURCES). Verified bad-enum injection fails predeploy.
- [x] A7: validate_data_schemas.py +check_cross_references — units.dealerId resolves; units.(model,year,trim,drivetrain) resolves to a spec. "Trim unknown" units skipped (acknowledged parser gap). Total suite 100/100.
```

---

## Coverage map

| Tier | Item count | Token est | Risk | When to drain |
|---|---|---|---|---|
| 0 — Auto-checks (Chrome MCP pair) | 1 | ~3k probe + ~15k if unblocked | low | EVERY session start |
| A — High-value low-risk | 15 | ~50k | low | After Tier 0 |
| B — Performance | 7 | ~30k | medium | After A |
| C — UX polish | 11 | ~30k | low-medium | Anytime |
| D — Test depth | 6 | ~35k | medium | After A's tests pass |
| E — Data hygiene | 7 | ~25k | low | Anytime |
| F — Code quality | 7 | ~25k | medium | After tests |
| G — Documentation | 7 | ~25k | none | Anytime |
| H — Speculative | 8 | (needs user) | (need OK) | Pause + ping |
| I — Big/blocked/paid | 3 | (needs user) | (need OK) | Pause + ping |
| **Total auto-runway (0 + A-G)** | **61** | **~235k** | mixed | — |

Even at 10k tokens per task average, this is **~22 days of recurring
4-hour cron fires**. Should be plenty.

## After this queue empties

1. Re-run `grep -rn "TODO\|FIXME" src/ scripts/` — any new ones from
   shipped commits become tasks.
2. Re-walk `/inventory`, `/dossier`, `/compare`, `/pick-a-model` in the
   Tauri .app. Note any visual rough edges. File as new C-tier tasks.
3. Re-run `BUILD_TARGET=tauri npm run build:tauri:web` and re-audit
   chunk sizes. Compare to `BUNDLE_AUDIT_2026-05-04.md`.
4. Re-walk all `data/*.json` files — any with `lastVerified` >30 days
   ago = E-tier task to refresh.
5. Run `npx vitest --coverage` (install `@vitest/coverage-v8` if
   missing) — every uncovered exported function = D-tier task.
6. Re-read CLAUDE.md + AUTONOMOUS_MODE.md. Check that nothing's drifted.
7. Append discoveries to this file as new tasks.

If still stuck: open `AUTONOMOUS_MODE.md` § "When the ladder is
exhausted (it never really is)" for the creative re-prime protocol.
