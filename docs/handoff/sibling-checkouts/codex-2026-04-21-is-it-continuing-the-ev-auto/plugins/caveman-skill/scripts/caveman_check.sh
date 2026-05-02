#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

required_files=(
  "$ROOT_DIR/DATA_CONTRACT.md"
  "$ROOT_DIR/SOURCE_REGISTRY.md"
  "$ROOT_DIR/TASK_BOARD.md"
  "$ROOT_DIR/MEMORY.md"
  "$ROOT_DIR/plugins/caveman-skill/.codex-plugin/plugin.json"
  "$ROOT_DIR/plugins/caveman-skill/skills/caveman-skill/SKILL.md"
  "$ROOT_DIR/plugins/caveman-skill/skills/context-compactor/SKILL.md"
  "$ROOT_DIR/plugins/caveman-skill/scripts/compact_context.py"
)

for file in "${required_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "missing: $file" >&2
    exit 1
  fi
done

python3 -m json.tool "$ROOT_DIR/plugins/caveman-skill/.codex-plugin/plugin.json" >/dev/null

if [[ -f "$ROOT_DIR/.agents/plugins/marketplace.json" ]]; then
  python3 -m json.tool "$ROOT_DIR/.agents/plugins/marketplace.json" >/dev/null
fi

if [[ -f "$ROOT_DIR/.codex/hooks.json" ]]; then
  python3 -m json.tool "$ROOT_DIR/.codex/hooks.json" >/dev/null
fi

echo "caveman-skill ok"
