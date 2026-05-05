# Cloud / remote session boot guide

> **Purpose:** Make the next-session boot work identically whether
> Claude Code (or any MCP-capable agent) runs on Ian's Mac, on a
> remote sandbox, in claude.ai's cloud workspace, in Cursor, in
> Codex, or anywhere else with `git` + Node + Python + Bash.
>
> **Canonical truth lives on GitHub.** The repo at
> `https://github.com/barsnbolts/ev-auto-trader-canada` **branch
> `claude/verify-environment-setup-oTu3S`** is the only source of
> state that survives across machines and sessions. Anything not
> committed there is local-only.

## ⚠ CRITICAL: NEVER USE `main`

**`main` is intentionally 132+ commits behind the working branch.** Per
CLAUDE.md NO list, we never push to `main`; all work lands on
`claude/verify-environment-setup-oTu3S`. Any cloud system, browser
view, sandbox, or sibling clone that defaults to `main` will show a
super-stale snapshot from early May 2026 and miss everything since.

If your session lands on `main` (or any branch other than
`claude/verify-environment-setup-oTu3S`):

```bash
git fetch origin
git checkout claude/verify-environment-setup-oTu3S \
  || git checkout -b claude/verify-environment-setup-oTu3S \
       origin/claude/verify-environment-setup-oTu3S
git reset --hard origin/claude/verify-environment-setup-oTu3S
git clean -fd       # nuke any stray untracked files
```

`git reset --hard origin/<work-branch>` is **safe** here — it only
mutates the LOCAL workspace to match the remote work branch. It does
NOT push, force-push, or modify the remote. It's the cloud-side
equivalent of "throw away whatever stale state I have, take
GitHub's word for canonical."

If `git pull` reports a divergent history (e.g., the cloud workspace
made unrelated commits while idle), prefer `git reset --hard` — the
local cloud commits are NOT canonical and should be discarded. The
only canonical state is what's pushed to origin's work branch from
Ian's Mac.

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

## Cloud-mode-safe boot (force-sync to canonical)

```bash
# 1. Clone OR force-sync to the work branch — never trust local cloud state.
WORK_BRANCH=claude/verify-environment-setup-oTu3S
REPO_URL=https://github.com/barsnbolts/ev-auto-trader-canada.git

if [ ! -d ev-auto-trader-canada ]; then
  git clone -b "$WORK_BRANCH" "$REPO_URL"
fi
cd ev-auto-trader-canada

# Force the local checkout to match origin's work branch exactly.
# Discards any stale local commits, untracked files, or branch drift.
git fetch origin --prune
git checkout "$WORK_BRANCH" \
  || git checkout -b "$WORK_BRANCH" "origin/$WORK_BRANCH"
git reset --hard "origin/$WORK_BRANCH"
git clean -fd

# Verify we're on the latest pushed state.
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$WORK_BRANCH")
[ "$LOCAL" = "$REMOTE" ] || { echo "DRIFT: $LOCAL != $REMOTE — investigate"; exit 1; }
echo "Synced to $LOCAL on $WORK_BRANCH"

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

**Branch-drift recovery (cloud-side only — for when the cloud workspace
sits on a stale branch / wrong branch / divergent state):**
```bash
git fetch origin --prune
git checkout claude/verify-environment-setup-oTu3S \
  || git checkout -b claude/verify-environment-setup-oTu3S \
       origin/claude/verify-environment-setup-oTu3S
git reset --hard origin/claude/verify-environment-setup-oTu3S
git clean -fd
```
Use only on cloud / non-canonical workspaces where local state is
known stale. Never run on Ian's Mac (his local IS the canonical
source of pushes).

## Why `main` looks "super super old"

If a cloud system / browser tab / Vercel-production-deploy / sibling
checkout shows the project at an early-May-2026 snapshot, it's pointing
at the `main` branch. `main` is **132+ commits behind** the working
branch by design. We never push to `main` per CLAUDE.md NO list.

To check what your environment actually has:
```bash
git rev-parse --abbrev-ref HEAD          # current branch
git rev-parse HEAD                       # current commit SHA
git rev-list --count HEAD..origin/claude/verify-environment-setup-oTu3S
                                          # commits behind canonical
```

If `current branch` reports `main` or anything other than
`claude/verify-environment-setup-oTu3S`, run the branch-drift recovery
above to switch + sync.

**Vercel preview URL note:** Vercel auto-deploys per push on every
branch by default, so the preview URL for the working branch is
always current. The "production" URL (whatever's tied to `main` in
Vercel project settings) is intentionally stale until a separate
release process. Use the working-branch preview URL to verify live
behavior, not production.

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
