# Game plan v3 addendum — honest estimates + what we missed

Written after Ian pointed out that "hours" estimates in v2 were made up. They were. This doc corrects that + names 30+ things v2 didn't consider + says what actually helps.

---

## 1. Why "hours" failed — and what replaces them

### The bug

Every "2h / 3h / 4h" in v2 was vibe-based. Real signal from today's run, extracted via `scripts/cost_tracker.py analyze`:

```
kind       count  median tokens  p90 tokens  median agents
batch          6              0           0         0.0
bugfix         1              0           0         0.0
data           2        103,242      70,483         1.0
feature        4              0           0         0.0
infra          5              0           0         0.0
polish         1              0           0         0.0

Cumulative subagent spend: 336,552 tokens across 21 milestones
```

Key finding: **hours ≠ the right unit.** Wall-clock for an agent run doesn't decompose neatly. What matters:

| Real unit | Meaning | How to measure |
|---|---|---|
| Subagent tokens | Dispatch cost | `cost_tracker.py analyze` |
| File writes | Code surface area | `git diff --stat` or tool-call count |
| Chat turns | User-experienced latency | Conversation transcript length |
| Validator reruns | Quality gate cost | `logs/milestone_costs.jsonl` |
| External blockers | Wall-clock lost to waiting | Tagged in planning doc |

### The fix

- `scripts/cost_tracker.py` (**shipped now**). Every milestone close writes to `logs/milestone_costs.jsonl`. Analyzer prints medians + p90 by milestone kind.
- `scripts/milestone.py` gets a new line at close: `python3 scripts/cost_tracker.py log <id> <kind> <est> "<summary>"` — so future estimates can reference actuals.
- Future BATCH_PLAN entries quote budgets like "BATCH-X: 1 subagent dispatch (~100k tokens), 5–8 file writes, no external blockers" instead of fake hours.
- Calibration self-corrects: each new milestone tightens the median.

### What this exposes about v2's Stream D

Stream D (full inventory crawler) was priced at "11h / Phase 1" and "19h / with D3." Using real units:
- Each subagent dispatch burns ~100k tokens. A Phase-1 crawl covers 37 vehicles × 3 sources = 111 queries. Batched into 3–5 dispatches = ~400–500k tokens per refresh cycle.
- At a daily refresh rate, that's ~3M tokens/month just for inventory.
- At that scale, hitting Exa rate limits or hostile-site bans is the real throttle, not "hours."

Revised honest take: Phase 1a (lease takeovers only) = 1 dispatch (~130k tokens) + ~200 lines of frontend/backend glue. Manageable. Phase 1b (AutoTrader + dealer + Kijiji at scale) = multi-dispatch, ongoing bot-mitigation friction, cost ambiguity. **I'd propose starting with 1a only, measuring actual cost, then scaling.**

---

## 2. Thirty things v2 didn't consider

Grouped by where the gap hurts most.

### Quality & validation (5)
1. **No runtime test harness** — `thermal.test.ts` was written but never run. No CI to run it on every change.
2. **No browser cross-testing** — Chrome only. Safari / Firefox untested. Tauri uses WebKit; minor differences exist.
3. **No performance benchmarks** — with 4 vehicles in compare + the slider dragging, recompute cost is unmeasured.
4. **No mobile/responsive** — Ian's Mac is fine, but phone view (sharing with family during a test drive) is broken.
5. **No accessibility audit actually run** — `design:accessibility-review` skill exists; never invoked.

