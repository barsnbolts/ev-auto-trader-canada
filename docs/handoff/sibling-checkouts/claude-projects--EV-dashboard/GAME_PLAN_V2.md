# Game plan v2 — auto-update, caveman, deep audit, inventory crawler

Written 2026-04-23 after the feature-complete session close. This is a PLANNING document, not execution. Four parallel workstreams. Each has concrete scope, approach, validation, cost, and risk.

---

## Stream A — Auto-update for the Tauri desktop app

**Goal.** When I change code, your Mac app updates itself. No manual double-click-to-rebuild.

### Option tree

| Option | How it works | Pro | Con |
|---|---|---|---|
| **A1. Tauri updater + GitHub Releases** | Signed `.app` bundle on GitHub; app polls a manifest; downloads + applies on launch | Standard, battle-tested, delta updates | Needs GitHub repo, signing keys, release tooling |
| **A2. Rebuild-and-relaunch `.command`** | `Update-App.command` runs `git pull && npm install && npm run tauri:build && open` | Zero infra, works now | 3–6 min Rust compile each time |
| **A3. Dev-mode always** | `npm run tauri:dev` in background via launchd; frontend changes HMR-reload | Instant frontend updates | Dev mode isn't production-grade; Rust changes still need rebuild |
| **A4. Web + PWA ("Add to Dock")** | Skip Tauri; `npm run dev` with Safari "Add to Dock" | True auto-refresh | Not truly native; less "app-like" |
| **A5. Hybrid** | A2 for code-side; inside the app, a "Reload" button that hits `location.reload()` for frontend-only updates | Gets the fast path AND the slow path | Two update mechanisms |

**Recommendation:** **A5 (hybrid) now, A1 later if you want real GitHub infrastructure.**

Concrete A5 implementation:

1. **`Update-App.command`** in workspace — script that does:
   ```bash
   git pull --rebase
   npm install --silent
   npm run tauri:build
   # kill running app if any
   killall "EV Dashboard" 2>/dev/null || true
   open src-tauri/target/release/bundle/macos/EV\ Dashboard.app
   ```
2. **"Refresh" button** in the app header — calls `location.reload()` for the webview. Instant frontend reload, no rebuild.
3. **"Check for updates" button** — shows git status: "3 commits available in upstream. Run Update-App.command to apply."
4. **Notification via logs** — when I ship a new milestone, the `SESSION_SUMMARY.md` update timestamp is bumped. Your app reads that file on startup and shows a pill "Updates available since last launch" if timestamp is newer than your local build time.

**Full A1 future path** (when ready to invest infra):
- Push to a private GitHub repo
- Tauri signing: `npm run tauri signer generate`
- Configure `tauri.conf.json` updater with `pubkey` + `endpoints`
- GitHub Actions workflow that builds + signs + creates release on every milestone tag
- App auto-polls on startup

**Estimated cost:** A5 ~1h. A1 later ~3h (GitHub Actions setup + signing key ceremony).

---

## Stream B — Caveman token technique

**Research findings** (Exa, 2026-04-23):
- Caveman skill is a viral 4000-star GitHub project from early April 2026. Makes Claude respond in terse, filler-free English.
- Real benchmark: **14–21% output token savings** on coding tasks (the cherry-picked "75%" number is misleading).
- A distilled 6-line micro-prompt outperforms the full 552-token skill at one-sixth the injection cost.
- Affects **output tokens only** — thinking/reasoning tokens untouched.
- Best used on top of an already-concise base prompt ("Be concise. Return JSON." captures 60% of savings; caveman adds the last 14–21%).

**The micro-prompt that actually works:**
```
Respond like smart caveman. Cut all filler, keep technical substance.
- Drop articles (a, an, the), filler (just, really, basically, actually).
- Drop pleasantries (sure, certainly, happy to).
- No hedging. Fragments fine. Short synonyms.
- Technical terms stay exact. Code blocks unchanged.
- Pattern: [thing] [action] [reason]. [next step].
```

**Implementation plan for this project:**

1. **Append the 6-line micro-prompt to `CLAUDE.md`** as a "Response style" section at the end. Every future session loads CLAUDE.md → picks up the directive → all Claude responses on this project run 14–21% lighter on output tokens.
2. **Append the same block to each subagent prompt template** (`d01_verify.md`, `d04_author.md`). Their responses come back tighter; the subagent log records the before/after.
3. **Measure.** Add a simple log to `scripts/batch_ritual.py` step 4 (subagent log review): average output tokens per dispatch. Track whether the caveman injection correlates with a 14–21% drop post-injection.
4. **Compress the memory corpus** (optional). The `.auto-memory/*.md` files total ~7k tokens, loaded every session. Rewrite them in caveman-style — probably drops to ~4–5k. Original versions archived under `.auto-memory/archive/` for rollback. Run once; validate via `validate_system.py` that frontmatter stays parseable.

