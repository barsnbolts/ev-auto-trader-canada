# Game Plan v4 addendum — token-ROI discipline + fresh ideas

*Shipped 2026-04-23. Replaces nothing; extends v1 / v2 / v3. If a v3 rule contradicts a v4 rule, v4 wins.*

This addendum does two things:

1. Installs **Token-ROI discipline** as a first-class, always-on system — not a one-off audit script. Every ritual, every milestone, every kickoff now shows ROI. The gate actually blocks.
2. Dumps a batch of fresh ideas — big and small, for Ian's day-to-day and for Claude's behavior — that v1–v3 didn't touch. Some are ready-to-ship; others are staged as tickets.

---

## §1. Why this layer was missing

cost_tracker.py (v3) recorded **what** was spent. That's half the loop. It never **checked** whether a given spend was a good idea, and it never **gated** future work based on past waste. Knowing the median is useless if nothing enforces it.

v4 closes the loop:

```
   pre-flight  →  dispatch  →  actual log  →  dashboard  →  gate  →  next pre-flight
      ↑___________________________________________________________|
                  every milestone, every day, every operation
```

Each hand-off is cheap. None of it requires thinking. That's the point — discipline that's always on can't be skipped in the heat of work.

---

## §2. What shipped in v4

### 2.1 `scripts/token_roi.py` — the discipline core

Four subcommands:

| Command | Role |
|---|---|
| `preflight <op_kind> [payload_bytes]` | Estimate tokens before spending. Flags EXPENSIVE vs OK against a budget-per-kind table. |
| `log <kind> <est> <actual> <value 1-5> "<note>"` | Append to `logs/operation_ledger.jsonl`. Any op worth measuring. |
| `dashboard` | Today's spend vs budget, 7-day trend, median ROI by op_kind, bloat score, top low-ROI offenders. |
| `gate <milestone_id>` | Called from `milestone.py` step 8. Exits 1 if spend > 2× peer median unless `TOKEN_ROI_OVERRIDE=1`. |
| `budget <tokens>` | Sets daily cap. Default 500k. |
| `spend` | Quick one-line "today: N / cap (P%)" — embedded in `kickoff.py`. |

Budget-per-kind table (`PREFLIGHT` dict) is tuned from empirical data: `subagent_data` ≤120k, `subagent_verify` ≤25k, `direct_code` ≤3k, etc. Edit in the script as calibration improves.

### 2.2 Integration points — nothing added to Ian's cognitive load

- `milestone.py` — grew 7 → 10 steps. New: cost log (7), ROI gate (8). The gate is the teeth; fails the close if you're 2× over.
- `batch_ritual.py` — step 8 now chains the full ROI dashboard. A batch close shows where every subagent token went.
- `kickoff.py` — shows "Token ROI pulse" with today's spend line.
- `snapshot.py` — auto-rotates: keeps 5 loose, bundles older into `snapshots/archive/*.tar.gz`. Every milestone runs it, so disk (and read-in-tokens if Claude ever scans the dir) stays bounded.
- `CLAUDE.md` — new "Token-ROI discipline — always on" section with 7 hard rules. Always-loaded, so every session inherits it.

### 2.3 Prune-Snapshots.command — Mac-side finishing move

Claude's sandbox can't delete files it didn't create (same class of issue that prevents git commits). Rotation **archives** but doesn't always **remove**. This double-click command reads the latest tarball, deletes any loose snapshot file that's already inside, and reports the current footprint. Ian runs it once every few batches.

---

## §3. Fresh ideas — tier 1 (ready to ship in next few milestones)

Each of these is small enough to slot into a single milestone without a subagent.

### 3.1 Compression heuristics baked into LEARNINGS.md

Rule: entries older than 30 days get auto-summarized into a `LEARNINGS_ARCHIVE.md` file in 1–2 lines each. The full prose moves. Keeps the live file scannable. A `scripts/compress_learnings.py` is the obvious implementation.

### 3.2 Operation cost footer on every script

Every ritual script ends with `echo "this run spent ~N tokens / Ms wall-time"`. Turns vague "that took a while" into numbers. `milestone.py` already prints a lot; extending with an actual tally is free.

### 3.3 One-page pulse artifact

A persistent Cowork artifact called "EV Dashboard pulse" that shows: last 3 milestones closed, today's spend, top 3 queue items, bloat score, thermal validator status. Single HTML page, pulls from `logs/milestone_costs.jsonl` + `operation_ledger.jsonl`. Re-openable, zero Claude cost. High daily ROI for Ian.

### 3.4 Lazy-read discipline, documented explicitly

