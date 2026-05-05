#!/usr/bin/env bash
# Pre-compaction state dump — Codex-style "preserve recent state verbatim"
# workaround for Claude Code CLI (which lacks a structural tail-preservation
# primitive that Codex has natively, and that the SDK has via
# `pause_after_compaction`).
#
# Wire via ~/.claude/settings.json hooks block:
#   {
#     "hooks": {
#       "PreCompact": [
#         { "command": "/Users/ianmcadam/ev-auto-trader-canada/scripts/pre_compact_dump.sh" }
#       ]
#     }
#   }
#
# On /compact trigger, this script captures the *exact recent state* of the
# repo to docs/handoff/_pre_compact_state.md so the post-compact session can
# read it back verbatim — bypassing the lossy summarizer for the load-bearing
# bits (open files, last command, in-flight background tasks).
#
# CLAUDE.md instructs the post-compact session to read this file FIRST.
set -euo pipefail

REPO="$HOME/ev-auto-trader-canada"
OUT="$REPO/docs/handoff/_pre_compact_state.md"
mkdir -p "$(dirname "$OUT")"

cd "$REPO"

{
  echo "# Pre-compact state · $(date -u +%FT%TZ)"
  echo ""
  echo "_Auto-captured by scripts/pre_compact_dump.sh on /compact trigger._"
  echo "_Read this BEFORE acting on the post-compact summary — it has the verbatim recent state the summarizer compressed away._"
  echo ""

  echo "## Git state"
  echo '```'
  echo "HEAD: $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"
  echo "branch: $(git rev-parse --abbrev-ref HEAD)"
  echo "tracking: $(git rev-parse --abbrev-ref --symbolic-full-name @{upstream} 2>/dev/null || echo 'no upstream')"
  echo ""
  echo "Last 10 commits:"
  git log --oneline -10
  echo ""
  echo "Working tree status:"
  git status --short
  echo '```'
  echo ""

  echo "## Modified files (last 24h)"
  echo '```'
  git log --since="24 hours ago" --name-only --pretty=format: 2>/dev/null | sort -u | grep -v '^$' | head -40
  echo '```'
  echo ""

  echo "## Background processes (project-related)"
  echo '```'
  ps aux | grep -E "scrape_|refresh_|build_units|merge_cross|crawl4ai|ollama" | grep -v grep | awk '{print $2, $11, $12, $13}' | head -10 || echo "(none)"
  echo '```'
  echo ""

  echo "## Last cron output (tail)"
  echo '```'
  tail -20 "$REPO/logs/cron.log" 2>/dev/null || echo "(no cron log)"
  echo '```'
  echo ""

  echo "## Last scraper telemetry"
  echo '```'
  tail -3 "$REPO/data/_scraper_metrics.jsonl" 2>/dev/null || echo "(no telemetry)"
  echo '```'
  echo ""

  echo "## Active TODO docs (top of each)"
  for doc in "$REPO/docs/handoff/MEDIUM_RUNWAY.md" "$REPO/docs/handoff/SESSION_HANDOFF_"*.md "$REPO/docs/handoff/AUDIT_"*.md; do
    if [ -f "$doc" ]; then
      basename "$doc"
      echo '```'
      head -10 "$doc"
      echo '```'
      echo ""
    fi
  done

  echo "## Quick verify commands (run any of these to re-establish ground truth)"
  echo '```bash'
  echo "cd ~/ev-auto-trader-canada"
  echo "npm run test:run         # last known: 108/108 passing"
  echo "npm run predeploy        # last known: clean"
  echo "launchctl list | grep evaut    # cron registered"
  echo "tail -20 logs/cron.log         # last cron run"
  echo "python3 scripts/scraper_health.py --days 7"
  echo '```'
} > "$OUT"

echo "[pre_compact_dump] wrote $OUT" >&2
