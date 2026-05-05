#!/usr/bin/env bash
# Daily EV Auto Trader Canada refresh.
# Runs free AT scrape → rebuild units → Kijiji + Leasebusters → cross-merge
# → snapshot → days-on-market → predeploy → commit + push to main.
#
# NOTE: this script DOES push to main directly (BRANCH=main below). The
# original branch-protection plan from V5 was relaxed once predeploy gates
# (typecheck + thermal + schema + 100+ vitest specs + next build) gave
# enough confidence. If you want the cron to land on a separate branch
# instead, change BRANCH below and add the merge step in the operator runbook.
#
# Triggered by launchd (com.evautotrader.refresh.plist) at 11:00 UTC = 7am ET DST.
# Log file at logs/cron.log (gitignored). Tail with: tail -30 logs/cron.log
set -euo pipefail

REPO="$HOME/ev-auto-trader-canada"
BRANCH="main"
LOG_DIR="$REPO/logs"

mkdir -p "$LOG_DIR"
exec >> "$LOG_DIR/cron.log" 2>&1

echo ""
echo "=== $(date -u +%FT%TZ) refresh start ==="
cd "$REPO"

# Activate venv (curl_cffi for AT Imperva bypass, plus future pip deps).
# Bootstrap venv on first run if missing.
if [ ! -d "$REPO/.venv" ]; then
  python3 -m venv "$REPO/.venv"
  "$REPO/.venv/bin/pip" install --quiet -r "$REPO/requirements.txt"
fi
# shellcheck disable=SC1091
source "$REPO/.venv/bin/activate"

# Dirty-tree guard — manual edit between cron runs would block rebase + wedge
# the cron via set -e. Catch it with a clear message instead.
git diff --quiet && git diff --cached --quiet || { echo "DIRTY TREE — uncommitted changes block rebase. Commit or stash, then re-run."; exit 1; }

# Pull working-branch updates (rebase to handle out-of-band commits cleanly).
git fetch origin "$BRANCH" 2>&1 || { echo "FETCH FAIL"; exit 1; }
git rebase "origin/$BRANCH" 2>&1 || { echo "REBASE FAIL — manual intervention"; exit 1; }

# AT __NEXT_DATA__ scraper (free path, primary). Writes data/_autotrader_raw.json.
# Exit 2 = consecutive free-path failures → trigger Apify fallback (TODO I0e-bis).
if [ -f scripts/scrape_autotrader.py ]; then
  python3 scripts/scrape_autotrader.py 2>&1
  AT_RC=$?
  if [ $AT_RC -eq 2 ]; then
    echo "AT FREE-PATH FAIL — Apify fallback not yet implemented; continuing with cached raw"
  elif [ $AT_RC -ne 0 ]; then
    echo "AT SCRAPE WARN (rc=$AT_RC) — continuing with cached raw"
  fi
fi

# Rebuild units.json (consumes scrape output + oem-pricing + specs + enrichment overlay).
python3 scripts/build_units_from_at.py 2>&1

# Derive daysOnLot from snapshot history → enrichment file → re-merge.
if [ -x scripts/derive_days_on_market.py ]; then
  python3 scripts/derive_days_on_market.py 2>&1
  python3 scripts/build_units_from_at.py 2>&1
fi

# Kijiji Autos scrape (free path, GraphQL via captured query). Soft fail — a
# Kijiji outage shouldn't block the AT-driven daily refresh.
if [ -f scripts/scrape_kijiji.py ]; then
  python3 scripts/scrape_kijiji.py 2>&1 || echo "KIJIJI WARN — continuing"
fi

# Leasebusters lease-takeover scrape (weekly enough but cheap to run daily).
if [ -f scripts/scrape_leasebusters.py ]; then
  python3 scripts/scrape_leasebusters.py 2>&1 || echo "LEASEBUSTERS WARN — continuing"
fi

# Cross-source merge → data/cross-listings.json (UI consumes for price-delta chips).
if [ -f scripts/merge_cross_sources.py ]; then
  python3 scripts/merge_cross_sources.py 2>&1 || echo "MERGE WARN — continuing"
fi

# Daily snapshot (overwrites same-day file; safe to re-run).
node scripts/snapshot.mjs 2>&1 || echo "SNAPSHOT WARN — continuing"

# Hard gate: typecheck + Next build must pass before any commit.
npm run predeploy 2>&1 || { echo "PREDEPLOY FAIL — refusing to commit"; exit 2; }

# Commit only if data actually changed. Avoid noise commits.
if git diff --quiet data/; then
  echo "no data delta — skipping commit"
else
  git add data/
  git commit -m "data refresh: $(date -u +%F)"
  git push origin "$BRANCH" 2>&1 || { echo "PUSH FAIL"; exit 3; }
  echo "pushed: $(git rev-parse --short HEAD)"
fi

echo "=== refresh ok ==="
