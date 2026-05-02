# EV Auto Trader Canada — M0→M12 Execution Plan (2026-05-02)

> **Plan-mode status:** This planning session ran on extra-high reasoning under
> `ApprovalPolicy=plan`. The harness blocked all writes outside this single plan
> file, so the live work itemised under "MISSION pre-do" in the kickoff prompt
> (Chrome MCP probe, Apify sample, doc commits) was **not executed during
> planning**. They roll forward into the medium-reasoning execution session as
> the first ordered tasks (see "Execution order" §4).
>
> **Status of repo at planning time:**
> - cwd planned for: `~/ev-auto-trader-canada`
> - HEAD: `cd95a99d6045d6fc31f703edcf3274eb70277321`
> - Branch: `claude/verify-environment-setup-oTu3S`
> - Working tree: clean
> - origin: `barsnbolts/ev-auto-trader-canada`

---

## 1. Context

### What this is

`ev-auto-trader-canada` is a Next.js 15 (App Router) personal-use inventory
+ incentives tracker for Canadian EVs. Ian is buying a Hyundai Ioniq 5/6/9
or Kia EV6/EV9 within 1–2 weeks. **Buying intent updated 2026-05-02:** the
target is now the *best of cash / finance / lease* per unit — whichever
gives Ian the most leverage at the dealership — not cash-only. This shifts
the OTD scope (lease and finance both have their own subvented APRs and
manufacturer cash that don't apply to cash deals) and adds an explicit
follow-up milestone (M13 in §12). The site renders a per-unit deal score,
OTD math, applicable incentives stack, and a printable dossier.

### Reasoning tier-down strategy

This planning session is the only extra-high pass. Use it to bang out the
hardest design decisions and live probes (M0 + M12 schema design, M4 call-site
map, M9 strategy). Then drop to **high** to execute the multi-file code work
(M4 cookie migration, M6 selector rewrite, M11 cron + hooks, M3 snapshot-diff
script) where judgment + cross-file consistency matters but novelty is low.
Then drop to **medium** for the rest (M9 Exa fill loop, M12 Exa refresh
loop, the M13 lease/finance refresh follow-up) once the patterns are
mechanical. Each tier-down is a natural commit + push boundary.

### Why this plan exists

A previous Linux-sandbox session could not finish M0–M12 because three MCP
servers (Chrome / Apify / scheduled-tasks) are Mac-only. This planning pass
runs locally on the Mac with full MCP access. Output: a paste-ready
execution plan for a follow-up medium-reasoning session that will burn no
HIGH-tier turns on routine work.

### What's shipped already (do **not** re-litigate)

- Stable SHA1 IDs `u-at-<8hex>` (`c1d5f69`)
- `msrpSource` provenance chip (`e28585d`)
- `oem-pricing.json` envelope w/ `lastVerified`
- `BuyerContext` Zod schema + cookie + server helper w/ legacy fallback (`1914272`)
- `applicableIncentives` already accepts an optional `buyerContext` param
  (`src/lib/scoring.ts:204-209` — confirmed)
- Dossier route scaffold at `src/app/inventory/[id]/dossier/page.tsx`
- Predeploy script (`npm run predeploy` = `tsc --noEmit && next build`)
- Phase 1 trim parser hardening (Ioniq5 Ultimate, Ioniq9 Calligraphy etc.)
- Snapshot mechanism: `scripts/snapshot.mjs` writing `data/snapshots/YYYY-MM-DD.json`
- 4 snapshots present: 2025-04-01, 2025-04-15, 2026-05-01, 2026-05-02

### Non-negotiables

1. Touch only `~/ev-auto-trader-canada`. Never cd into the EV-dashboard repo
   at `~/Documents/Claude/Projects/EV dashboard/` — different project, hard
   "cross-repo trap" rule.
2. Branch stays on `claude/verify-environment-setup-oTu3S`. Don't push to
   main, don't force, don't `--no-verify`, don't amend.
3. Predeploy gate (`npm run predeploy`) must pass before every push.
4. Apify spend ≤ $30 cumulative. Ask before first paid run.
5. Caveman mode internal (drop articles/filler; UI copy stays English).
6. TodoWrite live, exactly one `in_progress` at a time.

---

## 2. Tool/MCP availability check (run first thing)

```bash
cd ~/ev-auto-trader-canada \
  && git rev-parse HEAD \
  && git branch --show-current \
  && git status --short
```

Expected: HEAD `cd95a99` (or newer if planner pushed), branch
`claude/verify-environment-setup-oTu3S`, working tree clean.

```bash
npm install && npm run predeploy
```

Expected: typecheck clean, Next build ok (~30s). If predeploy fails, halt and
diagnose — most likely culprit is a stale `node_modules` from the sandbox
mirror; `rm -rf node_modules .next && npm install` usually fixes it.

MCP confirmation in chat:
- `mcp__Claude_in_Chrome__list_connected_browsers` — must return ≥1 browser
- `mcp__Apify__search-actors` query "autotrader" — must return matches
- `mcp__scheduled-tasks__list_scheduled_tasks` — must return list (possibly empty)
- Exa: `mcp__9a04470a-c5be-420d-a32b-adaaa7f50b13__web_search_exa` available

If any are missing, post the gap to chat and continue with whatever's
available — the per-milestone status table below tags fall-through paths.

---

## 3. M-task status table

| ID  | Reasoning | Status      | Blocks   | Why                                                    |
|-----|-----------|-------------|----------|--------------------------------------------------------|
| M0  | HIGH      | READY       | M2, M3   | Chrome MCP probe live now                              |
| M2  | HIGH      | READY*      | (data)   | Apify sample needs in-chat $ approval                  |
| M3  | MEDIUM    | CONDITIONAL | —        | Skip if M0 finds daysOnMarket; else implement          |
| M4  | HIGH      | READY       | (UI)     | Cookie migration — call sites mapped                   |
| M6  | MEDIUM    | READY       | M4       | File rename + checkbox UI                              |
| M9  | LOW       | READY       | UI chip  | 20 Exa queries to fill heatpump-research-queue         |
| M10 | HIGH      | PHASE-A-RDY | B/C wait | Probe doc only this round; pause for go-ahead          |
| M11 | MEDIUM    | READY       | —        | scheduled-tasks call + simple-git-hooks                |
| M12 | HIGH      | READY       | —        | Exa-first OEM MSRP refresh; Chrome fallback on misses  |

\* "READY*" = ready pending one in-chat approval.

---

## 4. Execution order (medium session reads this top-to-bottom)

The user's "Mission" listed pre-do items + a separate "write
EXECUTION_PLAN" deliverable. Plan mode prevented those pre-do edits, so
the order below collapses planner pre-do + executor handoff into one path:

1. **Bootstrap** (verify HEAD + predeploy pass + MCPs).
2. **M0 [HIGH] — Chrome MCP GraphQL response-body probe.** Outcome decides M3.
3. **M9 [LOW] — Exa heatpump queue fill** (20 calls). Mechanical; runs
   while M2 awaits paid-run approval.
4. **M2 [HIGH] — Apify ON+H/K sample.** Tiny first (1 page per
   province × Hyundai/Kia). $0.75. Ask before firing.
5. **M12 [HIGH] — OEM MSRP refresh** via Exa. Chrome MCP fallback per ambiguous trim.
6. **M4 [HIGH] — Cookie migration** (4 routes + delete `buyerProvinceServer.ts`).
7. **M6 [MEDIUM] — Selector rename + loyalty/conquest checkboxes.**
8. **M3 [MEDIUM] — Snapshot-diff daysOnMarket** (only if M0 unusable).
9. **M10 Phase A [HIGH] — Write `docs/LEASEBUSTERS_PROBE.md`. PAUSE.**
10. **M11 [MEDIUM] — Scheduled-tasks cron + simple-git-hooks pre-commit.**

Push after each milestone (predeploy gate + caveman commit message).

---

## 5. Per-milestone work orders

> Each milestone below has: **Files** (with line ranges where known),
> **Steps** (literal commands or actions), **Diff sketch** (for code edits),
> **Verification** (exact command + expected outcome), **Edge cases**.

---

### M0 [HIGH] — Chrome MCP GraphQL response-body probe

**Goal.** Decide whether `daysOnMarket` rides on either GraphQL endpoint
firing on AutoTrader's search-results page. Outcome decides M3.

**Files touched:**
- `docs/CHROME_PROBE.md` (append a "GraphQL response bodies" section)
- `docs/handoff/research/M0_graphql_2026-05-02.json` (NEW; raw captures)
- `docs/handoff/research/M0_findings_2026-05-02.md` (NEW; one-page interpretation)

**Endpoints already known** (from `docs/CHROME_PROBE.md:113-120`):
- `https://listing-search.api.autoscout24.com/graphql`
- `https://www.autotrader.ca/listing-search-api/graphql`

**Steps.**

```
# 1. Open a tab, install the fetch hook BEFORE first navigation.
mcp__Claude_in_Chrome__list_connected_browsers     # confirm ≥1 browser
mcp__Claude_in_Chrome__tabs_create_mcp              # → tabId X
mcp__Claude_in_Chrome__navigate
  tabId: X
  url: about:blank

mcp__Claude_in_Chrome__javascript_tool
  tabId: X
  action: javascript_exec
  text: |
    window.__capturedGql = [];
    const _origFetch = window.fetch;
    window.fetch = async (...args) => {
      const url = (args[0] && args[0].url) || args[0];
      const init = args[1] || {};
      const reqBody = init.body || null;
      const res = await _origFetch.apply(window, args);
      try {
        if (typeof url === 'string' && /graphql/i.test(url)) {
          const clone = res.clone();
          const respText = await clone.text();
          window.__capturedGql.push({
            url,
            method: init.method || 'GET',
            reqHeaders: init.headers || null,
            reqBody,
            status: res.status,
            respHeaders: Object.fromEntries(res.headers.entries()),
            respBody: respText,
            ts: new Date().toISOString(),
          });
        }
      } catch (e) {
        window.__capturedGql.push({ url, error: String(e), ts: new Date().toISOString() });
      }
      return res;
    };
    const _XHR = window.XMLHttpRequest;
    window.XMLHttpRequest = function() {
      const xhr = new _XHR();
      const open = xhr.open;
      xhr.open = function(method, url, ...rest) {
        this.__url = url; this.__method = method;
        return open.call(this, method, url, ...rest);
      };
      const send = xhr.send;
      xhr.send = function(body) {
        if (this.__url && /graphql/i.test(this.__url)) {
          this.addEventListener('load', () => {
            window.__capturedGql.push({
              url: this.__url, method: this.__method,
              status: this.status, respBody: this.responseText, ts: new Date().toISOString(),
              source: 'xhr', reqBody: body,
            });
          });
        }
        return send.call(this, body);
      };
      return xhr;
    };
    'hook installed'

# 2. Now navigate. The hook captures the very first GraphQL POST that fires.
mcp__Claude_in_Chrome__navigate
  tabId: X
  url: https://www.autotrader.ca/cars/?make=Hyundai&model=Ioniq+5&prv=Ontario

# Wait ~6 seconds.
mcp__Claude_in_Chrome__computer
  action: wait
  tabId: X
  duration: 6

# 3. Trigger pagination three different ways, capture each fresh GraphQL call.

#   Trigger A — change rcp= URL param:
mcp__Claude_in_Chrome__navigate
  tabId: X
  url: https://www.autotrader.ca/cars/?make=Hyundai&model=Ioniq+5&prv=Ontario&rcp=2

#   Wait + reinstall hook (navigation wipes window scope). Repeat the JS step.

#   Trigger B — filter change. Use the make/model filter UI to flip away
#   then back. find the filter element first.
mcp__Claude_in_Chrome__find
  tabId: X
  query: "make filter dropdown or province filter"
  → use ref to switch province to BC then back to Ontario.

#   Trigger C — Display dropdown. Look for "Per page" selector; flip from
#   default 25 → 50.
mcp__Claude_in_Chrome__find
  tabId: X
  query: "results per page dropdown"

# 4. After each trigger, dump captures:
mcp__Claude_in_Chrome__javascript_tool
  tabId: X
  action: javascript_exec
  text: JSON.stringify(window.__capturedGql, null, 2)

#   Save raw output to docs/handoff/research/M0_graphql_2026-05-02.json
#   (write the JSON to disk via the Write tool — sandbox-side fs).
```

**Decision tree on captures.**

| Probe outcome                                                | M3 status | M2 plan                                              |
|--------------------------------------------------------------|-----------|------------------------------------------------------|
| daysOnMarket field present in either GraphQL response body  | SKIP      | M2 SSR scraper merges that GraphQL field per-page    |
| 0 captures after 3 trigger attempts                         | RUN       | "GraphQL unusable" — snapshot-diff (M3) is the path  |
| Captures present but no daysOnMarket field                  | RUN       | Same — snapshot-diff path                            |
| Captures rate-limited (429) after first trigger             | DEGRADE   | Note + Apify-only path within $30 cap                |

**Files to write:**

1. `docs/handoff/research/M0_graphql_2026-05-02.json` — verbatim
   `window.__capturedGql` payload.

2. `docs/handoff/research/M0_findings_2026-05-02.md` — one-page summary
   structured as:

```markdown
# M0 GraphQL response-body probe — findings (2026-05-02)

## Probed at
- HEAD <sha>
- Branch claude/verify-environment-setup-oTu3S
- URL https://www.autotrader.ca/cars/?make=Hyundai&model=Ioniq+5&prv=Ontario

## Captures
- Endpoint A: <url> — N requests, status M, daysOnMarket FOUND/MISSING
- Endpoint B: <url> — N requests, status M, daysOnMarket FOUND/MISSING

## Per-listing fields observed in responses
- field1, field2, ... (extract by inspecting the first listing in any 200 body)

## Decision
**GraphQL <usable | unusable | partial> for daysOnMarket.** Therefore:
- M2 plan: <SSR-only | SSR + GraphQL merge | Apify last-resort>
- M3 plan: <skip | implement snapshot-diff>

## Reproduction
Hook script attached at docs/handoff/research/M0_hook.js (one-liner if useful).
```

3. Append to `docs/CHROME_PROBE.md` under a new section:

```markdown
## GraphQL response bodies (2026-05-02)

Probed both GraphQL endpoints via fetch+XHR monkey-patch installed BEFORE
first navigation. Triggered fresh fetches via [trigger list]. See
docs/handoff/research/M0_findings_2026-05-02.md for verbatim findings.

**Decision:** <usable | unusable> → M3 <skip | implement>.
```

**Verification.**
- `ls docs/handoff/research/M0_*` lists 2 files.
- `git diff docs/CHROME_PROBE.md` shows the appended section.
- `npm run predeploy` clean (these are docs only).

**Edge cases.**
- Imperva challenge instead of search results: try a clean profile or skip
  to Apify entirely (mark "GraphQL unusable due to bot wall").
- Hook lost on navigation: re-install after every navigate. The script
  above is idempotent.
- POST body of GraphQL is form-encoded protobuf instead of JSON: log raw
  bytes; do not parse. Decision can still be made (we only need to know
  whether daysOnMarket / firstSeen / dateAdded keys appear in the response).

**Estimate.** 5–15 min wall, 4–8 turns.

**Commit.**

```bash
git add docs/CHROME_PROBE.md docs/handoff/research/
git commit -m "docs(M0): graphql response-body probe — daysOnMarket <FOUND|MISSING>"
git push origin claude/verify-environment-setup-oTu3S
```

---

### M9 [LOW] — Exa heatpump queue fill (run while M2 awaits approval)

**Goal.** Fill `data/heatpump-research-queue.json` (currently 20 rows, all
`hasHeatPump: null`) via Exa. Confidence=Low → leave `null`, don't guess.

**Queue verified.** All 20 rows have `hasHeatPump: null` — the planner
read the file in full. No `confidence: "Low"` rows to leave; no `true`
rows already filled. Total Exa calls capped at 20 search + ≤20 fetch = 40.

**Files touched:**
- `data/heatpump-research-queue.json` (in-place)
- `data/specs.json` (auto-written by `scripts/merge_heatpump_research.py`)
- `docs/handoff/research/M9_heatpump_2026-05-02.md` (NEW; per-row research log)

**Steps (one-liner per row).**

For each row in the queue, in order EV6 → Ioniq5 → Ioniq6 → EV9 → Ioniq9:

```
mcp__9a04470a-c5be-420d-a32b-adaaa7f50b13__web_search_exa
  query: "<year> <make> <model> <trim> Canada heat pump standard"
  numResults: 5

# Pick the top result that's a hyundaicanada.com / kia.ca / Hyundai/Kia spec
# PDF / EVDB / fueleconomy.gov reference.

mcp__9a04470a-c5be-420d-a32b-adaaa7f50b13__web_fetch_exa
  url: <chosen url>
```

Apply the confidence rule from `LOW_NEXT.md`:

- **High** → OEM Canada page or spec PDF says it explicitly. Set
  `hasHeatPump: true` (or `false`), `confidence: "High"`, `source: <url>`,
  `accessed: "2026-05-02"`, `notes` if anything caveat-worthy.
- **Medium** → third-party aggregator (EV Database, EV-database, EV.com).
  Set fields with `confidence: "Medium"`.
- **Low** → forum / review / unsourced. Per project rule: leave
  `hasHeatPump: null`, set `notes: "ambiguous, low-confidence sources only"`.
  Do **not** flip `null → false` on absence-of-evidence.

**Mom-mode caveat.** Heat-pump info on Canadian Hyundai/Kia trims is
inconsistent — Hyundai/Kia bundle heat pumps with the Cold Weather
Package on most Ioniq trims, while EV6/EV9 standardize differently per
year. Treat each row independently. Don't extrapolate from sibling trim.

**Per-row research log.** For each row, write 2–4 lines to
`docs/handoff/research/M9_heatpump_2026-05-02.md`:

```markdown
### EV6 2025 Light RWD
- Query: "2025 Kia EV6 Light RWD Canada heat pump standard"
- Source: https://www.kia.ca/...
- Finding: heat pump is part of "Cold Weather Package"; Light trim has it
  standard for 2025 MY in Canada.
- hasHeatPump: true (High)
```

**After all 20 rows filled, run merge.**

```bash
cd ~/ev-auto-trader-canada
python3 scripts/merge_heatpump_research.py
# Expect: "merged: <N>, skipped: <M> (still null)"
```

**Verification.**
- `jq '[.[] | select(.confidence != null)] | length' data/heatpump-research-queue.json`
  reports the count of researched rows (≥15/20 desired; rest can stay null).
- `jq '.[0].hasHeatPump' data/specs.json` shows the merged value (key may
  be "hasHeatPump" or absent).
- `npm run predeploy` clean.

**Edge cases.**
- Hyundai N (Ioniq5 N): performance trim, may differ from civilian Limited.
  Search query should include "N" verbatim, not normalize to "Limited".
- Ioniq9 Performance Calligraphy AWD: 2026 MY, brand-new model — Exa may
  return broken or staged URLs. If 0 OEM hits, leave null + notes.
- 2026 trims (Ioniq5, Ioniq9) where 2026 spec sheets are still rolling
  out: prefer 2026 page if found; else 2025 spec is acceptable evidence
  with `notes: "2025 spec carried forward — verify post-launch"`.

**Estimate.** 30–60 min wall, ~40 Exa calls (≪ $1).

**Commit.**

```bash
git add data/heatpump-research-queue.json data/specs.json docs/handoff/research/M9_heatpump_2026-05-02.md
git commit -m "data(M9): heatpump queue filled (15-20 rows) + specs merged"
git push origin claude/verify-environment-setup-oTu3S
```

UI chip wire-up is a separate later task (`MEDIUM_NEXT.md` M7); leave for
medium reasoning after M4/M6 land.

---

### M2 [HIGH] — Apify ON+H/K sample (paid; ask first)

**Goal.** Tiny first run to confirm actor output shape + cost/page. Stay
well under $5 cumulative for the sample.

**Approval rule.** Apify is pre-approved up to $30 cumulative, but the
Mission says "ask before first run" — post a one-line message in chat:

> "About to run Apify actor `calm_builder/autotrader-canada` for ON+H/K
> sample (1 page per (province × make × model) ≈ 6 pages, ~$0.05–$0.10).
> Confirm to proceed."

**Files touched:**
- `docs/handoff/research/M2_sample_2026-05-02.json` (NEW; raw dataset)
- `docs/handoff/research/M2_findings_2026-05-02.md` (NEW; field shape + decision)
- (Conditional, only if shape OK) `data/units-enrichment.json` (overlay merge later)

**Sample input.** Six startUrls only (1 page each):

```json
{
  "startUrls": [
    { "url": "https://www.autotrader.ca/cars/hyundai/ioniq+5/on/?rcp=20&rcs=0" },
    { "url": "https://www.autotrader.ca/cars/hyundai/ioniq+6/on/?rcp=20&rcs=0" },
    { "url": "https://www.autotrader.ca/cars/hyundai/ioniq+9/on/?rcp=20&rcs=0" },
    { "url": "https://www.autotrader.ca/cars/kia/ev6/on/?rcp=20&rcs=0" },
    { "url": "https://www.autotrader.ca/cars/kia/ev9/on/?rcp=20&rcs=0" },
    { "url": "https://www.autotrader.ca/cars/kia/niro+ev/on/?rcp=20&rcs=0" }
  ],
  "maxListings": 20,
  "fetchDetails": true,
  "scrapeNewListings": false
}
```

**Steps.**

```
# 1. Trigger
mcp__Apify__call-actor
  actorId: calm_builder/autotrader-canada
  input: <above JSON>

# 2. Poll
mcp__Apify__get-actor-run
  runId: <returned id>
# Wait until status === SUCCEEDED.

# 3. Pull dataset
mcp__Apify__get-actor-output
  runId: <id>
  → write to docs/handoff/research/M2_sample_2026-05-02.json

# 4. Inspect shape
jq '.[0] | keys' docs/handoff/research/M2_sample_2026-05-02.json
jq '.[0].daysOnMarket // .[0].daysOnLot // .[0].listingDays' docs/handoff/research/M2_sample_2026-05-02.json
jq '[.[] | .vin // empty] | length' docs/handoff/research/M2_sample_2026-05-02.json
```

**Throttling.** Per the Mission overrides, throttle 3-5s/page + 30s gap
between provinces. The sample above is single-province (ON), so the
30s gap rule doesn't apply yet.

**Document findings.** Write `docs/handoff/research/M2_findings_2026-05-02.md`:

```markdown
# M2 Apify ON+H/K sample — findings (2026-05-02)

## Run metadata
- runId: <id>
- Cost: $<from get-actor-run.usage>
- Listings returned: <N>

## Field-shape verification
- daysOnMarket present: <yes/no>
- vin present: <yes/no>
- dealerPhone present: <yes/no>
- Other unexpected fields: <list>

## Decision
- <Path-(a) free SSR scraper for primary fields + Apify only for daysOnMarket>
- <Path-(b) full Apify if cost permits + we want VIN + colors>

## Estimate to scale
Full ON sweep ≈ <N pages × $0.0005 list + N × 20 × $0.001 detail = $X>.
Within $30 cap: yes/no.
```

**Verification.**
- Sample JSON > 0 listings per make/model URL.
- Spend tally posted to chat.

**Edge cases.**
- Imperva-on-actor: Apify hides this; if SUCCEEDED-but-empty, retry once.
- Cost over $5 on the small sample: halt + ask. Sample is supposed to be
  a probe, not a real refresh.

**Estimate.** 10 min wall + actor wait time (~5 min).

**Commit.**

```bash
git add docs/handoff/research/M2_*
git commit -m "docs(M2): apify ON+H/K sample run — daysOnMarket <FOUND|MISSING>"
git push origin claude/verify-environment-setup-oTu3S
```

---

### M12 [HIGH] — OEM MSRP refresh

**Goal.** Refresh `data/oem-pricing.json.lastVerified` per trim; catch any
new mid-year trims; flag `staleSince` for trims OEM no longer lists.

**Files touched:**
- `data/oem-pricing.json` (in-place)
- `scripts/refresh_oem_pricing.py` (NEW; or run interactively first)
- `docs/handoff/research/M12_msrp_2026-05-02.md` (NEW; per-trim research log)

**Current state.** `data/oem-pricing.json` has hand-curated entries for:
- EV6 (5 trims)
- Ioniq5 (multiple)
- EV9 (4 trims)
- Ioniq9 (2026 entries)

`lastVerified: "2026-05-01"` envelope. Goal: bump to 2026-05-02 per trim
verified, add new trims, add `staleSince` per trim missing from OEM page.

**Steps.**

```
# Per (make, model) pair, fire one Exa search + one fetch. 5 pairs total
# (Hyundai: Ioniq5, Ioniq6, Ioniq9. Kia: EV6, EV9, Niro EV).

mcp__9a04470a-c5be-420d-a32b-adaaa7f50b13__web_search_exa
  query: "2025 Hyundai Ioniq 5 Canada MSRP trim prices configurator"
  numResults: 5

mcp__9a04470a-c5be-420d-a32b-adaaa7f50b13__web_fetch_exa
  url: https://www.hyundaicanada.com/en/showroom/ioniq-5
```

**Per-trim diff and write.** For each trim:

| Found in current JSON? | Found on OEM page? | Action                                                              |
|------------------------|--------------------|---------------------------------------------------------------------|
| Yes                    | Yes, same price    | Bump `lastVerified` only                                            |
| Yes                    | Yes, new price     | Update `msrp[<model>][<trim>]`; bump `lastVerified`; log delta      |
| Yes                    | No                 | Set `staleSince: "2026-05-02"` on the trim; keep value              |
| No                     | Yes                | Add new entry; set `lastVerified: "2026-05-02"`                     |
| No                     | No                 | (skip — not in catalog)                                             |

**Schema reminder.** The current `oem-pricing.json` uses
`{ lastVerified, source, notes, msrp: { <Model>: { <Trim>: <price> } } }`.
The `staleSince` flag must be added at the trim level. Easiest shape:

```json
"msrp": {
  "Ioniq5": {
    "Preferred RWD Long Range": { "value": 51999, "lastVerified": "2026-05-02", "source": "https://...", "staleSince": null },
    ...
  }
}
```

**TS impact of schema change. DECISION: Option B — nested per-trim object.**

`scripts/build_units_from_at.py:180-184` currently reads
`oem-pricing.json` as `msrp: { Model: { Trim: number } }` to build the
DEFAULT_MSRP table. Migrate to the nested form below, then update the
build script to read `entry.value`. Cleaner final shape, ~5 LoC change in
the build script + retest.

**Final nested shape.**

```json
{
  "lastVerified": "2026-05-02",
  "source": "Hand-curated; per-trim refresh via OEM Canada showroom pages",
  "notes": "...",
  "msrp": {
    "Ioniq5": {
      "Preferred RWD Long Range": {
        "value": 51999,
        "lastVerified": "2026-05-02",
        "source": "https://www.hyundaicanada.com/en/showroom/ioniq-5",
        "staleSince": null
      },
      "Limited AWD": {
        "value": 58999,
        "lastVerified": "2026-05-02",
        "source": "https://www.hyundaicanada.com/en/showroom/ioniq-5",
        "staleSince": null
      }
    },
    "EV6": { "...": "same shape" }
  }
}
```

**Build-script patch (`scripts/build_units_from_at.py:180-184`).**

```python
# BEFORE (rough — verify exact shape on read)
DEFAULT_MSRP = oem["msrp"]              # { Model: { Trim: int } }
...
msrp = DEFAULT_MSRP[model][trim]

# AFTER
DEFAULT_MSRP_RAW = oem["msrp"]          # { Model: { Trim: { value, lastVerified, ... } } }
DEFAULT_MSRP = {
    model: {trim: entry["value"] for trim, entry in trims.items()}
    for model, trims in DEFAULT_MSRP_RAW.items()
}
# Caller code unchanged — still does DEFAULT_MSRP[model][trim] -> int.
```

This keeps the build script's downstream code untouched (DEFAULT_MSRP is
still `{ Model: { Trim: int } }` after the comprehension) — only the
loader at the top changes. Re-run `python3 scripts/build_units_from_at.py`
after the schema migration to confirm `data/units.json` regenerates with
identical msrp values.

