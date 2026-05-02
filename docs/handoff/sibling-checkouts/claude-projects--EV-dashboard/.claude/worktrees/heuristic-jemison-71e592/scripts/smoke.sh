#!/usr/bin/env bash
# One-command "does the whole project still work?" check.
# Caveman-style internal output; exit 0 = green, non-zero = red.
#
# Usage:
#   bash scripts/smoke.sh         # full run
#   bash scripts/smoke.sh --fast  # skip npm install (assume deps current)

set -euo pipefail

cd "$(dirname "$0")/.."

FAST=0
for arg in "$@"; do
  [ "$arg" = "--fast" ] && FAST=1
done

step() {
  echo ""
  echo "▸ $1"
}

ok() { echo "  ✅ $1"; }
fail() {
  echo "  ❌ $1"
  exit 1
}

step "1/6 npm install"
if [ "$FAST" -eq 1 ]; then
  echo "  (skipped — --fast)"
else
  npm install --silent || fail "npm install failed"
  ok "deps installed"
fi

step "2/6 npm run build"
npm run build --silent || fail "build failed"
ok "vite build + tsc green"

step "3/6 tsc --noEmit"
npx tsc --noEmit || fail "tsc errors"
ok "types clean"

step "4/6 npm test (vitest)"
npm test -- --run || fail "vitest failures"
ok "tests green"

step "5/6 validate.py"
python3 scripts/validate.py || fail "seed.json integrity failure"
ok "seed integrity green"

step "6/6 metrics.py"
python3 scripts/metrics.py || fail "metrics regen failed"
ok "PHASE_METRICS.md fresh"

echo ""
echo "🟢 SMOKE TEST GREEN — tree is in a shippable state"