**Caveats / why not to go full caveman:**
- This planning doc itself is not caveman — user-facing writing for humans benefits from natural language. Caveman is for machine-to-machine or inspection-only contexts.
- Don't apply caveman to LEARNINGS.md — it's a prose log for human reflection.
- Don't apply to user-facing UI copy (mom mode covers that).
- DO apply to: CLAUDE.md directives, subagent prompts, memory files, system prompts.

**Estimated cost:** 30 min (edit files + validate). Savings compound over every future session.

---

## Stream C — Deep audit / bug fix / optimization

Systematic pass across ten concrete areas. Each is a discrete sub-task.

| # | Area | What to check | Likely findings |
|---|---|---|---|
| C1 | **TypeScript strict** | Run `tsc --noEmit` in sandbox | Likely clean (noUnusedLocals enforced) but worth verifying |
| C2 | **React re-renders** | Profile CompareView with 4 vehicles via React DevTools | Thermal recomputes on every slider tick — memoize `thermals` by `[compareIds, slider state]` |
| C3 | **Leaflet memory leaks** | Check `useEffect` cleanup in MapPanel | `leafletMap.current` may not call `.remove()` on unmount — patch |
| C4 | **Error boundaries** | Wrap CompareView + MapPanel in ErrorBoundary components | Currently one uncaught error crashes the whole compare experience |
| C5 | **Null-safety in physics** | Audit `thermal.ts` divisions | `speed_kph = 0` and `ratedRange = 0` both produce NaN that flows to UI; add guards |
| C6 | **Charge-plan edge cases** | Polyline with 2 points, no stations within 30 km, SoC target 0% | Need explicit "not feasible" path with clear message |
| C7 | **Accessibility** | Invoke `design:accessibility-review` skill | WCAG AA issues likely: color contrast on amber/red badges on ink-900, keyboard focus on breakdown drawers, aria-labels on icon-only buttons |
| C8 | **Unit tests** | Port `thermal.test.ts` to a runnable suite (vitest); add tests for `charge_plan`, `battery_degradation`, `plainLang` | Tests exist only for thermal; zero run history |
| C9 | **Seed integrity stronger** | Extend `metrics.py` validators: range bounds (50–1000 km), DC kW bounds (0–400), MSRP bounds (25k–200k CAD), charging curve monotonicity | Currently only checks null-on-non-Low |
| C10 | **Data loader runtime check** | Wrap `allVehicles` in a runtime schema validator (zod or hand-written) — catch malformed vehicles before they reach UI | Subagent-authored records could sneak in bad data |

**Recommended order:** C1 → C5 (hardening) → C4 → C8 (stability/tests) → C2, C3 (performance) → C6, C9, C10 (edge cases) → C7 (a11y).

**Estimated cost:** 6–8 h if done all at once. Can be split into two batches: hardening (C1,C4,C5,C8) ~3h, and optimization (C2,C3,C6,C7,C9,C10) ~4h.

---

## Stream D — Full Canadian inventory acquisition ("crazy mode")

**Ambition.** Every car currently for sale in Canada (new-dealer + private + lease takeover), with live data, per-vehicle inventory panels, and deal alerts.

### Data sources inventory

| Category | Source | Access mechanism | Reliability |
|---|---|---|---|
| **New-dealer inventory** | AutoTrader.ca (dealer filter) | Scrape via Exa or Playwright | Medium — hostile to scrapers |
| | Manufacturer .ca sites | Per-OEM inventory search endpoints (Tesla, Ford, Hyundai publish JSON) | High but per-OEM integration |
| | CarGurus.ca | Public inventory search | Medium |
| | Cars.com (Canada section) | Public | Medium |
| **Private sales** | AutoTrader.ca (private filter) | Scrape | Medium |
| | Kijiji Autos | Public | Medium |
| | Facebook Marketplace | Requires Meta account, strict ToS | Low — avoid |
| **Lease takeovers** | Leasebusters.com | Public search | **High** — most structured, designed for scraping |
| | LeaseCosts.ca | Public search | Medium |
| | StretchDollarClub | Public search | Medium |

### Architectural options

**D1. Naive Exa-batch-pull**
- Scheduled daily: for each of 37 seed vehicles, dispatch Exa to search each source
- 37 × 3 sources = ~111 queries/day
- Cache to `src/data/inventory/<vehicle_id>.json`
- UI reads local JSON per vehicle
- **Pros:** Fast to build, within Exa quotas
- **Cons:** Data is snapshot, not real-time

**D2. On-demand per-vehicle**
- User clicks "Find me this car" → dispatches subagent → returns listings
- **Pros:** Always current for the user's interest
- **Cons:** User waits 30–60 s per click