**Per-trim research log.** Write `docs/handoff/research/M12_msrp_2026-05-02.md`:

```markdown
# M12 OEM MSRP refresh — log (2026-05-02)

## Hyundai Ioniq 5 (https://www.hyundaicanada.com/en/showroom/ioniq-5)
- Preferred RWD Long Range: $51,999 (was $51,999) — unchanged ✓
- Preferred AWD Long Range: $54,999 (was $54,999) — unchanged ✓
- Limited AWD: $58,999 (was $58,999) — unchanged ✓
- N: $74,999 (NEW — added 2026-05-02)

## Hyundai Ioniq 6
- ...

## Kia EV6
- ...

## Stale trims (couldn't resolve via Exa)
- <model> <trim> — staleSince 2026-05-02 (Exa returned <reason>; needs Chrome MCP fallback)
```

**Chrome MCP fallback for ambiguous trims.** When Exa fetch returns
malformed text (table inside JS, dynamic price ranges) or a trim doesn't
appear on the showroom page:

```
mcp__Claude_in_Chrome__navigate
  tabId: <X>
  url: https://www.hyundaicanada.com/en/showroom/ioniq-5/configurator

mcp__Claude_in_Chrome__find
  tabId: <X>
  query: "trim selector or price summary block"

mcp__Claude_in_Chrome__get_page_text
  tabId: <X>
```

