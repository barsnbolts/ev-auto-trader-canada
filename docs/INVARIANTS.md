# Codebase invariants

> Contracts the code commits to. Each entry: **what**, **where it's
> enforced**, **what breaks if violated**. Update when shipping a
> change that creates or modifies a contract.

---

## Identity + IDs

### Stable unit IDs are `u-at-<8hex>`
- **What:** every InventoryUnit row in `data/units.json` has an `id`
  matching `^u-at-[0-9a-f]{8}$`. Hash basis: SHA1 of
  `${vin || stockNumber + dealerId}`. AutoTrader is the only source
  today; future sources (Leasebusters etc.) will use `u-lb-<8hex>` etc.
- **Enforced:** `scripts/build_units_from_at.py` produces the IDs;
  `scripts/validate_data_schemas.py` will flag a non-string `id`;
  `scripts/derive_days_on_market.py` filters snapshots by the regex.
- **Breaks if violated:** `daysOnLot` derivation joins by ID; cross-
  session deep-link share (`/inventory/<id>/dossier`) breaks; favorites
  in localStorage misalign.

### Stable dealer IDs are kebab-case `<brand>-<city>`
- **What:** every Dealer in `data/dealers.json` has `id` matching
  `^(hyundai|kia)-[a-z0-9-]+$`.
- **Enforced:** `data/dealers.json` is hand-curated; `validate_data_schemas`
  cross-ref check rejects unit references to missing dealer IDs.
- **Breaks if violated:** every route that joins units → dealer (every
  route) shows dealer="?" or crashes a Map lookup downstream.

---

## Data shape

### Every measured spec is a `CitedValue<T>`
- **What:** range, charging rates, weight, etc. carry
  `{ value, source, confidence, notes? }` where confidence ∈
  {`High`, `Medium`, `Low`}. Never bare numbers in `data/specs.json`.
- **Enforced:** `src/lib/types.ts` Zod schema; `validate_data_schemas`
  type-checks the shape per leaf.
- **Breaks if violated:** the Confidence chip in DossierClient renders
  blank; cited-source tooltip is empty; user can't tell what's
  authoritative vs heuristic.

### `oem-pricing.json` envelope has `lastVerified`
- **What:** top-level `lastVerified: "YYYY-MM-DD"` flag. UI surfaces a
  staleness chip when older than 30 days.
- **Enforced:** Zod schema in `src/lib/types.ts`; refresh script bumps
  timestamp on each successful run.
- **Breaks if violated:** stale-pricing chip doesn't render or renders
  stuck.

### Single-cookie buyer context (no legacy fallback)
- **What:** `BuyerContext` from `src/lib/buyerContext.ts` is the sole
  source of buyer state (province + loyalty + conquest flags). The
  pre-medium legacy `province`-only cookie was retired.
- **Enforced:** server reads via `src/lib/buyerContextServer.ts` only.
  Client writes via `useBuyerContext` hook.
- **Breaks if violated:** OTD math defaults to ON tax basis silently
  for non-ON buyers; loyalty/conquest incentives mis-applied.

---

## Cross-source merge

### VIN preferred, fallbackKey otherwise
- **What:** `data/cross-listings.json` indexes entries by VIN as primary
  key when available; falls back to a constructed key
  `<year>|<make>|<model>|<trim>` (Python format, no km bucket today —
  see asymmetry below).
- **Enforced:** `scripts/merge_cross_sources.py` builds the index;
  `src/lib/crossListings.ts` `lookupCrossSource` reads it.
- **Breaks if violated:** Cross-source price-delta chip on inventory
  rows shows zero overlaps.

### KNOWN ASYMMETRY — fix queued as F-tier task
- **What:** `scripts/merge_cross_sources.py` writes 4-segment fallback
  keys (`year|make|model|trim`). `src/lib/crossListings.ts`
  `makeFallbackKey` produces 5-segment keys (`...|kmBucket`).
- **Today:** every cross-listing entry has a VIN, so the fallback path
  is never exercised in production. The asymmetry is silent.
- **Captured by:** `src/lib/crossListings.test.ts` "documents
  fallbackKey format asymmetry" spec.
- **Fix path:** align the two key shapes (most likely: drop km from TS,
  match Python). Tracked in MEDIUM_RUNWAY tier F.

### Per-source raw caches are keyed by source-stable ID
- **What:** `data/_kijiji_raw.json` (kebab IDs from Kijiji's listing
  schema), `data/_leasebusters_raw.json` (TBD), etc. Never share a key
  namespace.
- **Enforced:** per-scraper output schema.
- **Breaks if violated:** merge step drops listings on key collision.

---

## Build + deploy

### Branch lock — `main`
- **What:** all autonomous work commits to this branch. Vercel deploys
  preview URLs from this branch. Production main is hands-off.
- **Enforced:** by convention + every commit message + RESTART_PROMPT
  hard rules.
- **Breaks if violated:** Ian's ability to roll back to a known-good
  state evaporates.

### `npm run predeploy` is the gate
- **What:** typecheck → thermal-audit → schema-audit → next build.
  Must exit 0 before any `git push`.
- **Enforced:** `package.json` `predeploy` script chain. CLAUDE.md hard
  rule.
- **Breaks if violated:** Vercel build fails on push and the live URL
  shows the prior commit indefinitely.

### Tauri build target is `BUILD_TARGET=tauri`
- **What:** flipping this env var produces a static export for the
  WKWebView shell instead of an SSR Vercel build. Same source tree;
  diverges only in `next.config.mjs` flags + build outputs.
- **Enforced:** `next.config.mjs` reads the env var; `npm run
  build:tauri:web` sets it.
- **Breaks if violated:** Tauri .app shows blank window or loads stale
  static export.

---

## Constraints (from CLAUDE.md NO list)

These are NOT invariants the code enforces — they're constraints on
the human/agent operating the codebase. Listed here for completeness.

- No code-signing, no notarization, no DMG distribution.
- No `--no-verify` git pushes; no force pushes; no `--amend` of pushed
  commits.
- No Apify spend > $30 cumulative.
- No edits outside `~/ev-auto-trader-canada`.

---

## How to add an invariant

1. Ship the code that creates the contract.
2. Add an entry to this file: what / where enforced / what breaks.
3. If automatic enforcement is possible, wire it into the predeploy
   chain (typecheck, vitest, schema-audit) — the typical home for new
   schema invariants is `scripts/validate_data_schemas.py`.
4. Reference the invariant in any future code review where adjacent
   work might violate it.
