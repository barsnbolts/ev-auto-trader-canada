# Session handoff — 2026-05-04 evening

> **For the next medium session: read this file top-to-bottom on boot,
> then jump to the "Boot script" section below and execute. ~5k tokens
> to get fully oriented; everything else (full runway, codebase
> contracts, scripts catalog) is in linked docs you can defer-read.**

## State at close

| | |
|---|---|
| HEAD | `08686b39` (pushed to origin) |
| Branch | `main` |
| Working tree | clean (after `__pycache__` gitignore added) |
| Vitest | 100/100 across 7 test files |
| Predeploy | clean (typecheck + thermal-audit + schema-audit + Next build) |
| MCP — Semble | NEW — installed at user-scope; available in this session |
| Cron | session-local CronCreate jobs cancelled; disk-persistent scheduled-tasks remain |

## What shipped in the previous (long) session

12 commits beyond the prior session-end (`72db5fbe`):

| Commit | What | Win |
|---|---|---|
| `4afde1c1` | Tier 0 Chrome MCP auto-pair + cron cleanup | docs |
| `b90db655` | TAURI_BUILD_LOG entry | log |
| `954ae295` | A1 — `format.test.ts` | +19 vitest specs |
| `cc984fae` | A2+A3+A4 — battery/aggregations/usedListingsLinks tests | +38 vitest specs |
| `64372b46` | A5+A6+A7 — crossListings extension + schema-audit enum + cross-ref | +5 specs, surfaces format asymmetry |
| `78170ac1` | A8 — scrape_unit_gallery refactor onto lib_scrape_common | -30 LoC dup, +telemetry |
| `e63f778b` | A9 — NHTSA cache (30-day TTL, data/_vin_cache.json) | 470ms→<1ms hit |
| `9260665d` | A10+A11+A12 — 3 component READMEs | docs |
| `4c4202ce` | A13+A14+A15 — INVARIANTS.md + scripts/README.md + CLAUDE.md update | docs |
| `83a4896e` | B1 — lazy HistoryCharts | **−104 kB First Load JS** on /history |
| `a6c173e8` | C7+C8 — Copy-as-JSON + VINless row tint | UX, both web + Tauri |
| `08686b39` | C9+C10 — aria-live RefreshModal + skip-to-content link | a11y |

**Tier progress:**
- **Tier A — 15/15 ✓** (all shipped this session)
- **Tier B — drained:** 1 active ship (B1) + 3 already-optimized (B2, B4, B7) + 1 architecturally closed (B3, Next 15 removed flag) + 2 deferred (B5 needs profiling, B6 file too small)
- **Tier C — 6/11 done · 5 remaining:** shipped C7+C8+C9+C10 (4); verified already-adequate C2+C11 (2); **remaining = C1, C3, C4, C5, C6**

**Bloat cleanup (this turn):** 20 stale handoff docs deleted (old session
plans, sandbox-era docs, superseded pre-Tier-A queues). External
references in ARCHITECTURE.md / TODO_INDEX / AUTONOMOUS_MODE / TOOL_DECISION_MATRIX
all rewritten to point at MEDIUM_RUNWAY.md or this handoff. `docs/handoff/`
went from 30 → 10 active files (228 KB).

## Try Semble FIRST (it's new this session)

Semble is a code-search MCP that replaces grep+read with semantic
retrieval. Installed at user-scope (`/Users/ianmcadam/.claude.json`),
verified end-to-end working on this codebase. Tools:
`mcp__semble__search` (NL query) and `mcp__semble__find_related`
(similarity from a known location).

**First-action smoke test on boot:**
```
Use mcp__semble__search:
  query: "TempSlider component preconditioning toggle"
  repo: "/Users/ianmcadam/ev-auto-trader-canada"
  top_k: 3
```
Expect: returns `src/components/TempSlider.tsx` snippet showing the
preconditioned toggle in <2s. If this works, Semble is verified
end-to-end; prefer it over grep for "where is X" lookups going
forward. If it errors / returns nothing, fall back to grep — install
worked at MCP-server level (verified) but tool registration may need
a session restart.