Manually walk the configurator UI, capture trim/price; record in the log.

**Verification.**
- `jq '.lastVerified' data/oem-pricing.json` reports `"2026-05-02"`.
- `jq '[.msrp | to_entries[] | .value | to_entries[] | .value | select(.lastVerified == "2026-05-02")] | length' data/oem-pricing.json`
  reports ≥ 90% of trims.
- `jq '[.msrp | to_entries[] | .value | to_entries[] | .value | select(.staleSince != null)]' data/oem-pricing.json`
  is small (≤ 10% of trims).
- `python3 scripts/build_units_from_at.py` regenerates `data/units.json`
  with msrp values matching pre-migration (sanity diff: `git diff data/units.json`
  should show only price changes that actually came from OEM updates).
- `npm run predeploy` clean.

**Estimate.** 30–60 min wall, ≈10 Exa calls + 2-3 Chrome fallback walks.

**Commit.**

```bash
git add data/oem-pricing.json docs/handoff/research/M12_msrp_2026-05-02.md
git commit -m "data(M12): oem msrp refresh — 5 models verified; <N> staleSince flags"
git push origin claude/verify-environment-setup-oTu3S
```

---

### M4 [HIGH] — Cookie migration cutover

**Goal.** Thread `BuyerContext` through 4 routes → `loadScoredUnits` →
`applicableIncentives`. No behaviour change at first (loyalty + conquest
default to false).

