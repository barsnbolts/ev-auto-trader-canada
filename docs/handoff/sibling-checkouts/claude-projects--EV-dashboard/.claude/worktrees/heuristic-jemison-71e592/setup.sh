#!/usr/bin/env bash
# EV Dashboard — Phase 1 setup script for macOS (Apple Silicon & Intel).
# Safe to re-run; it only installs what's missing.

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

say() { printf "${BLUE}▸${NC} %s\n" "$*"; }
ok()  { printf "${GREEN}✓${NC} %s\n" "$*"; }
warn(){ printf "${YELLOW}!${NC} %s\n" "$*"; }
err() { printf "${RED}✗${NC} %s\n" "$*"; }

if [[ "$(uname)" != "Darwin" ]]; then
    err "This setup script targets macOS. On other systems please install Node, Rust, and Python manually."
    exit 1
fi

say "EV Dashboard — Phase 1 setup"
echo

# --- 1. Homebrew -------------------------------------------------------------
if ! command -v brew >/dev/null 2>&1; then
    warn "Homebrew not found. Installing..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
else
    ok "Homebrew present ($(brew --version | head -n1))"
fi

# Ensure brew is on PATH for Apple Silicon in this shell.
if [[ -x "/opt/homebrew/bin/brew" ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
fi

# --- 2. Node.js (via nvm or brew) --------------------------------------------
if ! command -v node >/dev/null 2>&1; then
    warn "Node.js not found. Installing via Homebrew (node@20 LTS)..."
    brew install node
else
    NODE_MAJOR=$(node -v | sed 's/v\([0-9]*\).*/\1/')
    if (( NODE_MAJOR < 18 )); then
        warn "Node $(node -v) is older than v18. Upgrading..."
        brew upgrade node || brew install node
    else
        ok "Node.js $(node -v)"
    fi
fi

# --- 3. Rust (for Tauri builds) ----------------------------------------------
if ! command -v rustc >/dev/null 2>&1; then
    warn "Rust not found. Installing via rustup (required for Tauri desktop builds)..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
    # shellcheck disable=SC1091
    source "$HOME/.cargo/env"
else
    ok "Rust $(rustc --version | awk '{print $2}')"
fi

# --- 4. Python 3.11+ (for Phase 2 scrapers) ----------------------------------
if ! command -v python3 >/dev/null 2>&1; then
    warn "Python 3 not found. Installing via Homebrew..."
    brew install python@3.12
else
    PY_OK=$(python3 -c 'import sys; print("ok" if sys.version_info>=(3,11) else "old")')
    if [[ "$PY_OK" == "old" ]]; then
        warn "Python $(python3 --version) is older than 3.11. Installing python@3.12..."
        brew install python@3.12
    else
        ok "Python $(python3 --version)"
    fi
fi

# --- 5. npm dependencies -----------------------------------------------------
say "Installing npm packages..."
npm install

echo
ok "Setup complete."
echo
cat <<EOF
Next steps:

  ${GREEN}npm run dev${NC}          → open the app in a browser (fastest iteration; no Rust required)
  ${GREEN}npm run tauri:dev${NC}    → open the app as a real Mac desktop window (first run compiles Rust, takes a few minutes)
  ${GREEN}npm run tauri:build${NC}  → produce a .dmg you can install

The app opens at ${BLUE}http://localhost:1420${NC} when run in dev mode.
EOF
