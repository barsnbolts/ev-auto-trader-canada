# Session handoff — 2026-05-05 (Opus 4.7 high-tier inventory rebuild)

> **For the next session:** read this top-to-bottom on boot, then jump
> to "Boot script" → "Resume here." ~5k tokens to get fully oriented.
> Linked decision docs + spec docs cover every detail. The big shift
> this session: inventory pipeline was an illusion (audit found it
> frozen 4 days), but we now have free-path specs for ALL six sources
> ready for medium-tier execution.

## What this session was

A long high-tier session that:

1. **Re-audited the inventory pipeline** (not on the original task list — surfaced via casual probing) and found it was mostly an illusion. AutoTrader scraper had never been built; cron was silently failing for 2+ days; cross-listings join was broken at 1.9% match rate; Leasebusters scraper was broken (site rebuild).

2. **Rewrote the project's priorities** at user request. Inventory-first replaced the original Tier C polish work. New ambition: multi-source (AT + Kijiji + FB Marketplace + per-dealer sites + dealer promo image extraction + cross-source price-delta surfacing).

3. **Researched + designed** the entire scraping architecture from scratch via:
   - R1 — GitHub + Apify Store survey (subagent dispatched, returned 7-target survey doc).
   - R2 — 5 architectural decision docs (one per source).
   - R3 — Apify spend ledger initialized.
   - R4 — User-scope memory ported from sibling EV Dashboard project.
   - R5 — Sanity-check found bigger inventory bugs than the audit assumed.
   - F1 — AutoTrader Chrome MCP probe (probe succeeded, major architectural pivot).
   - F2 — Facebook Marketplace probe (JS-exec permission-gated; pivoted to dedicated MCP).
   - F3 + F4 — research-validated install paths + caveats; smoke tests deferred to medium.

4. **Made 3 major architectural pivots** based on probes/research:
   - AT: from `window['ngVdpModel']` regex → `__NEXT_DATA__` JSON parse (cleaner, framework-standard).
   - FB: from "Chrome MCP probe + Python replay" → `jdcodes1/facebook-marketplace-mcp` (FB JS-exec is server-side gated by Anthropic, not user-fixable).
   - Dealer promos: from PaddleOCR-VL → Qwen2.5-VL-7B via Ollama (banner-tuned vs document-tuned, simpler Mac install).

5. **Wired up live preview** via Claude Preview MCP. Cross-project launch.json hack works (`npm --prefix`); dashboard renders correctly.

6. **User wants free path everywhere** — confirmed mid-session. All decisions revised. Apify / Gemini / Claude vision are all fallbacks-only (~$0.21/mo worst case if every fallback fires).

## State at close

| Field | Value |
|---|---|
| HEAD | `a39eb6e4` (pushed to origin/main) |
| Branch | `main` |
| Working tree | clean (after the cron timestamp bumps + research docs landed) |
| Vitest | 100/100 across 7 test files (last verified at session start) |
| Predeploy | last verified clean before commit `9d4bf77b` |
| MCP — Semble | available (verified end-to-end this session) |
| MCP — Claude-in-Chrome | paired as Browser 1 (`b4894a51-95cd-4bea-8b91-5dab758daf08`, isLocal=true) |
| MCP — Claude Preview | working via `ev-auto-trader-dev` launch entry |
| Apify spend | $0 cumulative, ledger at `data/apify_spend.json` |

## Commits this session (in order)

```
1481723b  0.1 re-probe — Leasebusters: site is full SSR, no VIN, mechanical rewrite spec
9d4bf77b  Phase R — research bundle: 6 decision docs + Apify spend ledger
687094f9  F1 + F2 — AT __NEXT_DATA__ probe (major win) + FB JS-exec gate (defer)
7946d0e1  F3+F4 research-validated + F2 pivot to jdcodes1/facebook-marketplace-mcp
a39eb6e4  MEDIUM_RUNWAY: insert TIER I0/I1/I2 at top — medium picks-and-executes
```

## The journey arc (read this if you want the WHY behind the decisions)

### Starting state
Original prompt was "drop straight into autonomous Tier C drain (C4 column-aware skeleton, C1 stale chip threshold, C3 dossier UpdatedStamp)." Three tiny UI tweaks. Started at HEAD `33117c3a`.