**Verified call-site map (planner ran two parallel grep agents):**

| Symbol                   | File:line                                            | Action                                       |
|--------------------------|------------------------------------------------------|----------------------------------------------|
| `getBuyerProvince` import | `src/app/page.tsx:3`                                | replace                                      |
| `getBuyerProvince` call   | `src/app/page.tsx:16`                               | replace                                      |
| `getBuyerProvince` import | `src/app/inventory/page.tsx:3`                      | replace                                      |
| `getBuyerProvince` call   | `src/app/inventory/page.tsx:10`                     | replace                                      |
| `getBuyerProvince` import | `src/app/dealer/[id]/page.tsx:5`                    | replace                                      |
| `getBuyerProvince` call   | `src/app/dealer/[id]/page.tsx:19`                   | replace                                      |
| `getBuyerProvince` import | `src/app/compare/page.tsx:2`                        | replace                                      |
| `getBuyerProvince` call   | `src/app/compare/page.tsx:8`                        | replace                                      |
| `loadScoredUnits` decl    | `src/lib/data.ts:253-258`                           | widen signature                              |
| `applicableIncentives` decl | `src/lib/scoring.ts:204-209`                       | already accepts `buyerContext` ✓              |
| `applicableIncentives` call | `src/lib/data.ts:278`                             | pass `buyerContext` arg                      |
| `loadScoredUnits` callers | `src/app/page.tsx:17`, `inventory/page.tsx:12`, `dealer/[id]/page.tsx:20`, `compare/page.tsx:10`, `map/page.tsx:8` (no arg), `intel/page.tsx:12` (no arg), `inventory/[id]/dossier/page.tsx:39` (already migrated)         | thread context                               |
| `buyerProvinceServer.ts`  | (whole file)                                        | DELETE — no shim                             |
| `buyerProvince` JSX render| `src/app/page.tsx:81`                               | render `buyerContext.province` instead        |

**Files touched:**
- DELETE `src/lib/buyerProvinceServer.ts`
- MODIFY `src/lib/data.ts:253-296`
- MODIFY `src/app/page.tsx:3, 16-17, 81`
- MODIFY `src/app/inventory/page.tsx:3, 10, 12`
- MODIFY `src/app/dealer/[id]/page.tsx:5, 19, 20`
- MODIFY `src/app/compare/page.tsx:2, 8, 10`

**Diff sketches.**

`src/lib/data.ts` — widen `loadScoredUnits`:

```typescript
// BEFORE (lines 253-296):
export async function loadScoredUnits(buyerProvince?: import("./constants").Province): Promise<{
  units: ScoredUnit[];
  dealers: Dealer[];
  dealerById: Map<string, Dealer>;
  incentives: Incentive[];
  buyerProvince: import("./constants").Province | null;
}> {
  ...
  const applicable = applicableIncentives(unit, dealer, incentives);
  const otdBreakdown = computeOtd(unit, dealer, applicable, buyerProvince);
  ...
  return { units: scored, dealers, dealerById, incentives, buyerProvince: buyerProvince ?? null };
}

// AFTER:
export async function loadScoredUnits(
  buyerContext?: import("./types").BuyerContext,
): Promise<{
  units: ScoredUnit[];
  dealers: Dealer[];
  dealerById: Map<string, Dealer>;
  incentives: Incentive[];
  buyerContext: import("./types").BuyerContext | null;
  buyerProvince: import("./constants").Province | null;  // back-compat alias
}> {
  ...
  const applicable = applicableIncentives(unit, dealer, incentives, buyerContext);
  const otdBreakdown = computeOtd(unit, dealer, applicable, buyerContext?.province);
  ...
  return {
    units: scored,
    dealers,
    dealerById,
    incentives,
    buyerContext: buyerContext ?? null,
    buyerProvince: buyerContext?.province ?? null,
  };
}
```

Note: keeping `buyerProvince` on the returned object covers any reader
the planner might have missed (grep confirmed zero direct property reads,
but cheap insurance).

`src/app/page.tsx` — example route migration:

```diff
-import { getBuyerProvince } from "@/lib/buyerProvinceServer";
+import { getBuyerContext } from "@/lib/buyerContextServer";
 ...
-  const buyerProvince = await getBuyerProvince();
-  const { units, dealers, dealerById, incentives } = await loadScoredUnits(buyerProvince);
+  const buyerContext = await getBuyerContext();
+  const { units, dealers, dealerById, incentives } = await loadScoredUnits(buyerContext);
 ...
-          {buyerProvince}
+          {buyerContext.province}
```

