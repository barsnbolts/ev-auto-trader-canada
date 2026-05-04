# TODO Index — 2026-05-04 (medium-tier work queue)

Every `TODO(medium)` marker in the codebase, indexed for grep + browse.
Read `docs/handoff/MEDIUM_RESUME_2026-05-04.md` for the full context.

```bash
# Find every TODO(medium) marker:
grep -rn "TODO(medium" src/ src-tauri/ scripts/ 2>/dev/null
```

## Inline TODOs

| Severity | File | What | Status |
|---|---|---|---|
| ~~★★★~~ | `scripts/scrape_kijiji.py` | Walks `__NEXT_DATA__` Apollo cache via lib_scrape_common — 251 unique listings, 97.6% VIN coverage. | **SHIPPED** `abeacb64` |
| ★★★ unblocker | `scripts/scrape_leasebusters.py` | Find Leasebusters XHR endpoint via Chrome MCP. Recipe: `CHROME_MCP_PROBE_PLAYBOOK.md` § Site 2. | **BLOCKED** — Chrome MCP browser not paired |
| ~~★★~~ | `src-tauri/src/lib.rs` `set_dock_badge` | NSDockTile via objc2 (feature-gated `cfg(target_os = "macos")`). | **SHIPPED** `a737e92a` |
| ★ low-pri | `scripts/verify_unit.py` | Improve Imperva bypass. "challenged" state already honest. | open |
| ★ low-pri | `scripts/scrape_unit_gallery.py` | Same Imperva walls. Cron retries nightly. | open |

## Recommended order (post 2026-05-04 medium pass)

1. **Leasebusters scraper** — single remaining D-core blocker. Needs
   user to pair Chrome MCP browser (open Chrome, install extension,
   click Connect). Then any session can run the playbook.
2. **Polyfills drop on Tauri target** (~3k tokens, ~100 kB save). See
   `docs/handoff/BUNDLE_AUDIT_2026-05-04.md`.
3. **`computeOtd` realistic-fixture vitest specs** (~6k tokens). 38
   specs already exist; OTD/finance/lease functions need their own
   pass with `data/incentives.json` fixtures.
4. **Phase D-bis** Hyundai Click-to-Buy + Kia D2C Media (~95k, paid Apify, needs user approval).
5. **Phase E** OEM dealer API direct (~60-80k, V8+).

See `docs/handoff/SESSION_2026-05-04_MEDIUM.md` for the state-at-close
of the medium pass that closed Q1, Q2, Q3, Q4, Q5 + Q5-followup,
U1, U3, U4, U5, T1, T2, T3, D1, D2 (21 commits).

## Verification ritual after EACH item ships

```bash
cd ~/ev-auto-trader-canada
npx tsc --noEmit                                              # exit=0
npm run predeploy                                             # exit=0 (Vercel build still works)
BUILD_TARGET=tauri npm run build:tauri:web                    # exit=0 (static export)
npx tauri build --target aarch64-apple-darwin                 # exit=0 (.app rebuilds)
open "src-tauri/target/aarch64-apple-darwin/release/bundle/macos/EV.trader CA.app"
# Smoke-test the changed feature
git add <changed files>
git commit -m "<phase>: <what>"
git push origin HEAD
```

## Stop conditions

- Tauri build fails twice on same root cause → halt + write to `TAURI_BUILD_LOG.md`
- About to push to `main` → halt
- About to add code-signing or notarization → halt (CLAUDE.md NO list)
- Single subagent dispatch > 70k tokens → halt
- Apify spend > $30 cumulative → halt

## How to resume cold

```
1. Read CLAUDE.md (operating rules)
2. Read docs/handoff/SESSION_2026-05-04_MEDIUM.md (state-at-close)
3. Open docs/handoff/MEDIUM_RUNWAY.md — 60 pre-baked tasks across
   tiers A-G (~220k tokens of work, all with file paths, expected
   diffs, verify commands, token estimates)
4. Check Chrome MCP: mcp__Claude_in_Chrome__list_connected_browsers
   - browser paired → Leasebusters (Tier I1 in RUNWAY) unblocked, run
     CHROME_MCP_PROBE_PLAYBOOK.md § Site 2
   - empty → drain RUNWAY tiers A → B → C → D → E → F → G in order
5. Each task: ship → npm run predeploy → commit (specific files) →
   git push → append to TAURI_BUILD_LOG.md → mark done in RUNWAY
6. After RUNWAY drains: re-prime per AUTONOMOUS_MODE.md § "When the
   ladder is exhausted"
```

## After the queue empties

**Do NOT stop.** Read `docs/handoff/AUTONOMOUS_MODE.md` and switch into
the autonomous loop. User said "keep working until I say stop." The
autonomous protocol has a 5-tier ladder of polish/verification/testing/
documentation/creative work, plus a re-prime mechanism when it runs dry.
Stop conditions are: user chat message, hard build failure twice, or
hitting a CLAUDE.md NO-list rule.