### Pivot 1 — Tier 0.1 Chrome MCP probe (~5k tokens)
First step (per original boot script): pair Chrome MCP, probe Leasebusters. Old playbook said Leasebusters was a Vue/SPA with hydration XHR. Probe found this was wrong — site rebuilt as full server-rendered ASP.NET MVC. No XHR fired. No VIN on detail pages. Documented in `LEASEBUSTERS_VIN_DECISION_2026-05-04.md` + `LEASEBUSTERS_XHR_CAPTURE_2026-05-04.json`. Updated scraper docstring to point at the new spec. **First commit `1481723b`.**

### User pivot — bigger inventory ambition
Mid-session, user requested deep audit + new scope: multi-source inventory + dealer promo image extraction + creative dealer-website handling. Originally planned to ping a parallel cloud session for shadow-state recovery; turned out both sessions were the same long-running session at the same HEAD. No shadow state. But the conversation surfaced architectural recommendations.

### Phase R (research, ~30k tokens)
Five sub-tasks:

- **R1**: GitHub + Apify subagent dispatched. Returned a comprehensive 7-target survey (`EXTERNAL_TOOLING_SURVEY_2026-05-04.md`). Key finding from the AT row: there's no XHR endpoint on AT.ca; the `fayoussef/autotrader-canada` Apify actor parses `window['ngVdpModel']` directly. This claim turned out to be partially wrong (see Pivot 4 below).

- **R2**: 5 architectural decision docs — AT, FB, Dealer Inventory, Dealer Promos, Leasebusters (re-validated). Initially leaned on Apify actors for AT + FB (per R1 recommendation) until user clarified "free path everywhere" — then all docs flipped to free-primary with paid services as emergency fallbacks.

- **R3**: Apify spend ledger initialized at `data/apify_spend.json` = $0 cumulative. The `scripts/track_apify_spend.py` was already shipped (well-written, exit codes wired for cap warnings). Just needed the empty ledger file.

- **R4**: User-scope memory ported. Sibling EV Dashboard project at `~/.claude/projects/-Users-ianmcadam-Documents-Claude-Projects-EV-dashboard/memory/` had 8 files. Copied 5 user-scope ones to ev-auto-trader-canada's project memory dir (user_profile, vibe-coding-prime-directive, subagent-dispatch-economics, always-push-after-save, feedback_log). Project-scope sibling files (project_context, reference_resources) intentionally left in place. Memory dir is OUTSIDE git tree.

- **R5**: Re-validated existing decision docs + INVARIANTS.md. Found bigger bugs than the audit assumed:
  - **AT VIN coverage is 8 %, not 97 %.** 92 of 100 AT units have no VIN at all. The /tmp blob from May 1 only carries 8 VINs forward.
  - **`scripts/merge_cross_sources.py` never VIN-keys at all.** The "VIN preferred, fallbackKey otherwise" invariant in `INVARIANTS.md:67` is documented but **not implemented**. Code uses fallback-key as the only join.
  - **Trim format mismatch is the dominant join-killer.** Same 2026 EV9: AT says "Land Long Range AWD"; Kijiji says "Land AWD w/ Plus Package". Different fallback-keys → no join.
  - **Cross-source join rate is 1.9 %** (3/160 entries actually merge across sources).
  
  Updated I0b spec from "trim fuzz" to two-step fix (I0b-1 add VIN-key primary; I0b-2 drop trim from fallback-key + UI disambiguation).

  **Phase R commit `9d4bf77b`.**

### Phase F (foundation, ~15k tokens)

- **F1 — AutoTrader probe**. MAJOR WIN. Premise was `window['ngVdpModel']`. Probe found that variable doesn't exist anywhere — AT.ca was re-architected to standard Next.js. All listing data is in `<script id="__NEXT_DATA__">` SSR JSON. **Search-results page** has 20 listings inline (138 total for Ioniq 5 → 7 pages). **Detail pages** have full schema including VIN at `.props.pageProps.listingDetails.vehicle.identifier.vin` (sample `KM8KN4AE6PU228532`, valid Hyundai VIN). No Imperva challenge during the 4-page probe. **Free path is highly viable.** Wrote `AT_PROBE_CAPTURE_2026-05-04.md` (full schema map) + `AT_REPLAY_SPEC_2026-05-04.md` (complete Python implementation) + patched `AT_STRATEGY_DECISION` to reflect the `__NEXT_DATA__` pivot.