Same pattern for the other 3 routes:
- `src/app/inventory/page.tsx` — 1 import line, 1 call, 1 arg replacement
- `src/app/dealer/[id]/page.tsx` — same
- `src/app/compare/page.tsx` — same

`src/app/map/page.tsx` and `src/app/intel/page.tsx` are no-arg callers
of `loadScoredUnits()` — they stay unchanged.

`src/app/inventory/[id]/dossier/page.tsx:25-39` already uses
`getBuyerContext()` and passes `ctx.province` to `loadScoredUnits`. After
the migration, change line 39 to pass `ctx` directly:

```diff
-    loadScoredUnits(ctx.province),
+    loadScoredUnits(ctx),
```

**Steps.**

```bash
cd ~/ev-auto-trader-canada

# 1. Widen signature
$EDITOR src/lib/data.ts             # see diff above

# 2. Migrate the 4 routes
$EDITOR src/app/page.tsx
$EDITOR src/app/inventory/page.tsx
$EDITOR src/app/dealer/[id]/page.tsx
$EDITOR src/app/compare/page.tsx

# 3. Update the dossier route to pass full ctx
$EDITOR src/app/inventory/[id]/dossier/page.tsx

# 4. Delete the legacy server helper
rm src/lib/buyerProvinceServer.ts

# 5. Confirm no remaining import
grep -rn "from \"@/lib/buyerProvinceServer\"" src/
grep -rn "getBuyerProvince\b" src/
# Expect: 0 matches in both.

# 6. Predeploy
npm run predeploy
```

**Verification — score-order regression check.**

```bash
# Capture pre-migration scoreOrder
git stash
npm run dev &      # background
DEV_PID=$!
sleep 4
curl -s http://localhost:3000/inventory > /tmp/before.html
kill $DEV_PID || true
git stash pop

# Capture post-migration
npm run dev &
DEV_PID=$!
sleep 4
curl -s http://localhost:3000/inventory > /tmp/after.html
kill $DEV_PID || true

# Diff the first 20 unit IDs in row order
node -e '
  const fs = require("fs");
  const re = /data-unit-id="([^"]+)"/g;
  const ids = (s) => Array.from(s.matchAll(re)).map(m => m[1]).slice(0, 20);
  const a = ids(fs.readFileSync("/tmp/before.html", "utf8"));
  const b = ids(fs.readFileSync("/tmp/after.html", "utf8"));
  console.log("match:", JSON.stringify(a) === JSON.stringify(b));
'
```

Expected: `match: true` (default cookie has loyalty=false + conquest=false,
so no incentives change → no score change).

**Edge cases.**
- If `data-unit-id` attribute doesn't exist on `InventoryTable.tsx` rows,
  add it temporarily for the regression check, then revert. (Or use
  Playwright + DOM scraping.) Faster: just diff `loadScoredUnits()` JSON
  outputs server-side via a tiny Node script that imports and calls it
  with both shapes.
- If `applicableIncentives()` already accepts `buyerContext` but a few
  legacy callers pass only the 3-arg form (no context), behaviour is
  preserved (the param is optional). Confirmed at `scoring.ts:208`.

**Estimate.** 30–45 min wall, 6–10 turns.

**Commit.**

```bash
git add src/
git commit -m "feat(M4): cookie migration — getBuyerContext threaded through 4 routes; delete buyerProvinceServer"
git push origin claude/verify-environment-setup-oTu3S
```

---

### M6 [MEDIUM] — Selector rename + loyalty/conquest checkboxes

**Goal.** Rename `BuyerProvinceSelector.tsx` → `BuyerContextSelector.tsx`
(no shim) and add the loyalty + conquest checkboxes that drive the new
filter logic.

**Verified call-site map (planner grep):**

| Symbol                                    | File:line                | Action          |
|-------------------------------------------|--------------------------|-----------------|
| `BuyerProvinceSelector` import            | `src/app/layout.tsx:4`   | replace path + name |
| `<BuyerProvinceSelector />` render        | `src/app/layout.tsx:25`  | replace name        |
| `useBuyerProvince` import                 | `src/components/BuyerProvinceSelector.tsx:4` | drop |
| `useBuyerProvince` call                   | `src/components/BuyerProvinceSelector.tsx:11` | drop |
| Component file location                   | `src/components/BuyerProvinceSelector.tsx`   | rename → `BuyerContextSelector.tsx` |
| Existing tests / spec                     | none                     | n/a             |
| Existing `useBuyerContext` callers         | none (zero)              | this becomes the first |

**Files touched:**
- DELETE `src/components/BuyerProvinceSelector.tsx`
- CREATE `src/components/BuyerContextSelector.tsx`
- MODIFY `src/app/layout.tsx:4, 25`

**Optionally delete `src/lib/buyerProvince.ts` (the client hook)** if no
remaining consumer. Quick grep before deletion:

```bash
grep -rn "useBuyerProvince\b" src/
grep -rn "from \"@/lib/buyerProvince\"" src/
```

After M6 lands, both should return 0. If so, delete the file too.

**Component body sketch (`BuyerContextSelector.tsx`).**

```typescript
"use client";

import { PROVINCES, PROVINCE_NAMES, type Province } from "@/lib/constants";
import { useBuyerContext } from "@/lib/buyerContext";

// Lives in the global nav so every page reflects the same buyer context.
// Selecting a different province re-issues the cookie + reloads — server
// components recompute OTD using the new tax basis. Loyalty + conquest
// flags gate Hyundai/Kia loyalty- and conquest-scoped incentives in
// applicableIncentives().
export function BuyerContextSelector() {
  const { buyerContext, setBuyerContext } = useBuyerContext();
  return (
    <div className="flex items-center gap-3 text-xxs text-fg-subtle ml-auto">
      <label className="flex items-center gap-1.5">
        Buying in
        <select
          value={buyerContext.province}
          onChange={(e) => setBuyerContext({ ...buyerContext, province: e.target.value as Province })}
          className="px-1.5 py-0.5 text-xs"
          title="OTD math uses this province's sales tax + adds a transport-cost line for cross-province dealers"
        >
          {PROVINCES.map((p) => (
            <option key={p} value={p}>{PROVINCE_NAMES[p]}</option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1 cursor-pointer" title="Eligible for Hyundai/Kia loyalty cash">
        <input
          type="checkbox"
          checked={buyerContext.loyalty}
          onChange={(e) => setBuyerContext({ ...buyerContext, loyalty: e.target.checked })}
        />
        Owns Hyundai/Kia
      </label>
      <label className="flex items-center gap-1 cursor-pointer" title="Eligible for conquest cash (current owner of Toyota/Honda/Tesla/etc.)">
        <input
          type="checkbox"
          checked={buyerContext.conquest}
          onChange={(e) => setBuyerContext({ ...buyerContext, conquest: e.target.checked })}
        />
        Owns competing
      </label>
    </div>
  );
}
```

**`src/app/layout.tsx` diff:**

```diff
-import { BuyerProvinceSelector } from "@/components/BuyerProvinceSelector";
+import { BuyerContextSelector } from "@/components/BuyerContextSelector";
 ...
-          <BuyerProvinceSelector />
+          <BuyerContextSelector />
```

**Steps.**

```bash
cd ~/ev-auto-trader-canada

# 1. Move + rewrite. Use git mv to preserve history.
git mv src/components/BuyerProvinceSelector.tsx src/components/BuyerContextSelector.tsx
$EDITOR src/components/BuyerContextSelector.tsx          # paste body above

# 2. Update layout
$EDITOR src/app/layout.tsx                                # 2-line edit

# 3. Confirm legacy hook is fully unused
grep -rn "useBuyerProvince\b" src/
grep -rn "from \"@/lib/buyerProvince\"" src/

# 4. (If 0 matches, delete the legacy hook)
rm src/lib/buyerProvince.ts                               # optional cleanup

# 5. Predeploy
npm run predeploy
```

**Verification.**
- `npm run predeploy` clean.
- Manual smoke: `npm run dev`, open http://localhost:3000/, select Quebec
  in the dropdown, see OTD line items recompute (HST → QST + GST). Tick
  "Owns Hyundai/Kia" → after page reload, the applicable-incentive count
  on Ioniq5/EV6 rows ticks up by 1+ if any `scope: "loyalty"` entries
  exist in `data/incentives.json` (M5/M10 work, may be empty until then).
- `git status` shows only the rename + the layout edit + (optional) hook delete.

**Edge cases.**
- The user-facing copy "Owns Hyundai/Kia" / "Owns competing" is short by
  design — the title attribute carries the longer explanation. Keep
  natural English here; don't apply caveman to UI.
- The PROVINCE_NAMES constant must still cover all PROVINCES — verified
  in `src/lib/constants.ts`.
- Tailwind class `text-xxs` exists in the current project (used in the
  legacy file). Don't add a new class unless the build fails on it.

**Estimate.** 15–25 min wall, 3–4 turns.

**Commit.**