**D3. Subagent scraper pipeline**
- Dedicated scraping subagent for each source (Leasebusters especially)
- Writes to a local SQLite with schema: listings(id, vehicle_id, source, price, km, year, province, url, posted_at, last_seen_at)
- Scheduled nightly refresh; diff → new listings → Slack/email/log
- UI queries SQLite via a thin wrapper
- **Pros:** Actually scales, diff-trackable
- **Cons:** Most work; most fragile

**Recommendation: D1 now, D3 in a follow-up.**

### Phase-1 scope (D1 "launch")

1. **Lease takeover first** (highest value-per-effort). Leasebusters has a clean URL scheme and a per-lease page with standardized fields: monthly payment, months remaining, cash incentive, km cap, odometer.
2. **Per-vehicle JSON files** under `src/data/inventory/<vehicle_id>.json` — written by scheduled task.
3. **UsedListings.tsx enhancement** — add a "Live inventory" tab alongside the existing search-link buttons. Shows:
   - Dealer new inventory (count per province + closest 5)
   - Private used listings (top 5 by price)
   - Lease takeovers (top 5 by remaining months × monthly payment)
4. **Deal watch** — save saved-searches with criteria (e.g., "EV6 LR AWD, < 40k km, < $45k"). Scheduled task runs daily, writes new matches to `alerts.json`. UI shows an "Alerts" badge with unread count.
5. **Lease takeover details page** — click into one, see the full picture: transfer fee, lease-end buyout, insurance assumed, kilometers remaining, distance to pickup.

### What's realistic vs what will fight us

- Leasebusters — clean, structured, should work cleanly.
- Canadian OEM sites (Tesla.ca, Ford.ca, Hyundai.ca) — inconsistent APIs; some expose inventory JSON, some don't. Per-OEM scraper required.
- AutoTrader.ca — will fight us. Cloudflare, rate limiting, bot detection. Expect breakage.
- Kijiji — more permissive, but data is low-quality (many listings are garbage, scammy).
- Facebook Marketplace — off the table. Meta aggressively blocks non-authorized access.

### Honest expectations

- Lease takeovers: **likely achievable**, high-signal data, good for your use case.
- Private sales: **partially achievable**, with graceful degradation.
- Full dealer inventory across Canada: **ambitious** — in practice you'd see coverage for 60–80% of listings, not 100%. AutoTrader's reach is the realistic backbone.
- "Everything across Canada at every dealership" in real-time: **not achievable without buying API access from the aggregators** (CARFAX Canada, VAuto, etc. — these are paid enterprise integrations, $1k+/mo).

Given personal-use scope, targeting ~80% realistic coverage via Leasebusters + AutoTrader + 3–5 OEM sites is the sweet spot.

**Estimated cost:**
- Lease takeover only (Phase 1a): 3 h.
- + Private sales + dealer inventory for 3–5 brands (Phase 1b): 5 h.
- + Deal-watch + alerts (Phase 1c): 3 h.
- + Full daily diff tracking + SQLite migration (D3): 6–8 h.
- Total for Phase 1 (D1): ~11 h. Stretch to D3: another ~8 h.

---

## Sequencing across all four streams

```
Stream B (caveman)       → 30 min, do first (compounds across all later work)
Stream A5 (update path)  → 1 h
Stream C hardening       → 3 h (C1, C4, C5, C8 — do before ambitious features)
Stream D Phase 1a        → 3 h (lease takeovers — highest ROI)
Stream C optimization    → 4 h (C2, C3, C6, C7, C9, C10)
Stream D Phase 1b+1c     → 8 h (expand inventory + alerts)
Stream A1 (optional)     → 3 h (real GitHub Releases auto-update)
Stream D→D3              → 8 h (migrate to SQLite, real daily crawl)
```

**Total estimated work:** ~30 h across all streams. Realistically 3–5 sessions.

**What to tackle first:** I'd recommend B (caveman, instant), then A5 (unblocks the "real app" feel), then C hardening (de-risk ambitious work), then D Phase 1a (lease takeovers — the data you'll actually use).

## Open questions for Ian

1. **Auto-update path** — comfortable with A5 now (hybrid script + refresh button) or want to invest in A1 (GitHub Releases) from the start?
2. **Caveman scope** — apply to subagent prompts only (safer), or also compress the memory corpus (bigger win, small risk)?
3. **Audit depth** — full 10-item C-stream pass, or just the hardening sub-set (C1, C4, C5, C8)?
4. **Inventory priorities** — is lease-takeover data actually interesting to you, or is private-sale + dealer-inventory higher priority? (Changes Stream D order.)
5. **Scale of daily crawl** — 37 seed vehicles is manageable. If we expand to 60+, Exa quotas matter.