CLAUDE.md already says "skim LEARNINGS top 3." Extend: **never read a file in full unless a Grep/Glob preview says you need to.** Add to response-style rules.

### 3.5 Caveman auto-expand on error

If a subagent returns an obviously confused or empty output, re-dispatch *once* in natural English (no caveman). Pay the ~20% token tax only on the retry — not blanket. Save the pattern to `prompt_templates/README.md`.

### 3.6 Duplicate-queue guard in validate_system.py

The validator flagged duplicate queue IDs several times this session. Add an explicit rule: any ID that appears both in a ✅ row and a pending row is a duplicate. Auto-suggest the `grep -n` commands to clean it up.

### 3.7 `npm run dev` health check in kickoff.py

kickoff.py currently shows validators, queue, learnings. Add: ping localhost:1420 — if up, show "dev server: UP"; if not, "run `./Start-EV-Dashboard.command`". One HTTP call, saves a full round trip of "wait, is it running?"

### 3.8 Subagent prompt "cost budget" directive

Every prompt template gets a new line: `Budget: ≤ 80k output tokens. If exceeding, stop and summarize.` Templated pressure beats retrospective pressure.

### 3.9 Batch-plan progress bar in SESSION_SUMMARY

Single line like `Progress: ▇▇▇▇▇▇▇▇▇▇ 6/6 batches · 22/22 milestones · 37/60 vehicles`. Visual, compresses a full status in one line.

### 3.10 Default mom-mode on first launch for non-Ian

Zustand store gets `firstLaunch` flag. If true, mom-mode = on. Once Ian toggles it off (presumably he prefers technical view), flag flips. His mom never sees acronyms.

---

## §4. Fresh ideas — tier 2 (bigger; one milestone each)

### 4.1 Shopping JOURNAL.md — Claude becomes memory for the decision

A dated, append-only file logging: test drives, dealer quotes, financing rates seen, reasons vehicles got crossed off the list. Ian dictates (voice-to-text friendly), Claude structures. By month 3 of the 3-month timeline, Ian has a complete record of *why* he's buying what he's buying. Plus Claude on any future session can ground recommendations in real history, not speculation.

Schema (YAML-ish):
```
2026-04-25  test_drive  Ioniq 5 LR AWD  dealer:Blue Mountain Hyundai
  price_asked: $62,500 · trade_in_offer: $18,000 · financing: 7.4% 72mo
  notes: ride harsh on rough pavement. SCC adaptive cruise glitched once.
  verdict: keep on list, not top choice
```

### 4.2 Quote CSV tracker (`quotes.csv`)

Spreadsheet: vehicle_id, VIN, dealer, date, listed_price, negotiated_price, trade_in, rate_apr, term_months, notes. Wired into CompareView — tap a vehicle → "see quotes I've gotten". Side-by-side negotiations become honest; dealers can't play memory games against Ian.

### 4.3 Weekly market digest

Scheduled task (once a week) runs Exa: "new EV incentives Canada this week," "price cuts in [shortlist brands]," "recalls affecting [shortlist]". Appends a block to JOURNAL.md + pings Ian with a 200-token summary. 3-month timeline, 12 weeks = 12 cheap intelligence refreshes for ~300k total tokens across the whole shopping window.

### 4.4 Test-drive checklist generator (per vehicle)

For each vehicle on shortlist: generate a PDF checklist before the dealer visit — seat ergonomics at his height, visibility (mom rides in it), infotainment tests (Apple CarPlay present?), cold-weather quirks (pre-check heat pump setup), known issues from Exa scrape. Saves $50–$200 in mistakes-per-dealer-visit. Free to generate.

### 4.5 Insurance quote batcher

Pre-filled search links for 5 Ontario insurers (Belair, Intact, Desjardins, CAA, TD) with postal code, driver profile, and 3 shortlist vehicles. Opens 5 tabs. Ian runs them in parallel, captures rates in the CSV. Turns a 3-hour job into 25 minutes.

### 4.6 Home-charging setup advisor

Separate tab/card in the app. Inputs: panel amps available, distance from panel to parking, Ontario time-of-use schedule. Outputs: recommended amp circuit, charger spec (hardwired vs plug), estimated install cost range, ROI vs L1 charging. Many first-time buyers over-spec L2 chargers. This saves $500–$2000.

### 4.7 Depreciation curves by model/year

Used-market tab extension: plot expected 3-yr / 5-yr resale value per vehicle, annotated with brand retention reputations (Toyota bZ4X vs Nissan Ariya vs Tesla Model Y). Lets Ian see not just purchase price but ownership cost. Data source: AutoTrader historical medians, sourced via Exa.