```bash
git add src/components/BuyerContextSelector.tsx src/app/layout.tsx
git rm src/components/BuyerProvinceSelector.tsx 2>/dev/null || true
[ -f src/lib/buyerProvince.ts ] || git rm src/lib/buyerProvince.ts
git commit -m "feat(M6): rename selector → BuyerContextSelector + add loyalty/conquest checkboxes"
git push origin claude/verify-environment-setup-oTu3S
```

---

### M3 [MEDIUM] — Snapshot-diff daysOnMarket (CONDITIONAL on M0)

**Skip entirely if M0 found `daysOnMarket` in either GraphQL response.**

**Goal.** Derive `daysOnMarket` per stable unit ID by walking
`data/snapshots/*.json` oldest → newest. This becomes the "free" path
when GraphQL fails and Apify is reserved for last resort.

**Files touched:**
- CREATE `scripts/derive_days_on_market.py`
- MODIFY `scripts/build_units_from_at.py:306-329` (enrichment overlay merge)

**Snapshot inventory verified (planner read disk):**
- `data/snapshots/2025-04-01.json`
- `data/snapshots/2025-04-15.json`
- `data/snapshots/2026-05-01.json`
- `data/snapshots/2026-05-02.json`

Each snapshot is shaped:
```json
{ "takenAt": "2026-05-02T00:29:50.343Z", "unitCount": 100, "units": [{ "id": "u-at-...", ... }, ...] }
```

The 2025 snapshots predate stable IDs and may lack `id` fields or use
positional IDs. Verify before relying on them: any snapshot whose
`units[*].id` doesn't match `^u-at-[0-9a-f]{8}$` is treated as a
pre-stable snapshot and ignored.

**Algorithm.**

```python
#!/usr/bin/env python3
"""Derive daysOnLot per stable unit ID from data/snapshots/."""
from __future__ import annotations
import json, os, re, sys, datetime as dt
from pathlib import Path

SNAP_DIR = Path("data/snapshots")
ENRICHMENT = Path("data/units-enrichment.json")
ID_RE = re.compile(r"^u-at-[0-9a-f]{8}$")

def load_snapshot(p: Path) -> dict:
    return json.loads(p.read_text(encoding="utf-8"))

def main() -> int:
    files = sorted(SNAP_DIR.glob("*.json"), key=lambda p: p.name)
    if not files:
        print("no snapshots", file=sys.stderr); return 1

    first_seen: dict[str, dt.date] = {}
    for f in files:
        snap = load_snapshot(f)
        # Date key: prefer takenAt; fall back to filename.
        try:
            taken = dt.datetime.fromisoformat(snap["takenAt"].replace("Z", "+00:00")).date()
        except Exception:
            taken = dt.date.fromisoformat(f.stem)

        for unit in snap.get("units", []):
            uid = unit.get("id")
            if not uid or not ID_RE.match(uid):
                continue
            first_seen.setdefault(uid, taken)  # earliest wins

    today = dt.date.today()
    enrichment = json.loads(ENRICHMENT.read_text()) if ENRICHMENT.exists() else {}
    merged = 0
    for uid, fs_date in first_seen.items():
        days = (today - fs_date).days
        entry = enrichment.setdefault(uid, {})
        entry["daysOnLot"] = days
        entry["daysOnLotSource"] = "snapshot-diff"
        entry["daysOnLotFirstSeen"] = fs_date.isoformat()
        merged += 1

    ENRICHMENT.write_text(json.dumps(enrichment, indent=2, sort_keys=True))
    print(f"merged daysOnLot for {merged} units")
    return 0

if __name__ == "__main__":
    sys.exit(main())
```

