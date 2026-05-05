# Cloud / remote session boot guide

> **Purpose:** Make the next-session boot work identically whether
> Claude Code (or any MCP-capable agent) runs on Ian's Mac, on a
> remote sandbox, in claude.ai's cloud workspace, in Cursor, in
> Codex, or anywhere else with `git` + Node + Python + Bash.
>
> **Canonical truth lives on GitHub.** The repo at
> `https://github.com/barsnbolts/ev-auto-trader-canada` (branch
> `claude/verify-environment-setup-oTu3S`) is the only source of
> state that survives across machines and sessions. Anything not
> committed there is local-only.

## What's portable vs Mac-only

| Concern | Portable (works anywhere) | Mac-only |
|---|---|---|
| Source code, data, snapshots, tests | ✓ committed to repo | — |
| `npm run typecheck / vitest / predeploy / build` | ✓ Node ≥ 18, Python 3 | — |
| `python3 scripts/validate_data_schemas.py` | ✓ stdlib only | — |
| `python3 scripts/refresh_daily.sh` data refresh | ✓ runs anywhere with Python + curl | — |
| GitHub push/pull workflow | ✓ via `gh` or HTTPS | — |
| Vercel preview deploy | ✓ runs from any CI / push trigger | — |
| Tauri `.app` build | — | ✗ requires macOS + Xcode CLT |
| `launchctl` cron loading | — | ✗ macOS launchd |
| `mcp__scheduled-tasks` MCP entries | — | ✗ Mac-local Claude Code |
| `mcp__Claude_in_Chrome` extension | — | ✗ paired browser on local Mac |
| Semble MCP install at `~/.claude.json` | per-machine | both — install once on each machine you use |

## Cloud-mode-safe boot

```bash
# 1. Clone OR pull
[ -d ev-auto-trader-canada ] && cd ev-auto-trader-canada || \
  git clone -b claude/verify-environment-setup-oTu3S \
    https://github.com/barsnbolts/ev-auto-trader-canada.git \
  && cd ev-auto-trader-canada
git pull --ff-only origin claude/verify-environment-setup-oTu3S

# 2. Install deps (idempotent — npm + Python stdlib only)
npm install                # restores node_modules from package-lock
# No pip deps; Python scripts are stdlib-only.

# 3. Verify state
git rev-parse HEAD
git status --short                              # expect empty
npm run typecheck                               # exit 0
npx vitest run                                  # 100/100 pass
npm run predeploy                               # exit 0
```

Note: `npm run predeploy` runs typecheck + thermal-audit + schema-audit + Next build.
On cloud Linux this will pass identically — none of those steps depend on Mac.

## Tasks that are cloud-friendly vs Mac-only

**Cloud-friendly (do these on remote):**
- All Tier A test specs (`vitest`)
- All Tier C UX polish (CSS + JSX edits)
- All Tier D test depth
- All Tier E data hygiene (validators, pruners, dashboards)
- All Tier F code quality (refactors, type tightening)
- All Tier G documentation
- Schema-audit extensions
- Bundle-size audits (`npm run build` works anywhere)

**Skip on cloud (Mac-only):**
- Tier I1 Leasebusters scraper that requires Chrome MCP browser pairing (paired browser is local). Cloud session can still write the scraper code; just can't run the live probe.
- Tauri `.app` build verification. Run `BUILD_TARGET=tauri npm run build:tauri:web` (static export) on cloud — that's the JS bundle and works on Linux. The actual `.app` bundle requires macOS + Xcode.
- Manual `launchctl load` and macOS-specific cron edits.

**Halfway:**
- Apify scrapers (Tier H, paid): work on cloud if you have API keys. Default state = no API keys = skip.
- Vercel deploy: triggered by push to origin → auto-rebuilds preview URL. No cloud-side action needed; just `git push`.

## Semble MCP — install per agent

Semble is a code-search MCP (server v1.27.0, ~98% fewer tokens than grep+read).
Install once per machine.

```bash
# Claude Code (current setup on Ian's Mac — already installed at user-scope)
claude mcp add semble -s user -- uvx --from "semble[mcp]" semble

# Cursor (different config path — see https://github.com/MinishLab/semble)
# Codex (similar uvx pattern)
# Cloud Claude — depends on which workspace; check the MCP add UI

# Verify (any agent):
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"probe","version":"1"}}}' \
  | uvx --from "semble[mcp]" semble 2>/dev/null \
  | head -1
# Expect: serverInfo:{"name":"semble","version":"1.27.0"} or newer.
```

**`uv` prereq:** install via `pip install uv`, `brew install uv` (Mac), or
`curl -LsSf https://astral.sh/uv/install.sh | sh` (anywhere).

## Backup discipline

| What | Backed up? | How |
|---|---|---|
| Source code | ✓ | `git push` to origin (GitHub) |
| Data files (`data/*.json`) | ✓ | Same — committed to repo |
| Snapshots | ✓ | `data/snapshots/YYYY-MM-DD.json` committed |
| Telemetry (`data/_scraper_metrics.jsonl`) | ✓ | Committed |
| VIN cache (`data/_vin_cache.json`) | ✓ | Committed |
| `node_modules` | ✗ | Regenerable from `package-lock.json` |
| `.env*` files | ✗ | Gitignored intentionally; recreate on each machine |
| Tauri build artifacts | ✗ | Regenerable; `.gitignore`d |
| MCP server configs | ✗ | Per-machine (`.claude.json` is gitignored implicitly via location) |

**Update protocol** (works locally + remote):
```bash
git pull --ff-only origin claude/verify-environment-setup-oTu3S
npm install                       # if package-lock changed
npm run predeploy                 # confirm clean
```

If origin is ahead and contains commits the local doesn't have:
- Pull. Don't rebase. Don't merge sideways.
- If your local HAS unpushed commits AND origin moved: stash, pull, replay.
  Never force-push to resolve a divergence on this branch.

## Disaster recovery

**Lost local repo:** `git clone https://github.com/barsnbolts/ev-auto-trader-canada.git`. Restored.

**Lost the Semble install:** `claude mcp add semble -s user -- uvx --from "semble[mcp]" semble` (or equivalent for your agent). One line.

**Lost Vercel deploy connection:** Vercel auto-redeploys on every push to the working branch. If the project link itself is lost, re-link via dashboard. Check `barsnbolts-projects/ev-auto-trader-canada` on Vercel.

**Lost the user-scope `.claude.json`:** No data lost — that's just MCP routing config. Re-add Semble (one line above). All other MCPs (`claude.ai Notion`, `Calendar`, etc.) re-link from the Claude Code app's "Connectors" UI.

**Lost everything but GitHub:** `git clone`, `npm install`, `npm run predeploy`, paste the bulletproof prompt. You're back in <5 minutes.

## What the next session needs from the user (zero, ideally)

If GitHub is reachable and Node + Python are installed: nothing.

The bulletproof prompt + this file + `MEDIUM_RUNWAY.md` cover every
state-recovery path. The session boots, pulls, verifies, and resumes.
