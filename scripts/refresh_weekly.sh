#!/usr/bin/env bash
# Weekly EV Auto Trader Canada refresh — heavy multi-source sweep.
# Runs Sunday 8 AM ET (1 hr after the daily). Schedule via launchctl
# (separate plist; mirror com.evautotrader.refresh.plist with weekly cal).
#
# Pipeline:
#   1. Per-dealer inventory crawl (Crawl4AI, ~332 dealers × ~3 paths)
#   2. Dealer hero/offers screenshots (Playwright via Crawl4AI)
#   3. Promo banner extraction (Ollama Qwen2.5-VL local)
#   4. (Future I1a-bis) FB Marketplace via jdcodes1 MCP
#   5. Re-merge cross-listings
#   6. predeploy + commit + push (only if data delta)
set -euo pipefail

REPO="$HOME/ev-auto-trader-canada"
BRANCH="main"
LOG_DIR="$REPO/logs"

mkdir -p "$LOG_DIR"
exec >> "$LOG_DIR/cron.log" 2>&1

echo ""
echo "=== $(date -u +%FT%TZ) WEEKLY refresh start ==="
cd "$REPO"

# Heavy venv for crawl4ai (py3.12-pinned per dealer-decision doc).
if [ ! -d "$REPO/.venv-crawl" ]; then
  python3.12 -m venv "$REPO/.venv-crawl"
  "$REPO/.venv-crawl/bin/pip" install --quiet -r "$REPO/requirements-crawl.txt"
  "$REPO/.venv-crawl/bin/crawl4ai-setup" || echo "crawl4ai-setup WARN"
fi
# shellcheck disable=SC1091
source "$REPO/.venv-crawl/bin/activate"

# 1. Per-dealer inventory.
if [ -f scripts/scrape_dealers_inventory.py ]; then
  python scripts/scrape_dealers_inventory.py 2>&1 || echo "DEALERS WARN — continuing"
fi

# 2. Screenshots.
if [ -f scripts/screenshot_dealer_pages.py ]; then
  python scripts/screenshot_dealer_pages.py 2>&1 || echo "SCREENSHOTS WARN — continuing"
fi

# 3. Banner OCR via Ollama (gated on `ollama` command + qwen model).
if command -v ollama >/dev/null 2>&1 && ollama list 2>/dev/null | grep -q qwen2.5-vl; then
  python scripts/extract_dealer_promos.py 2>&1 || echo "PROMO WARN — continuing"
else
  echo "PROMO SKIP — ollama or qwen2.5-vl model missing; install: brew install ollama && ollama pull qwen2.5-vl:7b"
fi

# 4. (Future) FB Marketplace via jdcodes1 MCP — see FB_MCP_INSTALL_2026-05-05.md.

# 5. Re-merge.
if [ -f scripts/merge_cross_sources.py ]; then
  python3 scripts/merge_cross_sources.py 2>&1 || echo "MERGE WARN — continuing"
fi

# 6. predeploy + commit + push.
deactivate
npm run predeploy 2>&1 || { echo "PREDEPLOY FAIL — refusing to commit"; exit 2; }

if git diff --quiet data/; then
  echo "no data delta — skipping commit"
else
  git add data/
  git commit -m "weekly data refresh: $(date -u +%F)"
  git push origin "$BRANCH" 2>&1 || { echo "PUSH FAIL"; exit 3; }
  echo "pushed: $(git rev-parse --short HEAD)"
fi

echo "=== weekly refresh ok ==="