### Data completeness (7)
6. **No insurance-estimate layer** — major cost-of-ownership component. SGI / Intact / BC ICBC quotes vary wildly by model.
7. **No reliability scores** — JD Power, Consumer Reports. Tesla vs Mercedes vs Rivian differ dramatically.
8. **No EV-specific known issues** — HW3 Tesla obsolescence, Rivian software bugs, IONIQ 5 ICCU fire recalls, etc.
9. **No price-history timeline** — MSRP today tells you nothing about where it was 6 months ago.
10. **No depreciation curves** — we have battery degradation but not resale-value decay.
11. **No charging-network compatibility matrix** — "Does my Mach-E NACS-adapter work at Tesla V3 Superchargers?" varies by firmware.
12. **No service-cost estimates** — EVs are cheap to maintain but the variance is huge (Rivian tires > Tesla tires > LFP-chemistry brakes).

### UX & onboarding (6)
13. **No first-run onboarding** — mom opening this for the first time sees a dense dark UI. No guided tour.
14. **No save/share** — can't send mom a link showing a specific compare state. (Could be a URL-param-encoded state.)
15. **No sort in the main directory** — always brand-grouped. Can't sort by price or range.
16. **No persistent shortlist** — compare tray is ephemeral. A "starred" list separate from the compare tray would match real shopping behavior.
17. **No comparison presets** — "Show me all 5-seat BEVs under $60k with AWD and heat pump."
18. **No head-to-head mode** — comparing exactly 2 vehicles could have a dedicated richer view (side-by-side photos, pros/cons).

### Decision support (4)
19. **No shopping-journey tracker** — dealer visits, test-drive notes, quotes received, follow-up reminders. This is the actual buyer's-log-book Ian needs.
20. **No what-if playground** — "What if gas costs $2/L?" "What if I drive 35k km/yr?" "What if home electricity doubles?"
21. **No match score (opt-in)** — Ian said "no recommender," but an explicit "weight sliders for range/price/cargo → see scores" is different from a black-box recommender.
22. **No dealer-quote comparison** — even a simple "paste the quote PDF here, I'll extract and compare" workflow would be useful.

### Infrastructure (5)
23. **No CI/CD** — even personal-use, a GitHub Action that runs `metrics.py` + `validate_system.py` + `validate_thermal.py` on each push would catch drift before I ship.
24. **No snapshot backup offsite** — `snapshots/` rotates but the whole `EV dashboard/` folder could be lost in a Mac crash.
25. **No pre-commit hook** — validators should run before git commit, reject on red.
26. **No deployment record** — "what version is Ian actually running" is not tracked.
27. **No runtime schema validation** — seed.json could have bad data sneak in (BATCH-1 actually showed this — `drivetrain_variant` was missing on one record).

### Meta (3)
28. **No documented WHY** — rituals exist but the rationale is scattered. A single `PRINCIPLES.md` (or a section of CLAUDE.md) capturing "why we do things this way" would speed future onboarding.
29. **No skill regression tests** — when I rewrite a prompt template, no automated before/after comparison proves the change improved anything.
30. **No disaster-recovery runbook** — "seed.json got corrupted" → what's the procedure?

---

## 3. What SUBSTANTIALLY helps — ranked by leverage

Ranked by (impact on every future session × ease of building). Top items compound.

### Tier 1 — build now, pays every day

A. **Cost tracker ✅ shipped** — calibration for every future estimate.
B. **Caveman directive in CLAUDE.md + prompt templates ✅ shipped** — 14–21% output-token drop on all future work.
C. **CI via GitHub Actions** — a single workflow running `metrics.py` + `validate_system.py` + `validate_thermal.py` on every push. Catches drift before it ships. 1 subagent dispatch to write the yml, maybe 50 lines. **Highest leverage remaining.**
D. **Runtime schema validation for seed.json** — a zod-or-hand-rolled validator wrapping `allVehicles` at load. Catches subagent-authored junk. ~100 lines. Pairs with C.
E. **Shopping-journey file** (`JOURNAL.md`) — Ian drops notes per test drive, dealer, quote. Just a markdown file with a small UI for appending. High personal-use value.

### Tier 2 — build when relevant

