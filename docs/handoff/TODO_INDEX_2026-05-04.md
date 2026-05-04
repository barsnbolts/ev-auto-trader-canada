# TODO Index — 2026-05-04 (medium-tier work queue)

Every `TODO(medium)` marker in the codebase, indexed for grep + browse.
Read `docs/handoff/MEDIUM_RESUME_2026-05-04.md` for the full context.

```bash
# Find every TODO(medium) marker:
grep -rn "TODO(medium" src/ src-tauri/ scripts/ 2>/dev/null
```

## Inline TODOs

| Severity | File | Line ref | What |
|---|---|---|---|
| ★★★ unblocker | `scripts/scrape_kijiji.py` | top of file (header docstring) | Find Kijiji's real listing JSON XHR via Chrome MCP. Path A: capture endpoint. Path B: walk `__NEXT_DATA__`. Token: 15-25k. |
| ★★★ unblocker | `scripts/scrape_leasebusters.py` | top of file (header docstring) | Find Leasebusters' XHR endpoint via Chrome MCP. Confirm whether VIN appears post-login. Token: 10-15k. |
| ★★ ship-win | `src-tauri/src/lib.rs` | inside `set_dock_badge` fn | Replace stub with NSDockTile binding via objc2 crate. Token: 5k. |
| ★ low-pri | `scripts/verify_unit.py` | top of file (header docstring) | Improve Imperva bypass. Optional — current "challenged" state honestly handles the wall. |
| ★ low-pri | `scripts/scrape_unit_gallery.py` | top of file (header docstring) | Same Imperva walls as verify_unit.py. Cron retries nightly; no urgent action. |

## Recommended order

1. **Phase C dock badge** (`src-tauri/src/lib.rs`) — smallest, mechanical, ships an IPC win. Forces a Tauri rebuild, gives medium a sanity-check cycle through the build process. ~5k tokens. ~30 min.
2. **Phase D-core Kijiji scraper** (`scripts/scrape_kijiji.py`) — once Chrome MCP is connected, capture the XHR, swap fetch body, verify `data/_kijiji_raw.json` populates, run merge, see CrossSourceChip light up. ~15-25k. ~2 hr.
3. **Phase D-core Leasebusters scraper** (`scripts/scrape_leasebusters.py`) — same pattern. ~10-15k. ~1.5 hr.
4. **Phase D-bis** (Hyundai Click-to-Buy + Kia D2C Media) — defer until D-core is shipping data. ~95k total.
5. **Phase E** (OEM dealer API direct) — defer further. V8+. ~60-80k.

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
2. Read docs/handoff/MEDIUM_RESUME_2026-05-04.md (state-of-everything)
3. Read this doc (TODO_INDEX_2026-05-04.md) for the work queue
4. Pick item 1 above (dock badge) and ship it
5. Append a one-line entry to docs/handoff/TAURI_BUILD_LOG.md "Shipped commits"
6. Move to item 2
```

## After the queue empties

**Do NOT stop.** Read `docs/handoff/AUTONOMOUS_MODE.md` and switch into
the autonomous loop. User said "keep working until I say stop." The
autonomous protocol has a 5-tier ladder of polish/verification/testing/
documentation/creative work, plus a re-prime mechanism when it runs dry.
Stop conditions are: user chat message, hard build failure twice, or
hitting a CLAUDE.md NO-list rule.