**Semble usage rules:**
- Use for code search ("where is X defined?", "show me everything that
  uses Y").
- Don't use for editing — Edit/Write tools only.
- Don't use for data lookup — `data/*.json` files are data, not code.
  Inventory + VIN storage stays in the existing pipeline (`units.json`,
  `cross-listings.json`, `_vin_cache.json`).
- After every Edit to a `.ts/.tsx/.py` file, Semble's index for that
  repo is stale until the next index rebuild. For long sessions,
  occasionally re-call `search` with the same `repo` to trigger reindex
  (~250ms).

## Boot script (RUN FIRST after reading)

```bash
cd ~/ev-auto-trader-canada
git fetch origin
git status --short                                                  # expect empty
git rev-parse HEAD                                                  # expect 08686b39 or newer
git rev-parse origin/main          # should match HEAD
npm run typecheck                                                   # expect exit=0
npx vitest run                                                      # expect 100/100 (or current count)
npm run predeploy                                                   # expect exit=0
```

Then:
1. Run the **Semble smoke test** above.
2. Run **Tier 0.1** from `docs/handoff/MEDIUM_RUNWAY.md` (Chrome MCP
   auto-pair attempt — `list_connected_browsers` then `switch_browser`
   if empty, 2-min timeout, then proceed regardless).
3. Resume **Tier C** drain. **Remaining Tier C items: C1, C3, C4, C5,
   C6.** All low-risk UX polish. Specs in `MEDIUM_RUNWAY.md`.

## Next concrete tasks (in priority order)

| ID | What | Tokens | Files |
|---|---|---|---|
| C5 | Print stylesheet for `/dealer/[id]` (hide map widget, single-column units, inline contact) | ~3k | `src/app/globals.css` |
| C6 | Print preview for `/compare` (4-col → 2-col wrap on letter portrait) | ~3k | `src/app/globals.css` |
| C4 | Better loading skeleton for inventory table (column-structure-aware) | ~3k | `src/app/inventory/loading.tsx` |
| C1 | Stale-listing chip: bump threshold from 7d (current) to 14d + escalate styling | ~3k | `src/components/InventoryTable.tsx:613-761` |
| C3 | UpdatedStamp on dossier header (currently inventory + history only) | ~3k | `src/app/inventory/[id]/dossier/DossierClient.tsx` |

After Tier C: drain Tier D (test depth, ~35k), Tier E (data hygiene,
~25k), Tier F (code quality, ~25k — first natural Semble spot:
F1 centralize date slicing requires "find every dateString.slice(0,10)
across the codebase" which is exactly Semble's strength), Tier G (docs,
~25k).

## Hard rules (NEVER violate)

- Branch stays on `main`. No push to `main`.
- No `--no-verify`, no force push, no `--amend`.
- No code-signing / notarization / DMG (CLAUDE.md NO list).
- No Apify spend > $30 cumulative.
- `npm run predeploy` MUST pass before every `git push`.
- All edits inside `~/ev-auto-trader-canada` only.

## Stop conditions (halt + ping user)

- User types in chat (HIGHEST priority).
- Tauri build fails twice on same root cause.
- `npm run predeploy` fails twice on same root cause.
- About to violate a hard rule above.

## Cross-references

- `docs/handoff/MEDIUM_RUNWAY.md` — full 61-task queue with specs + Done log
- `docs/handoff/CLOUD_REMOTE_BOOT.md` — **READ IF SESSION IS REMOTE / NOT ON IAN'S MAC.** Covers cloud clone, Mac-only-vs-portable matrix, Semble per-agent install, backup discipline, disaster recovery.
- `docs/INVARIANTS.md` — 11 codebase contracts (read before changing data shapes)
- `scripts/README.md` — data-pipeline script catalog
- `CLAUDE.md` — operating rules (this file is the user-side ops contract)
- `docs/handoff/SESSION_2026-05-04_MEDIUM.md` — prior medium-pass close-out (still relevant context)
- `docs/handoff/TAURI_BUILD_LOG.md` — append-only commit narrative
- `.claude/RESTART_PROMPT.md` — paste-prompt fallback if disk-persistent crons fail

## Local vs cloud / remote

If this session runs on Ian's Mac at `~/ev-auto-trader-canada`:
follow the boot script as written; everything works.

If this session is on a remote sandbox / cloud Claude / different
machine: **read `docs/handoff/CLOUD_REMOTE_BOOT.md` FIRST.** Then
treat any path of the form `~/ev-auto-trader-canada` or
`/Users/ianmcadam/...` as "the repo root, wherever it's cloned." The
boot script's `cd ~/ev-auto-trader-canada` becomes
`cd $(git rev-parse --show-toplevel || echo .)`. The Semble `repo:`
parameter accepts the GitHub URL as a fallback if no local clone path
is available.

## What user said when this handoff was written

User asked whether to close + reopen the session. Answer was yes, for
three reasons: Semble availability gating on a fresh session, token
cache TTL past 5 min on long sessions, and clean stopping point with
nothing to lose. User also asked whether Semble could store inventory
+ VIN data — answer: no, Semble is code-search only; existing
`units.json` + `cross-listings.json` + `_vin_cache.json` already cover
data layer. User authorized full-extreme automation; continue
draining the runway autonomously, ping only on stop conditions.
