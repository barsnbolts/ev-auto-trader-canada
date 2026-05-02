# Meta-improvements — comprehensive rework analysis

**Written 2026-04-23** in response to Ian's ask to "think of absolutely every single variable and thing that can help" with autonomous multi-milestone execution.

This document inventories every variable I can identify that affects velocity, quality, durability, or Ian's experience — and maps each to a concrete lever. The highest-leverage items become queue entries in `AUTONOMOUS_PLAN.md`.

---

## 1. Variable inventory

### A — Velocity

| # | Variable | Current state | What I can do |
|---|---|---|---|
| A1 | **Tokens per turn** | Long narrative responses | Reply in past tense, drop "I'd like to" framing, cap narration at ~5 lines |
| A2 | **Round-trips for validation** | Batched OK but could batch harder | Every Chrome-MCP call is a full batch (3–5 actions); never one-off |
| A3 | **Permission dialogs mid-flow** | One dialog per browser action | Request access once per session for the full app list; localhost auto-approve |
| A4 | **Re-planning overhead** | I re-scope when context shifts | Live queue (done v4) removes re-plan cost |
| A5 | **Write vs Edit cost** | Write for new files, Edit for updates | Already optimized; Edit saves ~50% tokens on existing files |
| A6 | **Context switching across tasks** | Switching between physics / data / UI drops momentum | "Affinity batching" — cluster same-context items |

### B — Quality

| # | Variable | Current state | What I can do |
|---|---|---|---|
| B1 | **Type safety** | `tsc --noEmit` never run | Add to `milestone.py` ritual; fail loud on errors |
| B2 | **Runtime console errors** | Checked during Chrome-MCP validation | Automated — checked every milestone |
| B3 | **Visual regression** | Manual screenshot compare | Could save screenshots per-milestone to `screenshots/` folder; diff against prev |
| B4 | **Data integrity** | `metrics.py` checks for null-on-non-Low | Expand checks: range plausibility bounds, curve monotonicity, citation format |
| B5 | **Cross-vehicle testing** | Validated mostly with 1 vehicle | Make compare-tray test with 3 vehicles a required validation step |
| B6 | **Unit tests never actually run** | `thermal.test.ts` written but never executed | Add `tsx` invocation to `milestone.py` |

### C — Durability

| # | Variable | Current state | What I can do |
|---|---|---|---|
| C1 | **Version control** | ❌ NONE — project is one bad edit from disaster | `git init` NOW. Every milestone = commit. Biggest single lever. |
| C2 | **Docs currency** | SESSION_SUMMARY + PHASE_METRICS auto-freshen | Keep |
| C3 | **Memory conflicts** | 7 memory files, no conflict detection | Periodic `/consolidate-memory` |
| C4 | **Ritual discipline** | `milestone.py` is the enforcement | Keep; add typecheck + test-run steps |
| C5 | **Queue freshness** | I re-rank mentally | Enforce: re-rank explicitly in milestone.py prompt |
| C6 | **Rollback confidence** | No rollback procedure documented | After git init, document in CLAUDE.md |

### D — Ian's experience

| # | Variable | Current state | What I can do |
|---|---|---|---|
| D1 | **Message length** | I still write paragraphs | Target ≤10 lines per response during full-gas |
| D2 | **Decision points** | "Which of these three?" asks | Pick top-ranked item silently; only ask on values calls |
| D3 | **Status visibility** | SESSION_SUMMARY + PHASE_METRICS | Add a health dashboard section with live indicators |
| D4 | **Positive-signal absence** | Ian rarely celebrates wins | Assume satisfaction unless corrected; don't fish for feedback |
| D5 | **Accessibility (voice-to-text)** | Captured in memory | Already translating silently |
| D6 | **Mom use case** | Flagged as P-02 in queue | Keep in queue; surface when UI polish phase hits |

### E — Data

| # | Variable | Current state | What I can do |
|---|---|---|---|
| E1 | **Seed completeness** | 20 of ~60 possible vehicles | D-04 queued (bulk expand after D-01) |
| E2 | **Confidence mix** | 19 Medium, 1 Low, 0 High | D-01 Exa pass promotes many to High |
| E3 | **Seed freshness** | MSRPs decay monthly | Scheduled monthly Exa check (I-03) |
| E4 | **Citation quality** | Some citations only have brand; some have URL | Validator should enforce URL presence on High-confidence |
| E5 | **Physics model calibration** | Generic chemistry curves | Per-vehicle override when we get calibration data |

### F — Code

| # | Variable | Current state | What I can do |
|---|---|---|---|
| F1 | **Dependency count** | 4 runtime (tauri-api, react, react-dom, zustand). Lean. | Avoid adding more; built SVG chart without Recharts |
| F2 | **File size** | CompareView.tsx approaching 200 lines | When it hits ~250, split row definitions to separate file |
| F3 | **Type strictness** | `noUnusedLocals: true`, `noUnusedParameters: true` | Maintain; run tsc in ritual |
| F4 | **Test coverage** | One file: `thermal.test.ts`, never run | Run it; add tests for format.ts, store |
| F5 | **Zustand complexity** | Growing (filters + compare + thermal) | Consider splitting into domain stores when count > 8 |
| F6 | **Missing `persist` middleware** | State lost on HMR / refresh — likely cause of B-01 | Add `zustand/middleware` `persist` for `compareIds` + thermal slider |

### G — External inputs / dependencies