### 4.8 Memoization cache for subagent dispatches

Hash the prompt + template version. If the same prompt was dispatched within 7 days, serve from cache (`logs/subagent_cache/`). Second-identical-query pays 0 tokens. Zero-downside feature once implemented.

---

## §5. Fresh ideas — tier 3 (stretch; nice if we get there)

### 5.1 Local SQLite for quotes + journal

Once JOURNAL and quotes.csv get big, move them into a `research.db` SQLite. Enables actual queries like "show me every dealer that came under MSRP for Hyundai." Existing seed.json stays as the canonical vehicle spec source.

### 5.2 Tauri sidebar panel — "ask while browsing"

In-app sidebar that takes free-form questions about the currently-compared vehicles. Routes to Exa if factual, to thermal.ts if physics-y. Keeps the conversation and the data right next to each other.

### 5.3 Confidence decay

`CitedValue`'s `accessed` date starts decaying confidence after 6 months. A High-confidence value from January becomes Medium by July automatically. Prevents silent staleness in a fast-moving market.

### 5.4 Alternative-fuels aside

Small section: hybrids, PHEVs and hydrogen options that overlap Ian's shortlist. Not main focus, but a single tab saves "wait what about Prius Prime?" rabbit holes.

### 5.5 Dealer-radius geocoded map

Ontario map with pins for every dealer carrying shortlist vehicles. Filter by: in-stock vs factory-order, distance from Ian's address. Integrates with Google Places via Exa (no Google Maps key needed).

### 5.6 VIN-level inventory crawl

Larger piece. Playwright-scrapes AutoTrader + dealer sites for VIN-level inventory of shortlist models. One daily dispatch. Ian sees actual-car-on-actual-lot, not "model exists."

### 5.7 Import-from-USA arbitrage calculator

For unicorns: calculate total landed cost of importing a used Tesla Model Y LR from upstate NY including tariff, duty, 905 PST, safety recertification. Often $5–10k cheaper. Only surfaces if savings > $3k.

---

## §6. Fresh ideas for Claude's behavior specifically

### 6.1 Always preflight before bulk reads

New rule: if I'm about to Read a file I haven't seen yet, Grep first with `head_limit: 50` to verify the target region. Saves entire file-worth of tokens when only 20 lines matter. Added to response-style section.

### 6.2 Per-response token ceiling

Self-imposed rule: no single chat response exceeds ~8k output tokens unless the user asked for a long document. Forces compression. Tie to caveman-directive.

### 6.3 Dedupe response openers

Stop starting answers with "Let me..." or "I'll...". Lead with the action or the answer. Saves 2-5 tokens per response × hundreds of responses.

### 6.4 Kill the "summarize what I just did" outros

Already in feedback_communication.md from a prior session. Reinforce: the diff is the summary. Only narrate when something is non-obvious.

### 6.5 Use TaskList's blockedBy to express real dependencies

Rather than list-of-tasks and hope, set up explicit `blockedBy` between tasks. Tool enforces order and surfaces when parallel work is possible. Bigger ROI when multiple subagents are in flight.

### 6.6 ToolSearch once per session, bulk-load

Already specified in system prompt. Reinforce: one `ToolSearch {query: "computer-use", max_results: 30}` at session start beats 20 individual loads.

### 6.7 Caveman strictness dial

New env var: `CAVEMAN=strict|normal|off`. strict = absolute minimum tokens, normal = current 6-rule compression, off = natural English for user-facing content. Defaults to normal; Ian flips to strict when autonomy time is limited.

---

## §7. Ideas for Ian personally (beyond the app)

### 7.1 Dealer-negotiation scripts Claude generates per vehicle

Pre-drafted openers: "I've been watching the Ioniq 5 LR AWD for 2 months. I have quotes at $X and $Y from Dealer A and B. What's your best price today?" Claude fills the blanks from the quote tracker.

### 7.2 Test-drive log audio transcription

Ian already uses voice-to-text heavily. Extend: record dealer conversations (with consent, Ontario is one-party), transcribe, extract promises made, flag discrepancies vs written contract.

### 7.3 Financing pre-approval letter draft

Claude drafts a TD/RBC/Desjardins EV-loan pre-approval request. Ian copies into the bank's chat. Pre-approval in hand = 0.5–1.5% lower dealer financing rate usually.

### 7.4 Recall + TSB watcher

Scheduled Exa task: "[shortlist models] recall 2026" — if hit, ping Ian. Prevents buying a vehicle with an open major recall unknowingly.