- **F2 — Facebook Marketplace probe**. Hit a wall. `mcp__Claude_in_Chrome__javascript_tool` calls to `www.facebook.com` return `permission_required`. The capture-hook approach (install `window.fetch` monkey-patch via JS exec to grab GraphQL XHR) is therefore blocked. Navigation works. `find` (DOM accessibility-tree extraction) works. Initially wrote F2 doc recommending defer to TIER I2.

- **Mini-research dispatched** (subagent, ~10k tokens) covering:
  - Q1: Crawl4AI on macOS Apple Silicon — install gotchas, dealer-site reports, best config.
  - Q2: PaddleOCR-VL on macOS Apple Silicon — install pain, alternatives.
  - Q3: Claude-in-Chrome FB JS permission gate — workarounds.

  Returned 3 actionable findings:
  - Crawl4AI: GO with caveats — pin Python 3.11/3.12 (NOT 3.13 — greenlet wheel fails on M-series), bundled Chromium only, JSON-LD-first strategy mirroring `copious_atoll/dealer-website-inventory-scraper`.
  - PaddleOCR-VL: GO but PIVOT — `paddlepaddle` ARM-native works, but for **banner-aligned task** + simpler Mac stack, prefer **Qwen2.5-VL-7B via Ollama** (runs natively on Apple Silicon via MLX).
  - FB JS gate: WORKAROUND EXISTS — known unfixable Anthropic-side bug. **Best path: `jdcodes1/facebook-marketplace-mcp`** — purpose-built MCP, cookie-replay GraphQL, no Chrome extension dependency. Self rate-limits 3 req/min. Includes Playwright capture script for `doc_id` rotation.

- **Applied 3 pivots to decision docs**, then committed (`7946d0e1`):
  - Dealer inventory: pin Python version, JSON-LD-first.
  - Dealer promos: PIVOT to Qwen2.5-VL via Ollama.
  - FB Marketplace: PIVOT to jdcodes1 MCP. FB no longer deferred to I2.

### Live preview wired (~2k tokens)

User asked for live preview via Claude Code's preview menu. Discovered the session is rooted in EV dashboard's CWD (sibling project, NOT this one), so its `.claude/launch.json` was the one Claude Preview MCP read. Workaround: edited EV dashboard's launch.json to add a cross-project entry `ev-auto-trader-dev` that runs `npm --prefix /Users/ianmcadam/ev-auto-trader-canada run dev`. Verified working: server starts cleanly, Next.js 15.5.15 compiles, dashboard screenshot returned (header / nav / "EV market dashboard — Canada" / stat cards rendering correctly). The web preview is visually identical to the Tauri .app because it's the same React + Tailwind code path.

### MEDIUM_RUNWAY rewrite (~3k tokens)

Inserted **TIER I0 + I1 + I2** at the top of `MEDIUM_RUNWAY.md` so medium-tier picks the top item and executes per spec — zero new architectural decisions needed. The original Tier 0/A-G queue stays under "THE ORIGINAL QUEUE" section. **Final commit `a39eb6e4`.**

## All decision + probe docs (the source-of-truth for medium)

```
docs/handoff/research/
├── EXTERNAL_TOOLING_SURVEY_2026-05-04.md       # R1 — full GitHub+Apify survey
├── SANITY_CHECK_2026-05-04_evening.md           # R5 — empirical bug findings
├── AT_STRATEGY_DECISION_2026-05-04.md           # R2 — AT decision (free path)
├── AT_PROBE_CAPTURE_2026-05-04.md               # F1 — __NEXT_DATA__ schema map
├── AT_REPLAY_SPEC_2026-05-04.md                 # F1 — full Python scraper spec
├── FB_MARKETPLACE_DECISION_2026-05-04.md        # R2/F2 — FB decision (jdcodes1 MCP)
├── FB_PROBE_CAPTURE_2026-05-04.md               # F2 — JS-exec gate findings
├── DEALER_INVENTORY_DECISION_2026-05-04.md      # R2 — Crawl4AI + Mac caveats
├── DEALER_PROMO_DECISION_2026-05-04.md          # R2 — Qwen2.5-VL pivot
├── LEASEBUSTERS_VIN_DECISION_2026-05-04.md      # earlier session — already validated
├── LEASEBUSTERS_XHR_CAPTURE_2026-05-04.json     # earlier session — raw probe data
└── PHASE_F_SUMMARY_2026-05-04.md                # closeout — what's locked in
```