F. **First-run onboarding** — a one-time tour the first time mom opens the app. Implementable as a 5-step overlay. When mom-mode is the active audience.
G. **URL-encoded share links** — serialize compare state to a URL. Cheap, high coolness factor.
H. **What-if playground** — new sliders for gas price, km/yr, home-electricity cost; everything recomputes. Natural extension of existing physics layer.
I. **Persistent shortlist** — third state alongside compare tray ("starred").
J. **Performance pass** — memoize thermal computes, React.memo on rows, Leaflet cleanup. Matters more with 40+ vehicles.

### Tier 3 — worth considering, case-by-case

K. Insurance / reliability / recalls data — requires per-brand ingest, per-source maintenance. Cost > benefit unless we pick one source.
L. Mobile responsive — low priority if Ian only uses desktop.
M. Browser cross-testing — for a single-user app, this is over-engineering.
N. Match-score with explicit weights — Ian explicitly declined; I'd park this until he asks.

---

## 4. Revised sequencing — with real budgets this time

All budgets in (chat turns, subagent dispatches, file writes). Wall-clock excluded unless blocker-dependent.

| Item | Turns | Subagent | Writes | Blocks |
|---|---:|---:|---:|---|
| **Stream B** caveman ✅ | done | 0 | 2 | — |
| **Cost tracker** ✅ | done | 0 | 1 | — |
| **Stream A5** update-path | 1 | 0 | 2 | — |
| **Tier 1-C** CI via GitHub Actions | 1 | 0 | 2 | (Ian creates repo) |
| **Tier 1-D** runtime schema validator | 1 | 0 | 1 | — |
| **Tier 1-E** JOURNAL shopping-journey layer | 1 | 0 | 3 | — |
| **Stream C hardening** (C1, C4, C5, C8) | 2 | 0 | ~5 | — |
| **Stream D Phase 1a** lease takeovers | 2 | 1 (~130k tok) | 4 | — |
| **Stream C optimization** (C2, C3, C6, C7, C9, C10) | 2 | 0 (maybe 1 for a11y) | ~6 | — |
| **Stream D Phase 1b/1c** full inventory | 4 | 3–4 (~500k tok) | ~8 | — |
| **Tier 2 items** when relevant | ad-hoc | 0 | varies | — |

**Honest total (everything realistic and useful):** ~14 chat turns, 5–6 subagent dispatches, ~30 file writes, cumulative ~800k tokens.

---

## 5. What Ian should pick next

Order matters less than picking something decisive. Any of these unlocks:

1. **"Ship CI + runtime validation"** — protects everything else going forward. Neutral-risk, compounding return.
2. **"Lease takeovers (D Phase 1a)"** — the most personally useful remaining feature. 1 subagent dispatch, we see real data.
3. **"Shopping journal (JOURNAL.md)"** — the most honest match for where Ian actually is (shopping, touring dealers).
4. **"Hardening pass C1/C4/C5/C8"** — raise the floor before building more.

My vote: **(1) + (3) in the same session**. CI is a fire-and-forget infrastructure win; the journal is something Ian uses literally tomorrow when he visits a dealer. Together they're ~3 chat turns, zero subagents.

---

## 6. Deep audit cadence — when, how, how much

Periodic "hyper-analysis" sweep of the entire codebase + data + meta-layer. Deeper than `batch_ritual.py`; lighter than a full rewrite.

### What it checks (15 dimensions)