### 7.5 Software-update history per vehicle

Tesla/Rivian/Ford — over-the-air update feature status. Some vehicles ship capable-of-feature, wait months for OTA. Claude can surface "owners report AutoPark delayed 6 months on this model."

### 7.6 Charging-cost arbitrage

Ontario ToU pricing: 2.8¢/kWh off-peak vs 12.5¢ on-peak (late 2025 rates). Model a vehicle's annual charging cost assuming 80% off-peak. Bakes ROI into the compare view more honestly.

### 7.7 Sell-the-old-car helper

Reverse of used-market search. Ian enters current vehicle, Claude generates Kijiji + Facebook Marketplace listings with good photos prompts (Ian dictates photo descriptions, Claude composes ad copy). Max the trade-in alternative.

---

## §8. Ideas that help BOTH of us — the real unlock

### 8.1 Shared "decisions journal"

`DECISIONS.md` — append-only. Every time Ian + Claude face a fork (e.g. "should we prioritize map or charging curves?") the question, options considered, choice, and rationale go in. Nine months from now when "why did we skip feature X?" comes up, the answer's there. Low-tokens-per-entry, extreme ROI over time.

### 8.2 A tiny `TODO-URGENT.md` that auto-expires

Anything Ian says "remind me to" goes here with a date-auto-flagged. `kickoff.py` surfaces anything ≥ 3 days old. Prevents Claude forgetting voice-dictated asides.

### 8.3 Handoff-quality session summaries

SESSION_SUMMARY.md is currently great. Add a 100-token "next session should start by…" block. Covers Q4→Q1 handoffs where Claude has no memory but a 100-token pointer saves 5k tokens of re-discovery.

### 8.4 Public-API-only research mode

New op_kind: `research_public`. Claude uses only free public APIs (OSM, Wikipedia, Open Charge Map) — never anything that might be paywalled or blocked. Extreme-efficiency mode for cost-cheap sessions.

### 8.5 Benchmark-my-own-improvement

Once a month: run `cost_tracker.py analyze` + diff vs last month's snapshot. Surface "data milestones dropped from 130k → 85k average tokens." Concrete proof the self-learning actually learns. Bakes confidence into the next cycle.

---

## §9. What stays the same from v3

- Scientific rigor (every number cited)
- Long-range trims only
- Generation-aware vehicle entries
- Personal use — no shipping
- Caveman prompting default
- Standing clarification protocol

Nothing in this v4 changes those. They're still the non-negotiables.

---

## §10. Answers we already have (from prior message)

Per Ian's 2026-04-23 message:
- **Q1 lease-takeover data**: genuinely interested → Stream E Phase 1a is green-lit
- **Q3 purchase timeline**: within 3 months → breadth over depth, ship data layers fast
- **Q7 used vs new**: both on the table → Stream D + Stream E both live

The seven remaining §10 questions from v3 are still open and should be answered next chance Ian has 2 minutes. Priority order: Q8 (km/year — required for TCO on everything), Q10 (home charging — affects charging-cost-arbitrage idea 7.6), Q4 (brands to drop — lets us compress seed.json further).

---

## §11. Honest admissions — where this might fail

- **Pre-flight estimator is a lookup table, not a model.** It'll miss 3× outliers. Calibrate over time; for now it's a directional signal.
- **The ROI gate can be bypassed with `TOKEN_ROI_OVERRIDE=1`.** That's intentional (real work sometimes costs 2× median) but it's also a foot-gun if Ian forgets why it was set and leaves it on. Rule: clear the env var at end of every session.
- **`operation_ledger.jsonl` grows forever.** Probably fine at a few thousand entries. At 100k+ entries, switch to SQLite.
- **The "always-loaded docs bloat" number is approximate.** 4-bytes-per-token heuristic is off by ±20% for dense prose. Good enough to flag runaway growth; don't treat as gospel.

---

## §12. What to do with this

1. Read §2 and §3 with attention — these are the in-flight changes.
2. Scan §4–§8 and mark the 3–5 that matter most for the next two weeks.
3. Bounce anything in §7 that doesn't resonate — those are Ian-specific and he owns that list.
4. Token-budget it: implementing §3 items is cheap (direct code, ~3k tokens each). §4 items are medium (one subagent each, ~50–130k). §5 items are stretch.

Next natural work item: slot the §3.7 health-check + §3.9 progress bar into kickoff while we're still in the ROI-GATE-V1 milestone. Low-risk, high-daily-ROI.

*End of v4 addendum. v5 will exist when we have new empirical data (7-day ledger, real calibration curves) and pattern changes to record. Not before.*