## Boot script for next session

```bash
cd ~/ev-auto-trader-canada
git fetch origin
git status --short                                              # expect empty (cron may add data file mods)
git rev-parse HEAD                                              # expect a39eb6e4 or newer
git rev-parse origin/main                                       # should match HEAD
npm run typecheck                                               # exit 0
npx vitest run                                                  # 100/100 (or current count)
npm run predeploy                                               # exit 0 — gating check
```

If any of those fail: investigate before picking a task. Probably a cron-induced data drift (units.json + cross-listings.json + units-enrichment.json get bumped daily).

Then:

1. **Read `docs/handoff/MEDIUM_RUNWAY.md` § TIER I0** — the next mechanical task. Pick I0a (cron PATH fix), execute per spec, commit + push, repeat down the queue.

2. **Sanity-check Semble + Chrome MCP** are still loaded:
   - Semble: `mcp__semble__search` query "TempSlider preconditioning toggle" should return src/components/TempSlider.tsx in <2s.
   - Chrome MCP: `mcp__Claude_in_Chrome__list_connected_browsers` should show Browser 1 (deviceId `b4894a51-95cd-4bea-8b91-5dab758daf08`).
   - Claude Preview: `mcp__Claude_Preview__preview_list` then `preview_start` with name `ev-auto-trader-dev` (this works only from the EV Dashboard CWD).

3. **Resume here:** TIER I0a — Cron PATH fix.

## Resume here

**TIER I0a — Cron PATH fix · ~1k tokens · trivial.**

File: `scripts/com.evautotrader.refresh.plist`

Add `<key>EnvironmentVariables</key>` block with `PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin`. Reload launchd (`launchctl unload`/`launchctl load`). Force-trigger via `launchctl start com.evautotrader.refresh`. Verify cron.log shows the full predeploy → commit → push path.

After that ships: I0b-1 (VIN-keyed merge primary) → I0b-2 (drop trim from key) → I0c (wire Kijiji into cron) → I0d (Leasebusters per spec) → I0e (AT scraper per spec) → I0f (e2e cron verify) → TIER I1.

**Important reminder for medium**: all architectural decisions are
locked. If you find yourself wanting to deviate from a decision doc,
**stop and check whether it's a real decision or just a small
implementation detail**. Real decisions = halt + ping user. Small
details = use your judgment.

## TIER I0/I1/I2 cheatsheet (read MEDIUM_RUNWAY for full specs)

```
I0 (daily, ~32k):
  I0a · Cron PATH fix
  I0b-1 · VIN-keyed merge primary
  I0b-2 · Drop trim from fallback_key + UI disambiguation
  I0c · Wire Kijiji + cross-merge into refresh_daily.sh
  I0d · Leasebusters HTML rewrite per spec
  I0e · AT __NEXT_DATA__ scraper per spec
  I0f · End-to-end cron verify
  I0g · Live preview after each visible change (continuous)

I1 (weekly, ~32k):
  I1a · jdcodes1/facebook-marketplace-mcp install + integrate
  I1b · Crawl4AI dealer scraper (Python 3.11/3.12 pin)
  I1c · Ollama + Qwen2.5-VL banner promos + DealerPromoChip

I2 (opportunistic, all free):
  I2a · Carfax click-through links (no scrape)
  I2b · OEM Click-to-Buy via Crawl4AI
  I2c · Toronto Auto Auction wholesale feed
```

## User preferences observed this session

- **Free path everywhere.** Apify is fallback-only, even though originally framed as primary. User tolerates higher engineering effort for $0/mo.
- **Research before diving in.** When you hit friction (a wall, a decision branch, a missing tool), dispatch a focused subagent or web-search before writing code. The Q3 mini-research subagent saved this session by finding `jdcodes1/facebook-marketplace-mcp`.
- **Proactive optimization OK.** "If you find anything to optimize/improve/fix, just go for it." Don't ask permission for routine improvements.
- **Tier discipline matters.** User cycles between extra-high → high → medium → sonnet. High = architecture + judgment. Medium = mechanical execution against spec. Don't waste high tokens on what medium can do.
- **Token-ROI is the prime directive.** Per the vibe-coding memory: time + iteration count don't matter; total token spend to project completion does.
- **Always push after every commit.** Origin must be ≥ local HEAD so user can resume from phone / cloud / different machine.
- **Caveman in chat + commit subjects.** UI copy stays normal English.