**Wire into the existing enrichment overlay.** `build_units_from_at.py`
already consumes `data/units-enrichment.json` (lines 306–329 per the
explore agent's report). The snapshot-diff script writes into the same
file with the same key (stable ID) → free pickup, no `build_units_from_at.py`
changes required.

**Steps.**

```bash
cd ~/ev-auto-trader-canada

$EDITOR scripts/derive_days_on_market.py    # paste algorithm above
chmod +x scripts/derive_days_on_market.py

python3 scripts/derive_days_on_market.py
# Expect: "merged daysOnLot for <N> units" (N = unique stable IDs across
# valid snapshots).

python3 scripts/build_units_from_at.py
# Expect: data/units.json regenerated; daysOnLot now populated where
# enrichment overlay had it.

npm run predeploy
```

**Verification.**
- `jq '[.[] | select(.daysOnLot != null)] | length' data/units.json`
  reports a number > 0. With only 2 fresh snapshots (2026-05-01 and
  2026-05-02) the signal is 1 day for almost every unit; full per-unit
  history takes 7+ days of cron runs.
- `jq '.daysOnLotSource' data/units-enrichment.json | head` shows
  `"snapshot-diff"` for every entry the script wrote.

**Caveat — sparse history.** With only 4 snapshots (2 historical, 2
recent), the first useful per-unit `daysOnLot` is 1 day. The cron from
M11 fixes this going forward. Acceptable trade-off given GraphQL/Apify
are the only alternatives.

**Edge cases.**
- A unit appearing only in the most recent snapshot returns
  `daysOnLot = 0` — that's correct; "first seen today, today, so 0 days".
- Units that disappeared between snapshots (sold) and reappear later
  (relisted): the algorithm credits the earliest sighting. This
  overstates `daysOnLot` for relistings. Mitigation: only count
  consecutive snapshots, but adds complexity. Defer until 7+ days of
  history exposes a real case.
- Pre-stable-ID snapshots (2025-04-*) get filtered by the regex and
  contribute nothing.

**Estimate.** 30–45 min wall.

**Commit.**

```bash
git add scripts/derive_days_on_market.py data/units-enrichment.json data/units.json
git commit -m "feat(M3): derive daysOnLot from snapshot diff (stable-ID first-seen)"
git push origin claude/verify-environment-setup-oTu3S
```

---

### M10 Phase A [HIGH] — Leasebusters probe doc

**Goal.** Write a complete `docs/LEASEBUSTERS_PROBE.md` mirroring the
shape of `docs/CHROME_PROBE.md`. **Pause** before Phase B (scraper) or
Phase C (UI). User wants a go-ahead checkpoint here.

**Files touched:**
- CREATE `docs/LEASEBUSTERS_PROBE.md`

**Document outline.**

```markdown
# Chrome MCP — Leasebusters listing probe

**Goal.** Add Leasebusters as a second listing source for Hyundai/Kia EVs
in Canada. Leasebusters is a lease-takeover marketplace — many of the
listings are 24–48-month-remaining leases on like-new vehicles, often
priced below buy-out value. Distinct VIN universe vs AutoTrader.

**Status.** Probe only. After this doc lands, pause for user go-ahead
before writing the scraper (Phase B) or wiring the UI (Phase C).

## Prereqs
- Claude-in-Chrome extension connected
- A clean Chrome profile (no Leasebusters cookie / login state required)
- The site is `https://www.leasebusters.com/`

## Runbook

### Step 1 — Open the listings index for Hyundai/Kia EVs

Two viable URLs:
- Search by make: https://www.leasebusters.com/Vehicles?makes=Hyundai
- Search by EV-only filter: https://www.leasebusters.com/Vehicles?fuel=Electric
- Combined: https://www.leasebusters.com/Vehicles?makes=Hyundai,Kia&fuel=Electric

Probe each; note the canonical-URL pattern + querystring shape.

### Step 2 — Capture network traffic

Same fetch+XHR hook from CHROME_PROBE.md. Look for:
- JSON XHR returning a `listings` / `vehicles` array
- A "load more" or pagination call

### Step 3 — Per-listing detail
For one listing URL, visit the detail page. Inspect what's exposed:
- VIN
- Current monthly payment
- Months remaining
- Buyout value
- Mileage allowance / overage rate
- Vehicle make/model/year/trim
- Province / city
- Original lease term + start date

VIN is the primary dedupe key vs AutoTrader.

### Step 4 — Decision matrix

| Probe outcome                                           | Phase B path                                |
|---------------------------------------------------------|---------------------------------------------|
| JSON XHR endpoint returns full listing array            | Free scraper analogous to scrape_search_json.py |
| SSR HTML with embedded JSON (`__NEXT_DATA__` or similar) | Free regex+JSON scraper                     |
| SSR HTML, no embedded JSON                              | BeautifulSoup parser per listing            |
| Cloudflare / Imperva / bot-detection wall               | Apify? Or skip — Leasebusters is optional   |

### Step 5 — Schema impact (Phase C preview)

`InventoryUnit` already carries `dealerId` + `listingUrl`. To support
Leasebusters:
- Add `source: "autotrader" | "leasebusters"` to InventoryUnit Zod schema
- Add stable ID prefix `u-lb-<8hex>` (separate hash namespace from `u-at-`)
- VIN-based dedupe in the merge step

UI: small source chip on each row + filter toggle in /inventory.

## Non-goals (for this probe)
- Don't write the scraper yet
- Don't modify InventoryUnit schema yet
- Don't add UI elements yet

## Open questions for user (post probe, pre Phase B)

1. Are lease-takeover entries valuable? (Cash buyer.)
2. Should buyout values appear as "asking price" or as a separate line?
3. Is the months-remaining + overage allowance enough info, or do we
   want to refuse to render anything that's not a clean buy?
```

**Steps.**

```bash
cd ~/ev-auto-trader-canada
$EDITOR docs/LEASEBUSTERS_PROBE.md     # paste the above
```

Live probing the site is **out of scope for Phase A** per the project
override. The medium session writes the runbook; the actual probe runs
post-go-ahead in a future Phase A.5 session. (User explicitly wanted
this doc-only checkpoint to size the work before committing time.)

**Verification.**
- File exists, lints as Markdown.
- `npm run predeploy` clean (docs only — no TS impact).

**Estimate.** 15–25 min wall, 1–2 turns.

**Commit.**

```bash
git add docs/LEASEBUSTERS_PROBE.md
git commit -m "docs(M10A): leasebusters probe runbook — pause for Phase B/C go-ahead"
git push origin claude/verify-environment-setup-oTu3S
```

**Then post in chat:** "M10 Phase A done — `docs/LEASEBUSTERS_PROBE.md`
shipped. Pausing on Phase B (scraper) and Phase C (UI) per project
override. Continue?"

---

### M11 [MEDIUM] — Daily refresh cron + simple-git-hooks

**Goal.** OS-level cron via `mcp__scheduled-tasks__create_scheduled_task`
(NOT CronCreate — session-only). Plus `simple-git-hooks` typecheck-only
pre-commit (3-5s).

**Files touched:**
- CREATE `scripts/refresh_daily.sh`
- MODIFY `package.json` (add simple-git-hooks dev dep + `prepare` script
  + `simple-git-hooks` config block)
- (After `npm install`) auto-installs `.git/hooks/pre-commit`
- Schedule a job in the OS-level scheduler (visible via
  `scheduled-tasks__list_scheduled_tasks`)

**Steps.**

#### Part A — `scripts/refresh_daily.sh`

```bash
#!/usr/bin/env bash
# Daily refresh: pull, re-scrape, snapshot, predeploy, commit, push.
# Triggered by mcp__scheduled-tasks at 11:00 UTC = 7am ET DST.
set -euo pipefail

cd ~/ev-auto-trader-canada
git pull --rebase origin main || { echo "pull failed"; exit 1; }

# Free SSR scrape (assumes M2 ships scrape_search_json.py; until then,
# the existing build path runs without new data — leave Apify out of cron
# entirely).
[ -x scripts/scrape_search_json.py ] && python3 scripts/scrape_search_json.py
python3 scripts/build_units_from_at.py

# Snapshot-diff daysOnMarket (M3) — only if the script exists
[ -x scripts/derive_days_on_market.py ] && python3 scripts/derive_days_on_market.py

# Daily snapshot
node scripts/snapshot.mjs

# Gate
npm run predeploy

# Commit if there's a delta
if ! git diff --quiet data/; then
  git add data/
  git commit -m "data refresh: $(date -u +%F)"
  git push origin main
fi
```

```bash
cd ~/ev-auto-trader-canada
$EDITOR scripts/refresh_daily.sh
chmod +x scripts/refresh_daily.sh
```

#### Part B — `simple-git-hooks` adoption

`package.json` patch:

```json
{
  "scripts": {
    "...": "...",
    "prepare": "simple-git-hooks"
  },
  "simple-git-hooks": {
    "pre-commit": "npx tsc --noEmit"
  },
  "devDependencies": {
    "...": "...",
    "simple-git-hooks": "^2.11.1"
  }
}
```

```bash
npm install --save-dev simple-git-hooks
# `prepare` script auto-runs simple-git-hooks at the end of install,
# wiring .git/hooks/pre-commit. If it doesn't, run:
npx simple-git-hooks
```

**Verify the hook:**

```bash
# Plant a deliberate type error
echo "const x: number = 'oops';" >> src/lib/data.ts
git add src/lib/data.ts
git commit -m "test"
# Expect: hook fails, commit blocked.

# Revert
git restore --staged src/lib/data.ts
git restore src/lib/data.ts
```

#### Part C — register the cron

```
mcp__scheduled-tasks__create_scheduled_task
  schedule: "0 11 * * *"
  command: bash ~/ev-auto-trader-canada/scripts/refresh_daily.sh
  description: "EV Auto Trader Canada — daily AutoTrader refresh + snapshot + Vercel deploy"
```

Why 11 UTC = 7am ET DST. Adjust seasonally if Ian wants 7am ET year-round.

**Verification.**

```
mcp__scheduled-tasks__list_scheduled_tasks
# Expect: at least one task with the description above + schedule "0 11 * * *".

# Manual fire of the script body
bash ~/ev-auto-trader-canada/scripts/refresh_daily.sh
# Expect: clean exit. May or may not commit (depends on whether data changed).
```

**Edge cases.**
- macOS `crontab -l` won't show this — the scheduled-tasks MCP uses its
  own backend (launchd or similar). The MCP `list` call is the source
  of truth.
- The `prepare` script may fail under `--ignore-scripts`. Always run
  `npm install` (no flags) for this project.
- `simple-git-hooks` overwrites any existing `.git/hooks/pre-commit`.
  Repo currently has no hooks — confirmed by `ls .git/hooks/` showing
  only `*.sample` files.

**Estimate.** 20–30 min wall.

**Commit.**

```bash
git add scripts/refresh_daily.sh package.json package-lock.json
git commit -m "chore(M11): daily refresh cron + simple-git-hooks typecheck pre-commit"
git push origin claude/verify-environment-setup-oTu3S
```

---

## 6. Verification gate (every milestone)

After each commit:

```bash
cd ~/ev-auto-trader-canada
npm run predeploy           # tsc --noEmit + next build
git status                  # working tree clean
git log -1 --pretty=oneline  # confirm caveman-style message
```

If predeploy fails:
1. Run `npm run typecheck` first — narrower error.
2. If next build fails, look for unused imports (TS strict catches),
   missing JSON keys (Zod parse fails at module load), or stale
   `.next/` cache (`rm -rf .next` and retry).
3. Three consecutive predeploy failures → halt + post in chat.

---

## 7. Risks & rollback

| Risk                                                            | Mitigation                                                                                                      |
|-----------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------|
| Imperva blocks the M0 probe                                     | Note in findings; skip to M3 / Apify path. M2 sample run will reveal whether AutoTrader actor goes through.    |
| Apify cost overrun on M2 sample                                  | Cap = $5 for sample; abort if `mcp__Apify__get-actor-run.usage` exceeds.                                        |
| M4 cookie migration breaks score order on existing units        | Pre/post HTML diff verifies. Revert by `git revert <sha>` if mismatch — no schema change so safe to back out.   |
| `simple-git-hooks` fails to install on Mac (Node version drift) | Pin to ^2.11. Worst case: skip Part B — cron-only enforcement still keeps prod safe.                            |
| Scheduled task fires on a day Ian's Mac is asleep                | Catches up on next wake. No idempotency issue: snapshot.mjs overwrites same-day; refresh_daily.sh diffs first.  |
| M9 Exa hits rate-limit                                          | 40 calls is far below limit. If 429s appear, sleep 2s between calls.                                            |
| M12 OEM page changes shape post-probe                            | Per-trim `staleSince` flag preserves last-known value; UI chip surfaces the gap.                                |

---

## 8. Plan-mode constraints — execution handoff

The planning session was constrained by `ApprovalPolicy=plan`. After
ExitPlanMode + user approval, the rest of *this* session continues at
extra-high → high → medium reasoning per §1's tier-down strategy.

**Plan file lives in two places (per user direction):**
1. `/Users/ianmcadam/.claude/plans/you-are-the-planning-floating-breeze.md` (Mac-local original)
2. `~/ev-auto-trader-canada/docs/handoff/EXECUTION_PLAN_2026-05-02.md` (committed copy)

The committed copy is the source of truth across sessions. Bootstrap
step after ExitPlanMode is to copy + commit + push so future sessions
read the repo, not the planner.

If this session runs out of budget before M0–M12 + M13 land, write
`~/ev-auto-trader-canada/docs/handoff/EXECUTION_KICKOFF_<date>.md` with
the paste-ready prompt for the next session — same shape as §9 below.

---

## 9. EXECUTION_KICKOFF — paste-ready prompt for the medium session

> Paste the block below into a fresh Claude Code session in
> `~/ev-auto-trader-canada` running on **medium** reasoning. The session
> reads this plan, copies it to `docs/handoff/EXECUTION_PLAN_2026-05-02.md`,
> and executes M0–M12 strictly in the order in §4.

```text
You are the medium-reasoning execution session for EV Auto Trader Canada,
running locally on Ian's Mac in Claude Code at ~/ev-auto-trader-canada.

## Bootstrap

1. cd ~/ev-auto-trader-canada
2. git fetch --all --prune && git pull --ff-only
   - Branch must be claude/verify-environment-setup-oTu3S; HEAD ≥ cd95a99.
3. npm install && npm run predeploy   (typecheck + next build, ~30s)
4. List MCPs in chat. Confirm: Chrome (mcp__Claude_in_Chrome__*), Apify
   (mcp__Apify__*), scheduled-tasks (mcp__scheduled-tasks__*), Exa
   (mcp__9a04470a__*). Note any missing.

## Plan source of truth

The full execution plan lives at
/Users/ianmcadam/.claude/plans/you-are-the-planning-floating-breeze.md.

First action: copy that file's body to
docs/handoff/EXECUTION_PLAN_2026-05-02.md in the repo (Read it, Write it).
Don't edit the body during the copy. Then commit:

  git add docs/handoff/EXECUTION_PLAN_2026-05-02.md
  git commit -m "docs(plan): import M0-M12 execution plan from local planner"
  git push origin claude/verify-environment-setup-oTu3S

## Execution order (strict)

1. M0 [HIGH] — Chrome MCP GraphQL probe (§5/M0). Outcome decides M3.
2. M9 [LOW] — Exa heatpump fill (§5/M9). 20 rows. Run while M2 awaits approval.
3. M2 [HIGH] — Apify ON+H/K sample (§5/M2). Ask first. Cap $5 for sample.
4. M12 [HIGH] — OEM MSRP refresh via Exa (§5/M12). Chrome fallback per ambiguous trim.
5. M4 [HIGH] — Cookie migration (§5/M4). 4 routes + delete buyerProvinceServer.ts.
6. M6 [MEDIUM] — Selector rename + checkboxes (§5/M6).
7. M3 [MEDIUM] — Snapshot-diff daysOnMarket (§5/M3) — ONLY if M0 unusable.
8. M10 Phase A [HIGH] — Leasebusters probe doc (§5/M10A). PAUSE for go-ahead.
9. M11 [MEDIUM] — scheduled-tasks cron + simple-git-hooks (§5/M11).

## Rules

- Branch: claude/verify-environment-setup-oTu3S. Never push to main.
- Predeploy gate before every push. Never --no-verify, never amend, never force.
- Apify spend ≤ $30 cumulative. Tell me before first paid run.
- Touch only ~/ev-auto-trader-canada. Never cd into ~/Documents/Claude/Projects/EV dashboard.
- TodoWrite live, exactly one in_progress.
- Caveman mode internal — drop articles/filler. UI copy stays English.
- Force /compact at 250k context.
- Stop conditions: 3 consecutive predeploy failures, Vercel deploy broken
  twice in a row, about to write outside ~/ev-auto-trader-canada, about
  to spend Apify > $30.
- Schema changes that invalidate existing snapshots beyond stable-ID
  migration: stop and ask.

## First chat post

"Execution session live, HEAD = <sha>, MCPs available: <list>. Plan
imported to docs/handoff/EXECUTION_PLAN_2026-05-02.md. Starting M0."

Then build a TodoWrite with the 9 items above and start.
```

---

## 10. Known gotchas the medium session should remember

- **`tsconfig.json` does NOT explicitly set `noUnusedLocals` or
  `noUnusedParameters`** (planner verified). The "unused imports fail
  builds" risk in older docs assumed those were on. They're not. Don't
  surprised by tolerated unused imports — but `next build` may still
  flag them via the eslint-config-next rules.
- **The heatpump-research-queue is 20 rows, all `null`** (planner
  verified — earlier explore-agent summary mis-reported "20 true").
  M9 fills them all from scratch.
- **`applicableIncentives` already accepts `buyerContext?`** (planner
  verified at `src/lib/scoring.ts:208`). M4 only needs to *pass* it,
  not change the signature.
- **`src/app/inventory/[id]/dossier/page.tsx:39` already calls
  `loadScoredUnits(ctx.province)`**. After M4 widens the signature to
  accept `BuyerContext`, change that line to `loadScoredUnits(ctx)`.
- **`src/app/map/page.tsx` and `src/app/intel/page.tsx`** call
  `loadScoredUnits()` with no arg. Leave alone.
- **`buyerProvince` is rendered in JSX at `src/app/page.tsx:81`**.
  After M4, render `buyerContext.province` (or just keep emitting the
  back-compat `buyerProvince` field from the return object — both work).
- **Snapshot pre-stable-ID files** (`2025-04-*.json`) likely lack
  `u-at-<8hex>` IDs. M3's regex filter handles this — verify no NaN
  daysOnLot in the output.
- **CronCreate ≠ scheduled-tasks.** M11 explicitly uses
  `mcp__scheduled-tasks__create_scheduled_task`. CronCreate is
  session-only despite `durable: true`.
- **The mission's "write docs/handoff/EXECUTION_PLAN_<date>.md" deliverable**
  is fulfilled by §5+§9 of *this* plan-file. Medium session imports
  this content into the repo via the bootstrap step above.

---

## 11. Self-review (planner's own checklist)

- ✓ Every M-task in the user's mission (M0, M2, M3, M4, M6, M9, M10A,
  M11, M12) has a dedicated work order with files, steps, diffs, and
  verification.
- ✓ M4 / M6 / M9 / M3 include verbatim file:line refs from the planner's
  parallel grep.
- ✓ M0 includes the literal hook script that the medium session pastes
  into the Chrome MCP `javascript_tool` call.
- ✓ M12 includes the Option-A schema additive change (`msrpMeta`
  sibling) so `build_units_from_at.py` doesn't need to be touched.
- ✓ M11 explicitly uses `scheduled-tasks` not CronCreate.
- ✓ All commit messages caveman-style + scoped.
- ✓ Branch always `claude/verify-environment-setup-oTu3S`.
- ✓ Predeploy gate noted on every milestone.
- ✓ Apify approval flow documented.
- ✓ Stop conditions listed.
- ✓ Plan-mode constraint flagged at top + handoff to medium documented.

The plan does **not** ship code. The medium session executes; this is
solely the design + literal commands they will run.

---

## 12. Post-execution follow-ups (out of scope this round)

- M5 (loyalty/conquest seed in `incentives.json`) — covered in
  `MEDIUM_NEXT.md` M10. Run after M4 + M6 land so the UI proves out.
- M7 (heatpump UI chip in InventoryTable / UnitDrawer / Dossier) —
  covered in `MEDIUM_NEXT.md` M7. Run after M9 fills the queue.
- M8 (filtered heatpump queue regen) — `--filter-by-units` flag on
  `scripts/build_heatpump_queue.py`. Run when L1 expands beyond 20 rows.
- M1 (dossier link from row + colSpan fix) — small, mechanical, covered
  in `MEDIUM_NEXT.md` M11. Trivial Sonnet-tier work.
- M10 Phase B (Leasebusters scraper) and Phase C (UI) — gated on Phase A
  doc + user go-ahead.

### M13 [HIGH, NEW] — Cash / finance / lease comparison

**New scope as of 2026-05-02.** Buying intent shifted from cash-only to
"best of cash / finance / lease per unit, optimised for dealer leverage."

This is non-trivial — it touches scoring, OTD, and incentives:

1. **Schema additions.** `InventoryUnit` already carries `dealerAskingPrice`
   + `msrp`. Add per-unit lease/finance offers when present:
   - `financeOffers?: { aprPercent, termMonths, downPayment?, source }[]`
   - `leaseOffers?: { aprPercent, termMonths, monthlyPayment?, residualPercent?, kmAllowance?, downPayment?, source }[]`
   These ride on top of the unit, not the dealer, because OEM subvented
   APR programs are model + trim + month specific.

2. **Incentive surface.** Several `data/incentives.json` entries are
   *lease-or-finance-only* (e.g. Hyundai's "$2k subvented APR cash" only
   applies to OEM finance, not cash). The schema already supports
   `aprPercent` + `termMonths` + `residualPercent`. Filter inside
   `applicableIncentives` per the deal type the buyer is evaluating.

3. **OTD per-deal-type.** `computeOtd` currently assumes cash. Add
   `dealType: "cash" | "finance" | "lease"` to the OTD signature. For
   finance: same total but spread over the term (UI shows monthly +
   total interest). For lease: residual + km cap + buyout option, monthly
   payment as the primary surface.

4. **UI surface.** Per-unit drawer should let Ian flip between
   cash/finance/lease and see how the math + applicable-incentive list
   changes. The "best deal" score should pick the highest-net-leverage
   option across the three.

5. **Data sources.** OEM finance/lease offer pages:
   - https://www.hyundaicanada.com/en/offers
   - https://www.kia.ca/en/offers
   - Often updated monthly. Refresh on the same cron as M11.

**Effort estimate.** Schema + scoring math: 1 hr. Data fill (Exa-driven):
30 min. UI: 45 min. Total: 2-2.5 hr. Tag as a separate batch after
M0–M12 lands.

**Why not roll into M11/M12 now?** The buying-window critical path is
M0→M12 first (gets the inventory accurate + the dossier shipping). The
deal-type comparison is the next layer that uses that solid base. Doing
both in one batch risks shipping neither.