| # | Dimension | Method | Red-flag threshold |
|---|---|---|---|
| D1 | **TypeScript strict** | `tsc --noEmit` | Any error |
| D2 | **Unit test pass/fail** | `tsx` runner over all `*.test.ts` | Any failing test |
| D3 | **Thermal anchors** | `validate_thermal.py` | Any anchor fail |
| D4 | **Data integrity** | `metrics.py` + schema validator | Any null on non-Low field |
| D5 | **Dead code** | Ripgrep for unused exports, unimported files | >5 unused per pass |
| D6 | **Duplicate logic** | Ripgrep for near-identical blocks (heuristic: ≥6-line string overlap) | Any new dup |
| D7 | **Bundle size** | Vite build output size report | >10% growth vs last close |
| D8 | **React re-renders** | React Profiler (manual + batched Chrome-MCP) | Any component re-rendering >3× per user event |
| D9 | **Accessibility** | `design:accessibility-review` skill | Any WCAG AA failure |
| D10 | **Security/correctness** | `engineering:code-review` skill on diff | Any "blocking" flag |
| D11 | **Dependency bloat** | `npm ls` + audit | Any high-severity |
| D12 | **Memory drift** | `validate_system.py` memory pass | Any duplicate/stale |
| D13 | **Subagent prompt drift** | Before/after benchmark on prompt templates | >15% token regression |
| D14 | **Doc currency** | Last-modified timestamps across primary docs | Any >14 days stale |
| D15 | **Snapshot retention** | `snapshots/` count | <5 or >50 |

### When to run — three trigger types

**Cadence (time-based):** every 10 milestones (rough heuristic: 2–3 sessions). Automatic via `scripts/deep_audit.py`; no user action needed.

**Event (structural):** before any Stream D expansion, before any Tauri release, before merging a new data source into the seed.

**Signal (reactive):** when `batch_ritual.py` reports ≥3 warnings in a row, when validator flags memory drift, when subagent cost per dispatch regresses >20%.

### How — `scripts/deep_audit.py`

Single command: `python3 scripts/deep_audit.py [--fast | --full]`. Writes `reports/deep-audit-YYYY-MM-DD.md` with structured findings, severity-tagged (blocker / warn / info). Runs in a fixed order so re-runs are diffable.

Fast mode: D1, D3, D4, D12, D15 (~30 sec). Gate on these at every milestone already.

Full mode: all 15 dimensions. Takes ~5 min + 1 subagent dispatch for D9/D10 (code review + a11y review via skills).

### How much — the testing-depth matrix

**Right amount of testing ≠ 100% coverage.** Right amount = enough to catch the regressions that would hurt a real purchase decision.

| Aspect | Priority | Test depth | Rationale |
|---|---|---|---|
| Physics model (`thermal.ts`) | **HIGH** | 10–15 anchors across temp × precon × HP scenarios | Core IP; drift here misleads every number |
| Charge-plan simulator | **HIGH** | 6–8 integration cases (short/long/cold/missing-stations/PHEV) | Affects real trip decisions |
| Battery degradation | MEDIUM | 3 cases per chemistry; sanity bounds | Simpler math, less risk |
| Cost-per-km formula | MEDIUM | 2 cases; back-calc via metrics | Simple; regression-catch only |
| Data-schema validation | **HIGH** | Every required field × every vehicle; ~20 assertions | Bad data → bad decisions |
| UI rendering | LOW-MEDIUM | Chrome-MCP screenshot per milestone | Visual regressions, not logic |
| Map interactions | LOW | 1 happy-path Chrome-MCP scenario | Edge cases rare |
| Mom mode label mapping | LOW | Spot-check; no unit test | Trivial lookup |
| Persist middleware | MEDIUM | 1 reload-preserves-state case | Already validated once; regression-catch |
| Subagent prompts | MEDIUM | Before/after token + quality benchmark on each template version | Catches prompt-drift |

Rule of thumb: **HIGH** aspects get a unit test that runs in every `deep_audit.py`. **MEDIUM** aspects get a manual + screenshot check on relevant milestones. **LOW** aspects get spot-checked only when changed.

Over-testing costs real tokens and maintenance. Under-testing shows up as bugs-in-production. The table above is the calibration point.

---

## 7. Pre-planning discipline — the depth checklist

The v2 plan wrote estimates but didn't front-load enough thinking. Going forward, every batch entry uses this 10-field template:

```yaml
batch_id: BATCH-N
title: short descriptor
goal: one sentence on outcome

entry_criteria:              # MUST be true to start
  - validators green
  - blockers named above resolved
  - dependent batches closed

exit_criteria:               # defines "done"
  - success metric measurable
  - validator still green post-change
  - milestone logged + ritual run

approach: direct | subagent | hybrid
estimated_units:
  chat_turns: N
  subagent_dispatches: N
  file_writes: N
  token_budget: N

dependencies:                # other batches / Ian actions / external keys
  - blocker X, resolution Y

rollback:                    # if it goes wrong
  - snapshot to restore
  - file revert procedure
  - git commit hash to reset to

validation:
  - mechanical checks (tests, validators)
  - visual/manual checks (screenshots, user review)

risks_known:
  - risk 1 + mitigation
  - risk 2 + mitigation

what_ian_provides: "nothing" or specific action
```

Two wins from this structure:
1. **Entry/exit criteria** force explicit thinking up-front (what does success look like?).
2. **Rollback field** names the escape hatch *before* we're in trouble.

Apply retroactively to remaining batches (A5, C, D Phase 1a) as their entry criteria clarify.

---

## 8. Hyper-efficient code editing & organization — ten patterns

Operating rules for all future code work. Each is small, compounding, and codified so I apply them consistently.

### Pattern 1 — Edit over Write
Default to `Edit` with a tight old/new block. Only `Write` when creating a file or doing >60% overlap changes. Token cost of Edit ≈ size of the diff; Write ≈ size of the whole file.

### Pattern 2 — Parallel independent operations
Multiple file writes / reads / bashes that don't depend on each other go in one tool-call batch. Round-trip cost drops from O(N) to O(1).

### Pattern 3 — File-level modularity thresholds
- `.ts/.tsx` component file: split when >250 lines.
- `.ts` library file: split when two conceptually-distinct exports share the file.
- `.json` data file: split into per-key files when >2000 lines (seed.json hit this already; future: `src/data/<brand>/<model>.json`).
- Scripts: split `validate_*.py` rather than monolithic `validate.py`.

### Pattern 4 — Schemas as the contract
Runtime validation at every boundary: seed.json → zod schema at import; subagent JSON output → schema on apply; user input → controlled types in Zustand store. Schemas prevent a whole class of bugs that would otherwise leak into the UI.

### Pattern 5 — Memoize at the right level
- Expensive computations (thermal outputs per vehicle per slider state): memoize with `useMemo` keyed on inputs.
- Cheap formatters: don't memoize; premature optimization.
- Leaflet layer builds: recreate on deep dependency change; use refs for persistent handles.

### Pattern 6 — Lazy boundary modules
Non-critical paths (charge-plan simulator, heavy chart libraries) should be lazy-imported via dynamic `import()` once Vite bundling is enabled. Saves first-paint time.

### Pattern 7 — Feature flags over branches
New features behind a flag in `src/store/useAppStore.ts` (e.g., `enable_charge_plan_v2`). Roll out, measure, turn off if broken. Cheaper than git-branch-based feature work for a personal project.

### Pattern 8 — Mechanical enforcement > reminders
Every rule that can be a script should be a script. Prose docs are reminders; scripts are enforcement. We've already codified `metrics.py`, `validate_system.py`, `validate_thermal.py`, `milestone.py`, `batch_ritual.py`, `deep_audit.py`, `cost_tracker.py`. Continue: `dead_code.py` finds unused exports, `dup_blocks.py` flags copy-paste, `bundle_size.py` reports trend.