| # | Variable | Current state | What I can do |
|---|---|---|---|
| G1 | **MapKit JS key** | Not issued | Block F-05/F-06 until Ian gets one (free) |
| G2 | **Open Charge Map key** | Not issued | Block F-07 |
| G3 | **ABRP API key** | Not issued | Block F-08 |
| G4 | **iZEV status** | Paused since early 2025; 2026 unknown | Scheduled Exa check (I-03) |
| G5 | **Tesla Model Y Juniper specs** | Low confidence placeholder | Refresh during D-01 Exa pass |

### H — Automation

| # | Variable | Current state | What I can do |
|---|---|---|---|
| H1 | `metrics.py` | ✅ done | Extend with bounds-check on range_km/dc_charge |
| H2 | `milestone.py` | ✅ done | Add: tsc --noEmit, tsx tests, auto-git-commit |
| H3 | Typecheck | Manual / never | H2 includes it |
| H4 | Test runner | Never | H2 includes it |
| H5 | Screenshot capture | Per-milestone via Chrome-MCP | Save to `screenshots/<milestone>.png` automatically |
| H6 | Queue re-rank | Manual / in-head | `scripts/queue.py` to render + optionally sort |
| H7 | Git commit | ❌ absent | Add to milestone.py: auto-commit with generated message |
| H8 | Scheduled jobs | None | Use `schedule` skill for iZEV monthly refresh |
| H9 | Subagent dispatch | Used once for plugin search | Use for large data items (D-01) to keep context tight |

---

## 2. Top-15 concrete changes, in priority order

This is what I'd actually ship. First 5 are highest-leverage.

| Rank | Change | Why | Cost | New queue ID |
|---|---|---|---|---|
| 1 | **`git init` + commit + hooks** | Zero-cost; unlocks rollback, branching, blame, pre-commit. Currently one bad edit from disaster. | 1 | I-01 |
| 2 | **Zustand `persist` middleware on compareIds + thermal** | Fixes B-01 root cause. Compare tray survives HMR and refresh. UX improvement. | 1 | B-01 |
| 3 | **Extend `milestone.py`: tsc + tsx tests + git commit** | One script enforces quality+durability gate per milestone. Compounds forever. | 1 | I-04 |
| 4 | **CHANGELOG.md** | Versioned shippable history. Complements LEARNINGS (prose) with pure facts. | 1 | I-05 |
| 5 | **`scripts/queue.py`** | Parses AUTONOMOUS_PLAN.md, prints top-3 ready items in ranking formula order. Enforces explicit re-ranking. | 2 | I-06 |
| 6 | Explicit "don't do" list in CLAUDE.md | Anti-patterns: no-deps-without-asking, no-data-without-citation, no-destructive-ops, etc. | 1 | I-07 |
| 7 | Health dashboard in SESSION_SUMMARY | Live indicators: git clean?, tests passing?, metrics fresh?, Chrome connected? | 1 | I-08 |
| 8 | Pre-work ritual `scripts/next.py` | Lowers friction of starting a milestone; reads queue, outputs kickoff template | 2 | I-09 |
| 9 | Screenshot archive | Save each milestone screenshot to `screenshots/<id>-<date>.png` for regression | 1 | I-10 |
| 10 | Cost-tracking per milestone | Log estimated vs actual for future calibration | 1 | I-11 |
| 11 | Expanded `metrics.py` validators | Bounds check range, curve monotonicity, citation URL format | 1 | I-12 |
| 12 | Automated backup of `.auto-memory/` | `rsync` on each milestone. Cheap insurance. | 1 | I-13 |
| 13 | Subagent for D-01 Exa pass | Keep main context small; return verified seed JSON diff | 2 | I-14 |
| 14 | `/consolidate-memory` every 10 milestones | Prunes duplicates, resolves conflicts | 1 | I-15 |
| 15 | Rollback procedure doc | After git, define "to undo milestone N, do X" | 1 | I-16 |

---

## 3. Principles to adopt going forward

1. **Git is the safety net.** Every milestone ends with a commit. If something goes wrong, `git revert HEAD` and we're back.
2. **Tests + types are gates, not suggestions.** `milestone.py` refuses to close a milestone if tsc fails or tests fail.
3. **Affinity batching.** When I'm in "data mindset," do all data items back-to-back. Don't thrash between domains.
4. **Queue is truth.** If something's not in the queue, it doesn't exist. If in the queue, it's ranked.
5. **Screenshots are history.** Every milestone gets a PNG in `screenshots/` for visual diff later.
6. **Subagents for scale.** Anything that would pull 50+ pages of web data into my context belongs in a subagent.
7. **Learning is a ritual, not an afterthought.** After each milestone, I spend 60 seconds on the "what did I learn?" question — forcibly, via the ritual.

---

## 4. What I'm committing to do *right now* in this response

- **Execute I-01 (git init + initial commit).** Highest leverage, lowest cost. Makes all subsequent work reversible.
- **Insert items 2–15 above into the AUTONOMOUS_PLAN.md queue** with correct metadata.
- **No code changes beyond the git bootstrap.** The rest is queue-resident and gets pulled by normal execution.
- **Then I keep going on the app itself** unless Ian redirects.

After I-01, resuming the queue: next ready item is F-02 (cost-per-100km) unless this rework bumped priorities.

## 5. What I'll do going forward (standing changes)

- Keep responses to ≤10 lines during full-gas execution unless a meta question is asked
- Run `tsc --noEmit` + `tsx tests` mentally before declaring a milestone done
- Save a screenshot per milestone to `screenshots/` once the folder exists
- Explicitly re-rank the queue in-plan (write the new order) at every milestone boundary
- Commit per milestone