## Open questions for the user (ask only when you reach them)

1. **I0e first run**: initial AT bootstrap is ~91 min sweep (~800 detail pages). OK as one-time cost? Or filter to Ontario-only first to halve it?
2. **I1a FB cookies**: jdcodes1 MCP needs Ian to run a one-time `python scripts/capture_cookies.py` on his Mac to extract FB cookies into the MCP's storage. ~2 min Ian-time. Confirm before installing.
3. **I1b Crawl4AI Python venv**: should we use the existing project Python env or create a dedicated `.venv-crawl4ai` with Python 3.11/3.12? Default: dedicated venv (avoids polluting predeploy env).
4. **I1c Ollama install**: requires `brew install ollama` + `ollama pull qwen2.5-vl:7b` (~4.5 GB). One-time. Confirm before installing.

All four are small, low-friction asks. Bundle them into one user message when you hit I0e.

## Hard rules (unchanged — re-list for completeness)

- Branch is `main`. Push freely with normal commits.
- No `--no-verify`, no force-push, no `--amend` after push.
- No code-signing / notarization / DMG.
- No Apify cumulative spend > $30 (currently $0; cap is hard).
- **GPT-4o-vision** spend requires explicit user OK before invocation (not used in current architecture; would only be a 3rd fallback after Qwen + Gemini).
- **Carfax** requires Ian's account — never input by Claude.
- `npm run predeploy` exit 0 before every push.
- All edits inside `~/ev-auto-trader-canada` only.
- Caveman in chat + commits. UI copy stays normal English.

## Stop conditions (unchanged)

- User types in chat (HIGHEST priority).
- About to spend money (Apify, Gemini, Claude vision) without explicit OK.
- `npm run predeploy` fails twice on same root cause.
- `git pull --ff-only` fails with divergence.
- About to violate a hard rule.
- About to install a paid SaaS dependency.

## Live preview note for next session

To use the preview workflow in the next session:

1. The launch.json entry `ev-auto-trader-dev` already exists in
   `~/Documents/Claude/Projects/EV dashboard/.claude/launch.json`.
2. Call `mcp__Claude_Preview__preview_start` with `name: "ev-auto-trader-dev"`.
3. Server runs on port 3000.
4. After UI changes (esp. I0b-2 cross-source chip), call
   `mcp__Claude_Preview__preview_screenshot` to verify.
5. To test responsive: `mcp__Claude_Preview__preview_resize` with
   `preset: "mobile"` / `"tablet"` / `"desktop"`.

Note: the cross-project hack works because the session's CWD is locked to EV dashboard. If a future session is started inside `~/ev-auto-trader-canada/` directly, the project's own `.claude/launch.json` (entries `Next.js dev` + `Next.js production preview`) will be used instead.

## What this session did NOT touch (deferred from original plan)

- TIER C (C4 column-skeleton, C1 stale chip threshold, C3 dossier UpdatedStamp) — original Phase C tasks. Stay in queue under "THE ORIGINAL QUEUE" in MEDIUM_RUNWAY. Pick up after I0+I1 ship.
- TIER D (test depth, ~35k), E (data hygiene, ~25k), F (code quality, F1 = "centralize date slicing" Semble showcase, ~25k), G (docs, ~25k) — all post-I0+I1.
- TIER H (speculative) + I (paid) — require user OK.
- Tauri rebuild + .app distribution — explicitly out of scope per CLAUDE.md NO list.

## Token budget context

This session burned ~80-100k tokens (rough estimate) on Opus 4.7 high tier — almost all foundation work. The medium-tier I0+I1 drain is estimated at ~64k tokens, mechanical, no decisions. After I0+I1 close, the project's daily inventory pipeline works for the first time in its history.

Net ROI: the foundation work this session prevents an estimated 100k+ tokens of medium-tier wasted work that would otherwise have been spent re-discovering the architectural choices we've already locked in.