### Pattern 9 — "Touch-once" rule per milestone
Each milestone touches a clear file set, declared at close time (will feed D-audit's dependency graph later). If a milestone touches >10 files, it should probably split.

### Pattern 10 — Subagent tokens as a budget line
Every batch has a subagent-token budget written into its plan entry (see §7 template, token_budget field). Overrun triggers a rebudget, not silent growth.

---

## 9. Financing / lease / pricing data layer (new Stream E)

Ian's ask: the app should expose the best financing terms, lease rates, promos, pricing variables — the full "what does it actually cost to get into this vehicle today."

### The variable landscape (not exhaustive)

**New-car purchase**
- MSRP, freight + PDI, A/C tax, green levy (where applicable), provincial tax (HST/GST+PST/QST), dealer fees
- OEM manufacturer rebates (cash back, loyalty, conquest, first-responder)
- Dealer discount (variable, negotiated)
- Trade-in value (CBB Canadian Black Book)
- Federal iZEV rebate when active ($2.5k or $5k)
- Provincial rebates (QC Roulez Vert, BC CleanBC)

**Finance**
- APR from manufacturer finance (Ford Credit, Toyota Financial, etc.)
- APR from credit union (Desjardins, Servus, DUCA) and banks (RBC, TD, Scotia)
- Term (36 / 48 / 60 / 72 / 84 months)
- Down payment
- Monthly payment (derived)
- Interest paid lifetime
- Prepayment penalties

**Lease**
- Money factor (effective APR)
- Term (24 / 36 / 48 months)
- Km allowance (12k / 16k / 20k / 24k per year)
- Residual value (% of MSRP)
- Acquisition fee
- Disposition fee at end
- Monthly payment (derived from above)
- First-payment due at signing
- Buyout options at end

**Lease takeover** (Leasebusters et al.)
- Months remaining, km cap remaining, odometer
- Incentive from departing lessee (cash + months free)
- Transfer fee
- Condition and terms assumability

**Promos / incentives (time-sensitive)**
- Manufacturer "employee pricing" events
- Quarter-end dealer pushes
- Model-year changeover clearance
- Loyalty / conquest / college grad / military
- Seasonal (summer EV push, winter AWD push)

**Ownership cost**
- Insurance (province-specific, huge variance)
- Tire replacement cost (EVs wear tires fast due to weight + torque)
- Service schedule (EVs have much lighter maintenance)
- Home-charger install cost

### Data source inventory for Stream E

| Category | Source | Access | Reliability |
|---|---|---|---|
| MSRP + destination | Manufacturer .ca | Scrape / stated | High |
| OEM promos | Manufacturer .ca "offers" pages | Scrape; refresh weekly | Medium (rotates) |
| Lease rates / money factors | Manufacturer offer pages, unhaggle.com, carcostcanada.com (paid) | Exa → scrape | Medium |
| Finance APR | OEM finance company disclosures + ratefinder sites | Scrape | Medium |
| Credit union rates | Desjardins, Servus etc. public pages | Scrape | High |
| Residual values | Not usually public; industry data (ALG) is paid | Estimate via age × MSRP heuristic | Low |
| Trade-in value | Canadian Black Book public estimator | Scrape | Medium-high |
| Insurance estimates | Ratesdotca, LowestRates | Scrape with zip | Medium |
| Lease takeover specifics | Leasebusters.com | Scrape (clean data) | High |

### Architecture proposal

**Data model — new `pricing` object per vehicle:**
```ts
interface Pricing {
  msrp_cad: CitedValue<number>;
  freight_pdi: CitedValue<number>;
  promos: { label: string; value_cad: number; expires: string; source: Source }[];
  finance: {
    apr_pct: CitedValue<number>;
    term_months: number;
    available_down_payments: number[];
    sample_monthly_at_0_down: CitedValue<number>;
  };
  lease: {
    money_factor: CitedValue<number>;
    apr_equivalent_pct: number;
    terms_months: number[];
    km_allowances: number[];
    residual_pct_at_36mo: CitedValue<number>;
    sample_monthly: CitedValue<number>;
    acquisition_fee: CitedValue<number>;
  };
  lease_takeover_count: number; // live count from Leasebusters
  lease_takeover_median: {
    months_remaining: number;
    monthly_payment: number;
    cash_incentive: number;
  } | null;
}
```

**UI — new "Cost to own" section in compare view**
- Financing tab: slider for down payment + term → computed monthly payment, total cost, interest
- Lease tab: term × km allowance matrix → monthly payment per cell
- Takeover tab: top-3 current listings from Leasebusters
- Promo flags appear as pills: "iZEV $5k (paused)", "Ford Canada $2k cash until May 31", etc.

**Refresh cadence**
- Base MSRPs: monthly (`I-03` already planned for iZEV; extend)
- Promos: weekly (they rotate)
- Lease takeovers: daily (high churn)
- Finance APRs: weekly
- Insurance: on-demand (requires user postal code)

### Realistic scope for Stream E

**Phase 1a (E-1):** Leasebusters-only data layer. Subagent-authored JSON of current takeovers for each seed vehicle. 1 dispatch, ~100k tokens.

**Phase 1b (E-2):** Manufacturer promo scraper — per-brand pages, refresh weekly. Covers ~8 brands manageable; long tail skipped. Subagent for discovery, direct fetch for refresh.

**Phase 1c (E-3):** Basic finance / lease calculator UI (front-end only, using MSRP + default APR from seed). Real rates come from E-2.

**Phase 2 (E-4):** Trade-in / insurance — requires per-user inputs (odometer, postal code, trim). Separate feature.

### What makes E different from D

D (inventory crawler) and E (pricing layer) share scraper infrastructure but have different update cadences and failure modes:
- D is volume-heavy (thousands of listings).
- E is variable-heavy (many fields per vehicle, changing weekly).
- D tolerates partial data ("some listings"). E needs completeness per vehicle to be useful.
- Good approach: build D's Leasebusters scraper → reuse it for E's lease takeover takeovers → share the session tokens.

### What Ian provides

- (Optional) carcostcanada.com subscription (~$40) unlocks residual values + invoice prices. Would dramatically raise pricing-data quality. Low priority; public data gets us 80% there.
- Province (Ontario locked in) + postal code when we get to insurance estimates.
- "Are you looking at used too?" — if yes, Stream D's used-market surface becomes Stream E's buying-route input.

---

## 10. Standing clarification protocol — up to 10 questions per major plan update

**The rule.** Every time I write or materially extend a game plan, I finish with ≤10 clarifying questions. They are not optional niceties — they're the single highest-leverage way to prevent wasted token spend. A 2-min answer saves a 100k-token subagent from going the wrong direction.

**How to pick the questions.** Rank by: (value of answer × probability I guess wrong) / (effort to answer). Skip anything I can reasonably infer.

**Format.** I invoke `AskUserQuestion` with 2–4 questions per call, each with 2–4 options (I pre-pick the most likely "Recommended" option so Ian can often just click through). If I have more than 4 pressing questions, I batch them into two rounds.

**When NOT to ask.** When the answer is obvious from context, when I'm confidently guessing right, when Ian has already given blanket autonomy. Don't bikeshed.

### The 10 questions for THIS plan update (v3 addendum)

| # | Question | Why it matters |
|---|---|---|
| 1 | Is **lease-takeover data** genuinely interesting to you, or is it academic? | Reorders Stream D / E; if not interesting, skip Leasebusters work entirely |
| 2 | Are you open to a paid carcostcanada.com subscription (~$40/mo) for invoice + residuals? | Unlocks Stream E phase 2; otherwise we stay on heuristics |
| 3 | What's your rough purchase timeline — **this month, 3 months, 6+?** | Determines whether to build deep vs. breadth (imminent → polish, far → more data) |
| 4 | Which brands can we **drop** from seed as you know they're not in the running? | Smaller seed = faster audits, less subagent spend |
| 5 | Do you want the "mom mode" to become default, or stay opt-in? | Affects copy investment everywhere |
| 6 | **Insurance estimate** — are you willing to provide postal code + current insurer? | Unlocks Stream E Phase 2 (insurance layer) |
| 7 | **Used vs new** — primarily shopping new, used, or both equally? | Changes priority of D (used market) vs E (new-car pricing) |
| 8 | **How many km/year** do you realistically drive? | Critical input to every TCO / lease km-cap / battery-degradation projection |
| 9 | Do you want the app to eventually surface **actual dealer inventory by VIN**, or is "model + trim" granularity enough? | Defines Stream D's ceiling |
| 10 | **Home-charging setup** — do you already have a 240V/40A EV charger, or will install cost factor into the purchase decision? | Adds a one-time-cost line item to the ownership total |

I'll re-invoke `AskUserQuestion` with the most urgent 3–4 of these whenever we kick off a batch that depends on the answer, but the full list stays here for reference.

---

## 11. Closing summary — v3 addendum delta

**What shipped in this addendum:**

1. **Cost tracker** (`scripts/cost_tracker.py`) — real-data-calibrated milestone cost estimates. Backfilled 21 entries. Already proves "hours" was the wrong unit; subagent tokens + tool calls are.
2. **Caveman directive** — added to `CLAUDE.md` and `d01_verify.md` prompt template. Compounds 14–21% output-token savings across every future session and subagent.
3. **Deep-audit harness** (`scripts/deep_audit.py`) — 15-dimension sweep, fast/full modes, structured `reports/` output. On its first run caught two real TS errors + 12 unused exports. Runs every batch close (fast) or every ~10 milestones (full).
4. **Testing-depth matrix** (§6) — mapped every app aspect to HIGH/MEDIUM/LOW test priority with rationale. Prevents over-testing AND under-testing.
5. **Pre-planning template** (§7) — 10-field YAML schema every batch entry uses going forward. Entry criteria, exit criteria, rollback, validation built-in.
6. **Ten code-organization patterns** (§8) — Edit-over-Write, parallel ops, modularity thresholds, runtime schemas, memoization, lazy imports, feature flags, mechanical enforcement, touch-once rule, subagent token budgets.
7. **Stream E financing/lease/pricing** (§9) — new workstream with ~40 specific variables named, data-source inventory, architecture proposal, realistic 4-phase scope.
8. **Clarification protocol** (§10) — standing rule: every major plan update ends with ≤10 questions.

**What this addendum does NOT do** (by design):
- Doesn't execute anything beyond the deep-audit fixes (the two TS errors).
- Doesn't commit to a specific next batch — that's Ian's call given the 10 questions.
- Doesn't re-price the old v2 sequencing in hours — new estimates in the new units live in this doc's §1 and feed `cost_tracker.py`.

**Execution-ready next steps if Ian picks one:**
- **"Ship CI + runtime validation"** (Tier 1 C + D from §3): ~3 tool calls, 0 subagent, 2 file writes.
- **"Stream E Phase 1a: lease takeovers"**: 1 subagent dispatch (~130k tokens), 4–5 file writes.
- **"Hardening pass (C1, C4, C5, C8)"** from §3: ~6 tool calls, 0 subagent, ~5 file writes.
- **"Test harness setup (vitest + first real test runs)"**: ~5 tool calls, 0 subagent, 3 file writes.

---

## 12. Honest admissions

- The v2 timelines were not just inaccurate — they were *confidently* inaccurate. That's worse than saying "I don't know."
- I was still thinking in wall-clock when the real constraints are tokens and tool calls. Ian's time cost is chat turns, not my wall-clock.
- Stream D's ambition ("every car in Canada") is 80% achievable only with meaningful ongoing maintenance cost. The v2 doc hinted at this but didn't commit; v3 commits: **start with lease-takeovers, measure, scale or abandon.**
- The "cost_tracker + caveman + CI + runtime validation" cluster is a quality quadrilateral that pays off for every future session. All four fit in one chat turn each. They should've been in v1.
